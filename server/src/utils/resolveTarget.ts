/**
 * SECURITY: resolve-first gating.
 *
 * A syntactically-valid domain can still resolve to a private/internal IP (or
 * change between checks — TOCTOU). To close that gap we:
 *   1. Resolve the domain to its IP address(es) *before* scanning.
 *   2. Reject if ANY resolved address is private/loopback/link-local/reserved,
 *      unless LOCAL_SCAN_ENABLED=true.
 *   3. Pin the scan to the vetted IP we resolved (not the domain), so Nmap
 *      cannot independently resolve to a different address afterwards.
 *
 * IP-literal targets are passed straight through — they were already gated
 * syntactically by validateTarget.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { config } from '../config.js';
import { isPrivateAddress } from './validateTarget.js';

export type ResolveOk = {
  ok: true;
  scanTarget: string; // IP to actually scan (pinned)
  resolvedAddresses: string[];
};
export type ResolveErr = {
  ok: false;
  code: 'private_range_blocked' | 'resolution_failed';
  message: string;
};
export type ResolveResult = ResolveOk | ResolveErr;

/** Injectable DNS lookup (defaults to Node's resolver; overridden in tests). */
export type AddressLookup = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

const DNS_TIMEOUT_MS = 5_000;

const defaultLookup: AddressLookup = (hostname) =>
  // `all: true` returns every A/AAAA record so we can gate all of them.
  lookup(hostname, { all: true });

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error('dns timeout')), ms).unref();
    }),
  ]);
}

export async function resolveAndGate(
  target: string,
  lookupFn: AddressLookup = defaultLookup,
): Promise<ResolveResult> {
  // IP literal: already validated + gated upstream; scan it directly.
  if (isIP(target) !== 0) {
    return { ok: true, scanTarget: target, resolvedAddresses: [target] };
  }

  // Domain: resolve to concrete addresses.
  let addresses: string[];
  try {
    const records = await withTimeout(lookupFn(target), DNS_TIMEOUT_MS);
    addresses = records.map((r) => r.address).filter((a) => isIP(a) !== 0);
  } catch {
    return {
      ok: false,
      code: 'resolution_failed',
      message: 'Could not resolve the target domain.',
    };
  }

  if (addresses.length === 0) {
    return {
      ok: false,
      code: 'resolution_failed',
      message: 'The target domain did not resolve to any IP address.',
    };
  }

  // SECURITY: gate EVERY resolved address — one private hit blocks the scan.
  if (!config.localScanEnabled) {
    const privateHit = addresses.find(isPrivateAddress);
    if (privateHit) {
      return {
        ok: false,
        code: 'private_range_blocked',
        message: `Target resolves to a private/internal address (${privateHit}). Set LOCAL_SCAN_ENABLED=true to scan it.`,
      };
    }
  }

  // Pin to the first vetted address to eliminate TOCTOU.
  return { ok: true, scanTarget: addresses[0], resolvedAddresses: addresses };
}
