import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
      .mockResolvedValueOnce(reply(session())).mockResolvedValueOnce(reply({ items: [], nextCursor: null })).mockResolvedValueOnce(reply({}, 204));
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
  it('toggles navigation without discarding unsaved draft input or exposing other role links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(session())));
    render(<MemoryRouter initialEntries={['/contributor/new']}><App /></MemoryRouter>);
    const title = await screen.findByLabelText('Title (required)');
    fireEvent.change(title, { target: { value: 'Keep my work' } });
    const toggle = screen.getByRole('button', { name: 'Collapse navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(screen.getByRole('navigation', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contributor workspace' })).toHaveAttribute('title', 'Contributor workspace');
    expect(document.querySelector('.app-shell')).toHaveClass('navigation-collapsed');
    expect(title).toHaveValue('Keep my work');
    expect(toggle).toHaveAccessibleName('Expand navigation');
    fireEvent.click(toggle);
    expect(screen.getByRole('link', { name: 'Contributor workspace' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Reviewer workspace' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
    expect(title).toHaveValue('Keep my work');
  });
  it('uses a modal mobile drawer and returns focus on Escape without losing draft input', async () => {
    // jsdom lacks the dialog platform methods; browser acceptance checks the native trap/inert behavior.
    const showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
    const closeDialog = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); });
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: { configurable: true, value: showModal }, close: { configurable: true, value: closeDialog },
    });
    try {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(session())));
      render(<MemoryRouter initialEntries={['/contributor/new']}><App /></MemoryRouter>);
      const title = await screen.findByLabelText('Title (required)');
      fireEvent.change(title, { target: { value: 'Keep mobile work' } });
      const trigger = screen.getByRole('button', { name: 'Open navigation' });
      trigger.focus(); fireEvent.click(trigger);
      const drawer = screen.getByRole('dialog', { name: 'Workspace navigation' });
      expect(showModal).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(within(drawer).getByRole('button', { name: 'Sign out' })).toBeEnabled();
      fireEvent(drawer, new Event('cancel', { bubbles: true, cancelable: true }));
      expect(closeDialog).toHaveBeenCalledOnce();
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(title).toHaveValue('Keep mobile work');
      fireEvent.click(trigger);
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close navigation' }));
      expect(trigger).toHaveFocus();
      expect(title).toHaveValue('Keep mobile work');
    } finally {
      Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
      Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
    }
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
  it.each([
    ['sign out', 'same account'], ['sign out', 'different account'],
    ['server expiry', 'same account'], ['server expiry', 'different account'],
  ])('ignores an old draft 401 after %s and replacement login with the %s', async (transition, identity) => {
    let resolveCreate!: (response: ReturnType<typeof reply>) => void;
    const pendingCreate = new Promise<ReturnType<typeof reply>>(resolve => { resolveCreate = resolve; });
    let expired = false;
    const replacement = { ...session(), csrfToken: 'b'.repeat(64), account: identity === 'same account'
      ? session().account : { id: 'two', username: 'bob', role: 'CONTRIBUTOR' } };
    vi.stubGlobal('fetch', vi.fn((url: string, options?: { method?: string }) => {
      if (url === '/api/auth/session') return Promise.resolve(reply(expired ? {} : session(), expired ? 401 : 200));
      if (url === '/api/auth/csrf') return Promise.resolve(reply({ csrfToken }));
      if (url === '/api/auth/login') return Promise.resolve(reply(replacement));
      if (url === '/api/auth/logout') return Promise.resolve(reply({}, 204));
      if (url === '/api/proposals' && options?.method === 'POST') return pendingCreate;
      return Promise.resolve(reply({ items: [], nextCursor: null }));
    }));
    render(<MemoryRouter initialEntries={['/contributor/new']}><App /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'Old draft' } });
    fireEvent.change(screen.getByLabelText('Problem (required)'), { target: { value: 'Old problem' } });
    fireEvent.change(screen.getByLabelText('Expected behavior (required)'), { target: { value: 'Old behavior' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
    if (transition === 'sign out') fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    else { expired = true; fireEvent(window, new Event('focus')); }
    fireEvent.change(await screen.findByLabelText('Username'), { target: { value: replacement.account.username } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'replacement-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'New private input' } });
    await act(async () => { resolveCreate(reply({}, 401)); });
    expect(screen.getByText(`Signed in as ${replacement.account.username}`)).toBeInTheDocument();
    expect(screen.getByLabelText('Title (required)')).toHaveValue('New private input');
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
  });
  it('still clears protected input for a current-session draft 401', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url === '/api/auth/session' ? reply(session()) : reply({}, 401))));
    render(<MemoryRouter initialEntries={['/contributor/new']}><App /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'Current private input' } });
    fireEvent.change(screen.getByLabelText('Problem (required)'), { target: { value: 'Problem' } });
    fireEvent.change(screen.getByLabelText('Expected behavior (required)'), { target: { value: 'Behavior' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
    expect(await screen.findByLabelText('Username')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title (required)')).not.toBeInTheDocument();
  });
  it('still invalidates the current session after a failed sign-out attempt', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url === '/api/auth/session'
      ? reply(session()) : reply({}, url === '/api/auth/logout' ? 500 : 401))));
    render(<MemoryRouter initialEntries={['/contributor/new']}><App /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'Current private input' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await screen.findByText('Unable to sign out. Please try again.');
    expect(screen.getByLabelText('Title (required)')).toHaveValue('Current private input');
    fireEvent.change(screen.getByLabelText('Problem (required)'), { target: { value: 'Problem' } });
    fireEvent.change(screen.getByLabelText('Expected behavior (required)'), { target: { value: 'Behavior' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
    expect(await screen.findByLabelText('Username')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title (required)')).not.toBeInTheDocument();
  });
  it.each(['same account', 'different account'])('ignores an old draft 401 after focus adopts a replacement session for the %s', async (identity) => {
    let resolveCreate!: (response: ReturnType<typeof reply>) => void;
    const pendingCreate = new Promise<ReturnType<typeof reply>>(resolve => { resolveCreate = resolve; });
    const original = session();
    const replacement = { ...session(), csrfToken: 'b'.repeat(64), account: identity === 'same account'
      ? original.account : { id: 'two', username: 'bob', role: 'CONTRIBUTOR' } };
    let current = original;
    vi.stubGlobal('fetch', vi.fn((url: string, options?: { method?: string }) => {
      if (url === '/api/auth/session') return Promise.resolve(reply(current));
      if (options?.method === 'POST') return pendingCreate;
      return Promise.resolve(reply({ items: [], nextCursor: null }));
    }));
    render(<MemoryRouter initialEntries={['/contributor/new']}><App /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'Old private draft' } });
    fireEvent.change(screen.getByLabelText('Problem (required)'), { target: { value: 'Problem' } });
    fireEvent.change(screen.getByLabelText('Expected behavior (required)'), { target: { value: 'Behavior' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
    current = replacement;
    await act(async () => { fireEvent(window, new Event('focus')); });
    expect(screen.getByText(`Signed in as ${replacement.account.username}`)).toBeInTheDocument();
    const title = screen.getByLabelText('Title (required)');
    expect(title).toBeEnabled();
    expect(title).toHaveValue('');
    fireEvent.change(title, { target: { value: 'Replacement private input' } });
    await act(async () => { resolveCreate(reply({}, 401)); });
    expect(screen.getByText(`Signed in as ${replacement.account.username}`)).toBeInTheDocument();
    expect(screen.getByLabelText('Title (required)')).toHaveValue('Replacement private input');
  });
  it('retains the pending request and genuine 401 invalidation after a same-context focus refresh', async () => {
    let resolveCreate!: (response: ReturnType<typeof reply>) => void;
    const pendingCreate = new Promise<ReturnType<typeof reply>>(resolve => { resolveCreate = resolve; });
    const original = session();
    let current = original;
    vi.stubGlobal('fetch', vi.fn((url: string, options?: { method?: string }) => url === '/api/auth/session'
      ? Promise.resolve(reply(current)) : options?.method === 'POST' ? pendingCreate : Promise.resolve(reply({ items: [], nextCursor: null }))));
    render(<MemoryRouter initialEntries={['/contributor/new']}><App /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'Current private draft' } });
    fireEvent.change(screen.getByLabelText('Problem (required)'), { target: { value: 'Problem' } });
    fireEvent.change(screen.getByLabelText('Expected behavior (required)'), { target: { value: 'Behavior' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
    current = { ...original, expiresAt: original.expiresAt + 60000 };
    await act(async () => { fireEvent(window, new Event('focus')); });
    expect(screen.getByLabelText('Title (required)')).toBeDisabled();
    expect(screen.getByLabelText('Title (required)')).toHaveValue('Current private draft');
    await act(async () => { resolveCreate(reply({}, 401)); });
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title (required)')).not.toBeInTheDocument();
  });
  it.each([204, 500])('ignores an obsolete logout %s after focus adopts a replacement session', async (status) => {
    let resolveLogout!: (response: ReturnType<typeof reply>) => void;
    const pendingLogout = new Promise<ReturnType<typeof reply>>(resolve => { resolveLogout = resolve; });
    let current = session();
    vi.stubGlobal('fetch', vi.fn((url: string) => url === '/api/auth/session' ? Promise.resolve(reply(current))
      : url === '/api/auth/logout' ? pendingLogout : Promise.resolve(reply({ items: [], nextCursor: null }))));
    render(<MemoryRouter initialEntries={['/contributor/new']}><App /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    current = { ...session(), csrfToken: 'b'.repeat(64), account: { id: 'two', username: 'bob', role: 'CONTRIBUTOR' } };
    await act(async () => { fireEvent(window, new Event('focus')); });
    fireEvent.change(screen.getByLabelText('Title (required)'), { target: { value: 'Replacement private input' } });
    await act(async () => { resolveLogout(reply({}, status)); });
    expect(screen.getByText('Signed in as bob')).toBeInTheDocument();
    expect(screen.getByLabelText('Title (required)')).toHaveValue('Replacement private input');
    expect(screen.queryByText('Unable to sign out. Please try again.')).not.toBeInTheDocument();
    expect(screen.queryByText('You have signed out.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  });
  it.each([401, 500])('does not restore a stale session-check success after a newer check invalidates authentication with %s', async (status) => {
    let resolveEarlier!: (response: ReturnType<typeof reply>) => void;
    let resolveLater!: (response: ReturnType<typeof reply>) => void;
    const earlier = new Promise<ReturnType<typeof reply>>(resolve => { resolveEarlier = resolve; });
    const later = new Promise<ReturnType<typeof reply>>(resolve => { resolveLater = resolve; });
    let checks = 0;
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url !== '/api/auth/session') return Promise.resolve(reply({ items: [], nextCursor: null }));
      checks++;
      return checks === 1 ? Promise.resolve(reply(session())) : checks === 2 ? earlier : later;
    }));
    render(<MemoryRouter initialEntries={['/contributor/new']}><App /></MemoryRouter>);
    await screen.findByLabelText('Title (required)');
    fireEvent(window, new Event('focus'));
    fireEvent(window, new Event('focus'));
    await act(async () => { resolveLater(reply({}, status)); });
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    await act(async () => { resolveEarlier(reply(session())); });
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title (required)')).not.toBeInTheDocument();
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
