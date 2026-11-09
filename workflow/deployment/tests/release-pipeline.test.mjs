/* global Response */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { createCandidate, readCandidate, validateCandidate, validateCiRun, validateReleaseRun,
  validateImageReference, verifyMigrationInventory, verifyMigrationManifest } from '../tooling/release-candidate.mjs';
import { copyImageToAcr, deployImage, runAzure, validateAcrTarget, validateAzureTarget,
  validateRegistryIdentity, verifyAcrImage } from '../tooling/azure-deploy.mjs';
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

const jsonResponse = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json', ...headers },
});

const subscriptionId = '11111111-1111-4111-8111-111111111111';
const resourceGroup = 'specsentry-dev-rg';
const containerAppName = 'specsentry-dev';
const revision = 'specsentry-dev--abc123';
const registryResourceGroup = 'specsentry-shared-rg';
const registryName = 'specsentryregistry';
const registryServer = `${registryName}.azurecr.io`;
const containerImageName = 'specsentry/app';
const registryIdentity = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}`
  + '/providers/Microsoft.ManagedIdentity/userAssignedIdentities/specsentry-dev-pull';
const deploymentHost = 'specsentry-dev.example.azurecontainerapps.io';
const acrImage = `${registryServer}/${containerImageName}@${digest}`;
const registryResource = { name: registryName, loginServer: registryServer, provisioningState: 'Succeeded',
  id: `/subscriptions/${subscriptionId}/resourceGroups/${registryResourceGroup}`
    + `/providers/Microsoft.ContainerRegistry/registries/${registryName}` };
const runtimeEnvironment = [
  { name: 'PORT', value: '3000' }, { name: 'TRUST_PROXY_HOPS', value: '1' },
  { name: 'NODE_ENV', value: 'production' }, { name: 'DATABASE_URL', secretRef: 'database-url' },
  { name: 'SESSION_SECRET', secretRef: 'session-secret' }, { name: 'AI_API_KEY', secretRef: 'ai-api-key' },
];
const runtimeProbes = [
  { type: 'Readiness', httpGet: { path: '/api/ready', port: 3000, scheme: 'HTTP' } },
  { type: 'Liveness', httpGet: { path: '/api/health', port: 3000, scheme: 'HTTP' } },
];
const azureContainer = { name: 'specsentry', image: acrImage, env: runtimeEnvironment, probes: runtimeProbes };
const azureConfiguration = { activeRevisionsMode: 'Single',
  registries: [{ server: registryServer, identity: registryIdentity }],
  ingress: { external: true, allowInsecure: false, targetPort: 3000,
    fqdn: deploymentHost } };
const azurePreflight = { name: containerAppName, properties: { provisioningState: 'Succeeded',
  latestRevisionName: 'specsentry-dev--previous', configuration: azureConfiguration,
  template: { containers: [azureContainer] } } };
const azureUpdate = { name: containerAppName, properties: { provisioningState: 'Succeeded',
  latestRevisionName: revision, configuration: azureConfiguration,
  template: { containers: [azureContainer] } } };
const azureFinal = { name: containerAppName, properties: { ...azureUpdate.properties,
  configuration: { ...azureConfiguration, ingress: { ...azureConfiguration.ingress,
    traffic: [{ revisionName: revision, weight: 100 }] } } } };
function azureRevision({ active = true, runningState = 'Running', healthState = 'Healthy',
  provisioningState = 'Provisioned', deployedImage = acrImage, trafficWeight = 100 } = {}) {
  return { name: revision, properties: { active, runningState, healthState, provisioningState, trafficWeight,
    template: { containers: [{ ...azureContainer, image: deployedImage }] } } };
}

test('development copies the exact private GHCR manifest into ACR and verifies its digest', async () => {
  const calls = [];
  const responses = [registryResource, null, { digest }, { digest }];
  const result = await copyImageToAcr({ subscriptionId, registryResourceGroup, registryName, registryServer,
    containerImageName, sourceImage: image, expectedDigest: digest, ghcrUsername: 'yu-sutong',
    ghcrToken: 'synthetic-short-lived-token',
    run: async (args, options) => { calls.push({ args, options }); return responses.shift(); } });
  assert.deepEqual(result, { image: acrImage, imageDigest: digest });
  assert.deepEqual(calls.map(({ args }) => args.slice(0, 2)), [
    ['acr', 'show'], ['acr', 'import'], ['acr', 'repository'], ['acr', 'repository'],
  ]);
  const importArgs = calls[1].args;
  assert.equal(importArgs[importArgs.indexOf('--source') + 1], image);
  assert.equal(importArgs[importArgs.indexOf('--image') + 1],
    `${containerImageName}:sha256-${digest.slice('sha256:'.length)}`);
  assert.equal(importArgs[importArgs.indexOf('--password') + 1], 'synthetic-short-lived-token');
  assert.deepEqual(calls[1].options, { allowEmpty: true });
  assert.equal(JSON.stringify(result).includes('synthetic-short-lived-token'), false);
});

test('production only verifies the existing ACR digest and never imports it', async () => {
  const calls = [];
  const result = await verifyAcrImage({ subscriptionId, registryResourceGroup, registryName, registryServer,
    containerImageName, expectedDigest: digest,
    run: async (args) => { calls.push(args); return calls.length === 1 ? registryResource : { digest }; } });
  assert.deepEqual(result, { image: acrImage, imageDigest: digest });
  assert.equal(calls.some((args) => args[0] === 'acr' && args[1] === 'import'), false);
  assert.equal(calls[1][calls[1].indexOf('--image') + 1], `${containerImageName}@${digest}`);
  await assert.rejects(() => verifyAcrImage({ subscriptionId, registryResourceGroup, registryName, registryServer,
    containerImageName, expectedDigest: digest,
    run: async (args) => (args[1] === 'show' ? registryResource : { digest: `sha256:${'0'.repeat(64)}` }) }),
  /digest mismatch/);
});

test('Azure client deploys the ACR digest and verifies the exact revision and all traffic', async () => {
  const calls = [];
  const responses = [azurePreflight, null, azureUpdate, azureRevision({ active: false, runningState: 'Processing',
    healthState: 'None', provisioningState: 'Provisioning' }),
  azureRevision({ active: false, runningState: undefined, healthState: undefined,
    provisioningState: 'Provisioning' }), azureRevision({ active: false }),
  azureRevision(), azureFinal];
  const result = await deployImage({ subscriptionId, resourceGroup, containerAppName,
    registryName, registryServer, containerImageName, registryIdentity, expectedDeploymentHost: deploymentHost,
    image: acrImage, expectedDigest: digest,
    run: async (args, options) => { calls.push({ args, options }); return responses.shift(); },
    sleep: async () => undefined, pollIntervalMs: 0 });
  assert.deepEqual(result, { deployId: revision, imageDigest: digest });
  assert.ok(calls.every(({ args }) => args[0] === 'rest'));
  assert.deepEqual(calls.slice(0, 3).map(({ args }) => args[args.indexOf('--method') + 1]),
    ['get', 'patch', 'get']);
  assert.deepEqual(calls[1].options, { allowEmpty: true });
  const appUrl = calls[0].args[calls[0].args.indexOf('--url') + 1];
  assert.equal(appUrl, `https://management.azure.com/subscriptions/${subscriptionId}`
    + `/resourceGroups/${resourceGroup}/providers/Microsoft.App/containerApps/${containerAppName}`
    + '?api-version=2025-07-01');
  assert.equal(calls[1].args[calls[1].args.indexOf('--url') + 1], appUrl);
  const body = JSON.parse(calls[1].args[calls[1].args.indexOf('--body') + 1]);
  assert.deepEqual(body.properties.configuration.registries,
    [{ server: registryServer, identity: registryIdentity }]);
  assert.equal(body.properties.template.containers[0].image, acrImage);
  assert.deepEqual(body.properties.template.containers[0].env, runtimeEnvironment);
  assert.ok(calls.slice(3, 6).every(({ args }) =>
    args[args.indexOf('--url') + 1].includes(`/revisions/${revision}?api-version=2025-07-01`)));
  assert.equal(calls.at(-1).args[calls.at(-1).args.indexOf('--url') + 1], appUrl);
});

