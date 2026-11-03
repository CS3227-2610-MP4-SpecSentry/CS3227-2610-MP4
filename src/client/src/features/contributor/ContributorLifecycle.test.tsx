import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ContributorWorkspace } from './ContributorWorkspace';
import { ProposalActions } from './SubmittedProposal';
import { App } from '../../App';

const time = '2026-11-01T00:00:00.000Z';
const session = { account: { id: 'owner', username: 'owner', role: 'CONTRIBUTOR' as const }, csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 60000 };
const content = { title: 'A proposal', problem: 'Private problem', constraints: '', expectedBehavior: 'Expected behavior', summary: 'Summary',
  criteria: [{ stableKey: 'key', statement: 'Criterion', required: true }], evidence: [], diffText: '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n' };
const draft = { proposalId: 'p', workingRevisionId: 'w', version: 3, state: 'DRAFT', content };
const result = { proposalId: 'p', workingRevisionId: 'w', version: 4, state: 'SUBMITTED', revisionId: 'r1', assignmentId: null, assignmentVersion: null };
const detail = (revision = 'r1', state = 'IN_REVIEW') => ({ id: 'p', version: 4, title: 'A proposal', state, author: { id: 'owner', username: 'owner' },
  firstSubmittedAt: time, latestSubmittedAt: time, assignment: { id: 'assignment', revisionId: 'r2', version: 0, reviewer: { id: 'reviewer', username: 'Reviewer' } },
  latestRevision: { id: 'r2', number: 2, submittedAt: time },
  revision: { id: revision, number: revision === 'r1' ? 1 : 2, summary: `Summary ${revision}`, problem: '<script>protected</script>', constraints: '', expectedBehavior: 'Expected',
    submittedAt: time, diffText: content.diffText, criteria: [{ id: `criterion-${revision}`, stableKey: 'key', statement: 'Criterion', required: true }], evidence: [], criterionEvidenceLinks: [] } });
