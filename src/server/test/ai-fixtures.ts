import type { PatchRiskRequest, ReviewerRiskResult } from '@specsentry/shared';
import type { AiGatewayOptions, PatchRiskContext } from '../src/ai/contracts';

// Synthetic only. Tests never enable a live provider or reuse submitted content.
export const aiTestOptions: AiGatewayOptions = {
  mode: 'test', model: 'synthetic-reviewer-model', contextWindow: 16_384,
  tokenCounterVerificationId: 'synthetic-counter-v1',
};
export function patchRiskRequestFixture(overrides: Partial<PatchRiskRequest> = {}): PatchRiskRequest {
  return { revisionId: 'revision-1', assignmentId: 'assignment-1', expectedVersion: 2,
    expectedAssignmentVersion: 0, selectedCriterionIds: ['criterion-1'], ...overrides };
}
export function patchRiskContextFixture(overrides: Partial<PatchRiskContext> = {}): PatchRiskContext {
  return {
    scope: { proposalId: 'proposal-1', revisionId: 'revision-1', assignmentId: 'assignment-1',
      expectedVersion: 2, expectedAssignmentVersion: 0, accessGenerationId: 'generation-1' },
    selectedCriterionIds: ['criterion-1'], summary: 'Synthetic submitted summary',
    problem: 'Validate a synthetic value.', constraints: '', expectedBehavior: 'Reject invalid values.',
    diffText: '--- a/value.ts\n+++ b/value.ts\n@@ -1 +1 @@\n-old\n+new',
    criteria: [{ id: 'criterion-1', stableKey: 'value', statement: 'Reject an invalid value.', required: true }],
    evidence: [], criterionEvidenceLinks: [], ...overrides,
  };
}
export function reviewerRiskResultFixture(overrides: Partial<ReviewerRiskResult> = {}): ReviewerRiskResult {
  return { coverage: [{ criterionId: 'criterion-1', status: 'PARTIALLY_COVERED', rationale: 'Missing boundary evidence.' }],
    risks: [{ criterionIds: ['criterion-1'], severity: 'LOW', description: 'Boundary behavior needs checking.' }],
    questions: [], suggestedTests: ['Check the boundary value.'], confidence: 'LOW', ...overrides };
}
