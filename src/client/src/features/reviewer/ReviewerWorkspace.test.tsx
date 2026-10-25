import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewerWorkspace } from './ReviewerWorkspace';
const timestamp = '2026-10-01T00:00:00.000Z';
const session = { account: { id: 'r', username: 'reviewer', role: 'REVIEWER' as const }, csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 100000 };
const item = { id: 'p', version: 1, title: 'Example', author: { id: 'a', username: 'author' }, summary: 'Summary', firstSubmittedAt: timestamp, latestSubmittedAt: timestamp, awaitingRevision: true };
const assigned = { ...item, state: 'CHANGES_REQUESTED', assignmentId: 'assignment', revisionId: 'revision', assignmentVersion: 1 };
const detail = { ...item, state: 'CHANGES_REQUESTED', assignment: { id: 'assignment', revisionId: 'revision', version: 1, reviewer: { id: 'r', username: 'reviewer' } }, revision: { id: 'revision', number: 2, summary: 'Summary', problem: '<script>hostile</script>', constraints: '', expectedBehavior: 'Expected', diffText: '<img src=x onerror=alert(1)>', submittedAt: timestamp, criteria: [{ id: 'c', stableKey: 'AC1', statement: 'Required behavior', required: true }], evidence: [], criterionEvidenceLinks: [] } };
// Pool-only awaitingRevision/summary are deliberately absent in strict detail projections.
const { awaitingRevision: _awaiting, summary: _summary, ...projection } = detail;
void _awaiting; void _summary;
const page = { items: [], nextCursor: null };
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
function setup(fetch: ReturnType<typeof vi.fn>) { vi.stubGlobal('fetch', fetch); let generation = 0; return render(<ReviewerWorkspace session={session} authorization={{ current: () => generation, invalidate: () => { generation++; } }} onUnauthorized={vi.fn()} />); }
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
afterEach(() => vi.unstubAllGlobals());

describe('Reviewer intake', () => {
  it('claims awaiting revision, renders escaped immutable content and drops with current versions', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({ items: [item], nextCursor: null })).mockResolvedValueOnce(reply({ proposalId: 'p', revisionId: 'revision', assignmentId: 'assignment', state: 'CHANGES_REQUESTED', version: 2, assignmentVersion: 1 })).mockResolvedValueOnce(reply(projection)).mockResolvedValueOnce(reply(page)).mockResolvedValueOnce(reply(page)).mockResolvedValueOnce(reply({ proposalId: 'p', revisionId: 'revision', assignmentId: 'assignment', state: 'CHANGES_REQUESTED', version: 3, assignmentVersion: 2 })).mockResolvedValueOnce(reply(page));
    setup(fetch); fireEvent.click(await screen.findByRole('button', { name: 'Claim Example' }));
    expect(await screen.findByText('<script>hostile</script>')).toBeInTheDocument(); expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText(/State: CHANGES_REQUESTED/)).toHaveTextContent('Awaiting revision');
    fireEvent.click(screen.getByRole('button', { name: 'Drop assignment' }));
    await screen.findByText('Assignment dropped. Full proposal access has ended.');
    expect(screen.queryByText('<script>hostile</script>')).not.toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[5]![1].body as string)).toEqual({ expectedVersion: 1, revisionId: 'revision', assignmentId: 'assignment', expectedAssignmentVersion: 1 });
  });
  it('filters by original age and author, paginates, and reports stale claims without retry', async () => {
    const fetch = vi.fn().mockResolvedValue(reply({ items: [item], nextCursor: 'next' })); setup(fetch); await screen.findByRole('button', { name: 'Claim Example' });
    fireEvent.change(screen.getByLabelText('Author ID'), { target: { value: 'author' } }); fireEvent.change(screen.getByLabelText('Minimum original age (days)'), { target: { value: '4' } }); fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(fetch.mock.calls[1]![0]).toContain('authorId=author&minAgeDays=4'));
    await screen.findByRole('button', { name: 'Next queue page' }); fireEvent.click(screen.getByRole('button', { name: 'Next queue page' }));
    await waitFor(() => expect(fetch.mock.calls[2]![0]).toContain('cursor=next'));
    fetch.mockResolvedValue(reply({}, 409)); fireEvent.click(await screen.findByRole('button', { name: 'Claim Example' })); expect(await screen.findByRole('alert')).toHaveTextContent('This proposal changed');
  });
  it.each(['history', 'activity', 'detail'])('discards delayed %s bodies on queue navigation', async (kind) => {
    const held = deferred();
    const fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('assignments')) return reply({ items: [assigned], nextCursor: null });
      if (url.includes('review-pool')) return reply(page);
      if ((kind === 'history' && url.endsWith('/revisions')) || (kind === 'activity' && url.endsWith('/activity')) || (kind === 'detail' && url.endsWith('/p'))) return { ok: true, status: 200, json: () => held.promise };
      return reply(url.endsWith('/p') ? projection : page);
    });
    setup(fetch); await screen.findByText('No proposals match these filters.'); fireEvent.click(screen.getByRole('button', { name: 'My assignments' })); fireEvent.click(await screen.findByRole('button', { name: 'Open Example' }));
    await waitFor(() => expect(fetch.mock.calls.some(call => String(call[0]).endsWith(kind === 'history' ? '/revisions' : kind === 'activity' ? '/activity' : '/p'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Review pool' }));
    await act(async () => { held.resolve(kind === 'detail' ? projection : { items: [], nextCursor: 'stale-cursor' }); });
    expect(screen.queryByText('<script>hostile</script>')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Next (history|activity) page/ })).not.toBeInTheDocument();
  });
  it('rejects malformed responses and clears protected data on object denial', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({ items: [item], nextCursor: null, private: 'secret' })); setup(fetch); expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load'); expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});

  it.each(['history', 'activity'])('discards delayed %s after successful drop', async (kind) => {
    const held = deferred();
    const fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('assignments')) return reply({ items: [assigned], nextCursor: null });
      if (url.includes('review-pool')) return reply(page);
      if (url.endsWith('/drop')) return reply({ proposalId: 'p', revisionId: 'revision', assignmentId: 'assignment', state: 'CHANGES_REQUESTED', version: 2, assignmentVersion: 2 });
      if (url.endsWith(kind === 'history' ? '/revisions' : '/activity')) return { ok: true, status: 200, json: () => held.promise };
      return reply(url.endsWith('/p') ? projection : page);
    });
    setup(fetch); await screen.findByText('No proposals match these filters.'); fireEvent.click(screen.getByRole('button', { name: 'My assignments' })); fireEvent.click(await screen.findByRole('button', { name: 'Open Example' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Drop assignment' })); await screen.findByText('Assignment dropped. Full proposal access has ended.');
    await act(async () => { held.resolve({ items: [], nextCursor: 'stale-cursor' }); });
    expect(screen.queryByText('<script>hostile</script>')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Next (history|activity) page/ })).not.toBeInTheDocument();
  });

