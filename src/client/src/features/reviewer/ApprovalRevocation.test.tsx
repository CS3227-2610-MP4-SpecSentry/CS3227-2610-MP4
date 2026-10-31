import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProposalDetailResponse } from '@specsentry/shared';
import { ApprovalRevocation } from './ApprovalRevocation';

const timestamp = '2026-10-01T00:00:00.000Z';
const base: ProposalDetailResponse = {
  id: 'p', version: 7, title: 'Example', state: 'APPROVED',
  author: { id: 'owner', username: 'owner' }, firstSubmittedAt: timestamp, latestSubmittedAt: timestamp,
  assignment: { id: 'assignment', revisionId: 'revision', version: 2, reviewer: { id: 'reviewer', username: 'reviewer' } },
  revision: { id: 'revision', number: 1, summary: 'Summary', problem: 'Problem', constraints: '', expectedBehavior: 'Works',
    diffText: '', submittedAt: timestamp, criteria: [], evidence: [], criterionEvidenceLinks: [] },
  hasUnreadLatestRevision: false, revisionNotice: null, effectiveApproval: true,
  approvalContext: { id: 'approval', mutationVersion: 7 }, candidateContext: null,
};
const attached: ProposalDetailResponse = { ...base, state: 'IN_RELEASE', candidateContext: {
  candidateId: 'candidate', candidateVersion: 4, ownInvalidApprovalBlocker: false } };
const success = { proposalId: 'p', revisionId: 'revision', assignmentId: 'assignment', state: 'CHANGES_REQUESTED',
  version: 8, assignmentVersion: 2, effectiveApproval: false,
  invalidation: { id: 'invalidation', proposalId: 'p', revisionId: 'revision', assignmentId: 'assignment',
    decisionId: 'approval', actor: { id: 'reviewer', username: 'reviewer' }, mutationVersion: 8,
    cause: 'REVOKED', reason: 'Human reason', candidateId: null, createdAt: timestamp }, candidate: null };
function setup(detail = base, write: () => Promise<unknown> = async () => success, stale = false) {
  const request = vi.fn(async (...args: [url: string, schema: unknown, body?: unknown, method?: string, key?: string]) => {
    void args;
    return write();
  });
  const onChanged = vi.fn(); const onRefresh = vi.fn();
  const view = render(<ApprovalRevocation detail={detail} currentReviewerId="reviewer" request={request as never} stale={stale} busy={false}
    onBusy={vi.fn()} onChanged={onChanged} onRefresh={onRefresh} />);
  return { ...view, request, onChanged, onRefresh };
}
function submit(reason: string) {
  const form = screen.getByRole('form', { name: 'Revoke approval' });
  fireEvent.change(within(form).getByLabelText('Reason for revocation'), { target: { value: reason } });
  fireEvent.submit(form);
}

describe('Approval revocation', () => {
  it('revoke-ui sends the current approval, assignment and explicit unattached context with one CSRF-ready transport call', async () => {
    const { request, onChanged } = setup(); submit('Human reason');
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.stringContaining('awaits contributor changes')));
    expect(request).toHaveBeenCalledWith('/api/proposals/p/revoke-approval', expect.anything(), {
      expectedVersion: 7, revisionId: 'revision', assignmentId: 'assignment', expectedAssignmentVersion: 2,
      approvalId: 'approval', expectedApprovalVersion: 7, reason: 'Human reason', candidateContext: null,
    }, 'POST', expect.any(String));
  });

  it('revoke-ui-recovery preserves reason and the exact idempotency key/body after an uncertain response', async () => {
    let calls = 0; const { request, onChanged } = setup(attached, async () => {
      if (++calls === 1) throw new Error('Network lost');
      return { ...success, state: 'IN_RELEASE', candidate: { id: 'candidate', version: 5, ownInvalidApprovalBlocker: true },
        invalidation: { ...success.invalidation, candidateId: 'candidate' } };
    });
    submit('Human reason');
    expect(await screen.findByRole('alert')).toHaveTextContent('outcome is uncertain');
    expect(screen.getByLabelText('Reason for revocation')).toHaveValue('Human reason');
    fireEvent.click(screen.getByRole('button', { name: 'Retry same revocation request' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.stringContaining('candidate is blocked')));
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.slice(2)).toEqual(request.mock.calls[0]?.slice(2));
    expect(request.mock.calls[0]?.[2]).toMatchObject({ candidateContext: { candidateId: 'candidate', expectedCandidateVersion: 4 } });
  });

  it('revoke-ui-recovery keeps the reason on conflict and requires reconciliation before another request', async () => {
    const { request, onRefresh } = setup(attached, async () => { throw { status: 409 }; });
    submit('Keep this explanation');
    expect(await screen.findByRole('alert')).toHaveTextContent('Refresh review and reconcile');
    expect(screen.getByLabelText('Reason for revocation')).toHaveValue('Keep this explanation');
    expect(screen.getByRole('button', { name: 'Revoke approval' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh review to reconcile approval' }));
    expect(onRefresh).toHaveBeenCalledOnce(); expect(request).toHaveBeenCalledOnce();
  });

  it('revoke-ui-accessibility labels, limits and announces the reason; released and historical views have no action', () => {
    const { rerender, request } = setup();
    expect(screen.getByLabelText('Reason for revocation')).toHaveAttribute('aria-describedby', 'revocation-limit');
    submit('😀'.repeat(2_001));
    expect(screen.getByRole('alert')).toHaveTextContent('2,000'); expect(request).not.toHaveBeenCalled();
    rerender(<ApprovalRevocation detail={{ ...base, state: 'RELEASED' }} currentReviewerId="reviewer" request={request as never} stale={false}
      busy={false} onBusy={vi.fn()} onChanged={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.queryByRole('form', { name: 'Revoke approval' })).not.toBeInTheDocument();
    expect(screen.getByText(/Released approval is read only/)).toBeInTheDocument();
    rerender(<ApprovalRevocation detail={{ ...base, revision: { ...base.revision, id: 'older' } }} currentReviewerId="reviewer" request={request as never}
      stale={false} busy={false} onBusy={vi.fn()} onChanged={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.queryByRole('form', { name: 'Revoke approval' })).not.toBeInTheDocument();
  });
});
