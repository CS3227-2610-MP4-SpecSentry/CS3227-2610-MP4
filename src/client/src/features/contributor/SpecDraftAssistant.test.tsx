import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SpecDraftAssistant } from './SpecDraftAssistant';

const session = { account: { id: 'owner', username: 'owner', role: 'CONTRIBUTOR' as const }, csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 60000 };
const content = { title: 'Title', summary: '', problem: 'Problem', constraints: 'Original constraints', expectedBehavior: 'Original expected behavior',
  diffText: '', criteria: [{ stableKey: 'old-key', statement: 'Original criterion', required: false }], evidence: [] };
const response = { analyzedScope: { proposalId: 'p', workingRevisionId: 'w', expectedVersion: 3 }, result: {
  objective: '<script>Suggested objective</script>', acceptanceCriteria: ['First suggested criterion', 'Second suggested criterion'],
  edgeCases: ['An edge case'], ambiguities: ['An ambiguity'], testIdeas: ['A test idea'],
} };
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const props = { proposalId: 'p', workingRevisionId: 'w', version: 3, content, disabled: false, session, onSessionLost: vi.fn(), onApply: vi.fn() };
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('starts with no selections and applies only explicitly selected suggestions to an unsaved copy', async () => {
  const fetch = vi.fn().mockResolvedValue(reply(response)); vi.stubGlobal('fetch', fetch); render(<SpecDraftAssistant {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Generate draft suggestions' })); await screen.findByRole('heading', { name: 'Select suggestions to apply' });
  expect(props.onApply).not.toHaveBeenCalled(); expect(screen.getAllByRole('checkbox').every(checkbox => !(checkbox as HTMLInputElement).checked)).toBe(true);
  expect(screen.getByRole('button', { name: 'Apply selected suggestions to editor' })).toBeDisabled();
  expect(document.querySelector('script')).toBeNull();
  fireEvent.click(screen.getByLabelText('Replace expected behavior: <script>Suggested objective</script>'));
  fireEvent.click(screen.getByLabelText('Add a new required criterion: First suggested criterion'));
  fireEvent.click(screen.getByLabelText('Append to constraints (Edge case): An edge case'));
  fireEvent.click(screen.getByRole('button', { name: 'Apply selected suggestions to editor' }));
  expect(props.onApply).toHaveBeenCalledExactlyOnceWith({ ...content, expectedBehavior: response.result.objective,
    constraints: 'Original constraints\nEdge case: An edge case', criteria: [...content.criteria, { statement: 'First suggested criterion', required: true }] });
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/proposals/p/ai/draft', expect.objectContaining({ method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken }, body: JSON.stringify({ expectedVersion: 3, workingRevisionId: 'w' }) }));
  expect(screen.queryByRole('heading', { name: 'Select suggestions to apply' })).not.toBeInTheDocument();
});

it.each([503, 429, 422, 409])('keeps the manual draft unchanged when the assistant returns HTTP %s', async status => {
  const correlationId = '12345678-1234-4234-8234-123456789abc';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ correlationId, message: 'synthetic-provider-private-body' }, status))); render(<SpecDraftAssistant {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Generate draft suggestions' })); await screen.findByRole('status');
  expect(screen.getByRole('status')).toHaveTextContent(`Reference: ${correlationId}`);
  expect(props.onApply).not.toHaveBeenCalled(); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByText('synthetic-provider-private-body')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Generate draft suggestions' })).toBeEnabled();
});

it('does not render an untrusted error reference and ignores deferred error JSON after unmount', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ correlationId: '<script>secret-provider-body</script>', message: 'secret-provider-body' }, 503)));
  const view = render(<SpecDraftAssistant {...props} />); fireEvent.click(screen.getByRole('button', { name: 'Generate draft suggestions' }));
  await screen.findByText(/Reference unavailable/); expect(screen.queryByText(/secret-provider-body/)).not.toBeInTheDocument();
  let resolve!: (body: unknown) => void; const held = new Promise(value => { resolve = value; });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => held }));
  fireEvent.click(screen.getByRole('button', { name: 'Generate draft suggestions' })); await act(async () => { await Promise.resolve(); }); view.unmount();
  await act(async () => { resolve({ correlationId: '12345678-1234-4234-8234-123456789abc' }); await held; }); expect(props.onApply).not.toHaveBeenCalled();
});