it('clears detail and all other responses after authoritative history denial', async () => {
  const fetch = vi.fn().mockImplementation(async (url: string) => {
    if (url.includes('assignments')) return reply({ items: [assigned], nextCursor: null });
    if (url.includes('review-pool')) return reply(page);
    if (url.endsWith('/revisions')) return reply({}, 403);
    return reply(url.endsWith('/p') ? projection : page);
  });
  setup(fetch); await screen.findByText('No proposals match these filters.'); fireEvent.click(screen.getByRole('button', { name: 'My assignments' })); fireEvent.click(await screen.findByRole('button', { name: 'Open Example' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Access to this proposal is no longer available');
  expect(screen.queryByText('<script>hostile</script>')).not.toBeInTheDocument();
  expect(screen.queryByText('Loading review information…')).not.toBeInTheDocument();
});

it('keeps assignment navigation when it precedes the deferred initial pool load', async () => {
  const fetch = vi.fn().mockImplementation(async (url: string) => reply(url.includes('assignments') ? { items: [assigned], nextCursor: null } : page));
  setup(fetch);
  // Dispatch synchronously before the mount effect's Promise callback executes.
  fireEvent.click(screen.getByRole('button', { name: 'My assignments' }));
  expect(await screen.findByRole('button', { name: 'Open Example' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'My assignments' })).toHaveAttribute('aria-pressed', 'true');
  expect(fetch.mock.calls.every(call => String(call[0]).includes('assignments'))).toBe(true);
});

it.each(['history', 'activity'])('reenables controls after delayed next %s page is superseded by focus refresh', async (kind) => {
  const held = deferred(); const parsing = deferred();
  const event = { id: 'event', actor: null, timestamp, action: 'SUBMITTED', proposalId: 'p', revisionId: 'older-revision', assignmentId: null, outcome: 'SUCCESS', summary: 'STALE PAGE', reason: null };
  const fetch = vi.fn().mockImplementation(async (url: string) => {
    if (url.includes('assignments')) return reply({ items: [assigned], nextCursor: null });
    if (url.includes('review-pool')) return reply(page);
    if (url.includes('cursor=')) return { ok: true, status: 200, json: () => { parsing.resolve(null); return held.promise; } };
    if (url.endsWith('/p') || url.includes('/p?revisionId=')) return reply(projection);
    return reply({ items: [], nextCursor: 'next' });
  });
  setup(fetch); fireEvent.click(screen.getByRole('button', { name: 'My assignments' })); fireEvent.click(await screen.findByRole('button', { name: 'Open Example' }));
  fireEvent.click(await screen.findByRole('button', { name: `Next ${kind} page` })); await act(async () => { await parsing.promise; });
  expect(screen.getByRole('button', { name: 'Refresh queue' })).toBeDisabled();
  fireEvent(window, new Event('focus'));
  await screen.findByRole('button', { name: 'Drop assignment' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh queue' })).toBeEnabled());
  await act(async () => { held.resolve(kind === 'history' ? { items: [{ id: 'old', number: 1, submittedAt: timestamp, summary: 'STALE PAGE' }], nextCursor: null } : { items: [event], nextCursor: null }); });
  expect(screen.queryByText('STALE PAGE')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Drop assignment' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Review pool' })).toBeEnabled();
});

it('identifies affected revisions, proposal, assignment and successful outcome in activity', async () => {
  const activity = { items: ['revision-one', 'revision-two'].map((revisionId, index) => ({ id: `event-${index}`, actor: null, timestamp, action: 'CLAIMED', proposalId: 'p', revisionId, assignmentId: `assignment-${index}`, outcome: 'SUCCESS', summary: `Event ${index}`, reason: null })), nextCursor: null };
  const fetch = vi.fn().mockImplementation(async (url: string) => reply(url.includes('assignments') ? { items: [assigned], nextCursor: null } : url.endsWith('/p') ? projection : url.endsWith('/activity') ? activity : page));
  setup(fetch); fireEvent.click(screen.getByRole('button', { name: 'My assignments' })); fireEvent.click(await screen.findByRole('button', { name: 'Open Example' }));
  expect(await screen.findByText('Affected revision: revision-one')).toBeInTheDocument();
  expect(screen.getByText('Affected revision: revision-two')).toBeInTheDocument();
  expect(screen.getAllByText('Proposal: p')).toHaveLength(2);
  expect(screen.getByText('Assignment: assignment-0')).toBeInTheDocument();
  expect(screen.getAllByText('Outcome: Success')).toHaveLength(2);
});

it('keeps mutation pending across focus and prevents duplicate claim requests', async () => {
  const held = deferred(); const parsing = deferred();
  const fetch = vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith('/claim')) return { ok: true, status: 200, json: () => { parsing.resolve(null); return held.promise; } };
    if (url.includes('review-pool')) return reply({ items: [item], nextCursor: null });
    return reply(url.endsWith('/p') ? projection : page);
  });
  setup(fetch); const claim = await screen.findByRole('button', { name: 'Claim Example' });
  fireEvent.click(claim); await act(async () => { await parsing.promise; });
  const requests = fetch.mock.calls.length;
  fireEvent(window, new Event('focus')); fireEvent.click(claim);
  expect(fetch).toHaveBeenCalledTimes(requests);
  expect(screen.getByRole('button', { name: 'Refresh queue' })).toBeDisabled();
  await act(async () => { held.resolve({ proposalId: 'p', revisionId: 'revision', assignmentId: 'assignment', state: 'CHANGES_REQUESTED', version: 2, assignmentVersion: 1 }); });
  expect(await screen.findByRole('button', { name: 'Drop assignment' })).toBeEnabled();
  expect(fetch.mock.calls.filter(call => String(call[0]).endsWith('/claim'))).toHaveLength(1);
});

