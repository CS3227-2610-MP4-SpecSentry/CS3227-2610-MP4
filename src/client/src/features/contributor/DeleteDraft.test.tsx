import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContributorWorkspace } from './ContributorWorkspace';
import { App } from '../../App';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '33333333-3333-4333-8333-333333333333';
const session = { account: { id: 'owner', username: 'alice', role: 'CONTRIBUTOR' as const }, csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 1800000 };
const content = { title: '<script>Private title</script>', problem: 'Problem', constraints: '', expectedBehavior: 'Expected', summary: '', diffText: '', criteria: [], evidence: [] };
const detail = { proposalId: id, workingRevisionId: otherId, version: 3, state: 'DRAFT', content };
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
function tree(onSessionLost = vi.fn()) {
  return <MemoryRouter initialEntries={[`/contributor/drafts/${id}`]}><Link to={`/contributor/drafts/${otherId}`}>Other draft</Link>
    <Routes><Route path="/contributor/*" element={<ContributorWorkspace session={session} onSessionLost={onSessionLost} />} /></Routes></MemoryRouter>;
}
async function confirm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Delete private draft' }));
  fireEvent.click(screen.getByRole('button', { name: 'Permanently delete draft' }));
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Own never-submitted draft deletion', () => {
  it('requires explicit confirmation, restores cancel focus and sends exact version/CSRF only after confirmation', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockResolvedValueOnce(reply(null, 204))
      .mockResolvedValue(reply({ items: [], nextCursor: null }));
    vi.stubGlobal('fetch', fetch); render(tree());
    fireEvent.click(await screen.findByRole('button', { name: 'Delete private draft' }));
    expect(screen.getByRole('button', { name: 'Cancel deletion' })).toHaveFocus();
    expect(screen.getByText(/This cannot be undone/)).toHaveTextContent(content.title);
    expect(document.querySelector('script')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel deletion' }));
    expect(screen.getByRole('button', { name: 'Delete private draft' })).toHaveFocus();
    expect(fetch).toHaveBeenCalledTimes(1);
    await confirm();
    expect(await screen.findByText('Private draft deleted.')).toHaveFocus();
    await screen.findByText('No drafts yet');
    expect(fetch.mock.calls[1]).toEqual([`/api/proposals/${id}`, expect.objectContaining({ method: 'DELETE', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken }, body: JSON.stringify({ expectedVersion: 3, confirmed: true }) })]);
  });
  it.each([409, 500, 'network'])('blocks deletion after %s until explicit successful reconciliation and fresh confirmation', async status => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail));
    if (status === 'network') fetch.mockRejectedValueOnce(new Error('offline'));
    else fetch.mockResolvedValueOnce(reply({ message: 'raw-private-stack' }, status as number));
    fetch.mockResolvedValueOnce(reply({}, 500)).mockResolvedValueOnce(reply({ ...detail, version: 4, content: { ...content, title: 'Latest saved' } }))
      .mockResolvedValueOnce(reply(null, 204)).mockResolvedValue(reply({ items: [], nextCursor: null }));
    vi.stubGlobal('fetch', fetch); const view = render(tree()); await confirm();
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Delete private draft' })).toBeDisabled();
    expect(screen.getByText(content.title)).toBeInTheDocument();
    expect(screen.queryByText('raw-private-stack')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check current draft' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check current draft' })).toBeEnabled());
    view.rerender(tree(vi.fn()));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: 'Delete private draft' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Check current draft' }));
    await screen.findByText('Latest saved');
    expect(screen.queryByRole('button', { name: 'Permanently delete draft' })).not.toBeInTheDocument();
    await confirm(); await screen.findByText('Private draft deleted.');
    expect(JSON.parse(fetch.mock.calls[4]?.[1].body as string)).toEqual({ expectedVersion: 4, confirmed: true });
  });
  it('reconciles an uncertain deletion as unavailable without claiming this request deleted it', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(reply({}, 404));
    vi.stubGlobal('fetch', fetch); render(tree()); await confirm(); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Check current draft' }));
    await screen.findByText('This draft is no longer available.');
    expect(screen.queryByText(content.title)).not.toBeInTheDocument();
    expect(screen.queryByText('Private draft deleted.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete private draft' })).not.toBeInTheDocument();
  });
  it.each([403, 404, 422])('handles a definite %s denial without leaking errors', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply(detail)).mockResolvedValueOnce(reply({ message: 'raw-private-stack' }, status)));
    render(tree()); await confirm(); await screen.findByRole('alert');
    expect(screen.queryByText('raw-private-stack')).not.toBeInTheDocument();
    if (status !== 422) expect(screen.queryByText(content.title)).not.toBeInTheDocument();
    else expect(screen.getByText(content.title)).toBeInTheDocument();
  });
  it.each([204, 401])('suppresses late route-only %s navigation but still reports genuine session loss', async status => {
    let resolve!: (r: ReturnType<typeof reply>) => void;
    const pending = new Promise<ReturnType<typeof reply>>(r => { resolve = r; });
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockReturnValueOnce(pending)
      .mockResolvedValueOnce(reply({ ...detail, proposalId: otherId, content: { ...content, title: 'Other private draft' } }));
    const lost = vi.fn(); vi.stubGlobal('fetch', fetch); render(tree(lost)); await confirm();
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Back to your drafts' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Other draft' })); await screen.findByText('Other private draft');
    await act(async () => { resolve(reply({}, status)); });
    expect(screen.getByText('Other private draft')).toBeInTheDocument();
    expect(screen.queryByText('Private draft deleted.')).not.toBeInTheDocument();
    expect(lost).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
  });
  it.each([204, 401])('ignores obsolete-auth deletion %s after login replacement', async status => {
    let resolve!: (r: ReturnType<typeof reply>) => void;
    const pending = new Promise<ReturnType<typeof reply>>(r => { resolve = r; });
    let current = session;
    vi.stubGlobal('fetch', vi.fn((url: string, options?: { method?: string }) => url === '/api/auth/session'
      ? Promise.resolve(reply(current)) : options?.method === 'DELETE' ? pending : Promise.resolve(reply(detail))));
    render(<MemoryRouter initialEntries={[`/contributor/drafts/${id}`]}><App /></MemoryRouter>); await confirm();
    current = { ...session, csrfToken: 'b'.repeat(64) };
    await act(async () => { fireEvent(window, new Event('focus')); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete private draft' })).toBeEnabled());
    await act(async () => { resolve(reply({}, status)); });
    expect(screen.getByText('Signed in as alice')).toBeInTheDocument();
    expect(screen.getByText(content.title)).toBeInTheDocument();
    expect(screen.queryByText('Private draft deleted.')).not.toBeInTheDocument();
  });
});
