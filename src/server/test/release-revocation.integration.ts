import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { readConfig } from '../src/config';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { ActivityModule } from '../src/activity/activity.module';
import { ProposalsCoreModule } from '../src/proposals/proposals-core.module';
import { NotificationsModule } from '../src/notifications/notifications.module';
import { NotificationsService } from '../src/notifications/notifications.service';
import { ReleasesModule } from '../src/releases/releases.module';
import { ReleasesService } from '../src/releases/releases.service';
import { ApprovalRevocationService } from '../src/reviews/approval-revocation.service';
import { persistedTestActor } from './business-fixtures';

const tables = '"ReleasePublicationSnapshot", "ReleaseSmokeTest", "ReleaseCandidateMember", "Notification", "ApprovalInvalidation", "ReleaseCandidate", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"';
const prefix = `release-${randomUUID()}`;
const ids = { owner: `${prefix}-owner`, reviewer: `${prefix}-reviewer`, otherReviewer: `${prefix}-other-reviewer`,
  maintainer: `${prefix}-maintainer`, otherMaintainer: `${prefix}-other-maintainer` };
type Actor = Awaited<ReturnType<typeof persistedTestActor>>;

describe('PostgreSQL release candidate and revocation integration', () => {
  let db: DatabaseService; let releases: ReleasesService; let notices: NotificationsService;
  let revocation: ApprovalRevocationService; let module: TestingModule;
  let reviewer: Actor; let maintainer: Actor; let otherMaintainer: Actor;
  async function seed(approved = true, assignedReviewerId = ids.reviewer) {
    return db.client.$transaction(async tx => {
    const proposal = await tx.changeProposal.create({ data: { ownerId: ids.owner, title: 'Synthetic release item',
      state: approved ? 'APPROVED' : 'IN_REVIEW', version: 3 } });
    const revision = await tx.proposalRevision.create({ data: { proposalId: proposal.id, number: 1,
      summary: 'Summary', problem: 'Problem', constraints: '', expectedBehavior: 'Works', diffText: '+safe' } });
    const assignment = await tx.reviewAssignment.create({ data: { proposalId: proposal.id,
      revisionId: revision.id, reviewerId: assignedReviewerId, version: 0 } });
    await tx.changeProposal.update({ where: { id: proposal.id }, data: { currentRevisionId: revision.id,
      currentAssignmentId: assignment.id } });
    const criterion = await tx.acceptanceCriterion.create({ data: { revisionId: revision.id,
      stableKey: 'required', statement: 'Required check', required: true } });
    await tx.coverageAssessment.create({ data: { proposalId: proposal.id, revisionId: revision.id,
      assignmentId: assignment.id, criterionId: criterion.id, actorId: assignedReviewerId,
      status: 'COVERED', mutationVersion: 1 } });
    const decision = approved ? await tx.reviewDecision.create({ data: { proposalId: proposal.id,
      revisionId: revision.id, assignmentId: assignment.id, actorId: assignedReviewerId,
      decision: 'APPROVE', mutationVersion: 3 } }) : null;
    return { proposal, revision, assignment, decision };
    });
  }
  async function candidate() {
    return releases.create(maintainer, { versionLabel: `1.0.${Math.floor(Math.random() * 1000000)}`,
      rollbackNote: 'Restore previous deployment', dependencyNotes: '' });
  }
  async function attached() {
    const item = await seed(); const created = await candidate();
    const added = await releases.add(maintainer, created.candidateId, { expectedCandidateVersion: created.version,
      expectedContentVersion: created.contentVersion, proposalId: item.proposal.id,
      revisionId: item.revision.id, assignmentId: item.assignment.id,
      expectedProposalVersion: item.proposal.version, expectedAssignmentVersion: item.assignment.version });
    const detail = await releases.detail(maintainer, created.candidateId) as { members: { id: string }[] };
    return { item, created, added, memberId: detail.members[0]!.id };
  }
  async function revoke(c: Awaited<ReturnType<typeof attached>>, key = randomUUID()) {
    const root = await db.client.changeProposal.findUniqueOrThrow({ where: { id: c.item.proposal.id } });
    const candidate = await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: c.created.candidateId } });
    return revocation.revoke(reviewer, root.id, { expectedVersion: root.version,
      revisionId: c.item.revision.id, assignmentId: c.item.assignment.id,
      expectedAssignmentVersion: c.item.assignment.version, approvalId: c.item.decision!.id,
      expectedApprovalVersion: c.item.decision!.mutationVersion, reason: 'Human approval revoked',
      candidateContext: { candidateId: candidate.id, expectedCandidateVersion: candidate.version } }, key);
  }
  async function snapshot(c: Awaited<ReturnType<typeof attached>>) {
    return { proposal: await db.client.changeProposal.findUniqueOrThrow({ where: { id: c.item.proposal.id } }),
      candidate: await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: c.created.candidateId } }),
      members: await db.client.releaseCandidateMember.findMany({ where: { candidateId: c.created.candidateId } }),
      invalidations: await db.client.approvalInvalidation.findMany({ where: { proposalId: c.item.proposal.id } }),
      notices: await db.client.notification.findMany({ where: { candidateId: c.created.candidateId } }),
      activities: await db.client.proposalActivity.findMany({ where: { proposalId: c.item.proposal.id } }),
      publication: await db.client.releasePublicationSnapshot.findUnique({ where: { candidateId: c.created.candidateId } }) };
  }
  async function ready(c: Awaited<ReturnType<typeof attached>>) {
    const current = await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: c.created.candidateId } });
    await releases.smoke(maintainer, current.id, { expectedVersion: current.version,
      testedContentVersion: current.contentVersion, procedure: 'Run release smoke', results: 'Passed', outcome: 'PASS' });
    const candidate = await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: current.id } });
    expect((await releases.detail(maintainer, candidate.id) as { blockers: unknown[] }).blockers).toEqual([]);
    return candidate;
  }
  async function publicationState(candidateId: string) {
    const members = await db.client.releaseCandidateMember.findMany({ where: { candidateId }, orderBy: { proposalId: 'asc' } });
    const proposalIds = members.map(member => member.proposalId);
    return {
      candidate: await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: candidateId } }),
      members,
      proposals: await db.client.changeProposal.findMany({ where: { id: { in: proposalIds } }, orderBy: { id: 'asc' } }),
      publication: await db.client.releasePublicationSnapshot.findUnique({ where: { candidateId } }),
      activities: await db.client.proposalActivity.findMany({ where: { proposalId: { in: proposalIds } }, orderBy: { id: 'asc' } }),
      decisions: await db.client.reviewDecision.findMany({ where: { proposalId: { in: proposalIds } }, orderBy: { id: 'asc' } }),
      invalidations: await db.client.approvalInvalidation.findMany({ where: { proposalId: { in: proposalIds } }, orderBy: { id: 'asc' } }),
      notices: await db.client.notification.findMany({ where: { candidateId }, orderBy: { id: 'asc' } }),
    };
  }
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL required');
    const config = readConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL,
      SESSION_SECRET: 'release-test-secret-at-least-32-characters' });
    const builder = Test.createTestingModule({ imports: [DatabaseModule.register(config), ActivityModule,
      ProposalsCoreModule, NotificationsModule.register(config), ReleasesModule.register(config)],
      providers: [ApprovalRevocationService] });
    module = await builder.compile(); db = module.get(DatabaseService); releases = module.get(ReleasesService);
    notices = module.get(NotificationsService); revocation = module.get(ApprovalRevocationService);
    await db.client.userAccount.createMany({ data: Object.entries(ids).map(([name, id]) => ({ id,
      username: `${prefix}-${name}`.toLowerCase(), passwordHash: 'synthetic-only',
      role: name === 'owner' ? 'CONTRIBUTOR' as const : name.toLowerCase().includes('reviewer')
        ? 'REVIEWER' as const : 'RELEASE_MAINTAINER' as const })) });
  });
  beforeEach(async () => {
    await db.client.$executeRawUnsafe(`TRUNCATE ${tables}`);
    await db.client.authSession.deleteMany({ where: { data: { contains: prefix } } });
    await db.client.userAccount.updateMany({ where: { id: { in: Object.values(ids) } }, data: { enabled: true, version: 1 } });
    reviewer = await persistedTestActor(db, ids.reviewer);
    maintainer = await persistedTestActor(db, ids.maintainer); otherMaintainer = await persistedTestActor(db, ids.otherMaintainer);
  });
  afterAll(async () => {
    if (db) {
      await db.client.$executeRawUnsafe(`TRUNCATE ${tables}`);
      await db.client.authSession.deleteMany({ where: { data: { contains: prefix } } });
      await db.client.securityEvent.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
      await db.client.userAccount.deleteMany({ where: { id: { in: Object.values(ids) } } });
    }
    await module?.close();
  });

  it('revoke-attached-freeze and revoke-attached preserve the member while invalidating approval', async () => {
    const c = await attached(); const before = await snapshot(c); await revoke(c); const after = await snapshot(c);
    expect(after.proposal.state).toBe('IN_RELEASE'); expect(after.members[0]).toMatchObject({ status: 'ATTACHED', id: c.memberId });
    expect(after.candidate.version).toBe(before.candidate.version + 1);
    expect(after.candidate.contentVersion).toBe(before.candidate.contentVersion);
    expect(after.invalidations).toHaveLength(1); expect(after.notices).toHaveLength(1);
    expect(after.notices[0]).toMatchObject({ kind: 'APPROVAL_REVOKED', recipientId: ids.maintainer,
      reviewerId: ids.reviewer, candidateId: c.created.candidateId, reason: 'Human approval revoked' });
    expect(after.activities.map(a => a.action)).toEqual(['RELEASE_ATTACHED', 'APPROVAL_REVOKED', 'NOTIFICATION_CREATED']);
  });
  it('revoke-readiness blocks publication with no snapshot', async () => {
    const c = await attached(); await revoke(c);
    const detail = await releases.detail(maintainer, c.created.candidateId) as { blockers: { code: string }[] };
    expect(detail.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'APPROVAL' })]));
    const before = await snapshot(c);
    await expect(releases.publish(maintainer, c.created.candidateId, { expectedVersion: before.candidate.version,
      expectedContentVersion: before.candidate.contentVersion }, randomUUID())).rejects.toMatchObject({ status: 409 });
    expect((await snapshot(c)).publication).toBeNull();
  });
  it('revoke-notice-ack and revoke-notice-get require explicit acknowledgement without clearing blockers', async () => {
    const c = await attached(); await revoke(c); const before = await snapshot(c);
    await releases.detail(maintainer, c.created.candidateId);
    expect((await snapshot(c)).notices[0]!.readAt).toBeNull();
    const listed = await notices.list(maintainer, { limit: 20 }); const item = listed.items.find(n => n.kind === 'APPROVAL_REVOKED');
    expect(item).toBeDefined();
    const ack = await notices.acknowledge(maintainer, item!.id, { kind: 'APPROVAL_REVOKED',
      candidateId: c.created.candidateId, invalidationId: before.invalidations[0]!.id });
    expect(ack.readAt).toEqual(expect.any(String));
    const after = await snapshot(c); expect(after.notices[0]!.readAt).toBeTruthy();
    expect(after.invalidations).toEqual(before.invalidations); expect(after.candidate).toEqual(before.candidate);
    expect(after.members).toEqual(before.members);
  });
  it('revoke-notice-scope and revoke-notice-csrf enforce creator recipient and session', async () => {
    const c = await attached(); await revoke(c); const n = (await snapshot(c)).notices[0]!;
    expect((await notices.list(otherMaintainer, { limit: 20 })).items).toEqual([]);
    await expect(notices.acknowledge(otherMaintainer, n.id, { kind: 'APPROVAL_REVOKED',
      candidateId: c.created.candidateId, invalidationId: n.invalidationId! })).rejects.toMatchObject({ status: 404 });
    await expect(notices.acknowledge({ ...maintainer, session: { ...maintainer.session!, csrfToken: '0'.repeat(64) } }, n.id,
      { kind: 'APPROVAL_REVOKED', candidateId: c.created.candidateId, invalidationId: n.invalidationId! }))
      .rejects.toMatchObject({ status: 401 });
    expect((await snapshot(c)).notices[0]!.readAt).toBeNull();
  });
  it('revoke-remove advances content and changes proposal state, preserving notice', async () => {
    const c = await attached(); await revoke(c); const before = await snapshot(c);
    await releases.remove(maintainer, c.created.candidateId, { expectedCandidateVersion: before.candidate.version,
      expectedContentVersion: before.candidate.contentVersion, memberId: c.memberId,
      expectedProposalVersion: before.proposal.version });
    const after = await snapshot(c); expect(after.members[0]!.status).toBe('REMOVED');
    expect(after.proposal).toMatchObject({ state: 'CHANGES_REQUESTED', releaseAttachmentRef: null });
    expect(after.candidate.contentVersion).toBe(before.candidate.contentVersion + 1);
    expect(after.notices).toEqual(before.notices); expect(after.invalidations).toEqual(before.invalidations);
  });
  it('release-ownership rejects every creator-only operation', async () => {
    const c = await attached(); const before = await snapshot(c); const extra = await seed();
    const extraBefore = await db.client.changeProposal.findUniqueOrThrow({ where: { id: extra.proposal.id } });
    const operations = [
      () => releases.add(otherMaintainer, c.created.candidateId, { expectedCandidateVersion: before.candidate.version,
        expectedContentVersion: before.candidate.contentVersion, proposalId: extra.proposal.id,
        revisionId: extra.revision.id, assignmentId: extra.assignment.id,
        expectedProposalVersion: extra.proposal.version, expectedAssignmentVersion: extra.assignment.version }),
      () => releases.edit(otherMaintainer, c.created.candidateId, { expectedVersion: before.candidate.version,
        versionLabel: '2.0.0', rollbackNote: 'rollback', dependencyNotes: '' }),
      () => releases.smoke(otherMaintainer, c.created.candidateId, { expectedVersion: before.candidate.version,
        testedContentVersion: before.candidate.contentVersion, procedure: 'run', results: 'pass', outcome: 'PASS' }),
      () => releases.remove(otherMaintainer, c.created.candidateId, { expectedCandidateVersion: before.candidate.version,
        expectedContentVersion: before.candidate.contentVersion, memberId: c.memberId, expectedProposalVersion: before.proposal.version }),
      () => releases.publish(otherMaintainer, c.created.candidateId, { expectedVersion: before.candidate.version,
        expectedContentVersion: before.candidate.contentVersion }, randomUUID()),
    ];
    for (const operation of operations) await expect(operation()).rejects.toMatchObject({ status: 403 });
    expect(await snapshot(c)).toEqual(before);
    expect(await db.client.changeProposal.findUniqueOrThrow({ where: { id: extra.proposal.id } })).toEqual(extraBefore);
  });
  it('release-gates reject empty, no smoke, and a real content change after smoke', async () => {
    const empty = await candidate();
    await expect(releases.publish(maintainer, empty.candidateId, { expectedVersion: empty.version,
      expectedContentVersion: empty.contentVersion }, randomUUID())).rejects.toMatchObject({ status: 409 });
    const c = await attached(); const before = await snapshot(c);
    expect((await releases.detail(maintainer, c.created.candidateId) as { blockers: { code: string }[] }).blockers)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SMOKE' })]));
    await expect(releases.publish(maintainer, c.created.candidateId, { expectedVersion: before.candidate.version,
      expectedContentVersion: before.candidate.contentVersion }, randomUUID())).rejects.toMatchObject({ status: 409 });
    await releases.smoke(maintainer, c.created.candidateId, { expectedVersion: before.candidate.version,
      testedContentVersion: before.candidate.contentVersion, procedure: 'run', results: 'pass', outcome: 'PASS' });
    const extra = await seed();
    const smoked = await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: c.created.candidateId } });
    await releases.add(maintainer, c.created.candidateId, { expectedCandidateVersion: smoked.version,
      expectedContentVersion: smoked.contentVersion, proposalId: extra.proposal.id,
      revisionId: extra.revision.id, assignmentId: extra.assignment.id,
      expectedProposalVersion: extra.proposal.version, expectedAssignmentVersion: extra.assignment.version });
    const changed = await snapshot(c);
    expect(changed.candidate.contentVersion).toBe(before.candidate.contentVersion + 1);
    expect((await releases.detail(maintainer, c.created.candidateId) as { blockers: { code: string }[] }).blockers)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SMOKE' })]));
    const beforePublish = await publicationState(c.created.candidateId);
    await expect(releases.publish(maintainer, c.created.candidateId, { expectedVersion: changed.candidate.version,
      expectedContentVersion: changed.candidate.contentVersion }, randomUUID())).rejects.toMatchObject({ status: 409 });
    expect(await publicationState(c.created.candidateId)).toEqual(beforePublish);
  });
  it('release-gates publish a ready candidate with durable member evidence', async () => {
    const c = await attached(); const candidate = await ready(c);
    const published = await releases.publish(maintainer, candidate.id, { expectedVersion: candidate.version,
      expectedContentVersion: candidate.contentVersion }, randomUUID());
    const state = await publicationState(candidate.id);
    expect(published.status).toBe('RELEASED');
    expect(state.candidate.status).toBe('RELEASED');
    expect(state.members).toEqual([expect.objectContaining({ status: 'RELEASED' })]);
    expect(state.proposals).toEqual([expect.objectContaining({ state: 'RELEASED' })]);
    expect(state.publication).toMatchObject({ id: published.snapshotId, candidateId: candidate.id });
  });
  it.each([
    ['COVERAGE', async (c: Awaited<ReturnType<typeof attached>>) => {
      const criterion = await db.client.acceptanceCriterion.findFirstOrThrow({ where: { revisionId: c.item.revision.id } });
      await db.client.coverageAssessment.create({ data: { proposalId: c.item.proposal.id,
        revisionId: c.item.revision.id, assignmentId: c.item.assignment.id, criterionId: criterion.id,
        actorId: ids.reviewer, status: 'PARTIALLY_COVERED', rationale: 'Coverage is incomplete', mutationVersion: 4 } });
    }],
    ['REVISION', async (c: Awaited<ReturnType<typeof attached>>) => {
      await db.client.$transaction(async tx => {
        const other = await tx.proposalRevision.create({ data: { proposalId: c.item.proposal.id, number: 2,
          summary: 'Later submitted revision', problem: 'Problem', constraints: '', expectedBehavior: 'Works', diffText: '+later' } });
        await tx.reviewAssignment.update({ where: { id: c.item.assignment.id }, data: {
          status: 'CLOSED', endReason: 'REVISION_REPLACED', endedAt: new Date(), version: { increment: 1 } } });
        const assignment = await tx.reviewAssignment.create({ data: { proposalId: c.item.proposal.id,
          revisionId: other.id, reviewerId: ids.reviewer } });
        await tx.changeProposal.update({ where: { id: c.item.proposal.id }, data: {
          currentRevisionId: other.id, currentAssignmentId: assignment.id } });
      });
    }],
  ] as const)('release-gates isolate %s from an otherwise ready candidate', async (code, mutate) => {
    const c = await attached(); const candidate = await ready(c); await mutate(c);
    const detail = await releases.detail(maintainer, candidate.id) as { blockers: { code: string }[] };
    expect(detail.blockers.map(blocker => blocker.code)).toEqual([code]);
    const before = await publicationState(candidate.id);
    await expect(releases.publish(maintainer, candidate.id, { expectedVersion: candidate.version,
      expectedContentVersion: candidate.contentVersion }, randomUUID())).rejects.toMatchObject({ status: 409 });
    expect(await publicationState(candidate.id)).toEqual(before);
  });
  it('release-gates reject removal of the required rollback plan at persistence', async () => {
    const c = await attached(); const candidate = await ready(c);
    const before = await publicationState(candidate.id);
    await expect(db.client.releaseCandidate.update({ where: { id: candidate.id }, data: { rollbackPlan: ' ' } }))
      .rejects.toThrow(/ReleaseCandidate_notes_limit/);
    expect(await publicationState(candidate.id)).toEqual(before);
  });
  it.each(['HIGH', 'CRITICAL'] as const)('release-gates isolate unresolved %s finding', async severity => {
    const c = await attached(); const candidate = await ready(c);
    await db.client.reviewFinding.create({ data: { proposalId: c.item.proposal.id, revisionId: c.item.revision.id,
      assignmentId: c.item.assignment.id, actorId: ids.reviewer, severity,
      description: 'Unresolved release risk', mutationVersion: 4 } });
    const detail = await releases.detail(maintainer, candidate.id) as { blockers: { code: string }[] };
    expect(detail.blockers.map(blocker => blocker.code)).toEqual(['FINDING']);
    const before = await publicationState(candidate.id);
    await expect(releases.publish(maintainer, candidate.id, { expectedVersion: candidate.version,
      expectedContentVersion: candidate.contentVersion }, randomUUID())).rejects.toMatchObject({ status: 409 });
    expect(await publicationState(candidate.id)).toEqual(before);
  });
  it('release-gates reject a duplicate semantic version before publication', async () => {
    const first = await attached(); const firstCandidate = await ready(first);
    const second = await attached(); const secondCandidate = await ready(second);
    const before = await publicationState(secondCandidate.id);
    await expect(releases.edit(maintainer, secondCandidate.id, { expectedVersion: secondCandidate.version,
      versionLabel: firstCandidate.semanticVersion, rollbackNote: secondCandidate.rollbackPlan,
      dependencyNotes: secondCandidate.dependencyNotes })).rejects.toMatchObject({ status: 409 });
    expect(await publicationState(secondCandidate.id)).toEqual(before);
    expect((await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: firstCandidate.id } })).semanticVersion)
      .toBe(firstCandidate.semanticVersion);
  });
  it('revoke-rollback leaves no business fragments when revocation activity append fails', async () => {
    const c = await attached(); const before = await snapshot(c);
    const name = `release_fail_${randomUUID().replace(/-/g, '')}`;
    await db.client.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''synthetic release activity failure''; END'`);
    try {
      await db.client.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE INSERT ON "ProposalActivity" FOR EACH ROW EXECUTE FUNCTION "${name}"()`);
      try { await expect(revoke(c)).rejects.toThrow(); }
      finally { await db.client.$executeRawUnsafe(`DROP TRIGGER "${name}" ON "ProposalActivity"`); }
    } finally { await db.client.$executeRawUnsafe(`DROP FUNCTION "${name}"()`); }
    expect(await snapshot(c)).toEqual(before);
  });
  it('release-rollback restores both members and publication evidence after a late publish failure', async () => {
    const c = await attached(); const extra = await seed();
    const current = await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: c.created.candidateId } });
    await releases.add(maintainer, current.id, { expectedCandidateVersion: current.version,
      expectedContentVersion: current.contentVersion, proposalId: extra.proposal.id,
      revisionId: extra.revision.id, assignmentId: extra.assignment.id,
      expectedProposalVersion: extra.proposal.version, expectedAssignmentVersion: extra.assignment.version });
    const candidate = await ready(c); const before = await publicationState(candidate.id);
    expect(before.members).toHaveLength(2);
    const secondProposalId = before.members[1]!.proposalId;
    const name = `publish_fail_${randomUUID().replace(/-/g, '')}`;
    await db.client.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''synthetic late publication failure''; END'`);
    try {
      await db.client.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE INSERT ON "ProposalActivity" FOR EACH ROW WHEN (NEW."proposalId" = '${secondProposalId}' AND NEW.action::text = 'RELEASE_PUBLISHED') EXECUTE FUNCTION "${name}"()`);
      try {
        await expect(releases.publish(maintainer, candidate.id, { expectedVersion: candidate.version,
          expectedContentVersion: candidate.contentVersion }, randomUUID())).rejects.toThrow();
      } finally { await db.client.$executeRawUnsafe(`DROP TRIGGER "${name}" ON "ProposalActivity"`); }
    } finally { await db.client.$executeRawUnsafe(`DROP FUNCTION "${name}"()`); }
    expect(await publicationState(candidate.id)).toEqual(before);
  });
  it('release-gates retain completed approval after original Reviewer disablement', async () => {
    const c = await attached(); const before = await snapshot(c);
    const smoked = await releases.smoke(maintainer, c.created.candidateId, { expectedVersion: before.candidate.version,
      testedContentVersion: before.candidate.contentVersion, procedure: 'Execute release smoke',
      results: 'All checks passed', outcome: 'PASS' });
    await db.client.userAccount.update({ where: { id: ids.reviewer }, data: { enabled: false, version: { increment: 1 } } });
    const published = await releases.publish(maintainer, c.created.candidateId, { expectedVersion: smoked.version,
      expectedContentVersion: smoked.contentVersion }, randomUUID());
    expect(published.status).toBe('RELEASED');
    const after = await snapshot(c); expect(after.publication).toBeDefined();
    expect(after.proposal.state).toBe('RELEASED'); expect(after.invalidations).toEqual([]);
  });
  it('revoke-candidate-privacy projects only own member scope', async () => {
    const c = await attached(); const other = await persistedTestActor(db, ids.otherReviewer);
    await expect(releases.detail(other, c.created.candidateId)).rejects.toMatchObject({ status: 403 });
    const b = await seed(true, ids.otherReviewer);
    const current = await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: c.created.candidateId } });
    await releases.add(maintainer, c.created.candidateId, { expectedCandidateVersion: current.version,
      expectedContentVersion: current.contentVersion, proposalId: b.proposal.id,
      revisionId: b.revision.id, assignmentId: b.assignment.id,
      expectedProposalVersion: b.proposal.version, expectedAssignmentVersion: b.assignment.version });
    const visible = await releases.detail(reviewer, c.created.candidateId);
    const afterAdd = await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: c.created.candidateId } });
    expect(visible).toEqual({ candidateId: c.created.candidateId, candidateVersion: afterAdd.version,
      ownInvalidApprovalBlocker: false });
    expect(JSON.stringify(visible)).not.toContain(b.proposal.id);
    expect(JSON.stringify(visible)).not.toContain('rollback');
    const bRoot = await db.client.changeProposal.findUniqueOrThrow({ where: { id: b.proposal.id } });
    await revocation.revoke(other, b.proposal.id, { expectedVersion: bRoot.version,
      revisionId: b.revision.id, assignmentId: b.assignment.id, expectedAssignmentVersion: b.assignment.version,
      approvalId: b.decision!.id, expectedApprovalVersion: b.decision!.mutationVersion,
      reason: 'B revoked', candidateContext: { candidateId: c.created.candidateId,
        expectedCandidateVersion: afterAdd.version } }, randomUUID());
    const aView = await releases.detail(reviewer, c.created.candidateId);
    const bView = await releases.detail(other, c.created.candidateId);
    expect(aView).toMatchObject({ ownInvalidApprovalBlocker: false });
    expect(bView).toMatchObject({ ownInvalidApprovalBlocker: true });
    expect(JSON.stringify(aView)).not.toContain(b.proposal.id);
    const aRoot = await db.client.changeProposal.findUniqueOrThrow({ where: { id: c.item.proposal.id } });
    const beforeARevoke = await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: c.created.candidateId } });
    const key = randomUUID(); const body = { expectedVersion: aRoot.version, revisionId: c.item.revision.id,
      assignmentId: c.item.assignment.id, expectedAssignmentVersion: c.item.assignment.version,
      approvalId: c.item.decision!.id, expectedApprovalVersion: c.item.decision!.mutationVersion,
      reason: 'A revoked', candidateContext: { candidateId: c.created.candidateId,
        expectedCandidateVersion: beforeARevoke.version } };
    await revocation.revoke(reviewer, c.item.proposal.id, body, key);
    const beforeRemoval = await snapshot(c);
    await releases.remove(maintainer, c.created.candidateId, { expectedCandidateVersion: beforeRemoval.candidate.version,
      expectedContentVersion: beforeRemoval.candidate.contentVersion, memberId: c.memberId,
      expectedProposalVersion: beforeRemoval.proposal.version });
    await expect(releases.detail(reviewer, c.created.candidateId)).rejects.toMatchObject({ status: 403 });
    await expect(revocation.revoke(reviewer, c.item.proposal.id, body, key)).rejects.toMatchObject({ status: 403 });
    expect(await db.client.approvalInvalidation.count({ where: { proposalId: c.item.proposal.id } })).toBe(1);
  });
});
