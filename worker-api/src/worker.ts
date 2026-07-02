/**
 * CLOUDFLARE WORKERS entrypoint (prepared, not deployed yet).
 *
 * A Hono app is itself a Workers fetch handler, so exporting it as default is
 * all the runtime needs. Deploying later requires only a `wrangler.toml` and
 * moving config to read from the Workers `env` bindings — the app, routes,
 * services, and scanner client are unchanged.
 */
import { composeApp } from './compose.js';

const app = composeApp();

export default app;
