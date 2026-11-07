import { appendFile, lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY = 'CS3227-2610-MP4-SpecSentry/CS3227-2610-MP4';
const IMAGE_NAME = 'ghcr.io/cs3227-2610-mp4-specsentry/cs3227-2610-mp4';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const DEFAULT_MANIFEST = resolve(root, 'workflow/deployment/migrations.sha256');
export const DEFAULT_MIGRATIONS_ROOT = resolve(root, 'src/server/prisma/migrations');
const shaPattern = /^[0-9a-f]{40}$/;
const treePattern = /^[0-9a-f]{40}$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;
const runPattern = /^[1-9][0-9]{0,19}$/;

export function validateSourceSha(value) {
  if (!shaPattern.test(value ?? '')) throw new Error('Invalid source revision');
  return value;
}
export function validateSourceTree(value) {
  if (!treePattern.test(value ?? '')) throw new Error('Invalid source tree');
  return value;
}
export function validateDigest(value) {
  if (!digestPattern.test(value ?? '')) throw new Error('Invalid image digest');
  return value;
}
export function validateImageReference(value, expectedDigest) {
  const digest = validateDigest(expectedDigest ?? value?.slice(value.lastIndexOf('@') + 1));
  const expected = `${IMAGE_NAME}@${digest}`;
  if (value !== expected) throw new Error('Image must use the approved GHCR repository and immutable digest');
  return value;
}
function safePath(path) {
  const candidate = resolve(root, path);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) throw new Error('Path escapes repository');
  return candidate;
}
export async function readMigrationManifest(path = DEFAULT_MANIFEST) {
  const text = await readFile(path, 'utf8');
  if (!text.endsWith('\n')) throw new Error('Migration manifest must end with a newline');
  const entries = text.trimEnd().split('\n').map((line) => {
    const match = /^([0-9a-f]{64}) {2}(src\/server\/prisma\/migrations\/([0-9]{14}_[a-z0-9_]+)\/migration\.sql)$/.exec(line);
    if (!match) throw new Error('Malformed migration manifest');
    return { checksum: match[1], path: match[2], name: match[3] };
  });
  if (entries.length === 0 || new Set(entries.map(({ name }) => name)).size !== entries.length)
    throw new Error('Migration manifest entries must be unique');
  if (entries.map(({ name }) => name).join('\n') !== entries.map(({ name }) => name).sort().join('\n'))
    throw new Error('Migration manifest must use lexical order');
  return { entries, text, digest: createHash('sha256').update(text).digest('hex') };
}
export async function verifyMigrationInventory(entries, migrationsRoot = DEFAULT_MIGRATIONS_ROOT) {
  const rootStat = await lstat(migrationsRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink())
    throw new Error('Migration root must be a regular directory');
  const actualNames = [];
  for (const entry of await readdir(migrationsRoot, { withFileTypes: true })) {
    if (entry.name === 'migration_lock.toml') {
      if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('Migration lock must be a regular file');
      continue;
    }
    if (!/^[0-9]{14}_[a-z0-9_]+$/.test(entry.name) || !entry.isDirectory() || entry.isSymbolicLink())
      throw new Error('Unexpected migration inventory entry');
    const directory = resolve(migrationsRoot, entry.name);
    const children = await readdir(directory, { withFileTypes: true });
    if (children.length !== 1 || children[0].name !== 'migration.sql'
        || !children[0].isFile() || children[0].isSymbolicLink())
      throw new Error(`Migration must contain one regular SQL file: ${entry.name}`);
    const sqlStat = await lstat(resolve(directory, 'migration.sql'));
    if (!sqlStat.isFile() || sqlStat.isSymbolicLink())
      throw new Error(`Migration SQL must be a regular file: ${entry.name}`);
    actualNames.push(entry.name);
  }
  const reviewedNames = entries.map(({ name }) => name).sort();
  actualNames.sort();
  if (reviewedNames.join('\n') !== actualNames.join('\n'))
    throw new Error('Migration manifest does not match the exact migration inventory');
  return actualNames;
}
export async function verifyMigrationManifest(path = DEFAULT_MANIFEST, migrationsRoot = DEFAULT_MIGRATIONS_ROOT) {
  const manifest = await readMigrationManifest(path);
  await verifyMigrationInventory(manifest.entries, migrationsRoot);
  for (const entry of manifest.entries) {
    const actual = createHash('sha256').update(await readFile(safePath(entry.path))).digest('hex');
    if (actual !== entry.checksum) throw new Error(`Migration checksum mismatch: ${entry.name}`);
  }
  return manifest;
}

