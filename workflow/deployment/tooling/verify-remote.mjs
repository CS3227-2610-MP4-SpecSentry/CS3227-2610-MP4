import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import { setTimeout as delay } from 'node:timers/promises';
import { validateSourceSha } from './release-candidate.mjs';

const MAX_BODY_BYTES = 65_536;
class SmokeError extends Error { constructor(message, retryable = false) { super(message); this.retryable = retryable; } }

export function validateDeploymentTarget(raw, expectedHost) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('Invalid deployment base URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash)
    throw new Error('Deployment base URL must be an HTTPS origin');
  if (typeof expectedHost !== 'string' || !/^[a-z0-9.-]{3,253}$/.test(expectedHost) || url.hostname !== expectedHost)
    throw new Error('Deployment host does not match the protected environment');
  return url;
}
async function limitedText(response) {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw new SmokeError('Smoke response is too large');
  if (!response.body) return '';
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new SmokeError('Smoke response is too large'); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}
async function request(url, { fetchImpl, timeoutMs, method = 'GET', headers = {}, body } = {}) {
  let response;
  try {
    response = await fetchImpl(url, { method, headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  } catch (error) { throw new SmokeError('Smoke request failed', true, { cause: error }); }
  if (response.status >= 300 && response.status < 400) throw new SmokeError('Smoke redirect rejected');
  const text = await limitedText(response);
  if (!response.ok) throw new SmokeError(`Smoke endpoint rejected (${response.status})`, response.status === 429 || response.status >= 500);
  return { response, text };
}
function parseJson(text) { try { return JSON.parse(text); } catch { throw new SmokeError('Smoke endpoint returned malformed JSON'); } }
function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join() === [...keys].sort().join();
}
function cookie(response, requireSecurity = false) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
  const value = values.find((entry) => /^specsentry\.sid=/.test(entry));
  if (!value) throw new SmokeError('Session cookie missing');
  if (requireSecurity && (!/;\s*Secure(?:;|$)/i.test(value) || !/;\s*HttpOnly(?:;|$)/i.test(value)
      || !/;\s*SameSite=Lax(?:;|$)/i.test(value))) throw new SmokeError('Session cookie security attributes missing');
  return value.split(';', 1)[0];
}
async function publicSmoke(base, sourceSha, options) {
  const health = parseJson((await request(new URL('/api/health', base), options)).text);
  if (!exactKeys(health, ['status', 'service', 'deployment']) || health.status !== 'ok' || health.service !== 'specsentry'
      || !exactKeys(health.deployment, ['sourceRevision']) || health.deployment.sourceRevision !== sourceSha)
    throw new SmokeError('Deployment source marker mismatch');
  const readiness = parseJson((await request(new URL('/api/ready', base), options)).text);
  if (!exactKeys(readiness, ['status']) || readiness.status !== 'ready') throw new SmokeError('Readiness response is invalid', true);
  const root = await request(new URL('/', base), options);
  if (!(root.response.headers.get('content-type') ?? '').toLowerCase().includes('text/html'))
    throw new SmokeError('Application root is not HTML');
}
async function authenticatedSmoke(base, credentials, options) {
  if (!credentials || typeof credentials.username !== 'string' || credentials.username.length < 1 || credentials.username.length > 80
      || typeof credentials.password !== 'string' || credentials.password.length < 1 || credentials.password.length > 256)
    throw new SmokeError('Smoke account credentials are unavailable');
  const csrfResult = await request(new URL('/api/auth/csrf', base), options);
  const csrfBody = parseJson(csrfResult.text); const initialCookie = cookie(csrfResult.response);
  if (!exactKeys(csrfBody, ['csrfToken']) || !/^[0-9a-f]{64}$/.test(csrfBody.csrfToken)) throw new SmokeError('CSRF bootstrap is invalid');
  const loginResult = await request(new URL('/api/auth/login', base), { ...options, method: 'POST',
    headers: { 'content-type': 'application/json', cookie: initialCookie, 'x-csrf-token': csrfBody.csrfToken },
    body: { username: credentials.username, password: credentials.password } });
  const login = parseJson(loginResult.text); const sessionCookie = cookie(loginResult.response, true);
  if (!exactKeys(login, ['account', 'csrfToken', 'expiresAt']) || login.account?.role !== 'RELEASE_MAINTAINER'
      || !/^[0-9a-f]{64}$/.test(login.csrfToken) || !Number.isFinite(login.expiresAt))
    throw new SmokeError('Smoke account session is invalid');
  const session = parseJson((await request(new URL('/api/auth/session', base), { ...options,
    headers: { cookie: sessionCookie } })).text);
  if (session.account?.id !== login.account.id || session.account?.role !== 'RELEASE_MAINTAINER')
    throw new SmokeError('Authenticated session verification failed');
  const safeRead = parseJson((await request(new URL('/api/release-candidates?limit=1', base), { ...options,
    headers: { cookie: sessionCookie } })).text);
  if (!Array.isArray(safeRead.items) || !('nextCursor' in safeRead)) throw new SmokeError('Role-owned smoke read failed');
  await request(new URL('/api/auth/logout', base), { ...options, method: 'POST',
    headers: { cookie: sessionCookie, 'x-csrf-token': login.csrfToken } });
}
export async function verifyRemote({ baseUrl, expectedHost, expectedSourceSha, credentials,
  fetchImpl = fetch, timeoutMs = 10_000, totalTimeoutMs = 120_000, retryIntervalMs = 5_000,
  now = () => Date.now(), sleep = delay }) {
  const base = validateDeploymentTarget(baseUrl, expectedHost);
  validateSourceSha(expectedSourceSha);
  const deadline = now() + totalTimeoutMs;
  let last;
  while (now() < deadline) {
    try {
      await publicSmoke(base, expectedSourceSha, { fetchImpl, timeoutMs });
      await authenticatedSmoke(base, credentials, { fetchImpl, timeoutMs });
      return Object.freeze({ host: expectedHost, sourceSha: expectedSourceSha });
    } catch (error) {
      last = error;
      if (!(error instanceof SmokeError) || !error.retryable) throw error;
      if (now() + retryIntervalMs >= deadline) break;
      await sleep(retryIntervalMs);
    }
  }
  throw new Error('Deployment smoke deadline exceeded', { cause: last });
}
async function main() {
  await verifyRemote({ baseUrl: process.env.DEPLOYMENT_BASE_URL,
    expectedHost: process.env.EXPECTED_DEPLOYMENT_HOST, expectedSourceSha: process.env.EXPECTED_SOURCE_SHA,
    credentials: { username: process.env.SMOKE_USERNAME, password: process.env.SMOKE_PASSWORD } });
  console.info('PASS deployment source, readiness, session, CSRF and role smoke checks');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : 'remote verification failed'}`);
  process.exitCode = 1;
});
