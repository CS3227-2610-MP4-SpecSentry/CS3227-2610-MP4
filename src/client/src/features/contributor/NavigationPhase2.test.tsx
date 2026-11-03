import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { NavigationGuardProvider } from '../../shared/NavigationGuardProvider';

const id = '11111111-1111-4111-8111-111111111111';
const workingId = '22222222-2222-4222-8222-222222222222';
const title = ('<b>Long saved draft</b> ' + 'word '.repeat(30)).trim();
const session = { account: { id: 'owner', username: 'alice', role: 'CONTRIBUTOR' }, csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 1800000 };
const content = { title, problem: 'Problem', constraints: '', expectedBehavior: 'Expected', summary: '', diffText: '', criteria: [], evidence: [] };
const detail = { proposalId: id, workingRevisionId: workingId, version: 0, state: 'DRAFT', content };
const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
function setup(path: string, items: unknown[] = []) {
  const fetch = vi.fn((url: string) => Promise.resolve(reply(url === '/api/auth/session' ? session : url === '/api/proposals' ? { items, nextCursor: null } : detail)));
  vi.stubGlobal('fetch', fetch);
  const router = createMemoryRouter([{ path: '*', element: <NavigationGuardProvider><App /></NavigationGuardProvider> }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return { fetch, router };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Phase 2 navigation refinement', () => {
  it.each([
    ['/contributor', 'Private drafts', 'Private drafts'],
    ['/contributor/new', 'Create a private draft', 'Create draft'],
    [`/contributor/drafts/${id}`, 'Private draft detail', 'Draft details'],
    [`/contributor/drafts/${id}/edit`, 'Edit private draft', 'Edit draft'],
    [`/contributor/drafts/${id}/edit/`, 'Edit private draft', 'Edit draft'],
  ])('provides one task h1 and contextual breadcrumb at %s', async (path, heading, task) => {
    setup(path!);
    expect(await screen.findByRole('heading', { name: heading!, level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.querySelector('.topbar-task')).toHaveTextContent(task!);
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByRole('list')).toBeInTheDocument();
    expect(breadcrumb.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });
  it('uses one existing protected read for loaded-title breadcrumbs and guards the title link', async () => {
    const { fetch, router } = setup(`/contributor/drafts/${id}/edit`);
    const titleLink = await screen.findByRole('link', { name: title });
    expect(titleLink).toHaveAttribute('title', title);
    expect(titleLink).toHaveAttribute('href', `/contributor/drafts/${id}`);
    expect(titleLink.querySelector('b')).toBeNull();
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/draft'))).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Problem (required)'), { target: { value: 'Unsaved problem' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(titleLink);
    await act(async () => {});
    expect(confirm).toHaveBeenCalledOnce(); expect(router.state.location.pathname).toBe(`/contributor/drafts/${id}/edit`);
    expect(screen.getByLabelText('Problem (required)')).toHaveValue('Unsaved problem');
  });
  it('makes the complete primary row a single descriptive link with no nested controls', async () => {
    setup('/contributor', [{ proposalId: id, workingRevisionId: workingId, title, state: 'DRAFT', version: 0, createdAt: new Date().toISOString() }]);
    const link = await screen.findByRole('link', { name: title });
    expect(link).toHaveClass('draft-row-link'); expect(link.parentElement?.tagName).toBe('LI');
    expect(link).toHaveAttribute('href', `/contributor/drafts/${id}`);
    expect(link).toHaveTextContent('Private working draft'); expect(link).toHaveTextContent('DRAFT');
    expect(link.querySelector('a,button,input,[role="button"]')).toBeNull();
    fireEvent.click(link); await screen.findByRole('heading', { level: 1, name: 'Private draft detail' });
  });
  it('focuses four sections and changes only workspace scrolling without fragment history', async () => {
    const { router } = setup(`/contributor/drafts/${id}/edit`);
    fireEvent.change(await screen.findByLabelText('Problem (required)'), { target: { value: 'Keep editing' } });
    const main = screen.getByRole('main'); const historyLength = window.history.length; const hash = window.location.hash;
    main.style.setProperty('--save-actions-height', '80px');
    main.style.paddingTop = '24px';
    vi.spyOn(main, 'getBoundingClientRect').mockReturnValue({ top: 68 } as DOMRect);
    const sections = screen.getByRole('navigation', { name: 'Draft sections' });
    for (const name of ['Overview', 'Acceptance criteria', 'Patch', 'Evidence']) {
      const target = screen.getByRole('heading', { name, level: 2 });
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 500 } as DOMRect);
      const previousTop = main.scrollTop;
      const activation = new MouseEvent('click', { bubbles: true, cancelable: true });
      fireEvent(within(sections).getByRole('link', { name }), activation);
      expect(activation.defaultPrevented).toBe(true); expect(target).toHaveFocus();
      expect(main.scrollTop).toBe(previousTop + 312);
    }
    expect(window.history.length).toBe(historyLength); expect(window.location.hash).toBe(hash); expect(router.state.location.hash).toBe('');
    expect(window.scrollY).toBe(0); expect(screen.getByLabelText('Problem (required)')).toHaveValue('Keep editing');
    expect(screen.getByText('Unsaved changes.')).toBeInTheDocument();
  });
  it.each([409, 500, 'readback'] as const)('keeps enlarged-text recovery %s out of the sticky summary without losing its full outcome', async mode => {
    const previousFont = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = '200%';
    try {
      const { fetch, router } = setup(`/contributor/drafts/${id}/edit`);
      let reads = 0;
      fetch.mockImplementation((url: string, options?: { method?: string }) => Promise.resolve(url === '/api/auth/session' ? reply(session)
        : options?.method === 'PATCH' ? mode === 'readback' ? reply({ proposalId: id, workingRevisionId: workingId, version: 1, state: 'DRAFT', revisionId: null, assignmentId: null, assignmentVersion: null }) : { ok: false, status: mode, json: async () => ({}) }
        : mode === 'readback' && ++reads > 1 ? { ok: false, status: 500, json: async () => ({}) } : reply(detail)));
      fireEvent.change(await screen.findByLabelText('Problem (required)'), { target: { value: 'Keep these edits' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save private draft' }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(mode === 409 ? 'This draft changed' : mode === 500 ? 'The save result is uncertain' : 'Draft saved, but we could not verify');
      const actions = screen.getByRole('region', { name: 'Save draft and status' });
      expect(actions).not.toContainElement(alert);
      expect(actions.textContent!.length).toBeLessThan(150);
      expect(within(actions).getByRole('button', { name: 'Save private draft' })).toBeDisabled();
      const recovery = screen.getByRole('region', { name: 'Save recovery details' });
      expect(recovery).toContainElement(alert);
      const activation = new MouseEvent('click', { bubbles: true, cancelable: true });
      fireEvent(within(actions).getByRole('link', { name: 'Recovery details' }), activation);
      expect(activation.defaultPrevented).toBe(true); expect(recovery).toHaveFocus();
      expect(router.state.location.hash).toBe('');
      expect(screen.getByLabelText('Problem (required)')).toHaveValue('Keep these edits');
      expect(screen.getByLabelText('Problem (required)')).toBeEnabled();
    } finally { document.documentElement.style.fontSize = previousFont; }
  });
  it('retains field limits and described-by relationships while explaining their purpose', async () => {
    setup(`/contributor/drafts/${id}/edit`);
    const problem = await screen.findByLabelText('Problem (required)');
    expect(problem).toHaveAccessibleDescription(/Explain the issue.*10,000 characters/);
    expect(screen.getByLabelText('Unified diff (optional)')).toHaveAccessibleDescription(/Paste the unified diff.*100,000 characters/);
    fireEvent.click(screen.getByRole('button', { name: 'Add criterion' }));
    expect(screen.getByLabelText('Criterion 1 statement')).toHaveAccessibleDescription(/testable outcome.*2,000 characters/);
  });
});
