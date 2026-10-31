import { z } from 'zod';
import { normalizeReviewerText, reviewerCodePointLength, reviewerIdSchema as id,
  reviewerVersionSchema as version, reviewerTimestampSchema as timestamp } from './reviewer';

const bounded = (max: number, required = false) => z.string().transform(normalizeReviewerText)
  .refine(value => reviewerCodePointLength(value) <= max, `Maximum ${max} Unicode code points`)
  .refine(value => !required || value.trim().length > 0, 'Must not be empty');
export const releaseCandidateStatusSchema = z.enum(['OPEN', 'RELEASED']);
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
export const releaseCandidateMemberSchema = z.object({
  id, proposalId: id, revisionId: id, assignmentId: id, approvalId: id,
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
  smokeTests: z.array(releaseSmokeTestSchema).max(1_000),
  blockers: z.array(releaseReadinessBlockerSchema).max(1_000),
  publishedAt: timestamp.nullable(),
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
export type ReleaseCandidateDetailResponse = z.infer<typeof releaseCandidateDetailResponseSchema>;
