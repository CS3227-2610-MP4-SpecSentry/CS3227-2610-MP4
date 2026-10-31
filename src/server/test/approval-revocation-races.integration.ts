import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { readConfig } from '../src/config';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { ActivityModule } from '../src/activity/activity.module';
import { ActivityService } from '../src/activity/activity.service';
import { ProposalsCoreModule } from '../src/proposals/proposals-core.module';
import { ProposalLifecycleService } from '../src/proposals/proposal-lifecycle.service';
import { NotificationsModule } from '../src/notifications/notifications.module';
import { NotificationsService } from '../src/notifications/notifications.service';
import { ReleasesModule } from '../src/releases/releases.module';
import { ReleasesService } from '../src/releases/releases.service';
import { ApprovalRevocationService } from '../src/reviews/approval-revocation.service';
import { ReviewsService } from '../src/reviews/reviews.service';
import type { Prisma } from '../src/generated/prisma/client';
import { persistedTestActor } from './business-fixtures';

const tables = '"ReleasePublicationSnapshot", "ReleaseSmokeTest", "ReleaseCandidateMember", "Notification", "ApprovalInvalidation", "ReleaseCandidate", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"';
const prefix = `release-race-${randomUUID()}`;
const ids = { owner: `${prefix}-owner`, reviewer: `${prefix}-reviewer`, maintainer: `${prefix}-maintainer` };
type Actor = Awaited<ReturnType<typeof persistedTestActor>>;
function barrier() { let open!: () => void; const promise = new Promise<void>(resolve => { open = resolve; }); return { promise, open }; }

