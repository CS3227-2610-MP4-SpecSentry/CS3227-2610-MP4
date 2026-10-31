import { z } from 'zod';
import { normalizeReviewerText, reviewerCodePointLength, reviewerIdSchema as id,
  reviewerVersionSchema as version, reviewerTimestampSchema as timestamp,
  proposalStateSchema, reviewerAuthorSchema } from './reviewer';

export const revocationReasonSchema = z.string().transform(normalizeReviewerText)
  .refine(value => value.trim().length > 0, 'Reason must not be empty')
  .refine(value => reviewerCodePointLength(value) <= 2_000, 'Reason must contain at most 2000 Unicode code points');
export const revokeApprovalCandidateContextSchema = z.object({
  candidateId: id, expectedCandidateVersion: version,
}).strict();
export const revokeApprovalRequestSchema = z.object({
  expectedVersion: version, revisionId: id, assignmentId: id,
  expectedAssignmentVersion: version, approvalId: id, expectedApprovalVersion: version,
  reason: revocationReasonSchema, candidateContext: revokeApprovalCandidateContextSchema.nullable(),
}).strict();
export const approvalInvalidationCauseSchema = z.enum(['REOPENED', 'REVOKED']);
export const approvalInvalidationRecordSchema = z.object({
  id, proposalId: id, revisionId: id, assignmentId: id, decisionId: id,
  actor: reviewerAuthorSchema, mutationVersion: version, cause: approvalInvalidationCauseSchema,
  reason: revocationReasonSchema.nullable(), candidateId: id.nullable(), createdAt: timestamp,
}).strict();
// This is a member-scoped projection. It contains no aggregate candidate readiness.
export const revokeApprovalResponseSchema = z.object({
  proposalId: id, revisionId: id, assignmentId: id, state: proposalStateSchema,
  version, assignmentVersion: version, effectiveApproval: z.literal(false),
  invalidation: approvalInvalidationRecordSchema,
  candidate: z.object({ id, version, ownInvalidApprovalBlocker: z.literal(true) }).strict().nullable(),
}).strict();

export type RevokeApprovalRequest = z.infer<typeof revokeApprovalRequestSchema>;
export type RevokeApprovalResponse = z.infer<typeof revokeApprovalResponseSchema>;
export type ApprovalInvalidationRecord = z.infer<typeof approvalInvalidationRecordSchema>;
