/**
 * LOCAL entrypoint. Serves the Hono app on Node via @hono/node-server.
 * This is what `npm run dev` runs today.
 */
import { serve } from '@hono/node-server';
import { composeApp } from './compose.js';
import { config } from './config.js';
import { logger } from './logger.js';

const app = composeApp();

serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info('Worker API listening', {
    url: `http://localhost:${info.port}`,
    scannerAgentUrl: config.scannerAgentUrl,
    localScanEnabled: config.localScanEnabled,
  });
});
