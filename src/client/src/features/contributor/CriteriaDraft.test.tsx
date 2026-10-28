import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContributorWorkspace } from './ContributorWorkspace';
import { App } from '../../App';

const id = '11111111-1111-4111-8111-111111111111';
const workingId = '22222222-2222-4222-8222-222222222222';
const key = '33333333-3333-4333-8333-333333333333';
const replacement = '44444444-4444-4444-8444-444444444444';
const session = { account: { id: 'owner', username: 'alice', role: 'CONTRIBUTOR' as const }, csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 1800000 };
const content = { title: 'Title', problem: 'Problem', constraints: '', expectedBehavior: 'Expected', summary: 'Keep summary', diffText: '', criteria: [{ stableKey: key, statement: 'Original meaning', required: true }], evidence: [{ id: key, text: 'Keep evidence' }] };
const detail = { proposalId: id, workingRevisionId: workingId, version: 0, state: 'DRAFT', content };
const saved = (version = 1) => ({ proposalId: id, workingRevisionId: workingId, version, state: 'DRAFT', revisionId: null, assignmentId: null, assignmentVersion: null });
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
function tree(lost = vi.fn()) { return <MemoryRouter initialEntries={[`/contributor/drafts/${id}/edit`]}><Link to={`/contributor/drafts/${replacement}/edit`}>Other editor</Link><Routes><Route path="/contributor/*" element={<ContributorWorkspace session={session} onSessionLost={lost} />} /></Routes></MemoryRouter>; }
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save private draft' }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Private draft acceptance criteria', () => {
  it('defaults a new row to required, retains blank input on validation and adopts issued identities before repeated saving', async () => {
    const added = { stableKey: replacement, statement: 'New criterion', required: true };
    const latest = { ...detail, version: 1, content: { ...content, criteria: [...content.criteria, added] } };
    const optional = { ...latest, version: 2, content: { ...latest.content, criteria: [content.criteria[0]!, { ...added, required: false }] } };
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockResolvedValueOnce(reply(saved())).mockResolvedValueOnce(reply(latest))
      .mockResolvedValueOnce(reply(saved(2))).mockResolvedValueOnce(reply(optional));
    vi.stubGlobal('fetch', fetch); render(tree()); await screen.findByLabelText('Criterion 1 statement');
    fireEvent.click(screen.getByRole('button', { name: 'Add criterion' }));
    expect(screen.getByLabelText('Criterion 2 statement')).toHaveFocus(); expect(screen.getByLabelText('Criterion 2 required')).toBeChecked();
    save(); expect(screen.getByLabelText('Criterion 2 statement')).toHaveFocus(); expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Criterion 2 statement')).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(screen.getByLabelText('Criterion 2 statement'), { target: { value: added.statement } }); save();
    await screen.findByText('Draft saved. Version 1.');
    expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ expectedVersion: 0, content: { ...content, criteria: [...content.criteria, { statement: added.statement, required: true }] } });
    fireEvent.click(screen.getByLabelText('Criterion 2 required')); save(); await screen.findByText('Draft saved. Version 2.');
    expect(JSON.parse(fetch.mock.calls[3]![1].body).content.criteria[1]).toEqual({ ...added, required: false });
    fireEvent.click(screen.getByRole('button', { name: 'Remove criterion 2' })); expect(screen.getByLabelText('Criterion 1 statement')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Remove criterion 1' })); expect(screen.getByRole('button', { name: 'Add criterion' })).toHaveFocus();
    expect(screen.getByText('No criteria yet. You can save this incomplete draft.')).toBeVisible();
  });
  it('requires a human meaning declaration, keeps a correction key, and omits the key for material replacement', async () => {
    const corrected = { ...detail, version: 1, content: { ...content, criteria: [{ ...content.criteria[0]!, statement: 'Corrected wording' }] } };
    const rewritten = { ...detail, version: 2, content: { ...content, criteria: [{ stableKey: replacement, statement: 'Different meaning', required: true }] } };
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockResolvedValueOnce(reply(saved())).mockResolvedValueOnce(reply(corrected))
      .mockResolvedValueOnce(reply(saved(2))).mockResolvedValueOnce(reply(rewritten)).mockResolvedValueOnce(reply(saved(3))).mockResolvedValueOnce(reply({ ...rewritten, version: 3 }));
    vi.stubGlobal('fetch', fetch); render(tree());
    fireEvent.change(await screen.findByLabelText('Criterion 1 statement'), { target: { value: 'Corrected wording' } }); save();
    expect(screen.getByLabelText('Criterion 1 meaning')).toHaveFocus(); expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Criterion 1 meaning'), { target: { value: 'same' } }); save(); await screen.findByText('Draft saved. Version 1.');
    expect(JSON.parse(fetch.mock.calls[1]![1].body).content.criteria[0].stableKey).toBe(key);
    fireEvent.change(screen.getByLabelText('Criterion 1 statement'), { target: { value: 'Different meaning' } });
    fireEvent.change(screen.getByLabelText('Criterion 1 meaning'), { target: { value: 'replace' } }); save(); await screen.findByText('Draft saved. Version 2.');
    expect(JSON.parse(fetch.mock.calls[3]![1].body).content.criteria[0]).toEqual({ statement: 'Different meaning', required: true });
    save(); await screen.findByText('Draft saved. Version 3.'); expect(JSON.parse(fetch.mock.calls[5]![1].body).content.criteria[0].stableKey).toBe(replacement);
  });
  it.each(['failure', 'malformed', 'wrong identity', 'newer version'])('pauses after committed save with %s reconciliation without losing meaning choices', async mode => {
    const result = mode === 'failure' ? reply({}, 500) : mode === 'malformed' ? reply({}) : mode === 'wrong identity' ? reply({ ...detail, version: 1, workingRevisionId: replacement }) : reply({ ...detail, version: 2 });
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockResolvedValueOnce(reply(saved())).mockResolvedValueOnce(result);
    vi.stubGlobal('fetch', fetch); render(tree());
    fireEvent.change(await screen.findByLabelText('Criterion 1 statement'), { target: { value: 'Retain my correction' } });
    fireEvent.change(screen.getByLabelText('Criterion 1 meaning'), { target: { value: 'same' } }); save();
    expect(await screen.findByRole('alert')).toHaveTextContent('Draft saved, but its current identities could not be reconciled');
    expect(screen.getByLabelText('Criterion 1 statement')).toHaveValue('Retain my correction'); expect(screen.getByLabelText('Criterion 1 meaning')).toHaveValue('same');
    expect(screen.getByRole('button', { name: 'Save private draft' })).toBeDisabled(); save(); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each(['criterion', 'evidence'])('rejects keyless %s post-save content without adopting its version or losing the declared correction', async missing => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockResolvedValueOnce(reply(saved()))
      .mockResolvedValueOnce(reply({ ...detail, version: 1, content: { ...content, criteria: [{ ...(missing === 'criterion' ? {} : { stableKey: key }), statement: 'Retain my correction', required: true }], evidence: missing === 'evidence' ? [{ text: 'Keep evidence' }] : content.evidence } }));
    vi.stubGlobal('fetch', fetch); render(tree());
    fireEvent.change(await screen.findByLabelText('Criterion 1 statement'), { target: { value: 'Retain my correction' } });
    fireEvent.change(screen.getByLabelText('Criterion 1 meaning'), { target: { value: 'same' } }); save();
    expect(await screen.findByRole('alert')).toHaveTextContent('Draft saved, but its current identities could not be reconciled');
    expect(screen.getByLabelText('Criterion 1 statement')).toHaveValue('Retain my correction');
    expect(screen.getByLabelText('Criterion 1 meaning')).toHaveValue('same');
    expect(screen.getByText(/^Editing version 0 /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save private draft' })).toBeDisabled(); save(); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each(['initial load', 'reload'])('refuses keyless persisted criteria during %s and retains existing input', async mode => {
    const keyless = reply({ ...detail, content: { ...content, criteria: [{ statement: 'Incomplete server identity', required: true }] } });
    const fetch = vi.fn();
    if (mode === 'reload') fetch.mockResolvedValueOnce(reply(detail));
    fetch.mockResolvedValueOnce(keyless); vi.stubGlobal('fetch', fetch); vi.spyOn(window, 'confirm').mockReturnValue(true); render(tree());
    if (mode === 'reload') {
      fireEvent.change(await screen.findByLabelText('Criterion 1 statement'), { target: { value: 'Keep my input' } });
      fireEvent.click(screen.getByRole('button', { name: 'Reload latest draft and discard changes' }));
    }
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load this draft');
    if (mode === 'reload') { expect(screen.getByLabelText('Criterion 1 statement')).toHaveValue('Keep my input'); expect(screen.getByRole('button', { name: 'Save private draft' })).toBeDisabled(); }
    else expect(screen.queryByRole('button', { name: 'Save private draft' })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Incomplete server identity')).not.toBeInTheDocument();
  });
  it('rejects oversized Unicode without truncating or losing the entered statement', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(detail)); vi.stubGlobal('fetch', fetch); render(tree());
    const value = '\u{1F600}'.repeat(2001); fireEvent.change(await screen.findByLabelText('Criterion 1 statement'), { target: { value } }); save();
    expect(screen.getByLabelText('Criterion 1 statement')).toHaveValue(value); expect(screen.getByLabelText('Criterion 1 statement')).toHaveFocus(); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([200, 401])('isolates late reconciliation %s from another proposal while handling current-session expiry', async status => {
    let resolve!: (value: ReturnType<typeof reply>) => void; const read = new Promise<ReturnType<typeof reply>>(r => { resolve = r; });
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockResolvedValueOnce(reply(saved())).mockReturnValueOnce(read)
      .mockResolvedValueOnce(reply({ ...detail, proposalId: replacement, content: { ...content, title: 'Other title' } }));
    const lost = vi.fn(); vi.stubGlobal('fetch', fetch); render(tree(lost)); await screen.findByLabelText('Criterion 1 statement'); save();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3)); fireEvent.click(screen.getByRole('link', { name: 'Other editor' }));
    fireEvent.change(await screen.findByDisplayValue('Other title'), { target: { value: 'Other unsaved' } });
    await act(async () => { resolve(reply(status === 200 ? { ...detail, version: 1 } : {}, status)); });
    expect(screen.getByLabelText('Title (required)')).toHaveValue('Other unsaved'); expect(lost).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
  });
  it.each([200, 401])('ignores old-auth reconciliation %s after a replacement login without losing its input', async status => {
    let resolve!: (value: ReturnType<typeof reply>) => void;
    const pending = new Promise<ReturnType<typeof reply>>(r => { resolve = r; });
    let current = session; let reads = 0;
    vi.stubGlobal('fetch', vi.fn((url: string, options?: { method?: string }) => {
      if (url === '/api/auth/session') return Promise.resolve(reply(current));
      if (options?.method === 'PATCH') return Promise.resolve(reply(saved()));
      reads++; return reads === 2 ? pending : Promise.resolve(reply(detail));
    }));
    render(<MemoryRouter initialEntries={[`/contributor/drafts/${id}/edit`]}><App /></MemoryRouter>);
    await screen.findByLabelText('Criterion 1 statement'); save(); await waitFor(() => expect(reads).toBe(2));
    current = { ...session, csrfToken: 'b'.repeat(64) };
    await act(async () => { fireEvent(window, new Event('focus')); });
    await waitFor(() => expect(screen.getByLabelText('Criterion 1 statement')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Criterion 1 statement'), { target: { value: 'Replacement private input' } });
    await act(async () => { resolve(reply(status === 200 ? { ...detail, version: 1 } : {}, status)); });
    expect(screen.getByText('Signed in as alice')).toBeVisible(); expect(screen.getByLabelText('Criterion 1 statement')).toHaveValue('Replacement private input');
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
  });
  it('keeps the existing 50-item cap visible without a submission minimum gate', async () => {
    const criteria = Array.from({ length: 50 }, (_, index) => ({ stableKey: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, statement: `Criterion ${index}`, required: false }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ ...detail, content: { ...content, criteria } })));
    render(tree()); await screen.findByLabelText('Criterion 50 statement');
    expect(screen.getByRole('button', { name: 'Add criterion' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save private draft' })).toBeEnabled();
  });

});
