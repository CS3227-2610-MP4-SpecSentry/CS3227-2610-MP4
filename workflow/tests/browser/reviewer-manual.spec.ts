import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { Pool } from 'pg';
import { createReviewerIntakeFixture } from './fixtures/reviewer-intake';

let fixture: Awaited<ReturnType<typeof createReviewerIntakeFixture>>;
test.beforeAll(async () => {
  fixture = await createReviewerIntakeFixture();
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    // Only the mutable lifecycle root changes; submitted snapshots remain immutable.
    await pool.query('UPDATE "ChangeProposal" SET state=\'SUBMITTED\' WHERE id=$1 AND state=\'CHANGES_REQUESTED\' AND "currentAssignmentId" IS NULL', [fixture.proposal]);
  } finally { await pool.end(); }
});
test.afterAll(async () => { if (fixture) await fixture.dispose(); });
async function signIn(page: Page, user: 'a' | 'b') {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' });
  await page.goto('/reviewer');
  await page.getByLabel('Username').fill(`${fixture.prefix}-${user}`);
  await page.getByLabel('Password').fill(fixture.password);
  await page.getByLabel('Password').press('Enter');
}
test('manual review validates rationale, preserves takeover provenance, resolves blockers and freezes approval', async ({ page, browser }) => {
  const context = await browser.newContext(); const replacement = await context.newPage();
  try {
    await signIn(page, 'a'); await signIn(replacement, 'b');
    await page.getByRole('button', { name: `Claim ${fixture.title}`, exact: true }).click();
    const coverage = page.getByRole('form', { name: 'Assess AC-1', exact: true });
    const save = coverage.getByRole('button', { name: 'Save AC-1 assessment', exact: true });
    await expect(save).toBeEnabled();
    await coverage.getByRole('combobox', { name: /^Status/ }).selectOption('PARTIALLY_COVERED');
    await save.click(); await expect(page.getByRole('alert')).toContainText('required text, rationale');
    await coverage.getByRole('combobox', { name: /^Status/ }).selectOption('COVERED');
    await save.focus(); await save.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'Criterion assessment saved.' })).toBeVisible();
    await expect(page.getByText('No approval blockers.', { exact: true })).toBeVisible();
    const create = page.getByRole('form', { name: 'Create finding', exact: true });
    await create.getByRole('combobox', { name: /^Severity/ }).selectOption('HIGH');
    await create.getByLabel('Description', { exact: true }).fill('Human concern <script>window.manualInjected=true</script>');
    await create.getByRole('button', { name: 'Create finding', exact: true }).click();
    await expect(page.getByText('Unresolved HIGH or CRITICAL findings remain', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => Object.hasOwn(window, 'manualInjected'))).toBe(false);
    await page.getByRole('button', { name: 'Drop assignment', exact: true }).click();
    await expect(page.getByText('Assignment dropped. Full proposal access has ended.')).toBeVisible();
    await replacement.getByRole('button', { name: 'Refresh queue', exact: true }).click();
    await replacement.getByRole('button', { name: `Claim ${fixture.title}`, exact: true }).click();
    await expect(replacement.getByText(/Inherited: individual confirmation required/)).toBeVisible();
    await expect(replacement.getByText(`Original author: ${fixture.prefix}-a`, { exact: false })).toBeVisible();
    await replacement.getByRole('button', { name: 'Confirm AC-1 assessment', exact: true }).click();
    await expect(replacement.getByText(/Confirmed for this assignment/)).toBeVisible();
    const update = replacement.getByRole('form', { name: /^Update finding / });
    await update.getByLabel('Explanation', { exact: true }).fill('Reviewed the correction and resolved the concern.');
    await update.getByRole('button', { name: 'Save finding update', exact: true }).click();
    await expect(replacement.getByText('No approval blockers.', { exact: true })).toBeVisible();
    const decision = replacement.getByRole('form', { name: 'Review decision', exact: true });
    await decision.getByRole('combobox', { name: /^Decision/ }).selectOption('APPROVE');
    expect((await new AxeBuilder({ page: replacement }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await decision.getByRole('button', { name: 'Submit decision', exact: true }).click();
    await expect(replacement.getByText('State: APPROVED', { exact: false })).toBeVisible();
    await expect(replacement.getByText('Manual review is read only for this revision or lifecycle state.', { exact: true })).toBeVisible();
    await expect(replacement.getByRole('form', { name: 'Create finding', exact: true }).getByRole('button', { name: 'Create finding', exact: true })).toBeDisabled();
    expect((await page.request.get(`/api/proposals/${fixture.proposal}/review`)).status()).toBe(403);
  } finally { await context.close(); }
});

