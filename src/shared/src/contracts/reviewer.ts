import { z } from 'zod';

export const REVIEWER_LIMITS = {
  id: 128,
  version: 2_147_483_647,
  cursor: 2_048,
  decodedCursorBytes: 1_536,
  pageDefault: 20,
  pageMax: 100,
  activityPage: 50,
  ageDays: 365_000,
  title: 200,
  summary: 500,
  criterion: 2_000,
  narrative: 10_000,
  diff: 100_000,
  evidence: 50_000,
  criteria: 50,
} as const;

// Opaque IDs are preserved exactly. Shape never establishes authorization.
export const reviewerIdSchema = z.string().min(1).max(REVIEWER_LIMITS.id).regex(/^[\x20-\x7e]+$/);
export const reviewerVersionSchema = z.number().int().min(0).max(REVIEWER_LIMITS.version);
export const reviewerCursorSchema = z.string().min(1).max(REVIEWER_LIMITS.cursor)
  .refine((value) => Array.from(value).every((character) => character.charCodeAt(0) <= 0x7f), 'Cursor must contain only ASCII');
export const reviewerTimestampSchema = z.iso.datetime({ offset: true });
export const proposalStateSchema = z.enum(['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'IN_RELEASE', 'RELEASED', 'WITHDRAWN']);
export const assignedReviewStateSchema = z.enum(['IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'IN_RELEASE', 'RELEASED']);
export const proposalActivityActionSchema = z.enum(['SUBMITTED', 'RESUBMITTED', 'CLAIMED', 'DROPPED', 'ASSIGNMENT_RELEASED']);

export const normalizeReviewerText = (value: string): string => value.replace(/\r\n?/g, '\n');
export const reviewerCodePointLength = (value: string): number => Array.from(normalizeReviewerText(value)).length;
const text = (max: number, nonempty = false) => z.string()
  .transform(normalizeReviewerText)
  .refine((value) => reviewerCodePointLength(value) <= max, `Must contain at most ${max} Unicode code points`)
  .refine((value) => !nonempty || value.trim().length > 0, 'Must not be empty');

export const reviewerTitleSchema = text(REVIEWER_LIMITS.title, true);
export const reviewerSummarySchema = text(REVIEWER_LIMITS.summary, true);
export const reviewerNarrativeSchema = text(REVIEWER_LIMITS.narrative, true);
export const reviewerDiffSchema = text(REVIEWER_LIMITS.diff);
export const reviewerAuthorSchema = z.object({ id: reviewerIdSchema, username: z.string().min(1).max(80) }).strict();

// HTTP query numbers accept only decimal integers, never exponent/float/blank coercion.
const queryInteger = (max: number, min = 0) => z.preprocess(
  (value) => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) ? Number(value) : value,
  z.number().int().min(min).max(max),
);
const pageQuery = {
  limit: queryInteger(REVIEWER_LIMITS.pageMax, 1).default(REVIEWER_LIMITS.pageDefault),
  cursor: reviewerCursorSchema.optional(),
};
const ageQuery = {
  authorId: reviewerIdSchema.optional(),
  minAgeDays: queryInteger(REVIEWER_LIMITS.ageDays).optional(),
  maxAgeDays: queryInteger(REVIEWER_LIMITS.ageDays).optional(),
};
const validAgeRange = (value: { minAgeDays?: number; maxAgeDays?: number }): boolean =>
  value.minAgeDays === undefined || value.maxAgeDays === undefined || value.minAgeDays <= value.maxAgeDays;

export const reviewPoolQuerySchema = z.object({ ...ageQuery, ...pageQuery }).strict()
  .refine(validAgeRange, { message: 'Minimum age must not exceed maximum age', path: ['minAgeDays'] });
export const assignedReviewsQuerySchema = z.object({ ...ageQuery, ...pageQuery, state: assignedReviewStateSchema.optional() }).strict()
  .refine(validAgeRange, { message: 'Minimum age must not exceed maximum age', path: ['minAgeDays'] });
export const proposalDetailQuerySchema = z.object({ revisionId: reviewerIdSchema.optional() }).strict();
export const submittedRevisionsQuerySchema = z.object(pageQuery).strict();
export const proposalActivityQuerySchema = z.object({ cursor: reviewerCursorSchema.optional() }).strict();
export const claimProposalRequestSchema = z.object({ expectedVersion: reviewerVersionSchema }).strict();
export const dropProposalRequestSchema = z.object({
  expectedVersion: reviewerVersionSchema,
  revisionId: reviewerIdSchema,
  assignmentId: reviewerIdSchema,
  expectedAssignmentVersion: reviewerVersionSchema,
}).strict();

export const poolItemSchema = z.object({
  id: reviewerIdSchema,
  version: reviewerVersionSchema,
  title: reviewerTitleSchema,
  author: reviewerAuthorSchema,
  summary: reviewerSummarySchema,
  firstSubmittedAt: reviewerTimestampSchema,
  latestSubmittedAt: reviewerTimestampSchema,
  awaitingRevision: z.boolean(),
}).strict();
export const assignedReviewItemSchema = poolItemSchema.extend({
  assignmentId: reviewerIdSchema,
  revisionId: reviewerIdSchema,
  assignmentVersion: reviewerVersionSchema,
  state: assignedReviewStateSchema,
}).strict();
export const reviewPoolResponseSchema = z.object({ items: z.array(poolItemSchema).max(REVIEWER_LIMITS.pageMax), nextCursor: reviewerCursorSchema.nullable() }).strict();
export const assignedReviewsResponseSchema = z.object({ items: z.array(assignedReviewItemSchema).max(REVIEWER_LIMITS.pageMax), nextCursor: reviewerCursorSchema.nullable() }).strict();
export const reviewCommandResponseSchema = z.object({
  proposalId: reviewerIdSchema,
  revisionId: reviewerIdSchema,
  assignmentId: reviewerIdSchema,
  state: proposalStateSchema,
  version: reviewerVersionSchema,
  assignmentVersion: reviewerVersionSchema,
}).strict();

export const submittedCriterionSchema = z.object({
  id: reviewerIdSchema,
  stableKey: reviewerIdSchema,
  statement: text(REVIEWER_LIMITS.criterion, true),
  required: z.boolean(),
}).strict();
export const submittedEvidenceSchema = z.object({
  id: reviewerIdSchema,
  text: text(REVIEWER_LIMITS.evidence, true),
  evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const criterionEvidenceLinkSchema = z.object({ criterionId: reviewerIdSchema, evidenceId: reviewerIdSchema }).strict();
export const submittedRevisionSchema = z.object({
  id: reviewerIdSchema,
  number: z.number().int().min(1).max(REVIEWER_LIMITS.version),
  summary: reviewerSummarySchema,
  problem: reviewerNarrativeSchema,
  constraints: text(REVIEWER_LIMITS.narrative),
  expectedBehavior: reviewerNarrativeSchema,
  diffText: reviewerDiffSchema,
  submittedAt: reviewerTimestampSchema,
  criteria: z.array(submittedCriterionSchema).min(1).max(REVIEWER_LIMITS.criteria),
  evidence: z.array(submittedEvidenceSchema).max(REVIEWER_LIMITS.evidence),
  criterionEvidenceLinks: z.array(criterionEvidenceLinkSchema).max(REVIEWER_LIMITS.criteria * REVIEWER_LIMITS.evidence),
}).strict().superRefine((value, ctx) => {
  if (!value.criteria.some((criterion) => criterion.required)) ctx.addIssue({ code: 'custom', path: ['criteria'], message: 'At least one criterion must be required' });
  if (value.evidence.reduce((total, item) => total + reviewerCodePointLength(item.text), 0) > REVIEWER_LIMITS.evidence) ctx.addIssue({ code: 'custom', path: ['evidence'], message: 'Total evidence exceeds revision limit' });
  const criteria = new Set(value.criteria.map((item) => item.id));
  const stableKeys = new Set(value.criteria.map((item) => item.stableKey));
  const evidence = new Set(value.evidence.map((item) => item.id));
  if (criteria.size !== value.criteria.length || stableKeys.size !== value.criteria.length || evidence.size !== value.evidence.length) ctx.addIssue({ code: 'custom', message: 'Duplicate submitted identifiers' });
  const links = new Set<string>();
  value.criterionEvidenceLinks.forEach((link, index) => {
    const key = JSON.stringify([link.criterionId, link.evidenceId]);
    if (!criteria.has(link.criterionId) || !evidence.has(link.evidenceId) || links.has(key)) ctx.addIssue({ code: 'custom', path: ['criterionEvidenceLinks', index], message: 'Links must be unique and refer to this revision' });
    links.add(key);
  });
});
export const currentReviewAssignmentSchema = z.object({
  id: reviewerIdSchema,
  revisionId: reviewerIdSchema,
  version: reviewerVersionSchema,
  reviewer: reviewerAuthorSchema,
}).strict();
export const proposalDetailResponseSchema = z.object({
  id: reviewerIdSchema,
  version: reviewerVersionSchema,
  title: reviewerTitleSchema,
  state: assignedReviewStateSchema,
  author: reviewerAuthorSchema,
  firstSubmittedAt: reviewerTimestampSchema,
  latestSubmittedAt: reviewerTimestampSchema,
  assignment: currentReviewAssignmentSchema,
  revision: submittedRevisionSchema,
}).strict();
export const submittedRevisionSummarySchema = z.object({
  id: reviewerIdSchema,
  number: z.number().int().min(1).max(REVIEWER_LIMITS.version),
  submittedAt: reviewerTimestampSchema,
  summary: reviewerSummarySchema,
}).strict();
export const submittedRevisionsResponseSchema = z.object({ items: z.array(submittedRevisionSummarySchema).max(REVIEWER_LIMITS.pageMax), nextCursor: reviewerCursorSchema.nullable() }).strict();
export const proposalActivityItemSchema = z.object({
  id: reviewerIdSchema,
  actor: reviewerAuthorSchema.nullable(),
  timestamp: reviewerTimestampSchema,
  action: proposalActivityActionSchema,
  proposalId: reviewerIdSchema,
  revisionId: reviewerIdSchema,
  assignmentId: reviewerIdSchema.nullable(),
  outcome: z.literal('SUCCESS'),
  summary: text(REVIEWER_LIMITS.summary, true),
  reason: text(REVIEWER_LIMITS.criterion, true).nullable(),
}).strict();
export const proposalActivityResponseSchema = z.object({ items: z.array(proposalActivityItemSchema).max(REVIEWER_LIMITS.activityPage), nextCursor: reviewerCursorSchema.nullable() }).strict();

export type ProposalState = z.infer<typeof proposalStateSchema>;
export type AssignedReviewState = z.infer<typeof assignedReviewStateSchema>;
export type ReviewPoolQuery = z.infer<typeof reviewPoolQuerySchema>;
export type AssignedReviewsQuery = z.infer<typeof assignedReviewsQuerySchema>;
export type ProposalDetailQuery = z.infer<typeof proposalDetailQuerySchema>;
export type SubmittedRevisionsQuery = z.infer<typeof submittedRevisionsQuerySchema>;
export type ProposalActivityQuery = z.infer<typeof proposalActivityQuerySchema>;
export type ClaimProposalRequest = z.infer<typeof claimProposalRequestSchema>;
export type DropProposalRequest = z.infer<typeof dropProposalRequestSchema>;
export type PoolItem = z.infer<typeof poolItemSchema>;
export type AssignedReviewItem = z.infer<typeof assignedReviewItemSchema>;
export type ReviewPoolResponse = z.infer<typeof reviewPoolResponseSchema>;
export type AssignedReviewsResponse = z.infer<typeof assignedReviewsResponseSchema>;
export type ReviewCommandResponse = z.infer<typeof reviewCommandResponseSchema>;
export type SubmittedCriterion = z.infer<typeof submittedCriterionSchema>;
export type SubmittedEvidence = z.infer<typeof submittedEvidenceSchema>;
export type SubmittedRevision = z.infer<typeof submittedRevisionSchema>;
export type CurrentReviewAssignment = z.infer<typeof currentReviewAssignmentSchema>;
export type ProposalDetailResponse = z.infer<typeof proposalDetailResponseSchema>;
export type SubmittedRevisionSummary = z.infer<typeof submittedRevisionSummarySchema>;
export type SubmittedRevisionsResponse = z.infer<typeof submittedRevisionsResponseSchema>;
export type ProposalActivityItem = z.infer<typeof proposalActivityItemSchema>;
export type ProposalActivityResponse = z.infer<typeof proposalActivityResponseSchema>;
