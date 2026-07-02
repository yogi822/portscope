/**
 * Shared zod schemas for API request/response validation. Pure and portable.
 */
import { z } from 'zod';

export const scanTypeSchema = z.enum(['quick', 'service']);

export const createScanBodySchema = z.object({
  target: z.string().min(1).max(253),
  scanType: scanTypeSchema,
});

export type CreateScanBody = z.infer<typeof createScanBodySchema>;

/** Schema for the Scanner Agent's POST /scan request body. */
export const agentScanRequestSchema = z.object({
  target: z.string().min(1).max(253),
  scanType: scanTypeSchema,
});
