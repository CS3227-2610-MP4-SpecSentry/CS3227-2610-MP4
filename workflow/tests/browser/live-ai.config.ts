import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

// Avoid automatic failure DOM snapshots containing transient model suggestions.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

export default defineConfig({
  testDir: __dirname,
  testMatch: 'contributor-live-ai.spec.ts',
  outputDir: resolve(__dirname, '../../../.tools/live-ai-app-acceptance/browser-results'),
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:3197',
    trace: 'off', screenshot: 'off', video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
