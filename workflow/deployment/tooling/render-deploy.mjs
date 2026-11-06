import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';
import { validateDigest, validateImageReference } from './release-candidate.mjs';

const API_ORIGIN = 'https://api.render.com';
const MAX_BODY_BYTES = 65_536;
const idPattern = /^(?:srv|dep)-[A-Za-z0-9_-]{3,120}$/;
const transient = new Set([429, 500, 502, 503, 504]);
const failedStatuses = new Set(['deactivated', 'build_failed', 'update_failed', 'canceled', 'pre_deploy_failed']);

function validateId(value, kind) {
  if (!idPattern.test(value ?? '') || !value.startsWith(`${kind}-`)) throw new Error(`Invalid Render ${kind === 'srv' ? 'service' : 'deploy'} ID`);
  return value;
}
async function limitedText(response, limit = MAX_BODY_BYTES) {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > limit) throw new Error('Render response is too large');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error('Render response is too large'); }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((value) => Buffer.from(value))));
}
function retryDelay(response, attempt) {
  const header = response.headers.get('retry-after');
  const parsed = header && /^\d+$/.test(header) ? Number(header) * 1000 : 250 * (2 ** attempt);
  return Math.min(5_000, parsed);
}
export async function renderRequest(path, { method = 'GET', body, token, fetchImpl = fetch,
  attempts = 4, timeoutMs = 10_000, sleep = delay } = {}) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) throw new Error('Render API token is unavailable');
  const url = new URL(path, API_ORIGIN);
  if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/v1/services/')) throw new Error('Render API target is not allowlisted');
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, { method, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json', authorization: `Bearer ${token}`,
          ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
    } catch (error) {
      if (attempt + 1 >= attempts) throw new Error('Render API request failed', { cause: error });
      await sleep(250 * (2 ** attempt));
      continue;
    }
    if (response.status >= 300 && response.status < 400) throw new Error('Render API redirect rejected');
    const text = await limitedText(response);
    if (response.ok) {
      try { return text ? JSON.parse(text) : null; }
      catch { throw new Error('Render API returned malformed JSON'); }
    }
    if (!transient.has(response.status) || attempt + 1 >= attempts)
      throw new Error(`Render API request rejected (${response.status})`);
    await sleep(retryDelay(response, attempt));
  }
  throw new Error('Render API retry budget exhausted');
}
function validateDeploy(value, serviceId, deployId, image) {
  validateId(serviceId, 'srv');
  validateId(deployId, 'dep');
  if (!value || value.id !== deployId || typeof value.status !== 'string') throw new Error('Render deploy response identity mismatch');
  if (value.image?.ref !== image) throw new Error('Render deploy image reference mismatch');
  const expectedDigest = image.slice(image.indexOf('@') + 1);
  if (value.image?.sha && ![expectedDigest, expectedDigest.slice('sha256:'.length)].includes(value.image.sha))
    throw new Error('Render deploy image digest mismatch');
  return value;
}
function validateCreatedDeploy(value, serviceId, image) {
  validateId(serviceId, 'srv');
  const deployId = validateId(value?.id, 'dep');
  if (typeof value.status !== 'string') throw new Error('Render deploy response identity mismatch');
  if (value.image !== undefined) validateDeploy(value, serviceId, deployId, image);
  return deployId;
}
export async function deployImage({ serviceId, token, image, fetchImpl = fetch, sleep,
  pollIntervalMs = 5_000, maxPolls = 60, deadlineMs = 600_000, now = () => Date.now() }) {
  validateId(serviceId, 'srv');
  const digest = validateDigest(image?.slice(image.lastIndexOf('@') + 1));
  validateImageReference(image, digest);
  const encodedService = encodeURIComponent(serviceId);
  const created = await renderRequest(`/v1/services/${encodedService}/deploys`, {
    // Render does not expose an idempotency key. Never retry an ambiguous mutation.
    method: 'POST', body: { imageUrl: image }, token, fetchImpl, sleep, attempts: 1,
  });
  const deployId = validateCreatedDeploy(created, serviceId, image);
  const deadline = now() + deadlineMs;
  for (let poll = 0; poll < maxPolls; poll += 1) {
    if (now() >= deadline) break;
    const current = validateDeploy(await renderRequest(
      `/v1/services/${encodedService}/deploys/${encodeURIComponent(deployId)}`,
      { token, fetchImpl, sleep }), serviceId, deployId, image);
    if (current.status === 'live') return Object.freeze({ deployId, imageDigest: digest });
    if (failedStatuses.has(current.status)) throw new Error(`Render deploy failed (${current.status})`);
    if (!['created', 'queued', 'build_in_progress', 'update_in_progress', 'pre_deploy_in_progress'].includes(current.status))
      throw new Error('Render deploy returned an unknown status');
    if (poll + 1 < maxPolls) await (sleep ?? delay)(Math.min(pollIntervalMs, Math.max(0, deadline - now())));
  }
  throw new Error('Render deploy did not become live before the deadline');
}
async function main() {
  if (!process.argv.includes('--execute')) throw new Error('Provider mutation requires the explicit --execute flag');
  const imageIndex = process.argv.indexOf('--image');
  const outputIndex = process.argv.indexOf('--output');
  if (imageIndex < 0 || outputIndex < 0) throw new Error('Image and evidence output are required');
  const result = await deployImage({ serviceId: process.env.RENDER_SERVICE_ID,
    token: process.env.RENDER_API_TOKEN, image: process.argv[imageIndex + 1] });
  const serviceFingerprint = createHash('sha256').update(process.env.RENDER_SERVICE_ID).digest('hex');
  await writeFile(process.argv[outputIndex + 1], `${JSON.stringify({ schemaVersion: 1,
    deployId: result.deployId, imageDigest: result.imageDigest, serviceFingerprint }, null, 2)}\n`, { mode: 0o600 });
  console.info('PASS Render reports the immutable image live');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : 'Render deployment failed'}`);
  process.exitCode = 1;
});
