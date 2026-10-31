import {
  aiAuditResponseSchema, contributorDraftResultSchema, maintainerGateResultSchema,
  patchRiskRequestSchema, patchRiskResponseSchema, patchRiskScopeSchema, reviewerRiskResultSchema,
  validateMaintainerGateResult, validateReviewerRiskResult,
} from '@specsentry/shared';
import { readConfig } from '../src/config';
import { patchRiskContextFixture, patchRiskRequestFixture, reviewerRiskResultFixture } from './ai-fixtures';

describe('AI foundation boundaries', () => {
  it('ai-boundary-batch: accepts only 1–5 unique exact selected IDs and exact grounded output', () => {
    const request = patchRiskRequestFixture();
    expect(patchRiskRequestSchema.parse(request)).toEqual(request);
    for (const ids of [[], ['criterion-1', 'criterion-1'], Array.from({ length: 6 }, (_, i) => `c-${i}`)]) {
      expect(patchRiskRequestSchema.safeParse({ ...request, selectedCriterionIds: ids }).success).toBe(false);
    }
    const selected = [' c-1 ', 'C-2', 'c-2', 'c-3', 'c-4'];
    const result = reviewerRiskResultFixture({
      coverage: selected.map((criterionId) => ({ criterionId, status: 'COVERED', rationale: 'Evidence supports it.' })),
      risks: [{ criterionIds: selected, severity: 'LOW', description: 'Review the boundaries.' }],
    });
    expect(validateReviewerRiskResult(result, selected).coverage.map((item) => item.criterionId)).toEqual(selected);
    expect(() => validateReviewerRiskResult(result, selected.slice(1))).toThrow();
    expect(() => validateReviewerRiskResult({ ...result, coverage: [...result.coverage.slice(1), result.coverage[1]] }, selected)).toThrow();
    expect(() => validateReviewerRiskResult({ ...result, coverage: result.coverage.map((item, i) => i ? item : { ...item, criterionId: 'c-1' }) }, selected)).toThrow();
    expect(() => validateReviewerRiskResult({ ...result, risks: [{ criterionIds: ['other'], severity: 'HIGH', description: 'Ungrounded.' }] }, selected)).toThrow();
    expect(() => validateReviewerRiskResult({ ...result, risks: [{ criterionIds: ['C-2', 'C-2'], severity: 'HIGH', description: 'Duplicate.' }] }, selected)).toThrow();
  });

  it('ai-boundary-scope: preserves version coordinates and validates discriminated current/stale envelopes', () => {
    const { accessGenerationId: _generation, ...scope } = patchRiskContextFixture().scope;
    void _generation;
    const response = { analyzedScope: scope, selectedCriterionIds: ['criterion-1'], result: reviewerRiskResultFixture() };
    expect(patchRiskResponseSchema.parse({ ...response, status: 'CURRENT', staleReason: null }).analyzedScope).toEqual(scope);
    for (const staleReason of ['NEW_REVISION', 'REVIEW_CHANGED']) {
      expect(patchRiskResponseSchema.safeParse({ ...response, status: 'STALE', staleReason }).success).toBe(true);
    }
    for (const invalid of [
      { ...response, status: 'CURRENT', staleReason: 'NEW_REVISION' },
      { ...response, status: 'STALE', staleReason: null },
      { ...response, status: 'STALE', staleReason: 'ACCESS_LOST' },
      { ...response, status: 'CURRENT', staleReason: null, actorId: 'other' },
      { ...response, status: 'CURRENT', staleReason: null, analyzedScope: { ...scope, accessGenerationId: 'private' } },
      { ...response, status: 'CURRENT', staleReason: null, selectedCriterionIds: ['other'] },
    ]) expect(patchRiskResponseSchema.safeParse(invalid).success).toBe(false);
    for (const key of ['proposalId', 'revisionId', 'assignmentId', 'expectedVersion', 'expectedAssignmentVersion']) {
      const incomplete: Record<string, unknown> = { ...scope }; delete incomplete[key];
      expect(patchRiskScopeSchema.safeParse(incomplete).success).toBe(false);
    }
    for (const version of [-1, 1.5, '2', Number.POSITIVE_INFINITY]) {
      expect(patchRiskScopeSchema.safeParse({ ...scope, expectedVersion: version }).success).toBe(false);
    }
  });

  it('rejects browser prompt/provider overrides and nested unknown result fields', () => {
    for (const key of ['prompt', 'actorId', 'model', 'endpoint', 'mode', 'accessGenerationId']) {
      expect(patchRiskRequestSchema.safeParse({ ...patchRiskRequestFixture(), [key]: 'unexpected' }).success).toBe(false);
    }
    const result = reviewerRiskResultFixture();
    expect(reviewerRiskResultSchema.safeParse({ ...result, approve: true }).success).toBe(false);
    expect(reviewerRiskResultSchema.safeParse({ ...result, coverage: [{ ...result.coverage[0], required: false }] }).success).toBe(false);
    expect(reviewerRiskResultSchema.safeParse({ ...result, risks: [{ ...result.risks[0], action: 'save' }] }).success).toBe(false);
    expect(reviewerRiskResultSchema.safeParse({ ...result, confidence: 1 }).success).toBe(false);
  });

  it('uses exact Unicode code-point caps, required fields, list caps and stable severity ordering', () => {
    const result = reviewerRiskResultFixture();
    expect(reviewerRiskResultSchema.safeParse({ ...result, questions: ['😀'.repeat(100)] }).success).toBe(true);
    expect(reviewerRiskResultSchema.safeParse({ ...result, questions: ['😀'.repeat(101)] }).success).toBe(false);
    expect(reviewerRiskResultSchema.safeParse({ ...result, questions: ['   '] }).success).toBe(false);
    expect(reviewerRiskResultSchema.safeParse({ ...result, questions: Array(4).fill('Question') }).success).toBe(false);
    expect(reviewerRiskResultSchema.safeParse({ ...result, coverage: [] }).success).toBe(false);
    const { confidence: _confidence, ...missing } = result;
    void _confidence;
    expect(reviewerRiskResultSchema.safeParse(missing).success).toBe(false);
    expect(reviewerRiskResultSchema.parse({ ...result, risks: [] }).risks).toEqual([]);
    const risk = (severity: 'LOW' | 'CRITICAL', description: string) => ({ criterionIds: [], severity, description });
    const ordered = reviewerRiskResultSchema.parse({ ...result, risks: [risk('LOW', 'First low'), risk('CRITICAL', 'Critical'), risk('LOW', 'Second low')] });
    expect(ordered.risks.map((item) => item.description)).toEqual(['Critical', 'First low', 'Second low']);
    const hostile = '<img src=x onerror=alert(1)> [link](https://example.invalid)';
    expect(reviewerRiskResultSchema.parse({ ...result, questions: [hostile] }).questions).toEqual([hostile]);
  });

  it('defines strict normative Contributor and Maintainer shapes without business effects', () => {
    const contributor = { objective: 'Objective', acceptanceCriteria: ['Criterion'], edgeCases: [], ambiguities: [], testIdeas: [] };
    expect(contributorDraftResultSchema.parse(contributor)).toEqual(contributor);
    expect(contributorDraftResultSchema.safeParse({ ...contributor, acceptanceCriteria: [{ id: 'generated', statement: 'Criterion' }] }).success).toBe(false);
    const maintainer = { blockers: [{ itemIds: ['item-1'], description: 'Missing evidence.' }], dependencies: [], releaseNotes: [], rollbackConsiderations: [], readinessRecommendation: 'NEEDS_REVIEW', confidence: 'LOW' };
    expect(validateMaintainerGateResult(maintainer, ['item-1'])).toEqual(maintainer);
    expect(() => validateMaintainerGateResult(maintainer, ['item-2'])).toThrow();
    expect(maintainerGateResultSchema.safeParse({ ...maintainer, publish: true }).success).toBe(false);
    expect(maintainerGateResultSchema.safeParse({ ...maintainer, blockers: [{ itemIds: ['item-1', 'item-1'], description: 'Duplicate' }] }).success).toBe(false);
  });

  it('audit projection is bounded and rejects raw suggestion or private actor/generation fields', () => {
    expect(aiAuditResponseSchema.parse({ items: [] })).toEqual({ items: [] });
    const { accessGenerationId: _generation, ...scope } = patchRiskContextFixture().scope;
    void _generation;
    const entry = { requestId: 'request-1', analyzedScope: scope, requestedAt: '2026-10-26T00:00:00.000Z', completedAt: null,
      templateVersion: 'reviewer-risk-v1', contextHash: null, selectedCriterionCount: 1,
      outcome: null, errorClass: null, latencyMs: null, attempts: [] };
    expect(aiAuditResponseSchema.safeParse({ items: [entry] }).success).toBe(true);
    for (const extra of [{ result: reviewerRiskResultFixture() }, { rawPrompt: 'text' }, { actorId: 'actor' }, { accessGenerationId: 'generation' }]) {
      expect(aiAuditResponseSchema.safeParse({ items: [{ ...entry, ...extra }] }).success).toBe(false);
    }
    expect(aiAuditResponseSchema.safeParse({ items: Array(51).fill(entry) }).success).toBe(false);
    expect(aiAuditResponseSchema.safeParse({ items: [{ ...entry, errorClass: 'provider secret raw message' }] }).success).toBe(false);
  });

  it('keeps OPEN-002 live configuration disabled despite nonempty placeholders or flag assertions', () => {
    const base = { SESSION_SECRET: 'synthetic-test-session-secret-32-chars', DATABASE_URL: 'postgresql://test:test@localhost/test' };
    expect(readConfig({ ...base, AI_API_KEY: 'placeholder', AI_MODEL: 'placeholder' }).AI_LIVE_ENABLED).toBe(false);
    expect(readConfig({ ...base, AI_LIVE_ENABLED: 'false' }).AI_LIVE_ENABLED).toBe(false);
    expect(() => readConfig({ ...base, AI_LIVE_ENABLED: 'true' })).toThrow('Invalid server configuration: AI_LIVE_ENABLED');
    expect(() => readConfig({ ...base, AI_BASE_URL: 'https://unapproved.invalid/v1' })).toThrow('Invalid server configuration: AI_BASE_URL');
  });
});
