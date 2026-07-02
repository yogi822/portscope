/**
 * Central configuration, parsed once from the environment.
 * Keeping env access in one place makes the service layer framework-agnostic
 * (important for a future Cloudflare Workers port, where `process.env` differs).
 */

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 3001),

  // SECURITY: when false (default), private/internal ranges are blocked.
  // Only set true for authorized local-network testing.
  localScanEnabled: process.env.LOCAL_SCAN_ENABLED === 'true',

  // SECURITY: hard upper bound on how long any scan may run.
  scanTimeoutMs: num(process.env.SCAN_TIMEOUT_MS, 60_000),

  // SECURITY: basic abuse protection.
  rateLimitMax: num(process.env.RATE_LIMIT_MAX, 5),
  rateLimitWindowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 5 * 60_000),

  // Nmap binary (path or name resolved via PATH).
  nmapBin: process.env.NMAP_BIN || 'nmap',

  // How many scans to retain in the in-memory history.
  historyLimit: num(process.env.HISTORY_LIMIT, 50),

  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;
