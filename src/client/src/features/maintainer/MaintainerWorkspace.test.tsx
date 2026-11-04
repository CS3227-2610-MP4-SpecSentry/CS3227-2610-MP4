import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaintainerWorkspace } from './MaintainerWorkspace';

const timestamp = '2026-11-04T00:00:00.000Z';
const session = { account: { id: 'maintainer-one', username: 'maintainer', role: 'RELEASE_MAINTAINER' as const }, csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 100_000 };
const summary = { id: 'candidate-one', versionLabel: '1.0.0', status: 'OPEN' as const,
  createdById: session.account.id, createdAt: timestamp, publishedAt: null, version: 2, contentVersion: 1 };
const { createdAt: _createdAt, ...detailSummary } = summary;
void _createdAt;
const detail = { ...detailSummary, projectKey: 'specsentry', rollbackNote: '<script>rollback</script>',
  dependencyNotes: 'Database first', members: [], smokeTests: [],
  blockers: [{ code: 'EMPTY' as const }, { code: 'SMOKE' as const }], publishedAt: null };
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}

function enterCandidate(version = '2.0.0') {
  fireEvent.change(screen.getByLabelText('Semantic version'), { target: { value: version } });
  fireEvent.change(screen.getByLabelText('Rollback note'), { target: { value: 'Redeploy the previous digest.' } });
  fireEvent.change(screen.getByLabelText('Dependency notes (optional)'), { target: { value: 'Apply compatible migrations first.' } });
}

function setup(fetch: ReturnType<typeof vi.fn>, initial = '/releases', onSessionLost = vi.fn()) {
  vi.stubGlobal('fetch', fetch);
  return { onSessionLost, ...render(<MemoryRouter initialEntries={[initial]}><Routes>
    <Route path="/releases/*" element={<MaintainerWorkspace session={session} onSessionLost={onSessionLost} />} />
  </Routes></MemoryRouter>) };
}

afterEach(() => vi.unstubAllGlobals());

