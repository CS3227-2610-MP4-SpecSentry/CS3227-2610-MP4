import { z } from 'zod';
import { reviewerIdSchema, reviewerTimestampSchema, reviewerVersionSchema } from './reviewer';

// Browser-safe data only. No provider settings, prompts, session or access-generation IDs.
export const AI_LIMITS = {
  reviewerCriteria: 5, reviewerInputTokens: 10_000, reviewerDiffCodePoints: 20_000,
  outputTokens: 800, responseBytes: 65_536, deadlineMs: 20_000, auditPage: 50,
} as const;

// Output bounds count Unicode code points, without rewriting the model's text.
const plainText = (maximum: number) => z.string()
  .refine((value) => value.trim().length > 0, 'Text must not be empty')
  .refine((value) => Array.from(value).length <= maximum, 'Text exceeds its limit');
const uniqueIds = (minimum: number, maximum: number) => z.array(reviewerIdSchema).min(minimum).max(maximum)
  .refine((ids) => new Set(ids).size === ids.length, 'Identifiers must be unique');
export const selectedCriterionIdsSchema = uniqueIds(1, AI_LIMITS.reviewerCriteria);
export const aiConfidenceSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const aiCoverageStatusSchema = z.enum(['COVERED', 'PARTIALLY_COVERED', 'NOT_COVERED', 'NOT_APPLICABLE']);
export const aiRiskSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const patchRiskRequestSchema = z.object({
  revisionId: reviewerIdSchema,
  assignmentId: reviewerIdSchema,
  expectedVersion: reviewerVersionSchema,
  expectedAssignmentVersion: reviewerVersionSchema,
  selectedCriterionIds: selectedCriterionIdsSchema,
}).strict();
export const patchRiskScopeSchema = patchRiskRequestSchema.omit({ selectedCriterionIds: true }).extend({ proposalId: reviewerIdSchema }).strict();

const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
export const reviewerRiskResultSchema = z.object({
  coverage: z.array(z.object({ criterionId: reviewerIdSchema, status: aiCoverageStatusSchema, rationale: plainText(120) }).strict()).min(1).max(5)
    .refine((items) => new Set(items.map((item) => item.criterionId)).size === items.length, 'Duplicate coverage identifiers'),
  risks: z.array(z.object({ criterionIds: uniqueIds(0, 5), severity: aiRiskSeveritySchema, description: plainText(160) }).strict()).max(3),
  questions: z.array(plainText(100)).max(3),
  suggestedTests: z.array(plainText(100)).max(3),
  confidence: aiConfidenceSchema,
}).strict().transform((result) => ({ ...result, risks: [...result.risks].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]) }));

function checkGrounding(result: ReviewerRiskResult, selected: readonly string[], ctx: z.RefinementCtx): void {
  const allowed = new Set(selected);
  if (result.coverage.length !== selected.length || result.coverage.some((item) => !allowed.has(item.criterionId))) {
    ctx.addIssue({ code: 'custom', path: ['coverage'], message: 'Coverage must match the selected criteria exactly' });
  }
  if (result.risks.some((risk) => risk.criterionIds.some((id) => !allowed.has(id)))) {
    ctx.addIssue({ code: 'custom', path: ['risks'], message: 'Risk identifiers must belong to the selected criteria' });
  }
}

// Grounding uses the exact server-authorized selection; identifiers are never normalized.
export function validateReviewerRiskResult(value: unknown, selectedCriterionIds: readonly string[]): ReviewerRiskResult {
  const selected = selectedCriterionIdsSchema.parse(selectedCriterionIds);
  return reviewerRiskResultSchema.superRefine((result, ctx) => checkGrounding(result, selected, ctx)).parse(value);
}

const responseFields = {
  analyzedScope: patchRiskScopeSchema,
  selectedCriterionIds: selectedCriterionIdsSchema,
  result: reviewerRiskResultSchema,
};
export const patchRiskResponseSchema = z.discriminatedUnion('status', [
  z.object({ ...responseFields, status: z.literal('CURRENT'), staleReason: z.null() }).strict(),
  z.object({ ...responseFields, status: z.literal('STALE'), staleReason: z.enum(['NEW_REVISION', 'REVIEW_CHANGED']) }).strict(),
]).superRefine((value, ctx) => checkGrounding(value.result, value.selectedCriterionIds, ctx));

