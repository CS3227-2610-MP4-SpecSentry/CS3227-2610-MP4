/* global Response */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { createCandidate, readCandidate, validateCandidate, validateCiRun, validateReleaseRun,
  validateImageReference, verifyMigrationInventory, verifyMigrationManifest } from '../tooling/release-candidate.mjs';
import { deployImage, renderRequest } from '../tooling/render-deploy.mjs';
import { validateDirectDatabaseUrl, verifyDatabase } from '../tooling/verify-database.mjs';
import { validateDeploymentTarget, verifyRemote } from '../tooling/verify-remote.mjs';

const repository = 'CS3227-2610-MP4-SpecSentry/CS3227-2610-MP4';
const sha = 'a'.repeat(40); const tree = 'b'.repeat(40); const digest = `sha256:${'c'.repeat(64)}`;
const image = `ghcr.io/cs3227-2610-mp4-specsentry/cs3227-2610-mp4@${digest}`;
const fingerprint = 'd'.repeat(64);
const candidateInput = { sourceSha: sha, sourceTree: tree, image, imageDigest: digest,
  migrationManifestDigest: 'e'.repeat(64), developmentRunId: '1234', developmentDeployId: 'dep-abc',
  developmentServiceFingerprint: fingerprint, developmentHostFingerprint: 'f'.repeat(64),
  developmentDatabaseFingerprint: '1'.repeat(64), developmentCiRunId: '5678' };

test('release candidate accepts only the approved immutable identity and strict fields', async () => {
  const candidate = createCandidate(candidateInput, new Date('2026-11-07T00:00:00.000Z'));
  assert.equal(validateCandidate(candidate).image, image);
  assert.throws(() => validateImageReference(image.replace('@sha256:', ':main@sha256:'), digest), /approved GHCR/);
  assert.throws(() => validateCandidate({ ...candidate, unexpected: true }), /fields/);
  assert.throws(() => createCandidate({ ...candidateInput, imageDigest: 'sha256:short' }), /digest/);
  const directory = await mkdtemp(join(tmpdir(), 'specsentry-candidate-'));
  try {
    const path = join(directory, 'candidate.json');
    await writeFile(path, `${JSON.stringify(candidate)}\n`);
    assert.equal((await readCandidate(path)).developmentRunId, '1234');
  } finally { await rm(directory, { recursive: true }); }
});

test('development release and underlying CI run identities are exact', () => {
  const run = { id: 1234, event: 'push', status: 'completed', conclusion: 'success', head_branch: 'master',
    head_sha: sha, path: '.github/workflows/application-release.yml', repository: { full_name: repository },
    head_repository: { full_name: repository } };
  assert.deepEqual(validateReleaseRun(run, '1234', sha), { runId: '1234', sourceSha: sha });
  assert.deepEqual(validateReleaseRun({ ...run, event: 'workflow_dispatch' }, '1234', sha),
    { runId: '1234', sourceSha: sha });
  for (const changed of [{ event: 'workflow_run' }, { conclusion: 'failure' }, { head_branch: 'develop' },
    { path: '.github/workflows/ci.yml' }, { head_repository: { full_name: 'fork/repo' } }])
    assert.throws(() => validateReleaseRun({ ...run, ...changed }, '1234', sha), /not trusted/);
  const ci = { ...run, id: 5678, path: '.github/workflows/ci.yml' };
  assert.deepEqual(validateCiRun(ci, '5678', sha), { sourceSha: sha });
  assert.throws(() => validateCiRun({ ...ci, head_sha: '0'.repeat(40) }, '5678', sha), /not trusted/);
});

test('committed migration manifest is ordered and checksum protected', async () => {
  const result = await verifyMigrationManifest();
  assert.equal(result.entries.length, 10);
  const directory = await mkdtemp(join(tmpdir(), 'specsentry-manifest-'));
  try {
    const original = await readFile(resolve('workflow/deployment/migrations.sha256'), 'utf8');
    const path = join(directory, 'migrations.sha256');
    await writeFile(path, `${'0'.repeat(64)}${original.slice(64)}`);
    await assert.rejects(() => verifyMigrationManifest(path), /checksum mismatch/);
  } finally { await rm(directory, { recursive: true }); }
});

