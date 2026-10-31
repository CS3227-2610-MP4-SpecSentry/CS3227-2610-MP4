import { assignedReviewsQuerySchema, coverageWriteRequestSchema, createFindingRequestSchema,
  findingAmendmentRequestSchema, findingTransitionRequestSchema, reviewDecisionRequestSchema,
  reviewIdempotencyKeySchema } from '@specsentry/shared';

const scope = { expectedVersion: 1, revisionId: 'revision', assignmentId: 'assignment', expectedAssignmentVersion: 0 };
describe('Manual review requirement boundary contracts (REQ-REV-002/005/009)', () => {
  it('allows covered without evidence and requires a meaningful rationale for each other status', () => {
    expect(coverageWriteRequestSchema.parse({ ...scope, operation: 'ASSESS', status: 'COVERED' }).operation).toBe('ASSESS');
    for (const status of ['PARTIALLY_COVERED', 'NOT_COVERED', 'NOT_APPLICABLE']) {
      for (const rationale of [undefined, '', '  ', '\r\n']) expect(coverageWriteRequestSchema.safeParse({ ...scope, operation: 'ASSESS', status, rationale }).success).toBe(false);
      expect(coverageWriteRequestSchema.safeParse({ ...scope, operation: 'ASSESS', status, rationale: 'Explicit human rationale.' }).success).toBe(true);
    }
    expect(coverageWriteRequestSchema.safeParse({ ...scope, operation: 'ASSESS', status: 'COVERED', evidenceIds: ['e', 'e'] }).success).toBe(false);
    expect(coverageWriteRequestSchema.safeParse({ ...scope, operation: 'CONFIRM', sourceCoverageId: 'source', status: 'COVERED' }).success).toBe(false);
    expect(coverageWriteRequestSchema.safeParse({ ...scope, operation: 'CONFIRM', sourceCoverageId: 'source' }).success).toBe(true);
  });
  it('requires explanations for every transition and rejects silent rewriting and forged attribution', () => {
    for (const operation of ['RESOLVE', 'REOPEN', 'CHANGE_SEVERITY']) {
      const transition = { ...scope, operation, ...(operation === 'CHANGE_SEVERITY' ? { severity: 'HIGH' } : {}) };
      expect(findingTransitionRequestSchema.safeParse(transition).success).toBe(false);
      expect(findingTransitionRequestSchema.safeParse({ ...transition, reason: 'Human explanation.' }).success).toBe(true);
      expect(findingTransitionRequestSchema.safeParse({ ...transition, reason: 'Human explanation.', description: 'Overwrite' }).success).toBe(false);
    }
    expect(findingAmendmentRequestSchema.safeParse({ ...scope, description: 'Correction', reason: 'Typo' }).success).toBe(true);
    for (const extra of [{ actorId: 'other' }, { state: 'APPROVED' }, { createdAt: new Date().toISOString() }]) {
      expect(createFindingRequestSchema.safeParse({ ...scope, severity: 'LOW', description: 'Finding', ...extra }).success).toBe(false);
      expect(reviewDecisionRequestSchema.safeParse({ ...scope, decision: 'APPROVE', ...extra }).success).toBe(false);
    }
    expect(createFindingRequestSchema.safeParse({ ...scope, description: 'Missing severity' }).success).toBe(false);
    const finding = { ...scope, description: 'Scoped location', severity: 'LOW' };
    expect(createFindingRequestSchema.safeParse({ ...finding, diffLocation: { path: 'src/example.ts', line: 1 } }).success).toBe(true);
    for (const diffLocation of ['src/example.ts:1', { path: 'src/example.ts', line: 0 }, { path: 'src/example.ts', line: 1, actorId: 'forged' }]) {
      expect(createFindingRequestSchema.safeParse({ ...finding, diffLocation }).success).toBe(false);
    }
  });
  it('uses normalized Unicode code-point limits and bounded keys, versions and queue severity', () => {
    expect(findingAmendmentRequestSchema.parse({ ...scope, description: 'a\r\nb\rc', reason: '😀'.repeat(2000) }).description).toBe('a\nb\nc');
    expect(findingAmendmentRequestSchema.safeParse({ ...scope, description: 'x', reason: '😀'.repeat(2001) }).success).toBe(false);
    for (const key of ['', 'spaces forbidden', 'x'.repeat(129), 'line\nbreak', 'é']) expect(reviewIdempotencyKeySchema.safeParse(key).success).toBe(false);
    expect(reviewIdempotencyKeySchema.safeParse('retry-01_abc').success).toBe(true);
    for (const severity of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) expect(assignedReviewsQuerySchema.safeParse({ severity }).success).toBe(true);
    expect(assignedReviewsQuerySchema.safeParse({ severity: 'RESOLVED' }).success).toBe(false);
    expect(coverageWriteRequestSchema.safeParse({ ...scope, expectedAssignmentVersion: -1, operation: 'ASSESS', status: 'COVERED' }).success).toBe(false);
  });
});
