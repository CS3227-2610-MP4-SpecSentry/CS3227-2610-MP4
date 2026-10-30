import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { NavigationGuardProvider } from '../../shared/NavigationGuardProvider';

const id = '11111111-1111-4111-8111-111111111111';
const workingId = '22222222-2222-4222-8222-222222222222';
const criterionId = '33333333-3333-4333-8333-333333333333';
const editor = `/contributor/drafts/${id}/edit`;
const content = { title: 'Saved title', problem: 'Saved problem', constraints: '', expectedBehavior: 'Expected', summary: '', diffText: '', criteria: [{ stableKey: criterionId, statement: '<b>Required text</b>\nSecond line', required: true }, { stableKey: workingId, statement: 'Optional text', required: false }], evidence: [] };
const detail = { proposalId: id, workingRevisionId: workingId, version: 0, state: 'DRAFT', content };
const session = { account: { id: 'owner', username: 'alice', role: 'CONTRIBUTOR' }, csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 1800000 };
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
function setup(entries = ['/contributor', editor]) {
  const router = createMemoryRouter([{ path: '*', element: <NavigationGuardProvider><App /></NavigationGuardProvider> }], { initialEntries: entries, initialIndex: entries.length - 1 });
  render(<RouterProvider router={router} />);
  return router;
}
function mockFetch() {
  return vi.fn((url: string) => Promise.resolve(reply(url === '/api/auth/session' ? session : url === '/api/proposals' ? { items: [], nextCursor: null } : detail)));
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('functional UX with the production data-router adapter', () => {
  it.each(['Contributor workspace', 'SpecSentry workspace', 'Contributor workspace breadcrumb'])('guards %s once and retains edits on cancel', async name => {
    vi.stubGlobal('fetch', mockFetch()); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const router = setup();
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'Unsaved title' } });
    fireEvent.click(screen.getByRole('link', { name }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(router.state.location.pathname).toBe(editor);
    expect(screen.getByLabelText('Title (required)')).toHaveValue('Unsaved title');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('link', { name }));
    await screen.findByRole('heading', { name: 'No drafts yet' });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(router.state.location.pathname).toBe('/contributor');
  });
  it('moves skip-link focus without adding a native hash entry, keeping subsequent dirty Back guarded', async () => {
    vi.stubGlobal('fetch', mockFetch()); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const detailPath = `/contributor/drafts/${id}`;
    const router = setup([detailPath]);
    const editLink = await screen.findByRole('link', { name: 'Edit private draft' });
    const initialHash = window.location.hash;
    const initialHistoryLength = window.history.length;
    const activation = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole('link', { name: 'Skip to main content' }), activation);
    expect(activation.defaultPrevented).toBe(true);
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe(initialHash);
    expect(window.history.length).toBe(initialHistoryLength);
    expect(router.state.location.hash).toBe('');
    fireEvent.click(editLink);
    fireEvent.change(await screen.findByLabelText('Problem (required)'), { target: { value: 'Unsaved after skip' } });
    await act(async () => { await router.navigate(-1); });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe(editor);
    expect(screen.getByLabelText('Problem (required)')).toHaveValue('Unsaved after skip');
    confirm.mockReturnValue(true);
    await act(async () => { await router.navigate(-1); });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(router.state.location.pathname).toBe(detailPath);
  });
  it('guards actual POP and the existing Back action without double prompts', async () => {
    vi.stubGlobal('fetch', mockFetch()); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); const router = setup();
    fireEvent.change(await screen.findByLabelText('Contributor summary (optional)'), { target: { value: 'Unsaved summary' } });
    await act(async () => { await router.navigate(-1); });
    expect(router.state.location.pathname).toBe(editor); expect(confirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back to draft detail' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('Contributor summary (optional)')).toHaveValue('Unsaved summary');
    confirm.mockReturnValue(true);
    await act(async () => { await router.navigate(-1); });
    expect(router.state.location.pathname).toBe('/contributor'); expect(confirm).toHaveBeenCalledTimes(3);
  });
  it('keeps exact reverts and irrelevant old meaning selections clean, including reload/unload', async () => {
    vi.stubGlobal('fetch', mockFetch()); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); const router = setup();
    const statement = await screen.findByLabelText('Criterion 1 statement');
    fireEvent.change(statement, { target: { value: 'Changed meaning' } });
    fireEvent.change(screen.getByLabelText('Criterion 1 meaning'), { target: { value: 'replace' } });
    expect(screen.getByText('Unsaved changes.')).toBeInTheDocument();
    fireEvent.change(statement, { target: { value: content.criteria[0]!.statement } });
    expect(screen.getByText('No unsaved changes.')).toBeInTheDocument();
    const unload = new Event('beforeunload', { cancelable: true }); fireEvent(window, unload); expect(unload.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest draft and discard changes' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save private draft' })).toBeEnabled());
    expect(confirm).not.toHaveBeenCalled();
    await act(async () => { await router.navigate('/contributor'); });
    expect(confirm).not.toHaveBeenCalled();
  });
  it('registers unload protection while dirty and clears it on forced session loss', async () => {
    let expired = false;
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url === '/api/auth/session' ? reply(expired ? {} : session, expired ? 401 : 200) : reply(detail))));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); setup();
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'Protected input' } });
    const unload = new Event('beforeunload', { cancelable: true }); fireEvent(window, unload); expect(unload.defaultPrevented).toBe(true);
    expired = true; fireEvent(window, new Event('focus'));
    await screen.findByLabelText('Username');
    expect(confirm).not.toHaveBeenCalled(); expect(screen.queryByDisplayValue('Protected input')).not.toBeInTheDocument();
    const cleanUnload = new Event('beforeunload', { cancelable: true }); fireEvent(window, cleanUnload); expect(cleanUnload.defaultPrevented).toBe(false);
  });
  it('does not let a late successful create release a replacement editor guard', async () => {
    let resolveCreate!: (response: ReturnType<typeof reply>) => void;
    const request = new Promise<ReturnType<typeof reply>>(resolve => { resolveCreate = resolve; });
    vi.stubGlobal('fetch', vi.fn((url: string, options?: { method?: string }) => options?.method === 'POST' ? request : Promise.resolve(reply(url === '/api/auth/session' ? session : detail))));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true); const router = setup(['/contributor/new']);
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'Creating old draft' } });
    fireEvent.change(screen.getByLabelText('Problem (required)'), { target: { value: 'Problem' } });
    fireEvent.change(screen.getByLabelText('Expected behavior (required)'), { target: { value: 'Expected' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
    await act(async () => { await router.navigate(editor); });
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'Replacement unsaved content' } });
    await act(async () => { resolveCreate(reply({ proposalId: id, workingRevisionId: workingId, version: 0, state: 'DRAFT', revisionId: null, assignmentId: null, assignmentVersion: null })); });
    confirm.mockReturnValue(false);
    fireEvent.click(screen.getByRole('link', { name: 'Contributor workspace' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    expect(router.state.location.pathname).toBe(editor);
    expect(screen.getByLabelText('Title (required)')).toHaveValue('Replacement unsaved content');
  });
  it('ignores hash-only navigation and becomes clean only after successful save reconciliation', async () => {
    let read = 0;
    const latest = { ...detail, version: 1, content: { ...content, title: 'Saved new title' } };
    vi.stubGlobal('fetch', vi.fn((url: string, options?: { method?: string }) => Promise.resolve(reply(url === '/api/auth/session' ? session : options?.method === 'PATCH' ? { proposalId: id, workingRevisionId: workingId, version: 1, state: 'DRAFT', revisionId: null, assignmentId: null, assignmentVersion: null } : url === '/api/proposals' ? { items: [], nextCursor: null } : ++read === 1 ? detail : latest))));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); const router = setup();
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: latest.content.title } });
    await act(async () => { await router.navigate(`${editor}#main-content`); });
    expect(confirm).not.toHaveBeenCalled(); expect(screen.getByText('Unsaved changes.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save private draft' }));
    await screen.findByText('Draft saved. Version 1.');
    const actions = screen.getByRole('region', { name: 'Save draft and status' });
    expect(within(actions).getByRole('status')).toHaveTextContent('Draft saved. Version 1.');
    fireEvent.click(screen.getByRole('link', { name: 'Contributor workspace' }));
    await screen.findByRole('heading', { name: 'No drafts yet' }); expect(confirm).not.toHaveBeenCalled();
  });
  it('shows all saved criteria as ordered private plain text with explicit classification', async () => {
    vi.stubGlobal('fetch', mockFetch()); setup([`/contributor/drafts/${id}`]);
    const section = await screen.findByRole('region', { name: 'Saved acceptance criteria' });
    const items = within(section).getAllByRole('listitem'); expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Required'); expect(items[0]).toHaveTextContent('<b>Required text</b>');
    expect(items[1]).toHaveTextContent('Optional'); expect(items[1]).toHaveTextContent('Optional text');
    expect(section.querySelector('b')).toBeNull();
    expect(section).toHaveTextContent('Private working content, not a submitted revision.');
  });
  it('clears the create guard before its successful navigation', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, options?: { method?: string }) => Promise.resolve(reply(url === '/api/auth/session' ? session : options?.method === 'POST' ? { proposalId: id, workingRevisionId: workingId, version: 0, state: 'DRAFT', revisionId: null, assignmentId: null, assignmentVersion: null } : detail))));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); setup(['/contributor/new']);
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'New title' } });
    fireEvent.change(screen.getByLabelText('Problem (required)'), { target: { value: 'Problem' } });
    fireEvent.change(screen.getByLabelText('Expected behavior (required)'), { target: { value: 'Expected' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
    await screen.findByRole('heading', { name: 'Private draft detail' }); expect(confirm).not.toHaveBeenCalled();
  });
});
