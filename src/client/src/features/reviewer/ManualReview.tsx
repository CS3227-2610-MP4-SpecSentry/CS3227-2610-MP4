import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  humanReviewResponseSchema, findingsResponseSchema, findingHistoryResponseSchema, coverageHistoryResponseSchema, decisionsResponseSchema,
  coverageWriteRequestSchema, createFindingRequestSchema, findingTransitionRequestSchema, findingAmendmentRequestSchema, reviewDecisionRequestSchema,
  coverageCommandResponseSchema, findingCommandResponseSchema, findingEventCommandResponseSchema, decisionCommandResponseSchema,
  type ProposalDetailResponse, type HumanReviewResponse, type FindingsResponse, type FindingHistoryResponse, type CoverageHistoryResponse, type DecisionsResponse,
} from '@specsentry/shared';
type Parser<T> = { parse: (value: unknown) => T };
type Request = <T>(url: string, schema: Parser<T>, body?: unknown, method?: string, key?: string) => Promise<T>;
type Props = { detail: ProposalDetailResponse; stale: boolean; busy: boolean; request: Request; onRefresh: () => void; onChanged: (message: string) => void; onBusy: (value: boolean) => void };
const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const statuses = ['COVERED', 'PARTIALLY_COVERED', 'NOT_COVERED', 'NOT_APPLICABLE'];
const stamp = (value: string) => new Date(value).toLocaleString();
const formData = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); return new FormData(event.currentTarget); };
const value = (data: FormData, name: string) => String(data.get(name) ?? '');
const blockerLabels = { STATE: 'Decisions require the current revision in IN_REVIEW.', MISSING_ASSESSMENT: 'Criterion has no assessment', UNCONFIRMED_ASSESSMENT: 'Inherited assessment needs individual confirmation', REQUIRED_NOT_COVERED: 'Required criterion is not covered', UNRESOLVED_HIGH_CRITICAL: 'Unresolved HIGH or CRITICAL findings remain' };

