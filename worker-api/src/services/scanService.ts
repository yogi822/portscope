/**
 * ScanService — orchestration (no Nmap here). Framework-agnostic and portable:
 * uses global crypto.randomUUID and the injected repository + scanner client.
 *
 * Owns the scan lifecycle: pending → running → completed | failed. v1 runs
 * synchronously; the shape is already async-job ready.
 */
import type { Scan, ScanType } from '@portscope/shared';
import type { ScanRepository } from '../repositories/scanRepository.js';
import { ScannerError, type Scanner } from '../scanner/scannerClient.js';
import { logger } from '../logger.js';

export interface CreateScanInput {
  target: string; // already syntactically validated by the caller
  scanType: ScanType;
}

/** Result of createScan: the persisted scan, plus an errorCode for HTTP mapping. */
export interface CreateScanOutcome {
  scan: Scan;
  errorCode?: string;
}

export class ScanService {
  constructor(
    private readonly repo: ScanRepository,
    private readonly scanner: Scanner,
    private readonly historyLimit = 50,
  ) {}

  async createScan(input: CreateScanInput): Promise<CreateScanOutcome> {
    const now = new Date().toISOString();
    const scan: Scan = {
      id: crypto.randomUUID(), // Web Crypto — available on Node 20+ and Workers
      target: input.target,
      scanType: input.scanType,
      status: 'pending',
      provider: 'nmap',
      createdAt: now,
    };
    await this.repo.create(scan);
    logger.info('scan created', { id: scan.id, target: scan.target, scanType: scan.scanType });

    const startMs = Date.now();
    await this.repo.update(scan.id, { status: 'running', startedAt: new Date().toISOString() });

    try {
      const resp = await this.scanner.scan(input.target, input.scanType);
      const updated = await this.repo.update(scan.id, {
        status: 'completed',
        resolvedIp: resp.resolvedIp,
        provider: resp.provider,
        result: resp.result,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
      });
      logger.info('scan completed', { id: scan.id, durationMs: updated.durationMs });
      return { scan: updated };
    } catch (err) {
      const errorCode = err instanceof ScannerError ? err.code : 'scan_failed';
      const message = err instanceof Error ? err.message : 'The scan failed unexpectedly.';
      const updated = await this.repo.update(scan.id, {
        status: 'failed',
        error: message,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
      });
      logger.warn('scan failed', { id: scan.id, errorCode, error: message });
      return { scan: updated, errorCode };
    }
  }

  listScans(): Promise<Scan[]> {
    return this.repo.list(this.historyLimit);
  }

  getScan(id: string): Promise<Scan | null> {
    return this.repo.findById(id);
  }
}