test('migration inventory rejects an unreviewed migration before deployment', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'specsentry-migration-inventory-'));
  try {
    const reviewed = '20260101000000_reviewed';
    await mkdir(join(directory, reviewed));
    await writeFile(join(directory, reviewed, 'migration.sql'), 'SELECT 1;\n');
    await writeFile(join(directory, 'migration_lock.toml'), 'provider = "postgresql"\n');
    const entries = [{ name: reviewed }];
    assert.deepEqual(await verifyMigrationInventory(entries, directory), [reviewed]);
    const unreviewed = '20260102000000_unreviewed';
    await mkdir(join(directory, unreviewed));
    await writeFile(join(directory, unreviewed, 'migration.sql'), 'SELECT 2;\n');
    await assert.rejects(() => verifyMigrationInventory(entries, directory), /exact migration inventory/);
  } finally { await rm(directory, { recursive: true }); }
});

const renderImage = { ref: image, sha: digest };
const jsonResponse = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json', ...headers },
});

test('Render client deploys and polls only the returned immutable deploy', async () => {
  const calls = [];
  const responses = [jsonResponse({ id: 'dep-abc', status: 'created', image: renderImage }, 201),
    jsonResponse({ id: 'dep-abc', status: 'update_in_progress', image: renderImage }),
    jsonResponse({ id: 'dep-abc', status: 'live', image: renderImage })];
  const result = await deployImage({ serviceId: 'srv-abc', token: 'x'.repeat(32), image,
    fetchImpl: async (url, options) => { calls.push({ url: String(url), options }); return responses.shift(); },
    sleep: async () => undefined, pollIntervalMs: 0 });
  assert.deepEqual(result, { deployId: 'dep-abc', imageDigest: digest });
  assert.equal(calls[0].url, 'https://api.render.com/v1/services/srv-abc/deploys');
  assert.match(calls[0].options.body, new RegExp(digest));
  assert.ok(calls.slice(1).every(({ url }) => url.endsWith('/deploys/dep-abc')));
  assert.ok(calls.every(({ options }) => options.redirect === 'manual'));
});

test('Render client bounds retries and rejects redirects, auth failure and wrong identity', async () => {
  let attempts = 0;
  const retried = await renderRequest('/v1/services/srv-abc/deploys/dep-abc', { token: 'x'.repeat(32),
    sleep: async () => undefined, fetchImpl: async () => {
      attempts += 1;
      return attempts === 1 ? jsonResponse({ error: 'busy' }, 429, { 'retry-after': '0' }) : jsonResponse({ ok: true });
    } });
  assert.deepEqual(retried, { ok: true }); assert.equal(attempts, 2);
  await assert.rejects(() => renderRequest('/v1/services/srv-abc/deploys', { token: 'x'.repeat(32),
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'https://example.test/' } }) }), /redirect/);
  attempts = 0;
  await assert.rejects(() => renderRequest('/v1/services/srv-abc/deploys', { token: 'x'.repeat(32),
    fetchImpl: async () => { attempts += 1; return jsonResponse({ error: 'no' }, 401); } }), /401/);
  assert.equal(attempts, 1);
  await assert.rejects(() => deployImage({ serviceId: 'srv-abc', token: 'x'.repeat(32), image,
    fetchImpl: async () => jsonResponse({ id: 'dep-other', status: 'created',
      image: { ref: image.replace(digest, `sha256:${'0'.repeat(64)}`), sha: digest } }, 201) }), /image reference/);
});

