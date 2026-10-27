import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { apiActor, createRevocationFixture } from './fixtures/reviewer-revocation';

async function prepareUnattached(page: Page, owner: APIRequestContext,
  fixture: Awaited<ReturnType<typeof createRevocationFixture>>) {
  const ownerActor = await apiActor(owner, `${fixture.prefix}-owner`, fixture.password);
  const title = `${fixture.prefix} unattached proposal`;
  const created = await ownerActor.post('/api/proposals', { title, summary: 'Review summary', problem: 'Problem',
    constraints: '', expectedBehavior: 'Expected',
    diffText: '--- a/review.txt\n+++ b/review.txt\n@@ -1 +1 @@\n-before\n+reviewed change',
    criteria: [{ statement: 'Required check', required: true }], evidence: [] });
  await ownerActor.post(`/api/proposals/${created.proposalId}/submit`, {
    expectedVersion: created.version, workingRevisionId: created.workingRevisionId });
  await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' }); await page.goto('/reviewer');
  await page.getByLabel('Username').fill(`${fixture.prefix}-reviewer`);
  await page.getByLabel('Password').fill(fixture.password);
  await page.getByLabel('Password').press('Enter');
  await page.getByRole('button', { name: `Claim ${title}`, exact: true }).click();
  await page.getByRole('form', { name: /^Assess / }).getByRole('button', { name: /^Save .* assessment$/ }).click();
  await expect(page.getByText('No approval blockers.', { exact: true })).toBeVisible();
  const decision = page.getByRole('form', { name: 'Review decision' });
  await decision.getByRole('combobox', { name: 'Decision', exact: true }).selectOption('APPROVE');
  await decision.getByRole('button', { name: 'Submit decision' }).click();
  await expect(page.getByText(/State: APPROVED/)).toBeVisible();
  return created.proposalId as string;
}

test('revoke-ui API-backed current approval, candidate blocker, and safe history', async ({ page, playwright }) => {
  const fixture = await createRevocationFixture();
  const owner = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000', extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
  const maintainer = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000', extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
  try {
    const ownerActor = await apiActor(owner, `${fixture.prefix}-owner`, fixture.password);
    const maintainerActor = await apiActor(maintainer, `${fixture.prefix}-maintainer`, fixture.password);
    const title = `${fixture.prefix} proposal`;
    const created = await ownerActor.post('/api/proposals', { title, summary: 'Review summary', problem: 'Problem',
      constraints: '', expectedBehavior: 'Expected',
      diffText: '--- a/review.txt\n+++ b/review.txt\n@@ -1 +1 @@\n-before\n+reviewed change',
      criteria: [{ statement: 'Required check', required: true }], evidence: [] });
    await ownerActor.post(`/api/proposals/${created.proposalId}/submit`, {
      expectedVersion: created.version, workingRevisionId: created.workingRevisionId });

    await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' }); await page.goto('/reviewer');
    await page.getByLabel('Username').fill(`${fixture.prefix}-reviewer`);
    await page.getByLabel('Password').fill(fixture.password);
    await page.getByLabel('Password').press('Enter');
    await page.getByRole('button', { name: `Claim ${title}`, exact: true }).click();
    await page.getByRole('form', { name: /^Assess / }).getByRole('button', { name: /^Save .* assessment$/ }).click();
    await expect(page.getByText('No approval blockers.', { exact: true })).toBeVisible();
    const decision = page.getByRole('form', { name: 'Review decision' });
    await decision.getByRole('combobox', { name: 'Decision', exact: true }).selectOption('APPROVE');
    await decision.getByRole('button', { name: 'Submit decision' }).click();
    await expect(page.getByText(/State: APPROVED/)).toBeVisible();
    const approved = await (await page.request.get(`/api/proposals/${created.proposalId}`)).json();
    const candidate = await maintainerActor.post('/api/release-candidates', {
      versionLabel: `1.0.${Math.floor(Math.random() * 1_000_000_000)}`,
      rollbackNote: 'Restore the previous deployment', dependencyNotes: '' });
    await maintainerActor.post(`/api/release-candidates/${candidate.candidateId}/members`, {
      expectedCandidateVersion: candidate.version, expectedContentVersion: candidate.contentVersion,
      proposalId: created.proposalId, revisionId: approved.revision.id, assignmentId: approved.assignment.id,
      expectedProposalVersion: approved.version, expectedAssignmentVersion: approved.assignment.version });
    await page.getByRole('button', { name: 'Refresh review and discard unsaved edits' }).click();
    await expect(page.getByText(/State: IN_RELEASE/)).toBeVisible();
    const form = page.getByRole('form', { name: 'Revoke approval' });
    await expect(page.getByText(/blocks publication, and notifies the responsible Release Maintainer/)).toBeVisible();
    const reason = 'Approved evidence is no longer reliable <script>window.revoked=true</script>';
    await form.getByLabel('Reason for revocation').fill(reason);
    await form.getByRole('button', { name: 'Revoke approval' }).click();
    await expect(page.getByText(/Approval revoked. This candidate is blocked/)).toBeVisible();
    await expect(page.getByText(/State: IN_RELEASE/)).toBeVisible();
    await expect(page.getByText('This candidate has an invalid approval blocker for this proposal.')).toBeVisible();
    await expect(page.getByRole('form', { name: 'Revoke approval' })).toHaveCount(0);
    await expect(page.getByText(reason, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => Object.hasOwn(window, 'revoked'))).toBe(false);
    await expect(page.getByText(/APPROVE ·/)).toBeVisible();
    const detail = await maintainer.get(`/api/release-candidates/${candidate.candidateId}`);
    expect(detail.ok()).toBe(true);
    expect((await detail.json()).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'APPROVAL', proposalId: created.proposalId })]));
  } finally { await owner.dispose(); await maintainer.dispose(); await fixture.dispose(); }
});

