import { useEffect, useRef, useState, type FormEvent } from 'react';
import { revokeApprovalRequestSchema, revokeApprovalResponseSchema, type ProposalDetailResponse, type RevokeApprovalRequest } from '@specsentry/shared';

type Parser<T> = { parse: (value: unknown) => T };
type Request = <T>(url: string, schema: Parser<T>, body?: unknown, method?: string, key?: string) => Promise<T>;
type Props = { detail: ProposalDetailResponse; currentReviewerId: string; stale: boolean; busy: boolean; request: Request;
  onRefresh: () => void; onChanged: (message: string) => void; onBusy: (value: boolean) => void };
type Attempt = { body: RevokeApprovalRequest; key: string };

export function ApprovalRevocation({ detail, currentReviewerId, stale, busy, request, onRefresh, onChanged, onBusy }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const attempt = useRef<Attempt | null>(null);
  const locked = useRef(false);
  const active = useRef(true);
  // Parent keys this component to the displayed proposal coordinates. An old
  // attempt can never be silently sent with coordinates from a newer detail.
  const context = detail.approvalContext;
  const eligible = !!context && detail.effectiveApproval === true &&
    detail.assignment.reviewer.id === currentReviewerId &&
    detail.revision.id === detail.assignment.revisionId &&
    (detail.state === 'APPROVED' && !detail.candidateContext ||
      detail.state === 'IN_RELEASE' && !!detail.candidateContext && !detail.candidateContext.ownInvalidApprovalBlocker);
  const count = Array.from(reason).length;
  const base = `/api/proposals/${encodeURIComponent(detail.id)}/revoke-approval`;

  // Clear transient command state if the parent removes this protected view.
  // The parent owns account/access invalidation and unmounts on that boundary.
  useEffect(() => () => { active.current = false; attempt.current = null; }, []);

  async function send(current: Attempt) {
    if (locked.current || busy || stale || frozen) return;
    locked.current = true; onBusy(true); setError('');
    try {
      const result = await request(base, revokeApprovalResponseSchema, current.body, 'POST', current.key);
      if (!active.current) return;
      attempt.current = null; setUncertain(false); setFrozen(true);
      onChanged(result.candidate
        ? 'Approval revoked. This candidate is blocked; its responsible Release Maintainer was notified.'
        : 'Approval revoked. This proposal now awaits contributor changes.');
    } catch (cause) {
      if (!active.current) return;
      const status = cause && typeof cause === 'object' && 'status' in cause ? cause.status : undefined;
      if (status === undefined || typeof status === 'number' && status >= 500) {
        setUncertain(true);
        setError('The revocation outcome is uncertain. Retry the same request safely, or refresh review to reconcile before a new attempt.');
      } else if (status === 409) {
        attempt.current = null; setUncertain(false); setFrozen(true);
        setError('The approval or candidate changed. Refresh review and reconcile before submitting again.');
      } else if (status === 422) {
        attempt.current = null; setUncertain(false);
        setError('Check the reason and request fields. The reason must be nonblank and at most 2,000 characters.');
      } else {
        attempt.current = null; setUncertain(false); setFrozen(true);
        setError('Revocation is unavailable. Refresh review before trying again.');
      }
    } finally { locked.current = false; onBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eligible || stale || frozen || busy || uncertain || !context) return;
    if (!reason.trim() || count > 2_000) {
      setError('Enter a reason of at most 2,000 characters.'); return;
    }
    const body = revokeApprovalRequestSchema.safeParse({
      expectedVersion: detail.version, revisionId: detail.revision.id,
      assignmentId: detail.assignment.id, expectedAssignmentVersion: detail.assignment.version,
      approvalId: context.id, expectedApprovalVersion: context.mutationVersion, reason,
      candidateContext: detail.candidateContext
        ? { candidateId: detail.candidateContext.candidateId,
          expectedCandidateVersion: detail.candidateContext.candidateVersion } : null,
    });
    if (!body.success) { setError('Check the reason and refresh review to verify approval details.'); return; }
    const current = { body: body.data, key: crypto.randomUUID() };
    attempt.current = current;
    void send(current);
  }

  return <section aria-label="Approval revocation">
    <h4>Approval revocation</h4>
    {detail.state === 'RELEASED' && <p>Released approval is read only. It cannot be revoked.</p>}
    {detail.candidateContext?.ownInvalidApprovalBlocker && <p>This candidate has an invalid approval blocker for this proposal.</p>}
    {eligible && <>
      <p>{detail.state === 'IN_RELEASE'
        ? 'Revoking approval keeps this proposal attached to the open candidate, blocks publication, and notifies the responsible Release Maintainer. The Maintainer must remove it before the Contributor can revise.'
        : 'Revoking approval moves this proposal to changes requested and keeps your assignment. The Contributor can revise it.'}</p>
      <form aria-label="Revoke approval" onSubmit={submit} noValidate>
        <label htmlFor="revocation-reason">Reason for revocation</label>
        <textarea id="revocation-reason" value={reason} onChange={event => setReason(event.target.value)} required
          aria-describedby="revocation-limit" aria-invalid={!!error && !uncertain} disabled={busy || stale || frozen || uncertain} />
        <p id="revocation-limit">Required. {count} of 2,000 characters (Unicode code points).</p>
        <button disabled={busy || stale || frozen || uncertain || !reason.trim() || count > 2_000}>Revoke approval</button>
      </form>
      {uncertain && <button disabled={busy || stale} onClick={() => { if (attempt.current) void send(attempt.current); }}>Retry same revocation request</button>}
      {(stale || frozen) && <button disabled={busy} onClick={onRefresh}>Refresh review to reconcile approval</button>}
    </>}
    {error && <p role="alert">{error}</p>}
    {stale && eligible && <p role="status">Review information changed. Refresh review before revoking approval.</p>}
    {busy && eligible && <p role="status">Revocation request in progress…</p>}
  </section>;
}
