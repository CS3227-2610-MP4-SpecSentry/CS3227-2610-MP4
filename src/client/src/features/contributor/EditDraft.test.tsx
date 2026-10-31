import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContributorWorkspace } from './ContributorWorkspace';
import { App } from '../../App';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '33333333-3333-4333-8333-333333333333';
const workingId = '22222222-2222-4222-8222-222222222222';
const session = { account: { id: 'owner', username: 'alice', role: 'CONTRIBUTOR' as const }, csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 1800000 };
const content = { title: 'Private title', problem: 'Problem', constraints: '', expectedBehavior: 'Expected',
  summary: 'Keep summary', diffText: 'Keep diff', criteria: [{ stableKey: workingId, statement: 'Keep criterion', required: true }], evidence: [{ id: workingId, text: 'Keep evidence' }] };
const detail = { proposalId: id, workingRevisionId: workingId, version: 0, state: 'DRAFT', content };
const saved = (version = 1) => ({ proposalId: id, workingRevisionId: workingId, version, state: 'DRAFT', revisionId: null, assignmentId: null, assignmentVersion: null });
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
function tree(onSessionLost = vi.fn()) {
  return <MemoryRouter initialEntries={[`/contributor/drafts/${id}/edit`]}><Link to={`/contributor/drafts/${otherId}/edit`}>Other editor</Link>
    <Routes><Route path="/contributor/*" element={<ContributorWorkspace session={session} onSessionLost={onSessionLost} />} /></Routes></MemoryRouter>;
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Own draft editor', () => {
  it('saves repeatedly with exact versions and preserves every hidden field and child identity', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockResolvedValueOnce(reply(saved(1)))
      .mockResolvedValueOnce(reply({ ...detail, version: 1, content: { ...content, title: 'Edited title' } }))
      .mockResolvedValueOnce(reply(saved(2))).mockResolvedValueOnce(reply({ ...detail, version: 2, content: { ...content, title: 'Edited title', problem: 'Edited problem' } }));
    vi.stubGlobal('fetch', fetch); render(tree());
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'Edited title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save private draft' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Draft saved. Version 1.');
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH', headers: { 'x-csrf-token': session.csrfToken } });
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body as string)).toEqual({ expectedVersion: 0, content: { ...content, title: 'Edited title' } });
    fireEvent.change(screen.getByLabelText('Problem (required)'), { target: { value: 'Edited problem' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save private draft' }));
    await screen.findByText('Draft saved. Version 2.');
    expect(JSON.parse(fetch.mock.calls[3]?.[1].body as string).expectedVersion).toBe(1);
  });
  it('validates Unicode boundaries beside the field without losing input or sending a write', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(detail)); vi.stubGlobal('fetch', fetch); render(tree());
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: '😀'.repeat(201) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save private draft' }));
    expect(screen.getByLabelText('Title (required)')).toHaveFocus();
    expect(screen.getByLabelText('Title (required)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Title (required)')).toHaveValue('😀'.repeat(201));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([409, 500, 'network'])('locks writes after %s and requires confirmed successful reconciliation before replacing edits/version', async (status) => {
    const latest = { ...detail, version: 3, content: { ...content, title: 'Latest saved title' } };
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail));
    if (status === 'network') fetch.mockRejectedValueOnce(new Error('offline'));
    else fetch.mockResolvedValueOnce(reply({ correlationId: '12345678-1234-4234-8234-123456789abc', message: 'private-stack' }, status as number));
    fetch.mockResolvedValueOnce(reply({}, 500)).mockResolvedValueOnce(reply(latest)).mockResolvedValueOnce(reply(saved(4))).mockResolvedValueOnce(reply({ ...latest, version: 4 }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.stubGlobal('fetch', fetch); render(tree());
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'My unsaved text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save private draft' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Save private draft' })).toBeDisabled();
    expect(screen.getByLabelText('Title (required)')).toHaveValue('My unsaved text');
    expect(screen.queryByText('private-stack')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest draft and discard changes' }));
    expect(fetch).toHaveBeenCalledTimes(2);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest draft and discard changes' }));
    await screen.findByRole('alert');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(screen.getByLabelText('Title (required)')).toHaveValue('My unsaved text');
    expect(screen.getByRole('button', { name: 'Save private draft' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest draft and discard changes' }));
    await waitFor(() => expect(screen.getByLabelText('Title (required)')).toHaveValue('Latest saved title'));
    fireEvent.click(screen.getByRole('button', { name: 'Save private draft' }));
    await screen.findByText('Draft saved. Version 4.');
    expect(JSON.parse(fetch.mock.calls[4]?.[1].body as string).expectedVersion).toBe(3);
  });
  it.each([200, 401])('ignores a late save %s after switching proposals', async status => {
    let resolveSave!: (value: ReturnType<typeof reply>) => void;
    const pending = new Promise<ReturnType<typeof reply>>(resolve => { resolveSave = resolve; });
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockReturnValueOnce(pending)
      .mockResolvedValueOnce(reply({ ...detail, proposalId: otherId, content: { ...content, title: 'Other draft' } }));
    const lost = vi.fn(); vi.stubGlobal('fetch', fetch); render(tree(lost));
    await screen.findByDisplayValue('Private title');
    fireEvent.click(screen.getByRole('button', { name: 'Save private draft' }));
    fireEvent.click(screen.getByRole('link', { name: 'Other editor' }));
    fireEvent.change(await screen.findByDisplayValue('Other draft'), { target: { value: 'Other unsaved input' } });
    await act(async () => { resolveSave(reply(status === 200 ? saved() : {}, status)); });
    expect(screen.getByLabelText('Title (required)')).toHaveValue('Other unsaved input');
    if (status === 401) expect(lost).toHaveBeenCalledTimes(1);
    else expect(lost).not.toHaveBeenCalled();
    expect(screen.queryByText('Draft saved. Version 1.')).not.toBeInTheDocument();
  });
  it('does not replace dirty input/version when the same login refreshes its session-loss callback', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(detail)); vi.stubGlobal('fetch', fetch);
    const view = render(tree());
    fireEvent.change(await screen.findByLabelText('Title (required)'), { target: { value: 'Dirty text' } });
    view.rerender(tree(vi.fn()));
    expect(screen.getByLabelText('Title (required)')).toHaveValue('Dirty text');
    expect(screen.getByText('Editing version 0 · DRAFT')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not retry a failed confirmed reload and discard newer text on a same-login callback refresh', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockResolvedValueOnce(reply({}, 409))
      .mockResolvedValueOnce(reply({}, 500)).mockResolvedValue(reply({ ...detail, version: 5, content: { ...content, title: 'Must not replace local text' } }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal('fetch', fetch); const view = render(tree());
    await screen.findByDisplayValue('Private title');
    fireEvent.click(screen.getByRole('button', { name: 'Save private draft' })); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest draft and discard changes' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reload latest draft and discard changes' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Title (required)'), { target: { value: 'Newer unsaved text' } });
    await act(async () => { view.rerender(tree(vi.fn())); });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(screen.getByLabelText('Title (required)')).toHaveValue('Newer unsaved text');
    expect(screen.getByRole('button', { name: 'Save private draft' })).toBeDisabled();
  });
  it.each(['initial load', 'reload'])('ignores a late %s result after switching proposals', async mode => {
    let resolveLoad!: (value: ReturnType<typeof reply>) => void;
    const pending = new Promise<ReturnType<typeof reply>>(resolve => { resolveLoad = resolve; });
    const fetch = vi.fn();
    if (mode === 'reload') fetch.mockResolvedValueOnce(reply(detail));
    fetch.mockReturnValueOnce(pending).mockResolvedValueOnce(reply({ ...detail, proposalId: otherId, content: { ...content, title: 'Other draft' } }));
    vi.spyOn(window, 'confirm').mockReturnValue(true); vi.stubGlobal('fetch', fetch); render(tree());
    if (mode === 'reload') {
      await screen.findByDisplayValue('Private title');
      fireEvent.click(screen.getByRole('button', { name: 'Reload latest draft and discard changes' }));
    }
    fireEvent.click(screen.getByRole('link', { name: 'Other editor' }));
    fireEvent.change(await screen.findByDisplayValue('Other draft'), { target: { value: 'Other local input' } });
    await act(async () => { resolveLoad(reply(detail)); });
    expect(screen.getByLabelText('Title (required)')).toHaveValue('Other local input');
    expect(screen.queryByDisplayValue('Private title')).not.toBeInTheDocument();
  });
  it.each([200, 401])('ignores an old-auth save %s after adopting a replacement login context', async status => {
    let resolveSave!: (value: ReturnType<typeof reply>) => void;
    const pending = new Promise<ReturnType<typeof reply>>(resolve => { resolveSave = resolve; });
    let current = session;
    vi.stubGlobal('fetch', vi.fn((url: string, options?: { method?: string }) => url === '/api/auth/session'
      ? Promise.resolve(reply(current)) : options?.method === 'PATCH' ? pending : Promise.resolve(reply(detail))));
    render(<MemoryRouter initialEntries={[`/contributor/drafts/${id}/edit`]}><App /></MemoryRouter>);
    await screen.findByDisplayValue('Private title');
    fireEvent.click(screen.getByRole('button', { name: 'Save private draft' }));
    current = { ...session, csrfToken: 'b'.repeat(64) };
    await act(async () => { fireEvent(window, new Event('focus')); });
    await waitFor(() => expect(screen.getByLabelText('Title (required)')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Title (required)'), { target: { value: 'Replacement private edit' } });
    await act(async () => { resolveSave(reply(status === 200 ? saved() : {}, status)); });
    expect(screen.getByText('Signed in as alice')).toBeInTheDocument();
    expect(screen.getByLabelText('Title (required)')).toHaveValue('Replacement private edit');
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft saved. Version 1.')).not.toBeInTheDocument();
  });
  it('invalidates the current login for a late save 401 after route-only navigation', async () => {
    let resolveSave!: (value: ReturnType<typeof reply>) => void;
    const pending = new Promise<ReturnType<typeof reply>>(resolve => { resolveSave = resolve; });
    vi.stubGlobal('fetch', vi.fn((url: string, options?: { method?: string }) => {
      if (url === '/api/auth/session') return Promise.resolve(reply(session));
      if (options?.method === 'PATCH') return pending;
      return Promise.resolve(reply(url.includes(otherId) ? { ...detail, proposalId: otherId, content: { ...content, title: 'Other draft' } } : detail));
    }));
    render(<MemoryRouter initialEntries={[`/contributor/drafts/${id}/edit`]}><Link to={`/contributor/drafts/${otherId}/edit`}>Other editor</Link><App /></MemoryRouter>);
    await screen.findByDisplayValue('Private title');
    fireEvent.click(screen.getByRole('button', { name: 'Save private draft' }));
    fireEvent.click(screen.getByRole('link', { name: 'Other editor' }));
    fireEvent.change(await screen.findByDisplayValue('Other draft'), { target: { value: 'Other private input' } });
    await act(async () => { resolveSave(reply({}, 401)); });
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title (required)')).not.toBeInTheDocument();
  });
});