it.each(['history', 'activity'].flatMap(kind => [403, 500].map(status => [kind, status] as const)))('clears pending and ignores delayed %s when focus refresh returns %s', async (kind, status) => {
  const held = deferred(); const parsing = deferred(); let detailReads = 0;
  const fetch = vi.fn().mockImplementation(async (url: string) => {
    if (url.includes('assignments')) return reply({ items: [assigned], nextCursor: null });
    if (url.includes('review-pool')) return reply(page);
    if (url.includes('cursor=')) return { ok: true, status: 200, json: () => { parsing.resolve(null); return held.promise; } };
    if (url.endsWith('/p') || url.includes('/p?revisionId=')) return detailReads++ === 0 ? reply(projection) : reply({}, status);
    return reply({ items: [], nextCursor: 'next' });
  });
  setup(fetch); fireEvent.click(screen.getByRole('button', { name: 'My assignments' })); fireEvent.click(await screen.findByRole('button', { name: 'Open Example' }));
  fireEvent.click(await screen.findByRole('button', { name: `Next ${kind} page` })); await act(async () => { await parsing.promise; });
  expect(screen.getByRole('button', { name: 'Refresh queue' })).toBeDisabled();
  fireEvent(window, new Event('focus'));
  expect(await screen.findByRole('alert')).toHaveTextContent(status === 403 ? 'Access to this proposal is no longer available' : 'Unable to load this request');
  await act(async () => { held.resolve(kind === 'history' ? { items: [{ id: 'old', number: 1, submittedAt: timestamp, summary: 'STALE DENIED PAGE' }], nextCursor: null } : { items: [{ id: 'event', actor: null, timestamp, action: 'SUBMITTED', proposalId: 'p', revisionId: 'older-revision', assignmentId: null, outcome: 'SUCCESS', summary: 'STALE DENIED PAGE', reason: null }], nextCursor: null }); });
  expect(screen.queryByText('STALE DENIED PAGE')).not.toBeInTheDocument();
  expect(screen.queryByText('<script>hostile</script>')).not.toBeInTheDocument();
  expect(screen.queryByText('Request in progress…')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Refresh queue' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Review pool' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Review pool' }));
  expect(await screen.findByText('No proposals match these filters.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Apply filters' })).toBeEnabled();
});
