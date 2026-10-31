import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProposalDetailResponse } from '@specsentry/shared';
import { PatchRiskAssistant } from './PatchRiskAssistant';
import { ManualReview } from './ManualReview';

const submittedAt = '2026-10-01T00:00:00.000Z';
const detail: ProposalDetailResponse = { id: 'proposal', version: 3, title: 'Proposal', author: { id: 'author', username: 'Author' }, firstSubmittedAt: submittedAt, latestSubmittedAt: submittedAt, state: 'IN_REVIEW', hasUnreadLatestRevision: false, revisionNotice: null, latestRevision: { id: 'revision', number: 1, submittedAt }, assignment: { id: 'assignment', version: 2, revisionId: 'revision', reviewer: { id: 'reviewer', username: 'Reviewer' } }, revision: { id: 'revision', number: 1, summary: 'Summary', problem: 'Problem', constraints: '', expectedBehavior: 'Expected', diffText: '', submittedAt, criteria: [{ id: 'criterion-1', stableKey: 'AC1', statement: 'First', required: true }, { id: 'criterion-2', stableKey: 'AC2', statement: 'Second', required: true }], evidence: [], criterionEvidenceLinks: [] } };
const scope = { proposalId: 'proposal', revisionId: 'revision', assignmentId: 'assignment', expectedVersion: 3, expectedAssignmentVersion: 2 };
const result = { status: 'CURRENT', staleReason: null, analyzedScope: scope, selectedCriterionIds: ['criterion-1'], result: { coverage: [{ criterionId: 'criterion-1', status: 'COVERED', rationale: '<img src=x onerror=alert(1)>' }], risks: [{ criterionIds: ['criterion-1'], severity: 'HIGH', description: '<script>alert(1)</script>' }], questions: ['Question?'], suggestedTests: ['Test it'], confidence: 'LOW' } };
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const props = { detail, stale: false, authorization: { current: () => 0, invalidate: vi.fn() }, csrfToken: 'a'.repeat(64), onAccessLost: vi.fn(), onSaved: vi.fn() };
function setup(fetch = vi.fn().mockResolvedValue(reply(result))) { vi.stubGlobal('fetch', fetch); return { ...render(<PatchRiskAssistant {...props} />), fetch }; }
async function analyze() { fireEvent.click(screen.getByLabelText(/AC1 \(criterion-1\)/)); fireEvent.click(screen.getByRole('button', { name: 'Analyze selected criteria' })); await screen.findByText('<script>alert(1)</script>', { exact: false }); }
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Patch Risk assistant', () => {
  it('ai-human-save uses explicit edited form, original analyzed versions, and cancel creates nothing', async () => {
    const { fetch } = setup(vi.fn().mockResolvedValueOnce(reply(result)).mockResolvedValueOnce(reply({ id: 'finding' })));
    await analyze();
    expect(screen.getByText(/Not analyzed in this batch: criterion-2/)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create finding from risk 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Create finding from risk 1' }));
    const form = screen.getByRole('form', { name: 'Create finding from Patch Risk' });
    fireEvent.change(within(form).getByLabelText('Description'), { target: { value: 'Human verified risk' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save finding' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[1]![0]).toBe('/api/proposals/proposal/findings');
    expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ revisionId: 'revision', assignmentId: 'assignment', expectedVersion: 3, expectedAssignmentVersion: 2, severity: 'HIGH', description: 'Human verified risk', criterionId: 'criterion-1' });
  });
  it('ai-transient-page clears suggestions and draft on pagehide and ignores late response', async () => {
    let resolve!: (value: unknown) => void;
    const held = new Promise(yes => { resolve = yes; });
    const { fetch } = setup(vi.fn().mockReturnValue(held));
    fireEvent.click(screen.getByLabelText(/AC1 \(criterion-1\)/)); fireEvent.click(screen.getByRole('button', { name: 'Analyze selected criteria' }));
    fireEvent(window, new Event('pagehide'));
    await act(async () => resolve(reply(result)));
    expect(screen.queryByText('<script>alert(1)</script>', { exact: false })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('ai-ui-fallback leaves selection and manual page usable after a failed request', async () => {
    const { fetch } = setup(vi.fn().mockResolvedValue(reply({ correlationId: 'safe-reference-123' }, 503)));
    fireEvent.click(screen.getByLabelText(/AC1 \(criterion-1\)/)); fireEvent.click(screen.getByRole('button', { name: 'Analyze selected criteria' }));
    expect(await screen.findByText(/Patch Risk is unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/Reference: safe-reference-123/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze selected criteria' })).toBeEnabled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(['complete diff character cap', 'total input token cap'])('ai-ui-input-limit explains a server rejection for %s and preserves manual edits', async () => {
    // Both server-side limits deliberately share the safe INPUT_LIMIT wire reason.
    const fetch = vi.fn().mockResolvedValue(reply({ code: 'AI_UNAVAILABLE', reason: 'INPUT_LIMIT', correlationId: 'safe-size-reference', message: 'Untrusted server detail' }, 422));
    vi.stubGlobal('fetch', fetch);
    const request = vi.fn(async (url: string) => url.includes('/review?')
      ? { proposalId: detail.id, revisionId: detail.revision.id, version: detail.version, assignmentId: detail.assignment.id, assignmentVersion: detail.assignment.version, editable: true, coverage: [], approvalBlockers: [] }
      : { items: [], nextCursor: null });
    render(<><ManualReview detail={detail} stale={false} busy={false} request={request as never} onRefresh={vi.fn()} onChanged={vi.fn()} onBusy={vi.fn()} /><PatchRiskAssistant {...props} /></>);
    await waitFor(() => expect(screen.queryByText('Loading assessments and findings…')).not.toBeInTheDocument());
    const manual = within(screen.getByRole('region', { name: 'Manual review' }));
    const description = within(manual.getByRole('form', { name: 'Create finding' })).getByLabelText('Description');
    const entered = '  Human review text\nwith preserved spacing  ';
    fireEvent.change(description, { target: { value: entered } });
    fireEvent.click(screen.getByLabelText(/AC1 \(criterion-1\)/));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze selected criteria' }));
    expect(await screen.findByText(/The complete review context exceeds the AI size limits/)).toHaveTextContent('No specification, diff, or evidence was truncated. Manual review remains available. Reference: safe-size-reference');
    expect(screen.queryByText(/Untrusted server detail/)).not.toBeInTheDocument();
    expect(description).toHaveValue(entered);
    expect(description).toBeEnabled();
    expect(manual.getByRole('button', { name: 'Create finding' })).toBeEnabled();
    expect(screen.getByLabelText(/AC1 \(criterion-1\)/)).toBeChecked();
    expect(screen.getByRole('button', { name: 'Analyze selected criteria' })).toBeEnabled();
    expect(props.onAccessLost).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    { status: 422, code: 'AI_UNAVAILABLE', reason: 'UNKNOWN_PROVIDER_REASON' },
    { status: 422, code: 'OTHER_ERROR', reason: 'INPUT_LIMIT' },
    { status: 503, code: 'AI_UNAVAILABLE', reason: 'INPUT_LIMIT' },
  ])('ai-ui-fallback only uses the allowlisted input-limit response ($status/$code/$reason)', async ({ status, code, reason }) => {
    setup(vi.fn().mockResolvedValue(reply({ code, reason, correlationId: '<unsafe-reference>', message: 'Untrusted provider detail' }, status)));
    fireEvent.click(screen.getByLabelText(/AC1 \(criterion-1\)/));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze selected criteria' }));
    expect(await screen.findByText(/Patch Risk is unavailable/)).toHaveTextContent('Continue with manual review or try again later.');
    expect(screen.queryByText(/complete review context exceeds|Untrusted provider detail|unsafe-reference/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze selected criteria' })).toBeEnabled();
  });
  it('ai-ui-selection-stale blocks stale output and clears it on revision change', async () => {
    const { rerender } = setup(); await analyze();
    rerender(<PatchRiskAssistant {...props} stale />);
    await waitFor(() => expect(screen.queryByText('<script>alert(1)</script>', { exact: false })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Analyze selected criteria' })).toBeDisabled();
    rerender(<PatchRiskAssistant {...props} detail={{ ...detail, version: 4, revision: { ...detail.revision, id: 'revision-2' } }} />);
    expect(screen.queryByRole('button', { name: 'Create finding from risk 1' })).not.toBeInTheDocument();
  });
});
