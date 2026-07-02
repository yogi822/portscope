import { describe, it, expect } from 'vitest';
import { resolveAndGate, type AddressLookup } from '../resolveTarget.js';

function fakeLookup(...addresses: string[]): AddressLookup {
  return async () => addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
}
const failLookup: AddressLookup = async () => {
  throw new Error('ENOTFOUND');
};

// Note: these run with LOCAL_SCAN_ENABLED unset (private ranges blocked).
describe('resolveAndGate', () => {
  it('passes IP literals through without DNS', async () => {
    const r = await resolveAndGate('45.33.32.156', failLookup);
    expect(r).toMatchObject({ ok: true, scanTarget: '45.33.32.156' });
  });

  it('pins a domain to its resolved public IP', async () => {
    const r = await resolveAndGate('scanme.nmap.org', fakeLookup('45.33.32.156'));
    expect(r).toMatchObject({ ok: true, scanTarget: '45.33.32.156' });
  });

  it('BLOCKS a domain resolving to a private IP', async () => {
    const r = await resolveAndGate('internal.example.com', fakeLookup('10.0.0.5'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('private_range_blocked');
  });

  it('BLOCKS if ANY resolved address is private (rebinding-style)', async () => {
    const r = await resolveAndGate('mixed.example.com', fakeLookup('8.8.8.8', '192.168.1.50'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('private_range_blocked');
  });

  it('reports resolution_failed on DNS error and empty results', async () => {
    expect((await resolveAndGate('nope.example.com', failLookup)).ok).toBe(false);
    const empty = await resolveAndGate('empty.example.com', fakeLookup());
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.code).toBe('resolution_failed');
  });
});
