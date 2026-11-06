import { fileURLToPath } from 'node:url';
import { readMigrationManifest, verifyMigrationManifest } from './release-candidate.mjs';

const requiredTables = ['ReleaseAnnotation', 'ReleaseCandidate', 'ReleaseCandidateMember', 'ReleaseSmokeTest'];
const requiredConstraints = ['AiRequest_feature_scope', 'ReleasePublicationSnapshot_candidate_id_key'];
const requiredTriggers = ['ReleaseAnnotation_append_only', 'ReleaseAnnotation_exact_scope', 'ReleaseCandidateMember_capacity'];
const requiredIndexes = ['ReleaseAnnotation_candidateId_createdAt_id_idx', 'ReleaseCandidateMember_one_active_proposal'];
const allowedConnectionParameters = new Set(['sslmode', 'channel_binding']);

export function validateDirectDatabaseUrl(raw, expectedHost, allowInsecureLocal = false) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('Invalid direct database URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.username.length === 0 || url.password.length === 0)
    throw new Error('Invalid direct database URL');
  if (typeof expectedHost !== 'string' || expectedHost.length < 3 || expectedHost.length > 253
      || !/^[a-z0-9.-]+$/.test(expectedHost) || url.hostname !== expectedHost)
    throw new Error('Database target does not match the protected environment');
  if (/pooler/i.test(url.hostname)) throw new Error('Migrations require a direct database endpoint');
  if (!allowInsecureLocal) {
    if (!url.hostname.endsWith('.neon.tech')) throw new Error('Deployment database must be a Neon endpoint');
    for (const key of url.searchParams.keys()) {
      if (!allowedConnectionParameters.has(key)) throw new Error('Database connection parameter is not allowed');
    }
    if (url.searchParams.getAll('sslmode').length !== 1 || url.searchParams.get('sslmode') !== 'verify-full')
      throw new Error('Database TLS verification must use exactly one sslmode=verify-full');
    const channelBindings = url.searchParams.getAll('channel_binding');
    if (channelBindings.length > 1 || (channelBindings.length === 1 && channelBindings[0] !== 'require'))
      throw new Error('Database channel binding parameter is invalid');
  }
  return url;
}
function singleValue(result, field) {
  if (!result?.rows || result.rows.length !== 1 || !(field in result.rows[0])) throw new Error('Database preflight returned an unexpected result');
  return result.rows[0][field];
}
function assertExpectedObjects(rows, field, expected, kind) {
  const found = new Set(rows.map((row) => row[field]));
  const missing = expected.filter((name) => !found.has(name));
  if (missing.length) throw new Error(`Required ${kind} missing`);
}
export async function verifyDatabase({ mode, url, expectedHost, manifest, clientFactory,
  allowInsecureLocal = false }) {
  if (!['preflight', 'postflight'].includes(mode)) throw new Error('Database verification mode is invalid');
  validateDirectDatabaseUrl(url, expectedHost, allowInsecureLocal);
  const expectedManifest = manifest ?? await readMigrationManifest();
  const client = await clientFactory(url);
  try {
    await client.connect();
    const version = Number(singleValue(await client.query('SHOW server_version_num'), 'server_version_num'));
    if (!Number.isInteger(version) || version < 140000 || version >= 190000) throw new Error('PostgreSQL version is outside the tested 14-18 range');
    const timezone = singleValue(await client.query("SELECT current_setting('TimeZone') AS timezone"), 'timezone');
    if (timezone !== 'UTC') throw new Error('Database timezone must be UTC');
    const table = singleValue(await client.query("SELECT to_regclass('\"_prisma_migrations\"') AS migration_table"), 'migration_table');
    let rows = [];
    if (table !== null) rows = (await client.query(
      'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at, migration_name')).rows;
    const expected = new Map(expectedManifest.entries.map((entry) => [entry.name, entry.checksum]));
    for (const row of rows) {
      if (!expected.has(row.migration_name)) throw new Error('Database contains an unreviewed migration');
      if (row.checksum !== expected.get(row.migration_name)) throw new Error('Applied migration checksum drift detected');
      if (row.finished_at === null && row.rolled_back_at === null) throw new Error('Database contains a failed or unfinished migration');
    }
    const applied = new Set(rows.filter((row) => row.finished_at !== null && row.rolled_back_at === null).map((row) => row.migration_name));
    if (mode === 'postflight' && (table === null || expectedManifest.entries.some(({ name }) => !applied.has(name))))
      throw new Error('Database migrations are not fully applied');
    if (mode === 'postflight') {
      const tables = (await client.query("SELECT relname FROM pg_class WHERE relkind IN ('r','p') AND relname = ANY($1::text[])", [requiredTables])).rows;
      const constraints = (await client.query('SELECT conname FROM pg_constraint WHERE conname = ANY($1::text[])', [requiredConstraints])).rows;
      const triggers = (await client.query("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname = ANY($1::text[])", [requiredTriggers])).rows;
      const indexes = (await client.query('SELECT indexname FROM pg_indexes WHERE indexname = ANY($1::text[])', [requiredIndexes])).rows;
      assertExpectedObjects(tables, 'relname', requiredTables, 'table');
      assertExpectedObjects(constraints, 'conname', requiredConstraints, 'constraint');
      assertExpectedObjects(triggers, 'tgname', requiredTriggers, 'trigger');
      assertExpectedObjects(indexes, 'indexname', requiredIndexes, 'index');
    }
    return Object.freeze({ mode, migrationCount: applied.size, version });
  } finally { await client.end().catch(() => undefined); }
}
async function main() {
  const mode = process.argv[2];
  const manifest = await verifyMigrationManifest();
  const { Client } = await import('pg');
  const result = await verifyDatabase({ mode, url: process.env.DIRECT_DATABASE_URL,
    expectedHost: process.env.EXPECTED_DATABASE_HOST, manifest,
    clientFactory: async (connectionString) => new Client({ connectionString,
      application_name: 'specsentry-release-verifier', connectionTimeoutMillis: 10_000,
      query_timeout: 10_000, statement_timeout: 10_000 }) });
  console.info(`PASS database ${result.mode} (${result.migrationCount} reviewed migrations)`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : 'database verification failed'}`);
  process.exitCode = 1;
});
