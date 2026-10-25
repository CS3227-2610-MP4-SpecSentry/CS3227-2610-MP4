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
export const proposalActivityActionSchema = z.enum(['SUBMITTED', 'RESUBMITTED', 'CLAIMED', 'DROPPED', 'ASSIGNMENT_RELEASED', 'COVERAGE_ASSESSED', 'COVERAGE_CONFIRMED', 'FINDING_CREATED', 'FINDING_TRANSITIONED', 'FINDING_AMENDED', 'REVIEW_APPROVED', 'CHANGES_REQUESTED']);

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
export const assignedReviewsQuerySchema = z.object({ ...ageQuery, ...pageQuery, state: assignedReviewStateSchema.optional(), severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional() }).strict()
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

// Human manual review: bounded, strict requests with server-owned attribution.
export const findingSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const findingStatusSchema = z.enum(['OPEN', 'RESOLVED']);
export const coverageStatusSchema = z.enum(['COVERED', 'PARTIALLY_COVERED', 'NOT_COVERED', 'NOT_APPLICABLE']);
export const reviewTextSchema = text(2_000, true);
const reviewWriteScope = {
  expectedVersion: reviewerVersionSchema, revisionId: reviewerIdSchema,
  assignmentId: reviewerIdSchema, expectedAssignmentVersion: reviewerVersionSchema,
};
export const coverageWriteRequestSchema = z.discriminatedUnion('operation', [
  z.object({ ...reviewWriteScope, operation: z.literal('ASSESS'), status: coverageStatusSchema,
    rationale: reviewTextSchema.optional(), evidenceIds: z.array(reviewerIdSchema).max(REVIEWER_LIMITS.evidence).default([]),
  }).strict().refine((value) => value.status === 'COVERED' || !!value.rationale, { message: 'Rationale required', path: ['rationale'] })
    .refine((value) => new Set(value.evidenceIds).size === value.evidenceIds.length, { message: 'Duplicate evidence', path: ['evidenceIds'] }),
  z.object({ ...reviewWriteScope, operation: z.literal('CONFIRM'), sourceCoverageId: reviewerIdSchema }).strict(),
]);
export const findingDiffLocationSchema = z.object({ path: reviewTextSchema, line: z.number().int().min(1).max(REVIEWER_LIMITS.version) }).strict();
export const createFindingRequestSchema = z.object({ ...reviewWriteScope, severity: findingSeveritySchema,
  description: reviewTextSchema, criterionId: reviewerIdSchema.optional(), diffLocation: findingDiffLocationSchema.optional(),
}).strict();
export const findingTransitionRequestSchema = z.discriminatedUnion('operation', [
  z.object({ ...reviewWriteScope, operation: z.literal('RESOLVE'), reason: reviewTextSchema }).strict(),
  z.object({ ...reviewWriteScope, operation: z.literal('REOPEN'), reason: reviewTextSchema }).strict(),
  z.object({ ...reviewWriteScope, operation: z.literal('CHANGE_SEVERITY'), severity: findingSeveritySchema, reason: reviewTextSchema }).strict(),
]);
export const findingAmendmentRequestSchema = z.object({ ...reviewWriteScope, description: reviewTextSchema, reason: reviewTextSchema }).strict();
export const reviewDecisionRequestSchema = z.object({ ...reviewWriteScope, decision: z.enum(['APPROVE', 'REQUEST_CHANGES']), note: reviewTextSchema.optional() }).strict();
export const reviewIdempotencyKeySchema = z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/);
export const humanReviewQuerySchema = proposalDetailQuerySchema;
export const humanReviewPageQuerySchema = z.object(pageQuery).strict();
export const coverageHistoryQuerySchema = z.object({ ...pageQuery, revisionId: reviewerIdSchema.optional(), criterionId: reviewerIdSchema.optional() }).strict();
export const coverageRecordSchema = z.object({
  id: reviewerIdSchema, proposalId: reviewerIdSchema, revisionId: reviewerIdSchema, assignmentId: reviewerIdSchema,
  criterionId: reviewerIdSchema, actor: reviewerAuthorSchema, status: coverageStatusSchema, rationale: reviewTextSchema.nullable(),
  evidenceIds: z.array(reviewerIdSchema).max(REVIEWER_LIMITS.evidence), sourceCoverageId: reviewerIdSchema.nullable(),
  mutationVersion: reviewerVersionSchema, createdAt: reviewerTimestampSchema,
}).strict();
export const findingRecordSchema = z.object({
  id: reviewerIdSchema, proposalId: reviewerIdSchema, revisionId: reviewerIdSchema, assignmentId: reviewerIdSchema,
  actor: reviewerAuthorSchema, severity: findingSeveritySchema, description: reviewTextSchema,
  criterionId: reviewerIdSchema.nullable(), diffLocation: findingDiffLocationSchema.nullable(), createdAt: reviewerTimestampSchema,
  mutationVersion: reviewerVersionSchema, currentSeverity: findingSeveritySchema, status: findingStatusSchema,
}).strict();
export const findingEventSchema = z.object({
  id: reviewerIdSchema, findingId: reviewerIdSchema, proposalId: reviewerIdSchema, revisionId: reviewerIdSchema,
  assignmentId: reviewerIdSchema, actor: reviewerAuthorSchema,
  operation: z.enum(['RESOLVE', 'REOPEN', 'CHANGE_SEVERITY', 'AMEND']), reason: reviewTextSchema,
  description: reviewTextSchema.nullable(), severity: findingSeveritySchema, status: findingStatusSchema,
  mutationVersion: reviewerVersionSchema, createdAt: reviewerTimestampSchema,
}).strict();
export const decisionRecordSchema = z.object({
  id: reviewerIdSchema, proposalId: reviewerIdSchema, revisionId: reviewerIdSchema, assignmentId: reviewerIdSchema,
  actor: reviewerAuthorSchema, decision: z.enum(['APPROVE', 'REQUEST_CHANGES']), note: reviewTextSchema.nullable(),
  mutationVersion: reviewerVersionSchema, createdAt: reviewerTimestampSchema,
}).strict();
export const approvalBlockerSchema = z.object({
  code: z.enum(['STATE', 'MISSING_ASSESSMENT', 'UNCONFIRMED_ASSESSMENT', 'REQUIRED_NOT_COVERED', 'UNRESOLVED_HIGH_CRITICAL']),
  criterionId: reviewerIdSchema.optional(), findingId: reviewerIdSchema.optional(),
}).strict();
export const humanReviewResponseSchema = z.object({
  proposalId: reviewerIdSchema, revisionId: reviewerIdSchema, version: reviewerVersionSchema,
  assignmentId: reviewerIdSchema, assignmentVersion: reviewerVersionSchema, editable: z.boolean(),
  coverage: z.array(coverageRecordSchema.extend({ confirmed: z.boolean() }).strict()).max(REVIEWER_LIMITS.criteria),
  // Blockers are complete; finding IDs are intentionally omitted to keep this response bounded.
  approvalBlockers: z.array(approvalBlockerSchema).max(REVIEWER_LIMITS.criteria * 2 + 2),
}).strict();
const humanPage = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item).max(REVIEWER_LIMITS.pageMax), nextCursor: reviewerCursorSchema.nullable() }).strict();
export const findingsResponseSchema = humanPage(findingRecordSchema);
export const findingHistoryResponseSchema = humanPage(findingEventSchema);
export const coverageHistoryResponseSchema = humanPage(coverageRecordSchema);
export const decisionsResponseSchema = humanPage(decisionRecordSchema);
export const findingCommandResponseSchema = reviewCommandResponseSchema.extend({ finding: findingRecordSchema }).strict();
export const findingEventCommandResponseSchema = reviewCommandResponseSchema.extend({ event: findingEventSchema }).strict();
export const coverageCommandResponseSchema = reviewCommandResponseSchema.extend({ coverage: coverageRecordSchema }).strict();
export const decisionCommandResponseSchema = reviewCommandResponseSchema.extend({ decision: decisionRecordSchema }).strict();
export type CoverageWriteRequest = z.infer<typeof coverageWriteRequestSchema>;
export type CreateFindingRequest = z.infer<typeof createFindingRequestSchema>;
export type FindingTransitionRequest = z.infer<typeof findingTransitionRequestSchema>;
export type FindingAmendmentRequest = z.infer<typeof findingAmendmentRequestSchema>;
export type ReviewDecisionRequest = z.infer<typeof reviewDecisionRequestSchema>;
export type HumanReviewQuery = z.infer<typeof humanReviewQuerySchema>;
export type HumanReviewPageQuery = z.infer<typeof humanReviewPageQuerySchema>;
export type CoverageHistoryQuery = z.infer<typeof coverageHistoryQuerySchema>;
export type HumanReviewResponse = z.infer<typeof humanReviewResponseSchema>;
export type CoverageRecord = z.infer<typeof coverageRecordSchema>;
export type FindingRecord = z.infer<typeof findingRecordSchema>;
export type FindingEvent = z.infer<typeof findingEventSchema>;
export type DecisionRecord = z.infer<typeof decisionRecordSchema>;
export type FindingsResponse = z.infer<typeof findingsResponseSchema>;
export type FindingHistoryResponse = z.infer<typeof findingHistoryResponseSchema>;
export type CoverageHistoryResponse = z.infer<typeof coverageHistoryResponseSchema>;
export type DecisionsResponse = z.infer<typeof decisionsResponseSchema>;
export type FindingCommandResponse = z.infer<typeof findingCommandResponseSchema>;
export type FindingEventCommandResponse = z.infer<typeof findingEventCommandResponseSchema>;
export type CoverageCommandResponse = z.infer<typeof coverageCommandResponseSchema>;
export type DecisionCommandResponse = z.infer<typeof decisionCommandResponseSchema>;


