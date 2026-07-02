/**
 * OpenAPI 3 document generated from zod schemas (single source of truth for
 * request/response shapes). Served as Swagger UI at /api/docs and JSON at
 * /api/docs.json.
 */
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// ---- Request / response schemas (reused by routes for validation) ----

export const scanTypeSchema = z.enum(['quick', 'service']).openapi('ScanType', {
  description: 'Quick Scan (top 100 ports) or Service Detection (top 50 + -sV).',
});

export const createScanBodySchema = z
  .object({
    target: z.string().min(1).max(253).openapi({ example: 'scanme.nmap.org' }),
    scanType: scanTypeSchema,
  })
  .openapi('CreateScanRequest');

const scanPortSchema = z
  .object({
    portId: z.number(),
    protocol: z.string(),
    state: z.string(),
    service: z.string().optional(),
    product: z.string().optional(),
    version: z.string().optional(),
    extraInfo: z.string().optional(),
  })
  .openapi('ScanPort');

const scanHostSchema = z
  .object({
    address: z.string(),
    hostnames: z.array(z.string()),
    status: z.string(),
    ports: z.array(scanPortSchema),
  })
  .openapi('ScanHost');

const scanResultSchema = z
  .object({
    target: z.string(),
    hosts: z.array(scanHostSchema),
    raw: z.unknown(),
  })
  .openapi('ScanResult');

export const scanSchema = z
  .object({
    id: z.string().uuid(),
    target: z.string(),
    resolvedIp: z.string().optional(),
    scanType: scanTypeSchema,
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    provider: z.string(),
    createdAt: z.string(),
    startedAt: z.string().optional(),
    finishedAt: z.string().optional(),
    durationMs: z.number().optional(),
    result: scanResultSchema.optional(),
    error: z.string().optional(),
  })
  .openapi('Scan');

const errorSchema = z
  .object({
    error: z.object({ code: z.string(), message: z.string() }),
  })
  .openapi('ErrorResponse');

// ---- Path registrations ----

registry.registerPath({
  method: 'post',
  path: '/api/scans',
  summary: 'Create and run a scan',
  request: {
    body: { content: { 'application/json': { schema: createScanBodySchema } } },
  },
  responses: {
    201: { description: 'Scan created and completed', content: { 'application/json': { schema: scanSchema } } },
    400: { description: 'Invalid target', content: { 'application/json': { schema: errorSchema } } },
    403: { description: 'Private range blocked', content: { 'application/json': { schema: errorSchema } } },
    429: { description: 'Rate limited', content: { 'application/json': { schema: errorSchema } } },
    503: { description: 'Scanner unavailable', content: { 'application/json': { schema: errorSchema } } },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/scans',
  summary: 'List scan history (newest first)',
  responses: {
    200: { description: 'Scan history', content: { 'application/json': { schema: z.array(scanSchema) } } },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/scans/{id}',
  summary: 'Get a single scan by id',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'The scan', content: { 'application/json': { schema: scanSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: errorSchema } } },
  },
});

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'PortScope API',
      version: '0.1.0',
      description:
        'Local, authorized-use Nmap scanning API. Only scan systems you own or are authorized to test.',
    },
    servers: [{ url: 'http://localhost:3001' }],
  });
}
