import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { assignedReviewsResponseSchema, proposalActivityResponseSchema, proposalDetailResponseSchema, reviewCommandResponseSchema, reviewPoolResponseSchema, submittedRevisionsResponseSchema, type AssignedReviewItem, type PoolItem, type ProposalDetailResponse, type ProposalActivityResponse, type SubmittedRevisionsResponse, type SessionResponse } from '@specsentry/shared';
import type { AuthorizationGeneration } from '../../shared/authorization';
import { ManualReview } from './ManualReview';
import { RevisionNotices } from './RevisionNotices';
import { acknowledgeNotificationResponseSchema } from '@specsentry/shared';

type Queue = { items: (PoolItem | AssignedReviewItem)[]; nextCursor: string | null };
type Parser<T> = { parse: (value: unknown) => T };
class StaleResponse extends Error {}
class RequestFailure extends Error { constructor(public status: number, public correlationId?: string) { super(); } }
const age = (date: string) => Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 86400000));
const date = (value: string) => new Date(value).toLocaleString();

export function ReviewerWorkspace({ session, authorization, onUnauthorized }: { session: SessionResponse; authorization: AuthorizationGeneration; onUnauthorized: () => void }) {
  const [tab, setTab] = useState<'pool' | 'assigned'>('pool');
  const [query, setQuery] = useState('');
  const [queue, setQueue] = useState<Queue | null>(null);
  const [detail, setDetail] = useState<ProposalDetailResponse | null>(null);
  const [history, setHistory] = useState<SubmittedRevisionsResponse | null>(null);
  const [activity, setActivity] = useState<ProposalActivityResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [stale, setStale] = useState(false);
  const [noticeRefresh, setNoticeRefresh] = useState(0);
  const [latest, setLatest] = useState<ProposalDetailResponse['latestRevision']>();
  const renderedView = useRef<{ detail: ProposalDetailResponse; generation: number } | null>(null);
  const acknowledged = useRef(new Set<string>());
  const generation = useRef(0);
  const mutationPending = useRef(false);
  const initialLoadNeeded = useRef(true);
  const title = useRef<HTMLHeadingElement>(null);
  const clearProtected = useCallback(() => { generation.current++; if (!mutationPending.current) setPending(false); setSelected(null); renderedView.current = null; setLatest(undefined); setDetail(null); setHistory(null); setActivity(null); setLoading(false); }, []);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => { if (detail) title.current?.focus(); }, [detail]);

  async function request<T>(url: string, schema: Parser<T>, local: number, body?: unknown, method = 'POST', key?: string): Promise<T> {
    const auth = authorization.current();
    const current = () => auth === authorization.current() && local === generation.current;
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...(body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken, ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(body) }) });
    if (!current()) throw new StaleResponse();
    if ([401, 403, 404].includes(response.status)) {
      authorization.invalidate(); clearProtected(); setQueue(null);
      if (response.status === 401) onUnauthorized();
      throw new RequestFailure(response.status);
    }
    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => null);
      if (!current()) throw new StaleResponse();
      const correlationId = errorBody && typeof errorBody === 'object' && 'correlationId' in errorBody && typeof errorBody.correlationId === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(errorBody.correlationId) ? errorBody.correlationId : undefined;
      throw new RequestFailure(response.status, correlationId);
    }
    const value = schema.parse(await response.json());
    if (!current()) throw new StaleResponse();
    return value;
  }
  function failed(cause: unknown) {
    if (cause instanceof StaleResponse) return;
    const reference = cause instanceof RequestFailure && cause.correlationId ? `Reference: ${cause.correlationId}` : '';
    setError((cause instanceof RequestFailure && cause.status === 409 ? 'This proposal changed. Refresh the queue before trying again.' : cause instanceof RequestFailure && [403, 404].includes(cause.status) ? 'Access to this proposal is no longer available. Return to the queue.' : 'Unable to load this request. Refresh to check the current state before trying again.') + (reference ? ' ' + reference : ''));
  }
  async function loadQueue(cursor?: string, nextTab = tab, nextQuery = query) {
    initialLoadNeeded.current = false;
    clearProtected(); const local = generation.current;
    setQueue(null); setLoading(true); setError('');
    try { const params = new URLSearchParams(nextQuery); if (cursor) params.set('cursor', cursor); setQueue(await request(`/api/${nextTab === 'pool' ? 'review-pool' : 'reviews/assignments'}?${params}`, nextTab === 'pool' ? reviewPoolResponseSchema : assignedReviewsResponseSchema, local)); }
    catch (cause) { failed(cause); }
    finally { if (local === generation.current) setLoading(false); }
  }
  // A remount follows account changes; navigation creates a separate response generation.
  useEffect(() => {
    let active = true;
    const initialGeneration = generation.current;
    const initialAuthorization = authorization.current();
    void Promise.resolve().then(() => {
      // Navigation can happen before this deferred work starts. It must not create
      // a newer pool request that supersedes the user's queue or proposal intent.
      if (active && initialLoadNeeded.current && generation.current === initialGeneration && authorization.current() === initialAuthorization) void loadQueue();
    });
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const revalidate = () => {
      // A focus read may replace pagination, but must not supersede a command
      // whose committed outcome is still being established.
      if (mutationPending.current) return;
      setNoticeRefresh(value => value + 1);
      if (selected && detail) {
        generation.current++; const local = generation.current; setPending(false); setStale(true);
        void request(`/api/proposals/${encodeURIComponent(selected)}?revisionId=${encodeURIComponent(detail.revision.id)}`, proposalDetailResponseSchema, local).then(value => { setLatest(value.latestRevision); }).catch(cause => { if (!(cause instanceof StaleResponse)) { if (!(cause instanceof RequestFailure && cause.status === 409)) setDetail(null); failed(cause); } });
      } else void loadQueue();
    };
    window.addEventListener('focus', revalidate);
    return () => window.removeEventListener('focus', revalidate);
  });
  async function open(id: string, revisionId?: string) {
    initialLoadNeeded.current = false;
    generation.current++; const local = generation.current;
    if (!mutationPending.current) setPending(false);
    renderedView.current = null; setLatest(undefined); setStale(false); setSelected(id); setDetail(null); setHistory(null); setActivity(null); setError(''); setLoading(true);
    try {
      const value = await request(`/api/proposals/${encodeURIComponent(id)}${revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : ''}`, proposalDetailResponseSchema, local);
      renderedView.current = { detail: value, generation: local };
      setLatest(value.latestRevision); setDetail(value);
      await Promise.all([request(`/api/proposals/${encodeURIComponent(id)}/revisions`, submittedRevisionsResponseSchema, local).then(setHistory), request(`/api/proposals/${encodeURIComponent(id)}/activity`, proposalActivityResponseSchema, local).then(setActivity)]);
    } catch (cause) { failed(cause); }
    finally { if (local === generation.current) setLoading(false); }
  }
  // Only committed, current view renders acknowledge a revision. Focus probes do not.
  useEffect(() => {
    const view = renderedView.current;
    const notice = detail?.revisionNotice;
    if (!view || view.detail !== detail || view.generation !== generation.current || !detail || !notice || notice.readAt) return;
    const token = `${view.generation}:${notice.id}`;
    if (acknowledged.current.has(token)) return;
    acknowledged.current.add(token);
    void request(`/api/notifications/${encodeURIComponent(notice.id)}/acknowledge`, acknowledgeNotificationResponseSchema, view.generation,
      { kind: 'NEW_REVISION', revisionId: detail.revision.id, assignmentId: detail.assignment.id, expectedAssignmentVersion: detail.assignment.version })
      .then(result => { setNoticeRefresh(value => value + 1); setDetail(current => current === detail ? { ...current, hasUnreadLatestRevision: current.revision.id === (current.latestRevision?.id ?? current.assignment.revisionId) ? false : current.hasUnreadLatestRevision, revisionNotice: { id: notice.id, readAt: result.readAt } } : current); })
      .catch(cause => { if (cause instanceof StaleResponse) return; if (cause instanceof RequestFailure && cause.status === 409) { setStale(true); setNotice('Revision notice changed. Refresh review explicitly to reconcile; the newer revision remains unread.'); setNoticeRefresh(value => value + 1); } else failed(cause); });
  }, [detail]); // eslint-disable-line react-hooks/exhaustive-deps
  async function command(item: PoolItem | ProposalDetailResponse, action: 'claim' | 'drop') {
    if (mutationPending.current) return;
    mutationPending.current = true;
    const local = generation.current; setPending(true); setError(''); setNotice('');
    try {
      const body = action === 'claim' ? { expectedVersion: item.version } : 'assignment' in item ? { expectedVersion: item.version, revisionId: item.assignment.revisionId, assignmentId: item.assignment.id, expectedAssignmentVersion: item.assignment.version } : {};
      const result = await request(`/api/proposals/${encodeURIComponent(item.id)}/${action}`, reviewCommandResponseSchema, local, body);
      if (action === 'claim') { setNotice('Proposal claimed.'); await open(result.proposalId); }
      else { clearProtected(); setNotice('Assignment dropped. Full proposal access has ended.'); await loadQueue(); }
    } catch (cause) { if (!(cause instanceof StaleResponse)) { if (cause instanceof RequestFailure && cause.status === 409) setStale(true); else { clearProtected(); setQueue(null); } failed(cause); } }
    finally { mutationPending.current = false; setPending(false); }
  }
  async function more(kind: 'history' | 'activity') {
    const page = kind === 'history' ? history : activity;
    if (!selected || !page?.nextCursor) return;
    const local = generation.current; setPending(true); setError('');
    try {
      const url = `/api/proposals/${encodeURIComponent(selected)}/${kind === 'history' ? 'revisions' : 'activity'}?cursor=${encodeURIComponent(page.nextCursor)}`;
      if (kind === 'history') setHistory(await request(url, submittedRevisionsResponseSchema, local));
      else setActivity(await request(url, proposalActivityResponseSchema, local));
    } catch (cause) { failed(cause); }
    finally { if (local === generation.current) setPending(false); }
  }
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const params = new URLSearchParams();
    for (const [key, value] of data) if (typeof value === 'string' && value !== '') params.set(key, value);
    const min = params.get('minAgeDays'); const max = params.get('maxAgeDays');
    if (min !== null && max !== null && Number(min) > Number(max)) { setError('Minimum age must not exceed maximum age.'); return; }
    setQuery(params.toString()); void loadQueue(undefined, tab, params.toString());
  }
  const revision = detail?.revision;
  return <section aria-label="Reviewer workspace">
    <h2>Reviewer workspace</h2>
    <RevisionNotices session={session} authorization={authorization} refresh={noticeRefresh} selected={selected}
      onOpen={(id, revisionId) => void open(id, revisionId)}
      onWithdrawn={() => { clearProtected(); setQueue(null); setNotice('Proposal withdrawn. Full proposal access has ended.'); }}
      onAccessLost={() => { authorization.invalidate(); clearProtected(); setQueue(null); }} onUnauthorized={onUnauthorized} />
    <nav aria-label="Review queues">{(['pool', 'assigned'] as const).map(value => <button key={value} disabled={pending} aria-pressed={tab === value} onClick={() => { setTab(value); setQuery(''); void loadQueue(undefined, value, ''); }}>{value === 'pool' ? 'Review pool' : 'My assignments'}</button>)}</nav>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    <button disabled={pending} onClick={() => void loadQueue()}>Refresh queue</button>
    {!selected && <>
      <h3>{tab === 'pool' ? 'Available proposals' : 'My assigned proposals'}</h3>
      <form key={tab} onSubmit={filter} aria-label="Filter proposals">
        <label htmlFor="authorId">Author ID</label><input id="authorId" name="authorId" maxLength={128} />
        <label htmlFor="minAgeDays">Minimum original age (days)</label><input id="minAgeDays" name="minAgeDays" type="number" min="0" max="365000" step="1" />
        <label htmlFor="maxAgeDays">Maximum original age (days)</label><input id="maxAgeDays" name="maxAgeDays" type="number" min="0" max="365000" step="1" />
        {tab === 'assigned' && <><label htmlFor="severity">Unresolved severity</label><select id="severity" name="severity"><option value="">All severities</option>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(value => <option key={value}>{value}</option>)}</select><label htmlFor="state">State</label><select id="state" name="state"><option value="">All states</option>{['IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'IN_RELEASE', 'RELEASED'].map(state => <option key={state}>{state}</option>)}</select></>}
        <button disabled={pending || loading}>Apply filters</button>
      </form>
      {queue?.items.length === 0 && <p>No proposals match these filters.</p>}
      <ul className="proposal-list">{queue?.items.map(item => <li key={item.id}><h4>{item.title}</h4><p>{item.summary}</p><p>Author: {item.author.username} ({item.author.id})</p><p>Original age: {age(item.firstSubmittedAt)} days · Latest revision age: {age(item.latestSubmittedAt)} days</p><p>First submitted: {date(item.firstSubmittedAt)} · Latest submitted: {date(item.latestSubmittedAt)}</p>{item.awaitingRevision && <p>Awaiting revision</p>}{'state' in item && <p>State: {item.state}</p>}{'hasUnreadLatestRevision' in item && item.hasUnreadLatestRevision && <p>Unread latest revision</p>}{tab === 'pool' ? <button disabled={pending} onClick={() => void command(item, 'claim')}>Claim {item.title}</button> : <button disabled={pending} onClick={() => void open(item.id)}>Open {item.title}</button>}</li>)}</ul>
      {queue?.nextCursor && <button disabled={pending || loading} onClick={() => void loadQueue(queue.nextCursor!)}>Next queue page</button>}
    </>}
    {loading && <p role="status">Loading review information…</p>}{pending && <p role="status">Request in progress…</p>}
    {detail && revision && <article>
      <h3 ref={title} tabIndex={-1}>{detail.title} — revision {revision.number}</h3><p>State: {detail.state}{detail.state === 'CHANGES_REQUESTED' ? ' · Awaiting revision' : ''}</p><p>Author: {detail.author.username} · Submitted: {date(revision.submittedAt)}</p>
      <p>Viewed revision: {revision.number} ({revision.id}); Latest revision: {(latest ?? detail.latestRevision)?.number ?? revision.number} ({(latest ?? detail.latestRevision)?.id ?? detail.assignment.revisionId})</p>
      {detail.hasUnreadLatestRevision && <p>Unread latest revision</p>}
      <p>This submitted revision is immutable. {revision.id === detail.assignment.revisionId ? 'Current assigned revision.' : 'Historical submitted revision (read only).'}</p><h4>Summary</h4><p className="plain-text">{revision.summary}</p><h4>Problem</h4><p className="plain-text">{revision.problem}</p><h4>Constraints</h4><p className="plain-text">{revision.constraints || 'None provided.'}</p><h4>Expected behavior</h4><p className="plain-text">{revision.expectedBehavior}</p>
      <h4>Acceptance criteria</h4><ul>{revision.criteria.map(criterion => <li key={criterion.id}><p>{criterion.stableKey}: {criterion.statement} ({criterion.required ? 'Required' : 'Optional'})</p><p>Linked evidence: {revision.criterionEvidenceLinks.filter(link => link.criterionId === criterion.id).map(link => link.evidenceId).join(', ') || 'None'}</p></li>)}</ul>
      <h4>Submitted diff</h4><pre>{revision.diffText || 'No diff provided.'}</pre><h4>Test evidence</h4>{revision.evidence.length === 0 ? <p>No evidence provided.</p> : revision.evidence.map(evidence => <section key={evidence.id}><h5>{evidence.id}</h5><pre>{evidence.text}</pre><p>Evidence hash: {evidence.evidenceHash}</p></section>)}
      <ManualReview key={`${detail.id}:${revision.id}:${detail.version}:${detail.assignment.id}:${detail.assignment.version}`} detail={detail} stale={stale} busy={pending} request={(url, schema, body, method, key) => request(url, schema, generation.current, body, method, key)} onRefresh={() => void open(detail.id)} onChanged={message => { setNotice(message); void open(detail.id); }} onBusy={value => { mutationPending.current = value; setPending(value); }} />
      <button disabled={stale || pending || !['IN_REVIEW', 'CHANGES_REQUESTED'].includes(detail.state)} onClick={() => void command(detail, 'drop')}>Drop assignment</button>
      <h4>Submitted revision history</h4>{history?.items.length === 0 && <p>No submitted revisions.</p>}<ul>{history?.items.map(item => <li key={item.id}><button disabled={pending || item.id === revision.id} onClick={() => void open(detail.id, item.id)}>View revision {item.number}</button> {item.summary} · {date(item.submittedAt)}</li>)}</ul>{history?.nextCursor && <button disabled={pending} onClick={() => void more('history')}>Next history page</button>}
      <h4>Proposal activity</h4>{activity?.items.length === 0 && <p>No activity recorded.</p>}<ol>{activity?.items.map(item => <li key={item.id}>{date(item.timestamp)} · {item.actor?.username ?? 'System'} · {item.action} · {item.summary}<p>Proposal: {item.proposalId}</p><p>Affected revision: {item.revisionId}</p><p>Assignment: {item.assignmentId ?? 'None'}</p><p>Outcome: {item.outcome === 'SUCCESS' ? 'Success' : item.outcome}</p>{item.reason && <p>{item.reason}</p>}</li>)}</ol>{activity?.nextCursor && <button disabled={pending} onClick={() => void more('activity')}>Next activity page</button>}
    </article>}
  </section>;
}

