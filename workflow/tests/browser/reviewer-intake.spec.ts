import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createReviewerIntakeFixture } from './fixtures/reviewer-intake';
let fixture: Awaited<ReturnType<typeof createReviewerIntakeFixture>>;
test.beforeAll(async () => { fixture = await createReviewerIntakeFixture(); });
test.afterAll(async () => { if (fixture) await fixture.dispose(); });
async function signIn(page: Page, user: 'a' | 'b' | 'contributor') {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' });
  await page.goto('/reviewer');
  await page.getByLabel('Username').fill(`${fixture.prefix}-${user}`);
  await page.getByLabel('Password').fill(fixture.password);
  await page.getByLabel('Password').press('Enter');
}
test('two Reviewers claim, inspect immutable history, drop and take over with keyboard and access checks', async ({ page, browser }) => {
  const otherContext = await browser.newContext(); const other = await otherContext.newPage();
  try {
    await signIn(page, 'a'); await signIn(other, 'b');
    const claim = page.getByRole('button', { name: `Claim ${fixture.title}`, exact: true });
    await claim.focus(); await expect(claim).toBeFocused(); await claim.press('Enter');
    await expect(page.getByRole('heading', { name: `${fixture.title} — revision 2` })).toBeFocused();
    await expect(page.getByText('State: CHANGES_REQUESTED · Awaiting revision')).toBeVisible();
    await expect(page.getByText('<script>window.intakeInjected=true</script>', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => Object.hasOwn(window, 'intakeInjected'))).toBe(false);
    await expect(page.getByText('Synthetic test passed <script>not executable</script>', { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'View revision 1', exact: true }).press('Enter');
    await expect(page.getByRole('heading', { name: `${fixture.title} — revision 1` })).toBeFocused();
    const denied = await other.request.get(`/api/proposals/${fixture.proposal}`); expect(denied.status()).toBe(403);
    await page.getByRole('button', { name: 'Drop assignment', exact: true }).press('Enter');
    await expect(page.getByText('Assignment dropped. Full proposal access has ended.')).toBeVisible();
    await expect(page.getByText('<script>window.intakeInjected=true</script>', { exact: true })).toHaveCount(0);
    expect((await page.request.get(`/api/proposals/${fixture.proposal}`)).status()).toBe(403);
    await other.getByRole('button', { name: 'Refresh queue', exact: true }).click();
    await other.getByRole('button', { name: `Claim ${fixture.title}`, exact: true }).click();
    await expect(other.getByRole('heading', { name: `${fixture.title} — revision 2` })).toBeVisible();
    await expect(other.getByText(/DROPPED/)).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await signIn(page, 'contributor'); await expect(page.getByRole('heading', { name: 'Access denied', exact: true })).toBeVisible();
    expect((await page.request.get('/api/review-pool')).status()).toBe(403);
  } finally { await otherContext.close(); }
});
