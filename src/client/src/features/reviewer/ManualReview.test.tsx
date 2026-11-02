import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { findingResponsesResponseSchema, type HumanReviewResponse, type ProposalDetailResponse } from '@specsentry/shared';
import { ManualReview } from './ManualReview';
const timestamp = '2026-10-01T00:00:00.000Z';
const detail: ProposalDetailResponse = { hasUnreadLatestRevision: false, revisionNotice: null, id: 'p', version: 3, title: 'Example', author: { id: 'a', username: 'author' }, firstSubmittedAt: timestamp, latestSubmittedAt: timestamp, state: 'IN_REVIEW', assignment: { id: 'assignment', version: 2, revisionId: 'revision', reviewer: { id: 'r', username: 'reviewer' } }, revision: { id: 'revision', number: 1, summary: 'Summary', problem: 'Problem', expectedBehavior: 'Expected', constraints: '', diffText: '', submittedAt: timestamp, criteria: [{ id: 'c', stableKey: 'AC1', statement: 'Required behavior', required: true }], evidence: [], criterionEvidenceLinks: [] } };
const review: HumanReviewResponse = { proposalId: 'p', revisionId: 'revision', version: 3, assignmentId: 'assignment', assignmentVersion: 2, editable: true, coverage: [], approvalBlockers: [{ code: 'MISSING_ASSESSMENT', criterionId: 'c' }] };
const scope = { expectedVersion: 3, revisionId: 'revision', assignmentId: 'assignment', expectedAssignmentVersion: 2 };
const coverage = { id: 'coverage', proposalId: 'p', revisionId: 'revision', assignmentId: 'old-assignment', criterionId: 'c', actor: { id: 'prior', username: 'Prior reviewer' }, status: 'COVERED' as const, rationale: null, evidenceIds: [], sourceCoverageId: null, mutationVersion: 1, createdAt: timestamp };
function setup(options: { review?: HumanReviewResponse; findings?: unknown; stale?: boolean; detail?: ProposalDetailResponse; write?: () => Promise<unknown>; read?: (url: string) => unknown } = {}) {
  const onChanged = vi.fn(); const onRefresh = vi.fn();
  const request = vi.fn(async (url: string, _schema: unknown, body?: unknown, _method?: string, _key?: string) => {
    // Retain transport arguments in the spy signature for retry assertions.
    void _method; void _key;
    if (body !== undefined) return options.write ? options.write() : {};
    const override = options.read?.(url); if (override !== undefined) return override;
    if (url.includes('/review?')) return options.review ?? review;
    if (url.endsWith('/findings')) return options.findings ?? { items: [], nextCursor: null };
    return { items: [], nextCursor: null };
  });
  const props = { detail: options.detail ?? detail, stale: options.stale ?? false, busy: false, request: request as never, onChanged, onRefresh, onBusy: vi.fn() };
  const view = render(<ManualReview {...props} />);
  return { ...view, request, onChanged, onRefresh, props };
}
async function loaded() { await waitFor(() => expect(screen.queryByText('Loading assessments and findings…')).not.toBeInTheDocument()); }
describe('Manual review', () => {
  it('saves covered without evidence and validates rationale before partial coverage', async () => {
    const { request, onChanged } = setup(); await loaded();
    const form = screen.getByRole('form', { name: 'Assess AC1' });
    fireEvent.change(within(form).getByLabelText('Status'), { target: { value: 'PARTIALLY_COVERED' } }); fireEvent.submit(form);
    expect(screen.getByRole('alert')).toHaveTextContent('Check the form');
    expect(request.mock.calls.filter(call => call[2])).toHaveLength(0);
    fireEvent.change(within(form).getByLabelText('Status'), { target: { value: 'COVERED' } }); fireEvent.submit(form);
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('Criterion assessment saved.'));
    expect(request.mock.calls.find(call => call[2])).toEqual(['/api/proposals/p/coverage/c', expect.anything(), { ...scope, operation: 'ASSESS', status: 'COVERED', evidenceIds: [] }, 'PUT', undefined]);
  });
  it('confirms inherited assessments individually with their source and current scope', async () => {
    const { request } = setup({ review: { ...review, coverage: [{ ...coverage, confirmed: false }], approvalBlockers: [{ code: 'UNCONFIRMED_ASSESSMENT', criterionId: 'c' }] } }); await loaded();
    expect(screen.getByText(/Prior reviewer/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm AC1 assessment' }));
    await waitFor(() => expect(request.mock.calls.find(call => call[2])?.[2]).toEqual({ ...scope, operation: 'CONFIRM', sourceCoverageId: 'coverage' }));
  });
  it('requires request-changes note when there are no findings and shows deterministic blockers', async () => {
    const { request } = setup(); await loaded();
    expect(screen.getByRole('list', { name: 'Approval blockers' })).toHaveTextContent('Criterion has no assessment: c');
    expect(screen.getByRole('option', { name: 'Approve' })).toBeDisabled();
    const form = screen.getByRole('form', { name: 'Review decision' }); fireEvent.submit(form);
    expect(screen.getByRole('alert')).toHaveTextContent('requires a finding or an explanatory note');
    fireEvent.change(screen.getByLabelText('Decision note'), { target: { value: 'Please fix this behavior' } }); fireEvent.submit(form);
    await waitFor(() => expect(request.mock.calls.find(call => call[2])?.[2]).toEqual({ ...scope, decision: 'REQUEST_CHANGES', note: 'Please fix this behavior' }));
  });
  it('keeps the exact decision body and idempotency key after an uncertain network outcome', async () => {
    const { request } = setup({ review: { ...review, approvalBlockers: [] }, write: async () => { throw new TypeError('Network error'); } }); await loaded();
    fireEvent.change(screen.getByLabelText('Decision'), { target: { value: 'APPROVE' } }); fireEvent.submit(screen.getByRole('form', { name: 'Review decision' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retry same decision' }));
    await waitFor(() => expect(request.mock.calls.filter(call => call[2])).toHaveLength(2));
    const writes = request.mock.calls.filter(call => call[2]);
    expect(writes[0]).toEqual(writes[1]); expect(writes[0]![4]).toEqual(expect.any(String));
  });
  it('preserves unsaved text on focus staleness and freezes until explicit reconciliation', async () => {
    const { rerender, props, request, onRefresh } = setup(); await loaded();
    fireEvent.change(screen.getByLabelText('Decision note'), { target: { value: 'Old revision note' } });
    rerender(<ManualReview {...props} stale />);
    expect(screen.getByLabelText('Decision note')).toHaveValue('Old revision note'); expect(screen.getByRole('button', { name: 'Submit decision' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('form', { name: 'Review decision' })); expect(request.mock.calls.filter(call => call[2])).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh review and discard unsaved edits' })); expect(onRefresh).toHaveBeenCalledOnce();
  });
  it('freezes retained forms after a conflict without silently refreshing their scope', async () => {
    const { request, onChanged } = setup({ write: async () => { throw { status: 409 }; } }); await loaded();
    fireEvent.change(screen.getByLabelText('Decision note'), { target: { value: 'Existing note' } }); fireEvent.submit(screen.getByRole('form', { name: 'Review decision' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This review changed'); expect(screen.getByLabelText('Decision note')).toHaveValue('Existing note');
    expect(screen.getByRole('button', { name: 'Save AC1 assessment' })).toBeDisabled(); expect(onChanged).not.toHaveBeenCalled(); expect(request.mock.calls.filter(call => call[2])).toHaveLength(1);
  });
  it.each(['APPROVED', 'IN_RELEASE', 'RELEASED'] as const)('renders %s and historical revisions read only', async state => {
    setup({ detail: { ...detail, state }, review: { ...review, editable: false } }); await loaded();
    expect(screen.getByRole('button', { name: 'Create finding' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Save AC1 assessment' })).toBeDisabled();
  });
  it('creates optional criterion and diff references and appends reasoned finding transitions', async () => {
    const finding = { id: 'f', proposalId: 'p', revisionId: 'old-revision', assignmentId: 'prior-assignment', actor: { id: 'prior', username: 'Prior reviewer' }, severity: 'HIGH', currentSeverity: 'HIGH', description: '<script>original</script>', criterionId: null, diffLocation: null, createdAt: timestamp, mutationVersion: 1, status: 'OPEN' };
    const { request } = setup({ findings: { items: [finding], nextCursor: null } }); await loaded();
    expect(screen.getByText('<script>original</script>')).toBeInTheDocument(); expect(document.querySelector('script')).toBeNull();
    const form = screen.getByRole('form', { name: 'Update finding f' }); fireEvent.change(within(form).getByLabelText('Operation'), { target: { value: 'CHANGE_SEVERITY' } }); fireEvent.change(within(form).getByLabelText('New severity'), { target: { value: 'LOW' } }); fireEvent.change(within(form).getByLabelText('Explanation'), { target: { value: 'Evidence shows lower impact' } }); fireEvent.submit(form);
    await waitFor(() => expect(request.mock.calls.find(call => call[2])?.[2]).toEqual({ ...scope, operation: 'CHANGE_SEVERITY', severity: 'LOW', reason: 'Evidence shows lower impact' }));
  });
  it('ignores a delayed response after unmount', async () => {
    const { unmount } = setup(); unmount(); await act(async () => {}); expect(screen.queryByText('No findings recorded.')).not.toBeInTheDocument();
  });
});


it('creates a finding with optional references and full normalized Unicode descriptions', async () => {
  const { request } = setup(); await loaded(); const form = screen.getByRole('form', { name: 'Create finding' });
  const description = '😀'.repeat(2000);
  fireEvent.change(within(form).getByLabelText('Description'), { target: { value: description } });
  fireEvent.change(within(form).getByLabelText('Criterion reference (optional)'), { target: { value: 'c' } });
  fireEvent.change(within(form).getByLabelText('Diff path (optional)'), { target: { value: 'src/example.ts' } });
  fireEvent.change(within(form).getByLabelText('Diff line (optional)'), { target: { value: '4' } }); fireEvent.submit(form);
  await waitFor(() => expect(request.mock.calls.find(call => call[2])?.[2]).toEqual({ ...scope, severity: 'MEDIUM', description, criterionId: 'c', diffLocation: { path: 'src/example.ts', line: 4 } }));
});

it('keeps an older selected revision read only even if its server payload says editable', async () => {
  setup({ detail: { ...detail, revision: { ...detail.revision, id: 'older' } }, review: { ...review, revisionId: 'older' } }); await loaded();
  expect(screen.getByRole('button', { name: 'Create finding' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Submit decision' })).toBeDisabled();
});

it('paginates coverage and decision histories with retained human provenance', async () => {
  const { request } = setup({ read: url => {
    if (url.endsWith('/coverage-history')) return { items: [coverage], nextCursor: 'coverage-cursor' };
    if (url.includes('/coverage-history?')) return { items: [{ ...coverage, id: 'older-coverage', actor: { id: 'old', username: 'Historical reviewer' }, revisionId: 'older-revision' }], nextCursor: null };
    if (url.endsWith('/decisions')) return { items: [], nextCursor: 'decision-cursor' };
    if (url.includes('/decisions?')) return { items: [{ id: 'decision', actor: { id: 'prior', username: 'Prior reviewer' }, decision: 'REQUEST_CHANGES', note: 'Historical decision note', revisionId: 'older-revision', assignmentId: 'old-assignment', createdAt: timestamp }], nextCursor: null };
    return undefined;
  } }); await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Next coverage history page' }));
  expect(await screen.findByText(/Historical reviewer/)).toBeInTheDocument(); expect(screen.getByText(/Revision: older-revision · Assignment: old-assignment · Source:/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next decisions page' })); expect(await screen.findByText('Historical decision note')).toBeInTheDocument();
  expect(request.mock.calls.some(call => call[0] === '/api/proposals/p/coverage-history?cursor=coverage-cursor')).toBe(true);
  expect(request.mock.calls.some(call => call[0] === '/api/proposals/p/decisions?cursor=decision-cursor')).toBe(true);
});

const inheritedFinding = { id: 'f', proposalId: 'p', revisionId: 'old-revision', assignmentId: 'prior-assignment', actor: { id: 'prior', username: 'Prior reviewer' }, severity: 'HIGH', currentSeverity: 'HIGH', description: 'Original description', criterionId: null, diffLocation: null, createdAt: timestamp, mutationVersion: 1, status: 'OPEN' };

it.each(['description', 'reason', 'note', 'rationale'] as const)('preserves entered %s whitespace in the submitted command', async field => {
  const { request } = setup({ findings: { items: [inheritedFinding], nextCursor: null } }); await loaded();
  const entered = '  Review text\nwith retained spacing  ';
  const form = field === 'description' ? screen.getByRole('form', { name: 'Create finding' }) : field === 'reason' ? screen.getByRole('form', { name: 'Update finding f' }) : field === 'note' ? screen.getByRole('form', { name: 'Review decision' }) : screen.getByRole('form', { name: 'Assess AC1' });
  const label = field === 'description' ? 'Description' : field === 'reason' ? 'Explanation' : field === 'note' ? 'Decision note' : 'Rationale (required unless covered)';
  fireEvent.change(within(form).getByLabelText(label), { target: { value: entered } }); fireEvent.submit(form);
  await waitFor(() => expect(request.mock.calls.filter(call => call[2])).toHaveLength(1));
  expect(request.mock.calls.find(call => call[2])![2]).toMatchObject({ [field]: entered });
});

it('starts finding history at page one whenever View history is selected again', async () => {
  const { request } = setup({ findings: { items: [inheritedFinding], nextCursor: null }, read: url => {
    if (url.endsWith('/findings/f/history')) return { items: [], nextCursor: 'page-two' };
    if (url.includes('/findings/f/history?')) return { items: [], nextCursor: 'page-three' };
    return undefined;
  } }); await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'View history for f' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Next finding history page' }));
  await waitFor(() => expect(request.mock.calls.some(call => call[0] === '/api/proposals/p/findings/f/history?cursor=page-two')).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'View history for f' }));
  await waitFor(() => expect(request.mock.calls.filter(call => call[0] === '/api/proposals/p/findings/f/history')).toHaveLength(2));
  expect(request.mock.calls.some(call => call[0].includes('cursor=page-three'))).toBe(false);
});

const response = { id: 'response', proposalId: 'p', findingId: 'historical-finding', revisionId: 'older-revision', actor: { id: 'a', username: 'Contributor author' }, text: '  <script>alert(1)</script>\nResponse details  ', mutationVersion: 2, createdAt: timestamp };

describe('Contributor response history', () => {
  it('shows attributed escaped multiline text with historical finding and revision identity independently of the findings page', async () => {
    const { request } = setup({ read: url => url.endsWith('/responses') ? { items: [response], nextCursor: null } : undefined });
    const history = screen.getByRole('region', { name: 'Finding responses' });
    const text = await within(history).findByText((_, element) => element?.tagName === 'P' && element.textContent === response.text);
    expect(text).toHaveClass('plain-text'); expect(document.querySelector('script')).toBeNull();
    expect(history).toHaveTextContent(`Contributor author (a) · ${new Date(timestamp).toLocaleString()} · Finding: historical-finding · Revision: older-revision`);
    expect(history).not.toHaveTextContent('Revision: revision');
    expect(request).toHaveBeenCalledWith('/api/proposals/p/responses', findingResponsesResponseSchema);
    expect(request.mock.calls.filter(call => call[2])).toHaveLength(0);
  });

  it('shows loading before a truthful empty result without blocking manual readiness', async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise(done => { resolve = done; });
    setup({ read: url => url.endsWith('/responses') ? pending : undefined }); await loaded();
    expect(screen.getByText('Loading responses...')).toBeInTheDocument();
    expect(screen.queryByText('No responses recorded.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save AC1 assessment' })).toBeEnabled();
    await act(async () => { resolve({ items: [], nextCursor: null }); });
    expect(screen.getByText('No responses recorded.')).toBeInTheDocument();
    expect(screen.queryByText('Loading responses...')).not.toBeInTheDocument();
  });

  it('retries initial failures without freezing manual review or claiming the history is empty', async () => {
    let failed = true;
    setup({ read: url => {
      if (url.endsWith('/responses')) { if (failed) throw new Error('Unavailable'); return { items: [response], nextCursor: null }; }
      return undefined;
    } }); await loaded();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load responses');
    expect(screen.queryByText('No responses recorded.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save AC1 assessment' })).toBeEnabled();
    failed = false; fireEvent.click(screen.getByRole('button', { name: 'Retry responses' }));
    expect(await screen.findByText(/Contributor author/)).toBeInTheDocument(); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('appends each page, encodes its cursor and retries a failed page without losing earlier responses', async () => {
    let failed = true;
    const { request } = setup({ read: url => {
      if (url.endsWith('/responses')) return { items: [response], nextCursor: 'next/+=' };
      if (url.includes('/responses?')) { if (failed) throw new Error('Unavailable'); return { items: [{ ...response, id: 'second-response', text: 'Older response', revisionId: 'earliest-revision' }], nextCursor: null }; }
      return undefined;
    } });
    fireEvent.click(await screen.findByRole('button', { name: 'Load more responses' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load responses');
    expect(screen.getByText(/Contributor author/)).toBeInTheDocument();
    failed = false; fireEvent.click(screen.getByRole('button', { name: 'Retry responses' }));
    expect(await screen.findByText('Older response')).toBeInTheDocument();
    const history = screen.getByRole('region', { name: 'Finding responses' });
    expect(within(history).getAllByRole('listitem')).toHaveLength(2);
    expect(history).toHaveTextContent('Revision: earliest-revision');
    expect(screen.queryByRole('button', { name: 'Load more responses' })).not.toBeInTheDocument();
    expect(request.mock.calls.filter(call => call[0] === '/api/proposals/p/responses?cursor=next%2F%2B%3D')).toHaveLength(2);
  });

  it('ignores delayed response history after unmount and leaves a newly mounted proposal untouched', async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise(done => { resolve = done; });
    const { unmount } = setup({ read: url => url.endsWith('/responses') ? pending : undefined }); await loaded();
    unmount(); setup({ detail: { ...detail, id: 'another-proposal' } }); await loaded();
    await act(async () => { resolve({ items: [response], nextCursor: null }); });
    expect(screen.queryByText(/Contributor author/)).not.toBeInTheDocument();
    expect(screen.getByText('No responses recorded.')).toBeInTheDocument();
  });
});
