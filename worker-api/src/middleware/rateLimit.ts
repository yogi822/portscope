/**
 * SECURITY: in-memory sliding-window rate limiter as Hono middleware.
 * Process-local (fine for local dev / a single node). On multi-isolate Workers
 * this would move to a shared store (KV/Durable Object) — same interface.
 */
import type { MiddlewareHandler } from 'hono';

export function rateLimit(opts: { max: number; windowMs: number }): MiddlewareHandler {
  const hits = new Map<string, number[]>();

  return async (c, next) => {
    const key =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      'local';

    const now = Date.now();
    const windowStart = now - opts.windowMs;
    const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

    if (recent.length >= opts.max) {
      const retryAfter = Math.max(1, Math.ceil((recent[0] + opts.windowMs - now) / 1000));
      c.header('Retry-After', String(retryAfter));
      return c.json(
        { error: { code: 'rate_limited', message: `Too many scans. Try again in ${retryAfter}s.` } },
        429,
      );
    }

    recent.push(now);
    hits.set(key, recent);
    await next();
  };
}
