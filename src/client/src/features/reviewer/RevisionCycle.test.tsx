import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReviewerWorkspace } from './ReviewerWorkspace';

const timestamp = '2026-10-01T00:00:00.000Z';
const account = { id: 'r', username: 'reviewer', role: 'REVIEWER' as const };
const session = { account, csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 100000 };
const page = { items: [], nextCursor: null };
const notice = (revisionId: string) => ({ id: `notice-${revisionId}`, kind: 'NEW_REVISION', proposalId: 'p', revisionId, createdAt: timestamp, readAt: null });
const detail = (revisionId = 'old') => ({ id: 'p', version: 3, title: 'Review example', state: 'IN_REVIEW', author: { id: 'a', username: 'author' }, firstSubmittedAt: timestamp, latestSubmittedAt: timestamp,
  assignment: { id: 'assignment-new', revisionId: 'new', version: 2, reviewer: { id: account.id, username: account.username } },
  latestRevision: { id: 'new', number: 2, submittedAt: timestamp }, hasUnreadLatestRevision: true, revisionNotice: { id: `notice-${revisionId}`, readAt: null },
  revision: { id: revisionId, number: revisionId === 'old' ? 1 : 2, summary: 'Summary', problem: 'Protected problem', constraints: '', expectedBehavior: 'Expected', diffText: '+ change', submittedAt: timestamp, criteria: [{ id: 'c', stableKey: 'AC1', statement: 'Behavior', required: true }], evidence: [], criterionEvidenceLinks: [] } });
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
function mount(fetch: ReturnType<typeof vi.fn>) { vi.stubGlobal('fetch', fetch); let generation = 0; render(<ReviewerWorkspace session={session} authorization={{ current: () => generation, invalidate: () => { generation++; } }} onUnauthorized={vi.fn()} />); }
function server(ackStatus = 200) {
  let readOld = false;
  return vi.fn(async (url: string, options?: { body?: string }) => {
    if (url.endsWith('/acknowledge')) { readOld = ackStatus === 200 && JSON.parse(options!.body!).revisionId === 'old'; return reply({ id: 'notice-old', readAt: timestamp }, ackStatus); }
    if (url === '/api/notifications') return reply({ items: [{ ...notice('old'), readAt: readOld ? timestamp : null }, notice('new')], nextCursor: null });
    if (url.includes('/proposals/p?')) return reply(detail(new URL(url, 'http://local').searchParams.get('revisionId')!));
    if (url.includes('/review?')) return reply({ proposalId: 'p', revisionId: 'old', version: 3, assignmentId: 'assignment-new', assignmentVersion: 2, editable: false, coverage: [], approvalBlockers: [] });
    return reply(page);
  });
}
afterEach(() => vi.unstubAllGlobals());

it('acknowledges only the exact rendered older revision and retains the newer unread notice', async () => {
  const fetch = server(); mount(fetch);
  fireEvent.click(await screen.findByRole('button', { name: 'Open notified revision old' }));
  await screen.findByText('Viewed revision: 1 (old); Latest revision: 2 (new)');
  await waitFor(() => expect(fetch.mock.calls.filter(([url]) => url.endsWith('/acknowledge'))).toHaveLength(1));
  const call = fetch.mock.calls.find(([url]) => url.endsWith('/acknowledge'))!;
  expect(JSON.parse(call[1]!.body!)).toEqual({ kind: 'NEW_REVISION', revisionId: 'old', assignmentId: 'assignment-new', expectedAssignmentVersion: 2 });
  await screen.findByText('New revision · Unread · Proposal p · Revision new');
  fireEvent(window, new Event('focus'));
  await waitFor(() => expect(fetch.mock.calls.filter(([url]) => url.includes('/proposals/p?'))).toHaveLength(2));
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/acknowledge'))).toHaveLength(1);
});

it('freezes an acknowledgement race without discarding the displayed revision', async () => {
  const fetch = server(409); mount(fetch);
  fireEvent.click(await screen.findByRole('button', { name: 'Open notified revision old' }));
  await screen.findByText(/Revision notice changed/);
  expect(screen.getByText('Protected problem')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Drop assignment' })).toBeDisabled();
  expect(screen.getByText('New revision · Unread · Proposal p · Revision new')).toBeInTheDocument();
});

it('never acknowledges a delayed detail response discarded by queue navigation', async () => {
  let resolve!: (value: unknown) => void;
  const held = new Promise(value => { resolve = value; }); const normal = server();
  const fetch = vi.fn((url: string, options?: { body?: string }) => url.includes('/proposals/p?') ? Promise.resolve({ ok: true, status: 200, json: () => held }) : normal(url, options));
  mount(fetch); fireEvent.click(await screen.findByRole('button', { name: 'Open notified revision old' }));
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('/proposals/p?'))).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'My assignments' }));
  await act(async () => { resolve(detail()); });
  expect(screen.queryByText('Protected problem')).not.toBeInTheDocument();
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/acknowledge'))).toHaveLength(0);
});

it('clears protected forms when a safe withdrawal notice arrives, with no content link', async () => {
  let withdrawn = false; const normal = server();
  const fetch = vi.fn((url: string, options?: { body?: string }) => withdrawn && url === '/api/notifications' ? Promise.resolve(reply({ items: [{ id: 'withdrawal', kind: 'WITHDRAWN', proposalId: 'p', createdAt: timestamp, readAt: null }], nextCursor: null })) : normal(url, options));
  mount(fetch); fireEvent.click(await screen.findByRole('button', { name: 'Open notified revision old' }));
  await screen.findByText('Protected problem');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh notices' })).toBeEnabled());
  withdrawn = true; fireEvent.click(screen.getByRole('button', { name: 'Refresh notices' }));
  await screen.findByText('Proposal withdrawn. Full proposal access has ended.');
  expect(screen.queryByText('Protected problem')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Open notified revision/ })).not.toBeInTheDocument();
});