test('Azure client accepts implicit latest traffic for a verified single-revision app', async () => {
  const responses = [azurePreflight, null, azureUpdate, azureRevision(), azureUpdate];
  const result = await deployImage({ subscriptionId, resourceGroup, containerAppName,
    registryName, registryServer, containerImageName, registryIdentity,
    expectedDeploymentHost: deploymentHost, image: acrImage, expectedDigest: digest,
    run: async () => responses.shift(), sleep: async () => undefined, pollIntervalMs: 0 });
  assert.deepEqual(result, { deployId: revision, imageDigest: digest });
});

test('Azure client accepts an active provisioned revision that already scaled to zero', async () => {
  const responses = [azurePreflight, null, azureUpdate,
    azureRevision({ runningState: 'ScaledToZero', healthState: 'None' }), azureUpdate];
  const result = await deployImage({ subscriptionId, resourceGroup, containerAppName,
    registryName, registryServer, containerImageName, registryIdentity,
    expectedDeploymentHost: deploymentHost, image: acrImage, expectedDigest: digest,
    run: async () => responses.shift(), sleep: async () => undefined, pollIntervalMs: 0 });
  assert.deepEqual(result, { deployId: revision, imageDigest: digest });
});

test('Azure client rejects invalid targets, ambiguous CLI failures and wrong image identity', async () => {
  assert.deepEqual(validateAzureTarget(subscriptionId, resourceGroup, containerAppName),
    { subscriptionId, resourceGroup, containerAppName });
  assert.deepEqual(validateAcrTarget(registryName, registryServer, containerImageName),
    { registryName, registryServer, containerImageName });
  assert.equal(validateRegistryIdentity(registryIdentity, subscriptionId, resourceGroup), registryIdentity);
  assert.throws(() => validateAzureTarget('not-a-guid', resourceGroup, containerAppName), /subscription/);
  assert.throws(() => validateAzureTarget(subscriptionId, 'Bad_Group', containerAppName), /resource group/);
  assert.throws(() => validateAzureTarget(subscriptionId, resourceGroup, 'Bad_App'), /Container App/);
  assert.throws(() => validateAcrTarget('bad_name', registryServer, containerImageName), /Registry name/);
  assert.throws(() => validateAcrTarget(registryName, 'other.azurecr.io', containerImageName), /Registry server/);
  assert.throws(() => validateRegistryIdentity(registryIdentity.replace(resourceGroup, 'other-rg'),
    subscriptionId, resourceGroup), /outside/);
  await assert.rejects(() => runAzure(['account', 'show'], {
    exec: async () => { throw new Error('sensitive provider output'); },
  }), (error) => error.message === 'Azure CLI command failed' && !error.message.includes('sensitive'));
  await assert.rejects(() => deployImage({ subscriptionId, resourceGroup, containerAppName,
    registryName, registryServer, containerImageName, registryIdentity, expectedDeploymentHost: deploymentHost,
    image, expectedDigest: digest,
    run: async () => azurePreflight }), /image identity/);
  const wrongImage = acrImage.replace(digest, `sha256:${'0'.repeat(64)}`);
  const responses = [azurePreflight, null, { ...azureUpdate, properties: { ...azureUpdate.properties,
    template: { containers: [{ ...azureContainer, image: wrongImage }] } } }];
  await assert.rejects(() => deployImage({ subscriptionId, resourceGroup, containerAppName,
    registryName, registryServer, containerImageName, registryIdentity, expectedDeploymentHost: deploymentHost,
    image: acrImage, expectedDigest: digest,
    run: async () => responses.shift(), sleep: async () => undefined, maxPolls: 1 }), /image identity/);
});