export const contributorDraftResultSchema = z.object({
  objective: plainText(200), acceptanceCriteria: z.array(plainText(160)).min(1).max(5),
  edgeCases: z.array(plainText(120)).max(3), ambiguities: z.array(plainText(120)).max(3), testIdeas: z.array(plainText(120)).max(3),
}).strict();
export const maintainerGateResultSchema = z.object({
  blockers: z.array(z.object({ itemIds: uniqueIds(0, 50), description: plainText(160) }).strict()).max(3),
  dependencies: z.array(plainText(120)).max(3), releaseNotes: z.array(plainText(120)).max(3),
  rollbackConsiderations: z.array(plainText(120)).max(3),
  readinessRecommendation: z.enum(['READY', 'NOT_READY', 'NEEDS_REVIEW']), confidence: aiConfidenceSchema,
}).strict();
export function validateMaintainerGateResult(value: unknown, candidateItemIds: readonly string[]): MaintainerGateResult {
  const allowed = new Set(candidateItemIds);
  return maintainerGateResultSchema.refine((result) => result.blockers.every((blocker) => blocker.itemIds.every((id) => allowed.has(id))), 'Unknown candidate item identifier').parse(value);
}

export const aiOutcomeSchema = z.enum(['SUCCESS', 'STALE', 'REJECTED', 'FAILED', 'CANCELLED']);
export const aiErrorClassSchema = z.enum([
  'DISABLED', 'CONFIGURATION', 'INPUT_LIMIT', 'SECRET_DETECTED', 'UNSUPPORTED_INPUT',
  'ACCESS_LOST', 'SCOPE_CHANGED', 'DEADLINE', 'RATE_LIMIT', 'QUEUE_FULL', 'PROVIDER_AUTH',
  'PROVIDER_REQUEST', 'PROVIDER_QUOTA', 'PROVIDER_TRANSIENT', 'TRANSPORT', 'INVALID_OUTPUT', 'CANCELLED', 'INTERNAL',
]);
const usageCount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable();
export const aiTokenUsageSchema = z.object({ promptTokens: usageCount, completionTokens: usageCount, totalTokens: usageCount, cachedTokens: usageCount }).strict();
export const aiAuditEntrySchema = z.object({
  requestId: reviewerIdSchema, analyzedScope: patchRiskScopeSchema,
  requestedAt: reviewerTimestampSchema, completedAt: reviewerTimestampSchema.nullable(),
  templateVersion: z.string().min(1).max(80), contextHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  selectedCriterionCount: z.number().int().min(1).max(5),
  outcome: aiOutcomeSchema.nullable(), errorClass: aiErrorClassSchema.nullable(),
  latencyMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  attempts: z.array(z.object({
    attemptId: reviewerIdSchema, ordinal: z.number().int().min(1).max(2),
    dispatchedAt: reviewerTimestampSchema, completedAt: reviewerTimestampSchema.nullable(),
    outcome: aiOutcomeSchema.nullable(), errorClass: aiErrorClassSchema.nullable(), usage: aiTokenUsageSchema,
  }).strict()).max(2),
}).strict();
export const aiAuditResponseSchema = z.object({ items: z.array(aiAuditEntrySchema).max(AI_LIMITS.auditPage) }).strict();

export type PatchRiskRequest = z.infer<typeof patchRiskRequestSchema>;
export type PatchRiskAnalyzedScope = z.infer<typeof patchRiskScopeSchema>;
export type ReviewerRiskResult = z.infer<typeof reviewerRiskResultSchema>;
export type PatchRiskResponse = z.infer<typeof patchRiskResponseSchema>;
export type ContributorDraftResult = z.infer<typeof contributorDraftResultSchema>;
export type MaintainerGateResult = z.infer<typeof maintainerGateResultSchema>;
export type AiOutcome = z.infer<typeof aiOutcomeSchema>;
export type AiErrorClass = z.infer<typeof aiErrorClassSchema>;
export type AiTokenUsage = z.infer<typeof aiTokenUsageSchema>;
export type AiAuditEntry = z.infer<typeof aiAuditEntrySchema>;
export type AiAuditResponse = z.infer<typeof aiAuditResponseSchema>;
