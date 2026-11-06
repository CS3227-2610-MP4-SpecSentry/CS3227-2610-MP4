import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { lstatSync, opendirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_MARKDOWN_BYTES = 1_000_000;
const MAX_RESOURCE_BYTES = 256_000;
const MAX_RESOURCE_COUNT = 100;
const MAX_RESOURCE_DIRECTORY_ENTRIES = 1_000;
const MAX_RESOURCE_TOTAL_BYTES = 8_000_000;
const MAX_MANIFEST_ROWS = 200;
const MAX_MANIFEST_FILE_BYTES = 10_000_000;
const REQUIRED_RUN_FIELDS = [
  'Prompter and inference source',
  'Goal and requirement IDs',
  'Source revision / branch',
  'Target environment (or local-only)',
  'Approved authority and excluded actions',
  'Agent assignments and exact write sets',
  'Focused context supplied / retrieved later',
  'Secret names required (names only; no values)',
  'Source SHA / immutable image digest',
  'Migration compatibility and recovery decision',
  'Acceptance, denial, failure and rollback checks',
  'Commands and actual results',
  'Stable findings and dispositions',
  'Failed/interrupted attempts and retry cost',
  'Resource-record references',
  'Human approvals required / observed evidence',
  'Unresolved risks and unavailable telemetry',
  'Next authorized action',
  'Status',
];
const REQUIRED_PROMPT_SECTIONS = [
  'Context and requests',
  'Changes and evidence',
  'Resource record',
];
const USAGE_FIELDS = ['input_tokens', 'output_tokens', 'cache_read_tokens', 'tool_calls', 'retries'];
const TERMINAL_STATUS = /^(?:verified(?: locally)?|released)$/i;
const PENDING_CLOSURE = /\b(?:independent\s+)?(?:re-?review|review|re-?verification|validation|publication|closure|completion|final report)\s+(?:(?:is|remains?)\s+)?pending\b|\bpending\s+(?:(?:independent\s+)?(?:re-?review|review|re-?verification)|validation|publication|closure|completion|final report)\b/i;

function inside(root, target) {
  const fromRoot = relative(root, target);
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot));
}

function checkedPath(root, candidate, label, kind, issues) {
  const target = resolve(root, candidate);
  if (!inside(root, target)) {
    issues.push(`${label} must remain inside the repository`);
    return null;
  }
  try {
    const stat = lstatSync(target);
    if (stat.isSymbolicLink()) {
      issues.push(`${label} must not be a symbolic link`);
      return null;
    }
    if ((kind === 'file' && !stat.isFile()) || (kind === 'directory' && !stat.isDirectory())) {
      issues.push(`${label} must be a regular ${kind}`);
      return null;
    }
    const canonical = realpathSync(target);
    if (!inside(root, canonical)) {
      issues.push(`${label} resolves outside the repository`);
      return null;
    }
    return { path: canonical, stat };
  } catch {
    issues.push(`${label} is unavailable`);
    return null;
  }
}

function readBounded(item, label, limit, issues) {
  if (!item) return '';
  if (item.stat.size > limit) {
    issues.push(`${label} exceeds the ${limit}-byte limit`);
    return '';
  }
  try {
    return readFileSync(item.path, 'utf8');
  } catch {
    issues.push(`${label} is unreadable`);
    return '';
  }
}

function withoutFences(markdown) {
  let fence = null;
  return markdown.split(/\r?\n/).filter(line => {
    const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (!fence && opening) {
      fence = { character: opening[0], length: opening.length };
      return false;
    }
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)?.[1];
      if (closing?.[0] === fence.character && closing.length >= fence.length) fence = null;
      return false;
    }
    return fence === null;
  }).join('\n');
}

