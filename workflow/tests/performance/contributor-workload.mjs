import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const DATABASE = 'specsentry_contributor_perf_test';
const USERS = 20;
const WARMUP_MS = 60_000;
const MEASURE_MS = 300_000;
const PASSWORD = 'synthetic-performance-password';
const endpoints = ['pool', 'assigned', 'detail', 'revisions', 'activity'];
const loopback = host => ['127.0.0.1', 'localhost', '[::1]'].includes(host);

function configuration(databaseValue, baseValue) {
  assert(databaseValue && baseValue, 'Explicit PERF_DATABASE_URL and PERF_BASE_URL required; .env is never loaded');
  const database = new URL(databaseValue); const base = new URL(baseValue);
  assert(['postgres:', 'postgresql:'].includes(database.protocol) && loopback(database.hostname)
    && database.pathname === `/${DATABASE}` && !database.search && !database.hash, 'Dedicated loopback performance database required');
  assert(base.protocol === 'http:' && loopback(base.hostname) && base.port && base.pathname === '/'
    && !base.username && !base.password && !base.search && !base.hash, 'Explicit loopback HTTP server origin and port required');
  return { database: database.href, base: base.origin };
}

function p95(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

function assertQuotaCoordinator(rows) {
  assert.deepEqual(rows.map(row => row.id), ['reviewer-patch-risk'], 'Only the exact migration-created quota coordinator is allowed');
}

async function seed(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const identity = (await client.query('SELECT current_database() AS name, host(inet_server_addr()) AS address')).rows[0];
    assert(identity.name === DATABASE && ['127.0.0.1', '::1'].includes(identity.address), 'Connected database must be the dedicated loopback database');
    const tables = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations'`);
    assert(tables.rows.some(row => row.tablename === 'ChangeProposal'), 'Apply all current migrations first');
    assert(tables.rows.some(row => row.tablename === 'AiQuotaCoordinator'), 'Required quota coordinator migration is missing');
    for (const { tablename } of tables.rows) {
      if (tablename === 'AiQuotaCoordinator') {
        assertQuotaCoordinator((await client.query('SELECT id FROM "AiQuotaCoordinator" ORDER BY id')).rows);
        continue;
      }
      const result = await client.query(`SELECT count(*)::int AS count FROM "${tablename.replaceAll('"', '""')}"`);
      assert.equal(result.rows[0].count, 0, 'Performance seed refuses any nonempty database; provision a fresh database');
    }
    const { default: argon2 } = await import('argon2');
    const hash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    await client.query(`INSERT INTO "UserAccount"(id,username,"passwordHash",role)
      SELECT 'perf-reviewer-'||n,'perf-reviewer-'||n,$1,'REVIEWER'::"AccountRole" FROM generate_series(0,19)n
      UNION ALL SELECT 'perf-owner-'||n,'perf-owner-'||n,$1,'CONTRIBUTOR'::"AccountRole" FROM generate_series(0,9)n`, [hash]);
    await client.query(`INSERT INTO "ChangeProposal"(id,"ownerId",title,state,"firstSubmittedAt",version)
      SELECT 'perf-proposal-'||p,'perf-owner-'||((p-1)%10),'Synthetic performance proposal '||p,
      (CASE (p-1)%5 WHEN 0 THEN 'SUBMITTED' WHEN 1 THEN 'CHANGES_REQUESTED' WHEN 2 THEN 'IN_REVIEW'
        WHEN 3 THEN 'CHANGES_REQUESTED' ELSE 'WITHDRAWN' END)::"ProposalState",now()-interval '3 days',14
      FROM generate_series(1,1000)p`);
    await client.query(`INSERT INTO "ProposalRevision"(id,"proposalId",number,summary,problem,constraints,"expectedBehavior","diffText","submittedAt")
      SELECT 'perf-revision-'||p||'-'||r,'perf-proposal-'||p,r,'Synthetic summary for revision '||r,
      repeat('Synthetic problem and affected users. ',40),repeat('Synthetic constraint. ',10),repeat('Expected safe behavior. ',40),
      E'--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n',now()-interval '3 days'+r*interval '1 hour'
      FROM generate_series(1,1000)p CROSS JOIN generate_series(1,3)r`);
    await client.query(`INSERT INTO "AcceptanceCriterion"(id,"revisionId","stableKey",statement,required)
      SELECT 'perf-criterion-'||p||'-'||r,'perf-revision-'||p||'-'||r,'stable-'||p,'The synthetic expected behavior holds.',true
      FROM generate_series(1,1000)p CROSS JOIN generate_series(1,3)r`);
    await client.query(`INSERT INTO "TestEvidence"(id,"revisionId",text,"evidenceHash")
      SELECT 'perf-evidence-'||p||'-'||r,'perf-revision-'||p||'-'||r,'Synthetic optional plain-text evidence.',repeat('a',64)
      FROM generate_series(1,1000)p CROSS JOIN generate_series(1,3)r`);
    await client.query(`INSERT INTO "ReviewAssignment"(id,"proposalId","revisionId","reviewerId",status,"assignedAt","endedAt","endReason")
      SELECT 'perf-assignment-'||p||'-'||r,'perf-proposal-'||p,'perf-revision-'||p||'-'||r,
      'perf-reviewer-'||(((p-1)/5)%20),
      (CASE WHEN r=3 AND (p-1)%5 IN(2,3) THEN 'ACTIVE' ELSE 'CLOSED' END)::"ReviewAssignmentStatus",
      now()-interval '3 days'+r*interval '1 hour'+interval '1 minute',
      CASE WHEN r=3 AND (p-1)%5 IN(2,3) THEN NULL ELSE now()-interval '2 days'+r*interval '1 hour' END,
      (CASE WHEN r=3 AND (p-1)%5 IN(2,3) THEN NULL WHEN r<3 THEN 'REVISION_REPLACED'
        WHEN (p-1)%5=4 THEN 'WITHDRAWN' ELSE 'DROPPED' END)::"AssignmentEndReason"
      FROM generate_series(1,1000)p CROSS JOIN generate_series(1,3)r`);
    await client.query(`UPDATE "ChangeProposal" SET "currentRevisionId"='perf-revision-'||split_part(id,'-',3)||'-3',
      "currentAssignmentId"=CASE WHEN state IN('IN_REVIEW','CHANGES_REQUESTED') AND (split_part(id,'-',3)::int-1)%5 IN(2,3)
      THEN 'perf-assignment-'||split_part(id,'-',3)||'-3' ELSE NULL END`);
    await client.query(`INSERT INTO "ReviewFinding"(id,"proposalId","revisionId","assignmentId","actorId","criterionId",severity,description,"mutationVersion")
      SELECT 'perf-finding-'||p||'-'||f,'perf-proposal-'||p,'perf-revision-'||p||'-'||((f-1)%3+1),
      'perf-assignment-'||p||'-'||((f-1)%3+1),'perf-reviewer-'||(((p-1)/5)%20),
      'perf-criterion-'||p||'-'||((f-1)%3+1),'MEDIUM','Synthetic unresolved finding '||f,f+3
      FROM generate_series(1,1000)p CROSS JOIN generate_series(1,10)f`);
    await client.query(`INSERT INTO "ReviewDecision"(id,"proposalId","revisionId","assignmentId","actorId",decision,note,"mutationVersion")
      SELECT 'perf-decision-'||p,'perf-proposal-'||p,'perf-revision-'||p||'-3','perf-assignment-'||p||'-3',
      'perf-reviewer-'||(((p-1)/5)%20),'REQUEST_CHANGES','Synthetic changes requested.',14
      FROM generate_series(1,1000)p WHERE (p-1)%5 IN(1,3)`);
    await client.query(`INSERT INTO "ProposalActivity"(id,"proposalId","revisionId","actorId",action,summary,timestamp)
      SELECT 'perf-submitted-'||p||'-'||r,'perf-proposal-'||p,'perf-revision-'||p||'-'||r,'perf-owner-'||((p-1)%10),
      (CASE WHEN r=1 THEN 'SUBMITTED' ELSE 'RESUBMITTED' END)::"ProposalActivityAction",'Synthetic submitted revision.',
      now()-interval '3 days'+r*interval '1 hour' FROM generate_series(1,1000)p CROSS JOIN generate_series(1,3)r`);
    await client.query(`INSERT INTO "ProposalActivity"(id,"proposalId","revisionId","assignmentId","actorId",action,summary)
      SELECT 'perf-finding-activity-'||p||'-'||f,'perf-proposal-'||p,'perf-revision-'||p||'-'||((f-1)%3+1),
      'perf-assignment-'||p||'-'||((f-1)%3+1),'perf-reviewer-'||(((p-1)/5)%20),'FINDING_CREATED','Synthetic finding created.'
      FROM generate_series(1,1000)p CROSS JOIN generate_series(1,10)f`);
    const counts = (await client.query(`SELECT (SELECT count(*)::int FROM "ChangeProposal") AS proposals,
      (SELECT count(*)::int FROM "ProposalRevision") AS revisions,(SELECT count(*)::int FROM "ReviewFinding") AS findings,
      (SELECT count(*)::int FROM "UserAccount" WHERE role='REVIEWER') AS reviewers,
      (SELECT count(*)::int FROM "ChangeProposal" p JOIN "ReviewAssignment" a ON a.id=p."currentAssignmentId"
        WHERE a.status='ACTIVE' AND a."revisionId"=p."currentRevisionId") AS current_assignments`)).rows[0];
    assert.deepEqual(counts, { proposals: 1000, revisions: 3000, findings: 10000, reviewers: 20, current_assignments: 400 });
    await client.query('COMMIT');
    await pool.query('ANALYZE');
    return counts;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

async function login(base, user) {
  let cookie = '';
  async function request(path, options = {}) {
    const response = await fetch(`${base}${path}`, { ...options, redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { 'X-Forwarded-Proto': 'https', ...options.headers, ...(cookie ? { Cookie: cookie } : {}) } });
    const setCookie = response.headers.getSetCookie().find(value => value.startsWith('specsentry.sid='));
    if (setCookie) cookie = setCookie.split(';')[0];
    return response;
  }
  const bootstrap = await request('/api/auth/csrf'); assert.equal(bootstrap.status, 200);
  const token = (await bootstrap.json()).csrfToken;
  const response = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify({ username: `perf-reviewer-${user}`, password: PASSWORD }) });
  assert.equal(response.status, 200, 'Measured users must authenticate normally against the seeded server');
  const account = (await response.json()).account; assert.equal(account.id, `perf-reviewer-${user}`);
  return request;
}

