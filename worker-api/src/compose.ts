/**
 * Composition root: build dependencies from config and assemble the Hono app.
 * Shared by both entrypoints (Node local + Cloudflare Workers) so wiring lives
 * in exactly one place.
 */
import { config } from './config.js';
import { createApp } from './app.js';
import { ScanService } from './services/scanService.js';
import { InMemoryScanRepository } from './repositories/inMemoryScanRepository.js';
import { ScannerClient } from './scanner/scannerClient.js';

export function composeApp() {
  const repository = new InMemoryScanRepository(config.historyLimit);
  const scanner = new ScannerClient(config.scannerAgentUrl, config.scanTimeoutMs);
  const service = new ScanService(repository, scanner, config.historyLimit);

  return createApp(service, {
    localScanEnabled: config.localScanEnabled,
    rateLimit: { max: config.rateLimitMax, windowMs: config.rateLimitWindowMs },
  });
}
