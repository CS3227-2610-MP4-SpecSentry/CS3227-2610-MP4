import { stat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const required = [
  ['src/server/src/app.module.ts', 'file'],
  ['src/client/src/App.tsx', 'file'],
  ['src/shared/src/index.ts', 'file'],
  ['src/website/index.html', 'file'],
  ['workflow/README.md', 'file'],
  ['workflow/specs/PRODUCT-SPEC.md', 'file'],
  ['workflow/specs/AI-SECURITY-SPEC.md', 'file'],
  ['workflow/DEVELOPMENT.md', 'file'],
  ['workflow/RESOURCES.md', 'file'],
  ['workflow/TRACEABILITY.md', 'file'],
  ['workflow/SUBMISSION.md', 'file'],
  ['docs/UserGuide.md', 'file'],
  ['docs/DeveloperGuide.md', 'file'],
  ['docs/Reflections.md', 'file'],
  ['.github/workflows/ci.yml', 'file'],
  ['.github/workflows/pages.yml', 'file'],
  ['logs/', 'directory'],
];

let missing = 0;
for (const [path, kind] of required) {
  let present = false;
  try {
    const info = await stat(new URL(path, root));
    present = kind === 'directory' ? info.isDirectory() : info.isFile() && info.size > 0;
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
  }
  console.log(`${present ? 'PRESENT' : 'MISSING'} ${path}`);
  if (!present) missing++;
}

async function containsSummary(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(encodeURIComponent(entry.name) + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory() && await containsSummary(path)) return true;
    if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md'
      && (await stat(path)).size > 0) return true;
  }
  return false;
}

try {
  if (!await containsSummary(new URL('logs/', root))) {
    console.error('MISSING at least one non-empty Markdown prompt summary under logs/');
    missing++;
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  // The directory check above already reports a missing logs directory.
}

console.log(`Repository inspected: ${fileURLToPath(root)}`);
console.log('Presence only: content accuracy, feature completion, public GitHub access, live URLs,');
console.log('security/AI tests, experiment results, master freshness and human log review require separate verification.');
if (missing > 0) process.exitCode = 1;