function parseRunFields(markdown, issues) {
  const fields = new Map();
  for (const line of withoutFences(markdown).split(/\r?\n/)) {
    const match = /^- ([^:]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    if (fields.has(match[1])) issues.push(`run record repeats field: ${match[1]}`);
    fields.set(match[1], match[2].trim());
  }
  return fields;
}

function parseSections(markdown) {
  const sections = new Map();
  let current = null;
  for (const line of withoutFences(markdown).split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)?.[1];
    if (heading) {
      current = heading;
      if (!sections.has(current)) sections.set(current, []);
    } else if (current) sections.get(current).push(line);
  }
  return new Map([...sections].map(([heading, lines]) => [heading, lines.join('\n').trim()]));
}

function validString(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 10_000;
}

function validateRecord(record, file, expectedSession, issues) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    issues.push(`${file} is not a JSON object`);
    return null;
  }
  for (const field of ['id', 'prompter', 'session', 'agent', 'invocation', 'stage', 'selected_model',
    'selected_effort', 'settings_reason', 'started_at', 'ended_at', 'status', 'outcome']) {
    if (!validString(record[field])) issues.push(`${file} has invalid ${field}`);
  }
  if (record.session !== expectedSession) issues.push(`${file} does not match resource session ${expectedSession}`);
  if (record.id && `${record.id}.json` !== file) issues.push(`${file} does not match its resource id`);
  if (!Number.isInteger(record.attempt) || record.attempt < 1) issues.push(`${file} has invalid attempt`);
  if (!['succeeded', 'failed', 'interrupted'].includes(record.status)) {
    issues.push(`${file} has an unfinished or invalid status`);
  }
  const start = Date.parse(record.started_at);
  const end = Date.parse(record.ended_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    issues.push(`${file} has invalid interval timestamps`);
  }
  const expectedElapsed = (end - start) / 1_000;
  if (typeof record.elapsed_seconds !== 'number' || record.elapsed_seconds < 0 ||
      (Number.isFinite(expectedElapsed) && Math.abs(record.elapsed_seconds - expectedElapsed) > 0.02)) {
    issues.push(`${file} has invalid elapsed_seconds`);
  }
  if (!record.usage || typeof record.usage !== 'object' || Array.isArray(record.usage)) {
    issues.push(`${file} is missing usage fields`);
  } else {
    for (const field of USAGE_FIELDS) {
      const value = record.usage[field];
      if (value !== null && (!Number.isInteger(value) || value < 0)) issues.push(`${file} has invalid usage.${field}`);
      if (value === null && !validString(record.unavailable_reasons?.[field])) {
        issues.push(`${file} needs an unavailable reason for usage.${field}`);
      }
    }
  }
  return validString(record.id) ? record : null;
}

function gitOutput(root, args, issues, label, encoding = 'utf8') {
  try {
    return execFileSync('git', args, { cwd: root, encoding, maxBuffer: MAX_MANIFEST_FILE_BYTES + 1 });
  } catch {
    issues.push(`${label} could not be read from Git`);
    return encoding === 'buffer' ? Buffer.alloc(0) : '';
  }
}

function safeGitRef(value) {
  return typeof value === 'string' && /^(?!-)[A-Za-z0-9._/-]{1,200}$/.test(value);
}

function validInventoryPath(file) {
  return file.length > 0 && file.length <= 1_000 && !file.startsWith('-') &&
    !file.startsWith('/') && !file.split('/').includes('..') &&
    ![...file].some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127);
}

function candidateInventory(root, baseRef, candidateRef, issues) {
  if (!safeGitRef(baseRef)) {
    issues.push('base ref is invalid');
    return [];
  }
  if (candidateRef && !safeGitRef(candidateRef)) {
    issues.push('candidate ref is invalid');
    return [];
  }
  const range = candidateRef ? `${baseRef}..${candidateRef}` : baseRef;
  const changed = gitOutput(root, ['diff', '--name-only', '--diff-filter=ACMR', range, '--'], issues, 'candidate inventory')
    .split(/\r?\n/).filter(Boolean);
  const deleted = gitOutput(root, ['diff', '--name-only', '--diff-filter=D', range, '--'], issues, 'deleted-file inventory')
    .split(/\r?\n/).filter(Boolean);
  if (deleted.some(file => !file.startsWith('logs/'))) issues.push('candidate contains deleted non-log files unsupported by the hash manifest');
  if (!candidateRef) {
    changed.push(...gitOutput(root, ['ls-files', '--others', '--exclude-standard'], issues, 'untracked-file inventory')
      .split(/\r?\n/).filter(Boolean));
  }
  const relevant = [...new Set(changed.filter(file => !file.startsWith('logs/')))];
  for (const file of relevant) if (!validInventoryPath(file)) issues.push('candidate inventory contains an unsafe path');
  return relevant.filter(validInventoryPath).sort();
}