function requestPath(kind, user, turn) {
  const proposal = `perf-proposal-${Math.floor(turn / 5) % 10 * 100 + user * 5 + 3}`;
  return kind === 'pool' ? '/api/review-pool' : kind === 'assigned' ? '/api/reviews/assignments'
    : `/api/proposals/${proposal}${kind === 'detail' ? '' : `/${kind}`}`;
}

async function phase(clients, duration, samples) {
  const started = performance.now(); const deadline = started + duration;
  await Promise.all(clients.map(async (request, user) => {
    let turn = user;
    while (performance.now() < deadline) {
      const kind = endpoints[turn % endpoints.length]; const start = performance.now(); let status;
      try {
        const response = await request(requestPath(kind, user, turn)); status = String(response.status);
        const body = await response.json();
        if (response.status === 200 && (kind === 'detail' ? typeof body.id !== 'string' : !Array.isArray(body.items))) status = 'INVALID_BODY';
      } catch { status = 'NETWORK_OR_INVALID_JSON'; }
      if (samples) samples[kind].push({ elapsed: performance.now() - start, status });
      else assert.equal(status, '200', `Warmup ${kind} failed; no successful performance claim is possible`);
      turn += 1;
    }
  }));
  return performance.now() - started;
}

async function main() {
  const config = configuration(process.env.PERF_DATABASE_URL, process.env.PERF_BASE_URL);
  const { default: pg } = await import('pg'); const pool = new pg.Pool({ connectionString: config.database, max: 2 });
  try {
    const fixture = await seed(pool);
    const clients = await Promise.all(Array.from({ length: USERS }, (_, user) => login(config.base, user)));
    const sessions = await pool.query('SELECT count(*)::int AS count FROM "AuthSession" WHERE data::jsonb->>\'userId\' LIKE \'perf-reviewer-%\'');
    assert.equal(sessions.rows[0].count, USERS, 'Server sessions must be persisted in the dedicated performance database');
    const warmupMs = await phase(clients, WARMUP_MS);
    const samples = Object.fromEntries(endpoints.map(kind => [kind, []]));
    const startedAt = new Date().toISOString(); const measuredMs = await phase(clients, MEASURE_MS, samples);
    const totals = Object.values(samples).flat(); const successes = totals.filter(sample => sample.status === '200');
    const summary = values => ({ requests: values.length, successes: values.filter(sample => sample.status === '200').length,
      errors: values.filter(sample => sample.status !== '200').length,
      errorRate: values.length ? values.filter(sample => sample.status !== '200').length / values.length : null,
      statuses: values.reduce((counts, sample) => ({ ...counts, [sample.status]: (counts[sample.status] ?? 0) + 1 }), {}),
      p95SuccessfulMs: p95(values.filter(sample => sample.status === '200').map(sample => sample.elapsed)) });
    const overall = summary(totals);
    const passed = successes.length === totals.length && totals.length > 0 && overall.p95SuccessfulMs < 800;
    console.log(JSON.stringify({ requirement: 'NFR-PERF-001', source: 'authenticated loopback HTTP, full response body included',
      fixture, users: USERS, startedAt, finishedAt: new Date().toISOString(), warmupMs, measuredMs,
      protocol: { requestedWarmupMs: WARMUP_MS, requestedMeasureMs: MEASURE_MS, targetP95Ms: 800,
        excludes: ['AI calls', 'static assets', 'login setup', 'warmup'], errorsInvalidatePass: true },
      endpoints: Object.fromEntries(endpoints.map(kind => [kind, summary(samples[kind])])), overall, passed }, null, 2));
    if (!passed) process.exitCode = 1;
  } finally { await pool.end(); }
}

