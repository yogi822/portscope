/**
 * Hono application (public API). The SAME app runs locally on Node
 * (@hono/node-server) and on Cloudflare Workers later — no framework rewrite.
 *
 * Responsibilities: validation, auth hook, rate limiting, and scan
 * orchestration. It NEVER runs Nmap — that is delegated to the Scanner Agent
 * via the injected ScanService.
 */
import { Hono } from 'hono';
import { createScanBodySchema, validateTarget } from '@portscope/shared';
import type { ScanService } from './services/scanService.js';
import { rateLimit } from './middleware/rateLimit.js';
import { authReady } from './middleware/auth.js';

export interface AppOptions {
  localScanEnabled: boolean;
  rateLimit: { max: number; windowMs: number };
}

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

// Agent error code → HTTP status for the POST /api/scans response.
const ERROR_STATUS: Record<string, number> = {
  private_range_blocked: 403,
  resolution_failed: 400,
  validation_error: 400,
  provider_unavailable: 503,
};

export function createApp(service: ScanService, opts: AppOptions): Hono {
  const app = new Hono();
  const limiter = rateLimit(opts.rateLimit);

  // Auth-ready hook across the API surface (currently pass-through).
  app.use('/api/*', authReady);

  app.get('/api/health', (c) =>
    c.json({ status: 'ok', service: 'worker-api', localScanEnabled: opts.localScanEnabled }),
  );

  // POST /api/scans — validate, then orchestrate via the Scanner Agent.
  app.post('/api/scans', limiter, async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(errorBody('validation_error', 'Invalid JSON body.'), 400);
    }

    const parsed = createScanBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        errorBody('validation_error', parsed.error.issues[0]?.message ?? 'Invalid request.'),
        400,
      );
    }

    // SECURITY: syntactic validation + IP-literal gate at the public boundary.
    const check = validateTarget(parsed.data.target, { allowPrivate: opts.localScanEnabled });
    if (!check.ok) {
      return c.json(errorBody(check.code, check.message), check.code === 'private_range_blocked' ? 403 : 400);
    }

    const { scan, errorCode } = await service.createScan({
      target: check.target,
      scanType: parsed.data.scanType,
    });

    if (errorCode) {
      const status = ERROR_STATUS[errorCode];
      if (status) {
        const code = errorCode === 'provider_unavailable' ? 'scanner_unavailable' : errorCode;
        return c.json(errorBody(code, scan.error ?? 'Scan failed.'), status as never);
      }
      // scan_failed / scan_timeout: a real (failed) scan resource was created.
    }

    return c.json(scan, 201);
  });

  // GET /api/scans — history, newest first.
  app.get('/api/scans', async (c) => c.json(await service.listScans()));

  // GET /api/scans/:id — one scan.
  app.get('/api/scans/:id', async (c) => {
    const scan = await service.getScan(c.req.param('id'));
    if (!scan) return c.json(errorBody('not_found', 'Scan not found.'), 404);
    return c.json(scan);
  });

  return app;
}
