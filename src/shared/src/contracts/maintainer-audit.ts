import { z } from 'zod';
import { REVIEWER_LIMITS, reviewerCursorSchema, reviewerIdSchema as id,
  reviewerTimestampSchema as timestamp } from './reviewer';

const queryInteger = z.preprocess(
  value => typeof value === 'string' && /^[1-9][0-9]*$/.test(value) ? Number(value) : value,
  z.number().int().min(1).max(REVIEWER_LIMITS.pageMax),
);
const token = z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);

export const maintainerAuditQuerySchema = z.object({
  actorId: id.optional(),
  proposalId: id.optional(),
  releaseId: id.optional(),
  action: token.optional(),
  outcome: token.transform(value => value.toUpperCase()).optional(),
  from: timestamp.optional(),
  to: timestamp.optional(),
  limit: queryInteger.default(REVIEWER_LIMITS.pageDefault),
  cursor: reviewerCursorSchema.optional(),
}).strict().refine(value => value.from === undefined || value.to === undefined ||
  new Date(value.from).getTime() <= new Date(value.to).getTime(), {
  path: ['from'], message: 'Start time must not be after end time',
});

const safeText = z.string().max(2_000);
export const maintainerAuditItemSchema = z.object({
  id,
  source: z.enum(['BUSINESS', 'SECURITY', 'AI', 'ANNOTATION']),
  actorId: id.nullable(),
  proposalId: id.nullable(),
  releaseId: id.nullable(),
  target: id.nullable(),
  action: token,
  outcome: token,
  timestamp,
  summary: safeText.nullable(),
  reason: safeText.nullable(),
  aiMetadata: z.object({
    templateVersion: z.string().min(1).max(80),
    contextHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    errorClass: token.nullable(),
    latencyMs: z.number().int().nonnegative().nullable(),
    attemptCount: z.number().int().min(0).max(2),
  }).strict().nullable(),
}).strict();

export const maintainerAuditResponseSchema = z.object({
  items: z.array(maintainerAuditItemSchema).max(REVIEWER_LIMITS.pageMax),
  nextCursor: reviewerCursorSchema.nullable(),
}).strict();

export type MaintainerAuditQuery = z.infer<typeof maintainerAuditQuerySchema>;
export type MaintainerAuditResponse = z.infer<typeof maintainerAuditResponseSchema>;
