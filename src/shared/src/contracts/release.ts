import { z } from 'zod';
import { normalizeReviewerText, reviewerCodePointLength, reviewerIdSchema as id,
  REVIEWER_LIMITS, reviewerAuthorSchema, reviewerCursorSchema, reviewerTitleSchema,
  reviewerVersionSchema as version,
  reviewerTimestampSchema as timestamp } from './reviewer';

const bounded = (max: number, required = false) => z.string().transform(normalizeReviewerText)
  .refine(value => reviewerCodePointLength(value) <= max, `Maximum ${max} Unicode code points`)
  .refine(value => !required || value.trim().length > 0, 'Must not be empty');
export const releaseCandidateStatusSchema = z.enum(['OPEN', 'RELEASED']);
const releaseQueryInteger = (max: number, min = 0) => z.preprocess(
  value => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) ? Number(value) : value,
  z.number().int().min(min).max(max),
);
export const RELEASE_LIMITS = {
  smokeHistoryPageDefault: 5,
  smokeHistoryPageMax: 20,
  smokeHistoryContentBytes: 262_144,
} as const;
export const releaseCandidatesQuerySchema = z.object({
  status: releaseCandidateStatusSchema.optional(),
  limit: releaseQueryInteger(REVIEWER_LIMITS.pageMax, 1).default(REVIEWER_LIMITS.pageDefault),
  cursor: reviewerCursorSchema.optional(),
}).strict();
export const eligibleReleaseProposalsQuerySchema = z.object({
  limit: releaseQueryInteger(REVIEWER_LIMITS.pageMax, 1).default(REVIEWER_LIMITS.pageDefault),
  cursor: reviewerCursorSchema.optional(),
}).strict();
export const releaseSemanticVersionSchema = z.string().max(64)
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
export const createReleaseCandidateRequestSchema = z.object({
  versionLabel: releaseSemanticVersionSchema,
  rollbackNote: bounded(10_000, true), dependencyNotes: bounded(10_000),
}).strict();
export const updateReleaseCandidateRequestSchema = z.object({
  expectedVersion: version, versionLabel: releaseSemanticVersionSchema,
  rollbackNote: bounded(10_000, true), dependencyNotes: bounded(10_000),
}).strict();
export const addReleaseMemberRequestSchema = z.object({
  expectedCandidateVersion: version, expectedContentVersion: version,
  proposalId: id, revisionId: id, assignmentId: id,
  expectedProposalVersion: version, expectedAssignmentVersion: version,
}).strict();
export const removeReleaseMemberRequestSchema = z.object({
  expectedCandidateVersion: version, expectedContentVersion: version,
  memberId: id, expectedProposalVersion: version,
}).strict();
export const appendReleaseSmokeTestRequestSchema = z.object({
  expectedVersion: version, testedContentVersion: version,
  procedure: bounded(10_000, true), results: bounded(10_000, true), outcome: z.enum(['PASS', 'FAIL']),
}).strict();
export const publishReleaseCandidateRequestSchema = z.object({
  expectedVersion: version, expectedContentVersion: version,
}).strict();
export const appendReleaseAnnotationRequestSchema = z.object({
  expectedVersion: version, snapshotId: id, text: bounded(2_000, true),
}).strict();
export const releaseAnnotationsQuerySchema = eligibleReleaseProposalsQuerySchema;
export const releaseSmokeTestsQuerySchema = z.object({
  limit: releaseQueryInteger(RELEASE_LIMITS.smokeHistoryPageMax, 1)
    .default(RELEASE_LIMITS.smokeHistoryPageDefault),
  cursor: reviewerCursorSchema.optional(),
}).strict();
export const releaseCandidateMemberSchema = z.object({
  id, proposalId: id, proposalTitle: reviewerTitleSchema, proposalVersion: version,
  revisionId: id, revisionNumber: z.number().int().min(1).max(REVIEWER_LIMITS.version), assignmentId: id,
  status: z.enum(['ATTACHED', 'REMOVED', 'RELEASED']), attachedAt: timestamp, removedAt: timestamp.nullable(),
}).strict();
export const releaseSmokeTestSchema = z.object({
  id, testedContentVersion: version, outcome: z.enum(['PASS', 'FAIL']),
  procedure: bounded(10_000, true), results: bounded(10_000, true), actorId: id, createdAt: timestamp,
}).strict();
export const releaseReadinessBlockerSchema = z.object({
  code: z.enum(['EMPTY', 'VERSION', 'ROLLBACK', 'SMOKE', 'REVISION', 'APPROVAL', 'COVERAGE', 'FINDING']),
  proposalId: id.optional(),
}).strict();
export const releaseCandidateDetailResponseSchema = z.object({
  id, projectKey: id, createdById: id, status: releaseCandidateStatusSchema,
  versionLabel: releaseSemanticVersionSchema, rollbackNote: bounded(10_000, true),
  dependencyNotes: bounded(10_000), version, contentVersion: version,
  members: z.array(releaseCandidateMemberSchema).max(1_000),
  smokeTests: z.array(releaseSmokeTestSchema).max(1),
  smokeTestsTruncated: z.boolean().default(false),
  blockers: z.array(releaseReadinessBlockerSchema).max(1_000),
  publishedAt: timestamp.nullable(),
  publication: z.object({ snapshotId: id, actorId: id, candidateVersion: version,
    contentVersion: version, createdAt: timestamp }).strict().nullable().default(null),
  unreadRevocationNotices: z.array(z.object({ id, proposalId: id, revisionId: id,
    invalidationId: id, reviewerId: id, reason: bounded(2_000, true), createdAt: timestamp }).strict())
    .max(REVIEWER_LIMITS.pageMax).default([]),
  unreadRevocationNoticesTruncated: z.boolean().default(false),
}).strict();
export const releaseCandidateSummarySchema = z.object({
  id, versionLabel: releaseSemanticVersionSchema, status: releaseCandidateStatusSchema,
  createdById: id, createdAt: timestamp, publishedAt: timestamp.nullable(),
  version, contentVersion: version,
}).strict();
export const releaseCandidatesResponseSchema = z.object({
  items: z.array(releaseCandidateSummarySchema).max(REVIEWER_LIMITS.pageMax),
  nextCursor: reviewerCursorSchema.nullable(),
}).strict();
export const eligibleReleaseProposalSchema = z.object({
  proposalId: id, title: reviewerTitleSchema, owner: reviewerAuthorSchema,
  proposalVersion: version, revisionId: id,
  revisionNumber: z.number().int().min(1).max(REVIEWER_LIMITS.version), submittedAt: timestamp,
  assignmentId: id, assignmentVersion: version, reviewer: reviewerAuthorSchema,
}).strict();
export const eligibleReleaseProposalsResponseSchema = z.object({
  items: z.array(eligibleReleaseProposalSchema).max(REVIEWER_LIMITS.pageMax),
  nextCursor: reviewerCursorSchema.nullable(),
}).strict();
export const releaseAnnotationSchema = z.object({
  id, candidateId: id, actor: reviewerAuthorSchema, text: bounded(2_000, true), createdAt: timestamp,
}).strict();
export const releaseAnnotationsResponseSchema = z.object({
  items: z.array(releaseAnnotationSchema).max(REVIEWER_LIMITS.pageMax),
  nextCursor: reviewerCursorSchema.nullable(),
}).strict();
export const releaseSmokeTestsResponseSchema = z.object({
  items: z.array(releaseSmokeTestSchema).max(RELEASE_LIMITS.smokeHistoryPageMax),
  nextCursor: reviewerCursorSchema.nullable(),
  contentBytes: z.number().int().min(0).max(RELEASE_LIMITS.smokeHistoryContentBytes),
}).strict();
// Reviewer-facing candidate data must be projected separately from detail/readiness.
export const reviewerReleaseContextSchema = z.object({
  candidateId: id, candidateVersion: version, ownInvalidApprovalBlocker: z.boolean(),
}).strict();
export const releaseCandidateCommandResponseSchema = z.object({
  candidateId: id, version, contentVersion: version, status: releaseCandidateStatusSchema,
}).strict();
export const releasePublicationResponseSchema = releaseCandidateCommandResponseSchema.extend({
  snapshotId: id, publishedAt: timestamp,
}).strict();

