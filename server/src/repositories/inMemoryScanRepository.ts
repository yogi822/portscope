/**
 * In-memory ScanRepository. Bounded (keeps the most recent N scans) so history
 * cannot grow without limit. Async signatures mirror a real DB so swapping in
 * SupabaseScanRepository requires no service changes.
 */
import type { Scan } from '../types.js';
import type { ScanRepository } from './scanRepository.js';

export class InMemoryScanRepository implements ScanRepository {
  private readonly scans = new Map<string, Scan>();

  constructor(private readonly limit = 50) {}

  async create(scan: Scan): Promise<Scan> {
    this.scans.set(scan.id, scan);
    this.evict();
    return scan;
  }

  async update(id: string, patch: Partial<Scan>): Promise<Scan> {
    const existing = this.scans.get(id);
    if (!existing) throw new Error(`Scan not found: ${id}`);
    const updated = { ...existing, ...patch };
    this.scans.set(id, updated);
    return updated;
  }

  async findById(id: string): Promise<Scan | null> {
    return this.scans.get(id) ?? null;
  }

  async list(limit?: number): Promise<Scan[]> {
    const all = [...this.scans.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return limit ? all.slice(0, limit) : all;
  }

  /** Drop oldest records beyond the retention limit. */
  private evict(): void {
    if (this.scans.size <= this.limit) return;
    const ordered = [...this.scans.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    for (const scan of ordered.slice(0, this.scans.size - this.limit)) {
      this.scans.delete(scan.id);
    }
  }
}