test('revoke-ui-unattached supports keyboard submission and preserves original approval history', async ({ page, playwright }) => {
  const fixture = await createRevocationFixture();
  const owner = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000', extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
  try {
    const proposalId = await prepareUnattached(page, owner, fixture);
    const form = page.getByRole('form', { name: 'Revoke approval' });
    await expect(page.getByText(/moves this proposal to changes requested and keeps your assignment/)).toBeVisible();
    const reason = form.getByLabel('Reason for revocation');
    await reason.click();
    await page.keyboard.type('The approved evidence no longer applies.');
    await page.keyboard.press('Tab');
    await expect(form.getByRole('button', { name: 'Revoke approval' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Approval revoked. This proposal now awaits contributor changes/)).toBeVisible();
    await expect(page.getByText(/State: CHANGES_REQUESTED/)).toBeVisible();
    await expect(page.getByText('The approved evidence no longer applies.', { exact: true })).toBeVisible();
    await expect(page.getByText(/APPROVE ·/)).toBeVisible();
    const detail = await page.request.get(`/api/proposals/${proposalId}`);
    expect(detail.ok()).toBe(true);
    expect((await detail.json()).effectiveApproval).toBe(false);
  } finally { await owner.dispose(); await fixture.dispose(); }
});

test('revoke-ui-access-loss clears a drafted reason after external session invalidation', async ({ page, playwright }) => {
  const fixture = await createRevocationFixture();
  const owner = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000', extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
  try {
    const proposalId = await prepareUnattached(page, owner, fixture);
    const form = page.getByRole('form', { name: 'Revoke approval' });
    const reason = 'Sensitive drafted revocation reason';
    await form.getByLabel('Reason for revocation').fill(reason);
    const session = await page.request.get('/api/auth/session');
    expect(session.ok()).toBe(true);
    const csrfToken = (await session.json()).csrfToken as string;
    const logout = await page.request.post('/api/auth/logout', { headers: { 'x-csrf-token': csrfToken } });
    expect(logout.status()).toBe(204);
    await form.getByRole('button', { name: 'Revoke approval' }).click();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByText(reason, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('form', { name: 'Revoke approval' })).toHaveCount(0);
    const ownerDetail = await owner.get(`/api/proposals/${proposalId}`);
    expect(ownerDetail.ok()).toBe(true);
    expect((await ownerDetail.json()).state).toBe('APPROVED');
  } finally { await owner.dispose(); await fixture.dispose(); }
});
