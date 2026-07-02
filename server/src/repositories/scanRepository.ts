/**
 * Storage abstraction for scans. The service layer depends only on this
 * interface, so the in-memory store can be swapped for a SupabaseScanRepository
 * later by changing a single line at the composition root — no service changes.
 */
import type { Scan } from '../types.js';

export interface ScanRepository {
  create(scan: Scan): Promise<Scan>;
  /** Merge a partial patch into an existing scan; returns the updated record. */
  update(id: string, patch: Partial<Scan>): Promise<Scan>;
  findById(id: string): Promise<Scan | null>;
  /** Newest first, optionally limited. */
  list(limit?: number): Promise<Scan[]>;
}
