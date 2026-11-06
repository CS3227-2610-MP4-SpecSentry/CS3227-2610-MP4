import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  addReleaseMemberRequestSchema,
  appendReleaseSmokeTestRequestSchema,
  createReleaseCandidateRequestSchema,
  eligibleReleaseProposalsResponseSchema,
  publishReleaseCandidateRequestSchema,
  releasePublicationResponseSchema,
  releaseCandidateCommandResponseSchema,
  releaseCandidateDetailResponseSchema,
  releaseCandidatesResponseSchema,
  removeReleaseMemberRequestSchema,
  updateReleaseCandidateRequestSchema,
  type EligibleReleaseProposalsResponse,
  type ReleaseCandidateDetailResponse,
  type ReleaseCandidatesResponse,
  type SessionResponse,
} from '@specsentry/shared';
import { Icon } from '../../shared/Icon';
import { MaintainerAudit } from './MaintainerAudit';
import { MaintainerNotifications, RenderedRevocationAcknowledgements } from './MaintainerNotifications';
import { ReleaseAnnotations } from './ReleaseAnnotations';
import { MaintainerAiUsage, ReleaseGateAssistant } from './ReleaseGateAssistant';
import { ReleaseSmokeHistory } from './ReleaseSmokeHistory';

type Props = { session: SessionResponse; onSessionLost(): void };

class StaleResponse extends Error {}
class RequestFailure extends Error {
  constructor(public status: number, public correlationId?: string) { super(); }
}

const blockerText: Record<ReleaseCandidateDetailResponse['blockers'][number]['code'], string> = {
  EMPTY: 'Add at least one approved proposal.',
  VERSION: 'Use a valid unique semantic version.',
  ROLLBACK: 'Record a rollback note.',
  SMOKE: 'Record a passing smoke test for the current candidate contents.',
  REVISION: 'An included proposal no longer points to the approved revision.',
  APPROVAL: 'An included proposal no longer has an effective approval.',
  COVERAGE: 'A required criterion is not covered.',
  FINDING: 'A high or critical finding is unresolved.',
};

async function parseFailure(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const correlationId = body && typeof body === 'object' && 'correlationId' in body &&
    typeof body.correlationId === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(body.correlationId)
    ? body.correlationId : undefined;
  return new RequestFailure(response.status, correlationId);
}

