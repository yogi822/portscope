import { describe, it, expect } from 'vitest';
import { validateTarget } from '../validateTarget.js';
import { isIP, isPrivateAddress } from '../ip.js';

const BLOCK = { allowPrivate: false };
const ALLOW = { allowPrivate: true };

describe('validateTarget (allowPrivate: false)', () => {
  it('accepts a valid public domain', () => {
    expect(validateTarget('scanme.nmap.org', BLOCK)).toMatchObject({
      ok: true,
      kind: 'domain',
    });
  });

  it('accepts public IPv4 and IPv6', () => {
    expect(validateTarget('45.33.32.156', BLOCK)).toMatchObject({ ok: true, kind: 'ip' });
    expect(
      validateTarget('2606:2800:220:1:248:1893:25c8:1946', BLOCK),
    ).toMatchObject({ ok: true, kind: 'ip' });
  });

  it.each([
    'example.com; rm -rf /',
    'example.com && whoami',
    'a b',
    'foo>bar',
    '$(reboot)',
    '`id`',
  ])('rejects shell metacharacters: %s', (input) => {
    const r = validateTarget(input, BLOCK);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('invalid_target');
  });

  it('rejects empty and over-length', () => {
    expect(validateTarget('', BLOCK).ok).toBe(false);
    expect(validateTarget('a'.repeat(254), BLOCK).ok).toBe(false);
  });

  it.each(['127.0.0.1', '10.0.0.5', '192.168.1.1', '169.254.1.1', '::1'])(
    'blocks private literal: %s',
    (ip) => {
      const r = validateTarget(ip, BLOCK);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('private_range_blocked');
    },
  );

  it('blocks localhost by name', () => {
    const r = validateTarget('localhost', BLOCK);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('private_range_blocked');
  });
});

describe('validateTarget (allowPrivate: true)', () => {
  it('allows private ranges and localhost when enabled', () => {
    expect(validateTarget('192.168.1.10', ALLOW).ok).toBe(true);
    expect(validateTarget('localhost', ALLOW).ok).toBe(true);
  });
});

describe('pure ip helpers', () => {
  it('detects IP versions', () => {
    expect(isIP('8.8.8.8')).toBe(4);
    expect(isIP('2001:4860:4860::8888')).toBe(6);
    expect(isIP('not-an-ip')).toBe(0);
  });
  it('flags private vs public', () => {
    expect(isPrivateAddress('192.168.0.1')).toBe(true);
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('2001:4860:4860::8888')).toBe(false);
  });
});
