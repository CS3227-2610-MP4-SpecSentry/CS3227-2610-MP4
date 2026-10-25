const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
for (const path of ['/api/health', '/api/ready', '/']) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Smoke check failed: ${path} (${response.status})`);
  console.info(`PASS ${path}`);
}
