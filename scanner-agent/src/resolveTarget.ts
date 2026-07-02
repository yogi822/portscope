/**
 * SECURITY: resolve-first gating (runs in the trusted Agent, which has DNS).
 * Resolves a domain to its IP(s), blocks any private/internal address, and pins
 * the scan to the vetted IP so Nmap cannot re-resolve to a different address.
 * IP literals pass straight through (already validated syntactically upstream).
 */
import { lookup } from 'node:dns/promises';
import { isIP, isPrivateAddress } from '@portscope/shared';
import { config } from './config.js';

export type ResolveOk = { ok: true; scanTarget: string; resolvedAddresses: string[] };
export type ResolveErr = {
  ok: false;
  code: 'private_range_blocked' | 'resolution_failed';
  message: string;
};
export type ResolveResult = ResolveOk | ResolveErr;

export type AddressLookup = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

const DNS_TIMEOUT_MS = 5_000;

const defaultLookup: AddressLookup = (hostname) => lookup(hostname, { all: true });

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_res, rej) => {
      setTimeout(() => rej(new Error('dns timeout')), ms).unref();
    }),
  ]);
}

export async function resolveAndGate(
  target: string,
  lookupFn: AddressLookup = defaultLookup,
): Promise<ResolveResult> {
  if (isIP(target) !== 0) {
    return { ok: true, scanTarget: target, resolvedAddresses: [target] };
  }

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

  if (!config.localScanEnabled) {
    const privateHit = addresses.find(isPrivateAddress);
    if (privateHit) {
      return {
        ok: false,
        code: 'private_range_blocked',
        message: `Target resolves to a private/internal address (${privateHit}). Enable LOCAL_SCAN_ENABLED to scan it.`,
      };
    }
  }

  return { ok: true, scanTarget: addresses[0], resolvedAddresses: addresses };
}
