/**
 * ScanProvider abstraction. Nmap is only ONE implementation — new engines
 * (Masscan, RustScan, custom scanners) can be added by implementing this
 * interface and registering it, with no changes to the API or ScanService.
 */
import type { ScanResult, ScanType } from '../types.js';

export interface ScanRunOptions {
  timeoutMs: number;
}

/** Thrown by providers with a stable, client-safe error code. */
export class ScanProviderError extends Error {
  constructor(
    public readonly code:
      | 'scan_failed'
      | 'scan_timeout'
      | 'provider_unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'ScanProviderError';
  }
}

export interface ScanProvider {
  /** Unique provider name, e.g. 'nmap'. */
  readonly name: string;
  /** Scan types this provider can service. */
  readonly supportedTypes: readonly ScanType[];
  /** Run a scan against an already-validated target. */
  run(target: string, scanType: ScanType, opts: ScanRunOptions): Promise<ScanResult>;
}

/** Simple name → provider registry. */
export class ProviderRegistry {
  private readonly providers = new Map<string, ScanProvider>();

  register(provider: ScanProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): ScanProvider | undefined {
    return this.providers.get(name);
  }

  list(): ScanProvider[] {
    return [...this.providers.values()];
  }
}
