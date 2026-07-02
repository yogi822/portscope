/**
 * SECURITY-CRITICAL: validation gate for scan targets.
 *
 * Responsibilities:
 *   1. Enforce a strict shape: a valid domain name OR a valid IPv4/IPv6 address.
 *   2. Reject shell metacharacters and control characters (defence in depth —
 *      we never pass input to a shell, but we refuse to even carry hostile input).
 *   3. Block private / internal / reserved address ranges unless
 *      LOCAL_SCAN_ENABLED=true.
 *
 * Returns a typed result; it never throws on invalid input and never lets raw
 * user input flow onward untyped.
 */
import { isIP } from 'node:net';
import { z } from 'zod';
import { config } from '../config.js';

export type ValidateOk = { ok: true; target: string; kind: 'ip' | 'domain' };
export type ValidateErr = {
  ok: false;
  code: 'invalid_target' | 'private_range_blocked';
  message: string;
};
export type ValidateResult = ValidateOk | ValidateErr;

// SECURITY: any of these characters is an immediate rejection. This covers
// shell metacharacters, quoting, globbing, redirection, whitespace and control
// chars. Nmap targets legitimately contain only [a-zA-Z0-9 . : -].
const FORBIDDEN = /[^A-Za-z0-9.:-]/;

// zod schema: 1..253 chars (max DNS name length), trimmed, no forbidden chars.
const targetSchema = z
  .string()
  .trim()
  .min(1, 'Target is required.')
  .max(253, 'Target must be at most 253 characters.')
  .refine((v) => !FORBIDDEN.test(v), {
    message: 'Target contains forbidden characters.',
  });

// RFC 1123 hostname: labels of [a-z0-9-], not starting/ending with '-',
// each 1..63 chars, at least two labels (a TLD).
const DOMAIN_RE =
  /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;

/** Is this IPv4 address in a private / reserved / non-routable range? */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed → treat as blocked, fail safe
  }
  const [a, b] = parts;
  return (
    a === 0 || // 0.0.0.0/8 "this network"
    a === 10 || // 10.0.0.0/8 private
    a === 127 || // 127.0.0.0/8 loopback
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
    (a === 192 && b === 168) || // 192.168.0.0/16 private
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
    a >= 224 // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + 255.255.255.255
  );
}

/** Is this IPv6 address loopback / link-local / ULA / unspecified / multicast? */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true; // loopback / unspecified
  // Strip a possible zone id (fe80::1%eth0) before prefix checks.
  const addr = lower.split('%')[0];
  const firstHextet = addr.split(':')[0];
  // fe80::/10 link-local: first hextet fe80..febf
  if (/^fe[89ab]/.test(firstHextet)) return true;
  // fc00::/7 unique local (fc.. / fd..)
  if (/^f[cd]/.test(firstHextet)) return true;
  // ff00::/8 multicast
  if (firstHextet.startsWith('ff')) return true;
  // IPv4-mapped/compat (::ffff:127.0.0.1 etc.) — reuse v4 check on the tail.
  const v4 = addr.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) return isPrivateIPv4(v4[1]);
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // not a valid IP → fail safe
}

export function validateTarget(input: unknown): ValidateResult {
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'invalid_target',
      message: parsed.error.issues[0]?.message ?? 'Invalid target.',
    };
  }
  const target = parsed.data;

  const ipVersion = isIP(target);

  if (ipVersion !== 0) {
    // It's an IP literal. SECURITY: block private ranges unless explicitly enabled.
    if (!config.localScanEnabled && isPrivateAddress(target)) {
      return {
        ok: false,
        code: 'private_range_blocked',
        message:
          'Target is a private/internal address. Set LOCAL_SCAN_ENABLED=true to scan it.',
      };
    }
    return { ok: true, target, kind: 'ip' };
  }

  // SECURITY: handle localhost aliases BEFORE the general domain check —
  // 'localhost' is a single-label name that wouldn't match the FQDN regex.
  // Note the documented TOCTOU limitation: any domain may still resolve to a
  // private IP at scan time (see README). For a local, trusted-operator tool
  // this is accepted.
  const lower = target.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) {
    if (!config.localScanEnabled) {
      return {
        ok: false,
        code: 'private_range_blocked',
        message: 'localhost is blocked. Set LOCAL_SCAN_ENABLED=true to scan it.',
      };
    }
    return { ok: true, target, kind: 'domain' };
  }

  // Otherwise it must be a valid (multi-label) domain name.
  if (!DOMAIN_RE.test(target)) {
    return {
      ok: false,
      code: 'invalid_target',
      message: 'Target must be a valid domain name or IP address.',
    };
  }

  return { ok: true, target, kind: 'domain' };
}
