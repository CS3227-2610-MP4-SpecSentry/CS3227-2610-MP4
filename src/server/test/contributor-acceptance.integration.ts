import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { FindingResponsesService } from '../src/proposals/finding-responses.service';
import { ProposalLifecycleService } from '../src/proposals/proposal-lifecycle.service';
import { persistedTestActor } from './business-fixtures';

describe('Independent Contributor response transaction acceptance (REQ-CON-006/008)', () => {
  let app: NestExpressApplication; let db: DatabaseService; let pool: Pool;
  let responses: FindingResponsesService; let lifecycle: ProposalLifecycleService;
  let owner: Awaited<ReturnType<typeof persistedTestActor>>;
  const prefix = `con-acceptance-${randomUUID()}`;
  const ownerId = `${prefix}-owner`; const reviewerId = `${prefix}-reviewer`;
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Explicit disposable test database required');
    const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({ NODE_ENV: 'test',
      DATABASE_URL: url, SESSION_SECRET: 'synthetic-independent-contributor-session-secret' }))] }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false }); await app.init();
    db = app.get(DatabaseService); responses = app.get(FindingResponsesService); lifecycle = app.get(ProposalLifecycleService);
    pool = new Pool({ connectionString: url, max: 3 });
    await db.client.userAccount.createMany({ data: [
      { id: ownerId, username: ownerId, passwordHash: 'unused-direct-service-fixture', role: 'CONTRIBUTOR' },
      { id: reviewerId, username: reviewerId, passwordHash: 'unused-direct-service-fixture', role: 'REVIEWER' },
    ] });
    owner = await persistedTestActor(db, ownerId);
  });
  afterAll(async () => { await pool?.end(); await app?.close(); });

  async function fixture() {
    return db.client.$transaction(async tx => {
      const root = await tx.changeProposal.create({ data: { ownerId, title: 'Independent response race',
        state: 'IN_REVIEW', version: 3, firstSubmittedAt: new Date() } });
      const revision = await tx.proposalRevision.create({ data: { proposalId: root.id, number: 1, summary: 'Summary',
        problem: 'Problem', constraints: '', expectedBehavior: 'Expected', diffText: '+inert' } });
      const assignment = await tx.reviewAssignment.create({ data: { proposalId: root.id, revisionId: revision.id, reviewerId } });
      await tx.changeProposal.update({ where: { id: root.id }, data: { currentRevisionId: revision.id, currentAssignmentId: assignment.id } });
      const finding = await tx.reviewFinding.create({ data: { proposalId: root.id, revisionId: revision.id,
        assignmentId: assignment.id, actorId: reviewerId, severity: 'HIGH', description: 'Unresolved original finding', mutationVersion: 3 } });
      return { root, revision, assignment, finding };
    });
  }

  async function blockedBy(blocker: number) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const result = await pool.query<{ pid: number }>(
        'SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))', [blocker]);
      if (result.rows[0]) return result.rows[0].pid;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Expected an actual SQL row-lock waiter');
  }

  it.each(['response', 'withdraw'] as const)('serializes %s first against the competing stale command at real SQL barriers', async first => {
    const value = await fixture(); const holder = await pool.connect();
    const run = (operation: 'response' | 'withdraw') => operation === 'response'
      ? responses.add(owner, value.finding.id, { expectedVersion: 3, revisionId: value.revision.id, text: 'Owner answer' })
      : lifecycle.withdraw(owner, value.root.id, { expectedVersion: 3, confirmed: true, reason: 'Owner withdrawal' });
    const settled = (operation: 'response' | 'withdraw') => run(operation).then(result => ({ result, error: null }),
      (error: unknown) => ({ result: null, error }));
    try {
      await holder.query('BEGIN');
      const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      await holder.query('SELECT id FROM "ChangeProposal" WHERE id=$1 FOR UPDATE', [value.root.id]);
      const winner = settled(first);
      const firstWaiter = await blockedBy(pid);
      const loser = settled(first === 'response' ? 'withdraw' : 'response');
      await blockedBy(firstWaiter);
      await holder.query('COMMIT');
      expect((await winner).error).toBeNull();
      expect((await loser).error).toMatchObject({ status: 409 });
      const root = await db.client.changeProposal.findUniqueOrThrow({ where: { id: value.root.id } });
      expect(root).toMatchObject({ version: 4, state: first === 'response' ? 'IN_REVIEW' : 'WITHDRAWN',
        currentRevisionId: value.revision.id, currentAssignmentId: first === 'response' ? value.assignment.id : null });
      expect(await db.client.findingResponse.count({ where: { proposalId: root.id } })).toBe(first === 'response' ? 1 : 0);
      expect((await db.client.proposalActivity.findMany({ where: { proposalId: root.id } })).map(row => row.action)
        .sort()).toEqual(first === 'response' ? ['FINDING_RESPONDED'] : ['NOTIFICATION_CREATED', 'WITHDRAWN']);
      expect(await db.client.notification.count({ where: { proposalId: root.id, kind: 'WITHDRAWN', recipientId: reviewerId } }))
        .toBe(first === 'withdraw' ? 1 : 0);
      expect(await db.client.reviewAssignment.findUniqueOrThrow({ where: { id: value.assignment.id } }))
        .toMatchObject({ status: first === 'response' ? 'ACTIVE' : 'CLOSED', endReason: first === 'response' ? null : 'WITHDRAWN' });
      expect(await db.client.reviewFinding.findUniqueOrThrow({ where: { id: value.finding.id } })).toEqual(value.finding);
      expect(await db.client.findingEvent.count({ where: { findingId: value.finding.id } })).toBe(0);
      expect(await db.client.proposalRevision.findUniqueOrThrow({ where: { id: value.revision.id } })).toEqual(value.revision);
    } finally { await holder.query('ROLLBACK'); holder.release(); }
  }, 15000);

  it('rejects a queued response after account disablement commits, without business state or activity', async () => {
    const value = await fixture(); const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      await holder.query('SELECT id FROM "UserAccount" WHERE id=$1 FOR UPDATE', [ownerId]);
      const pending = responses.add(owner, value.finding.id, { expectedVersion: 3, revisionId: value.revision.id, text: 'Must not persist' })
        .then(result => ({ result, error: null }), (error: unknown) => ({ result: null, error }));
      await blockedBy(pid);
      await holder.query('UPDATE "UserAccount" SET enabled=false WHERE id=$1', [ownerId]);
      await holder.query('COMMIT');
      expect((await pending).error).toMatchObject({ status: 401 });
      expect(await db.client.findingResponse.count({ where: { proposalId: value.root.id } })).toBe(0);
      expect(await db.client.proposalActivity.count({ where: { proposalId: value.root.id } })).toBe(0);
      expect(await db.client.changeProposal.findUniqueOrThrow({ where: { id: value.root.id } }))
        .toMatchObject({ version: 3, state: 'IN_REVIEW', currentAssignmentId: value.assignment.id });
      expect(await db.client.reviewFinding.findUniqueOrThrow({ where: { id: value.finding.id } })).toEqual(value.finding);
    } finally {
      await holder.query('ROLLBACK'); holder.release();
      await db.client.userAccount.update({ where: { id: ownerId }, data: { enabled: true } });
    }
  }, 15000);
});