describe('PostgreSQL approval revocation release races', () => {
  let module: TestingModule; let db: DatabaseService; let activity: ActivityService; let releases: ReleasesService;
  let notices: NotificationsService; let revocation: ApprovalRevocationService; let lifecycle: ProposalLifecycleService;
  let reviews: ReviewsService;
  let owner: Actor; let reviewer: Actor; let maintainer: Actor;
  type Case = Awaited<ReturnType<typeof attached>>;
  async function item() {
    return db.client.$transaction(async tx => {
    const root = await tx.changeProposal.create({ data: { ownerId: ids.owner, title: 'Race item', state: 'APPROVED', version: 3 } });
    const revision = await tx.proposalRevision.create({ data: { proposalId: root.id, number: 1,
      summary: 'Summary', problem: 'Problem', constraints: '', expectedBehavior: 'Works', diffText: '+safe' } });
    const assignment = await tx.reviewAssignment.create({ data: { proposalId: root.id, revisionId: revision.id,
      reviewerId: ids.reviewer } });
    await tx.changeProposal.update({ where: { id: root.id }, data: { currentRevisionId: revision.id,
      currentAssignmentId: assignment.id } });
    const criterion = await tx.acceptanceCriterion.create({ data: { revisionId: revision.id,
      stableKey: 'required', statement: 'Required', required: true } });
    await tx.coverageAssessment.create({ data: { proposalId: root.id, revisionId: revision.id,
      assignmentId: assignment.id, criterionId: criterion.id, actorId: ids.reviewer,
      status: 'COVERED', mutationVersion: 1 } });
    const decision = await tx.reviewDecision.create({ data: { proposalId: root.id, revisionId: revision.id,
      assignmentId: assignment.id, actorId: ids.reviewer, decision: 'APPROVE', mutationVersion: 3 } });
    return { root, revision, assignment, decision };
    });
  }
  async function attached() {
    const value = await item();
    const candidate = await releases.create(maintainer, { versionLabel: `1.0.${Math.floor(Math.random() * 1000000)}`,
      rollbackNote: 'Restore prior build', dependencyNotes: '' });
    const added = await releases.add(maintainer, candidate.candidateId, { expectedCandidateVersion: candidate.version,
      expectedContentVersion: candidate.contentVersion, proposalId: value.root.id, revisionId: value.revision.id,
      assignmentId: value.assignment.id, expectedProposalVersion: value.root.version,
      expectedAssignmentVersion: value.assignment.version });
    const member = await db.client.releaseCandidateMember.findFirstOrThrow({ where: { candidateId: candidate.candidateId } });
    return { value, candidate, added, member };
  }
  const revokeBody = (c: Case, reason = 'Revoked') => ({ expectedVersion: c.value.root.version + 1,
    revisionId: c.value.revision.id, assignmentId: c.value.assignment.id,
    expectedAssignmentVersion: c.value.assignment.version, approvalId: c.value.decision.id,
    expectedApprovalVersion: c.value.decision.mutationVersion, reason,
    candidateContext: { candidateId: c.candidate.candidateId, expectedCandidateVersion: c.added.version } });
  const revoke = async (c: Case, key = randomUUID(), reason = 'Revoked') => {
    const candidate = await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: c.candidate.candidateId } });
    return revocation.revoke(reviewer, c.value.root.id, { ...revokeBody(c, reason),
      candidateContext: { candidateId: candidate.id, expectedCandidateVersion: candidate.version } }, key);
  };
  const remove = (c: Case) => releases.remove(maintainer, c.candidate.candidateId, {
    expectedCandidateVersion: c.added.version, expectedContentVersion: c.added.contentVersion,
    memberId: c.member.id, expectedProposalVersion: c.value.root.version + 1 });
  async function publish(c: Case) {
    const smoked = await releases.smoke(maintainer, c.candidate.candidateId, { expectedVersion: c.added.version,
      testedContentVersion: c.added.contentVersion, procedure: 'Run smoke', results: 'PASS', outcome: 'PASS' });
    return { smoked, invoke: (key = randomUUID()) => releases.publish(maintainer, c.candidate.candidateId,
      { expectedVersion: smoked.version, expectedContentVersion: smoked.contentVersion }, key) };
  }
  async function state(c: Case) {
    return { root: await db.client.changeProposal.findUniqueOrThrow({ where: { id: c.value.root.id } }),
      candidate: await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: c.candidate.candidateId } }),
      member: await db.client.releaseCandidateMember.findUniqueOrThrow({ where: { id: c.member.id } }),
      approval: await db.client.reviewDecision.findUniqueOrThrow({ where: { id: c.value.decision.id } }),
      invalidations: await db.client.approvalInvalidation.findMany({ where: { proposalId: c.value.root.id } }),
      notices: await db.client.notification.findMany({ where: { candidateId: c.candidate.candidateId } }),
      activities: await db.client.proposalActivity.findMany({ where: { proposalId: c.value.root.id } }),
      snapshot: await db.client.releasePublicationSnapshot.findUnique({ where: { candidateId: c.candidate.candidateId } }) };
  }
  async function observedBlock(blockerPid: number) {
    const until = Date.now() + 2500;
    while (Date.now() < until) {
      const rows = await db.client.$queryRaw<{ pid: number }[]>`
        SELECT waiter.pid FROM pg_stat_activity waiter WHERE waiter.datname=current_database()
        AND waiter.wait_event_type='Lock' AND ${blockerPid}=ANY(pg_blocking_pids(waiter.pid))`;
      if (rows.some(row => row.pid !== blockerPid)) return;
    }
    throw new Error('Expected actual PostgreSQL lock waiter was not observed');
  }
  async function race<T, U>(action: string, first: () => Promise<T>, second: () => Promise<U>) {
    const entered = barrier(); const release = barrier(); let pid = 0;
    const original = activity.append.bind(activity);
    // Test-only wrapper pauses after the real insert while its transaction still
    // owns account/candidate/proposal locks. Runtime await accepts this Promise.
    const heldAppend = (async (tx: Parameters<ActivityService['append']>[0], data: Parameters<ActivityService['append']>[1]) => {
      const result = await original(tx, data);
      if (data.action === action && pid === 0) {
        const rows = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        pid = rows[0]!.pid; entered.open(); await release.promise;
      }
      return result;
    }) as unknown as ActivityService['append'];
    const spy = jest.spyOn(activity, 'append').mockImplementation(heldAppend);
    let firstPromise: Promise<T> | undefined; let secondPromise: Promise<U> | undefined;
    try {
      firstPromise = first();
      await Promise.race([entered.promise, firstPromise.then(() => { throw new Error('First command missed transaction barrier'); })]);
      // PrismaPromise is lazy; attaching then explicitly dispatches raw DB
      // operations such as AuthSession.delete before checking pg_blocking_pids.
      secondPromise = second().then(value => value); await observedBlock(pid);
      release.open();
      return await Promise.allSettled([firstPromise, secondPromise]);
    } finally {
      release.open(); await Promise.allSettled([...(firstPromise ? [firstPromise] : []), ...(secondPromise ? [secondPromise] : [])]);
      spy.mockRestore();
    }
  }
  async function manualRace<T>(first: (tx: Prisma.TransactionClient) => Promise<void>,
    second: () => Promise<T>) {
    const entered = barrier(); const release = barrier(); let pid = 0;
    const firstPromise = db.client.$transaction(async tx => {
      await first(tx);
      const rows = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      pid = rows[0]!.pid; entered.open(); await release.promise;
    }, { maxWait: 5000, timeout: 10000 });
    let secondPromise: Promise<T> | undefined;
    try {
      await Promise.race([entered.promise, firstPromise.then(() => { throw new Error('Manual transaction missed barrier'); })]);
      secondPromise = second().then(value => value); await observedBlock(pid); release.open();
      return await Promise.allSettled([firstPromise, secondPromise]);
    } finally {
      release.open(); await Promise.allSettled([firstPromise, ...(secondPromise ? [secondPromise] : [])]);
    }
  }
  const disable = () => db.client.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string; version: number }[]>`
      SELECT "id","version" FROM "UserAccount" WHERE "id"=${ids.reviewer} FOR UPDATE`;
    await tx.userAccount.update({ where: { id: ids.reviewer }, data: { enabled: false, version: rows[0]!.version + 1 } });
    await reviews.releaseDisabledAssignments(tx, ids.reviewer);
  });
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL required');
    const config = readConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL,
      SESSION_SECRET: 'release-race-secret-at-least-32-characters' });
    module = await Test.createTestingModule({ imports: [DatabaseModule.register(config), ActivityModule,
      ProposalsCoreModule, NotificationsModule.register(config), ReleasesModule.register(config)],
      providers: [ApprovalRevocationService, ProposalLifecycleService, ReviewsService] }).compile();
    db = module.get(DatabaseService); activity = module.get(ActivityService); releases = module.get(ReleasesService);
    notices = module.get(NotificationsService); revocation = module.get(ApprovalRevocationService);
    lifecycle = module.get(ProposalLifecycleService);
    reviews = module.get(ReviewsService);
    await db.client.userAccount.createMany({ data: [
      { id: ids.owner, username: `${prefix}-owner`.toLowerCase(), passwordHash: 'synthetic', role: 'CONTRIBUTOR' },
      { id: ids.reviewer, username: `${prefix}-reviewer`.toLowerCase(), passwordHash: 'synthetic', role: 'REVIEWER' },
      { id: ids.maintainer, username: `${prefix}-maintainer`.toLowerCase(), passwordHash: 'synthetic', role: 'RELEASE_MAINTAINER' },
    ] });
  });
  beforeEach(async () => {
    await db.client.$executeRawUnsafe(`TRUNCATE ${tables}`);
    await db.client.authSession.deleteMany({ where: { data: { contains: prefix } } });
    await db.client.userAccount.updateMany({ where: { id: { in: Object.values(ids) } }, data: { enabled: true, version: 1 } });
    owner = await persistedTestActor(db, ids.owner); reviewer = await persistedTestActor(db, ids.reviewer);
    maintainer = await persistedTestActor(db, ids.maintainer);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (db) {
      await db.client.$executeRawUnsafe(`TRUNCATE ${tables}`);
      await db.client.authSession.deleteMany({ where: { data: { contains: prefix } } });
      await db.client.securityEvent.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
      await db.client.userAccount.deleteMany({ where: { id: { in: Object.values(ids) } } });
    }
    await module?.close();
  });

  it('revoke-publish-revoke-first has a real blocked publisher and no snapshot', async () => {
    const c = await attached(); const publication = await publish(c);
    const [winner, loser] = await race('APPROVAL_REVOKED', () => revoke(c), () => publication.invoke());
    expect(winner.status).toBe('fulfilled'); expect(loser.status).toBe('rejected');
    const after = await state(c); expect(after.root.state).toBe('IN_RELEASE');
    expect(after.candidate.status).toBe('OPEN'); expect(after.member.status).toBe('ATTACHED');
    expect(after.invalidations).toHaveLength(1); expect(after.notices).toHaveLength(1);
    expect(after.snapshot).toBeNull();
  });
  it('revoke-publish-publish-first has a real blocked revoker and immutable snapshot', async () => {
    const c = await attached(); const publication = await publish(c);
    const [winner, loser] = await race('RELEASE_PUBLISHED', () => publication.invoke(), () => revoke(c));
    expect(winner.status).toBe('fulfilled'); expect(loser.status).toBe('rejected');
    const after = await state(c); expect(after.root.state).toBe('RELEASED');
    expect(after.candidate.status).toBe('RELEASED'); expect(after.member.status).toBe('RELEASED');
    expect(after.snapshot).not.toBeNull(); expect(after.invalidations).toEqual([]); expect(after.notices).toEqual([]);
  });
  it('revoke-remove-revoke-first keeps attached state until a refreshed explicit removal', async () => {
    const c = await attached(); const [winner, loser] = await race('APPROVAL_REVOKED', () => revoke(c), () => remove(c));
    expect(winner.status).toBe('fulfilled'); expect(loser.status).toBe('rejected');
    const after = await state(c); expect(after.member.status).toBe('ATTACHED');
    expect(after.root.state).toBe('IN_RELEASE'); expect(after.notices).toHaveLength(1);
    await releases.remove(maintainer, c.candidate.candidateId, { expectedCandidateVersion: after.candidate.version,
      expectedContentVersion: after.candidate.contentVersion, memberId: c.member.id,
      expectedProposalVersion: after.root.version });
    expect((await state(c)).root.state).toBe('CHANGES_REQUESTED');
  });
  it('revoke-remove-remove-first rejects old attached context and preserves approval', async () => {
    const c = await attached(); const [winner, loser] = await race('RELEASE_REMOVED', () => remove(c), () => revoke(c));
    expect(winner.status).toBe('fulfilled'); expect(loser.status).toBe('rejected');
    const after = await state(c); expect(after.member.status).toBe('REMOVED');
    expect(after.root.state).toBe('APPROVED'); expect(after.invalidations).toEqual([]); expect(after.notices).toEqual([]);
  });
  it('revoke-duplicate-same-key serializes and returns one committed result', async () => {
    const c = await attached(); const key = randomUUID();
    const [first, second] = await race('APPROVAL_REVOKED', () => revoke(c, key), () => revoke(c, key));
    expect(first.status).toBe('fulfilled'); expect(second.status).toBe('fulfilled');
    if (first.status === 'fulfilled' && second.status === 'fulfilled') expect(second.value).toEqual(first.value);
    const after = await state(c); expect(after.invalidations).toHaveLength(1); expect(after.notices).toHaveLength(1);
    expect(after.activities.filter(a => a.action === 'APPROVAL_REVOKED')).toHaveLength(1);
  });
  it('revoke-duplicate-different-keys has one mutation and one state conflict', async () => {
    const c = await attached(); const [first, second] = await race('APPROVAL_REVOKED',
      () => revoke(c, randomUUID()), () => revoke(c, randomUUID()));
    expect(first.status).toBe('fulfilled'); expect(second.status).toBe('rejected');
    const after = await state(c); expect(after.invalidations).toHaveLength(1); expect(after.notices).toHaveLength(1);
    expect(after.activities.filter(a => a.action === 'APPROVAL_REVOKED')).toHaveLength(1);
  });
  it('revoke-same-key-changed-body rejects changed canonical reason', async () => {
    const c = await attached(); const key = randomUUID();
    const [first, second] = await race('APPROVAL_REVOKED', () => revoke(c, key, 'Reason A'), () => revoke(c, key, 'Reason B'));
    expect(first.status).toBe('fulfilled'); expect(second.status).toBe('rejected');
    const after = await state(c); expect(after.invalidations).toHaveLength(1);
    expect(after.invalidations[0]!.reason).toBe('Reason A'); expect(after.notices).toHaveLength(1);
  });
  it('revoke-reopen-revoke-first keeps the revocation winner and old owner command conflicts', async () => {
    const c = await item(); const body = { expectedVersion: c.root.version, revisionId: c.revision.id,
      assignmentId: c.assignment.id, expectedAssignmentVersion: c.assignment.version,
      approvalId: c.decision.id, expectedApprovalVersion: c.decision.mutationVersion,
      reason: 'Revoked', candidateContext: null };
    const [first, second] = await race('APPROVAL_REVOKED',
      () => revocation.revoke(reviewer, c.root.id, body, randomUUID()),
      () => lifecycle.reopen(owner, c.root.id, { expectedVersion: c.root.version }));
    expect(first.status).toBe('fulfilled'); expect(second.status).toBe('rejected');
    expect((await db.client.approvalInvalidation.findMany({ where: { proposalId: c.root.id } })).map(i => i.cause)).toEqual(['REVOKED']);
  });
  it('revoke-reopen-reopen-first keeps the owner invalidation winner', async () => {
    const c = await item(); const body = { expectedVersion: c.root.version, revisionId: c.revision.id,
      assignmentId: c.assignment.id, expectedAssignmentVersion: c.assignment.version,
      approvalId: c.decision.id, expectedApprovalVersion: c.decision.mutationVersion,
      reason: 'Revoked', candidateContext: null };
    const [first, second] = await race('REOPENED',
      () => lifecycle.reopen(owner, c.root.id, { expectedVersion: c.root.version }),
      () => revocation.revoke(reviewer, c.root.id, body, randomUUID()));
    expect(first.status).toBe('fulfilled'); expect(second.status).toBe('rejected');
    expect((await db.client.approvalInvalidation.findMany({ where: { proposalId: c.root.id } })).map(i => i.cause)).toEqual(['REOPENED']);
  });
  it('revoke-disable-disable-first denies the disabled actor under the account lock', async () => {
    const c = await item(); const body = { expectedVersion: c.root.version, revisionId: c.revision.id,
      assignmentId: c.assignment.id, expectedAssignmentVersion: c.assignment.version,
      approvalId: c.decision.id, expectedApprovalVersion: c.decision.mutationVersion,
      reason: 'Revoked', candidateContext: null };
    const [first, second] = await manualRace(async tx => {
      const rows = await tx.$queryRaw<{ version: number }[]>`SELECT "version" FROM "UserAccount" WHERE "id"=${ids.reviewer} FOR UPDATE`;
      await tx.userAccount.update({ where: { id: ids.reviewer }, data: { enabled: false, version: rows[0]!.version + 1 } });
    }, () => revocation.revoke(reviewer, c.root.id, body, randomUUID()));
    expect(first.status).toBe('fulfilled'); expect(second.status).toBe('rejected');
    expect(await db.client.approvalInvalidation.count({ where: { proposalId: c.root.id } })).toBe(0);
  });
  it('revoke-disable-revoke-first releases the now-unfinished assignment after disablement', async () => {
    const c = await item(); const body = { expectedVersion: c.root.version, revisionId: c.revision.id,
      assignmentId: c.assignment.id, expectedAssignmentVersion: c.assignment.version,
      approvalId: c.decision.id, expectedApprovalVersion: c.decision.mutationVersion,
      reason: 'Revoked', candidateContext: null };
    const [first, second] = await race('APPROVAL_REVOKED',
      () => revocation.revoke(reviewer, c.root.id, body, randomUUID()), disable);
    expect(first.status).toBe('fulfilled'); expect(second.status).toBe('fulfilled');
    const root = await db.client.changeProposal.findUniqueOrThrow({ where: { id: c.root.id } });
    expect(root).toMatchObject({ state: 'CHANGES_REQUESTED', currentAssignmentId: null });
    expect(await db.client.approvalInvalidation.count({ where: { proposalId: c.root.id } })).toBe(1);
  });
  it('revoke-session-invalidate-first denies the destroyed persisted session', async () => {
    const c = await item(); const body = { expectedVersion: c.root.version, revisionId: c.revision.id,
      assignmentId: c.assignment.id, expectedAssignmentVersion: c.assignment.version,
      approvalId: c.decision.id, expectedApprovalVersion: c.decision.mutationVersion,
      reason: 'Revoked', candidateContext: null };
    const [first, second] = await manualRace(async tx => {
      await tx.authSession.delete({ where: { id: reviewer.session!.digest } });
    }, () => revocation.revoke(reviewer, c.root.id, body, randomUUID()));
    expect(first.status).toBe('fulfilled'); expect(second.status).toBe('rejected');
    expect(await db.client.approvalInvalidation.count({ where: { proposalId: c.root.id } })).toBe(0);
  });
  it('revoke-session-revoke-first commits before session deletion', async () => {
    const c = await item(); const body = { expectedVersion: c.root.version, revisionId: c.revision.id,
      assignmentId: c.assignment.id, expectedAssignmentVersion: c.assignment.version,
      approvalId: c.decision.id, expectedApprovalVersion: c.decision.mutationVersion,
      reason: 'Revoked', candidateContext: null };
    const [first, second] = await race('APPROVAL_REVOKED',
      () => revocation.revoke(reviewer, c.root.id, body, randomUUID()),
      () => db.client.authSession.delete({ where: { id: reviewer.session!.digest } }));
    expect(first.status).toBe('fulfilled'); expect(second.status).toBe('fulfilled');
    expect(await db.client.approvalInvalidation.count({ where: { proposalId: c.root.id } })).toBe(1);
  });
  it('revoke-attach-attach-first rejects stale unattached revocation context', async () => {
    const c = await item(); const candidate = await releases.create(maintainer, { versionLabel: '3.0.0',
      rollbackNote: 'Restore prior build', dependencyNotes: '' });
    const add = () => releases.add(maintainer, candidate.candidateId, { expectedCandidateVersion: candidate.version,
      expectedContentVersion: candidate.contentVersion, proposalId: c.root.id, revisionId: c.revision.id,
      assignmentId: c.assignment.id, expectedProposalVersion: c.root.version,
      expectedAssignmentVersion: c.assignment.version });
    const body = { expectedVersion: c.root.version, revisionId: c.revision.id, assignmentId: c.assignment.id,
      expectedAssignmentVersion: c.assignment.version, approvalId: c.decision.id,
      expectedApprovalVersion: c.decision.mutationVersion, reason: 'Revoked', candidateContext: null };
    const [first, second] = await race('RELEASE_ATTACHED', add,
      () => revocation.revoke(reviewer, c.root.id, body, randomUUID()));
    expect(first.status).toBe('fulfilled'); expect(second.status).toBe('rejected');
    expect(await db.client.releaseCandidateMember.count({ where: { proposalId: c.root.id, status: 'ATTACHED' } })).toBe(1);
    expect(await db.client.approvalInvalidation.count({ where: { proposalId: c.root.id } })).toBe(0);
  });
  it('revoke-attach-revoke-first prevents membership fragments', async () => {
    const c = await item(); const candidate = await releases.create(maintainer, { versionLabel: '3.0.1',
      rollbackNote: 'Restore prior build', dependencyNotes: '' });
    const add = () => releases.add(maintainer, candidate.candidateId, { expectedCandidateVersion: candidate.version,
      expectedContentVersion: candidate.contentVersion, proposalId: c.root.id, revisionId: c.revision.id,
      assignmentId: c.assignment.id, expectedProposalVersion: c.root.version,
      expectedAssignmentVersion: c.assignment.version });
    const body = { expectedVersion: c.root.version, revisionId: c.revision.id, assignmentId: c.assignment.id,
      expectedAssignmentVersion: c.assignment.version, approvalId: c.decision.id,
      expectedApprovalVersion: c.decision.mutationVersion, reason: 'Revoked', candidateContext: null };
    const [first, second] = await race('APPROVAL_REVOKED',
      () => revocation.revoke(reviewer, c.root.id, body, randomUUID()), add);
    expect(first.status).toBe('fulfilled'); expect(second.status).toBe('rejected');
    expect(await db.client.releaseCandidateMember.count({ where: { proposalId: c.root.id } })).toBe(0);
    expect(await db.client.approvalInvalidation.count({ where: { proposalId: c.root.id } })).toBe(1);
  });
  it('revoke-remove-disable-first releases the disabled Reviewer only when removing the attached revoked item', async () => {
    const c = await attached(); await revoke(c); const before = await state(c);
    const body = { expectedCandidateVersion: before.candidate.version,
      expectedContentVersion: before.candidate.contentVersion, memberId: c.member.id,
      expectedProposalVersion: before.root.version };
    const [first, second] = await manualRace(async tx => {
      const rows = await tx.$queryRaw<{ version: number }[]>`SELECT "version" FROM "UserAccount" WHERE "id"=${ids.reviewer} FOR UPDATE`;
      await tx.userAccount.update({ where: { id: ids.reviewer }, data: { enabled: false, version: rows[0]!.version + 1 } });
      await reviews.releaseDisabledAssignments(tx, ids.reviewer);
    }, () => releases.remove(maintainer, c.candidate.candidateId, body));
    expect(first.status).toBe('fulfilled'); expect(second.status).toBe('fulfilled');
    const after = await state(c); expect(after.root).toMatchObject({ state: 'CHANGES_REQUESTED', currentAssignmentId: null });
    expect(after.member.status).toBe('REMOVED'); expect(after.notices).toHaveLength(1);
  });
  it('revoke-remove-removal-first serializes disablement and preserves one final unassigned state', async () => {
    const c = await attached(); await revoke(c); const before = await state(c);
    const body = { expectedCandidateVersion: before.candidate.version,
      expectedContentVersion: before.candidate.contentVersion, memberId: c.member.id,
      expectedProposalVersion: before.root.version };
    const [first, second] = await race('RELEASE_REMOVED',
      () => releases.remove(maintainer, c.candidate.candidateId, body), disable);
    expect(first.status).toBe('fulfilled'); expect(second.status).toBe('fulfilled');
    const after = await state(c); expect(after.root).toMatchObject({ state: 'CHANGES_REQUESTED', currentAssignmentId: null });
    expect(after.member.status).toBe('REMOVED'); expect(after.notices).toHaveLength(1);
  });
  it('revoke-notice-newer acknowledges only the displayed old ID after a newer notice commits', async () => {
    const c = await attached(); await revoke(c);
    const oldNotice = (await state(c)).notices[0]!;
    const second = await item(); const candidate = await db.client.releaseCandidate.findUniqueOrThrow({ where: { id: c.candidate.candidateId } });
    const added = await releases.add(maintainer, c.candidate.candidateId, {
      expectedCandidateVersion: candidate.version, expectedContentVersion: candidate.contentVersion,
      proposalId: second.root.id, revisionId: second.revision.id, assignmentId: second.assignment.id,
      expectedProposalVersion: second.root.version, expectedAssignmentVersion: second.assignment.version });
    const body = { expectedVersion: second.root.version + 1, revisionId: second.revision.id,
      assignmentId: second.assignment.id, expectedAssignmentVersion: second.assignment.version,
      approvalId: second.decision.id, expectedApprovalVersion: second.decision.mutationVersion,
      reason: 'Second revocation', candidateContext: { candidateId: c.candidate.candidateId,
        expectedCandidateVersion: added.version } };
    const displayed = (await notices.list(maintainer, { limit: 20 })).items.map(n => n.id);
    expect(displayed).toContain(oldNotice.id);
    const [first, ack] = await race('APPROVAL_REVOKED',
      () => revocation.revoke(reviewer, second.root.id, body, randomUUID()),
      () => notices.acknowledge(maintainer, oldNotice.id, { kind: 'APPROVAL_REVOKED',
        candidateId: c.candidate.candidateId, invalidationId: oldNotice.invalidationId! }));
    expect(first.status).toBe('fulfilled'); expect(ack.status).toBe('fulfilled');
    const noticesAfter = await db.client.notification.findMany({ where: { candidateId: c.candidate.candidateId } });
    expect(noticesAfter).toHaveLength(2);
    expect(noticesAfter.find(n => n.id === oldNotice.id)!.readAt).not.toBeNull();
    expect(noticesAfter.find(n => n.id !== oldNotice.id)!.readAt).toBeNull();
    expect(await db.client.approvalInvalidation.count({ where: { candidateId: c.candidate.candidateId } })).toBe(2);
  });
});