function hashCandidateFile(root, file, candidateRef, issues) {
  if (candidateRef) {
    const content = gitOutput(root, ['show', `${candidateRef}:${file}`], issues, `manifest file ${file}`, 'buffer');
    if (content.length > MAX_MANIFEST_FILE_BYTES) {
      issues.push(`manifest file ${file} exceeds the ${MAX_MANIFEST_FILE_BYTES}-byte limit`);
      return null;
    }
    return createHash('sha256').update(content).digest('hex');
  }
  const item = checkedPath(root, file, `manifest file ${file}`, 'file', issues);
  if (!item || item.stat.size > MAX_MANIFEST_FILE_BYTES) {
    if (item) issues.push(`manifest file ${file} exceeds the ${MAX_MANIFEST_FILE_BYTES}-byte limit`);
    return null;
  }
  try {
    return createHash('sha256').update(readFileSync(item.path)).digest('hex');
  } catch {
    issues.push(`manifest file ${file} is unreadable`);
    return null;
  }
}

function boundedResourceFiles(directory, issues) {
  const files = [];
  let handle;
  try {
    handle = opendirSync(directory);
    for (let entries = 0; ; entries += 1) {
      const entry = handle.readSync();
      if (!entry) break;
      if (entries >= MAX_RESOURCE_DIRECTORY_ENTRIES) {
        issues.push(`resource directory exceeds ${MAX_RESOURCE_DIRECTORY_ENTRIES} entries`);
        break;
      }
      if (!entry.name.endsWith('.json')) continue;
      if (files.length >= MAX_RESOURCE_COUNT) {
        issues.push(`resource directory exceeds ${MAX_RESOURCE_COUNT} JSON records`);
        break;
      }
      files.push(entry.name);
    }
  } catch {
    issues.push('resource directory is unreadable');
  } finally {
    try { handle?.closeSync(); } catch { /* The directory may already be closed at EOF. */ }
  }
  return files.sort();
}

