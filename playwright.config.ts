import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './workflow/tests/browser',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: false,
    env: { NODE_ENV: 'production', SESSION_SECRET: 'browser-test-only-secret-at-least-32-characters', TRUST_PROXY_HOPS: '1', DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://test:test@127.0.0.1:5432/specsentry_test' },
  },
});
