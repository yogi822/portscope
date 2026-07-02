/**
 * Core domain types, framework-agnostic (no Express/HTTP concepts here).
 * These describe the scan lifecycle and the fully-parsed result we persist.
 */

export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ScanType = 'quick' | 'service';

/** A single port entry from a scanned host. */
export interface ScanPort {
  portId: number;
  protocol: string; // tcp | udp
  state: string; // open | closed | filtered
  service?: string;
  product?: string;
  version?: string;
  extraInfo?: string;
}

/** A single host in the scan result. */
export interface ScanHost {
  address: string;
  hostnames: string[];
  status: string; // up | down
  ports: ScanPort[];
}

/**
 * The complete parsed scan result. We store the full structured output
 * (including `raw`, the untouched xml2js JSON) — not only displayed fields —
 * so future features can use richer data without re-scanning.
 */
export interface ScanResult {
  target: string;
  hosts: ScanHost[];
  raw: unknown;
}

/** The persisted scan record and its lifecycle metadata. */
export interface Scan {
  id: string; // UUID v4
  target: string; // the user's original input (domain or IP)
  resolvedIp?: string; // the vetted IP actually scanned (domains are pinned to it)
  scanType: ScanType;
  status: ScanStatus;
  provider: string; // e.g. 'nmap'
  createdAt: string; // ISO 8601
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  result?: ScanResult;
  error?: string; // safe, client-facing failure reason
}
