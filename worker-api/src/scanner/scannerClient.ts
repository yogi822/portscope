/**
 * HTTP client for the trusted Scanner Agent. Uses the global `fetch` (available
 * on Node 18+ and Cloudflare Workers), so the Worker never runs Nmap itself.
 */
import type { AgentScanResponse, ScanType } from '@portscope/shared';

export class ScannerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ScannerError';
  }
}

export interface Scanner {
  scan(target: string, scanType: ScanType): Promise<AgentScanResponse>;
}

export class ScannerClient implements Scanner {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async scan(target: string, scanType: ScanType): Promise<AgentScanResponse> {
    const controller = new AbortController();
    // Allow a little headroom over the agent's own scan timeout.
    const timer = setTimeout(() => controller.abort(), this.timeoutMs + 5_000);
    try {
      const res = await fetch(`${this.baseUrl}/scan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target, scanType }),
        signal: controller.signal,
      });
      if (!res.ok) {
        let code = 'scan_failed';
        let message = `Scanner agent returned ${res.status}.`;
        try {
          const body = (await res.json()) as { error?: { code?: string; message?: string } };
          if (body?.error) {
            code = body.error.code ?? code;
            message = body.error.message ?? message;
          }
        } catch {
          /* non-JSON error body */
        }
        throw new ScannerError(code, message);
      }
      return (await res.json()) as AgentScanResponse;
    } catch (err) {
      if (err instanceof ScannerError) throw err;
      // Network failure / abort / agent unreachable.
      throw new ScannerError('provider_unavailable', 'Could not reach the scanner agent.');
    } finally {
      clearTimeout(timer);
    }
  }
}