function CandidateList({ session, onSessionLost }: Props) {
  const [page, setPage] = useState<ReleaseCandidatesResponse | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    setLoading(true); setError('');
    const query = new URLSearchParams();
    if (cursor) query.set('cursor', cursor);
    if (status) query.set('status', status);
    try {
      const response = await fetch(`/api/release-candidates${query.size ? `?${query}` : ''}`, {
        credentials: 'same-origin', cache: 'no-store', signal,
      });
      if (signal?.aborted) return;
      if (response.status === 401) { setPage(null); onSessionLost(); return; }
      if (response.status === 403) { setPage(null); onSessionLost(); return; }
      if (!response.ok) throw await parseFailure(response);
      const result = releaseCandidatesResponseSchema.parse(await response.json());
      if (!signal?.aborted) { setPage(result); setUncertain(false); }
    } catch (cause) {
      if (!signal?.aborted) {
        const reference = cause instanceof RequestFailure && cause.correlationId ? ` Reference: ${cause.correlationId}` : '';
        setError(`Unable to load release candidates. Try again.${reference}`);
      }
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [cursor, status, onSessionLost]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load, attempt]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || pending || uncertain) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = createReleaseCandidateRequestSchema.safeParse({
      versionLabel: data.get('versionLabel'),
      rollbackNote: data.get('rollbackNote'),
      dependencyNotes: data.get('dependencyNotes'),
    });
    if (!parsed.success) {
      setError('Enter a semantic version such as 1.0.0 and a non-empty rollback note.');
      return;
    }
    setPending(true); setUncertain(true); setError('');
    try {
      const response = await fetch('/api/release-candidates', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken },
        body: JSON.stringify(parsed.data),
      });
      if (!active.current) return;
      if (response.status === 401) { setPage(null); onSessionLost(); return; }
      if (response.status === 403) { setPage(null); onSessionLost(); return; }
      if (!response.ok) {
        if (response.status < 500) setUncertain(false);
        throw await parseFailure(response);
      }
      const result = releaseCandidateCommandResponseSchema.parse(await response.json());
      if (!active.current) return;
      setUncertain(false); form.reset();
      navigate(`/releases/${encodeURIComponent(result.candidateId)}`);
    } catch (cause) {
      if (!active.current) return;
      const reference = cause instanceof RequestFailure && cause.correlationId ? ` Reference: ${cause.correlationId}` : '';
      setError(cause instanceof RequestFailure && cause.status === 409
        ? `That release version already exists. Refresh the list before trying again.${reference}`
        : cause instanceof RequestFailure && cause.status < 500
          ? `Unable to create this candidate. Check your access and entered values.${reference}`
          : `The create result may be uncertain. Refresh the list before creating another candidate.${reference}`);
    } finally { if (active.current) setPending(false); }
  }

  return <>
    <div className="page-heading"><div><h1>Release candidates</h1><p>Assemble approved changes and verify deterministic release gates.</p></div></div>
    <p><Link to="/releases/audit">Open restricted project audit</Link></p>
    {error && <p role="alert">{error}</p>}
    {uncertain && <p role="status">A candidate may already have been created. Refresh before retrying to avoid a duplicate.</p>}
    <section className="draft-panel" aria-labelledby="candidate-list-title">
      <div className="panel-heading"><div><h2 id="candidate-list-title">Project candidates</h2><p>All Release Maintainers can inspect candidates; only the creator can change an open candidate.</p></div>
        <label>Status <select value={status} disabled={loading || pending || uncertain} onChange={event => { setCursor(null); setStatus(event.target.value); }}><option value="">All</option><option value="OPEN">Open</option><option value="RELEASED">Released</option></select></label></div>
      {loading ? <div className="panel-state"><span className="loading-dot" aria-hidden="true" /><p role="status">Loading release candidates...</p></div>
        : error ? <div className="panel-state"><button onClick={() => setAttempt(value => value + 1)}>Retry loading candidates</button></div>
        : page?.items.length === 0 ? <div className="empty-state"><Icon name="file" /><h3>No release candidates yet</h3><p>Create the first candidate below.</p></div>
        : <><ul className="proposal-list">{page?.items.map(item => <li key={item.id}><h3>{item.versionLabel}</h3><p><span className="status-badge">{item.status}</span></p><p>Responsible Maintainer: {item.createdById}</p><p>Created {new Date(item.createdAt).toLocaleString()} · Candidate version {item.version} · Content version {item.contentVersion}</p><Link className="button" to={`/releases/${encodeURIComponent(item.id)}`}>Open {item.versionLabel}</Link></li>)}</ul>
          {(cursor || page?.nextCursor) && <div className="pagination">{cursor && <button disabled={loading || pending || uncertain} onClick={() => setCursor(null)}>First page</button>}{page?.nextCursor && <button disabled={loading || pending || uncertain} onClick={() => setCursor(page.nextCursor)}>Next page</button>}</div>}</>}
    </section>
    <MaintainerNotifications session={session} onSessionLost={onSessionLost} />
    <MaintainerAiUsage session={session} onSessionLost={onSessionLost} />
    <form className="draft-form" noValidate onSubmit={event => void create(event)}>
      <h2>Create an open candidate</h2>
      <label htmlFor="release-version">Semantic version</label><input id="release-version" name="versionLabel" placeholder="1.0.0" required disabled={loading || pending || uncertain} />
      <label htmlFor="release-rollback">Rollback note</label><textarea id="release-rollback" name="rollbackNote" rows={4} required maxLength={10000} disabled={loading || pending || uncertain} />
      <label htmlFor="release-dependencies">Dependency notes (optional)</label><textarea id="release-dependencies" name="dependencyNotes" rows={3} maxLength={10000} disabled={loading || pending || uncertain} />
      <button type="submit" disabled={loading || pending || uncertain}>{pending ? 'Creating candidate...' : 'Create candidate'}</button>
      {uncertain && <button type="button" disabled={loading || pending} onClick={() => setAttempt(value => value + 1)}>Refresh candidate list</button>}
    </form>
  </>;
}

