import { randomUUID } from 'node:crypto';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { RELEASE_PROJECT_KEY, lockReleaseCandidates, lockReleaseProposals } from '../src/releases/release-locks';

const businessTables = '"ReleasePublicationSnapshot", "ReleaseSmokeTest", "ReleaseCandidateMember", "Notification", "ApprovalInvalidation", "ReleaseCandidate", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"';

describe('release and approval revocation foundation', () => {
  let db: DatabaseService;
  const prefix = `foundation-${randomUUID()}`;
  const ids: string[] = [];
  let ownerId: string;
  let reviewerId: string;
  let maintainerId: string;

  async function clean() { await db.client.$executeRawUnsafe(`TRUNCATE ${businessTables}`); }
  async function approved(label: string) {
    const proposalId = `${prefix}-${label}`;
    const revisionId = `${proposalId}-r1`;
    return db.client.$transaction(async tx => {
      await tx.changeProposal.create({ data: { id: proposalId, ownerId, title: 'Synthetic approval', state: 'APPROVED', version: 2 } });
      await tx.proposalRevision.create({ data: { id: revisionId, proposalId, number: 1, summary: 'Synthetic summary',
        problem: 'Synthetic problem', constraints: '', expectedBehavior: 'Synthetic result', diffText: '' } });
      const assignment = await tx.reviewAssignment.create({ data: { proposalId, revisionId, reviewerId } });
      await tx.changeProposal.update({ where: { id: proposalId }, data: { currentRevisionId: revisionId,
        currentAssignmentId: assignment.id } });
      const approval = await tx.reviewDecision.create({ data: { proposalId, revisionId, assignmentId: assignment.id,
        actorId: reviewerId, decision: 'APPROVE', mutationVersion: 2 } });
      return { proposalId, revisionId, assignmentId: assignment.id, approvalId: approval.id };
    });
  }

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL is required');
    db = new DatabaseService(readConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL,
      SESSION_SECRET: 'release-foundation-test-secret-at-least-32' }));
    await clean();
    for (const role of ['CONTRIBUTOR', 'REVIEWER', 'RELEASE_MAINTAINER'] as const) {
      const account = await db.client.userAccount.create({ data: { username: `${prefix}-${role.toLowerCase()}`, role,
        passwordHash: 'synthetic-hash' } });
      ids.push(account.id);
      if (role === 'CONTRIBUTOR') ownerId = account.id;
      if (role === 'REVIEWER') reviewerId = account.id;
      if (role === 'RELEASE_MAINTAINER') maintainerId = account.id;
    }
  });
  afterAll(async () => {
    if (!db) return;
    await clean();
    await db.client.userAccount.deleteMany({ where: { id: { in: ids } } });
    await db.onModuleDestroy();
  });

  it('revoke-foundation-provenance preserves owner reopening and constrains exact revocation scope', async () => {
    const reopened = await approved('reopened');
    const old = await db.client.approvalInvalidation.create({ data: { proposalId: reopened.proposalId,
      revisionId: reopened.revisionId, assignmentId: reopened.assignmentId, decisionId: reopened.approvalId,
      actorId: ownerId, mutationVersion: 3 } });
    expect(old).toMatchObject({ cause: 'REOPENED', reason: null, candidateId: null });
    await expect(db.client.approvalInvalidation.update({ where: { id: old.id }, data: { cause: 'REVOKED' } })).rejects.toThrow();

    const attached = await approved('attached');
    const candidate = await db.client.releaseCandidate.create({ data: { projectKey: RELEASE_PROJECT_KEY,
      semanticVersion: '1.0.0', createdById: maintainerId, rollbackPlan: 'Revert this synthetic release.', dependencyNotes: '' } });
    await db.client.releaseCandidateMember.create({ data: { candidateId: candidate.id, proposalId: attached.proposalId,
      revisionId: attached.revisionId, assignmentId: attached.assignmentId, approvalId: attached.approvalId } });
    const alien = await approved('alien');
    await expect(db.client.approvalInvalidation.create({ data: { proposalId: alien.proposalId,
      revisionId: alien.revisionId, assignmentId: alien.assignmentId, decisionId: alien.approvalId,
      actorId: reviewerId, mutationVersion: 4, cause: 'REVOKED', reason: 'Wrong member.', candidateId: candidate.id } })).rejects.toThrow();
    const revocation = await db.client.approvalInvalidation.create({ data: { proposalId: attached.proposalId,
      revisionId: attached.revisionId, assignmentId: attached.assignmentId, decisionId: attached.approvalId,
      actorId: reviewerId, mutationVersion: 3, cause: 'REVOKED', reason: 'Synthetic reason.', candidateId: candidate.id } });
    expect(revocation).toMatchObject({ cause: 'REVOKED', candidateId: candidate.id, reason: 'Synthetic reason.' });
    await expect(db.client.approvalInvalidation.delete({ where: { id: revocation.id } })).rejects.toThrow();
    await expect(db.client.releaseCandidate.update({ where: { id: candidate.id }, data: { createdById: reviewerId } })).rejects.toThrow();
  });

  it('revoke-foundation-fixture keeps synthetic markers separate and cleans new foreign keys', async () => {
    const graph = await approved('fixture');
    await db.client.changeProposal.update({ where: { id: graph.proposalId }, data: { releaseAttachmentRef: 'synthetic-candidate' } });
    expect(await db.client.releaseCandidateMember.count({ where: { proposalId: graph.proposalId } })).toBe(0);
    const candidate = await db.client.releaseCandidate.create({ data: { projectKey: RELEASE_PROJECT_KEY,
      semanticVersion: '2.0.0', createdById: maintainerId, rollbackPlan: 'Revert.', dependencyNotes: '' } });
    const member = await db.client.releaseCandidateMember.create({ data: { candidateId: candidate.id,
      proposalId: graph.proposalId, revisionId: graph.revisionId, assignmentId: graph.assignmentId,
      approvalId: graph.approvalId } });
    const smoke = await db.client.releaseSmokeTest.create({ data: { candidateId: candidate.id,
      testedContentVersion: 0, outcome: 'PASS', procedure: 'Run the synthetic smoke case.',
      results: 'Synthetic pass.', actorId: maintainerId } });
    expect(smoke.candidateId).toBe(candidate.id);
    await db.client.releaseCandidateMember.update({ where: { id: member.id }, data: { status: 'RELEASED' } });
    await db.client.releaseCandidate.update({ where: { id: candidate.id }, data: { status: 'RELEASED', publishedAt: new Date() } });
    await db.client.releasePublicationSnapshot.create({ data: { candidateId: candidate.id,
      actorId: maintainerId, candidateVersion: 1, contentVersion: 0, evidence: { memberIds: [member.id] } } });
    const locked = await db.client.$transaction(async tx => ({ candidates: await lockReleaseCandidates(tx, [candidate.id]),
      proposals: await lockReleaseProposals(tx, [graph.proposalId]) }));
    expect(locked.candidates).toHaveLength(1);
    expect(locked.proposals).toHaveLength(1);
    await clean();
    await clean();
    expect(await db.client.releaseCandidate.count()).toBe(0);
    expect(await db.client.releaseCandidateMember.count()).toBe(0);
    expect(await db.client.releaseSmokeTest.count()).toBe(0);
    expect(await db.client.releasePublicationSnapshot.count()).toBe(0);
  });
});
