import {
  appendReleaseAnnotationRequestSchema,
  eligibleReleaseProposalsQuerySchema,
  eligibleReleaseProposalsResponseSchema,
  maintainerAuditQuerySchema,
  maintainerAuditResponseSchema,
  releaseCandidateDetailResponseSchema,
  releaseSmokeTestsQuerySchema,
  releaseSmokeTestsResponseSchema,
} from '@specsentry/shared';

const timestamp = '2026-11-06T00:00:00.000Z';

describe('final Maintainer contracts', () => {
  it('keeps eligible discovery strict, bounded and free of approval/private content', () => {
    expect(eligibleReleaseProposalsQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(eligibleReleaseProposalsQuerySchema.parse({ limit: '100' }).limit).toBe(100);
    for (const query of [{ limit: '0' }, { limit: '101' }, { limit: '1.5' }, { status: 'APPROVED' }]) {
      expect(eligibleReleaseProposalsQuerySchema.safeParse(query).success).toBe(false);
    }
    const item = { proposalId: 'proposal-one', title: 'Approved proposal',
      owner: { id: 'contributor-one', username: 'contributor' }, proposalVersion: 3,
      revisionId: 'revision-one', revisionNumber: 2, submittedAt: timestamp,
      assignmentId: 'assignment-one', assignmentVersion: 1,
      reviewer: { id: 'reviewer-one', username: 'reviewer' } };
    expect(eligibleReleaseProposalsResponseSchema.safeParse({ items: [item], nextCursor: null }).success).toBe(true);
    expect(eligibleReleaseProposalsResponseSchema.safeParse({ items: [{ ...item, approvalId: 'approval-one' }], nextCursor: null }).success).toBe(false);
    expect(eligibleReleaseProposalsResponseSchema.safeParse({ items: [{ ...item, diffText: 'private patch' }], nextCursor: null }).success).toBe(false);
  });

  it('binds released annotations to an exact version and snapshot with normalized bounded text', () => {
    expect(appendReleaseAnnotationRequestSchema.parse({ expectedVersion: 4, snapshotId: 'snapshot-one',
      text: 'Correction\r\nline' }).text).toBe('Correction\nline');
    for (const body of [
      { expectedVersion: 4, snapshotId: 'snapshot-one', text: '   ' },
      { expectedVersion: 4, snapshotId: 'snapshot-one', text: 'x'.repeat(2_001) },
      { expectedVersion: 4, snapshotId: 'snapshot-one', text: 'valid', actorId: 'injected' },
    ]) expect(appendReleaseAnnotationRequestSchema.safeParse(body).success).toBe(false);
  });

  it('bounds smoke history pages independently of constant-size candidate detail', () => {
    expect(releaseSmokeTestsQuerySchema.parse({})).toEqual({ limit: 5 });
    expect(releaseSmokeTestsQuerySchema.parse({ limit: '20' })).toEqual({ limit: 20 });
    expect(releaseSmokeTestsQuerySchema.safeParse({ limit: '21' }).success).toBe(false);
    const smoke = { id: 'smoke-one', testedContentVersion: 2, outcome: 'PASS',
      procedure: 'Run release checks', results: 'Passed', actorId: 'maintainer-one', createdAt: timestamp };
    expect(releaseSmokeTestsResponseSchema.safeParse({ items: [smoke], nextCursor: null,
      contentBytes: 24 }).success).toBe(true);
    expect(releaseSmokeTestsResponseSchema.safeParse({ items: [smoke], nextCursor: null,
      contentBytes: 262_145 }).success).toBe(false);
  });

  it('accepts only AND-filterable audit queries with valid date ordering', () => {
    expect(maintainerAuditQuerySchema.safeParse({ actorId: 'maintainer-one', releaseId: 'candidate-one',
      action: 'RELEASE_PUBLISHED', outcome: 'SUCCESS', from: '2026-11-01T00:00:00.000Z',
      to: timestamp, limit: '20' }).success).toBe(true);
    expect(maintainerAuditQuerySchema.safeParse({ from: timestamp, to: '2026-11-01T00:00:00.000Z' }).success).toBe(false);
    expect(maintainerAuditQuerySchema.safeParse({ action: 'release published' }).success).toBe(false);
    expect(maintainerAuditQuerySchema.safeParse({ includeRawPrompts: 'true' }).success).toBe(false);
  });

  it('keeps restricted audit output allowlisted and rejects raw/provider fields', () => {
    const item = { id: 'request-one', source: 'AI', actorId: 'reviewer-one', proposalId: 'proposal-one',
      releaseId: null, target: 'proposal-one', action: 'AI_REVIEWER', outcome: 'SUCCESS', timestamp,
      summary: null, reason: null, aiMetadata: { templateVersion: 'reviewer-risk-v1', contextHash: null,
        errorClass: null, latencyMs: 20, attemptCount: 1 } };
    expect(maintainerAuditResponseSchema.safeParse({ items: [item], nextCursor: null }).success).toBe(true);
    expect(maintainerAuditResponseSchema.safeParse({ items: [{ ...item, rawPrompt: 'secret' }], nextCursor: null }).success).toBe(false);
    expect(maintainerAuditResponseSchema.safeParse({ items: [{ ...item, providerResponse: '{}' }], nextCursor: null }).success).toBe(false);
  });

  it('projects safe member/publication/notice coordinates without approval IDs or snapshot evidence', () => {
    const detail = { id: 'candidate-one', projectKey: 'specsentry', createdById: 'maintainer-one', status: 'RELEASED',
      versionLabel: '1.0.0', rollbackNote: 'Restore previous image', dependencyNotes: '', version: 4, contentVersion: 1,
      members: [{ id: 'member-one', proposalId: 'proposal-one', proposalTitle: 'Approved proposal', proposalVersion: 4,
        revisionId: 'revision-one', revisionNumber: 2, assignmentId: 'assignment-one', status: 'RELEASED',
        attachedAt: timestamp, removedAt: null }], smokeTests: [], blockers: [], publishedAt: timestamp,
      publication: { snapshotId: 'snapshot-one', actorId: 'maintainer-one', candidateVersion: 3,
        contentVersion: 1, createdAt: timestamp }, unreadRevocationNotices: [], unreadRevocationNoticesTruncated: false };
    expect(releaseCandidateDetailResponseSchema.safeParse(detail).success).toBe(true);
    expect(releaseCandidateDetailResponseSchema.safeParse({ ...detail,
      members: [{ ...detail.members[0], approvalId: 'approval-one' }] }).success).toBe(false);
    expect(releaseCandidateDetailResponseSchema.safeParse({ ...detail,
      publication: { ...detail.publication, evidence: { idempotency: 'secret' } } }).success).toBe(false);
  });
});
