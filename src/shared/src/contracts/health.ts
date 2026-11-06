import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('specsentry'),
  deployment: z.object({
    sourceRevision: z.union([z.literal('local'), z.string().regex(/^[0-9a-f]{40}$/)]),
  }).strict(),
}).strict();

export const readinessResponseSchema = z.object({ status: z.literal('ready') }).strict();
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
