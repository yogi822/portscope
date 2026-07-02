import { describe, it, expect } from 'vitest';
import { parseNmapXml } from '../utils/nmapXml.js';

// A trimmed but realistic `nmap -sV -oX -` output fixture.
const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<nmaprun scanner="nmap" args="nmap -sV -oX - scanme.nmap.org" start="1700000000">
  <host starttime="1700000000" endtime="1700000042">
    <status state="up" reason="echo-reply"/>
    <address addr="45.33.32.156" addrtype="ipv4"/>
    <hostnames>
      <hostname name="scanme.nmap.org" type="user"/>
    </hostnames>
    <ports>
      <port protocol="tcp" portid="22">
        <state state="open" reason="syn-ack"/>
        <service name="ssh" product="OpenSSH" version="6.6.1p1" extrainfo="Ubuntu"/>
      </port>
      <port protocol="tcp" portid="80">
        <state state="open" reason="syn-ack"/>
        <service name="http" product="Apache httpd"/>
      </port>
      <port protocol="tcp" portid="443">
        <state state="closed" reason="conn-refused"/>
      </port>
    </ports>
  </host>
</nmaprun>`;

describe('parseNmapXml', () => {
  it('parses hosts, ports, services and versions', async () => {
    const result = await parseNmapXml(FIXTURE, 'scanme.nmap.org');

    expect(result.target).toBe('scanme.nmap.org');
    expect(result.hosts).toHaveLength(1);

    const host = result.hosts[0];
    expect(host.address).toBe('45.33.32.156');
    expect(host.hostnames).toContain('scanme.nmap.org');
    expect(host.status).toBe('up');
    expect(host.ports).toHaveLength(3);

    const ssh = host.ports.find((p) => p.portId === 22)!;
    expect(ssh).toMatchObject({
      protocol: 'tcp',
      state: 'open',
      service: 'ssh',
      product: 'OpenSSH',
      version: '6.6.1p1',
    });

    const http = host.ports.find((p) => p.portId === 80)!;
    expect(http.service).toBe('http');
    expect(http.version).toBeUndefined();
  });

  it('retains the complete raw parsed object', async () => {
    const result = await parseNmapXml(FIXTURE, 'scanme.nmap.org');
    expect(result.raw).toBeTypeOf('object');
    expect((result.raw as any).nmaprun).toBeDefined();
  });

  it('handles empty / hostless output gracefully', async () => {
    const empty = `<?xml version="1.0"?><nmaprun scanner="nmap"></nmaprun>`;
    const result = await parseNmapXml(empty, '1.2.3.4');
    expect(result.hosts).toEqual([]);
  });
});