export function ManualReview({ detail, stale, busy, request, onRefresh, onChanged, onBusy }: Props) {
  // These command coordinates belong to this mounted revision. Focus reads never replace them.
  const scope = { expectedVersion: detail.version, revisionId: detail.revision.id, assignmentId: detail.assignment.id, expectedAssignmentVersion: detail.assignment.version };
  const base = `/api/proposals/${encodeURIComponent(detail.id)}`;
  const [review, setReview] = useState<HumanReviewResponse | null>(null);
  const [findings, setFindings] = useState<FindingsResponse | null>(null);
  const [coverageHistory, setCoverageHistory] = useState<CoverageHistoryResponse | null>(null);
  const [decisions, setDecisions] = useState<DecisionsResponse | null>(null);
  const [findingHistory, setFindingHistory] = useState<{ id: string; page: FindingHistoryResponse } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [frozen, setFrozen] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const decisionAttempt = useRef<{ key: string; body: unknown } | null>(null);
  const active = useRef(true);
  const locked = useRef(false);
  const inSync = !!review && review.version === detail.version && review.assignmentId === detail.assignment.id && review.assignmentVersion === detail.assignment.version && review.revisionId === detail.revision.id;
  const editable = inSync && review.editable && !stale && !frozen && !busy && !loading && !uncertain && detail.revision.id === detail.assignment.revisionId && ['IN_REVIEW', 'CHANGES_REQUESTED'].includes(detail.state);
  useEffect(() => {
    active.current = true;
    void Promise.all([
      request(`${base}/review?revisionId=${encodeURIComponent(detail.revision.id)}`, humanReviewResponseSchema).then(result => { if (active.current) setReview(result); }),
      request(`${base}/findings`, findingsResponseSchema).then(result => { if (active.current) setFindings(result); }),
      request(`${base}/coverage-history`, coverageHistoryResponseSchema).then(result => { if (active.current) setCoverageHistory(result); }),
      request(`${base}/decisions`, decisionsResponseSchema).then(result => { if (active.current) setDecisions(result); }),
    ]).catch(() => { if (active.current) setError('Unable to load manual review. Refresh review to retry.'); }).finally(() => { if (active.current) setLoading(false); });
    return () => { active.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function validation(cause: unknown) { setError(cause instanceof Error && 'issues' in cause ? 'Check the form: required text, rationale, valid references and field limits (2,000 characters).' : 'Unable to complete review request.'); }
  async function write<T>(path: string, schema: Parser<T>, body: unknown, method = 'POST', decision = false) {
    if (locked.current || (!editable && !(decision && uncertain))) return;
    locked.current = true; onBusy(true); setError('');
    if (decision && !decisionAttempt.current) decisionAttempt.current = { key: crypto.randomUUID(), body };
    const attempt = decision ? decisionAttempt.current : null;
    try {
      await request(path, schema, attempt ? attempt.body : body, method, attempt?.key);
      if (active.current) { setUncertain(false); setFrozen(true); const command = body as { operation?: string; decision?: string }; onChanged(command.decision === 'APPROVE' ? 'Review approved.' : command.decision === 'REQUEST_CHANGES' ? 'Changes requested.' : path.includes('/coverage/') ? 'Criterion assessment saved.' : path.endsWith('/findings') ? 'Finding created.' : path.endsWith('/amendments') ? 'Finding amendment saved.' : 'Finding transition saved.'); }
    } catch (cause) {
      if (!active.current) return;
      const status = cause && typeof cause === 'object' && 'status' in cause ? cause.status : undefined;
      if (decision && (status === undefined || (typeof status === 'number' && status >= 500))) {
        setUncertain(true); setError('Decision outcome is uncertain. Retry the same decision safely, or refresh review to reconcile its outcome.');
      } else {
        decisionAttempt.current = null; setFrozen(true);
        setError(status === 409 ? 'This review changed. Refresh review and reconcile before submitting again.' : [401, 403, 404].includes(Number(status)) ? 'Review access is no longer available.' : 'Review request failed. Refresh review before trying again.');
      }
    } finally { locked.current = false; onBusy(false); }
  }
  function assess(event: FormEvent<HTMLFormElement>, criterionId: string) {
    const data = formData(event);
    try { const body = coverageWriteRequestSchema.parse({ ...scope, operation: 'ASSESS', status: value(data, 'status'), ...(value(data, 'rationale') ? { rationale: value(data, 'rationale') } : {}), evidenceIds: data.getAll('evidenceIds') }); void write(`${base}/coverage/${encodeURIComponent(criterionId)}`, coverageCommandResponseSchema, body, 'PUT'); } catch (cause) { validation(cause); }
  }
  function createFinding(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    try {
      const body = createFindingRequestSchema.parse({ ...scope, severity: value(data, 'severity'), description: value(data, 'description'), ...(value(data, 'criterionId') ? { criterionId: value(data, 'criterionId') } : {}), ...(value(data, 'path') || value(data, 'line') ? { diffLocation: { path: value(data, 'path'), line: Number(value(data, 'line')) } } : {}) });
      void write(`${base}/findings`, findingCommandResponseSchema, body);
    } catch (cause) { validation(cause); }
  }
  function transition(event: FormEvent<HTMLFormElement>, id: string) {
    const data = formData(event); const operation = value(data, 'operation');
    try {
      const body = operation === 'AMEND' ? findingAmendmentRequestSchema.parse({ ...scope, reason: value(data, 'reason'), description: value(data, 'description') }) : findingTransitionRequestSchema.parse({ ...scope, operation, reason: value(data, 'reason'), ...(operation === 'CHANGE_SEVERITY' ? { severity: value(data, 'severity') } : {}) });
      void write(`/api/findings/${encodeURIComponent(id)}/${operation === 'AMEND' ? 'amendments' : 'transitions'}`, findingEventCommandResponseSchema, body);
    } catch (cause) { validation(cause); }
  }
  function decide(event: FormEvent<HTMLFormElement>) {
    const data = formData(event); const decision = value(data, 'decision');
    if (decision === 'REQUEST_CHANGES' && !value(data, 'note').trim() && !findings?.items.length) { setError('Request changes requires a finding or an explanatory note.'); return; }
    if (decision === 'APPROVE' && review?.approvalBlockers.length) { setError('Resolve approval blockers first.'); return; }
    try { const body = reviewDecisionRequestSchema.parse({ ...scope, decision, ...(value(data, 'note') ? { note: value(data, 'note') } : {}) }); void write(`${base}/decision`, decisionCommandResponseSchema, body, 'POST', true); } catch (cause) { validation(cause); }
  }
  async function page(kind: 'findings' | 'coverage-history' | 'decisions' | 'finding-history', id?: string, firstPage = false) {
    if (busy || locked.current) return;
    const cursor = firstPage ? null : kind === 'findings' ? findings?.nextCursor : kind === 'coverage-history' ? coverageHistory?.nextCursor : kind === 'decisions' ? decisions?.nextCursor : findingHistory && id === findingHistory.id ? findingHistory.page.nextCursor : null;
    const path = kind === 'finding-history' ? `${base}/findings/${encodeURIComponent(id!)}/history` : `${base}/${kind}`;
    onBusy(true); setError('');
    try {
      const url = `${path}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`;
      if (kind === 'findings') { const result = await request(url, findingsResponseSchema); if (active.current) setFindings(result); }
      else if (kind === 'coverage-history') { const result = await request(url, coverageHistoryResponseSchema); if (active.current) setCoverageHistory(result); }
      else if (kind === 'decisions') { const result = await request(url, decisionsResponseSchema); if (active.current) setDecisions(result); }
      else { const result = await request(url, findingHistoryResponseSchema); if (active.current) setFindingHistory({ id: id!, page: result }); }
    } catch { if (active.current) setError('Unable to load history. Try again or refresh review.'); }
    finally { onBusy(false); }
  }
  return <section aria-label="Manual review">
    <h4>Manual review</h4>
    <button disabled={busy} onClick={onRefresh}>Refresh review and discard unsaved edits</button>
    {loading && <p role="status">Loading assessments and findings…</p>}
    {error && <p role="alert">{error}</p>}
    {(stale || frozen || (review && !inSync)) && <p role="status">Review forms are frozen. Refresh review explicitly to reconcile revision, assignment and version; unsaved edits will be discarded.</p>}
    {!loading && !editable && !stale && !frozen && !uncertain && <p>Manual review is read only for this revision or lifecycle state.</p>}
    <h5>Criterion assessments</h5>
    {detail.revision.criteria.map(criterion => {
      const assessment = review?.coverage.find(item => item.criterionId === criterion.id);
      return <section key={criterion.id} aria-label={`Assessment ${criterion.stableKey}`}>
        <h6>{criterion.stableKey}: {criterion.statement}</h6>
        {assessment ? <p>{assessment.status} · {assessment.actor.username} · {stamp(assessment.createdAt)} · {assessment.confirmed ? 'Confirmed for this assignment' : 'Inherited: individual confirmation required'}{assessment.rationale && ` · ${assessment.rationale}`} · Evidence: {assessment.evidenceIds.join(', ') || 'None'}</p> : <p>Not assessed</p>}
        {assessment && !assessment.confirmed && <button disabled={!editable} onClick={() => void write(`${base}/coverage/${encodeURIComponent(criterion.id)}`, coverageCommandResponseSchema, coverageWriteRequestSchema.parse({ ...scope, operation: 'CONFIRM', sourceCoverageId: assessment.id }), 'PUT')}>Confirm {criterion.stableKey} assessment</button>}
        <form key={assessment?.id ?? 'unassessed'} onSubmit={event => assess(event, criterion.id)} aria-label={`Assess ${criterion.stableKey}`}>
          <fieldset disabled={!editable}><legend>Assess {criterion.stableKey}</legend>
            <label>Status<select name="status" defaultValue={assessment?.status ?? 'COVERED'}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
            <label>Rationale (required unless covered)<textarea name="rationale"  defaultValue={assessment?.rationale ?? ''} /></label>
            <p>Evidence links are optional. Review the submitted content directly.</p>
            {detail.revision.evidence.map(evidence => <label key={evidence.id}><input name="evidenceIds" type="checkbox" value={evidence.id} defaultChecked={assessment?.evidenceIds.includes(evidence.id)} />{evidence.id}</label>)}
            <button>Save {criterion.stableKey} assessment</button>
          </fieldset>
        </form>
      </section>;
    })}
    <h5>Findings</h5>
    {findings?.items.length === 0 && <p>No findings recorded.</p>}
    {findings?.items.map(finding => <section key={finding.id} aria-label={`Finding ${finding.id}`}>
      <h6>{finding.currentSeverity} · {finding.status}</h6><p className="plain-text">{finding.description}</p>
      <p>Original author: {finding.actor.username} ({finding.actor.id}) · {stamp(finding.createdAt)} · Revision: {finding.revisionId} · Assignment: {finding.assignmentId}</p>
      <p>Original severity: {finding.severity} · Criterion: {finding.criterionId ?? 'None'} · Diff: {finding.diffLocation ? `${finding.diffLocation.path}:${finding.diffLocation.line}` : 'None'}</p>
      <button disabled={busy} onClick={() => { setFindingHistory(null); void page('finding-history', finding.id, true); }}>View history for {finding.id}</button>
      <form onSubmit={event => transition(event, finding.id)} aria-label={`Update finding ${finding.id}`}><fieldset disabled={!editable}><legend>Append finding update</legend>
        <label>Operation<select name="operation"><option value={finding.status === 'OPEN' ? 'RESOLVE' : 'REOPEN'}>{finding.status === 'OPEN' ? 'Resolve' : 'Reopen'}</option><option value="CHANGE_SEVERITY">Change severity</option><option value="AMEND">Append amendment</option></select></label>
        <label>New severity<select name="severity" defaultValue={finding.currentSeverity}>{severities.map(severity => <option key={severity}>{severity}</option>)}</select></label>
        <label>Amendment text<textarea name="description"  /></label><label>Explanation<textarea name="reason" required  /></label><button>Save finding update</button>
      </fieldset></form>
    </section>)}
    {findings?.nextCursor && <button disabled={busy} onClick={() => void page('findings')}>Next findings page</button>}
    {findingHistory && <section aria-label="Finding transition history"><h6>History for {findingHistory.id}</h6>{findingHistory.page.items.length === 0 && <p>No transitions or amendments.</p>}<ol>{findingHistory.page.items.map(event => <li key={event.id}>{event.operation} · {event.actor.username} · {stamp(event.createdAt)} · {event.severity} · {event.status}<p>{event.reason}</p>{event.description && <p>{event.description}</p>}<p>Revision: {event.revisionId} · Assignment: {event.assignmentId}</p></li>)}</ol>{findingHistory.page.nextCursor && <button disabled={busy} onClick={() => void page('finding-history', findingHistory.id)}>Next finding history page</button>}</section>}
    <form onSubmit={createFinding} aria-label="Create finding"><fieldset disabled={!editable}><legend>Create finding</legend>
      <label>Severity<select name="severity" defaultValue="MEDIUM">{severities.map(severity => <option key={severity}>{severity}</option>)}</select></label>
      <label>Description<textarea name="description" required  /></label>
      <label>Criterion reference (optional)<select name="criterionId"><option value="">None</option>{detail.revision.criteria.map(criterion => <option key={criterion.id} value={criterion.id}>{criterion.stableKey}</option>)}</select></label>
      <label>Diff path (optional)<input name="path"  /></label><label>Diff line (optional)<input name="line" type="number" min="1" step="1" /></label><button>Create finding</button>
    </fieldset></form>
    <h5>Review decision</h5>
    <ul aria-label="Approval blockers">{review?.approvalBlockers.map((blocker, index) => <li key={index}>{blockerLabels[blocker.code]}{blocker.criterionId ? `: ${blocker.criterionId}` : ''}</li>)}</ul>
    {review?.approvalBlockers.length === 0 && <p>No approval blockers.</p>}
    <form onSubmit={decide} aria-label="Review decision"><fieldset disabled={!editable || detail.state !== 'IN_REVIEW'}><legend>Decide on this revision</legend>
      <label>Decision<select name="decision"><option value="REQUEST_CHANGES">Request changes</option><option value="APPROVE" disabled={!!review?.approvalBlockers.length}>Approve</option></select></label>
      <label>Decision note<textarea name="note"  /></label><button>Submit decision</button>
    </fieldset></form>
    {uncertain && <button disabled={busy || stale} onClick={() => void write(`${base}/decision`, decisionCommandResponseSchema, decisionAttempt.current?.body, 'POST', true)}>Retry same decision</button>}
    <h5>Coverage history</h5>{coverageHistory?.items.length === 0 && <p>No coverage history.</p>}<ol>{coverageHistory?.items.map(item => <li key={item.id}>{item.criterionId}: {item.status} · {item.actor.username} · {stamp(item.createdAt)}<p>Revision: {item.revisionId} · Assignment: {item.assignmentId} · Source: {item.sourceCoverageId ?? 'Original assessment'}</p>{item.rationale && <p>{item.rationale}</p>}<p>Evidence: {item.evidenceIds.join(', ') || 'None'}</p></li>)}</ol>{coverageHistory?.nextCursor && <button disabled={busy} onClick={() => void page('coverage-history')}>Next coverage history page</button>}
    <h5>Decision history</h5>{decisions?.items.length === 0 && <p>No decisions recorded.</p>}<ol>{decisions?.items.map(item => <li key={item.id}>{item.decision} · {item.actor.username} · {stamp(item.createdAt)}<p>Revision: {item.revisionId} · Assignment: {item.assignmentId}</p>{item.note && <p>{item.note}</p>}</li>)}</ol>{decisions?.nextCursor && <button disabled={busy} onClick={() => void page('decisions')}>Next decisions page</button>}
  </section>;
}