export function verifyRunEvidence({ repoRoot, run, promptLog, resources, baseRef, candidateRef }) {
  const issues = [];
  let root;
  try {
    root = realpathSync(resolve(repoRoot));
    if (!lstatSync(root).isDirectory()) throw new Error();
  } catch {
    return { ok: false, issues: ['repository root is unavailable'], records: 0, manifestFiles: 0 };
  }
  const runItem = checkedPath(root, run, 'run record', 'file', issues);
  const promptItem = checkedPath(root, promptLog, 'prompt log', 'file', issues);
  const resourcesItem = checkedPath(root, resources, 'resource directory', 'directory', issues);
  const runMarkdown = readBounded(runItem, 'run record', MAX_MARKDOWN_BYTES, issues);
  const promptMarkdown = readBounded(promptItem, 'prompt log', MAX_MARKDOWN_BYTES, issues);
  const fields = parseRunFields(runMarkdown, issues);
  for (const field of REQUIRED_RUN_FIELDS) {
    const value = fields.get(field);
    if (!value || /^(pending|tbd|todo)$/i.test(value)) issues.push(`run record field is incomplete: ${field}`);
  }
  if (fields.get('Status') && !TERMINAL_STATUS.test(fields.get('Status'))) {
    issues.push('completed run Status must state verified or released');
  }
  for (const field of ['Stable findings and dispositions', 'Resource-record references']) {
    if (PENDING_CLOSURE.test(fields.get(field) ?? '')) issues.push(`run record ${field} still indicates pending closure`);
  }
  if (PENDING_CLOSURE.test(promptMarkdown)) issues.push('prompt log still contains a pending closure marker');
  const sections = parseSections(promptMarkdown);
  for (const section of REQUIRED_PROMPT_SECTIONS) {
    const content = sections.get(section);
    if (!content || content.replace(/\s/g, '').length < 80) issues.push(`prompt log section is missing or too short: ${section}`);
  }

  const resourceFiles = resourcesItem ? boundedResourceFiles(resourcesItem.path, issues) : [];
  if (resourceFiles.length === 0) issues.push('resource directory contains no JSON records');
  const ids = new Set();
  const records = [];
  let totalResourceBytes = 0;
  for (const file of resourceFiles.slice(0, MAX_RESOURCE_COUNT)) {
    const relativeResource = resourcesItem ? relative(root, resolve(resourcesItem.path, file)) : file;
    const item = checkedPath(root, relativeResource, `resource ${file}`, 'file', issues);
    if (item) totalResourceBytes += item.stat.size;
    if (totalResourceBytes > MAX_RESOURCE_TOTAL_BYTES) {
      issues.push(`resource records exceed the ${MAX_RESOURCE_TOTAL_BYTES}-byte total limit`);
      break;
    }
    const text = readBounded(item, `resource ${file}`, MAX_RESOURCE_BYTES, issues);
    if (!text) continue;
    try {
      const record = validateRecord(JSON.parse(text), file, basename(resourcesItem.path), issues);
      if (record && ids.has(record.id)) issues.push(`${file} duplicates another resource id`);
      if (record) { ids.add(record.id); records.push(record); }
    } catch {
      issues.push(`${file} is invalid JSON`);
    }
  }
  if (!records.some(record => record.status === 'succeeded' && record.stage === 'independent-review' && record.agent !== 'main')) {
    issues.push('resource records contain no successful independent-review invocation');
  }

  const manifestPattern = /^\|\s*`([^`]+)`\s*\|\s*`([a-f0-9]{64})`\s*\|/gm;
  const manifestRows = [...withoutFences(runMarkdown).matchAll(manifestPattern)];
  if (manifestRows.length === 0) issues.push('run record has no SHA-256 manifest rows');
  if (manifestRows.length > MAX_MANIFEST_ROWS) issues.push(`run manifest exceeds ${MAX_MANIFEST_ROWS} rows`);
  const manifest = new Map();
  for (const [, file, expected] of manifestRows.slice(0, MAX_MANIFEST_ROWS)) {
    if (!validInventoryPath(file)) { issues.push('run manifest contains an unsafe path'); continue; }
    if (manifest.has(file)) issues.push(`run manifest repeats ${file}`);
    manifest.set(file, expected);
  }
  const inventory = candidateInventory(root, baseRef, candidateRef, issues);
  const missing = inventory.filter(file => !manifest.has(file));
  const extra = [...manifest.keys()].filter(file => !inventory.includes(file));
  if (missing.length) issues.push(`run manifest omits candidate files: ${missing.join(', ')}`);
  if (extra.length) issues.push(`run manifest includes files outside candidate inventory: ${extra.join(', ')}`);
  for (const [file, expected] of manifest) {
    const actual = hashCandidateFile(root, file, candidateRef, issues);
    if (actual && actual !== expected) issues.push(`manifest mismatch for ${file}`);
  }

  return { ok: issues.length === 0, issues, records: resourceFiles.length, manifestFiles: manifestRows.length };
}

function parseArgs(argv) {
  const values = { repoRoot: process.cwd() };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Invalid argument ${String(key)}`);
    values[key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  for (const required of ['run', 'promptLog', 'resources', 'baseRef']) {
    if (!values[required]) throw new Error(`Missing --${required.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`);
  }
  return values;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = verifyRunEvidence(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch {
    process.stderr.write('Evidence verification could not start.\n');
    process.exitCode = 2;
  }
}
