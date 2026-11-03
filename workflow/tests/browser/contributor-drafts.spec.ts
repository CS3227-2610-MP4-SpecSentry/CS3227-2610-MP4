import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const prefix = `contributor-browser-${randomUUID()}`;
const password = 'synthetic-contributor-browser-password';
let pool: Pool;
test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit migrated disposable TEST_DATABASE_URL required');
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await pool.query('INSERT INTO "UserAccount" (id,username,"passwordHash",role) VALUES ($1,$2,$3,$4)',
    [randomUUID(), prefix, await argon2.hash(password, { type: argon2.argon2id }), 'CONTRIBUTOR']);
});
test.afterAll(async () => {
  if (!pool) return;
  await pool.query(`DELETE FROM "AuthSession" WHERE data::jsonb->>'userId' IN (SELECT id FROM "UserAccount" WHERE username=$1)`, [prefix]);
  // Retain synthetic append-only proposal evidence until this disposable database is dropped.
  await pool.end();
});

test('private create/list/detail supports keyboard, validation, escaped text and session loss', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' });
  await page.goto('/contributor');
  await page.getByLabel('Username').fill(prefix);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Password').press('Enter');
  await expect(page.getByText('No drafts yet')).toBeVisible();
  await page.getByRole('link', { name: 'Create New Draft' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Create private draft' }).click();
  await expect(page.getByLabel('Title (required)')).toBeFocused();
  await expect(page.getByLabel('Title (required)')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Title (required)').fill('<script>private browser draft</script>');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Problem (required)')).toBeFocused();
  await page.keyboard.type('A problem requiring a private draft');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Constraints (optional)')).toBeFocused();
  await page.keyboard.type('No submitted content yet');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Expected behavior (required)')).toBeFocused();
  await page.keyboard.type('Only the authenticated owner sees this draft');
  const formAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(formAxe.violations).toEqual([]);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Private draft detail' })).toBeVisible();
  await expect(page.getByText('<script>private browser draft</script>', { exact: true })).toBeVisible();
  expect(await page.locator('script').filter({ hasText: 'private browser draft' }).count()).toBe(0);
  await page.getByRole('link', { name: 'Back to your drafts' }).click();
  await expect(page.getByRole('link', { name: '<script>private browser draft</script>' })).toBeVisible();
  const listAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(listAxe.violations).toEqual([]);
  await page.getByRole('link', { name: '<script>private browser draft</script>' }).click();
  await expect(page.getByText('Only the authenticated owner sees this draft')).toBeVisible();
  const detailAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(detailAxe.violations).toEqual([]);
  await page.setViewportSize({ width: 640, height: 800 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await pool.query('UPDATE "UserAccount" SET enabled=false WHERE username=$1', [prefix]);
  await page.reload();
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.getByText('<script>private browser draft</script>', { exact: true })).toHaveCount(0);
});
