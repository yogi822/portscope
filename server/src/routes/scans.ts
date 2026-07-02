/**
 * Thin HTTP layer for /api/scans. Responsibilities ONLY:
 *   - parse/validate the request (zod + validateTarget),
 *   - call ScanService,
 *   - map domain results/errors to HTTP status codes.
 * No business logic lives here.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { rateLimit } from '../utils/rateLimit.js';
import { validateTarget } from '../utils/validateTarget.js';
import { createScanBodySchema } from '../openapi.js';
import { ScanService, ScanServiceError } from '../services/scanService.js';

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

export function createScansRouter(service: ScanService): Router {
  const router = Router();

  // POST /api/scans — rate-limited (scans are expensive).
  router.post('/', rateLimit, async (req: Request, res: Response) => {
    const parsed = createScanBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json(errorBody('validation_error', parsed.error.issues[0]?.message ?? 'Invalid request.'));
      return;
    }

    // SECURITY: validate + gate the target before it reaches the provider.
    const check = validateTarget(parsed.data.target);
    if (!check.ok) {
      const status = check.code === 'private_range_blocked' ? 403 : 400;
      res.status(status).json(errorBody(check.code, check.message));
      return;
    }

    try {
      const scan = await service.createScan({
        target: check.target,
        scanType: parsed.data.scanType,
      });
      // A failed scan is still a validly-created resource; report its outcome
      // with 201 and let the client read `status`/`error`. Distinguish an
      // unavailable scanner as 503 for clearer client handling.
      if (scan.status === 'failed' && /not installed|not found/i.test(scan.error ?? '')) {
        res.status(503).json(errorBody('nmap_unavailable', scan.error!));
        return;
      }
      res.status(201).json(scan);
    } catch (err) {
      if (err instanceof ScanServiceError) {
        // Map domain error codes to HTTP status.
        const status = err.code === 'private_range_blocked' ? 403 : 400;
        res.status(status).json(errorBody(err.code, err.message));
        return;
      }
      throw err; // handled by the global error handler
    }
  });

  // GET /api/scans — history, newest first.
  router.get('/', async (_req: Request, res: Response) => {
    res.json(await service.listScans());
  });

  // GET /api/scans/:id — one scan (full record incl. result).
  router.get('/:id', async (req: Request, res: Response) => {
    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) {
      res.status(400).json(errorBody('validation_error', 'Invalid scan id.'));
      return;
    }
    try {
      res.json(await service.getScan(idCheck.data));
    } catch (err) {
      if (err instanceof ScanServiceError && err.code === 'not_found') {
        res.status(404).json(errorBody('not_found', err.message));
        return;
      }
      throw err;
    }
  });

  return router;
}
