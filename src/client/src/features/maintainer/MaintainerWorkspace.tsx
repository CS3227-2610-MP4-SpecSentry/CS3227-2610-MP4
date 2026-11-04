import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  createReleaseCandidateRequestSchema,
  releaseCandidateCommandResponseSchema,
  releaseCandidateDetailResponseSchema,
  releaseCandidatesResponseSchema,
  updateReleaseCandidateRequestSchema,
  type ReleaseCandidateDetailResponse,
  type ReleaseCandidatesResponse,
  type SessionResponse,
} from '@specsentry/shared';
import { Icon } from '../../shared/Icon';

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
      if (response.status === 401) { onSessionLost(); return; }
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
      if (response.status === 401) { onSessionLost(); return; }
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
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const request = useRef(0);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    const local = ++request.current;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/release-candidates/${encodeURIComponent(candidateId)}`, {
        credentials: 'same-origin', cache: 'no-store', signal,
      });
      if (signal?.aborted || local !== request.current) throw new StaleResponse();
      if (response.status === 401) { setDetail(null); onSessionLost(); return; }
      if (!response.ok) throw await parseFailure(response);
      const result = releaseCandidateDetailResponseSchema.parse(await response.json());
      if (!signal?.aborted && local === request.current) {
        setDetail(result);
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
  }, [candidateId, onSessionLost]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load, attempt]);

  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || pending || reconciliationRequired) return;
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

  if (loading) return <p role="status">Loading release candidate...</p>;
  if (!detail) return <><h1>Release candidate unavailable</h1>{error && <p role="alert">{error}</p>}<button onClick={() => setAttempt(value => value + 1)}>Retry</button><p><Link to="/releases">Back to release candidates</Link></p></>;
  const owner = detail.createdById === session.account.id;
  const editable = owner && detail.status === 'OPEN';
  return <>
    <p><Link to="/releases">Back to release candidates</Link></p>
    <div className="page-heading"><div><h1>Release {detail.versionLabel}</h1><p><span className="status-badge">{detail.status}</span> · Candidate version {detail.version} · Content version {detail.contentVersion}</p><p>Responsible Maintainer: {detail.createdById}</p></div></div>
    {error && <p role="alert">{error}</p>}
    {reconciliationRequired && <p><button type="button" disabled={loading || pending} onClick={() => setAttempt(value => value + 1)}>Refresh candidate before editing</button></p>}
    <section className="draft-panel" aria-labelledby="readiness-title"><div className="panel-heading"><div><h2 id="readiness-title">Readiness</h2><p>Publication always rechecks these deterministic gates on the server.</p></div></div>
      {detail.blockers.length === 0 ? <p className="notice">All current deterministic gates pass.</p> : <ul>{detail.blockers.map((blocker, index) => <li key={`${blocker.code}:${blocker.proposalId ?? ''}:${index}`}><strong>{blocker.code}</strong>: {blockerText[blocker.code]}{blocker.proposalId ? ` Proposal ${blocker.proposalId}.` : ''}</li>)}</ul>}
    </section>
    <section><h2>Included proposals</h2>{detail.members.length === 0 ? <p>No proposals are attached.</p> : <ul>{detail.members.map(member => <li key={member.id}>Proposal {member.proposalId} · {member.status} · Revision {member.revisionId}</li>)}</ul>}</section>
    <section><h2>Smoke-test history</h2>{detail.smokeTests.length === 0 ? <p>No smoke tests recorded.</p> : <ol>{detail.smokeTests.map(test => <li key={test.id}><strong>{test.outcome}</strong> for content version {test.testedContentVersion}: {test.procedure}<p>{test.results}</p></li>)}</ol>}</section>
    {editable ? <form key={`${detail.version}:${detail.contentVersion}`} className="draft-form" onSubmit={event => void edit(event)}>
      <h2>Edit candidate details</h2>
      <label htmlFor="candidate-version">Semantic version</label><input id="candidate-version" name="versionLabel" defaultValue={detail.versionLabel} required disabled={pending || reconciliationRequired} />
      <label htmlFor="candidate-rollback">Rollback note</label><textarea id="candidate-rollback" name="rollbackNote" defaultValue={detail.rollbackNote} rows={4} required maxLength={10000} disabled={pending || reconciliationRequired} />
      <label htmlFor="candidate-dependencies">Dependency notes</label><textarea id="candidate-dependencies" name="dependencyNotes" defaultValue={detail.dependencyNotes} rows={3} maxLength={10000} disabled={pending || reconciliationRequired} />
      <button type="submit" disabled={pending || reconciliationRequired}>{pending ? 'Saving...' : 'Save candidate details'}</button>
    </form> : <section><h2>Candidate details</h2><p><strong>Rollback note:</strong> {detail.rollbackNote}</p><p><strong>Dependency notes:</strong> {detail.dependencyNotes || 'None.'}</p><p>This candidate is read only because {detail.status === 'RELEASED' ? 'it has been released' : 'another Release Maintainer created it'}.</p></section>}
  </>;
}

export function MaintainerWorkspace(props: Props) {
  return <section aria-label="Release Maintainer workspace"><Routes>
    <Route index element={<CandidateList {...props} />} />
    <Route path=":candidateId" element={<CandidateDetail {...props} />} />
  </Routes></section>;
}
