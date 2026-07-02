/**
 * Storage abstraction. In-memory today; a future Supabase implementation swaps
 * in at the composition root with no service changes.
 */
import type { Scan } from '@portscope/shared';

export interface ScanRepository {
  create(scan: Scan): Promise<Scan>;
  update(id: string, patch: Partial<Scan>): Promise<Scan>;
  findById(id: string): Promise<Scan | null>;
  list(limit?: number): Promise<Scan[]>;
}
