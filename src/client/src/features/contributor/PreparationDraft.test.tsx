import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContributorWorkspace } from './ContributorWorkspace';

const id = '11111111-1111-4111-8111-111111111111';
const workingId = '22222222-2222-4222-8222-222222222222';
const key = '33333333-3333-4333-8333-333333333333';
const addedId = '44444444-4444-4444-8444-444444444444';
const session = { account: { id: 'owner', username: 'alice', role: 'CONTRIBUTOR' as const }, csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 1800000 };
const content = { title: 'Title', problem: 'Problem', constraints: '', expectedBehavior: 'Expected', summary: 'Original summary', diffText: 'Original diff', criteria: [{ stableKey: key, statement: 'Keep criterion', required: false }], evidence: [{ id: key, text: 'Original evidence' }] };
const detail = { proposalId: id, workingRevisionId: workingId, version: 0, state: 'DRAFT', content };
const saved = (version = 1) => ({ proposalId: id, workingRevisionId: workingId, version, state: 'DRAFT', revisionId: null, assignmentId: null, assignmentVersion: null });
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save private draft' }));
function tree(path = `/contributor/drafts/${id}/edit`) { return <MemoryRouter initialEntries={[path]}><Routes><Route path="/contributor/*" element={<ContributorWorkspace session={session} onSessionLost={vi.fn()} />} /></Routes></MemoryRouter>; }
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Private submission preparation', () => {
  it('preserves criterion and existing evidence identities while editing, adding, reconciling and removing evidence', async () => {
    const edited = { ...content, summary: 'Written summary', diffText: 'incomplete\npatch', evidence: [{ id: key, text: 'Edited evidence' }, { id: addedId, text: 'New evidence' }] };
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockResolvedValueOnce(reply(saved())).mockResolvedValueOnce(reply({ ...detail, version: 1, content: edited }))
      .mockResolvedValueOnce(reply(saved(2))).mockResolvedValueOnce(reply({ ...detail, version: 2, content: edited }));
    vi.stubGlobal('fetch', fetch); render(tree());
    fireEvent.change(await screen.findByLabelText('Contributor summary (optional)'), { target: { value: edited.summary } });
    fireEvent.change(screen.getByLabelText('Unified diff (optional)'), { target: { value: edited.diffText } });
    fireEvent.change(screen.getByLabelText('Evidence 1 text'), { target: { value: 'Edited evidence' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add evidence' })); expect(screen.getByLabelText('Evidence 2 text')).toHaveFocus();
    save(); expect(screen.getByLabelText('Evidence 2 text')).toHaveFocus(); expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Evidence 2 text'), { target: { value: 'New evidence' } }); save(); await screen.findByText('Draft saved. Version 1.');
    const request = JSON.parse(fetch.mock.calls[1]![1].body);
    expect(request.content.criteria).toEqual(content.criteria); expect(request.content.evidence).toEqual([{ id: key, text: 'Edited evidence' }, { text: 'New evidence' }]);
    expect(request.content.summary).toBe(edited.summary); expect(request.content.diffText).toBe(edited.diffText);
    expect(fetch.mock.calls[1]![1].headers['x-csrf-token']).toBe(session.csrfToken);
    save(); await screen.findByText('Draft saved. Version 2.'); expect(JSON.parse(fetch.mock.calls[3]![1].body).content.evidence[1].id).toBe(addedId);
    fireEvent.click(screen.getByRole('button', { name: 'Remove evidence 2' })); expect(screen.getByLabelText('Evidence 1 text')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Remove evidence 1' })); expect(screen.getByRole('button', { name: 'Add evidence' })).toHaveFocus();
    expect(screen.getByText('No evidence added.')).toBeVisible();
  });
  it.each([['Contributor summary (optional)', 501], ['Unified diff (optional)', 100001], ['Evidence 1 text', 50001]] as const)('retains oversized Unicode and focuses %s', async (label, count) => {
    const fetch = vi.fn().mockResolvedValue(reply(detail)); vi.stubGlobal('fetch', fetch); render(tree());
    const field = await screen.findByLabelText(label); const text = '\u{1F600}'.repeat(count);
    fireEvent.change(field, { target: { value: text } }); save();
    expect(field).toHaveFocus(); expect(field).toHaveValue(text); expect(field).toHaveAttribute('aria-invalid', 'true'); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('focuses and describes the aggregate evidence limit without deleting entered items', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(detail)); vi.stubGlobal('fetch', fetch); render(tree());
    fireEvent.change(await screen.findByLabelText('Evidence 1 text'), { target: { value: 'x'.repeat(25000) } });
    fireEvent.click(screen.getByRole('button', { name: 'Add evidence' })); fireEvent.change(screen.getByLabelText('Evidence 2 text'), { target: { value: 'y'.repeat(25001) } }); save();
    expect(screen.getByLabelText('Evidence 1 text')).toHaveFocus(); expect(screen.getByText('Total evidence exceeds limit')).toBeVisible();
    expect(screen.getByLabelText('Evidence 2 text')).toHaveValue('y'.repeat(25001)); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([413, 422, 409, 500, 'network', 'read failure'] as const)('retains preparation input after %s and preserves safe recovery', async status => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail));
    if (status === 'network') fetch.mockRejectedValueOnce(new Error('network'));
    else if (status === 'read failure') fetch.mockResolvedValueOnce(reply(saved())).mockResolvedValueOnce(reply({}, 500));
    else fetch.mockResolvedValueOnce(reply({ correlationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, status));
    vi.stubGlobal('fetch', fetch); render(tree());
    fireEvent.change(await screen.findByLabelText('Contributor summary (optional)'), { target: { value: 'Retained summary' } });
    fireEvent.change(screen.getByLabelText('Unified diff (optional)'), { target: { value: '<script>inert patch</script>' } }); save();
    await screen.findByRole('alert'); expect(screen.getByLabelText('Contributor summary (optional)')).toHaveValue('Retained summary');
    expect(screen.getByLabelText('Unified diff (optional)')).toHaveValue('<script>inert patch</script>');
    if (status === 413) expect(screen.getByRole('alert')).toHaveTextContent('Request is too large. Reduce the draft text');
    if (status !== 413 && status !== 422) expect(screen.getByRole('button', { name: 'Save private draft' })).toBeDisabled();
  });
  it('keeps pending preparation text until explicit authorized recovery, including cancel and failed reload', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockRejectedValueOnce(new Error('lost')).mockResolvedValueOnce(reply({}, 500)).mockResolvedValueOnce(reply({ ...detail, version: 1 }));
    vi.stubGlobal('fetch', fetch); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); render(tree());
    fireEvent.change(await screen.findByLabelText('Contributor summary (optional)'), { target: { value: 'Keep until confirmed' } }); save(); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest draft and discard changes' })); expect(fetch).toHaveBeenCalledTimes(2);
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: 'Reload latest draft and discard changes' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3)); expect(screen.getByLabelText('Contributor summary (optional)')).toHaveValue('Keep until confirmed');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reload latest draft and discard changes' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest draft and discard changes' })); await waitFor(() => expect(screen.getByLabelText('Contributor summary (optional)')).toHaveValue(content.summary));
  });
  it('renders stored HTML, Markdown, patch and command-like content as inert detail text', async () => {
    const text = '<script>window.preparationExecuted=true</script>\n[link](https://invalid.example)\n$(touch forbidden)';
    const fetch = vi.fn().mockResolvedValue(reply({ ...detail, content: { ...content, summary: text, diffText: text, evidence: [{ id: key, text }] } }));
    vi.stubGlobal('fetch', fetch); render(tree(`/contributor/drafts/${id}`));
    await screen.findByText('Plain-text evidence'); expect(screen.getAllByText(text, { normalizer: value => value })).toHaveLength(3);
    expect(document.querySelector('script')).toBeNull(); expect(document.querySelector('a[href="https://invalid.example"]')).toBeNull(); expect(fetch).toHaveBeenCalledTimes(1);
  });
});