if (process.argv[2] === '--self-test') {
  assert.equal(process.argv.length, 3);
  const safe = 'postgresql://synthetic:synthetic@127.0.0.1:55447/specsentry_contributor_perf_test';
  assert.equal(configuration(safe, 'http://127.0.0.1:3197').base, 'http://127.0.0.1:3197');
  for (const unsafe of [undefined, safe.replace('_perf_test', '_completion_test'), safe.replace('127.0.0.1', 'example.com'), `${safe}?schema=other`])
    assert.throws(() => configuration(unsafe, 'http://127.0.0.1:3197'));
  for (const unsafe of ['https://example.com:3197', 'http://127.0.0.1', 'http://127.0.0.1:3197/other'])
    assert.throws(() => configuration(safe, unsafe));
  assert.equal(p95([]), null); assert.equal(p95(Array.from({ length: 100 }, (_, index) => index + 1)), 95);
  assertQuotaCoordinator([{ id: 'reviewer-patch-risk' }]);
  for (const rows of [[], [{ id: 'unexpected' }], [{ id: 'reviewer-patch-risk' }, { id: 'extra' }]])
    assert.throws(() => assertQuotaCoordinator(rows));
  for (let user = 0; user < USERS; user += 1) for (let turn = 0; turn < 100; turn += 1) {
    const proposal = Number(requestPath('detail', user, turn).split('-').at(-1));
    assert.equal(Math.floor((proposal - 1) / 5) % 20, user); assert.equal((proposal - 1) % 5, 2);
    assert(proposal >= 1 && proposal <= 1000);
  }
  console.log('Performance guards, p95 and all 20 reviewer ownership schedules passed; no database accessed.');
} else {
  assert.equal(process.argv.length, 2, 'Only --self-test is supported; the acceptance protocol duration is fixed');
  await main().catch(() => { console.error('Performance setup or execution failed; inspect the isolated test environment. No normal database was selected.'); process.exitCode = 1; });
}
