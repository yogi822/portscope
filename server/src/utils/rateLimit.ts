/**
 * SECURITY: basic in-memory sliding-window rate limiter, keyed by client IP.
 * Scans are expensive (up to the scan timeout each), so the default is
 * intentionally conservative (5 scans / 5 minutes). This is process-local; a
 * future multi-instance deployment would move this to a shared store.
 */
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { logger } from '../logger.js';

const hits = new Map<string, number[]>();

function clientKey(req: Request): string {
  // Express `req.ip` respects trust proxy settings; fall back defensively.
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const windowStart = now - config.rateLimitWindowMs;
  const key = clientKey(req);

  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= config.rateLimitMax) {
    const retryAfterMs = recent[0] + config.rateLimitWindowMs - now;
    const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    logger.warn({ key, count: recent.length }, 'rate limit exceeded');
    res.status(429).json({
      error: {
        code: 'rate_limited',
        message: `Too many scans. Try again in ${retryAfter}s.`,
      },
    });
    return;
  }

  recent.push(now);
  hits.set(key, recent);
  next();
}
