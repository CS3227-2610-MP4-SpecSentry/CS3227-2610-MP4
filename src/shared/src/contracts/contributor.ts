import { z } from 'zod';
import { normalizeReviewerText, proposalStateSchema, reviewerAuthorSchema, reviewerCodePointLength,
  reviewerIdSchema, reviewerTimestampSchema, reviewerVersionSchema } from './reviewer';

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
export const deleteDraftRequestSchema = z.object({ expectedVersion: reviewerVersionSchema, confirmed: z.literal(true) }).strict();
export type DeleteDraftRequest = z.infer<typeof deleteDraftRequestSchema>;

export const ownProposalsQuerySchema = ownDraftsQuerySchema;
export const ownProposalsResponseSchema = z.object({
  items: z.array(z.object({ proposalId: reviewerIdSchema, workingRevisionId: reviewerIdSchema.nullable(),
    title: z.string(), state: proposalStateSchema, version: reviewerVersionSchema, createdAt: reviewerTimestampSchema,
    latestRevision: z.object({ id: reviewerIdSchema, number: reviewerVersionSchema, submittedAt: reviewerTimestampSchema }).strict().nullable(),
  }).strict()).max(100), nextCursor: z.string().nullable(),
}).strict();
export const cloneLatestRequestSchema = z.object({ expectedVersion: reviewerVersionSchema,
  revisionId: reviewerIdSchema, confirmed: z.literal(true) }).strict();
const responseText = z.string().transform(normalizeReviewerText)
  .refine(value => value.trim().length > 0 && reviewerCodePointLength(value) <= 2000, 'Enter 1–2,000 characters');
export const findingResponseRequestSchema = z.object({ expectedVersion: reviewerVersionSchema,
  revisionId: reviewerIdSchema, text: responseText }).strict();
export const findingResponseRecordSchema = z.object({ id: reviewerIdSchema, proposalId: reviewerIdSchema,
  findingId: reviewerIdSchema, revisionId: reviewerIdSchema, actor: reviewerAuthorSchema,
  text: responseText, mutationVersion: reviewerVersionSchema, createdAt: reviewerTimestampSchema }).strict();
export const findingResponsesResponseSchema = z.object({ items: z.array(findingResponseRecordSchema).max(100),
  nextCursor: z.string().nullable() }).strict();
export const findingResponseCommandResponseSchema = z.object({ proposalId: reviewerIdSchema, version: reviewerVersionSchema,
  response: findingResponseRecordSchema }).strict();
export type OwnProposalsQuery = z.infer<typeof ownProposalsQuerySchema>;
export type OwnProposalsResponse = z.infer<typeof ownProposalsResponseSchema>;
export type CloneLatestRequest = z.infer<typeof cloneLatestRequestSchema>;
export type FindingResponseRequest = z.infer<typeof findingResponseRequestSchema>;