test('Azure client rejects unsafe runtime secrets, probes, ingress and traffic', async () => {
  const deploy = (responses) => deployImage({ subscriptionId, resourceGroup, containerAppName,
    registryName, registryServer, containerImageName, registryIdentity, expectedDeploymentHost: deploymentHost,
    image: acrImage, expectedDigest: digest,
    run: async () => responses.shift(),
    sleep: async () => undefined, maxPolls: 1 });
  const directUrl = { ...azurePreflight, properties: { ...azurePreflight.properties,
    template: { containers: [{ ...azureContainer,
      env: [...runtimeEnvironment, { name: 'DIRECT_DATABASE_URL', secretRef: 'migration-url' }] }] } } };
  await assert.rejects(() => deploy([directUrl]), /Migration credential/);
  const literalSecret = { ...azurePreflight, properties: { ...azurePreflight.properties,
    template: { containers: [{ ...azureContainer,
      env: runtimeEnvironment.map((entry) => (entry.name === 'DATABASE_URL'
        ? { name: 'DATABASE_URL', value: 'postgresql://sensitive' } : entry)) }] } } };
  await assert.rejects(() => deploy([literalSecret]), /secret reference/);
  const noLiveness = { ...azurePreflight, properties: { ...azurePreflight.properties,
    template: { containers: [{ ...azureContainer, probes: runtimeProbes.slice(0, 1) }] } } };
  await assert.rejects(() => deploy([noLiveness]), /liveness probe/);
  const insecure = { ...azurePreflight, properties: { ...azurePreflight.properties,
    configuration: { ...azureConfiguration, ingress: { ...azureConfiguration.ingress, allowInsecure: true } } } };
  await assert.rejects(() => deploy([insecure]), /HTTPS ingress/);
  const wrongHost = { ...azurePreflight, properties: { ...azurePreflight.properties,
    configuration: { ...azureConfiguration,
      ingress: { ...azureConfiguration.ingress, fqdn: 'different.example.azurecontainerapps.io' } } } };
  await assert.rejects(() => deploy([wrongHost]), /HTTPS ingress/);
  const registryPassword = { ...azurePreflight, properties: { ...azurePreflight.properties,
    configuration: { ...azureConfiguration,
      registries: [{ server: registryServer, username: 'persistent', passwordSecretRef: 'registry-password' }] } } };
  await assert.rejects(() => deploy([registryPassword, null, registryPassword]), /managed identity/);
  const wrongIdentity = { ...azurePreflight, properties: { ...azurePreflight.properties,
    configuration: { ...azureConfiguration,
      registries: [{ server: registryServer, identity: registryIdentity.replace('specsentry-dev-pull', 'other') }] } } };
  await assert.rejects(() => deploy([wrongIdentity, null, wrongIdentity]), /managed identity/);
  const wrongTraffic = { ...azureFinal, properties: { ...azureFinal.properties,
    configuration: { ...azureConfiguration, ingress: { ...azureConfiguration.ingress,
      traffic: [{ revisionName: 'specsentry-dev--wrong', weight: 100 }] } } } };
  await assert.rejects(() => deploy([azurePreflight, null, azureUpdate, azureRevision(), wrongTraffic]), /traffic/);
  await assert.rejects(() => deploy([azurePreflight, null, azureUpdate,
    azureRevision({ trafficWeight: 0 }), azureUpdate]), /traffic/);
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
  assert.doesNotMatch(publish, /environment:|DIRECT_DATABASE_URL|AZURE_CLIENT_ID|AZURE_RESOURCE_GROUP|SMOKE_PASSWORD/);
  assert.match(development, /DEPLOYMENT_AUTOMATION_ENABLED/);
  assert.match(development, /inputs\.operation == 'release-development'/);
  assert.match(development, /permissions:[\s\S]*id-token: write[\s\S]*steps:/);
  assert.doesNotMatch(development, /az extension|containerapp extension/);
  assert.match(development, /azure\/login@7184910d9eb2b1c5e48f7073824a90609bb9b6d6/);
  assert.match(development, /client-id: \$\{\{ vars\.AZURE_CLIENT_ID \}\}/);
  assert.match(development, /AZURE_CONTAINER_REGISTRY: \$\{\{ vars\.AZURE_CONTAINER_REGISTRY \}\}/);
  assert.match(development, /AZURE_CONTAINER_REGISTRY_RESOURCE_GROUP: \$\{\{ vars\.AZURE_CONTAINER_REGISTRY_RESOURCE_GROUP \}\}/);
  assert.match(development, /AZURE_REGISTRY_SERVER: \$\{\{ vars\.AZURE_REGISTRY_SERVER \}\}/);
  assert.match(development, /AZURE_CONTAINER_IMAGE_NAME: \$\{\{ vars\.AZURE_CONTAINER_IMAGE_NAME \}\}/);
  assert.match(development, /AZURE_CONTAINER_REGISTRY_IDENTITY: \$\{\{ vars\.AZURE_CONTAINER_REGISTRY_IDENTITY \}\}/);
  assert.match(development, /EXPECTED_DEPLOYMENT_HOST: \$\{\{ vars\.EXPECTED_DEPLOYMENT_HOST \}\}/);
  assert.match(development, /GHCR_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(development, /--execute --copy-to-acr[\s\S]*--source-image "\$SOURCE_IMAGE"[\s\S]*--expected-digest/);
  assert.match(development, /db:migrate:deploy[\s\S]*ACCOUNT_ROLE: RELEASE_MAINTAINER[\s\S]*npm run account -- ensure[\s\S]*azure-deploy\.mjs/);
  assert.match(resolution, /inputs\.operation == 'promote-production'/);
  assert.doesNotMatch(resolution, /IMAGE_RELEASE_ENABLED/);
  assert.match(release, /azure-deploy\.mjs --execute --image/);
  assert.doesNotMatch(release, /RENDER_API_TOKEN|RENDER_SERVICE_ID|render-deploy\.mjs/);
  assert.doesNotMatch(release, /deploy[_-]?hook/i);
  const production = release.slice(release.indexOf('  deploy-production:'));
  assert.match(production, /permissions:[\s\S]*id-token: write[\s\S]*steps:/);
  assert.doesNotMatch(production, /az extension|containerapp extension/);
  assert.match(production, /PROD_SUBSCRIPTION_ID:[\s\S]*PROD_RESOURCE_GROUP:[\s\S]*PROD_CONTAINER_APP_NAME:/);
  assert.match(production, /--verify-acr[\s\S]*--expected-digest/);
  assert.match(production, /AZURE_CONTAINER_REGISTRY_IDENTITY: \$\{\{ vars\.AZURE_CONTAINER_REGISTRY_IDENTITY \}\}/);
  assert.match(production, /EXPECTED_DEPLOYMENT_HOST: \$\{\{ vars\.EXPECTED_DEPLOYMENT_HOST \}\}/);
  assert.match(production, /db:migrate:deploy[\s\S]*ACCOUNT_ROLE: RELEASE_MAINTAINER[\s\S]*npm run account -- ensure[\s\S]*azure-deploy\.mjs/);
  assert.doesNotMatch(production, /docker\/build-push-action|Build and publish|copy-to-acr|GHCR_TOKEN/);
});

test('account administration builds its internal shared dependency on a clean checkout', async () => {
  const rootPackage = JSON.parse(await readFile(resolve('package.json'), 'utf8'));

  assert.match(
    rootPackage.scripts.account,
    /^npm run build -w @specsentry\/shared && npm run account -w @specsentry\/server --$/,
  );
});
