/**
 * Scanner Agent configuration. The Agent is a trusted internal Node service —
 * it is the ONLY component allowed to run Nmap.
 */
function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  // The Agent listens on its own port (default 3002), distinct from the Worker.
  port: num(process.env.PORT, 3002),

  // SECURITY: when false (default), private/internal ranges are blocked here too
  // (defence in depth — the Agent re-gates after DNS resolution).
  localScanEnabled: process.env.LOCAL_SCAN_ENABLED === 'true',

  scanTimeoutMs: num(process.env.SCAN_TIMEOUT_MS, 60_000),
  nmapBin: process.env.NMAP_BIN || 'nmap',
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;
