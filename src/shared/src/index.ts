import { z } from 'zod';

// Browser-safe HTTP contracts only. Never export server code or environment values.
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('specsentry'),
}).strict();

export const readinessResponseSchema = z.object({ status: z.literal('ready') }).strict();
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
