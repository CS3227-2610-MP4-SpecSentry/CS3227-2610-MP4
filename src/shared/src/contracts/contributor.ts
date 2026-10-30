import { z } from 'zod';
import { reviewerIdSchema, reviewerTimestampSchema, reviewerVersionSchema } from './reviewer';

const pageSize = z.preprocess(value => typeof value === 'string' && /^[1-9][0-9]*$/.test(value) ? Number(value) : value,
  z.number().int().min(1).max(100));
export const ownDraftsQuerySchema = z.object({ limit: pageSize.default(20), cursor: z.string().min(1).max(2048).optional() }).strict();
export const ownDraftsResponseSchema = z.object({
  items: z.array(z.object({ proposalId: reviewerIdSchema, workingRevisionId: reviewerIdSchema,
    title: z.string(), state: z.literal('DRAFT'), version: reviewerVersionSchema, createdAt: reviewerTimestampSchema }).strict()).max(100),
  nextCursor: z.string().nullable(),
}).strict();
export type OwnDraftsQuery = z.infer<typeof ownDraftsQuerySchema>;
export type OwnDraftsResponse = z.infer<typeof ownDraftsResponseSchema>;