export type CreateReleaseCandidateRequest = z.infer<typeof createReleaseCandidateRequestSchema>;
export type UpdateReleaseCandidateRequest = z.infer<typeof updateReleaseCandidateRequestSchema>;
export type AddReleaseMemberRequest = z.infer<typeof addReleaseMemberRequestSchema>;
export type RemoveReleaseMemberRequest = z.infer<typeof removeReleaseMemberRequestSchema>;
export type AppendReleaseSmokeTestRequest = z.infer<typeof appendReleaseSmokeTestRequestSchema>;
export type PublishReleaseCandidateRequest = z.infer<typeof publishReleaseCandidateRequestSchema>;
export type AppendReleaseAnnotationRequest = z.infer<typeof appendReleaseAnnotationRequestSchema>;
export type ReleaseCandidateDetailResponse = z.infer<typeof releaseCandidateDetailResponseSchema>;
export type ReleaseCandidateSummary = z.infer<typeof releaseCandidateSummarySchema>;
export type ReleaseCandidatesResponse = z.infer<typeof releaseCandidatesResponseSchema>;
export type ReleaseCandidatesQuery = z.infer<typeof releaseCandidatesQuerySchema>;
export type EligibleReleaseProposalsQuery = z.infer<typeof eligibleReleaseProposalsQuerySchema>;
export type EligibleReleaseProposalsResponse = z.infer<typeof eligibleReleaseProposalsResponseSchema>;
export type ReleaseAnnotationsQuery = z.infer<typeof releaseAnnotationsQuerySchema>;
export type ReleaseAnnotationsResponse = z.infer<typeof releaseAnnotationsResponseSchema>;
export type ReleaseSmokeTestsQuery = z.infer<typeof releaseSmokeTestsQuerySchema>;
export type ReleaseSmokeTestsResponse = z.infer<typeof releaseSmokeTestsResponseSchema>;
