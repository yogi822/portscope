/**
 * Worker API configuration.
 *
 * Reads from process.env for local Node dev. On Cloudflare Workers the same
 * values arrive as bindings via `c.env`; when we migrate, swap this module for
 * one that reads the Workers env object — nothing else needs to change.
 */
function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 3001),

  // URL of the trusted Scanner Agent the Worker calls over HTTP.
  scannerAgentUrl: process.env.SCANNER_AGENT_URL || 'http://localhost:3002',

  // SECURITY: gate private/internal targets unless explicitly enabled.
  localScanEnabled: process.env.LOCAL_SCAN_ENABLED === 'true',

  // Upper bound for the HTTP call to the agent (agent enforces its own scan timeout).
  scanTimeoutMs: num(process.env.SCAN_TIMEOUT_MS, 60_000),

  rateLimitMax: num(process.env.RATE_LIMIT_MAX, 5),
  rateLimitWindowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 5 * 60_000),
  historyLimit: num(process.env.HISTORY_LIMIT, 50),
} as const;