it.each(['unknown output field', 'wrong scope'])('rejects %s without exposing or applying it', async mode => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(mode === 'wrong scope' ? { ...response, analyzedScope: { ...response.analyzedScope, expectedVersion: 2 } }
    : { ...response, result: { ...response.result, submit: true } }))); render(<SpecDraftAssistant {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Generate draft suggestions' })); await screen.findByText(/could not return a valid suggestion/);
  expect(props.onApply).not.toHaveBeenCalled(); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

it('invalidates late JSON when manual edits make the saved version stale and prevents duplicate generation', async () => {
  let resolve!: (body: unknown) => void; const held = new Promise(value => { resolve = value; });
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => held }); vi.stubGlobal('fetch', fetch);
  const view = render(<SpecDraftAssistant {...props} />); fireEvent.click(screen.getByRole('button', { name: 'Generate draft suggestions' }));
  fireEvent.click(screen.getByRole('button', { name: 'Generating suggestions...' })); expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => { await Promise.resolve(); });
  view.rerender(<SpecDraftAssistant {...props} disabled content={{ ...content, problem: 'Unsaved manual change' }} />);
  await act(async () => { resolve(response); await held; });
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(props.onApply).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Generate draft suggestions' })).toBeDisabled();
  expect((fetch.mock.calls[0]![1] as { signal: AbortSignal }).signal.aborted).toBe(true);
});

it('clears transient suggestions on pagehide and ignores a late response after unmount', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(response))); const view = render(<SpecDraftAssistant {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Generate draft suggestions' })); await screen.findByRole('checkbox', { name: /Replace expected behavior/ });
  fireEvent(window, new Event('pagehide')); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  let resolve!: (body: unknown) => void; const held = new Promise(value => { resolve = value; });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => held }));
  fireEvent.click(screen.getByRole('button', { name: 'Generate draft suggestions' })); await act(async () => { await Promise.resolve(); }); view.unmount();
  await act(async () => { resolve(response); await held; }); expect(props.onApply).not.toHaveBeenCalled();
});

it.each(['criteria', 'constraints'])('rejects an oversized %s application atomically', async field => {
  const oversized = field === 'criteria' ? { ...content, criteria: Array.from({ length: 50 }, (_, index) => ({ stableKey: `key-${index}`, statement: `Existing ${index}`, required: true })) }
    : { ...content, constraints: 'x'.repeat(10000) };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(response))); render(<SpecDraftAssistant {...props} content={oversized} />);
  fireEvent.click(screen.getByRole('button', { name: 'Generate draft suggestions' })); await screen.findByRole('checkbox', { name: /Replace expected behavior/ });
  fireEvent.click(screen.getByLabelText('Replace expected behavior: <script>Suggested objective</script>'));
  fireEvent.click(screen.getByLabelText(field === 'criteria' ? 'Add a new required criterion: First suggested criterion' : 'Append to constraints (Edge case): An edge case'));
  fireEvent.click(screen.getByRole('button', { name: 'Apply selected suggestions to editor' }));
  expect(screen.getByText(/Nothing was applied/)).toBeInTheDocument(); expect(props.onApply).not.toHaveBeenCalled();
});

it('reports unavailable token usage honestly and separates application SGT limits from provider UTC spend windows', async () => {
  const usage = { window: 'SGT_DAY', startedAt: '2026-10-31T16:00:00.000Z', resetsAt: '2026-11-01T16:00:00.000Z', requests: 3, attempts: 2, retries: 1,
    completedAttempts: 2, failedAttempts: 1, preflightRejections: 1, failureRate: 0.5,
    usage: { promptTokens: null, completionTokens: null, totalTokens: null, cachedTokens: null }, usageReportedAttempts: 0, applicationCache: 'DISABLED', providerSpendWindow: 'UTC; separate from application quota' };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(usage))); render(<SpecDraftAssistant {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh my AI resource use' })); await screen.findByText('3 / 2 / 1');
  expect(screen.getByText('0 of 2 outbound attempts')).toBeInTheDocument(); expect(screen.getAllByText('Unknown')).toHaveLength(4);
  expect(screen.getByText('50.0%')).toBeInTheDocument(); expect(screen.getByText(/Singapore midnight \(SGT\).*UTC/)).toBeInTheDocument();
});

it('signals lost authorization without showing suggestion output', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({}, 403))); render(<SpecDraftAssistant {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Generate draft suggestions' })); await waitFor(() => expect(props.onSessionLost).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

it('labels a zero-denominator failure rate N/A while absent provider counters stay unknown', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ window: 'SGT_DAY', startedAt: '2026-10-31T16:00:00.000Z', resetsAt: '2026-11-01T16:00:00.000Z',
    requests: 0, attempts: 0, retries: 0, completedAttempts: 0, failedAttempts: 0, preflightRejections: 0, failureRate: null,
    usage: { promptTokens: null, completionTokens: null, totalTokens: null, cachedTokens: null }, usageReportedAttempts: 0,
    applicationCache: 'DISABLED', providerSpendWindow: 'UTC; separate from application quota' })));
  render(<SpecDraftAssistant {...props} />); fireEvent.click(screen.getByRole('button', { name: 'Refresh my AI resource use' }));
  await screen.findByText('N/A (no completed attempts)'); expect(screen.getAllByText('Unknown')).toHaveLength(4);
});
