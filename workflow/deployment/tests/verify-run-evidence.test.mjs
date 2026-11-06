import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { verifyRunEvidence } from '../tooling/verify-run-evidence.mjs';

const fields = [
  'Prompter and inference source', 'Goal and requirement IDs', 'Source revision / branch',
  'Target environment (or local-only)', 'Approved authority and excluded actions',
  'Agent assignments and exact write sets', 'Focused context supplied / retrieved later',
  'Secret names required (names only; no values)', 'Source SHA / immutable image digest',
  'Migration compatibility and recovery decision', 'Acceptance, denial, failure and rollback checks',
  'Commands and actual results', 'Stable findings and dispositions',
  'Failed/interrupted attempts and retry cost', 'Resource-record references',
  'Human approvals required / observed evidence', 'Unresolved risks and unavailable telemetry',
  'Next authorized action', 'Status',
];
const usage = { input_tokens: null, output_tokens: null, cache_read_tokens: null, tool_calls: null, retries: null };
const unavailable = Object.fromEntries(Object.keys(usage).map(field => [field, 'not exposed by fixture runtime']));

function record(id, agent, stage) {
  return {
    id, prompter: 'fixture', session: 'fixture-session', agent, invocation: `${id}-invocation`, stage,
    attempt: 1, selected_model: 'unavailable', selected_effort: 'unavailable',
    settings_reason: 'fixture runtime does not expose settings',
    started_at: '2026-11-05T00:00:00.000000+00:00', ended_at: '2026-11-05T00:00:01.000000+00:00',
    elapsed_seconds: 1, status: 'succeeded', usage, unavailable_reasons: unavailable,
    outcome: 'Fixture interval completed with observable evidence.',
  };
}

function runText(hash, overrides = {}) {
  const values = Object.fromEntries(fields.map(field => [field, 'Recorded bounded evidence for this completed fixture run.']));
  values.Status = 'verified';
  values['Stable findings and dispositions'] = 'All stable findings are closed with regression evidence.';
  values['Resource-record references'] = 'Two finished structured records and a generated resource report are present.';
  Object.assign(values, overrides);
  return [
    '# Run', ...fields.map(field => `- ${field}: ${values[field]}`), '',
    '## Frozen code-candidate manifest', '', '| File | SHA-256 |', '| --- | --- |',
    `| \`source.ts\` | \`${hash}\` |`, '',
  ].join('\n');
}

function promptText() {
  return [
    '# Prompt', '', '## Context and requests',
    'The fixture records an explicit bounded change request, the source boundary, authority, exclusions and the human-verification limitation for the completed run.', '',
    '## Changes and evidence',
    'The fixture names the changed source, deterministic validation, independent verification outcome, failure behavior and remaining limitations without claiming deployment.', '',
    '## Resource record',
    'The fixture links finished main and independent-review intervals, reports unavailable telemetry honestly and references the final generated resource report.', '',
  ].join('\n');
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'deployment-evidence-'));
  const resources = join(root, 'logs', 'fixture', 'resources', 'fixture-session');
  mkdirSync(resources, { recursive: true });
  writeFileSync(join(root, 'source.ts'), 'export const value = 0;\n');
  git(root, ['init', '-q']);
  git(root, ['config', 'user.name', 'Fixture']);
  git(root, ['config', 'user.email', 'fixture@example.invalid']);
  git(root, ['add', 'source.ts']);
  git(root, ['commit', '-qm', 'fixture base']);
  writeFileSync(join(root, 'source.ts'), 'export const value = 1;\n');
  const hash = createHash('sha256').update('export const value = 1;\n').digest('hex');
  const run = join(root, 'logs', 'fixture', 'run.md');
  const prompt = join(root, 'logs', 'fixture', 'prompt.md');
  mkdirSync(dirname(run), { recursive: true });
  writeFileSync(run, runText(hash));
  writeFileSync(prompt, promptText());
  writeFileSync(join(resources, 'main.json'), JSON.stringify(record('main', 'main', 'implement')));
  writeFileSync(join(resources, 'verifier.json'), JSON.stringify(record('verifier', 'release-verifier', 'independent-review')));
  return { root, resources, run, prompt, hash };
}

function verify(item, overrides = {}) {
  return verifyRunEvidence({
    repoRoot: item.root, run: 'logs/fixture/run.md', promptLog: 'logs/fixture/prompt.md',
    resources: 'logs/fixture/resources/fixture-session', baseRef: 'HEAD', ...overrides,
  });
}

test('accepts complete bounded run evidence and candidate inventory', () => {
  const item = fixture();
  assert.deepEqual(verify(item), { ok: true, issues: [], records: 2, manifestFiles: 1 });
});

test('rejects active status and pending closure markers', () => {
  const item = fixture();
  for (const status of ['active', 'verified locally; re-review active', 'active; not released']) {
    writeFileSync(item.run, runText(item.hash, { Status: status }));
    const result = verify(item);
    assert.equal(result.ok, false);
    assert.match(result.issues.join('\n'), /Status must state verified or released/);
  }
  writeFileSync(item.run, runText(item.hash, {
    'Stable findings and dispositions': 'Fresh re-verification is pending.',
    'Resource-record references': 'Final report pending closure.',
  }));
  writeFileSync(item.prompt, `${promptText()}\nIndependent re-review remains pending.\n`);
  const pendingResult = verify(item);
  assert.equal(pendingResult.ok, false);
  assert.match(pendingResult.issues.join('\n'), /pending closure/);
});

