import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveAndGate, type AddressLookup } from '../utils/resolveTarget.js';

/** Build a fake DNS resolver returning fixed addresses. */
function fakeLookup(...addresses: string[]): AddressLookup {
  return async () => addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
}

const failLookup: AddressLookup = async () => {
  throw new Error('ENOTFOUND');
};

describe('resolveAndGate (default: LOCAL_SCAN_ENABLED=false)', () => {
  it('passes IP literals straight through without DNS', async () => {
    // lookup would throw, proving it is never called for IP literals.
    const r = await resolveAndGate('45.33.32.156', failLookup);
    expect(r).toMatchObject({ ok: true, scanTarget: '45.33.32.156' });
  });

  it('allows a domain that resolves to a public IP, pinned to that IP', async () => {
    const r = await resolveAndGate('scanme.nmap.org', fakeLookup('45.33.32.156'));
    expect(r).toMatchObject({ ok: true, scanTarget: '45.33.32.156' });
  });

  it('BLOCKS a domain that resolves to a private IP', async () => {
    const r = await resolveAndGate('internal.example.com', fakeLookup('10.0.0.5'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('private_range_blocked');
  });

  it('BLOCKS a domain that resolves to loopback', async () => {
    const r = await resolveAndGate('evil.example.com', fakeLookup('127.0.0.1'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('private_range_blocked');
  });

  it('BLOCKS if ANY of several resolved addresses is private (DNS rebinding style)', async () => {
    const r = await resolveAndGate('mixed.example.com', fakeLookup('8.8.8.8', '192.168.1.50'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('private_range_blocked');
  });

  it('BLOCKS a domain resolving to link-local IPv6', async () => {
    const r = await resolveAndGate('v6.example.com', fakeLookup('fe80::1'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('private_range_blocked');
  });

  it('reports resolution_failed when DNS throws', async () => {
    const r = await resolveAndGate('nope.example.com', failLookup);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('resolution_failed');
  });

  it('reports resolution_failed when no addresses are returned', async () => {
    const r = await resolveAndGate('empty.example.com', fakeLookup());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('resolution_failed');
  });
});

describe('resolveAndGate with LOCAL_SCAN_ENABLED=true', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('LOCAL_SCAN_ENABLED', 'true');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('allows a domain resolving to a private IP when enabled', async () => {
    const mod = await import('../utils/resolveTarget.js');
    const lookup: AddressLookup = async () => [{ address: '192.168.1.50', family: 4 }];
    const r = await mod.resolveAndGate('internal.example.com', lookup);
    expect(r).toMatchObject({ ok: true, scanTarget: '192.168.1.50' });
  });
});
