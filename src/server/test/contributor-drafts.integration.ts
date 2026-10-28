import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { SessionData } from 'express-session';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ActivityService } from '../src/activity/activity.service';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { configureHttp } from '../src/http';
import { hashPassword } from '../src/identity/identity.service';
import { ProposalLifecycleService } from '../src/proposals/proposal-lifecycle.service';
import type { ProposalState } from '../src/generated/prisma/client';
import type { BusinessActor } from '../src/identity/business-context';
import { IDLE_MS, PostgresSessionStore } from '../src/identity/session.store';

const content = { title: 'Private <script>title</script>', problem: 'Private problem', constraints: '', expectedBehavior: 'Expected behavior',
  summary: '', diffText: '', criteria: [], evidence: [] };

describe('Contributor private drafts (REQ-CON-001/002, REQ-SHR-001/002/004/005/007)', () => {
  let app: NestExpressApplication;
  let database: DatabaseService;
  let lifecycle: ProposalLifecycleService;
  let activity: ActivityService;
  let pool: Pool;
  const prefix = `draft-${randomUUID()}`;
  const password = 'synthetic-contributor-password';
  const accounts = ['CONTRIBUTOR', 'CONTRIBUTOR', 'REVIEWER', 'RELEASE_MAINTAINER'] as const;
  const ids: string[] = [];
  type Login = { agent: ReturnType<typeof request.agent>; token: string; digest: string };
  let owner: Login;
  let other: Login;
  let reviewer: Login;
  let maintainer: Login;
  async function login(index: number): Promise<Login> {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    const result = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken)
      .send({ username: `${prefix}-${index}`, password }).expect(200);
    const cookie = String(result.headers['set-cookie']?.[0]).split(';')[0]!.split('=').slice(1).join('=');
    const signed = decodeURIComponent(cookie);
    const rawId = signed.slice(2, signed.lastIndexOf('.'));
    return { agent, token: result.body.csrfToken as string, digest: createHash('sha256').update(rawId).digest('hex') };
  }
  const create = (session = owner, body: object = content) => session.agent.post('/api/proposals').set('x-csrf-token', session.token).send(body);

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable migrated TEST_DATABASE_URL required');
    const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({ NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL, SESSION_SECRET: 'synthetic-draft-secret-more-than-32-characters' }))] }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false });
    configureHttp(app); await app.init();
    database = app.get(DatabaseService); lifecycle = app.get(ProposalLifecycleService); activity = app.get(ActivityService);
    expect(await database.client.$queryRaw<{ TimeZone: string }[]>`SHOW timezone`).toEqual([{ TimeZone: 'UTC' }]);
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
    const passwordHash = await hashPassword(password);
    for (const [index, role] of accounts.entries()) ids.push((await database.client.userAccount.create({ data: { username: `${prefix}-${index}`, role, passwordHash } })).id);
    [owner, other, reviewer, maintainer] = await Promise.all([login(0), login(1), login(2), login(3)]);
  });
  afterAll(async () => {
    if (database) await database.client.authSession.deleteMany({ where: { OR: ids.map(id => ({ data: { contains: id } })) } });
    // Append-only synthetic business evidence is retained until the disposable database is dropped.
    await app?.close();
    await pool?.end();
  });

  async function actorForOwner(): Promise<BusinessActor> {
    const row = await database.client.authSession.findUniqueOrThrow({ where: { id: owner.digest } });
    const data = JSON.parse(row.data) as { issuedAt: number; csrfToken: string };
    return { accountId: ids[0]!, accountVersion: 1, session: { digest: row.id, issuedAt: data.issuedAt, csrfToken: data.csrfToken } };
  }
  async function waitForLock(holderPid: number) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const result = await pool.query('SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))', [holderPid]);
      if (result.rowCount) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Expected transaction did not reach the row-lock barrier');
  }

  it('creates server-owned DRAFT/private content/activity and supports owner-only list/detail', async () => {
    const empty = await other.agent.get('/api/proposals').expect(200);
    expect(empty.body).toEqual({ items: [], nextCursor: null });
    const result = await create().expect(201);
    expect(result.body).toMatchObject({ state: 'DRAFT', version: 0, revisionId: null, assignmentId: null });
    const id = result.body.proposalId as string;
    expect(await database.client.changeProposal.findUniqueOrThrow({ where: { id } })).toMatchObject({ ownerId: ids[0], state: 'DRAFT', title: 'Private working draft' });
    expect(await database.client.proposalActivity.findMany({ where: { proposalId: id } })).toEqual([expect.objectContaining({ actorId: ids[0], action: 'DRAFT_CREATED', revisionId: null })]);
    const detail = await owner.agent.get(`/api/proposals/${id}/draft`).expect(200);
    expect(detail.body.content).toEqual(content);
    const list = await owner.agent.get('/api/proposals').expect(200);
    expect(list.body.items).toContainEqual(expect.objectContaining({ proposalId: id, title: content.title, state: 'DRAFT' }));
    for (const session of [other, reviewer, maintainer]) {
      const denied = await session.agent.get(`/api/proposals/${id}/draft`).expect(403);
      expect(denied.text).not.toMatch(/Private|Expected behavior/);
    }
    expect((await other.agent.get('/api/proposals').expect(200)).body.items).toEqual([]);
    const events = await database.client.securityEvent.findMany({ where: { actorId: ids[0], outcome: 'success' } });
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'PROPOSAL_DRAFT_VIEWED', target: id }),
      expect.objectContaining({ action: 'PROPOSAL_DRAFT_LISTED', target: 'own-drafts' }),
    ]));
    expect(JSON.stringify(events)).not.toContain(content.title);
    expect(JSON.stringify(events)).not.toContain(content.problem);
  });

  it('saves an own private draft with versioned full-content preservation and atomic activity', async () => {
    const initial = { ...content, summary: 'Hidden summary', diffText: 'Hidden diff',
      criteria: [{ statement: 'Hidden criterion', required: true }], evidence: [{ text: 'Hidden evidence' }] };
    const created = await create(owner, initial).expect(201);
    const id = created.body.proposalId as string;
    const before = (await owner.agent.get(`/api/proposals/${id}/draft`).expect(200)).body;
    const edited = { ...before.content, title: 'Edited private title', problem: 'Edited problem', constraints: 'Edited constraints', expectedBehavior: 'Edited behavior' };
    const result = await owner.agent.patch(`/api/proposals/${id}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: 0, content: edited }).expect(200);
    expect(result.body).toMatchObject({ proposalId: id, workingRevisionId: created.body.workingRevisionId, version: 1, state: 'DRAFT' });
    expect((await owner.agent.get(`/api/proposals/${id}/draft`).expect(200)).body.content).toEqual(edited);
    expect(await database.client.changeProposal.findUniqueOrThrow({ where: { id } })).toMatchObject({ ownerId: ids[0], title: 'Private working draft', version: 1, state: 'DRAFT' });
    const events = await database.client.proposalActivity.findMany({ where: { proposalId: id, action: 'DRAFT_SAVED' } });
    expect(events).toEqual([expect.objectContaining({ actorId: ids[0], summary: 'Private working draft saved.', revisionId: null })]);
    expect(JSON.stringify(events)).not.toContain(edited.title);
    await owner.agent.patch(`/api/proposals/${id}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: 1, content: { ...edited, title: 'Saved again' } }).expect(200);
    expect((await owner.agent.get('/api/proposals').expect(200)).body.items).toContainEqual(expect.objectContaining({ proposalId: id, title: 'Saved again', version: 2 }));
  });

  it('enforces save ownership/roles/CSRF/strict fields and private-reference scope without mutation', async () => {
    const id = (await create().expect(201)).body.proposalId as string;
    const save = (login: Login, body: object = { expectedVersion: 0, content }) => login.agent.patch(`/api/proposals/${id}/draft`).set('x-csrf-token', login.token).send(body);
    await request(app.getHttpServer()).patch(`/api/proposals/${id}/draft`).send({ expectedVersion: 0, content }).expect(401);
    for (const login of [other, reviewer, maintainer]) {
      const denied = await save(login).expect(403);
      expect(denied.text).not.toContain(content.title);
    }
    await owner.agent.patch(`/api/proposals/${id}/draft`).send({ expectedVersion: 0, content }).expect(403);
    await owner.agent.patch(`/api/proposals/${id}/draft`).set('x-csrf-token', 'f'.repeat(64)).send({ expectedVersion: 0, content }).expect(403);
    for (const body of [{ expectedVersion: 0, content, ownerId: ids[1] }, { expectedVersion: 0, content: { ...content, state: 'APPROVED' } },
      { expectedVersion: 0, content: { ...content, title: '😀'.repeat(201) } },
      { expectedVersion: 0, content: { ...content, problem: '😀'.repeat(10001) } },
      { expectedVersion: 0, content: { ...content, evidence: [{ id: randomUUID(), text: 'Foreign identity' }] } },
      { expectedVersion: 0, content: { ...content, criteria: [{ stableKey: randomUUID(), statement: 'Foreign identity', required: true }] } }]) await save(owner, body).expect(422);
    expect((await owner.agent.get(`/api/proposals/${id}/draft`).expect(200)).body).toMatchObject({ version: 0, content });
    expect(await database.client.proposalActivity.count({ where: { proposalId: id, action: 'DRAFT_SAVED' } })).toBe(0);
    await owner.agent.patch(`/api/proposals/${randomUUID()}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: 0, content }).expect(404);
  });

  it('rejects non-DRAFT states, submitted markers, attachments and version overflow without touching snapshots', async () => {
    for (const state of ['SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'IN_RELEASE', 'RELEASED', 'WITHDRAWN'] as ProposalState[]) {
      const id = (await create().expect(201)).body.proposalId as string;
      await database.client.changeProposal.update({ where: { id }, data: { state } });
      await owner.agent.patch(`/api/proposals/${id}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: 0, content }).expect(409);
      expect((await database.client.workingRevision.findUniqueOrThrow({ where: { proposalId: id } })).content).toEqual(content);
      expect(await database.client.proposalActivity.count({ where: { proposalId: id, action: 'DRAFT_SAVED' } })).toBe(0);
    }
    for (const data of [{ firstSubmittedAt: new Date() }, { releaseAttachmentRef: 'synthetic-candidate' }, { version: 2147483647 }]) {
      const id = (await create().expect(201)).body.proposalId as string;
      await database.client.changeProposal.update({ where: { id }, data });
      await owner.agent.patch(`/api/proposals/${id}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: 'version' in data ? data.version : 0, content }).expect(409);
    }
    const id = (await create().expect(201)).body.proposalId as string;
    const snapshot = await database.client.proposalRevision.create({ data: { proposalId: id, number: 1, summary: 'Immutable', problem: 'Submitted problem', constraints: '', expectedBehavior: 'Submitted behavior', diffText: 'Submitted diff' } });
    await database.client.changeProposal.update({ where: { id }, data: { currentRevisionId: snapshot.id } });
    await owner.agent.patch(`/api/proposals/${id}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: 0, content }).expect(409);
    expect(await database.client.proposalRevision.findUniqueOrThrow({ where: { id: snapshot.id } })).toEqual(snapshot);
  });

  it('allows exactly one concurrent save per expected version, preserving loser data and activity', async () => {
    const id = (await create().expect(201)).body.proposalId as string;
    const results = await Promise.all(['Winner A', 'Winner B'].map(title => owner.agent.patch(`/api/proposals/${id}/draft`)
      .set('x-csrf-token', owner.token).send({ expectedVersion: 0, content: { ...content, title } })));
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const winner = results[0]!.status === 200 ? 'Winner A' : 'Winner B';
    const latest = await owner.agent.get(`/api/proposals/${id}/draft`).expect(200);
    expect(latest.body).toMatchObject({ version: 1, content: { ...content, title: winner } });
    expect(await database.client.proposalActivity.count({ where: { proposalId: id, action: 'DRAFT_SAVED' } })).toBe(1);
    await owner.agent.patch(`/api/proposals/${id}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: 0, content }).expect(409);
    expect((await owner.agent.get(`/api/proposals/${id}/draft`).expect(200)).body).toEqual(latest.body);
  });

  it('rolls back saved content/version/activity when business audit fails or the transaction expires', async () => {
    const id = (await create().expect(201)).body.proposalId as string;
    const changed = { ...content, title: 'Must roll back' };
    const rejected = jest.spyOn(activity, 'append').mockRejectedValueOnce(new Error('Synthetic save audit failure'));
    try {
      const result = await owner.agent.patch(`/api/proposals/${id}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: 0, content: changed }).expect(500);
      expect(result.text).not.toContain(changed.title);
    } finally { rejected.mockRestore(); }
    const actor = await actorForOwner();
    const expiry = new Date(Date.now() + 500);
    await database.client.authSession.update({ where: { id: owner.digest }, data: { expiresAt: expiry } });
    const append = activity.append.bind(activity);
    const awaitedActivity: { append: (...args: Parameters<ActivityService['append']>) => Promise<unknown> } = activity;
    const delayed = jest.spyOn(awaitedActivity, 'append').mockImplementationOnce(async (tx, event) => {
      const result = await append(tx, event);
      await new Promise(resolve => setTimeout(resolve, Math.max(0, expiry.getTime() - Date.now() + 30)));
      return result;
    });
    try {
      await expect(lifecycle.save(actor, id, { expectedVersion: 0, content: changed })).rejects.toMatchObject({ status: 401 });
      expect(delayed).toHaveBeenCalledTimes(1);
    } finally {
      delayed.mockRestore();
      await database.client.authSession.update({ where: { id: owner.digest }, data: { expiresAt: new Date(Date.now() + IDLE_MS) } });
    }
    expect((await owner.agent.get(`/api/proposals/${id}/draft`).expect(200)).body).toMatchObject({ version: 0, content });
    expect(await database.client.proposalActivity.count({ where: { proposalId: id, action: 'DRAFT_SAVED' } })).toBe(0);
  });

  it('rechecks save authorization after waiting for account disablement and session logout', async () => {
    const id = (await create().expect(201)).body.proposalId as string;
    const actor = await actorForOwner();
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      await holder.query('SELECT id FROM "UserAccount" WHERE id=$1 FOR UPDATE', [ids[0]]);
      const save = lifecycle.save(actor, id, { expectedVersion: 0, content }).then(value => ({ value, error: null }), error => ({ value: null, error }));
      await waitForLock(pid);
      await holder.query('UPDATE "UserAccount" SET enabled=false WHERE id=$1', [ids[0]]);
      await holder.query('COMMIT');
      expect((await save).error).toMatchObject({ status: 401 });
      await database.client.userAccount.update({ where: { id: ids[0] }, data: { enabled: true } });
      await holder.query('BEGIN');
      await holder.query('SELECT id FROM "AuthSession" WHERE id=$1 FOR UPDATE', [actor.session!.digest]);
      const afterLogout = lifecycle.save(actor, id, { expectedVersion: 0, content }).then(value => ({ value, error: null }), error => ({ value: null, error }));
      await waitForLock(pid);
      await holder.query('DELETE FROM "AuthSession" WHERE id=$1', [actor.session!.digest]);
      await holder.query('COMMIT');
      expect((await afterLogout).error).toMatchObject({ status: 401 });
      expect((await database.client.changeProposal.findUniqueOrThrow({ where: { id } })).version).toBe(0);
      expect(await database.client.proposalActivity.count({ where: { proposalId: id, action: 'DRAFT_SAVED' } })).toBe(0);
      owner = await login(0);
    } finally {
      await holder.query('ROLLBACK'); holder.release();
      await database.client.userAccount.update({ where: { id: ids[0] }, data: { enabled: true } });
    }
  }, 15000);

  const remove = (id: string, session = owner, body: object = { expectedVersion: 0, confirmed: true }) =>
    session.agent.delete(`/api/proposals/${id}`).set('x-csrf-token', session.token).send(body);

  it('deletes complete private content and activity with exactly one minimal permanent tombstone (AC-DEC-009)', async () => {
    const full = { ...content, summary: 'Delete summary', diffText: 'Delete diff', criteria: [{ statement: 'Delete criterion', required: true }], evidence: [{ text: 'Delete evidence' }] };
    const id = (await create(owner, full).expect(201)).body.proposalId as string;
    await owner.agent.patch(`/api/proposals/${id}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: 0, content: full }).expect(200);
    const before = Date.now();
    const response = await remove(id, owner, { expectedVersion: 1, confirmed: true }).expect(204);
    expect(response.text).toBe('');
    expect(await database.client.changeProposal.findUnique({ where: { id } })).toBeNull();
    expect(await database.client.workingRevision.count({ where: { proposalId: id } })).toBe(0);
    expect(await database.client.proposalActivity.count({ where: { proposalId: id } })).toBe(0);
    const tombstone = await database.client.draftTombstone.findUniqueOrThrow({ where: { proposalId: id } });
    expect(Object.keys(tombstone).sort()).toEqual(['action', 'actorId', 'proposalId', 'timestamp']);
    expect(tombstone).toMatchObject({ proposalId: id, actorId: ids[0], action: 'DRAFT_DELETED' });
    expect(tombstone.timestamp.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(JSON.stringify(tombstone)).not.toContain('Delete');
    await owner.agent.get(`/api/proposals/${id}/draft`).expect(404);
    await owner.agent.patch(`/api/proposals/${id}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: 1, content }).expect(404);
    await remove(id, owner, { expectedVersion: 1, confirmed: true }).expect(404);
    expect((await owner.agent.get('/api/proposals').query({ limit: 100 }).expect(200)).body.items).not.toContainEqual(expect.objectContaining({ proposalId: id }));
    expect(await database.client.draftTombstone.count({ where: { proposalId: id } })).toBe(1);
  });

  it('enforces deletion authentication/ownership/CSRF/confirmation/strict version boundaries', async () => {
    const id = (await create().expect(201)).body.proposalId as string;
    await request(app.getHttpServer()).delete(`/api/proposals/${id}`).send({ expectedVersion: 0, confirmed: true }).expect(401);
    for (const session of [other, reviewer, maintainer]) expect((await remove(id, session).expect(403)).text).not.toContain(content.title);
    await owner.agent.delete(`/api/proposals/${id}`).send({ expectedVersion: 0, confirmed: true }).expect(403);
    await owner.agent.delete(`/api/proposals/${id}`).set('x-csrf-token', 'f'.repeat(64)).send({ expectedVersion: 0, confirmed: true }).expect(403);
    for (const body of [{ expectedVersion: 0 }, { expectedVersion: 0, confirmed: false }, { expectedVersion: 0, confirmed: 'true' },
      ...[-1, 0.5, '0', null, 2147483648].map(expectedVersion => ({ expectedVersion, confirmed: true })),
      ...['actorId', 'ownerId', 'reason', 'timestamp', 'content', 'state'].map(field => ({ expectedVersion: 0, confirmed: true, [field]: 'forged' }))]) await remove(id, owner, body).expect(422);
    await remove(id, owner, { expectedVersion: 1, confirmed: true }).expect(409);
    await remove(randomUUID()).expect(404);
    expect((await database.client.workingRevision.findUniqueOrThrow({ where: { proposalId: id } })).content).toEqual(content);
    expect(await database.client.draftTombstone.count({ where: { proposalId: id } })).toBe(0);
    await database.client.changeProposal.update({ where: { id }, data: { version: 2147483647 } });
    await remove(id, owner, { expectedVersion: 2147483647, confirmed: true }).expect(204);
  });

  it('denies deletion in every other state, submission marker, actual cleared-pointer history and mixed activity', async () => {
    for (const state of ['SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'IN_RELEASE', 'RELEASED', 'WITHDRAWN'] as ProposalState[]) {
      const id = (await create().expect(201)).body.proposalId as string;
      await database.client.changeProposal.update({ where: { id }, data: { state } });
      await remove(id).expect(409);
      expect((await database.client.workingRevision.findUniqueOrThrow({ where: { proposalId: id } })).content).toEqual(content);
    }
    for (const data of [{ firstSubmittedAt: new Date() }, { releaseAttachmentRef: 'synthetic-candidate' }]) {
      const id = (await create().expect(201)).body.proposalId as string;
      await database.client.changeProposal.update({ where: { id }, data }); await remove(id).expect(409);
    }
    const id = (await create().expect(201)).body.proposalId as string;
    const snapshot = await database.client.proposalRevision.create({ data: { proposalId: id, number: 1, summary: 'Keep immutable', problem: 'Keep problem', constraints: '', expectedBehavior: 'Keep behavior', diffText: 'Keep diff' } });
    await remove(id).expect(409);
    await database.client.changeProposal.update({ where: { id }, data: { currentRevisionId: snapshot.id } });
    await remove(id).expect(409);
    expect(await database.client.proposalRevision.findUniqueOrThrow({ where: { id: snapshot.id } })).toEqual(snapshot);
    const mixed = (await create().expect(201)).body.proposalId as string;
    await activity.append(database.client, { proposalId: mixed, actorId: ids[0], action: 'WITHDRAWN', summary: 'Synthetic mixed event' });
    await remove(mixed).expect(409);
    expect(await database.client.proposalActivity.count({ where: { proposalId: mixed } })).toBe(2);
  });

  it('serializes edit/delete/duplicate and simulated submission with real root barriers', async () => {
    const actor = await actorForOwner();
    for (const operation of ['edit-first', 'submit-first', 'delete-first']) {
      const id = (await create().expect(201)).body.proposalId as string;
      const holder = await pool.connect();
      try {
        await holder.query('BEGIN');
        const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
        await holder.query('SELECT id FROM "UserAccount" WHERE id=$1 FOR UPDATE', [ids[0]]);
        await holder.query('SELECT id FROM "ChangeProposal" WHERE id=$1 FOR UPDATE', [id]);
        const pending = (operation === 'delete-first' ? lifecycle.save(actor, id, { expectedVersion: 0, content }) : lifecycle.remove(actor, id, { expectedVersion: 0, confirmed: true }))
          .then(value => ({ value, error: null }), error => ({ value: null, error }));
        await waitForLock(pid);
        if (operation === 'edit-first') {
          await holder.query('UPDATE "ChangeProposal" SET version=1 WHERE id=$1', [id]);
          await holder.query('UPDATE "WorkingRevision" SET content=$2::jsonb WHERE "proposalId"=$1', [id, JSON.stringify({ ...content, title: 'Winning edit' })]);
        } else if (operation === 'submit-first') {
          // Structural fixture only: Contributor submission endpoint is deliberately not implemented yet.
          const revisionId = randomUUID();
          await holder.query(`INSERT INTO "ProposalRevision" (id,"proposalId",number,summary,problem,constraints,"expectedBehavior","diffText") VALUES ($1,$2,1,'Fixture','Keep','','Keep','Keep')`, [revisionId, id]);
          await holder.query(`UPDATE "ChangeProposal" SET state='SUBMITTED',version=1,"firstSubmittedAt"=CURRENT_TIMESTAMP,"currentRevisionId"=$2 WHERE id=$1`, [id, revisionId]);
        } else {
          await holder.query('INSERT INTO "DraftTombstone" ("proposalId","actorId") VALUES ($1,$2)', [id, ids[0]]);
          await holder.query('DELETE FROM "ProposalActivity" WHERE "proposalId"=$1', [id]);
          await holder.query('DELETE FROM "WorkingRevision" WHERE "proposalId"=$1', [id]);
          await holder.query('DELETE FROM "ChangeProposal" WHERE id=$1', [id]);
        }
        await holder.query('COMMIT');
        expect((await pending).error).toMatchObject({ status: operation === 'delete-first' ? 404 : 409 });
        expect(await database.client.draftTombstone.count({ where: { proposalId: id } })).toBe(operation === 'delete-first' ? 1 : 0);
      } finally { await holder.query('ROLLBACK'); holder.release(); }
    }
    const id = (await create().expect(201)).body.proposalId as string;
    const results = await Promise.all([remove(id), remove(id)]);
    expect(results.map(r => r.status).sort()).toEqual([204, 404]);
    expect(await database.client.draftTombstone.count({ where: { proposalId: id } })).toBe(1);
  }, 20000);

  it('guards incomplete cleanup, bare deletion, wrong actors, timestamps, immutable history and deleted-ID reuse in SQL', async () => {
    const id = (await create().expect(201)).body.proposalId as string;
    const client = await pool.connect();
    async function denied(work: () => Promise<unknown>) {
      await client.query('BEGIN');
      try { await expect(work()).rejects.toMatchObject({ code: '23514' }); }
      finally { await client.query('ROLLBACK'); }
    }
    try {
      await denied(() => client.query('DELETE FROM "ChangeProposal" WHERE id=$1', [id]));
      await denied(() => client.query('DELETE FROM "ProposalActivity" WHERE "proposalId"=$1', [id]));
      await denied(() => client.query(`UPDATE "ProposalActivity" SET summary='forged' WHERE "proposalId"=$1`, [id]));
      await denied(() => client.query('INSERT INTO "DraftTombstone" ("proposalId","actorId") VALUES ($1,$2)', [id, ids[1]]));
      for (const purge of [false, true]) await denied(async () => {
        await client.query('INSERT INTO "DraftTombstone" ("proposalId","actorId") VALUES ($1,$2)', [id, ids[0]]);
        if (purge) await client.query('DELETE FROM "ProposalActivity" WHERE "proposalId"=$1', [id]);
        return client.query('COMMIT');
      });
      expect(await database.client.proposalActivity.count({ where: { proposalId: id } })).toBe(1);
      expect(await database.client.draftTombstone.count({ where: { proposalId: id } })).toBe(0);
      await client.query('BEGIN');
      await client.query('INSERT INTO "DraftTombstone" ("proposalId","actorId","timestamp") VALUES ($1,$2,$3)', [id, ids[0], new Date(0)]);
      expect((await client.query(`SELECT timestamp > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '10 seconds' AS recent FROM "DraftTombstone" WHERE "proposalId"=$1`, [id])).rows[0].recent).toBe(true);
      await client.query('ROLLBACK');
      await remove(id).expect(204);
      await denied(() => client.query(`UPDATE "DraftTombstone" SET action='forged' WHERE "proposalId"=$1`, [id]));
      await denied(() => client.query('DELETE FROM "DraftTombstone" WHERE "proposalId"=$1', [id]));
      await denied(async () => { await client.query(`INSERT INTO "ChangeProposal" (id,"ownerId",title) VALUES ($1,$2,'Reuse')`, [id, ids[0]]); return client.query('COMMIT'); });
      const historical = (await create().expect(201)).body.proposalId as string;
      const revision = await database.client.proposalRevision.create({ data: { proposalId: historical, number: 1, summary: '', problem: 'Keep', constraints: '', expectedBehavior: 'Keep', diffText: 'Keep' } });
      await denied(() => client.query('DELETE FROM "ProposalRevision" WHERE id=$1', [revision.id]));
      await denied(() => client.query('INSERT INTO "DraftTombstone" ("proposalId","actorId") VALUES ($1,$2)', [historical, ids[0]]));
    } finally { await client.query('ROLLBACK'); client.release(); }
  });

  it('rejects concurrent deleted-ID recreation and rolls back queued simulated submission after deletion', async () => {
    for (const recreate of [true, false]) {
      const id = (await create().expect(201)).body.proposalId as string;
      const holder = await pool.connect();
      const waiter = await pool.connect();
      try {
        await holder.query('BEGIN');
        const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
        await holder.query('SELECT id FROM "ChangeProposal" WHERE id=$1 FOR UPDATE', [id]);
        await holder.query('INSERT INTO "DraftTombstone" ("proposalId","actorId") VALUES ($1,$2)', [id, ids[0]]);
        await holder.query('DELETE FROM "ProposalActivity" WHERE "proposalId"=$1', [id]);
        await holder.query('DELETE FROM "WorkingRevision" WHERE "proposalId"=$1', [id]);
        await holder.query('DELETE FROM "ChangeProposal" WHERE id=$1', [id]);
        const pending = (async () => {
          await waiter.query('BEGIN');
          if (recreate) await waiter.query(`INSERT INTO "ChangeProposal" (id,"ownerId",title) VALUES ($1,$2,'Reuse')`, [id, ids[1]]);
          else await waiter.query(`INSERT INTO "ProposalRevision" (id,"proposalId",number,summary,problem,constraints,"expectedBehavior","diffText") VALUES ($1,$2,1,'Fixture','Keep','','Keep','Keep')`, [randomUUID(), id]);
          await waiter.query('COMMIT');
        })().then(() => null, error => error as { code: string });
        // This suite's pool has two clients, so observe the blocking connection through the holder.
        const deadline = Date.now() + 4000;
        while (!(await holder.query('SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))', [pid])).rowCount) {
          if (Date.now() >= deadline) throw new Error('Expected identity-reuse lock barrier');
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        await holder.query('COMMIT');
        expect(await pending).toMatchObject({ code: recreate ? '23514' : '23503' });
        expect(await database.client.changeProposal.findUnique({ where: { id } })).toBeNull();
        expect(await database.client.proposalRevision.count({ where: { proposalId: id } })).toBe(0);
      } finally { await holder.query('ROLLBACK'); await waiter.query('ROLLBACK'); holder.release(); waiter.release(); }
    }
  }, 15000);

  it('rolls back deletion and tombstone on late database failure or transaction-end session expiry', async () => {
    const id = (await create().expect(201)).body.proposalId as string;
    const actor = await actorForOwner();
    const client = await pool.connect();
    try {
      await client.query(`CREATE FUNCTION synthetic_delete_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic delete fault' USING ERRCODE='23514'; END; $$`);
      await client.query('CREATE TRIGGER synthetic_tombstone_failure BEFORE INSERT ON "DraftTombstone" FOR EACH ROW EXECUTE FUNCTION synthetic_delete_failure()');
      await remove(id).expect(500);
      await client.query('DROP TRIGGER synthetic_tombstone_failure ON "DraftTombstone"');
      await client.query('CREATE TRIGGER synthetic_delete_failure BEFORE DELETE ON "ChangeProposal" FOR EACH ROW EXECUTE FUNCTION synthetic_delete_failure()');
      await remove(id).expect(500);
      await client.query('DROP TRIGGER synthetic_delete_failure ON "ChangeProposal"');
      await client.query('DROP FUNCTION synthetic_delete_failure()');
      expect(await database.client.draftTombstone.count({ where: { proposalId: id } })).toBe(0);
      expect(await database.client.proposalActivity.count({ where: { proposalId: id } })).toBe(1);
      expect((await database.client.workingRevision.findUniqueOrThrow({ where: { proposalId: id } })).content).toEqual(content);
      await client.query(`CREATE FUNCTION synthetic_delete_delay() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.7); RETURN OLD; END; $$`);
      await client.query('CREATE TRIGGER synthetic_delete_delay BEFORE DELETE ON "ChangeProposal" FOR EACH ROW EXECUTE FUNCTION synthetic_delete_delay()');
      await database.client.authSession.update({ where: { id: owner.digest }, data: { expiresAt: new Date(Date.now() + 400) } });
      await expect(lifecycle.remove(actor, id, { expectedVersion: 0, confirmed: true })).rejects.toMatchObject({ status: 401 });
      expect(await database.client.draftTombstone.count({ where: { proposalId: id } })).toBe(0);
      expect((await database.client.workingRevision.findUniqueOrThrow({ where: { proposalId: id } })).content).toEqual(content);
    } finally {
      await client.query('DROP TRIGGER IF EXISTS synthetic_tombstone_failure ON "DraftTombstone"');
      await client.query('DROP TRIGGER IF EXISTS synthetic_delete_failure ON "ChangeProposal"'); await client.query('DROP FUNCTION IF EXISTS synthetic_delete_failure()');
      await client.query('DROP TRIGGER IF EXISTS synthetic_delete_delay ON "ChangeProposal"'); await client.query('DROP FUNCTION IF EXISTS synthetic_delete_delay()');
      await database.client.authSession.update({ where: { id: owner.digest }, data: { expiresAt: new Date(Date.now() + IDLE_MS) } });
      client.release();
    }
  }, 15000);

  it('rechecks deletion authorization after account disablement or logout wins a real lock barrier', async () => {
    const id = (await create().expect(201)).body.proposalId as string;
    const actor = await actorForOwner();
    const holder = await pool.connect();
    try {
      for (const logout of [false, true]) {
        await holder.query('BEGIN');
        const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
        await holder.query(logout ? 'SELECT id FROM "AuthSession" WHERE id=$1 FOR UPDATE' : 'SELECT id FROM "UserAccount" WHERE id=$1 FOR UPDATE', [logout ? actor.session!.digest : ids[0]]);
        const deletion = lifecycle.remove(actor, id, { expectedVersion: 0, confirmed: true }).then(() => null, error => error as { status: number });
        await waitForLock(pid);
        await holder.query(logout ? 'DELETE FROM "AuthSession" WHERE id=$1' : 'UPDATE "UserAccount" SET enabled=false WHERE id=$1', [logout ? actor.session!.digest : ids[0]]);
        await holder.query('COMMIT');
        expect(await deletion).toMatchObject({ status: 401 });
        await database.client.userAccount.update({ where: { id: ids[0] }, data: { enabled: true } });
      }
      expect(await database.client.draftTombstone.count({ where: { proposalId: id } })).toBe(0);
      expect((await database.client.workingRevision.findUniqueOrThrow({ where: { proposalId: id } })).content).toEqual(content);
      owner = await login(0);
    } finally {
      await holder.query('ROLLBACK'); holder.release();
      await database.client.userAccount.update({ where: { id: ids[0] }, data: { enabled: true } });
    }
  }, 15000);

  it('denies anonymous/wrong-role creation/list/read, absent CSRF, forged fields and unavailable actions', async () => {
    await request(app.getHttpServer()).get('/api/proposals').expect(401);
    await request(app.getHttpServer()).get(`/api/proposals/${randomUUID()}/draft`).expect(401);
    await request(app.getHttpServer()).post('/api/proposals').send(content).expect(401);
    for (const session of [reviewer, maintainer]) {
      await create(session).expect(403);
      await session.agent.get('/api/proposals').expect(403);
    }
    const before = await database.client.changeProposal.count({ where: { ownerId: ids[0] } });
    await owner.agent.post('/api/proposals').send(content).expect(403);
    await owner.agent.post('/api/proposals').set('x-csrf-token', 'b'.repeat(64)).send(content).expect(403);
    for (const field of ['ownerId', 'state', 'actorId', 'createdAt']) await create(owner, { ...content, [field]: ids[1] }).expect(422);
    expect(await database.client.changeProposal.count({ where: { ownerId: ids[0] } })).toBe(before);
    const id = (await create().expect(201)).body.proposalId as string;
    for (const action of ['submit', 'withdraw', 'reopen']) await owner.agent.post(`/api/proposals/${id}/${action}`).set('x-csrf-token', owner.token).send({}).expect(404);
    await owner.agent.patch(`/api/proposals/${id}/draft`).set('x-csrf-token', owner.token).send({}).expect(422);
    await owner.agent.delete(`/api/proposals/${id}`).set('x-csrf-token', owner.token).send({}).expect(422);
    await owner.agent.get(`/api/proposals/${randomUUID()}/draft`).expect(404);
  });

  it('accepts max Unicode narratives above the old 100KiB parser cap; rejects limit+1 and >1MiB safely', async () => {
    const boundary = { ...content, title: '😀'.repeat(200), problem: '😀'.repeat(10000), constraints: '😀'.repeat(10000), expectedBehavior: '😀'.repeat(10000) };
    const result = await create(owner, boundary).expect(201);
    expect((await owner.agent.get(`/api/proposals/${result.body.proposalId}/draft`).expect(200)).body.content).toEqual(boundary);
    await create(owner, { ...content, problem: '😀'.repeat(10001) }).expect(422);
    await create(owner, { ...content, title: '😀'.repeat(201) }).expect(422);
    const oversized = await create(owner, { ...content, problem: 'secret'.repeat(200000) }).expect(413);
    expect(oversized.body).toMatchObject({ code: 'VALIDATION_FAILED', correlationId: expect.any(String) });
    expect(oversized.text).not.toContain('secret');
  });

  it('paginates equal timestamps without duplicate/foreign/submitted/non-DRAFT entries and scopes cursors', async () => {
    const timestamp = new Date('2026-01-01T00:00:00.000Z');
    const fixtureIds: string[] = [];
    for (let i = 0; i < 23; i++) {
      const row = await database.client.changeProposal.create({ data: { ownerId: ids[1]!, title: 'Private working draft', createdAt: timestamp } });
      await database.client.workingRevision.create({ data: { proposalId: row.id, content: { ...content, title: `Page ${i}` } } });
      fixtureIds.push(row.id);
    }
    const first = await other.agent.get('/api/proposals').expect(200);
    expect(first.body.items).toHaveLength(20);
    const last = await other.agent.get('/api/proposals').query({ cursor: first.body.nextCursor }).expect(200);
    expect(last.body.items).toHaveLength(3); expect(last.body.nextCursor).toBeNull();
    expect([...first.body.items, ...last.body.items].map((item: { proposalId: string }) => item.proposalId)).toEqual(fixtureIds.sort());
    await owner.agent.get('/api/proposals').query({ cursor: first.body.nextCursor }).expect(422);
    for (const query of [{ limit: 101 }, { ownerId: ids[0] }, { cursor: 'bad_cursor' }]) await other.agent.get('/api/proposals').query(query).expect(422);
    expect((await other.agent.get('/api/proposals').query({ limit: 100 }).expect(200)).body.items).toHaveLength(23);
    const hidden = await database.client.changeProposal.create({ data: { ownerId: ids[1]!, title: 'Hidden', state: 'WITHDRAWN' } });
    const previouslySubmitted = await database.client.changeProposal.create({ data: { ownerId: ids[1]!, title: 'Hidden', firstSubmittedAt: new Date() } });
    const page = await other.agent.get('/api/proposals').query({ limit: 100 }).expect(200);
    expect(page.body.items.map((item: { proposalId: string }) => item.proposalId)).not.toEqual(expect.arrayContaining([hidden.id, previouslySubmitted.id]));
  });

  it('rolls back a draft if required business activity fails', async () => {
    const before = await database.client.changeProposal.count({ where: { ownerId: ids[0] } });
    const workingBefore = await database.client.workingRevision.count();
    const spy = jest.spyOn(activity, 'append').mockRejectedValueOnce(new Error('synthetic audit failure'));
    try {
      const response = await create().expect(500);
      expect(response.text).not.toContain('synthetic audit failure');
      expect(await database.client.changeProposal.count({ where: { ownerId: ids[0] } })).toBe(before);
      expect(await database.client.workingRevision.count()).toBe(workingBefore);
    } finally { spy.mockRestore(); }
  });

  it('fails closed when successful-read audit cannot persist', async () => {
    const id = (await create().expect(201)).body.proposalId as string;
    const audited = lifecycle as unknown as { readAudit(): Promise<unknown> };
    const spy = jest.spyOn(audited, 'readAudit').mockRejectedValue(new Error('synthetic read audit failure'));
    try {
      for (const path of ['/api/proposals', `/api/proposals/${id}/draft`]) {
        const response = await owner.agent.get(path).expect(500);
        expect(response.text).not.toContain(content.title); expect(response.text).not.toContain(content.problem);
      }
    } finally { spy.mockRestore(); }
  });

  it('serializes account disablement and logout against draft transactions at real lock barriers', async () => {
    const actor = await actorForOwner();
    const before = await database.client.changeProposal.count({ where: { ownerId: ids[0] } });
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      await holder.query('SELECT id FROM "UserAccount" WHERE id=$1 FOR UPDATE', [ids[0]]);
      const creating = lifecycle.create(actor, content).then(value => ({ value, error: null }), error => ({ value: null, error }));
      await waitForLock(pid);
      await holder.query('UPDATE "UserAccount" SET enabled=false WHERE id=$1', [ids[0]]);
      await holder.query('COMMIT');
      expect((await creating).error).toMatchObject({ status: 401 });
      expect(await database.client.changeProposal.count({ where: { ownerId: ids[0] } })).toBe(before);
      await database.client.userAccount.update({ where: { id: ids[0] }, data: { enabled: true } });

      await holder.query('BEGIN');
      await holder.query('SELECT id FROM "AuthSession" WHERE id=$1 FOR UPDATE', [actor.session!.digest]);
      const listing = lifecycle.list(actor, { limit: 20 }).then(value => ({ value, error: null }), error => ({ value: null, error }));
      await waitForLock(pid);
      await holder.query('DELETE FROM "AuthSession" WHERE id=$1', [actor.session!.digest]);
      await holder.query('COMMIT');
      expect((await listing).error).toMatchObject({ status: 401 });
      owner = await login(0);
    } finally {
      await holder.query('ROLLBACK'); holder.release();
      await database.client.userAccount.update({ where: { id: ids[0] }, data: { enabled: true } });
    }
  }, 15000);

  it('rolls back create and withholds a read when the persisted session expires before transaction completion', async () => {
    const actor = await actorForOwner();
    const before = await database.client.changeProposal.count({ where: { ownerId: ids[0] } });
    const append = activity.append.bind(activity);
    const expiresAt = new Date(Date.now() + 500);
    await database.client.authSession.update({ where: { id: actor.session!.digest }, data: { expiresAt } });
    const awaitedActivity: { append: (...args: Parameters<ActivityService['append']>) => Promise<unknown> } = activity;
    const spy = jest.spyOn(awaitedActivity, 'append').mockImplementationOnce(async (tx, event) => {
      const result = await append(tx, event);
      await new Promise(resolve => setTimeout(resolve, Math.max(0, expiresAt.getTime() - Date.now() + 30)));
      return result;
    });
    try {
      await expect(lifecycle.create(actor, content)).rejects.toMatchObject({ status: 401 });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(await database.client.changeProposal.count({ where: { ownerId: ids[0] } })).toBe(before);
    } finally { spy.mockRestore(); }
    await database.client.authSession.update({ where: { id: actor.session!.digest }, data: { expiresAt: new Date(Date.now() + IDLE_MS) } });
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      await holder.query('SELECT id FROM "UserAccount" WHERE id=$1 FOR UPDATE', [ids[0]]);
      const listing = lifecycle.list(actor, { limit: 20 }).then(value => ({ value, error: null }), error => ({ value: null, error }));
      await waitForLock(pid);
      // Prisma timestamps are UTC; pass ISO text so pg's local Date serialization cannot shift this fixture.
      await holder.query('UPDATE "AuthSession" SET "expiresAt"=$1 WHERE id=$2', [new Date(Date.now() - 1).toISOString(), actor.session!.digest]);
      await holder.query('COMMIT');
      expect((await listing).error).toMatchObject({ status: 401 });
      owner = await login(0);
    } finally { await holder.query('ROLLBACK'); holder.release(); }
  }, 15000);

  it('cannot renew a session that expires while touch waits on its row lock', async () => {
    const store = app.get(PostgresSessionStore);
    const rawId = randomUUID();
    const digest = createHash('sha256').update(rawId).digest('hex');
    const data = { cookie: { originalMaxAge: IDLE_MS }, issuedAt: Date.now(), csrfToken: 'b'.repeat(64) } as SessionData;
    await new Promise<void>((resolve, reject) => store.set(rawId, data, error => error ? reject(error) : resolve()));
    const expiry = new Date(Date.now() + 500);
    await database.client.authSession.update({ where: { id: digest }, data: { expiresAt: expiry } });
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      await holder.query('SELECT id FROM "AuthSession" WHERE id=$1 FOR UPDATE', [digest]);
      const touching = new Promise<void>((resolve, reject) => store.touch(rawId, data, error => error ? reject(error) : resolve()));
      await waitForLock(pid);
      await new Promise(resolve => setTimeout(resolve, Math.max(0, expiry.getTime() - Date.now() + 30)));
      await holder.query('COMMIT'); await touching;
      expect((await database.client.authSession.findUniqueOrThrow({ where: { id: digest } })).expiresAt).toEqual(expiry);
    } finally {
      await holder.query('ROLLBACK'); holder.release();
      await database.client.authSession.deleteMany({ where: { id: digest } });
    }
  }, 15000);

  it('rechecks account/session inside the transaction, rejecting disabled/stale/expired/logged-out access', async () => {
    const session = await database.client.authSession.findUniqueOrThrow({ where: { id: owner.digest } });
    const data = JSON.parse(session.data) as { issuedAt: number; csrfToken: string };
    const actor: BusinessActor = { accountId: ids[0]!, accountVersion: 1, session: { digest: session.id, ...data } };
    await database.client.userAccount.update({ where: { id: ids[0] }, data: { enabled: false } });
    await expect(lifecycle.create(actor, content)).rejects.toMatchObject({ status: 401 });
    await database.client.userAccount.update({ where: { id: ids[0] }, data: { enabled: true, version: 2 } });
    await expect(lifecycle.list(actor, { limit: 20 })).rejects.toMatchObject({ status: 401 });
    await database.client.userAccount.update({ where: { id: ids[0] }, data: { version: 1 } });
    await database.client.authSession.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    await expect(lifecycle.create(actor, content)).rejects.toMatchObject({ status: 401 });
    await database.client.authSession.delete({ where: { id: session.id } });
    await expect(lifecycle.list(actor, { limit: 20 })).rejects.toMatchObject({ status: 401 });
    await owner.agent.get('/api/proposals').expect(401);
  });

  it('rejects disabled and stale-account HTTP sessions and invalidates logout', async () => {
    await database.client.userAccount.update({ where: { id: ids[1] }, data: { enabled: false } });
    await other.agent.get('/api/proposals').expect(401);
    await database.client.userAccount.update({ where: { id: ids[1] }, data: { enabled: true } });
    other = await login(1);
    await database.client.userAccount.update({ where: { id: ids[1] }, data: { version: 2 } });
    await create(other).expect(401);
    other = await login(1);
    await other.agent.post('/api/auth/logout').set('x-csrf-token', other.token).expect(204);
    await other.agent.get('/api/proposals').expect(401);
  });
});
