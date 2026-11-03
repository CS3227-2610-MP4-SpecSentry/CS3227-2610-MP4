import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContributorWorkspace } from './ContributorWorkspace';

const token = 'a'.repeat(64);
const session = { account: { id: 'owner', username: 'alice', role: 'CONTRIBUTOR' as const }, csrfToken: token, expiresAt: Date.now() + 1800000 };
const id = '11111111-1111-4111-8111-111111111111';
const workingId = '22222222-2222-4222-8222-222222222222';
const content = { title: '<script>private title</script>', problem: 'Problem', constraints: '', expectedBehavior: 'Expected', summary: '', diffText: '', criteria: [], evidence: [] };
const detail = { proposalId: id, workingRevisionId: workingId, version: 0, state: 'DRAFT', content };
const created = { proposalId: id, workingRevisionId: workingId, version: 0, state: 'DRAFT', revisionId: null, assignmentId: null, assignmentVersion: null };
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
function setup(path = '/contributor', onSessionLost = vi.fn()) {
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/contributor/*"
    element={<ContributorWorkspace session={session} onSessionLost={onSessionLost} />} /></Routes></MemoryRouter>);
  return onSessionLost;
}
function fill() {
  fireEvent.change(screen.getByLabelText('Title (required)'), { target: { value: content.title } });
  fireEvent.change(screen.getByLabelText('Problem (required)'), { target: { value: content.problem } });
  fireEvent.change(screen.getByLabelText('Expected behavior (required)'), { target: { value: content.expectedBehavior } });
}
afterEach(() => vi.unstubAllGlobals());

describe('Contributor private drafts', () => {
  it('offers editing from an own DRAFT detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(detail)));
    setup(`/contributor/drafts/${id}`);
    expect(await screen.findByRole('link', { name: 'Edit private draft' })).toHaveAttribute('href', `/contributor/drafts/${id}/edit`);
  });
  it('has an empty state and a usable create/detail/list flow, rendering text safely', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(reply(created, 201)).mockResolvedValueOnce(reply(detail))
      .mockResolvedValueOnce(reply({ items: [{ proposalId: id, workingRevisionId: workingId, title: content.title, state: 'DRAFT', version: 0, createdAt: new Date().toISOString() }], nextCursor: null }));
    vi.stubGlobal('fetch', fetch); setup();
    expect(await screen.findByText(/No drafts yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Create New Draft' })); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
    expect(await screen.findByText(content.title)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', headers: { 'x-csrf-token': token } });
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body as string)).toEqual(content);
    fireEvent.click(screen.getByRole('link', { name: 'Back to your drafts' }));
    expect(await screen.findByRole('link', { name: content.title })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit|delete|edit/i })).not.toBeInTheDocument();
  });
  it('associates validation with fields, focuses the first error and retains input', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); setup('/contributor/new');
    fireEvent.change(screen.getByLabelText('Title (required)'), { target: { value: '😀'.repeat(201) } });
    fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
    expect(screen.getByLabelText('Title (required)')).toHaveFocus();
    expect(screen.getByLabelText('Title (required)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Title (required)')).toHaveValue('😀'.repeat(201));
    expect(fetch).not.toHaveBeenCalled();
  });
  it('retains form text on safe server validation failure and includes reference', async () => {
    const reference = '12345678-1234-4234-8234-123456789abc';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ correlationId: reference, message: 'private-stack-secret' }, 422)));
    setup('/contributor/new'); fill(); fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(reference);
    expect(screen.getByLabelText('Title (required)')).toHaveValue(content.title);
    expect(screen.queryByText(/private-stack-secret/)).not.toBeInTheDocument();
  });
  it('does not repeat an uncertain create; checking the list permits retry and keeps text', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(reply({ items: [], nextCursor: null }));
    vi.stubGlobal('fetch', fetch); setup('/contributor/new'); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Check your draft list');
    expect(screen.getByRole('button', { name: 'Create private draft' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Create private draft' })); expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('link', { name: 'Back to your drafts' }));
    await screen.findByText(/No drafts yet/);
    fireEvent.click(screen.getByRole('link', { name: 'Create New Draft' }));
    expect(screen.getByLabelText('Title (required)')).toHaveValue(content.title);
    expect(screen.getByRole('button', { name: 'Create private draft' })).toBeEnabled();
  });
  it('keeps an in-flight create locked across Back → New and requires reconciliation after an uncertain result', async () => {
    let rejectCreate!: (error: Error) => void;
    const request = new Promise((_resolve, reject) => { rejectCreate = reject; });
    const fetch = vi.fn().mockImplementation((url: string, options?: { method?: string }) =>
      options?.method === 'POST' ? request : Promise.resolve(reply({ items: [], nextCursor: null })));
    vi.stubGlobal('fetch', fetch); setup('/contributor/new'); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
    fireEvent.click(screen.getByRole('link', { name: 'Back to your drafts' }));
    await screen.findByText(/No drafts yet/);
    fireEvent.click(screen.getByRole('link', { name: 'Create New Draft' }));
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    rejectCreate(new Error('response interrupted'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create private draft' })).toBeDisabled());
    expect(screen.getByLabelText('Title (required)')).toHaveValue(content.title);
    expect(fetch.mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(1);
    fireEvent.click(screen.getByRole('link', { name: 'Back to your drafts' }));
    await screen.findByText(/No drafts yet/);
    fireEvent.click(screen.getByRole('link', { name: 'Create New Draft' }));
    expect(screen.getByRole('button', { name: 'Create private draft' })).toBeEnabled();
  });
  it('withholds inaccessible detail and signals session loss', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ content }, 401)));
    const lost = setup(`/contributor/drafts/${id}`);
    await waitFor(() => expect(lost).toHaveBeenCalledOnce());
    expect(screen.queryByText(content.title)).not.toBeInTheDocument();
  });
  it('counts only the loaded page and distinguishes an empty later page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({ items: [{ proposalId: id, workingRevisionId: workingId, title: 'One draft', state: 'DRAFT', version: 0, createdAt: new Date().toISOString() }], nextCursor: 'next_cursor' }))
      .mockResolvedValueOnce(reply({ items: [], nextCursor: null })));
    setup();
    await screen.findByRole('link', { name: 'One draft' });
    expect(screen.getByTestId('draft-page-count')).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('No drafts on this page');
    expect(screen.getByTestId('draft-page-count')).toHaveTextContent('0');
    expect(screen.queryByText('No drafts yet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'First page' })).toBeEnabled();
  });
  it('loads cursor pages only through the protected API', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({ items: [], nextCursor: 'safe_cursor' }))
      .mockResolvedValueOnce(reply({ items: [], nextCursor: null }));
    vi.stubGlobal('fetch', fetch); setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/proposals?cursor=safe_cursor', expect.objectContaining({ credentials: 'same-origin' })));
  });
});
