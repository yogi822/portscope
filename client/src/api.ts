/**
 * Typed fetch client. All requests go through the Vite proxy at /api.
 * Types mirror the server domain model (kept in sync manually for v1).
 */

export type ScanType = 'quick' | 'service';
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ScanPort {
  portId: number;
  protocol: string;
  state: string;
  service?: string;
  product?: string;
  version?: string;
  extraInfo?: string;
}

export interface ScanHost {
  address: string;
  hostnames: string[];
  status: string;
  ports: ScanPort[];
}

export interface ScanResult {
  target: string;
  hosts: ScanHost[];
  raw: unknown;
}

export interface Scan {
  id: string;
  target: string;
  resolvedIp?: string;
  scanType: ScanType;
  status: ScanStatus;
  provider: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  result?: ScanResult;
  error?: string;
}

/** An error carrying the server's stable error code. */
export class ApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

async function parseError(res: Response): Promise<never> {
  let code = 'error';
  let message = `Request failed (${res.status}).`;
  try {
    const body = await res.json();
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
    }
  } catch {
    /* non-JSON error body */
  }
  throw new ApiError(code, message);
}

export async function createScan(target: string, scanType: ScanType): Promise<Scan> {
  const res = await fetch('/api/scans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, scanType }),
  });
  if (!res.ok) return parseError(res);
  return res.json();
}

export async function listScans(): Promise<Scan[]> {
  const res = await fetch('/api/scans');
  if (!res.ok) return parseError(res);
  return res.json();
}

export async function getScan(id: string): Promise<Scan> {
  const res = await fetch(`/api/scans/${id}`);
  if (!res.ok) return parseError(res);
  return res.json();
}
