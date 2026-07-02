/**
 * Parses Nmap XML (from `-oX -`) into our typed ScanResult.
 * The full untouched xml2js object is retained on `result.raw` so no data is lost.
 */
import { parseStringPromise } from 'xml2js';
import type { ScanResult, ScanHost, ScanPort } from '../types.js';

/** Coerce xml2js's "sometimes array, sometimes object" shape into an array. */
function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export async function parseNmapXml(xml: string, target: string): Promise<ScanResult> {
  const raw = await parseStringPromise(xml, {
    explicitArray: false,
    mergeAttrs: true,
  });

  const hosts: ScanHost[] = [];

  for (const host of asArray<any>(raw?.nmaprun?.host)) {
    // Address: prefer IPv4/IPv6 addr; a host may have several address entries.
    const addresses = asArray<any>(host.address);
    const ipAddr =
      addresses.find((a) => a.addrtype === 'ipv4' || a.addrtype === 'ipv6')?.addr ??
      addresses[0]?.addr ??
      target;

    const hostnames = asArray<any>(host.hostnames?.hostname)
      .map((h) => h.name)
      .filter((n): n is string => typeof n === 'string');

    const ports: ScanPort[] = asArray<any>(host.ports?.port).map((p) => {
      const svc = p.service ?? {};
      return {
        portId: Number(p.portid),
        protocol: String(p.protocol ?? 'tcp'),
        state: String(p.state?.state ?? 'unknown'),
        service: svc.name || undefined,
        product: svc.product || undefined,
        version: svc.version || undefined,
        extraInfo: svc.extrainfo || undefined,
      };
    });

    hosts.push({
      address: String(ipAddr),
      hostnames,
      status: String(host.status?.state ?? 'unknown'),
      ports,
    });
  }

  return { target, hosts, raw };
}
