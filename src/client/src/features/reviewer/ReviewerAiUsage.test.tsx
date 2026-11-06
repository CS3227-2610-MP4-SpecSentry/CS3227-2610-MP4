import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewerWorkspace } from './ReviewerWorkspace';

const usage = { window: 'SGT_DAY', startedAt: '2026-11-04T16:00:00.000Z', resetsAt: '2026-11-05T16:00:00.000Z',
  requests: 3, attempts: 4, retries: 1, completedAttempts: 3, failedAttempts: 1, preflightRejections: 1, failureRate: 1 / 3,
  usage: { promptTokens: 0, completionTokens: 20, totalTokens: null, cachedTokens: null }, usageReportedAttempts: 2,
  applicationCache: 'DISABLED', providerSpendWindow: 'UTC; separate from application quota' };
const session = { account: { id: 'r', username: 'reviewer', role: 'REVIEWER' as const }, csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 600000 };
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
function fixture() {
  let generation = 0;
  const authorization = { current: () => generation, invalidate: () => { generation++; } };
  const usageFetch = vi.fn().mockResolvedValue(reply(usage));
  const poolFetch = vi.fn().mockResolvedValue(reply({ items: [], nextCursor: null }));
  const fetch = vi.fn((url: string) => url.endsWith('/reviews/ai/usage') ? usageFetch() : url.includes('review-pool') ? poolFetch() : Promise.resolve(reply({ items: [], nextCursor: null })));
  vi.stubGlobal('fetch', fetch);
  const onUnauthorized = vi.fn();
  const view = render(<ReviewerWorkspace session={session} authorization={authorization} onUnauthorized={onUnauthorized} />);
  const panel = () => within(screen.getByRole('region', { name: 'My Reviewer AI usage' }));
  async function show() { fireEvent.click(panel().getByRole('button', { name: 'Show my AI usage' })); await panel().findByText('Provider total tokens'); }
  async function loseAccess() {
    poolFetch.mockResolvedValue(reply({}, 403)); fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByText(/Access to this proposal is no longer available/);
  }
  return { ...view, usageFetch, fetch, panel, show, loseAccess, authorization, onUnauthorized };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Reviewer usage', () => {
  it('is reachable without an assignment and labels Reviewer-only accounting, SGT/UTC, unknown usage, real zero and outbound failures', async () => {
    const f = fixture(); expect(f.usageFetch).not.toHaveBeenCalled(); await f.show();
    expect(f.panel().getByText(/Only your Reviewer feature usage/)).toBeVisible();
    expect(f.panel().getByText(/SGT day:/)).toBeVisible(); expect(f.panel().getByText('UTC; separate from application quota')).toBeVisible();
    expect(f.panel().getByText('33.3%')).toBeVisible(); expect(f.panel().getAllByText('Unknown')).toHaveLength(2);
    expect(f.panel().getByText('0')).toBeVisible(); expect(f.panel().getByText('Disabled')).toBeVisible();
    expect(f.fetch.mock.calls.find(([url]) => url === '/api/reviews/ai/usage')).toBeDefined();
    const options = vi.mocked(global.fetch).mock.calls.find(([url]) => url === '/api/reviews/ai/usage')![1];
    expect(options).toMatchObject({ credentials: 'same-origin', cache: 'no-store' });
  });

  it('shows an empty day with N/A denominator and a safe refresh error while the review queue remains usable', async () => {
    const f = fixture(); f.usageFetch.mockResolvedValue(reply({ ...usage, requests: 0, attempts: 0, retries: 0, completedAttempts: 0, failedAttempts: 0, failureRate: null }));
    await f.show(); expect(f.panel().getByText('No Reviewer AI activity in this SGT day.')).toBeVisible();
    expect(f.panel().getByText('N/A — no completed outbound attempts')).toBeVisible();
    f.usageFetch.mockResolvedValue(reply({}, 503)); fireEvent.click(f.panel().getByRole('button', { name: 'Refresh AI usage' }));
    expect(await f.panel().findByText('AI usage is unavailable. You can continue manual review and refresh later.')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: 'My assignments' })).toBeEnabled(); expect(f.panel().queryByText('Provider total tokens')).not.toBeInTheDocument();
    f.usageFetch.mockResolvedValue(reply(usage)); fireEvent.click(f.panel().getByRole('button', { name: 'Refresh AI usage' }));
    await f.panel().findByText('Provider total tokens');
  });

  it('actively clears already-visible aggregates when another workspace request loses access, with no usage fetch pending', async () => {
    const f = fixture(); await f.show(); await f.loseAccess();
    expect(f.panel().queryByText('Provider total tokens')).not.toBeInTheDocument(); expect(f.usageFetch).toHaveBeenCalledTimes(1);
    expect(f.panel().getByRole('button', { name: 'Show my AI usage' })).toHaveAttribute('aria-expanded', 'false');
    f.usageFetch.mockResolvedValue(reply(usage)); await f.show(); expect(f.usageFetch).toHaveBeenCalledTimes(2);
  });

  it.each(['fetch', 'body'] as const)('discards late %s completion after access loss', async stage => {
    const f = fixture(); const held = deferred<unknown>();
    f.usageFetch.mockImplementation(() => stage === 'fetch' ? held.promise : Promise.resolve({ ok: true, status: 200, json: () => held.promise }));
    fireEvent.click(f.panel().getByRole('button', { name: 'Show my AI usage' })); await waitFor(() => expect(f.usageFetch).toHaveBeenCalledTimes(1));
    await f.loseAccess(); await act(async () => { held.resolve(stage === 'fetch' ? reply(usage) : usage); });
    expect(f.panel().queryByText('Provider total tokens')).not.toBeInTheDocument();
  });

  it.each(['fetch', 'body'] as const)('erases %s results when completion wins just before access loss', async stage => {
    const f = fixture(); const held = deferred<unknown>();
    f.usageFetch.mockImplementation(() => stage === 'fetch' ? held.promise : Promise.resolve({ ok: true, status: 200, json: () => held.promise }));
    fireEvent.click(f.panel().getByRole('button', { name: 'Show my AI usage' }));
    await act(async () => { held.resolve(stage === 'fetch' ? reply(usage) : usage); }); await f.panel().findByText('Provider total tokens');
    await f.loseAccess(); expect(f.panel().queryByText('Provider total tokens')).not.toBeInTheDocument();
  });

  it('clears on pagehide and genuine pageshow requires a fresh authorized read, without browser storage', async () => {
    const f = fixture(); await f.show();
    act(() => { window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('pageshow')); });
    expect(f.panel().queryByText('Provider total tokens')).not.toBeInTheDocument(); expect(f.usageFetch).toHaveBeenCalledTimes(1);
    await f.show(); expect(f.usageFetch).toHaveBeenCalledTimes(2);
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('promptTokens');
  });

  it('withholds late data after account replacement and unmount', async () => {
    const f = fixture(); const held = deferred<unknown>(); f.usageFetch.mockImplementationOnce(() => held.promise);
    fireEvent.click(f.panel().getByRole('button', { name: 'Show my AI usage' }));
    f.rerender(<ReviewerWorkspace key="new-account" session={{ ...session, account: { ...session.account, id: 'other' } }} authorization={f.authorization} onUnauthorized={f.onUnauthorized} />);
    await act(async () => { held.resolve(reply(usage)); }); expect(f.panel().queryByText('Provider total tokens')).not.toBeInTheDocument();
    f.unmount(); expect(screen.queryByRole('region', { name: 'My Reviewer AI usage' })).not.toBeInTheDocument();
  });

  it.each([401, 403])('clears on usage authorization denial %s and requests the existing session recovery path', async status => {
    const f = fixture(); f.usageFetch.mockResolvedValue(reply({}, status));
    fireEvent.click(f.panel().getByRole('button', { name: 'Show my AI usage' })); await waitFor(() => expect(f.onUnauthorized).toHaveBeenCalled());
    expect(f.panel().queryByText('Provider total tokens')).not.toBeInTheDocument();
  });

  it('clears visible usage at session expiry', async () => {
    const f = fixture(); await f.show(); vi.useFakeTimers();
    f.rerender(<ReviewerWorkspace session={{ ...session, expiresAt: Date.now() + 10 }} authorization={f.authorization} onUnauthorized={f.onUnauthorized} />);
    act(() => { vi.advanceTimersByTime(11); });
    expect(f.panel().queryByText('Provider total tokens')).not.toBeInTheDocument();
  });
});
