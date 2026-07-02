/**
 * Shared domain types used by both the Worker API and the Scanner Agent.
 * Pure and runtime-agnostic — no Node or Cloudflare specific APIs here.
 */

export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ScanType = 'quick' | 'service';

/** Client request to start a scan. */
export interface ScanRequest {
  target: string;
  scanType: ScanType;
}

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

/** The complete parsed scan result (produced by the Scanner Agent). */
export interface ScanResult {
  target: string;
  hosts: ScanHost[];
  raw: unknown; // full parsed Nmap XML, retained for future use
}

/** The persisted scan record and its lifecycle metadata. */
export interface Scan {
  id: string; // UUID v4
  target: string; // user's original input (domain or IP)
  resolvedIp?: string; // vetted IP actually scanned (domains are pinned to it)
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

/**
 * Contract for the internal Scanner Agent endpoint (POST /scan).
 * The Worker sends this; the Agent returns AgentScanResponse.
 */
export interface AgentScanRequest {
  target: string;
  scanType: ScanType;
}

export interface AgentScanResponse {
  resolvedIp: string;
  provider: string; // 'nmap'
  result: ScanResult;
}
