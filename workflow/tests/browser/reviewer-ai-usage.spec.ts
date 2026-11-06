import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createReviewerUsageFixture } from './fixtures/reviewer-ai-usage';

type Fixture = Awaited<ReturnType<typeof createReviewerUsageFixture>>;
async function signIn(page: Page, f: Fixture) {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' }); await page.goto('/reviewer');
  await page.getByLabel('Username').fill(f.prefix + '-reviewer'); await page.getByLabel('Password').fill(f.password); await page.getByLabel('Password').press('Enter');
  await expect(page.getByRole('button', { name: 'Show my AI usage' })).toBeVisible();
}

test.describe('Reviewer usage', () => {
  test('usage-own-keyboard: opens without assignment, shows only own Reviewer totals and remains accessible', async ({ page }) => {
    const f = await createReviewerUsageFixture();
    try {
      await signIn(page, f); const panel = page.getByRole('region', { name: 'My Reviewer AI usage' });
      await panel.getByRole('button', { name: 'Show my AI usage' }).focus(); await page.keyboard.press('Enter');
      await expect(panel.getByText('Provider total tokens', { exact: true }).locator('+ dd')).toHaveText('120');
      await expect(panel.getByText('Outbound attempts dispatched today', { exact: true }).locator('+ dd')).toHaveText('1');
      await expect(panel.getByText('UTC; separate from application quota')).toBeVisible();
      await expect(panel).not.toContainText('private-template');
      expect((await new AxeBuilder({ page }).include('[aria-label="My Reviewer AI usage"]').analyze()).violations).toEqual([]);
      await panel.getByRole('button', { name: 'Refresh AI usage' }).focus(); await page.keyboard.press('Enter');
      await expect(panel.getByText('Provider total tokens', { exact: true }).locator('+ dd')).toHaveText('120');
    } finally { await f.dispose(); }
  });

  test('usage-navigation-auth: clears on real navigation/back, refreshes authorization and hides visible totals on session loss', async ({ page }) => {
    const f = await createReviewerUsageFixture();
    try {
      await signIn(page, f); await page.getByRole('button', { name: 'Show my AI usage' }).click();
      await expect(page.getByText('Provider total tokens', { exact: true })).toBeVisible();
      await page.goto('/api/health'); await page.goBack();
      await expect(page.getByRole('button', { name: 'Show my AI usage' })).toBeVisible();
      await expect(page.getByText('Provider total tokens', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Show my AI usage' }).click(); await expect(page.getByText('Provider total tokens', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('promptTokens');
      await f.pool.query('DELETE FROM "AuthSession" WHERE data::jsonb->>\'userId\'=$1', [f.reviewer]);
      await page.getByRole('button', { name: 'Refresh AI usage' }).click();
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible(); await expect(page.getByText('Provider total tokens', { exact: true })).toHaveCount(0);
    } finally { await f.dispose(); }
  });

  test('usage-manual-fallback: a failed usage read leaves explicit manual review usable', async ({ page }) => {
    const f = await createReviewerUsageFixture();
    try {
      await signIn(page, f); await page.route('**/api/reviews/ai/usage', route => route.fulfill({ status: 503, json: { message: 'synthetic unavailable' } }));
      await page.getByRole('button', { name: 'Show my AI usage' }).click(); await expect(page.getByText(/AI usage is unavailable/)).toBeVisible();
      await page.getByRole('button', { name: 'Claim ' + f.prefix, exact: true }).click();
      const manual = page.getByRole('form', { name: 'Create finding', exact: true });
      await manual.getByLabel('Description', { exact: true }).fill('Manual review remains usable.');
      await expect(manual.getByRole('button', { name: 'Create finding', exact: true })).toBeEnabled();
    } finally { await f.dispose(); }
  });
});
