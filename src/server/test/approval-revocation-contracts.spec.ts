import { revokeApprovalRequestSchema, reviewIdempotencyKeySchema,
  reviewerReleaseContextSchema, revokeApprovalResponseSchema,
  createReleaseCandidateRequestSchema, updateReleaseCandidateRequestSchema,
  addReleaseMemberRequestSchema, appendReleaseSmokeTestRequestSchema,
  publishReleaseCandidateRequestSchema } from '@specsentry/shared';

const request = { expectedVersion: 5, revisionId: 'revision-1', assignmentId: 'assignment-1',
  expectedAssignmentVersion: 0, approvalId: 'approval-1', expectedApprovalVersion: 5,
  reason: 'Approval no longer holds.', candidateContext: null };

describe('approval revocation contracts', () => {
  it('revoke-reason-empty rejects empty and whitespace-only reasons', () => {
    for (const reason of ['', ' \t\r\n ', '\n\n']) {
      expect(revokeApprovalRequestSchema.safeParse({ ...request, reason }).success).toBe(false);
    }
  });

  it('revoke-reason-limit normalizes line endings and counts Unicode code points', () => {
    const accepted = revokeApprovalRequestSchema.parse({ ...request, reason: '\ud83d\ude80'.repeat(1999) + '\r\n' });
    expect(accepted.reason).toBe('\ud83d\ude80'.repeat(1999) + '\n');
    expect(revokeApprovalRequestSchema.safeParse({ ...request, reason: '\ud83d\ude80'.repeat(2000) + '\r\n' }).success).toBe(false);
  });

  it('revoke-strict-body rejects extra fields and malformed scope, versions, context and key', () => {
    for (const body of [
      { ...request, actorId: 'reviewer-2' }, { ...request, state: 'APPROVED' },
      { ...request, expectedVersion: '5' }, { ...request, approvalId: '' },
      { ...request, candidateContext: {} },
      { ...request, candidateContext: { candidateId: 'candidate-1', expectedCandidateVersion: 0, members: [] } },
    ]) expect(revokeApprovalRequestSchema.safeParse(body).success).toBe(false);
    expect(reviewIdempotencyKeySchema.safeParse('bad key').success).toBe(false);
    expect(reviewIdempotencyKeySchema.safeParse('').success).toBe(false);
  });

  it('keeps Reviewer candidate projections member-scoped and strict', () => {
    expect(reviewerReleaseContextSchema.safeParse({ candidateId: 'candidate-1', candidateVersion: 3,
      ownInvalidApprovalBlocker: true, members: ['other-proposal'] }).success).toBe(false);
    expect(revokeApprovalResponseSchema.safeParse({ proposalId: 'proposal-1', revisionId: 'revision-1',
      assignmentId: 'assignment-1', state: 'IN_RELEASE', version: 6, assignmentVersion: 0,
      effectiveApproval: false, invalidation: { id: 'invalidation-1', proposalId: 'proposal-1',
        revisionId: 'revision-1', assignmentId: 'assignment-1', decisionId: 'approval-1',
        actor: { id: 'reviewer-1', username: 'reviewer1' }, mutationVersion: 6, cause: 'REVOKED',
        reason: 'No longer valid.', candidateId: 'candidate-1', createdAt: new Date().toISOString() },
      candidate: { id: 'candidate-1', version: 2, ownInvalidApprovalBlocker: true },
      aggregateReadiness: 'blocked' }).success).toBe(false);
  });

  it('release-version-plain enforces major.minor.patch and external versionLabel/rollbackNote', () => {
    const base = { versionLabel: '1.2.3', rollbackNote: 'Revert the synthetic release.', dependencyNotes: '' };
    expect(createReleaseCandidateRequestSchema.safeParse(base).success).toBe(true);
    for (const versionLabel of ['1.2.3-rc.1', '1.2.3+build', '01.2.3', '-1.2.3', '1.2']) {
      expect(createReleaseCandidateRequestSchema.safeParse({ ...base, versionLabel }).success).toBe(false);
    }
    expect(updateReleaseCandidateRequestSchema.safeParse({ ...base, expectedVersion: 2 }).success).toBe(true);
    expect(createReleaseCandidateRequestSchema.safeParse({ ...base, projectKey: 'injected-project' }).success).toBe(false);
    expect(createReleaseCandidateRequestSchema.safeParse({ semanticVersion: '1.2.3', rollbackPlan: 'Wrong fields', dependencyNotes: '' }).success).toBe(false);
  });

  it('release-member-server-approval rejects client approval assertions', () => {
    const member = { expectedCandidateVersion: 2, expectedContentVersion: 1, proposalId: 'proposal-1',
      revisionId: 'revision-1', assignmentId: 'assignment-1', expectedProposalVersion: 3,
      expectedAssignmentVersion: 0 };
    expect(addReleaseMemberRequestSchema.safeParse(member).success).toBe(true);
    expect(addReleaseMemberRequestSchema.safeParse({ ...member, approvalId: 'approval-1' }).success).toBe(false);
    expect(addReleaseMemberRequestSchema.safeParse({ ...member, expectedApprovalVersion: 3 }).success).toBe(false);
  });

  it('release-smoke-structured requires current version and bounded procedure/results', () => {
    const smoke = { expectedVersion: 3, testedContentVersion: 1, procedure: 'Run the release smoke test.',
      results: 'Passed with synthetic data.', outcome: 'PASS' };
    expect(appendReleaseSmokeTestRequestSchema.safeParse(smoke).success).toBe(true);
    for (const field of ['procedure', 'results'] as const) {
      expect(appendReleaseSmokeTestRequestSchema.safeParse({ ...smoke, [field]: '  ' }).success).toBe(false);
      expect(appendReleaseSmokeTestRequestSchema.safeParse({ ...smoke, [field]: 'x'.repeat(10_001) }).success).toBe(false);
    }
    expect(appendReleaseSmokeTestRequestSchema.safeParse({ ...smoke, note: 'old shape' }).success).toBe(false);
    expect(publishReleaseCandidateRequestSchema.safeParse({ expectedVersion: 3, expectedContentVersion: 1 }).success).toBe(true);
  });
});
