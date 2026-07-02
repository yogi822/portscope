/**
 * Scanner Agent — trusted internal service. Exposes a single scan endpoint the
 * Worker API calls over HTTP. This service (NOT the Worker) runs Nmap.
 *
 * Not intended to be internet-facing: bind it on an internal network/host only.
 */
import express from 'express';
import { pinoHttp } from 'pino-http';
import { agentScanRequestSchema, type AgentScanResponse } from '@portscope/shared';
import { config } from './config.js';
import { logger } from './logger.js';
import { resolveAndGate } from './resolveTarget.js';
import { runNmap, NmapError } from './nmap.js';

const app = express();
app.use(express.json({ limit: '16kb' }));
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'scanner-agent', localScanEnabled: config.localScanEnabled });
});

// POST /scan — validate, resolve+gate, run Nmap, return the parsed result.
app.post('/scan', async (req, res) => {
  const parsed = agentScanRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'validation_error', message: 'Invalid scan request.' } });
    return;
  }
  const { target, scanType } = parsed.data;

  // SECURITY: resolve-first gating happens here, in the trusted service.
  const gate = await resolveAndGate(target);
  if (!gate.ok) {
    const status = gate.code === 'private_range_blocked' ? 403 : 400;
    res.status(status).json({ error: { code: gate.code, message: gate.message } });
    return;
  }

  try {
    const result = await runNmap(gate.scanTarget, scanType);
    const body: AgentScanResponse = {
      resolvedIp: gate.scanTarget,
      provider: 'nmap',
      result,
    };
    res.json(body);
  } catch (err) {
    if (err instanceof NmapError) {
      const status = err.code === 'provider_unavailable' ? 503 : 500;
      res.status(status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    logger.error({ err }, 'unexpected scan error');
    res.status(500).json({ error: { code: 'scan_failed', message: 'The scan failed unexpectedly.' } });
  }
});

app.listen(config.port, () => {
  logger.info(
    { port: config.port, localScanEnabled: config.localScanEnabled },
    `Scanner Agent listening on http://localhost:${config.port}`,
  );
});