function CandidateDetail({ session, onSessionLost }: Props) {
  const { candidateId = '' } = useParams();
  const [detail, setDetail] = useState<ReleaseCandidateDetailResponse | null>(null);
  const [eligible, setEligible] = useState<EligibleReleaseProposalsResponse | null>(null);
  const [eligibleCursor, setEligibleCursor] = useState<string | null>(null);
  const [eligibleError, setEligibleError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [publishIntent, setPublishIntent] = useState<{
    body: { expectedVersion: number; expectedContentVersion: number }; key: string;
  } | null>(null);
  const request = useRef(0);
  const active = useRef(true);
  const candidateBusy = pending || assistantBusy;

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    const local = ++request.current;
    setLoading(true); setError(''); setEligibleError('');
    try {
      const response = await fetch(`/api/release-candidates/${encodeURIComponent(candidateId)}`, {
        credentials: 'same-origin', cache: 'no-store', signal,
      });
      if (signal?.aborted || local !== request.current) throw new StaleResponse();
      if (response.status === 401) { setDetail(null); onSessionLost(); return; }
      if (response.status === 403) { setDetail(null); onSessionLost(); return; }
      if (!response.ok) throw await parseFailure(response);
      const result = releaseCandidateDetailResponseSchema.parse(await response.json());
      const editableResult = result.createdById === session.account.id && result.status === 'OPEN';
      let eligibleResult: EligibleReleaseProposalsResponse | null = null;
      if (editableResult) {
        const query = new URLSearchParams({ limit: '20' });
        if (eligibleCursor) query.set('cursor', eligibleCursor);
        try {
          const eligibleResponse = await fetch(`/api/release-candidates/${encodeURIComponent(candidateId)}/eligible-proposals?${query}`, {
            credentials: 'same-origin', cache: 'no-store', signal,
          });
          if (signal?.aborted || local !== request.current) throw new StaleResponse();
          if (eligibleResponse.status === 401) { setDetail(null); onSessionLost(); return; }
          if (eligibleResponse.status === 403) { setDetail(null); onSessionLost(); return; }
          if (!eligibleResponse.ok) throw await parseFailure(eligibleResponse);
          eligibleResult = eligibleReleaseProposalsResponseSchema.parse(await eligibleResponse.json());
        } catch (cause) {
          if (cause instanceof StaleResponse || signal?.aborted || local !== request.current) return;
          setDetail(result); setEligible(null); setReconciliationRequired(true);
          const reference = cause instanceof RequestFailure && cause.correlationId ? ` Reference: ${cause.correlationId}` : '';
          setEligibleError(`Unable to load eligible proposals. Refresh before changing candidate membership.${reference}`);
          return;
        }
      }
      if (!signal?.aborted && local === request.current) {
        setDetail(result); setEligible(eligibleResult);
        setPublishIntent(current => current && (result.status !== 'OPEN' ||
          result.version !== current.body.expectedVersion ||
          result.contentVersion !== current.body.expectedContentVersion) ? null : current);
        setReconciliationRequired(false);
      }
    } catch (cause) {
      if (cause instanceof StaleResponse || signal?.aborted || local !== request.current) return;
      setDetail(null);
      const reference = cause instanceof RequestFailure && cause.correlationId ? ` Reference: ${cause.correlationId}` : '';
      setError(cause instanceof RequestFailure && [403, 404].includes(cause.status)
        ? `This candidate is unavailable or you no longer have access.${reference}`
        : `Unable to load this candidate. Try again.${reference}`);
    } finally { if (!signal?.aborted && local === request.current) setLoading(false); }
  }, [candidateId, eligibleCursor, onSessionLost, session.account.id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load, attempt]);

  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || candidateBusy || reconciliationRequired) return;
    const data = new FormData(event.currentTarget);
    const parsed = updateReleaseCandidateRequestSchema.safeParse({
      expectedVersion: detail.version,
      versionLabel: data.get('versionLabel'), rollbackNote: data.get('rollbackNote'), dependencyNotes: data.get('dependencyNotes'),
    });
    if (!parsed.success) { setError('Enter a valid semantic version and non-empty rollback note.'); return; }
    setPending(true); setError('');
    try {
      const response = await fetch(`/api/release-candidates/${encodeURIComponent(candidateId)}`, {
        method: 'PUT', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken }, body: JSON.stringify(parsed.data),
      });
      if (!active.current) return;
      if (response.status === 401) { setDetail(null); onSessionLost(); return; }
      if (response.status === 403) { setDetail(null); onSessionLost(); return; }
      if (!response.ok) throw await parseFailure(response);
      releaseCandidateCommandResponseSchema.parse(await response.json());
      if (!active.current) return;
      setReconciliationRequired(true);
      setAttempt(value => value + 1);
    } catch (cause) {
      if (!active.current) return;
      const reference = cause instanceof RequestFailure && cause.correlationId ? ` Reference: ${cause.correlationId}` : '';
      if (cause instanceof RequestFailure && cause.status < 500 && cause.status !== 409) {
        setError(`Unable to save this candidate. Check your access and entered values.${reference}`);
      } else {
        setReconciliationRequired(true);
        setError(cause instanceof RequestFailure && cause.status === 409
          ? `This candidate changed. Refresh it before saving again.${reference}`
          : `The save result may be uncertain. Refresh the candidate before retrying.${reference}`);
      }
    } finally { if (active.current) setPending(false); }
  }

  async function recordSmokeTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || candidateBusy || reconciliationRequired) return;
    const data = new FormData(event.currentTarget);
    const parsed = appendReleaseSmokeTestRequestSchema.safeParse({
      expectedVersion: detail.version,
      testedContentVersion: detail.contentVersion,
      procedure: data.get('procedure'),
      results: data.get('results'),
      outcome: data.get('outcome'),
    });
    if (!parsed.success) {
      setError('Enter a non-empty procedure and result, each no longer than 10,000 characters.');
      return;
    }
    setPending(true); setError('');
    try {
      const response = await fetch(`/api/release-candidates/${encodeURIComponent(candidateId)}/smoke-tests`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken },
        body: JSON.stringify(parsed.data),
      });
      if (!active.current) return;
      if (response.status === 401) { setDetail(null); onSessionLost(); return; }
      if (response.status === 403) { setDetail(null); onSessionLost(); return; }
      if (!response.ok) throw await parseFailure(response);
      releaseCandidateCommandResponseSchema.parse(await response.json());
      if (!active.current) return;
      setReconciliationRequired(true);
      setAttempt(value => value + 1);
    } catch (cause) {
      if (!active.current) return;
      const reference = cause instanceof RequestFailure && cause.correlationId ? ` Reference: ${cause.correlationId}` : '';
      if (cause instanceof RequestFailure && cause.status < 500 && cause.status !== 409) {
        setError(`Unable to record this smoke test. Check your access and entered values.${reference}`);
      } else {
        setReconciliationRequired(true);
        setError(cause instanceof RequestFailure && cause.status === 409
          ? `This candidate changed. Refresh it before recording another smoke test.${reference}`
          : `The smoke-test result may be uncertain. Refresh the candidate before retrying.${reference}`);
      }
    } finally { if (active.current) setPending(false); }
  }

  async function addMember(item: EligibleReleaseProposalsResponse['items'][number]) {
    if (!detail || candidateBusy || reconciliationRequired) return;
    const parsed = addReleaseMemberRequestSchema.safeParse({
      expectedCandidateVersion: detail.version, expectedContentVersion: detail.contentVersion,
      proposalId: item.proposalId, revisionId: item.revisionId, assignmentId: item.assignmentId,
      expectedProposalVersion: item.proposalVersion, expectedAssignmentVersion: item.assignmentVersion,
    });
    if (!parsed.success) { setError('The eligible proposal coordinates are invalid. Refresh before trying again.'); return; }
    setPending(true); setError('');
    try {
      const response = await fetch(`/api/release-candidates/${encodeURIComponent(candidateId)}/members`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken },
        body: JSON.stringify(parsed.data),
      });
      if (!active.current) return;
      if (response.status === 401) { setDetail(null); onSessionLost(); return; }
      if (response.status === 403) { setDetail(null); onSessionLost(); return; }
      if (!response.ok) throw await parseFailure(response);
      releaseCandidateCommandResponseSchema.parse(await response.json());
      if (!active.current) return;
      setEligibleCursor(null); setReconciliationRequired(true); setAttempt(value => value + 1);
    } catch (cause) {
      if (!active.current) return;
      const reference = cause instanceof RequestFailure && cause.correlationId ? ` Reference: ${cause.correlationId}` : '';
      if (cause instanceof RequestFailure && cause.status < 500 && cause.status !== 409) {
        setError(`Unable to attach this proposal. Check your access and refresh eligibility.${reference}`);
      } else {
        setReconciliationRequired(true);
        setError(cause instanceof RequestFailure && cause.status === 409
          ? `Candidate or proposal state changed. Refresh detail and eligibility before retrying.${reference}`
          : `The attachment result may be uncertain. Refresh detail and eligibility before retrying.${reference}`);
      }
    } finally { if (active.current) setPending(false); }
  }

  async function removeMember(member: ReleaseCandidateDetailResponse['members'][number]) {
    if (!detail || candidateBusy || reconciliationRequired || member.status !== 'ATTACHED') return;
    if (!window.confirm(`Remove ${member.proposalTitle} from this release candidate?`)) return;
    const parsed = removeReleaseMemberRequestSchema.safeParse({
      expectedCandidateVersion: detail.version, expectedContentVersion: detail.contentVersion,
      memberId: member.id, expectedProposalVersion: member.proposalVersion,
    });
    if (!parsed.success) { setError('The member coordinates are invalid. Refresh before trying again.'); return; }
    setPending(true); setError('');
    try {
      const response = await fetch(`/api/release-candidates/${encodeURIComponent(candidateId)}/members/remove`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken },
        body: JSON.stringify(parsed.data),
      });
      if (!active.current) return;
      if (response.status === 401) { setDetail(null); onSessionLost(); return; }
      if (response.status === 403) { setDetail(null); onSessionLost(); return; }
      if (!response.ok) throw await parseFailure(response);
      releaseCandidateCommandResponseSchema.parse(await response.json());
      if (!active.current) return;
      setEligibleCursor(null); setReconciliationRequired(true); setAttempt(value => value + 1);
    } catch (cause) {
      if (!active.current) return;
      const reference = cause instanceof RequestFailure && cause.correlationId ? ` Reference: ${cause.correlationId}` : '';
      if (cause instanceof RequestFailure && cause.status < 500 && cause.status !== 409) {
        setError(`Unable to remove this proposal. Check your access and refresh the candidate.${reference}`);
      } else {
        setReconciliationRequired(true);
        setError(cause instanceof RequestFailure && cause.status === 409
          ? `Candidate or proposal state changed. Refresh detail and eligibility before retrying.${reference}`
          : `The removal result may be uncertain. Refresh detail and eligibility before retrying.${reference}`);
      }
    } finally { if (active.current) setPending(false); }
  }

  async function executePublish(intent: { body: { expectedVersion: number; expectedContentVersion: number }; key: string }) {
    if (!detail || candidateBusy || reconciliationRequired) return;
    setPending(true); setError('');
    try {
      const response = await fetch(`/api/release-candidates/${encodeURIComponent(candidateId)}/publish`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken,
          'idempotency-key': intent.key }, body: JSON.stringify(intent.body),
      });
      if (!active.current) return;
      if (response.status === 401) { setDetail(null); onSessionLost(); return; }
      if (response.status === 403) { setDetail(null); onSessionLost(); return; }
      if (!response.ok) throw await parseFailure(response);
      releasePublicationResponseSchema.parse(await response.json());
      if (!active.current) return;
      setPublishIntent(null); setPublishConfirmed(false); setReconciliationRequired(true);
      setAttempt(value => value + 1);
    } catch (cause) {
      if (!active.current) return;
      const reference = cause instanceof RequestFailure && cause.correlationId ? ` Reference: ${cause.correlationId}` : '';
      if (cause instanceof RequestFailure && cause.status < 500 && cause.status !== 409) {
        setPublishIntent(null);
        setError(`Unable to publish this candidate. Check your access and current gates.${reference}`);
      } else {
        if (cause instanceof RequestFailure && cause.status === 409) setPublishIntent(null);
        setReconciliationRequired(true);
        setError(cause instanceof RequestFailure && cause.status === 409
          ? `Publication was rejected because the candidate or a release gate changed. Refresh before creating a new publication intent.${reference}`
          : `The publication result may be uncertain. Refresh; if the candidate remains unchanged, retry uses the same protected request key.${reference}`);
      }
    } finally { if (active.current) setPending(false); }
  }

  function publish() {
    if (!detail || !publishConfirmed || detail.blockers.length || candidateBusy || reconciliationRequired) return;
    const parsed = publishReleaseCandidateRequestSchema.parse({ expectedVersion: detail.version,
      expectedContentVersion: detail.contentVersion });
    const intent = { body: parsed, key: crypto.randomUUID() };
    setPublishIntent(intent);
    void executePublish(intent);
  }

  if (loading) return <p role="status">Loading release candidate...</p>;
  if (!detail) return <><h1>Release candidate unavailable</h1>{error && <p role="alert">{error}</p>}<button onClick={() => setAttempt(value => value + 1)}>Retry</button><p><Link to="/releases">Back to release candidates</Link></p></>;
  const owner = detail.createdById === session.account.id;
  const editable = owner && detail.status === 'OPEN';
  return <>
    <p><Link to="/releases">Back to release candidates</Link></p>
    <div className="page-heading"><div><h1>Release {detail.versionLabel}</h1><p><span className="status-badge">{detail.status}</span> · Candidate version {detail.version} · Content version {detail.contentVersion}</p><p>Responsible Maintainer: {detail.createdById}</p></div></div>
    {detail.publication && <p className="notice">Published snapshot {detail.publication.snapshotId} at {new Date(detail.publication.createdAt).toLocaleString()}.</p>}
    {error && <p role="alert">{error}</p>}
    {eligibleError && <p role="alert">{eligibleError}</p>}
    {reconciliationRequired && <p><button type="button" disabled={loading || candidateBusy} onClick={() => setAttempt(value => value + 1)}>Refresh candidate before editing</button></p>}
    <RenderedRevocationAcknowledgements candidateId={detail.id} notices={detail.unreadRevocationNotices}
      session={session} onSessionLost={onSessionLost} />
    {detail.unreadRevocationNoticesTruncated && <p role="status">More unread revocation notices remain. Refresh after these displayed notices are marked read.</p>}
    {detail.status === 'RELEASED'
      ? <section className="draft-panel" aria-labelledby="publication-status-title"><h2 id="publication-status-title">Published release record</h2><p>The release is immutable; OPEN-candidate readiness gates no longer apply.</p></section>
      : <section className="draft-panel" aria-labelledby="readiness-title"><div className="panel-heading"><div><h2 id="readiness-title">Readiness</h2><p>Publication always rechecks these deterministic gates on the server.</p></div></div>
        {detail.blockers.length === 0 ? <p className="notice">All current deterministic gates pass.</p> : <ul>{detail.blockers.map((blocker, index) => <li key={`${blocker.code}:${blocker.proposalId ?? ''}:${index}`}><strong>{blocker.code}</strong>: {blockerText[blocker.code]}{blocker.proposalId ? ` Proposal ${blocker.proposalId}.` : ''}</li>)}</ul>}
      </section>}
    {editable && <ReleaseGateAssistant key={`${detail.id}:${detail.version}:${detail.contentVersion}`}
      detail={detail} session={session} onSessionLost={onSessionLost}
      disabled={candidateBusy || reconciliationRequired} onBusyChange={setAssistantBusy} />}
    <section><h2>Included proposals</h2>{detail.members.length === 0 ? <p>No proposals are attached.</p> : <ul>{detail.members.map(member => <li key={member.id}>
      <strong>{member.proposalTitle}</strong> · {member.status} · Revision {member.revisionNumber}
      <p>Proposal {member.proposalId} · proposal version {member.proposalVersion}</p>
      {editable && member.status === 'ATTACHED' && <button type="button" disabled={candidateBusy || reconciliationRequired}
        onClick={() => void removeMember(member)}>Remove from candidate</button>}
    </li>)}</ul>}</section>
    {editable && <section className="draft-panel" aria-labelledby="eligible-proposals-title"><h2 id="eligible-proposals-title">Eligible approved proposals</h2>
      {eligibleError ? <button type="button" disabled={loading || candidateBusy} onClick={() => setAttempt(value => value + 1)}>Retry detail and eligibility</button>
        : eligible?.items.length === 0 ? <p>No unattached approved proposals are currently eligible.</p>
          : <ul>{eligible?.items.map(item => <li key={item.proposalId}><strong>{item.title}</strong>
            <p>Contributor {item.owner.username} · Reviewer {item.reviewer.username} · Revision {item.revisionNumber}</p>
            <button type="button" disabled={candidateBusy || reconciliationRequired} onClick={() => void addMember(item)}>Add to candidate</button>
          </li>)}</ul>}
      {(eligibleCursor || eligible?.nextCursor) && <div className="pagination">
        {eligibleCursor && <button type="button" disabled={loading || candidateBusy || reconciliationRequired} onClick={() => setEligibleCursor(null)}>First eligible page</button>}
        {eligible?.nextCursor && <button type="button" disabled={loading || candidateBusy || reconciliationRequired} onClick={() => setEligibleCursor(eligible.nextCursor)}>Next eligible page</button>}
      </div>}
    </section>}
    <ReleaseSmokeHistory key={`${detail.id}:${detail.version}`} detail={detail} onSessionLost={onSessionLost} />
    {editable && <form className="draft-form" noValidate onSubmit={event => void recordSmokeTest(event)}>
      <h2>Record release smoke test</h2>
      <p>Record the checks run against content version {detail.contentVersion}. Readiness is recalculated by the server after refresh.</p>
      <label htmlFor="smoke-procedure">Procedure</label><textarea id="smoke-procedure" name="procedure" rows={4} required maxLength={10000} disabled={candidateBusy || reconciliationRequired} />
      <label htmlFor="smoke-results">Results</label><textarea id="smoke-results" name="results" rows={4} required maxLength={10000} disabled={candidateBusy || reconciliationRequired} />
      <label htmlFor="smoke-outcome">Outcome</label><select id="smoke-outcome" name="outcome" defaultValue="PASS" disabled={candidateBusy || reconciliationRequired}><option value="PASS">Pass</option><option value="FAIL">Fail</option></select>
      <button type="submit" disabled={candidateBusy || reconciliationRequired}>{pending ? 'Recording...' : 'Record smoke test'}</button>
    </form>}
    {editable && <section className="draft-panel" aria-labelledby="publication-title"><h2 id="publication-title">Publish immutable release</h2>
      <p>Publication is a human action. The server will atomically recheck every gate and snapshot the exact current contents.</p>
      <label><input type="checkbox" checked={publishConfirmed} disabled={candidateBusy || reconciliationRequired || detail.blockers.length > 0}
        onChange={event => setPublishConfirmed(event.target.checked)} />I confirm I intend to publish version {detail.versionLabel}.</label>
      <button type="button" disabled={!publishConfirmed || candidateBusy || reconciliationRequired || detail.blockers.length > 0} onClick={publish}>
        {pending ? 'Publishing...' : 'Publish release'}</button>
      {publishIntent && !reconciliationRequired && <><p role="status">An earlier publication response was uncertain; the candidate is unchanged.</p>
        <button type="button" disabled={candidateBusy} onClick={() => void executePublish(publishIntent)}>Retry identical publication request</button></>}
    </section>}
    {editable ? <form key={`${detail.version}:${detail.contentVersion}`} className="draft-form" onSubmit={event => void edit(event)}>
      <h2>Edit candidate details</h2>
      <label htmlFor="candidate-version">Semantic version</label><input id="candidate-version" name="versionLabel" defaultValue={detail.versionLabel} required disabled={candidateBusy || reconciliationRequired} />
      <label htmlFor="candidate-rollback">Rollback note</label><textarea id="candidate-rollback" name="rollbackNote" defaultValue={detail.rollbackNote} rows={4} required maxLength={10000} disabled={candidateBusy || reconciliationRequired} />
      <label htmlFor="candidate-dependencies">Dependency notes</label><textarea id="candidate-dependencies" name="dependencyNotes" defaultValue={detail.dependencyNotes} rows={3} maxLength={10000} disabled={candidateBusy || reconciliationRequired} />
      <button type="submit" disabled={candidateBusy || reconciliationRequired}>{pending ? 'Saving...' : 'Save candidate details'}</button>
    </form> : <section><h2>Candidate details</h2><p><strong>Rollback note:</strong> {detail.rollbackNote}</p><p><strong>Dependency notes:</strong> {detail.dependencyNotes || 'None.'}</p><p>This candidate is read only because {detail.status === 'RELEASED' ? 'it has been released' : 'another Release Maintainer created it'}.</p></section>}
    {detail.status === 'RELEASED' && <ReleaseAnnotations detail={detail} owner={owner} session={session} onSessionLost={onSessionLost} />}
  </>;
}

export function MaintainerWorkspace(props: Props) {
  return <section aria-label="Release Maintainer workspace"><Routes>
    <Route index element={<CandidateList {...props} />} />
    <Route path="audit" element={<MaintainerAudit {...props} />} />
    <Route path=":candidateId" element={<CandidateDetail {...props} />} />
  </Routes></section>;
}
