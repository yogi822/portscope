/**
 * AUTH-READY placeholder middleware.
 *
 * Milestone 4 ships no authentication (by requirement). This hook exists so a
 * later milestone can enforce auth in ONE place — e.g. validate a bearer token
 * or Supabase JWT and attach the user to the context — without restructuring
 * routes. Today it is a transparent pass-through.
 */
import type { MiddlewareHandler } from 'hono';

export const authReady: MiddlewareHandler = async (_c, next) => {
  // TODO(auth): verify credentials here and short-circuit with 401 when invalid.
  await next();
};