describe('Release Maintainer workspace foundation', () => {
  it('lists candidates, opens server-computed blockers and permits only owner edits', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({ items: [summary], nextCursor: null })).mockResolvedValueOnce(reply(detail));
    setup(fetch);
    expect(await screen.findByText(`Responsible Maintainer: ${session.account.id}`)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('link', { name: 'Open 1.0.0' }));
    expect(await screen.findByRole('heading', { name: 'Release 1.0.0' })).toBeInTheDocument();
    expect(screen.getByText(/Add at least one approved proposal/)).toBeInTheDocument();
    expect(screen.getByText(/Record a passing smoke test/)).toBeInTheDocument();
    expect(screen.getByLabelText('Rollback note')).toHaveValue('<script>rollback</script>');
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save candidate details' })).toBeEnabled();
  });

  it('validates and creates a candidate with CSRF before navigating to its detail', async () => {
    const created = { candidateId: 'candidate-new', version: 0, contentVersion: 0, status: 'OPEN' as const };
    const newDetail = { ...detail, id: created.candidateId, versionLabel: '2.0.0', version: 0, contentVersion: 0 };
    const fetch = vi.fn().mockResolvedValueOnce(reply({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(reply(created)).mockResolvedValueOnce(reply(newDetail));
    setup(fetch);
    await screen.findByText('No release candidates yet');
    fireEvent.click(screen.getByRole('button', { name: 'Create candidate' }));
    expect(screen.getByRole('alert')).toHaveTextContent('semantic version');
    expect(fetch).toHaveBeenCalledTimes(1);
    enterCandidate();
    fireEvent.click(screen.getByRole('button', { name: 'Create candidate' }));
    expect(await screen.findByRole('heading', { name: 'Release 2.0.0' })).toBeInTheDocument();
    expect(fetch.mock.calls[1]?.[0]).toBe('/api/release-candidates');
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', headers: { 'x-csrf-token': session.csrfToken } });
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body as string)).toEqual({ versionLabel: '2.0.0', rollbackNote: 'Redeploy the previous digest.', dependencyNotes: 'Apply compatible migrations first.' });
  });

  it('renders another Maintainer candidate read only', async () => {
    const other = { ...detail, createdById: 'maintainer-two' };
    setup(vi.fn().mockResolvedValue(reply(other)), '/releases/candidate-one');
    expect(await screen.findByRole('heading', { name: 'Release 1.0.0' })).toBeInTheDocument();
    expect(screen.getByText(/another Release Maintainer created it/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save candidate details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record smoke test' })).not.toBeInTheDocument();
  });

  it.each(['PASS', 'FAIL'] as const)('records an owner %s smoke test with CSRF and exact optimistic versions', async outcome => {
    const recorded = { ...detail, version: detail.version + 1, smokeTests: [{ id: `smoke-${outcome}`,
      testedContentVersion: detail.contentVersion, outcome, procedure: '<script>run checks</script>',
      results: 'Observed text only', actorId: session.account.id, createdAt: timestamp }],
      blockers: outcome === 'PASS' ? [{ code: 'EMPTY' as const }] : detail.blockers };
    const command = { candidateId: detail.id, version: recorded.version, contentVersion: detail.contentVersion, status: 'OPEN' as const };
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockResolvedValueOnce(reply(command)).mockResolvedValueOnce(reply(recorded));
    setup(fetch, '/releases/candidate-one');
    fireEvent.change(await screen.findByLabelText('Procedure'), { target: { value: '<script>run checks</script>' } });
    fireEvent.change(screen.getByLabelText('Results'), { target: { value: 'Observed text only' } });
    fireEvent.change(screen.getByLabelText('Outcome'), { target: { value: outcome } });
    fireEvent.click(screen.getByRole('button', { name: 'Record smoke test' }));
    expect(await screen.findByText(`Observed text only`)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(fetch.mock.calls[1]?.[0]).toBe('/api/release-candidates/candidate-one/smoke-tests');
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken } });
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body as string)).toEqual({ expectedVersion: detail.version,
      testedContentVersion: detail.contentVersion, procedure: '<script>run checks</script>',
      results: 'Observed text only', outcome });
    if (outcome === 'FAIL') expect(screen.getByText(/Record a passing smoke test/)).toBeInTheDocument();
  });

  it('rejects blank and oversized smoke-test text without a request', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail));
    setup(fetch, '/releases/candidate-one');
    await screen.findByRole('button', { name: 'Record smoke test' });
    fireEvent.click(screen.getByRole('button', { name: 'Record smoke test' }));
    expect(screen.getByRole('alert')).toHaveTextContent('non-empty procedure and result');
    fireEvent.change(screen.getByLabelText('Procedure'), { target: { value: 'x'.repeat(10_001) } });
    fireEvent.change(screen.getByLabelText('Results'), { target: { value: 'Passed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record smoke test' }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps an old PASS visible while the server blocks the newer content version', async () => {
    const changed = { ...detail, contentVersion: 2, smokeTests: [{ id: 'old-smoke', testedContentVersion: 1,
      outcome: 'PASS' as const, procedure: 'Test old contents', results: 'Passed old contents',
      actorId: session.account.id, createdAt: timestamp }] };
    setup(vi.fn().mockResolvedValue(reply(changed)), '/releases/candidate-one');
    expect(await screen.findByText((_, element) => element?.tagName === 'LI' &&
      element.textContent?.includes('PASS for content version 1') === true)).toBeInTheDocument();
    expect(screen.getByText(/Record a passing smoke test for the current candidate contents/)).toBeInTheDocument();
    expect(screen.getByText(/Record the checks run against content version 2/)).toBeInTheDocument();
  });

  it('requires authoritative refresh after a stale smoke-test response and locks both mutations', async () => {
    const refreshed = { ...detail, version: detail.version + 1, contentVersion: detail.contentVersion + 1 };
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockResolvedValueOnce(reply({}, 409)).mockResolvedValueOnce(reply(refreshed));
    setup(fetch, '/releases/candidate-one');
    fireEvent.change(await screen.findByLabelText('Procedure'), { target: { value: 'Run checks' } });
    fireEvent.change(screen.getByLabelText('Results'), { target: { value: 'Passed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record smoke test' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('changed. Refresh');
    expect(screen.getByRole('button', { name: 'Save candidate details' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Record smoke test' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh candidate before editing' }));
    expect(await screen.findByText(/Record the checks run against content version 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record smoke test' })).toBeEnabled();
  });

  it('requires refresh after an uncertain smoke result and ignores its late response after unmount', async () => {
    const uncertainFetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockRejectedValueOnce(new TypeError('connection interrupted'));
    const uncertainView = setup(uncertainFetch, '/releases/candidate-one');
    fireEvent.change(await screen.findByLabelText('Procedure'), { target: { value: 'Run checks' } });
    fireEvent.change(screen.getByLabelText('Results'), { target: { value: 'Passed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record smoke test' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('may be uncertain');
    expect(screen.getByRole('button', { name: 'Record smoke test' })).toBeDisabled();
    uncertainView.unmount();

    vi.unstubAllGlobals();
    const pending = deferred<ReturnType<typeof reply>>();
    const onSessionLost = vi.fn();
    const view = setup(vi.fn().mockResolvedValueOnce(reply(detail)).mockImplementationOnce(() => pending.promise),
      '/releases/candidate-one', onSessionLost);
    fireEvent.change(await screen.findByLabelText('Procedure'), { target: { value: 'Run checks' } });
    fireEvent.change(screen.getByLabelText('Results'), { target: { value: 'Passed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record smoke test' }));
    view.unmount();
    await act(async () => { pending.resolve(reply({}, 401)); await pending.promise; });
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it('hides smoke-test controls for a released candidate', async () => {
    setup(vi.fn().mockResolvedValue(reply({ ...detail, status: 'RELEASED' as const })), '/releases/candidate-one');
    expect(await screen.findByRole('heading', { name: 'Release 1.0.0' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record smoke test' })).not.toBeInTheDocument();
  });

  it('requires refresh after stale edits and sends the current optimistic version', async () => {
    const refreshed = { ...detail, version: detail.version + 1, dependencyNotes: 'Changed by another request' };
    const fetch = vi.fn().mockResolvedValueOnce(reply(detail)).mockResolvedValueOnce(reply({}, 409)).mockResolvedValueOnce(reply(refreshed));
    setup(fetch, '/releases/candidate-one');
    fireEvent.change(await screen.findByLabelText('Dependency notes'), { target: { value: 'Updated dependencies' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save candidate details' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('changed. Refresh');
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body as string)).toMatchObject({ expectedVersion: detail.version, dependencyNotes: 'Updated dependencies' });
    expect(screen.getByRole('button', { name: 'Save candidate details' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh candidate before editing' }));
    expect(await screen.findByDisplayValue('Changed by another request')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save candidate details' })).toBeEnabled();
  });

  it('keeps create locked until an uncertain result is successfully reconciled', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({ items: [], nextCursor: null }))
      .mockRejectedValueOnce(new TypeError('connection interrupted')).mockResolvedValueOnce(reply({}, 500));
    setup(fetch);
    await screen.findByText('No release candidates yet');
    enterCandidate();
    fireEvent.click(screen.getByRole('button', { name: 'Create candidate' }));
    expect(await screen.findByText(/candidate may already have been created/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh candidate list' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load release candidates');
    expect(screen.getByRole('button', { name: 'Create candidate' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh candidate list' })).toBeEnabled();
  });

  it('prevents an older list request from overlapping candidate creation', async () => {
    const pending = deferred<ReturnType<typeof reply>>();
    setup(vi.fn().mockImplementationOnce(() => pending.promise));
    expect(screen.getByRole('button', { name: 'Create candidate' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeDisabled();
    await act(async () => { pending.resolve(reply({ items: [], nextCursor: null })); await pending.promise; });
    expect(await screen.findByRole('button', { name: 'Create candidate' })).toBeEnabled();
  });

  it('ignores an old mutation response after the workspace unmounts', async () => {
    const pending = deferred<ReturnType<typeof reply>>();
    const fetch = vi.fn().mockResolvedValueOnce(reply({ items: [], nextCursor: null }))
      .mockImplementationOnce(() => pending.promise);
    const onSessionLost = vi.fn();
    const view = setup(fetch, '/releases', onSessionLost);
    await screen.findByText('No release candidates yet');
    enterCandidate();
    fireEvent.click(screen.getByRole('button', { name: 'Create candidate' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    view.unmount();
    await act(async () => { pending.resolve(reply({}, 401)); await pending.promise; });
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it('clears candidate content and reports current-session expiry', async () => {
    const onSessionLost = vi.fn();
    setup(vi.fn().mockResolvedValue(reply({}, 401)), '/releases/candidate-one', onSessionLost);
    await waitFor(() => expect(onSessionLost).toHaveBeenCalledOnce());
    expect(screen.queryByText('<script>rollback</script>')).not.toBeInTheDocument();
  });
});
