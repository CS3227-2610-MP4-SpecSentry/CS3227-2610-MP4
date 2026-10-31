import { defineConfig, devices } from '@playwright/test';

const revocationApiSpec = process.argv.some((arg) =>
  arg.replaceAll('\\', '/').endsWith('/reviewer-revocation.spec.ts'));

export default defineConfig({
  testDir: './workflow/tests/browser',
  // Browser fixtures share and truncate one explicitly disposable database.
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: revocationApiSpec
      ? 'node -r ts-node/register src/server/src/main.ts'
      : 'node -r ts-node/register workflow/tests/browser/fixtures/reviewer-patch-risk.ts',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: false,
    env: { NODE_ENV: 'production', TS_NODE_PROJECT: 'src/server/tsconfig.json', TS_NODE_TRANSPILE_ONLY: 'true', SESSION_SECRET: 'browser-test-only-secret-at-least-32-characters', TRUST_PROXY_HOPS: '1', DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://test:test@127.0.0.1:5432/specsentry_test' },
  },
});