function databaseClient({ timezone = 'UTC', version = '170000', migrations = [], objects = true } = {}) {
  return { connect: async () => undefined, end: async () => undefined,
    query: async (sql, values) => {
      if (sql === 'SHOW server_version_num') return { rows: [{ server_version_num: version }] };
      if (sql.includes("current_setting('TimeZone')")) return { rows: [{ timezone }] };
      if (sql.includes('to_regclass')) return { rows: [{ migration_table: migrations === null ? null : '_prisma_migrations' }] };
      if (sql.includes('FROM "_prisma_migrations"')) return { rows: migrations ?? [] };
      const names = objects ? values[0] : [];
      if (sql.includes('FROM pg_class')) return { rows: names.map((relname) => ({ relname })) };
      if (sql.includes('FROM pg_constraint')) return { rows: names.map((conname) => ({ conname })) };
      if (sql.includes('FROM pg_trigger')) return { rows: names.map((tgname) => ({ tgname })) };
      if (sql.includes('FROM pg_indexes')) return { rows: names.map((indexname) => ({ indexname })) };
      throw new Error(`Unexpected query: ${sql}`);
    } };
}
const dbUrl = 'postgresql://user:pass@ep-dev.neon.tech/app?sslmode=verify-full&channel_binding=require';
const oneMigration = { entries: [{ name: '20260101000000_test', checksum: '1'.repeat(64) }] };

test('database verifier enforces direct Neon TLS, target host, UTC and PostgreSQL 14-18', async () => {
  assert.equal(validateDirectDatabaseUrl(dbUrl, 'ep-dev.neon.tech').hostname, 'ep-dev.neon.tech');
  assert.throws(() => validateDirectDatabaseUrl(dbUrl.replace('ep-dev', 'ep-dev-pooler'), 'ep-dev-pooler.neon.tech'), /direct/);
  assert.throws(() => validateDirectDatabaseUrl(dbUrl.replace('?sslmode=verify-full&channel_binding=require', ''), 'ep-dev.neon.tech'), /TLS/);
  assert.throws(() => validateDirectDatabaseUrl(dbUrl, 'ep-prod.neon.tech'), /protected environment/);
  await assert.rejects(() => verifyDatabase({ mode: 'preflight', url: dbUrl, expectedHost: 'ep-dev.neon.tech',
    manifest: oneMigration, clientFactory: async () => databaseClient({ timezone: 'Asia/Singapore', migrations: [] }) }), /UTC/);
  await assert.rejects(() => verifyDatabase({ mode: 'preflight', url: dbUrl, expectedHost: 'ep-dev.neon.tech',
    manifest: oneMigration, clientFactory: async () => databaseClient({ version: '130000', migrations: [] }) }), /14-18/);
  const postgres18 = await verifyDatabase({ mode: 'preflight', url: dbUrl, expectedHost: 'ep-dev.neon.tech',
    manifest: oneMigration, clientFactory: async () => databaseClient({ version: '180000', migrations: [] }) });
  assert.equal(postgres18.version, 180000);
  await assert.rejects(() => verifyDatabase({ mode: 'preflight', url: dbUrl, expectedHost: 'ep-dev.neon.tech',
    manifest: oneMigration, clientFactory: async () => databaseClient({ version: '190000', migrations: [] }) }), /14-18/);
});

test('database verifier rejects TLS downgrade, duplicate and session-override parameters', () => {
  const prefix = 'postgresql://user:pass@ep-dev.neon.tech/app?';
  for (const query of [
    'sslmode=require',
    'sslmode=require&sslmode=no-verify',
    'sslmode=verify-full&sslmode=no-verify',
    'sslmode=verify-full&uselibpqcompat=true',
    'sslmode=verify-full&options=-c%20TimeZone%3DUTC',
    'sslmode=verify-full&sslrootcert=/tmp/untrusted.pem',
    'sslmode=verify-full&channel_binding=disable',
    'sslmode=verify-full&channel_binding=require&channel_binding=disable',
  ]) assert.throws(() => validateDirectDatabaseUrl(`${prefix}${query}`, 'ep-dev.neon.tech'), /parameter|TLS|channel/);
  assert.equal(validateDirectDatabaseUrl(`${prefix}sslmode=verify-full`, 'ep-dev.neon.tech').hostname, 'ep-dev.neon.tech');
});

