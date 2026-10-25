import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const csrfToken = 'a'.repeat(64);
const session = (role = 'CONTRIBUTOR') => ({ account: { id: 'one', username: 'alice', role }, csrfToken, expiresAt: Date.now() + 1800000 });
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('base authentication', () => {
  it('shows the login form without protected content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({}, 401)));
    render(<MemoryRouter initialEntries={['/reviewer']}><App /></MemoryRouter>);
    expect(await screen.findByLabelText('Username')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reviewer workspace' })).not.toBeInTheDocument();
  });
  it('signs in with CSRF and signs out', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({}, 401)).mockResolvedValueOnce(reply({ csrfToken }))
      .mockResolvedValueOnce(reply(session())).mockResolvedValueOnce(reply({}, 204));
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter><App /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'synthetic-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Contributor workspace' })).toBeInTheDocument();
    expect(fetch.mock.calls[2]?.[1]).toMatchObject({ method: 'POST', headers: { 'x-csrf-token': csrfToken } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('You have signed out.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });
  it.each(['CONTRIBUTOR', 'REVIEWER', 'RELEASE_MAINTAINER'])('restores the %s session', async (role) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(session(role))));
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByText('Signed in as alice')).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });
  it('denies another role workspace', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(session())));
    render(<MemoryRouter initialEntries={['/reviewer']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  });
  it('handles failed login without revealing backend details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({}, 401)).mockResolvedValueOnce(reply({ csrfToken }))
      .mockResolvedValueOnce(reply({ message: 'internal-secret' }, 401)));
    render(<MemoryRouter><App /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to sign in.');
    expect(screen.queryByText(/internal-secret/)).not.toBeInTheDocument();
  });
  it('clears the workspace when the session expires', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ ...session(), expiresAt: Date.now() + 300 })));
    render(<MemoryRouter><App /></MemoryRouter>);
    await screen.findByText('Signed in as alice');
    expect(await screen.findByText('Your session expired. Please sign in again.')).toBeInTheDocument();
    expect(screen.queryByText('Signed in as alice')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });
});

function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

describe('authorization generation', () => {
  it.each(['401', 'error'])('discards an old session 200 after a newer %s', async (failure) => {
    const old = deferred<ReturnType<typeof reply>>(); const newer = deferred<ReturnType<typeof reply>>();
    const fetch = vi.fn().mockResolvedValueOnce(reply(session())).mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise);
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter><App /></MemoryRouter>);
    await screen.findByText('Signed in as alice');
    fireEvent(window, new Event('focus')); fireEvent(window, new Event('focus'));
    if (failure === '401') newer.resolve(reply({}, 401)); else newer.reject(new Error('offline'));
    await screen.findByLabelText('Username');
    old.resolve(reply(session()));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(screen.queryByText('Signed in as alice')).not.toBeInTheDocument();
  });
  it('checks generation after session body parsing', async () => {
    const body = deferred<ReturnType<typeof session>>();
    const fetch = vi.fn().mockResolvedValueOnce(reply(session())).mockResolvedValueOnce({ ok: true, status: 200, json: () => body.promise }).mockResolvedValueOnce(reply({}, 401));
    vi.stubGlobal('fetch', fetch); render(<MemoryRouter><App /></MemoryRouter>);
    await screen.findByText('Signed in as alice'); fireEvent(window, new Event('focus'));
    await new Promise(resolve => setTimeout(resolve, 0)); fireEvent(window, new Event('focus'));
    await screen.findByLabelText('Username'); body.resolve(session());
    await new Promise(resolve => setTimeout(resolve, 10)); expect(screen.queryByText('Signed in as alice')).not.toBeInTheDocument();
  });
});

  it.each(['expiry', 'account switch', 'logout'].flatMap(transition => ['detail', 'history', 'activity'].map(kind => [transition, kind])))('discards protected %s response: %s', async (transition, kind) => {
    if (transition === 'expiry') vi.useFakeTimers({ shouldAdvanceTime: true });
    const body = deferred<unknown>();
    const parsing = deferred<void>();
    const heldResponse = { ok: true, status: 200, json: () => { parsing.resolve(); return body.promise; } };
    const stamp = '2026-10-01T00:00:00.000Z';
    const metadata = { id: 'p', version: 1, title: 'Protected proposal', author: { id: 'a', username: 'author' }, summary: 'Summary', firstSubmittedAt: stamp, latestSubmittedAt: stamp, awaitingRevision: false, state: 'IN_REVIEW', assignmentId: 'assignment', revisionId: 'revision', assignmentVersion: 1 };
    const restored = { ...session('REVIEWER'), expiresAt: Date.now() + 100000 };
    const { summary, awaitingRevision, assignmentId, assignmentVersion, revisionId, ...root } = metadata;
    void awaitingRevision; void assignmentVersion;
    const detail = { ...root, assignment: { id: assignmentId, revisionId, version: 1, reviewer: { id: 'one', username: 'alice' } }, revision: { id: revisionId, number: 1, summary, problem: 'STALE PRIVATE BODY', constraints: '', expectedBehavior: 'Expected', diffText: '', submittedAt: stamp, criteria: [{ id: 'c', stableKey: 'c', statement: 'Criterion', required: true }], evidence: [], criterionEvidenceLinks: [] } };
    let sessions = 0;
    const fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/auth/session') return reply(sessions++ === 0 ? restored : session('CONTRIBUTOR'));
      if (url.includes('review-pool')) return reply({ items: [], nextCursor: null });
      if (url.includes('assignments')) return reply({ items: [metadata], nextCursor: null });
      if (url === '/api/proposals/p') return kind === 'detail' ? heldResponse : reply(detail);
      if (url.endsWith('/revisions') || url.endsWith('/activity')) return (kind === 'history' && url.endsWith('/revisions')) || (kind === 'activity' && url.endsWith('/activity')) ? heldResponse : reply({ items: [], nextCursor: null });
      return reply({}, 204);
    });
    vi.stubGlobal('fetch', fetch); render(<MemoryRouter initialEntries={['/reviewer']}><App /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'My assignments' })); fireEvent.click(await screen.findByRole('button', { name: 'Open Protected proposal' }));
    await act(async () => { await parsing.promise; });
    if (transition === 'account switch') { fireEvent(window, new Event('focus')); await screen.findByRole('heading', { name: 'Access denied' }); }
    else if (transition === 'logout') { fireEvent.click(screen.getByRole('button', { name: 'Sign out' })); await screen.findByLabelText('Username'); }
    else { await act(async () => { await vi.advanceTimersByTimeAsync(100001); }); await screen.findByLabelText('Username'); }
    await act(async () => { body.resolve(kind === 'detail' ? detail : kind === 'history' ? { items: [{ id: 'old', number: 1, summary: 'STALE PRIVATE BODY', submittedAt: stamp }], nextCursor: null } : { items: [{ id: 'event', actor: null, timestamp: stamp, action: 'SUBMITTED', proposalId: 'p', revisionId: 'revision', assignmentId: null, outcome: 'SUCCESS', summary: 'STALE PRIVATE BODY', reason: null }], nextCursor: null }); });
    expect(screen.queryByText('STALE PRIVATE BODY')).not.toBeInTheDocument();
  });