const candidateKeys = ['schemaVersion', 'repository', 'sourceSha', 'sourceTree', 'image', 'imageDigest',
  'migrationManifestDigest', 'developmentRunId', 'developmentDeployId', 'developmentServiceFingerprint',
  'developmentHostFingerprint', 'developmentDatabaseFingerprint', 'developmentCiRunId', 'environment', 'verifiedAt'];
export function validateCandidate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== [...candidateKeys].sort().join())
    throw new Error('Invalid release candidate fields');
  if (value.schemaVersion !== 1 || value.repository !== REPOSITORY || value.environment !== 'development')
    throw new Error('Invalid release candidate identity');
  validateSourceSha(value.sourceSha);
  validateSourceTree(value.sourceTree);
  validateDigest(value.imageDigest);
  validateImageReference(value.image, value.imageDigest);
  if (!/^[0-9a-f]{64}$/.test(value.migrationManifestDigest ?? '')) throw new Error('Invalid migration manifest digest');
  if (!runPattern.test(value.developmentRunId ?? '')) throw new Error('Invalid development run ID');
  if (!runPattern.test(value.developmentCiRunId ?? '')) throw new Error('Invalid development CI run ID');
  if (!idPattern.test(value.developmentDeployId ?? '')) throw new Error('Invalid development deploy ID');
  if (!/^[0-9a-f]{64}$/.test(value.developmentServiceFingerprint ?? '')
      || !/^[0-9a-f]{64}$/.test(value.developmentHostFingerprint ?? '')
      || !/^[0-9a-f]{64}$/.test(value.developmentDatabaseFingerprint ?? ''))
    throw new Error('Invalid development target fingerprint');
  if (typeof value.verifiedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.verifiedAt)
      || !Number.isFinite(Date.parse(value.verifiedAt))) throw new Error('Invalid verification timestamp');
  return Object.freeze({ ...value });
}
export function createCandidate(input, now = new Date()) {
  return validateCandidate({ schemaVersion: 1, repository: REPOSITORY, sourceSha: input.sourceSha,
    sourceTree: input.sourceTree, image: input.image, imageDigest: input.imageDigest,
    migrationManifestDigest: input.migrationManifestDigest, developmentRunId: String(input.developmentRunId),
    developmentCiRunId: String(input.developmentCiRunId),
    developmentDeployId: input.developmentDeployId,
    developmentServiceFingerprint: input.developmentServiceFingerprint,
    developmentHostFingerprint: input.developmentHostFingerprint,
    developmentDatabaseFingerprint: input.developmentDatabaseFingerprint,
    environment: 'development', verifiedAt: now.toISOString() });
}
export async function readCandidate(path) {
  const text = await readFile(path, 'utf8');
  if (Buffer.byteLength(text) > 16_384) throw new Error('Release candidate is too large');
  return validateCandidate(JSON.parse(text));
}
export function validateReleaseRun(value, expectedRunId, expectedSourceSha) {
  const run = String(expectedRunId); const sourceSha = validateSourceSha(expectedSourceSha);
  if (!runPattern.test(run) || String(value?.id) !== run || !['push', 'workflow_dispatch'].includes(value?.event)
      || value?.status !== 'completed'
      || value?.conclusion !== 'success' || value?.head_branch !== 'master' || value?.head_sha !== sourceSha
      || value?.repository?.full_name !== REPOSITORY || value?.head_repository?.full_name !== REPOSITORY
      || value?.path !== '.github/workflows/application-release.yml') throw new Error('Development release run is not trusted');
  return { runId: run, sourceSha };
}
export function validateCiRun(value, expectedRunId, expectedSourceSha) {
  const run = String(expectedRunId); const sourceSha = validateSourceSha(expectedSourceSha);
  if (!runPattern.test(run) || String(value?.id) !== run || value?.event !== 'push' || value?.status !== 'completed'
      || value?.conclusion !== 'success' || value?.head_branch !== 'master' || value?.head_sha !== sourceSha
      || value?.repository?.full_name !== REPOSITORY || value?.head_repository?.full_name !== REPOSITORY
      || value?.path !== '.github/workflows/ci.yml') throw new Error('Development CI run is not trusted');
  return { sourceSha };
}
async function githubOutput(candidate, outputPath) {
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  const lines = [`source_sha=${candidate.sourceSha}`, `source_tree=${candidate.sourceTree}`,
    `image=${candidate.image}`, `image_digest=${candidate.imageDigest}`,
    `migration_manifest_digest=${candidate.migrationManifestDigest}`,
    `development_ci_run_id=${candidate.developmentCiRunId}`,
    `development_deploy_id=${candidate.developmentDeployId}`,
    `development_service_fingerprint=${candidate.developmentServiceFingerprint}`,
    `development_host_fingerprint=${candidate.developmentHostFingerprint}`,
    `development_database_fingerprint=${candidate.developmentDatabaseFingerprint}`];
  await appendFile(outputPath, `${lines.join('\n')}\n`, { mode: 0o600 });
}
function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
async function main() {
  const command = process.argv[2];
  if (command === 'verify-migrations') {
    const result = await verifyMigrationManifest(argument('--manifest') ?? DEFAULT_MANIFEST);
    console.info(`PASS ${result.entries.length} migration checksums`);
  } else if (command === 'manifest-digest') {
    console.info((await verifyMigrationManifest(argument('--manifest') ?? DEFAULT_MANIFEST)).digest);
  } else if (command === 'validate-build') {
    validateSourceSha(argument('--source-sha'));
    validateSourceTree(argument('--source-tree'));
    validateImageReference(argument('--image'), argument('--digest'));
    console.info('PASS immutable build identity');
  } else if (command === 'create') {
    const evidence = JSON.parse(await readFile(argument('--deploy-evidence'), 'utf8'));
    if (!evidence || Object.keys(evidence).sort().join() !== ['deployId', 'imageDigest', 'schemaVersion', 'serviceFingerprint'].sort().join()
        || evidence.schemaVersion !== 1 || evidence.imageDigest !== process.env.IMAGE_DIGEST
        || !/^[0-9a-f]{64}$/.test(evidence.serviceFingerprint ?? ''))
      throw new Error('Render deployment evidence is invalid');
    if (!/^[a-z0-9.-]{3,253}$/.test(process.env.DEVELOPMENT_HOST ?? '')
        || !/^[a-z0-9.-]{3,253}$/.test(process.env.DEVELOPMENT_DATABASE_HOST ?? ''))
      throw new Error('Development target identity is invalid');
    const candidate = createCandidate({ sourceSha: process.env.SOURCE_SHA, sourceTree: process.env.SOURCE_TREE,
      image: process.env.IMAGE_REF, imageDigest: process.env.IMAGE_DIGEST,
      migrationManifestDigest: process.env.MIGRATION_MANIFEST_DIGEST,
      developmentRunId: process.env.DEVELOPMENT_RUN_ID, developmentCiRunId: process.env.DEVELOPMENT_CI_RUN_ID,
      developmentDeployId: evidence.deployId,
      developmentServiceFingerprint: evidence.serviceFingerprint,
      developmentHostFingerprint: createHash('sha256').update(process.env.DEVELOPMENT_HOST ?? '').digest('hex'),
      developmentDatabaseFingerprint: createHash('sha256').update(process.env.DEVELOPMENT_DATABASE_HOST ?? '').digest('hex') });
    await writeFile(argument('--output'), `${JSON.stringify(candidate, null, 2)}\n`, { mode: 0o600 });
    console.info('PASS release candidate recorded');
  } else if (command === 'validate') {
    const candidate = await readCandidate(argument('--file'));
    const expectedRunId = argument('--run-id');
    if (expectedRunId !== undefined && candidate.developmentRunId !== expectedRunId)
      throw new Error('Release candidate does not belong to the requested development run');
    const currentManifest = await verifyMigrationManifest(argument('--manifest') ?? DEFAULT_MANIFEST);
    if (candidate.migrationManifestDigest !== currentManifest.digest) throw new Error('Migration manifest changed after development verification');
    await githubOutput(candidate, process.env.GITHUB_OUTPUT);
    console.info('PASS release candidate validated');
  } else if (command === 'validate-run') {
    const run = JSON.parse(await readFile(argument('--file'), 'utf8'));
    validateReleaseRun(run, argument('--run-id'), argument('--source-sha'));
    console.info('PASS development run identity');
  } else if (command === 'validate-ci-run') {
    const run = JSON.parse(await readFile(argument('--file'), 'utf8'));
    validateCiRun(run, argument('--run-id'), argument('--source-sha'));
    console.info('PASS development CI run identity');
  } else throw new Error('Unknown release-candidate command');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : 'release candidate validation failed'}`);
  process.exitCode = 1;
});
