/**
 * SECURITY-CRITICAL: syntactic validation gate for scan targets.
 * Pure (no node:*), so it runs on the Worker (Node today, Cloudflare Workers
 * later). DNS resolution + resolve-first gating happens in the Scanner Agent.
 *
 *   1. Strict shape: a valid domain OR IPv4/IPv6, <=253 chars, no metacharacters.
 *   2. Block private IP literals unless `allowPrivate` (LOCAL_SCAN_ENABLED).
 */
import { z } from 'zod';
import { isIP, isPrivateAddress } from './ip.js';

export type ValidateOk = { ok: true; target: string; kind: 'ip' | 'domain' };
export type ValidateErr = {
  ok: false;
  code: 'invalid_target' | 'private_range_blocked';
  message: string;
};
export type ValidateResult = ValidateOk | ValidateErr;

// SECURITY: reject anything outside the legal target alphabet (defence in depth).
const FORBIDDEN = /[^A-Za-z0-9.:-]/;

const targetSchema = z
  .string()
  .trim()
  .min(1, 'Target is required.')
  .max(253, 'Target must be at most 253 characters.')
  .refine((v) => !FORBIDDEN.test(v), {
    message: 'Target contains forbidden characters.',
  });

// RFC 1123 hostname: multi-label, each label 1..63 chars, no leading/trailing '-'.
const DOMAIN_RE =
  /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;

export function validateTarget(
  input: unknown,
  opts: { allowPrivate: boolean },
): ValidateResult {
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'invalid_target',
      message: parsed.error.issues[0]?.message ?? 'Invalid target.',
    };
  }
  const target = parsed.data;

  if (isIP(target) !== 0) {
    // IP literal — gate private ranges directly.
    if (!opts.allowPrivate && isPrivateAddress(target)) {
      return {
        ok: false,
        code: 'private_range_blocked',
        message:
          'Target is a private/internal address. Enable LOCAL_SCAN_ENABLED to scan it.',
      };
    }
    return { ok: true, target, kind: 'ip' };
  }

  // localhost aliases (single-label) handled before the FQDN check.
  const lower = target.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) {
    if (!opts.allowPrivate) {
      return {
        ok: false,
        code: 'private_range_blocked',
        message: 'localhost is blocked. Enable LOCAL_SCAN_ENABLED to scan it.',
      };
    }
    return { ok: true, target, kind: 'domain' };
  }

  if (!DOMAIN_RE.test(target)) {
    return {
      ok: false,
      code: 'invalid_target',
      message: 'Target must be a valid domain name or IP address.',
    };
  }

  return { ok: true, target, kind: 'domain' };
}
