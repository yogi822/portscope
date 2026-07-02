import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateTarget, isPrivateAddress } from '../utils/validateTarget.js';

describe('validateTarget (default: LOCAL_SCAN_ENABLED=false)', () => {
  it('accepts a valid public domain', () => {
    const r = validateTarget('scanme.nmap.org');
    expect(r).toMatchObject({ ok: true, kind: 'domain', target: 'scanme.nmap.org' });
  });

  it('accepts a valid public IPv4', () => {
    const r = validateTarget('45.33.32.156');
    expect(r).toMatchObject({ ok: true, kind: 'ip' });
  });

  it('accepts a valid public IPv6', () => {
    const r = validateTarget('2606:2800:220:1:248:1893:25c8:1946');
    expect(r).toMatchObject({ ok: true, kind: 'ip' });
  });

  it('trims surrounding whitespace', () => {
    const r = validateTarget('  example.com  ');
    expect(r).toMatchObject({ ok: true, target: 'example.com' });
  });

  it.each([
    'example.com; rm -rf /',
    'example.com && whoami',
    'example.com | cat',
    '$(reboot)',
    '`id`',
    'a b',
    'foo>bar',
    "a'b",
    'exa*mple.com',
  ])('rejects shell metacharacters: %s', (input) => {
    const r = validateTarget(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('invalid_target');
  });

  it('rejects empty input', () => {
    expect(validateTarget('').ok).toBe(false);
  });

  it('rejects over-length input (>253 chars)', () => {
    const long = 'a'.repeat(254);
    expect(validateTarget(long).ok).toBe(false);
  });

  it('rejects a bare word that is not a domain or IP', () => {
    const r = validateTarget('notadomain');
    expect(r.ok).toBe(false);
  });

  it.each([
    '127.0.0.1',
    '10.0.0.5',
    '172.16.4.4',
    '192.168.1.1',
    '169.254.1.1',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
  ])('blocks private/internal address: %s', (input) => {
    const r = validateTarget(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('private_range_blocked');
  });

  it('blocks localhost by name', () => {
    const r = validateTarget('localhost');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('private_range_blocked');
  });
});

describe('isPrivateAddress helper', () => {
  it('flags private and clears public', () => {
    expect(isPrivateAddress('192.168.0.1')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(isPrivateAddress('2001:4860:4860::8888')).toBe(false);
  });
});

describe('validateTarget with LOCAL_SCAN_ENABLED=true', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('LOCAL_SCAN_ENABLED', 'true');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('allows private ranges when enabled', async () => {
    const mod = await import('../utils/validateTarget.js');
    const r = mod.validateTarget('192.168.1.10');
    expect(r.ok).toBe(true);
  });

  it('allows localhost when enabled', async () => {
    const mod = await import('../utils/validateTarget.js');
    expect(mod.validateTarget('localhost').ok).toBe(true);
  });
});
