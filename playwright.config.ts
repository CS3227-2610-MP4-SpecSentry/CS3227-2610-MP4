import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './workflow/tests/browser',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: false,
    env: { NODE_ENV: 'production', DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/specsentry_test' },
  },
});
