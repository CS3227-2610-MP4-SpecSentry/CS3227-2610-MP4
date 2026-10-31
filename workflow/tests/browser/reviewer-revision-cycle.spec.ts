import { expect, test } from '@playwright/test';
import { createReviewerRevisionCycleFixture, ownerSession } from './fixtures/reviewer-revision-cycle';

let fixture: Awaited<ReturnType<typeof createReviewerRevisionCycleFixture>>;
test.beforeAll(async () => { fixture = await createReviewerRevisionCycleFixture(); });
test.afterAll(async () => { if (fixture) await fixture.dispose(); });

test('real owner resubmission preserves findings, resets coverage, and reconciles stale forms before withdrawal', async ({ page, playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000', extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
  try {
    const mutate = await ownerSession(owner, `${fixture.prefix}-owner`, fixture.password);
    let content = { title: fixture.title, summary: 'Owner submitted summary', problem: 'Owner submitted problem', constraints: '', expectedBehavior: 'Correct behavior', diffText: '--- a/behavior.txt\n+++ b/behavior.txt\n@@ -1 +1 @@\n-before\n+first change', criteria: [{ statement: 'Required owner behavior', required: true }], evidence: [] };
    let result = await mutate('/api/proposals', content);
    const proposal = result.proposalId;
    result = await mutate(`/api/proposals/${proposal}/submit`, { expectedVersion: result.version, workingRevisionId: result.workingRevisionId });
    await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' }); await page.goto('/reviewer');
    await page.getByLabel('Username').fill(`${fixture.prefix}-reviewer`); await page.getByLabel('Password').fill(fixture.password); await page.getByLabel('Password').press('Enter');
    await page.getByRole('button', { name: `Claim ${fixture.title}`, exact: true }).click();
    const finding = page.getByRole('form', { name: 'Create finding', exact: true });
    await finding.getByLabel('Description', { exact: true }).fill('Keep this original concern across revisions.');
    await finding.getByRole('button', { name: 'Create finding', exact: true }).click();
    await expect(page.getByText('Finding created.', { exact: true })).toBeVisible();
    await page.getByRole('form', { name: 'Review decision', exact: true }).getByLabel('Decision note').fill('Please revise the behavior.');
    await page.getByRole('button', { name: 'Submit decision', exact: true }).click();
    await expect(page.getByText(/State: CHANGES_REQUESTED/)).toBeVisible();
    async function resubmit(diffText: string) {
      const draftResponse = await owner.get(`/api/proposals/${proposal}/draft`); expect(draftResponse.ok()).toBe(true); const draft = await draftResponse.json();
      content = { ...draft.content, diffText: `--- a/behavior.txt\n+++ b/behavior.txt\n@@ -1 +1 @@\n-before\n${diffText}` };
      const saved = await mutate(`/api/proposals/${proposal}/draft`, { expectedVersion: draft.version, content }, 'PATCH');
      return mutate(`/api/proposals/${proposal}/submit`, { expectedVersion: saved.version, workingRevisionId: saved.workingRevisionId });
    }
    result = await resubmit('+ corrected change');
    await page.getByRole('button', { name: 'Refresh notices', exact: true }).click();
    await page.getByRole('button', { name: `Open notified revision ${result.revisionId}`, exact: true }).click();
    await expect(page.getByText('Not assessed', { exact: true })).toBeVisible();
    await expect(page.getByText('Keep this original concern across revisions.', { exact: true })).toBeVisible();
    await expect(page.getByText(/Original author:/)).toBeVisible();
    const assessment = page.getByRole('form', { name: /^Assess / });
    await assessment.getByRole('button', { name: /^Save .* assessment$/ }).click();
    await expect(page.getByText('No approval blockers.', { exact: true })).toBeVisible();
    await page.getByRole('form', { name: 'Review decision', exact: true }).getByLabel('Decision note').fill('Second round requires another improvement.');
    await page.getByRole('button', { name: 'Submit decision', exact: true }).click();
    await expect(page.getByText(/State: CHANGES_REQUESTED/)).toBeVisible();
    result = await resubmit('+ third change');
    await page.getByRole('button', { name: 'Refresh review and discard unsaved edits', exact: true }).click();
    const currentFinding = page.getByRole('form', { name: 'Create finding', exact: true });
    await currentFinding.getByLabel('Description', { exact: true }).fill('Unsaved third revision concern');
    result = await resubmit('+ unsolicited fourth change');
    await currentFinding.getByRole('button', { name: 'Create finding', exact: true }).click();
    await expect(page.getByText('This review changed. Refresh review and reconcile before submitting again.', { exact: true })).toBeVisible();
    await expect(currentFinding.getByLabel('Description', { exact: true })).toHaveValue('Unsaved third revision concern');
    await expect(currentFinding.getByRole('button', { name: 'Create finding', exact: true })).toBeDisabled();
    const draft = await (await owner.get(`/api/proposals/${proposal}/draft`)).json();
    await mutate(`/api/proposals/${proposal}/withdraw`, { expectedVersion: draft.version, confirmed: true, reason: 'Owner withdraws the current proposal.' });
    await page.getByRole('button', { name: 'Refresh notices', exact: true }).click();
    await expect(page.getByText('Proposal withdrawn. Full proposal access has ended.', { exact: true })).toBeVisible();
    await expect(page.getByRole('form', { name: 'Create finding', exact: true })).toHaveCount(0);
    await expect(page.getByText('Owner submitted problem', { exact: true })).toHaveCount(0);
    await expect(page.getByText(`Proposal ${proposal} withdrawn · Unread`, { exact: true })).toBeVisible();
    expect((await page.request.get(`/api/proposals/${proposal}`)).status()).toBe(403);
  } finally { await owner.dispose(); }
});
