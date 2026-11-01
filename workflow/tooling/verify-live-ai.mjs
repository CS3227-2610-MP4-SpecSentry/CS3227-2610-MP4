import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';

const require = createRequire(import.meta.url);
const { readAiConfig } = require('../../src/server/dist/config.js');
const { verifyContributorLive } = require('../../src/server/dist/ai/live-verification.js');

try {
  if (process.argv.slice(2).some(argument => argument !== '--live') || process.argv.slice(2).length > 1)
    throw new Error('Unsupported verification arguments');
  const live = process.argv.includes('--live');
  loadEnvironment({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
  // This process-only setting validates credentials for synthetic calls; it never enables the running app.
  const configuration = readAiConfig({ ...process.env, AI_LIVE_ENABLED: live ? 'true' : 'false' });
  const report = await verifyContributorLive(configuration, { live });
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} catch {
  console.error(JSON.stringify({ status: 'FAILED', errorClass: 'CONFIGURATION',
    message: 'Check server-side AI settings, build output and verification arguments. No provider details were logged.' }));
  process.exitCode = 1;
}
