/**
 * Composition root: build dependencies, wire the Express app, start listening.
 *
 * This is the ONLY file that knows the concrete implementations. Swapping
 * storage (Supabase) or adding scan providers (Masscan/RustScan) happens here —
 * the service/route layers are unaffected.
 */
import express from 'express';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';
import { logger } from './logger.js';
import { InMemoryScanRepository } from './repositories/inMemoryScanRepository.js';
import { ProviderRegistry } from './providers/scanProvider.js';
import { NmapScanProvider } from './providers/nmapScanProvider.js';
import { ScanService } from './services/scanService.js';
import { createScansRouter } from './routes/scans.js';
import { buildOpenApiDocument } from './openapi.js';

// --- Dependency wiring (swap these lines to change storage/providers) ---
const repository = new InMemoryScanRepository(config.historyLimit);
const registry = new ProviderRegistry();
registry.register(new NmapScanProvider());
const scanService = new ScanService(repository, registry, 'nmap');

const app = express();
// We're behind at most one local proxy (Vite); trust it for correct req.ip.
app.set('trust proxy', 1);
app.use(express.json({ limit: '16kb' })); // small body cap; requests are tiny
app.use(pinoHttp({ logger })); // structured request logging (no console.log)

// Health check.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', localScanEnabled: config.localScanEnabled });
});

// REST API.
app.use('/api/scans', createScansRouter(scanService));

// OpenAPI / Swagger UI.
const openApiDoc = buildOpenApiDocument();
app.get('/api/docs.json', (_req, res) => res.json(openApiDoc));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc));

// Global error handler — logs details, returns a safe generic message.
app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'unhandled error');
    res.status(500).json({ error: { code: 'internal', message: 'Internal server error.' } });
  },
);

app.listen(config.port, () => {
  logger.info(
    { port: config.port, localScanEnabled: config.localScanEnabled },
    `PortScope API listening on http://localhost:${config.port} (docs at /api/docs)`,
  );
});