test('database verifier rejects failed/drifted migrations and probes postflight schema', async () => {
  const applied = [{ migration_name: oneMigration.entries[0].name, checksum: oneMigration.entries[0].checksum,
    finished_at: new Date(), rolled_back_at: null }];
  const result = await verifyDatabase({ mode: 'postflight', url: dbUrl, expectedHost: 'ep-dev.neon.tech', manifest: oneMigration,
    clientFactory: async () => databaseClient({ migrations: applied }) });
  assert.equal(result.migrationCount, 1);
  await assert.rejects(() => verifyDatabase({ mode: 'preflight', url: dbUrl, expectedHost: 'ep-dev.neon.tech', manifest: oneMigration,
    clientFactory: async () => databaseClient({ migrations: [{ ...applied[0], finished_at: null }] }) }), /failed or unfinished/);
  await assert.rejects(() => verifyDatabase({ mode: 'postflight', url: dbUrl, expectedHost: 'ep-dev.neon.tech', manifest: oneMigration,
    clientFactory: async () => databaseClient({ migrations: applied, objects: false }) }), /Required table/);
});

function smokeResponses(sourceSha = sha) {
  const secureCookie = 'specsentry.sid=session2; Path=/; HttpOnly; Secure; SameSite=Lax';
  return [jsonResponse({ status: 'ok', service: 'specsentry', deployment: { sourceRevision: sourceSha } }),
    jsonResponse({ status: 'ready' }), new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
    jsonResponse({ csrfToken: '1'.repeat(64) }, 200, { 'set-cookie': 'specsentry.sid=session1; Path=/; HttpOnly; Secure; SameSite=Lax' }),
    jsonResponse({ account: { id: 'u1', username: 'release', role: 'RELEASE_MAINTAINER' }, csrfToken: '2'.repeat(64), expiresAt: 1 }, 200,
      { 'set-cookie': secureCookie }),
    jsonResponse({ account: { id: 'u1', username: 'release', role: 'RELEASE_MAINTAINER' }, csrfToken: '2'.repeat(64), expiresAt: 1 }),
    jsonResponse({ items: [], nextCursor: null }), new Response(null, { status: 204 })];
}

test('remote verifier checks HTTPS source marker, secure session, CSRF and safe role read', async () => {
  const calls = []; const responses = smokeResponses();
  const result = await verifyRemote({ baseUrl: 'https://dev.example.test', expectedHost: 'dev.example.test',
    expectedSourceSha: sha, credentials: { username: 'release', password: 'synthetic-password' },
    fetchImpl: async (url, options) => { calls.push({ url: String(url), options }); return responses.shift(); } });
  assert.deepEqual(result, { host: 'dev.example.test', sourceSha: sha });
  assert.equal(calls.at(-1).url, 'https://dev.example.test/api/auth/logout');
  assert.equal(calls.at(-1).options.headers['x-csrf-token'], '2'.repeat(64));
  assert.ok(calls.every(({ options }) => options.redirect === 'manual'));
});

test('remote verifier retries cold starts but fails closed on marker and redirect', async () => {
  let clock = 0; const responses = [jsonResponse({ error: 'sleeping' }, 503), ...smokeResponses()];
  await verifyRemote({ baseUrl: 'https://dev.example.test', expectedHost: 'dev.example.test', expectedSourceSha: sha,
    credentials: { username: 'release', password: 'synthetic-password' }, fetchImpl: async () => responses.shift(),
    retryIntervalMs: 5, totalTimeoutMs: 100, now: () => clock, sleep: async (ms) => { clock += ms; } });
  const wrong = smokeResponses('f'.repeat(40));
  await assert.rejects(() => verifyRemote({ baseUrl: 'https://dev.example.test', expectedHost: 'dev.example.test', expectedSourceSha: sha,
    credentials: { username: 'release', password: 'synthetic-password' }, fetchImpl: async () => wrong.shift() }), /marker/);
  await assert.rejects(() => verifyRemote({ baseUrl: 'https://dev.example.test', expectedHost: 'dev.example.test', expectedSourceSha: sha,
    credentials: { username: 'release', password: 'synthetic-password' },
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'https://evil.test/' } }) }), /redirect/);
  assert.throws(() => validateDeploymentTarget('http://dev.example.test', 'dev.example.test'), /HTTPS/);
});