const empty = { items: [], nextCursor: null };
const decision = { id: 'decision', proposalId: 'p', revisionId: 'r2', assignmentId: 'assignment', actor: { id: 'reviewer', username: 'Reviewer' }, decision: 'REQUEST_CHANGES', note: 'Please revise', mutationVersion: 3, createdAt: time };
const activity = (id = 'first') => ({ id, actor: { id: 'owner', username: 'owner' }, timestamp: time, action: 'SUBMITTED', proposalId: 'p', revisionId: 'r1', assignmentId: null, outcome: 'SUCCESS', summary: `Activity ${id}`, reason: null });
const finding = { id: 'finding', proposalId: 'p', revisionId: 'r1', assignmentId: 'assignment', actor: { id: 'reviewer', username: 'Reviewer' },
  severity: 'HIGH', currentSeverity: 'HIGH', status: 'OPEN', description: 'Unresolved original concern', criterionId: null, diffLocation: null, createdAt: time, mutationVersion: 2 };
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
function mount(path: string, lost = vi.fn()) {
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/contributor/*" element={<ContributorWorkspace session={session} onSessionLost={lost} />} /></Routes></MemoryRouter>);
  return lost;
}
const history = (url: string) => {
  if (url.includes('/revisions')) return reply({ items: [{ id: 'r1', number: 1, summary: 'Old', submittedAt: time }], nextCursor: 'older' });
  if (url.includes('/decisions')) return reply({ items: [decision], nextCursor: null });
  if (url.includes('/activity')) return reply({ items: [activity()], nextCursor: 'later' });
  if (url.includes('/findings') || url.includes('/responses')) return reply(empty);
  return reply(detail(new URL(url, 'http://local').searchParams.get('revisionId') ?? 'r1'));
};
afterEach(() => vi.unstubAllGlobals());

it('publishes only after explicit confirmation and opens immutable submitted detail', async () => {
  const fetch = vi.fn((url: string, options?: { method?: string }) => Promise.resolve(url.endsWith('/draft') ? reply(draft) : options?.method === 'POST' ? reply(result) : history(url)));
  vi.stubGlobal('fetch', fetch); mount('/contributor/drafts/p');
  fireEvent.click(await screen.findByRole('button', { name: 'Submit saved working copy' }));
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Cancel action' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm submit' }));
  await screen.findByRole('heading', { name: 'Submitted proposal' });
  await screen.findByText(/Viewing immutable submitted revision 1/);
  const sent = fetch.mock.calls.find(([, options]) => options?.method === 'POST')!;
  expect(sent[1]).toMatchObject({ credentials: 'same-origin', headers: { 'x-csrf-token': session.csrfToken, 'Idempotency-Key': expect.any(String) } });
  expect(JSON.parse((sent[1] as { body: string }).body)).toEqual({ expectedVersion: 3, workingRevisionId: 'w' });
});

it.each(['transport', 'HTTP 500'])('reconciles %s submission uncertainty before replaying its exact original key and body', async mode => {
  let attempts = 0;
  const fetch = vi.fn((url: string, options?: { method?: string }) => {
    if (options?.method === 'POST') return ++attempts === 1 ? mode === 'transport' ? Promise.reject(new Error('lost response')) : Promise.resolve(reply({}, 500)) : Promise.resolve(reply(result));
    return Promise.resolve(url.endsWith('/draft') ? reply(draft) : history(url));
  });
  vi.stubGlobal('fetch', fetch); mount('/contributor/drafts/p');
  fireEvent.click(await screen.findByRole('button', { name: 'Submit saved working copy' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm submit' }));
  await screen.findByText(/The action result is uncertain/);
  expect(screen.getByRole('button', { name: 'Confirm submit' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Check current proposal state' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry original submission' }));
  await screen.findByText(/Viewing immutable submitted revision 1/);
  const calls = fetch.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(calls).toHaveLength(2); expect(calls[0]![1]).toEqual(calls[1]![1]);
});

it('retains withdrawal input while competing refresh, revision selection, pagination and deletion are locked', async () => {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(history(url)))); mount('/contributor/proposals/p');
  fireEvent.click(await screen.findByRole('button', { name: 'Withdraw proposal' }));
  fireEvent.change(screen.getByLabelText('Withdrawal reason (required)'), { target: { value: 'Keep my reason' } });
  expect(screen.getByRole('button', { name: 'Refresh submitted proposal' })).toBeDisabled();
  expect(screen.getByLabelText('Submitted revision')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Load later activity' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Load older revisions' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh submitted proposal' }));
  expect(screen.getByLabelText('Withdrawal reason (required)')).toHaveValue('Keep my reason');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel action' }));
  expect(screen.getByRole('button', { name: 'Refresh submitted proposal' })).toBeEnabled();
});

it('prevents draft deletion from discarding an active or uncertain lifecycle command', async () => {
  vi.stubGlobal('fetch', vi.fn((_url: string, options?: { method?: string }) => options?.method === 'POST' ? Promise.resolve(reply({}, 500)) : Promise.resolve(reply(draft))));
  mount('/contributor/drafts/p'); fireEvent.click(await screen.findByRole('button', { name: 'Submit saved working copy' }));
  expect(screen.getByRole('button', { name: 'Delete private draft' })).toBeDisabled();
  expect(screen.queryByRole('link', { name: 'Edit private draft' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm submit' })); await screen.findByText(/The action result is uncertain/);
  expect(screen.getByRole('button', { name: 'Delete private draft' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete private draft' }));
  expect(screen.getByRole('form', { name: 'Confirm submit' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Confirm permanent deletion' })).not.toBeInTheDocument();
});

it.each(['command', 'reconciliation'])('ignores deferred %s JSON after the action unmounts', async phase => {
  let resolveBody!: (body: unknown) => void;
  const held = new Promise(resolve => { resolveBody = resolve; });
  const committed = vi.fn();
  vi.stubGlobal('fetch', vi.fn((_url: string, options?: { method?: string }) => Promise.resolve(
    phase === 'reconciliation' && options?.method === 'POST' ? reply({}, 500) : { ok: true, status: 200, json: () => held })));
  const view = render(<MemoryRouter><ProposalActions proposalId="p" workingRevisionId="w" state="DRAFT" version={3} session={session} onSessionLost={vi.fn()} onCommitted={committed} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: phase === 'command' ? 'Submit saved working copy' : 'Withdraw proposal' }));
  if (phase === 'reconciliation') fireEvent.change(screen.getByLabelText('Withdrawal reason (required)'), { target: { value: 'Reason' } });
  fireEvent.click(screen.getByRole('button', { name: phase === 'command' ? 'Confirm submit' : 'Confirm withdraw' }));
  if (phase === 'reconciliation') { await screen.findByText(/The action result is uncertain/); fireEvent.click(screen.getByRole('button', { name: 'Check current proposal state' })); }
  await act(async () => { await Promise.resolve(); }); view.unmount();
  await act(async () => { resolveBody(phase === 'command' ? result : draft); await held; });
  expect(committed).not.toHaveBeenCalled();
});

it('shows older decision revision numbers, escaped snapshots and chronological activity pages', async () => {
  const fetch = vi.fn((url: string) => Promise.resolve(url.includes('/activity?') ? reply({ items: [activity('second')], nextCursor: null }) : history(url)));
  vi.stubGlobal('fetch', fetch); mount('/contributor/proposals/p');
  expect(await screen.findByText(/Revision 2 · REQUEST_CHANGES · Reviewer/)).toBeInTheDocument();
  expect(screen.getByText('<script>protected</script>')).toBeInTheDocument(); expect(document.querySelector('script')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Load later activity' })); await screen.findByText('Activity second');
  expect(within(screen.getByRole('region', { name: 'Chronological activity' })).getAllByRole('listitem').map(item => item.textContent)).toEqual([
    expect.stringContaining('Activity first'), expect.stringContaining('Activity second'),
  ]);
  fireEvent.change(screen.getByLabelText('Submitted revision'), { target: { value: 'r1' } });
  expect(screen.queryByRole('button', { name: /resolve/i })).not.toBeInTheDocument();
});

it.each(['SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED'])('saves an eligible %s working copy and reconciles the committed version', async state => {
  let current = { ...draft, state }; const fetch = vi.fn((url: string, options?: { method?: string; body?: string }) => {
    if (options?.method === 'PATCH') { current = { ...current, version: 4, content: JSON.parse(options.body!).content }; return Promise.resolve(reply({ ...result, state })); }
    return Promise.resolve(url.endsWith('/draft') ? reply(current) : history(url));
  });
  vi.stubGlobal('fetch', fetch); mount('/contributor/drafts/p/edit');
  fireEvent.change(await screen.findByLabelText('Problem (required)'), { target: { value: 'Revised private problem' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save private draft' })); await screen.findByText('Draft saved. Version 4.');
  expect(screen.getByLabelText('Problem (required)')).toHaveValue('Revised private problem');
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1);
});

it('requires withdrawal reason and keeps a never-submitted withdrawal on private detail', async () => {
  let current = draft; const fetch = vi.fn((url: string, options?: { method?: string; body?: string }) => {
    if (options?.method === 'POST') { current = { ...draft, version: 4, state: 'WITHDRAWN' }; return Promise.resolve(reply({ ...result, state: 'WITHDRAWN', revisionId: null })); }
    return Promise.resolve(url.endsWith('/draft') ? reply(current) : history(url));
  });
  vi.stubGlobal('fetch', fetch); mount('/contributor/drafts/p');
  fireEvent.click(await screen.findByRole('button', { name: 'Withdraw proposal' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm withdraw' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a non-empty withdrawal reason');
  expect(screen.getByLabelText('Withdrawal reason (required)')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Withdrawal reason (required)')).toHaveAttribute('aria-describedby', 'withdraw-reason-hint proposal-action-error');
  expect(screen.getByLabelText('Withdrawal reason (required)')).toHaveFocus();
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel action' })); fireEvent.click(screen.getByRole('button', { name: 'Withdraw proposal' }));
  expect(screen.getByLabelText('Withdrawal reason (required)')).toHaveAttribute('aria-invalid', 'false');
  expect(screen.getByLabelText('Withdrawal reason (required)')).toHaveAttribute('aria-describedby', 'withdraw-reason-hint');
  fireEvent.change(screen.getByLabelText('Withdrawal reason (required)'), { target: { value: '<b>Not proceeding</b>' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm withdraw' })); await screen.findByText('Private - WITHDRAWN');
  expect(screen.getByRole('heading', { name: 'Private draft detail' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Edit private draft' })).not.toBeInTheDocument();
  const posted = fetch.mock.calls.find(([, options]) => options?.method === 'POST')!;
  expect(JSON.parse(posted[1]!.body!)).toEqual({ expectedVersion: 3, confirmed: true, reason: '<b>Not proceeding</b>' });
});

it('clears submitted content after access denial on refresh', async () => {
  let deny = false; const fetch = vi.fn((url: string) => Promise.resolve(deny ? reply({}, 403) : history(url)));
  vi.stubGlobal('fetch', fetch); mount('/contributor/proposals/p'); await screen.findByText('<script>protected</script>');
  deny = true; fireEvent.click(screen.getByRole('button', { name: 'Refresh submitted proposal' }));
  await screen.findByRole('alert'); expect(screen.queryByText('<script>protected</script>')).not.toBeInTheDocument();
});

it('handles session loss without leaving protected submitted content', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({}, 401))); const lost = mount('/contributor/proposals/p');
  await waitFor(() => expect(lost).toHaveBeenCalled()); expect(screen.queryByText('<script>protected</script>')).not.toBeInTheDocument();
});

it('discovers owned proposals across lifecycle states, including both kinds of withdrawal', async () => {
  const items = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'IN_RELEASE', 'RELEASED', 'WITHDRAWN', 'WITHDRAWN'].map((state, index) => ({
    proposalId: `p${index}`, workingRevisionId: index ? null : 'w', title: `Proposal ${index}`, state, version: index, createdAt: time,
    latestRevision: index && index !== 8 ? { id: `r${index}`, number: index, submittedAt: time } : null,
  }));
  const fetch = vi.fn().mockResolvedValue(reply({ items, nextCursor: 'next' })); vi.stubGlobal('fetch', fetch); mount('/contributor/proposals');
  expect(await screen.findByRole('link', { name: 'Proposal 0 Never submitted DRAFT' })).toHaveAttribute('href', '/contributor/drafts/p0');
  expect(screen.getByRole('link', { name: 'Proposal 6 Latest submitted revision 6 RELEASED' })).toHaveAttribute('href', '/contributor/proposals/p6');
  expect(screen.getByRole('link', { name: 'Proposal 7 Latest submitted revision 7 WITHDRAWN' })).toHaveAttribute('href', '/contributor/proposals/p7');
  expect(screen.getByRole('link', { name: 'Proposal 8 Never submitted WITHDRAWN' })).toHaveAttribute('href', '/contributor/drafts/p8');
  expect(screen.getByText('Proposals on this page: 9')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' })); await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/proposals/owned?cursor=next', expect.anything()));
});

it('clones the latest submitted revision only after explicit overwrite confirmation, even when viewing an older revision', async () => {
  const fetch = vi.fn((url: string, options?: { method?: string }) => Promise.resolve(options?.method === 'POST'
    ? reply({ ...result, version: 5, state: 'IN_REVIEW', revisionId: 'r2' }) : url.endsWith('/draft') ? reply({ ...draft, version: 5, state: 'IN_REVIEW' }) : history(url)));
  vi.stubGlobal('fetch', fetch); mount('/contributor/proposals/p');
  fireEvent.click(await screen.findByRole('button', { name: 'Clone latest submitted content' }));
  expect(screen.getByText(/Existing private changes will be overwritten/)).toBeInTheDocument();
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm clone-latest' })); await screen.findByLabelText('Problem (required)');
  const sent = fetch.mock.calls.find(([, options]) => options?.method === 'POST')!;
  expect(sent[0]).toBe('/api/proposals/p/clone-latest');
  expect(JSON.parse((sent[1] as { body: string }).body)).toEqual({ expectedVersion: 4, revisionId: 'r2', confirmed: true });
  expect(screen.getByText('Editing version 5 · IN_REVIEW')).toBeInTheDocument();
});

it('adds an attributed plain-text response to an older finding using current scope, without resolving it', async () => {
  let posted = false; const response = { id: 'response', proposalId: 'p', findingId: 'finding', revisionId: 'r2', actor: session.account,
    text: '<script>Reply remains text</script>', mutationVersion: 5, createdAt: time };
  const record = { ...response, actor: { id: session.account.id, username: session.account.username } };
  const fetch = vi.fn((url: string, options?: { method?: string }) => {
    if (options?.method === 'POST') { posted = true; return Promise.resolve(reply({ proposalId: 'p', version: 5, response: record }, 201)); }
    if (url.endsWith('/findings')) return Promise.resolve(reply({ items: [finding], nextCursor: null }));
    if (url.endsWith('/responses')) return Promise.resolve(reply({ items: posted ? [record] : [], nextCursor: null }));
    const body = history(url); return Promise.resolve(url === '/api/proposals/p' && posted ? reply({ ...detail(), version: 5 }) : body);
  });
  vi.stubGlobal('fetch', fetch); mount('/contributor/proposals/p');
  fireEvent.click(await screen.findByRole('button', { name: 'Respond to finding finding' }));
  expect(screen.getByLabelText('Response text (required)')).toHaveFocus();
  fireEvent.change(screen.getByLabelText('Response text (required)'), { target: { value: record.text } });
  expect(screen.getByRole('button', { name: 'Refresh submitted proposal' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Withdraw proposal' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add finding response' }));
  expect(await within(screen.getByRole('region', { name: 'Finding responses' })).findByText(record.text)).toBeInTheDocument(); expect(document.querySelector('script')).toBeNull();
  expect(screen.getByText(/HIGH · OPEN · Reviewer/)).toBeInTheDocument(); expect(screen.queryByRole('button', { name: /resolve/i })).not.toBeInTheDocument();
  const sent = fetch.mock.calls.find(([, options]) => options?.method === 'POST')!;
  expect(sent[0]).toBe('/api/findings/finding/responses');
  expect(JSON.parse((sent[1] as { body: string }).body)).toEqual({ expectedVersion: 4, revisionId: 'r2', text: record.text });
});

it('retains an uncertain response and requires state checking and explicit discard before another form', async () => {
  const fetch = vi.fn((url: string, options?: { method?: string }) => Promise.resolve(options?.method === 'POST' ? reply({}, 500)
    : url.endsWith('/findings') ? reply({ items: [finding], nextCursor: null }) : history(url)));
  vi.stubGlobal('fetch', fetch); mount('/contributor/proposals/p'); fireEvent.click(await screen.findByRole('button', { name: 'Respond to finding finding' }));
  fireEvent.change(screen.getByLabelText('Response text (required)'), { target: { value: 'Retained response' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add finding response' })); await screen.findByText(/The response result is uncertain/);
  expect(screen.getByLabelText('Response text (required)')).toHaveValue('Retained response');
  expect(screen.getByRole('button', { name: 'Add finding response' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Discard response form and refresh proposal' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Refresh submitted proposal' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Check current response state' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Discard response form and refresh proposal' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Discard response form and refresh proposal' }));
  await screen.findByRole('button', { name: 'Respond to finding finding' });
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});

it.each(['', '\u{1F600}'.repeat(2001)])('associates response validation with the retained field and focuses it', async text => {
  const fetch = vi.fn((url: string) => Promise.resolve(url.endsWith('/findings') ? reply({ items: [finding], nextCursor: null }) : history(url)));
  vi.stubGlobal('fetch', fetch); mount('/contributor/proposals/p'); fireEvent.click(await screen.findByRole('button', { name: 'Respond to finding finding' }));
  const callsBeforeValidation = fetch.mock.calls.length;
  fireEvent.change(screen.getByLabelText('Response text (required)'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Add finding response' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a non-empty response of at most 2,000 characters.');
  expect(screen.getByLabelText('Response text (required)')).toHaveValue(text);
  expect(screen.getByLabelText('Response text (required)')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Response text (required)')).toHaveAttribute('aria-describedby', 'finding-response-hint finding-response-error');
  expect(screen.getByLabelText('Response text (required)')).toHaveFocus();
  expect(fetch).toHaveBeenCalledTimes(callsBeforeValidation);
});

const authModes = ['submit', 'response', 'generation', 'usage', 'owned read', 'submitted read', 'action reconciliation', 'response reconciliation'] as const;
it.each(authModes.flatMap(mode => [
  { mode, status: 401, replacement: false }, { mode, status: 401, replacement: true }, { mode, status: 200, replacement: false },
]))('handles late $mode HTTP $status after route leave (replacement login: $replacement)', async ({ mode, status, replacement }) => {
  let resolve!: (value: ReturnType<typeof reply>) => void; const held = new Promise<ReturnType<typeof reply>>(value => { resolve = value; });
  let current = session; let holdDraft = false; let holdDetail = mode === 'submitted read';
  const fetch = vi.fn((url: string, options?: { method?: string }) => {
    if (url === '/api/auth/session') return Promise.resolve(reply(current));
    if (url.includes('/other/draft')) return Promise.resolve(reply({ ...draft, proposalId: 'other', content: { ...content, title: 'Other private draft' } }));
    if (url.endsWith('/ai/draft') || url === '/api/contributor/ai/usage' || url === '/api/proposals/owned') return held;
    if (options?.method === 'POST') {
      if (mode === 'action reconciliation') { holdDraft = true; return Promise.resolve(reply({}, 500)); }
      if (mode === 'response reconciliation') { holdDetail = true; return Promise.resolve(reply({}, 500)); }
      return held;
    }
    if (url === '/api/proposals/p/draft') return holdDraft ? held : Promise.resolve(reply(draft));
    if (url === '/api/proposals/p' && holdDetail) return held;
    if (url.endsWith('/findings')) return Promise.resolve(reply({ items: [finding], nextCursor: null }));
    return Promise.resolve(history(url));
  });
  vi.stubGlobal('fetch', fetch);
  const initial = mode === 'generation' || mode === 'usage' ? '/contributor/drafts/p/edit'
    : mode === 'submit' || mode === 'action reconciliation' ? '/contributor/drafts/p'
      : mode === 'owned read' ? '/contributor/proposals' : '/contributor/proposals/p';
  render(<MemoryRouter initialEntries={[initial]}><Link to="/contributor/drafts/other/edit">Other private editor</Link><App /></MemoryRouter>);
  await screen.findByText('Signed in as owner');
  if (mode === 'submit' || mode === 'action reconciliation') {
    fireEvent.click(await screen.findByRole('button', { name: 'Submit saved working copy' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm submit' }));
    if (mode === 'action reconciliation') { await screen.findByText(/The action result is uncertain/); fireEvent.click(screen.getByRole('button', { name: 'Check current proposal state' })); }
  } else if (mode === 'response' || mode === 'response reconciliation') {
    fireEvent.click(await screen.findByRole('button', { name: 'Respond to finding finding' }));
    fireEvent.change(screen.getByLabelText('Response text (required)'), { target: { value: 'Pending response' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add finding response' }));
    if (mode === 'response reconciliation') { await screen.findByText(/The response result is uncertain/); fireEvent.click(screen.getByRole('button', { name: 'Check current response state' })); }
  } else if (mode === 'generation') fireEvent.click(await screen.findByRole('button', { name: 'Generate draft suggestions' }));
  else if (mode === 'usage') fireEvent.click(await screen.findByRole('button', { name: 'Refresh my AI resource use' }));
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(screen.getByRole('link', { name: 'Other private editor' })); await screen.findByDisplayValue('Other private draft');
  if (replacement) {
    current = { ...session, csrfToken: 'b'.repeat(64) }; fireEvent(window, new Event('focus'));
    await waitFor(() => expect(screen.getByLabelText('Title (required)')).toBeEnabled());
    await act(async () => { await Promise.resolve(); });
  }
  fireEvent.change(screen.getByLabelText('Title (required)'), { target: { value: 'Retained current private input' } });
  await act(async () => { resolve(reply({}, status)); await held; });
  if (status === 401 && !replacement) {
    expect(screen.getByLabelText('Username')).toBeInTheDocument(); expect(screen.queryByLabelText('Title (required)')).not.toBeInTheDocument();
  } else {
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument(); expect(screen.getByLabelText('Title (required)')).toHaveValue('Retained current private input');
  }
});
