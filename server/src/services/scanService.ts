/**
 * ScanService — all scan business logic lives here, free of any Express/HTTP
 * concepts (so it is portable to Cloudflare Workers or a queue worker later).
 *
 * Dependencies (provider registry + repository) are injected, so storage and
 * scan engines are swappable without touching this class.
 *
 * The status lifecycle (pending → running → completed|failed) is modelled here.
 * v1 runs synchronously, but the shape is already async-job ready: to go async,
 * return the `pending` scan immediately and let a worker drive the transitions.
 */
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { Scan, ScanType } from '../types.js';
import type { ScanRepository } from '../repositories/scanRepository.js';
import {
  type ScanProvider,
  ProviderRegistry,
  ScanProviderError,
} from '../providers/scanProvider.js';
import { resolveAndGate, type AddressLookup } from '../utils/resolveTarget.js';

/** A typed error the HTTP layer maps to a status code. */
export class ScanServiceError extends Error {
  constructor(
    public readonly code:
      | 'invalid_target'
      | 'private_range_blocked'
      | 'resolution_failed'
      | 'unsupported_scan_type'
      | 'not_found',
    message: string,
  ) {
    super(message);
    this.name = 'ScanServiceError';
  }
}

export interface CreateScanInput {
  target: string; // already validated by the caller/route
  scanType: ScanType;
  providerName?: string; // defaults to 'nmap'
}

export class ScanService {
  constructor(
    private readonly repo: ScanRepository,
    private readonly registry: ProviderRegistry,
    private readonly defaultProvider = 'nmap',
    // Injectable so tests can supply a fake DNS resolver; undefined → real DNS.
    private readonly lookupFn?: AddressLookup,
  ) {}

  private resolveProvider(name: string, scanType: ScanType): ScanProvider {
    const provider = this.registry.get(name);
    if (!provider) {
      throw new ScanServiceError('unsupported_scan_type', `Unknown provider: ${name}`);
    }
    if (!provider.supportedTypes.includes(scanType)) {
      throw new ScanServiceError(
        'unsupported_scan_type',
        `Provider '${name}' does not support scan type '${scanType}'.`,
      );
    }
    return provider;
  }

  /**
   * Create and run a scan. In v1 this awaits completion before returning; the
   * persisted record still passes through pending → running → completed/failed.
   */
  async createScan(input: CreateScanInput): Promise<Scan> {
    const providerName = input.providerName ?? this.defaultProvider;
    const provider = this.resolveProvider(providerName, input.scanType);

    // SECURITY: resolve the target to IP(s) and gate them BEFORE creating a
    // scan record or launching a scan. Domains are pinned to the vetted IP.
    const resolved = await resolveAndGate(input.target, this.lookupFn);
    if (!resolved.ok) {
      throw new ScanServiceError(resolved.code, resolved.message);
    }
    const scanTarget = resolved.scanTarget; // pinned IP for domains

    const now = new Date().toISOString();
    const scan: Scan = {
      id: randomUUID(), // UUID v4 ids (not incremental)
      target: input.target,
      resolvedIp: scanTarget,
      scanType: input.scanType,
      status: 'pending',
      provider: providerName,
      createdAt: now,
    };
    await this.repo.create(scan);
    logger.info(
      { id: scan.id, target: scan.target, resolvedIp: scanTarget, scanType: scan.scanType },
      'scan created',
    );

    // Transition: running
    const startedAt = new Date().toISOString();
    await this.repo.update(scan.id, { status: 'running', startedAt });
    const startMs = Date.now();

    try {
      const result = await provider.run(scanTarget, input.scanType, {
        timeoutMs: config.scanTimeoutMs,
      });
      const finishedAt = new Date().toISOString();
      const updated = await this.repo.update(scan.id, {
        status: 'completed',
        result,
        finishedAt,
        durationMs: Date.now() - startMs,
      });
      logger.info({ id: scan.id, durationMs: updated.durationMs }, 'scan completed');
      return updated;
    } catch (err) {
      const message =
        err instanceof ScanProviderError ? err.message : 'The scan failed unexpectedly.';
      const updated = await this.repo.update(scan.id, {
        status: 'failed',
        error: message,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
      });
      logger.warn({ id: scan.id, err: message }, 'scan failed');
      return updated;
    }
  }

  async listScans(limit = config.historyLimit): Promise<Scan[]> {
    return this.repo.list(limit);
  }

  async getScan(id: string): Promise<Scan> {
    const scan = await this.repo.findById(id);
    if (!scan) {
      throw new ScanServiceError('not_found', `Scan not found: ${id}`);
    }
    return scan;
  }
}