test('all workflows pin actions and privileged release graph stays separated', async () => {
  const files = ['.github/workflows/ci.yml', '.github/workflows/pages.yml', '.github/workflows/application-release.yml'];
  const workflows = await Promise.all(files.map((path) => readFile(resolve(path), 'utf8')));
  for (const workflow of workflows) {
    for (const line of workflow.split('\n').filter((entry) => /^\s+(?:-|)\s*uses:/.test(entry)))
      assert.match(line, /uses:\s+[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}(?:\s+#\s+\S+)?$/);
    assert.doesNotMatch(workflow, /pull_request_target|repository_dispatch|secrets:\s*inherit/);
  }
  assert.match(workflows[0], /gitleaks:v8\.30\.1@sha256:[0-9a-f]{64}/);
  const release = workflows[2];
  assert.match(release, /permissions: \{\}/);
  assert.match(release, /push:\s*\n\s*branches: \[master\]/);
  assert.doesNotMatch(release, /workflow_run:/);
  assert.match(release, /options:\s*\n\s*- publish-image\s*\n\s*- release-development\s*\n\s*- promote-production/);
  assert.match(release, /development_run_id:[\s\S]*required: false/);
  assert.match(release, /vars\.IMAGE_RELEASE_ENABLED == 'true'/);
  assert.match(release, /vars\.DEPLOYMENT_AUTOMATION_ENABLED == 'true'/);
  assert.match(release, /Wait for the exact master CI run/);
  assert.match(release, /validate-ci-run/);
  assert.match(release, /environment: development[\s\S]*cancel-in-progress: false/);
  assert.match(release, /environment: production[\s\S]*cancel-in-progress: false/);
  assert.match(release, /needs: resolve-production/);
  assert.match(release, /development_run_id/);
  assert.match(release, /test "\$SOURCE_SHA" = "\$master_sha"/);
  assert.match(release, /gh attestation verify/);
  assert.match(release, /--signer-workflow "\$GITHUB_REPOSITORY\/\.github\/workflows\/application-release\.yml"/);
  assert.match(release, /--source-ref refs\/heads\/master --source-digest "\$SOURCE_SHA"/);
  assert.match(release, /DEV_DATABASE_FINGERPRINT/);
  const verifyCi = release.slice(release.indexOf('  verify-ci:'), release.indexOf('  build-development:'));
  const publish = release.slice(release.indexOf('  build-development:'), release.indexOf('  deploy-development:'));
  const development = release.slice(release.indexOf('  deploy-development:'), release.indexOf('  resolve-production:'));
  const resolution = release.slice(release.indexOf('  resolve-production:'), release.indexOf('  deploy-production:'));
  assert.match(verifyCi, /IMAGE_RELEASE_ENABLED/);
  assert.match(verifyCi, /publish-image/);
  assert.match(verifyCi, /release-development/);
  assert.doesNotMatch(publish, /environment:|DIRECT_DATABASE_URL|RENDER_API_TOKEN|RENDER_SERVICE_ID|SMOKE_PASSWORD/);
  assert.match(development, /DEPLOYMENT_AUTOMATION_ENABLED/);
  assert.match(development, /inputs\.operation == 'release-development'/);
  assert.match(development, /db:migrate:deploy[\s\S]*ACCOUNT_ROLE: RELEASE_MAINTAINER[\s\S]*npm run account -- ensure[\s\S]*render-deploy\.mjs/);
  assert.match(resolution, /inputs\.operation == 'promote-production'/);
  assert.doesNotMatch(resolution, /IMAGE_RELEASE_ENABLED/);
  assert.match(release, /render-deploy\.mjs --execute --image/);
  assert.doesNotMatch(release, /deploy[_-]?hook/i);
  const production = release.slice(release.indexOf('  deploy-production:'));
  assert.match(production, /db:migrate:deploy[\s\S]*ACCOUNT_ROLE: RELEASE_MAINTAINER[\s\S]*npm run account -- ensure[\s\S]*render-deploy\.mjs/);
  assert.doesNotMatch(production, /docker\/build-push-action|Build and publish/);
});
