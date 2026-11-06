import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaintainerAiUsage, ReleaseGateAssistant } from './ReleaseGateAssistant';

const timestamp = '2026-11-06T00:00:00.000Z';
const session = { account: { id: 'maintainer-one', username: 'maintainer', role: 'RELEASE_MAINTAINER' as const },
  csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 100_000 };
const detail = { id: 'candidate-one', projectKey: 'specsentry', createdById: session.account.id,
  status: 'OPEN' as const, versionLabel: '1.0.0', rollbackNote: 'Restore previous image', dependencyNotes: '',
  version: 3, contentVersion: 1, members: [], smokeTests: [], smokeTestsTruncated: false,
  blockers: [{ code: 'EMPTY' as const }],
  publishedAt: null, publication: null, unreadRevocationNotices: [], unreadRevocationNoticesTruncated: false };
const result = { blockers: [{ itemIds: [], description: '<script>Candidate is empty</script>' }],
  dependencies: [], releaseNotes: ['Document the release'], rollbackConsiderations: ['Verify restore steps'],
  readinessRecommendation: 'NOT_READY' as const, confidence: 'HIGH' as const };
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Release Gate Assistant', () => {
  it('sends exact candidate coordinates with CSRF and renders advisory output only as text', async () => {
    const fetch = vi.fn().mockResolvedValue(reply({ status: 'CURRENT', staleReason: null,
      analyzedScope: { candidateId: detail.id, expectedVersion: detail.version,
        expectedContentVersion: detail.contentVersion, candidateItemCount: 0 }, result }));
    vi.stubGlobal('fetch', fetch);
    render(<ReleaseGateAssistant detail={detail} disabled={false} session={session} onSessionLost={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate advisory readiness summary' }));
    expect(await screen.findByText('<script>Candidate is empty</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', headers: { 'x-csrf-token': session.csrfToken } });
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body as string)).toEqual({ expectedVersion: detail.version,
      expectedContentVersion: detail.contentVersion });
    expect(screen.getByText(/cannot clear deterministic blockers/)).toBeInTheDocument();
  });

  it('discards a stale result and leaves the manual workflow available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ status: 'STALE', staleReason: 'CANDIDATE_CHANGED',
      analyzedScope: { candidateId: detail.id, expectedVersion: detail.version,
        expectedContentVersion: detail.contentVersion, candidateItemCount: 0 }, result })));
    render(<ReleaseGateAssistant detail={detail} disabled={false} session={session} onSessionLost={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate advisory readiness summary' }));
    expect(await screen.findByText(/output was discarded/)).toBeInTheDocument();
    expect(screen.queryByText(/Recommendation:/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate advisory readiness summary' })).toBeEnabled();
  });

  it('aborts a pending request and releases the parent mutation lock when its scope unmounts', async () => {
    let signal: AbortSignal | undefined;
    let resolve!: (value: ReturnType<typeof reply>) => void;
    const pending = new Promise<ReturnType<typeof reply>>(accept => { resolve = accept; });
    vi.stubGlobal('fetch', vi.fn((_input: unknown, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return pending;
    }));
    const onBusyChange = vi.fn();
    const onSessionLost = vi.fn();
    const view = render(<ReleaseGateAssistant detail={detail} disabled={false} session={session}
      onSessionLost={onSessionLost} onBusyChange={onBusyChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate advisory readiness summary' }));
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));
    view.unmount();
    expect(signal?.aborted).toBe(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    await act(async () => { resolve(reply({}, 401)); await pending; });
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it('shows only aggregate project usage and clears on session loss', async () => {
    const usage = { window: 'SGT_DAY', startedAt: timestamp, resetsAt: '2026-11-07T00:00:00.000Z',
      requests: 4, attempts: 3, retries: 1, completedAttempts: 3, failedAttempts: 1,
      preflightRejections: 1, failureRate: 1 / 3,
      usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120, cachedTokens: null },
      usageReportedAttempts: 2, applicationCache: 'DISABLED', providerSpendWindow: 'UTC; separate from application quota' };
    const fetch = vi.fn().mockResolvedValueOnce(reply(usage)).mockResolvedValueOnce(reply({}, 401));
    vi.stubGlobal('fetch', fetch);
    const onSessionLost = vi.fn();
    const view = render(<MaintainerAiUsage session={session} onSessionLost={onSessionLost} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh project AI resource use' }));
    expect(await screen.findByText('4 / 3 / 1')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('reviewer-one');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh project AI resource use' }));
    await waitFor(() => expect(onSessionLost).toHaveBeenCalledOnce());
    expect(view.queryByText('4 / 3 / 1')).not.toBeInTheDocument();
  });
});