test('ignores headings inside fenced examples and requires substantive sections', () => {
  const item = fixture();
  writeFileSync(item.prompt, '```md\n## Context and requests\nexample only\n## Changes and evidence\nexample only\n## Resource record\nexample only\n```\n');
  const result = verify(item);
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /section is missing or too short/);
});

test('does not let a shorter nested fence expose headings from an outer code block', () => {
  const item = fixture();
  writeFileSync(item.prompt, [
    '````md', '```', '## Context and requests',
    'This content is long enough to appear substantive but remains inside the outer four-backtick code block and must not count as evidence.',
    '## Changes and evidence',
    'This content is long enough to appear substantive but remains inside the outer four-backtick code block and must not count as evidence.',
    '## Resource record',
    'This content is long enough to appear substantive but remains inside the outer four-backtick code block and must not count as evidence.',
    '````', '',
  ].join('\n'));
  const result = verify(item);
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /section is missing or too short/);
});

test('rejects unfinished, malformed and inconsistent resource records', () => {
  const item = fixture();
  const invalid = { ...record('main', 'main', 'implement'), agent: { role: 'main' }, status: 'running',
    elapsed_seconds: 99 };
  writeFileSync(join(item.resources, 'main.json'), JSON.stringify(invalid));
  const result = verify(item);
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /invalid agent/);
  assert.match(result.issues.join('\n'), /unfinished or invalid status/);
  assert.match(result.issues.join('\n'), /invalid elapsed_seconds/);
});

test('requires a successful independent-review interval', () => {
  const item = fixture();
  writeFileSync(join(item.resources, 'verifier.json'), JSON.stringify({
    ...record('verifier', 'release-verifier', 'independent-review'), status: 'failed',
  }));
  const result = verify(item);
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /no successful independent-review/);
});

test('rejects omitted candidate files and manifest drift', () => {
  const item = fixture();
  writeFileSync(join(item.root, 'extra.ts'), 'export const omitted = true;\n');
  let result = verify(item);
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /omits candidate files: extra.ts/);
  rmSync(join(item.root, 'extra.ts'));
  writeFileSync(join(item.root, 'source.ts'), 'export const value = 2;\n');
  result = verify(item);
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /manifest mismatch for source.ts/);
});

test('rejects lexical path traversal', () => {
  const item = fixture();
  const result = verify(item, { run: '../outside.md' });
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /run record must remain inside the repository/);
});

for (const target of ['run', 'prompt', 'resource-directory', 'resource-file', 'manifest-file']) {
  test(`rejects ${target} symbolic links`, () => {
    const item = fixture();
    const outside = mkdtempSync(join(tmpdir(), 'deployment-evidence-outside-'));
    if (target === 'run') {
      writeFileSync(join(outside, 'run.md'), runText(item.hash));
      rmSync(item.run); symlinkSync(join(outside, 'run.md'), item.run);
    } else if (target === 'prompt') {
      writeFileSync(join(outside, 'prompt.md'), promptText());
      rmSync(item.prompt); symlinkSync(join(outside, 'prompt.md'), item.prompt);
    } else if (target === 'resource-directory') {
      rmSync(item.resources, { recursive: true }); symlinkSync(outside, item.resources);
    } else if (target === 'resource-file') {
      const linked = join(item.resources, 'main.json');
      writeFileSync(join(outside, 'main.json'), JSON.stringify(record('main', 'main', 'implement')));
      rmSync(linked); symlinkSync(join(outside, 'main.json'), linked);
    } else {
      writeFileSync(join(outside, 'source.ts'), 'export const value = 1;\n');
      rmSync(join(item.root, 'source.ts')); symlinkSync(join(outside, 'source.ts'), join(item.root, 'source.ts'));
    }
    const result = verify(item);
    assert.equal(result.ok, false);
    assert.match(result.issues.join('\n'), /symbolic link/);
  });
}

test('bounds Markdown size and resource count', () => {
  const item = fixture();
  writeFileSync(item.run, 'x'.repeat(1_000_001));
  let result = verify(item);
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /1000000-byte limit/);
  writeFileSync(item.run, runText(item.hash));
  for (let index = 0; index < 101; index++) {
    writeFileSync(join(item.resources, `extra-${String(index).padStart(3, '0')}.json`), '{}');
  }
  result = verify(item);
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /exceeds 100 JSON records/);
});

test('bounds total resource-directory enumeration', () => {
  const item = fixture();
  for (let index = 0; index <= 1_000; index++) {
    writeFileSync(join(item.resources, `ignored-${String(index).padStart(4, '0')}.txt`), 'x');
  }
  const result = verify(item);
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /exceeds 1000 entries/);
});

test('sanitizes malformed JSON and structured-value diagnostics', () => {
  const item = fixture();
  const marker = 'synthetic_secret_marker';
  writeFileSync(join(item.resources, 'main.json'), `{${marker}`);
  let result = verify(item);
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /main.json is invalid JSON/);
  assert.equal(JSON.stringify(result).includes(marker), false);
  assert.equal(JSON.stringify(result).includes(item.root), false);
  writeFileSync(join(item.resources, 'main.json'), JSON.stringify({
    ...record('main', 'main', 'implement'), status: marker,
  }));
  result = verify(item);
  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /unfinished or invalid status/);
  assert.equal(JSON.stringify(result).includes(marker), false);
});
