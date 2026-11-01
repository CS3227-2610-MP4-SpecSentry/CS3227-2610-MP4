import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { cloneLatestRequestSchema, decisionsResponseSchema, draftResponseSchema, findingHistoryResponseSchema, findingResponseCommandResponseSchema,
  findingResponseRequestSchema, findingResponsesResponseSchema, findingsResponseSchema, ownProposalsResponseSchema, proposalActivityResponseSchema,
  proposalLifecycleResponseSchema, reopenProposalRequestSchema, submittedProposalDetailResponseSchema,
  submittedRevisionsResponseSchema, submitProposalRequestSchema, withdrawProposalRequestSchema,
  type SessionResponse } from '@specsentry/shared';
import { useNavigationGuard } from '../../shared/navigationGuard';

type Props = { session: SessionResponse; onSessionLost(): void };
type CommandResult = ReturnType<typeof proposalLifecycleResponseSchema.parse>;
const editableProposalStates = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED'];

export function ProposalActions({ proposalId, version, state, workingRevisionId, latestRevisionId, session, onSessionLost, onCommitted, onLockChange, disabled = false }: Props & {
  proposalId: string; version: number; state: string; workingRevisionId?: string; latestRevisionId?: string; disabled?: boolean;
  onCommitted(result: CommandResult, operation: string): void;
  onLockChange?(locked: boolean): void;
}) {
  const [operation, setOperation] = useState<'submit' | 'withdraw' | 'reopen' | 'clone-latest' | null>(null);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [retryReady, setRetryReady] = useState(false);
  const [error, setError] = useState('');
  const [invalidReason, setInvalidReason] = useState(false);
  const command = useRef<{ operation: string; body: unknown; key?: string } | null>(null);
  const busy = useRef(false);
  const active = useRef(true);
  const cancel = useRef<HTMLButtonElement>(null);
  const guard = useNavigationGuard(pending ? 'A proposal action is pending. Leaving does not cancel it; its result may be uncertain. Leave?'
    : blocked ? 'The proposal action result needs reconciliation. Leaving does not establish whether it succeeded. Leave?'
      : reason ? 'Leave and discard your withdrawal reason?' : '');
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (operation) cancel.current?.focus(); }, [operation]);

  async function execute(event: FormEvent, retry = false) {
    event.preventDefault();
    if (busy.current || !operation || (blocked && !retryReady)) return;
    if (!retry) {
      const parsed = operation === 'clone-latest' ? cloneLatestRequestSchema.safeParse({ expectedVersion: version, confirmed: true, revisionId: latestRevisionId })
        : operation === 'withdraw' ? withdrawProposalRequestSchema.safeParse({ expectedVersion: version, confirmed: true, reason })
        : operation === 'reopen' ? reopenProposalRequestSchema.safeParse({ expectedVersion: version })
          : submitProposalRequestSchema.safeParse({ expectedVersion: version, workingRevisionId });
      if (!parsed.success) {
        setInvalidReason(operation === 'withdraw'); setError('Enter a non-empty withdrawal reason of at most 2,000 characters.');
        if (operation === 'withdraw') document.getElementById('withdraw-reason')?.focus();
        return;
      }
      command.current = { operation, body: parsed.data, ...(operation === 'submit' ? { key: crypto.randomUUID() } : {}) };
    }
    const sent = command.current;
    if (!sent) return;
    busy.current = true; setPending(true); setError(''); setInvalidReason(false); setRetryReady(false);
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}/${sent.operation}`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken,
          ...(sent.key ? { 'Idempotency-Key': sent.key } : {}) }, body: JSON.stringify(sent.body),
      });
      if (response.status === 401) { onSessionLost(); return; }
      if (!active.current) return;
      if (!response.ok) {
        if (response.status === 409) command.current = null;
        if (response.status === 409 || response.status >= 500) setBlocked(true);
        setError(response.status === 409 ? 'The proposal changed or this action is no longer allowed. Check its current state before another action.'
          : response.status >= 500 ? 'The action result is uncertain. Check the current state before continuing.'
            : response.status === 422 ? 'The saved working copy needs a summary, a required criterion and a valid non-empty unified diff before submission. Check your inputs.'
              : 'This action could not be completed. Your entered text is retained.');
        return;
      }
      const result = proposalLifecycleResponseSchema.parse(await response.json());
      if (!active.current) return;
      if (result.proposalId !== proposalId || result.version !== version + 1) throw new Error();
      guard.release(); setReason(''); setOperation(null); command.current = null;
      onLockChange?.(false);
      onCommitted(result, sent.operation);
    } catch {
      if (active.current) { setBlocked(true); setError('The action result is uncertain. Your entered text is retained. Check the current state before continuing.'); }
    } finally { busy.current = false; if (active.current) setPending(false); }
  }
  async function check() {
    if (busy.current) return;
    busy.current = true; setPending(true);
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}/draft`, { credentials: 'same-origin' });
      if (response.status === 401) { onSessionLost(); return; }
      if (!active.current) return;
      if (!response.ok) throw new Error();
      const current = draftResponseSchema.parse(await response.json());
      if (!active.current) return;
      if (current.proposalId !== proposalId) throw new Error();
      if (command.current?.key) {
        setRetryReady(true); setError(`Current state: ${current.state}, version ${current.version}. Retry the original submission to recover its recorded result; the same key and body will be used.`);
      } else {
        guard.release(); setReason(''); setOperation(null);
        onLockChange?.(false);
        onCommitted({ proposalId, version: current.version, state: current.state, workingRevisionId: current.workingRevisionId,
          revisionId: null, assignmentId: null, assignmentVersion: null }, 'refresh');
      }
    } catch { if (active.current) setError('Unable to check the current state. Actions remain paused; keep this page and try checking again.'); }
    finally { busy.current = false; if (active.current) setPending(false); }
  }
  return <section aria-label="Proposal actions">
    {editableProposalStates.includes(state) && workingRevisionId && <button disabled={disabled || pending || blocked || !!operation} onClick={() => { setOperation('submit'); onLockChange?.(true); }}>Submit saved working copy</button>}
    {editableProposalStates.includes(state) && state !== 'DRAFT' && latestRevisionId && <button disabled={disabled || pending || blocked || !!operation} onClick={() => { setOperation('clone-latest'); onLockChange?.(true); }}>Clone latest submitted content</button>}
    {editableProposalStates.includes(state) && <button disabled={disabled || pending || blocked || !!operation} onClick={() => { setOperation('withdraw'); onLockChange?.(true); }}>Withdraw proposal</button>}
    {state === 'APPROVED' && <button disabled={disabled || pending || blocked || !!operation} onClick={() => { setOperation('reopen'); onLockChange?.(true); }}>Reopen approval for revision</button>}
    {operation && <form onSubmit={event => void execute(event, retryReady)} aria-label={`Confirm ${operation}`}>
      <h2>{operation === 'submit' ? 'Publish an immutable revision' : operation === 'withdraw' ? 'Confirm withdrawal' : operation === 'clone-latest' ? 'Replace the saved private working copy' : 'Confirm reopening'}</h2>
      <p>{operation === 'submit' ? 'Publish the saved working copy, including its summary, patch and optional evidence. Any existing reviewer stays assigned; earlier revisions remain unchanged.'
        : operation === 'withdraw' ? 'Withdrawal is terminal and closes any reviewer assignment. The reviewer will be notified. An attached proposal cannot be withdrawn.'
          : operation === 'clone-latest' ? 'Replace all saved private working content with the latest submitted revision, even if you are viewing an older revision. Existing private changes will be overwritten. Submitted history, criterion identities and findings remain preserved. This does not submit anything.'
            : 'Reopening invalidates this approval and moves the proposal to changes requested. Remove any release-candidate attachment first.'}</p>
      {operation === 'withdraw' && <><label htmlFor="withdraw-reason">Withdrawal reason (required)</label>
        <p id="withdraw-reason-hint">Plain text, at most 2,000 characters. Recorded in proposal activity.</p>
        <textarea id="withdraw-reason" aria-invalid={invalidReason} aria-describedby={`withdraw-reason-hint${invalidReason ? ' proposal-action-error' : ''}`} value={reason} disabled={pending || blocked} onChange={event => { setReason(event.target.value); setInvalidReason(false); }} /></>}
      <button type="button" ref={cancel} disabled={pending || blocked} onClick={() => { setOperation(null); setReason(''); setError(''); setInvalidReason(false); onLockChange?.(false); }}>Cancel action</button>
      <button disabled={pending || (blocked && !retryReady)} type="submit">{pending ? 'Waiting for result...' : retryReady ? 'Retry original submission' : `Confirm ${operation}`}</button>
    </form>}
    {error && <p role="alert" id="proposal-action-error">{error}</p>}
    {blocked && <button disabled={pending} onClick={() => void check()}>Check current proposal state</button>}
  </section>;
}

type Detail = ReturnType<typeof submittedProposalDetailResponseSchema.parse>;
type Snapshot = { detail: Detail; revisions: ReturnType<typeof submittedRevisionsResponseSchema.parse>;
  findings: ReturnType<typeof findingsResponseSchema.parse>; decisions: ReturnType<typeof decisionsResponseSchema.parse>;
  responses: ReturnType<typeof findingResponsesResponseSchema.parse>;
  activity: ReturnType<typeof proposalActivityResponseSchema.parse>; numbers: Record<string, number> };
type PageKind = 'revisions' | 'findings' | 'decisions' | 'activity' | 'responses';
const pageSchemas = { revisions: submittedRevisionsResponseSchema, findings: findingsResponseSchema,
  decisions: decisionsResponseSchema, activity: proposalActivityResponseSchema, responses: findingResponsesResponseSchema };

export function OwnProposals({ onSessionLost }: Props) {
  const [page, setPage] = useState<ReturnType<typeof ownProposalsResponseSchema.parse> | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setPage(null); setError('');
      try {
        const response = await fetch(`/api/proposals/owned${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { credentials: 'same-origin', signal: controller.signal });
        if (response.status === 401) { onSessionLost(); return; }
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error();
        const next = ownProposalsResponseSchema.parse(await response.json());
        if (!controller.signal.aborted) setPage(next);
      } catch { if (!controller.signal.aborted) setError('Unable to load your proposals. Retry when your connection is available.'); }
    }
    void load(); return () => controller.abort();
  }, [cursor, attempt, onSessionLost]);
  return <>
    <header className="task-heading"><nav aria-label="Breadcrumb"><ol><li><Link to="/contributor">Private drafts</Link></li><li><span aria-current="page">All proposals</span></li></ol></nav><h1>Your proposals</h1></header>
    <p>Only your proposals appear here. Working copies remain private; submitted revisions preserve their review history.</p>
    <p><Link className="button" to="/contributor/new">Create New Draft</Link></p>
    <section className="draft-panel" aria-label="Your proposals across lifecycle states"><div className="panel-heading"><h2>All lifecycle states</h2>
      <p className="draft-count">Proposals on this page: {error ? 'Unavailable' : page ? page.items.length : 'Loading'}</p></div>
      {error ? <div className="panel-state"><p role="alert">{error}</p><button onClick={() => setAttempt(value => value + 1)}>Retry loading proposals</button></div>
        : !page ? <p role="status">Loading your proposals...</p>
          : !page.items.length ? <p>No proposals on this page. Create a draft to get started.</p>
            : <ul className="draft-list">{page.items.map(item => <li key={item.proposalId}><Link className="draft-row-link" to={`/contributor/${item.latestRevision ? 'proposals' : 'drafts'}/${encodeURIComponent(item.proposalId)}`}>
              <span className="draft-row-content"><strong>{item.title}</strong>{' '}<span>{item.latestRevision ? `Latest submitted revision ${item.latestRevision.number}` : 'Never submitted'}</span></span>{' '}<span className="status-badge">{item.state}</span>
            </Link></li>)}</ul>}
      {page && <div className="pagination">{cursor && <button onClick={() => setCursor(null)}>First page</button>}{page.nextCursor && <button onClick={() => setCursor(page.nextCursor)}>Next page</button>}</div>}
    </section>
  </>;
}

function FindingResponseForm({ proposalId, findingId, version, revisionId, session, onSessionLost, onDone, read }: Props & {
  proposalId: string; findingId: string; version: number; revisionId: string; onDone(): void; read(path: string): Promise<unknown>;
}) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [invalidText, setInvalidText] = useState(false);
  const busy = useRef(false); const active = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const guard = useNavigationGuard(pending ? 'A finding response is pending. Leaving does not cancel it; its result may be uncertain. Leave?'
    : blocked ? 'The finding response needs reconciliation. Leaving discards local text without establishing the request result. Leave?' : text ? 'Leave and discard your finding response?' : '');
  useEffect(() => { active.current = true; input.current?.focus(); return () => { active.current = false; }; }, []);
  async function send(event: FormEvent) {
    event.preventDefault(); if (busy.current || blocked) return;
    const parsed = findingResponseRequestSchema.safeParse({ expectedVersion: version, revisionId, text });
    if (!parsed.success) { setInvalidText(true); setError('Enter a non-empty response of at most 2,000 characters.'); input.current?.focus(); return; }
    busy.current = true; setPending(true); setError(''); setInvalidText(false);
    try {
      const response = await fetch(`/api/findings/${encodeURIComponent(findingId)}/responses`, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken }, body: JSON.stringify(parsed.data) });
      if (response.status === 401) { onSessionLost(); return; }
      if (!active.current) return;
      if (!response.ok) {
        if (response.status === 409 || response.status >= 500) setBlocked(true);
        setError(response.status === 409 ? 'The proposal changed. Your response is retained; check the current state before another response.'
          : response.status >= 500 ? 'The response result is uncertain. Your text is retained; check the current state before continuing.' : 'Unable to add this response. Your text is retained.'); return;
      }
      const result = findingResponseCommandResponseSchema.parse(await response.json());
      if (!active.current) return;
      if (result.proposalId !== proposalId || result.response.proposalId !== proposalId || result.version !== version + 1 || result.response.mutationVersion !== result.version || result.response.findingId !== findingId
        || result.response.revisionId !== revisionId || result.response.actor.id !== session.account.id || result.response.text !== parsed.data.text) throw new Error();
      guard.release(); onDone();
    } catch { if (active.current) { setBlocked(true); setError('The response result is uncertain. Your text is retained; check current state before continuing.'); } }
    finally { busy.current = false; if (active.current) setPending(false); }
  }
  async function check() {
    if (busy.current) return; busy.current = true; setPending(true);
    try {
      const current = submittedProposalDetailResponseSchema.parse(await read(`/api/proposals/${encodeURIComponent(proposalId)}`));
      if (!active.current) return;
      if (current.id !== proposalId) throw new Error();
      setChecked(true); setError(`Current state: ${current.state}, version ${current.version}. Refresh the proposal to inspect attributed response history before creating another response. This form will not be retried automatically.`);
    } catch { if (active.current) setError('Unable to check current state. Keep your text here and retry checking.'); }
    finally { busy.current = false; if (active.current) setPending(false); }
  }
  return <form aria-label="Respond to finding" onSubmit={event => void send(event)}>
    <h3>Plain-text finding response</h3><p id="finding-response-hint">At most 2,000 characters. Your name and response appear in activity. This never resolves the finding.</p>
    <label htmlFor="finding-response-text">Response text (required)</label><textarea ref={input} id="finding-response-text" aria-invalid={invalidText} aria-describedby={`finding-response-hint${invalidText ? ' finding-response-error' : ''}`} value={text} disabled={pending || blocked} onChange={event => { setText(event.target.value); setInvalidText(false); }} />
    {error && <p role="alert" id="finding-response-error">{error}</p>}
    <button disabled={pending || blocked} type="submit">Add finding response</button>
    {blocked && <button type="button" disabled={pending} onClick={() => void check()}>Check current response state</button>}
    <button type="button" disabled={pending || (blocked && !checked)} onClick={() => { guard.release(); onDone(); }}>{blocked ? 'Discard response form and refresh proposal' : 'Cancel response'}</button>
  </form>;
}

function FindingHistory({ proposalId, findingId, read }: { proposalId: string; findingId: string; read(path: string): Promise<unknown> }) {
  const [page, setPage] = useState<ReturnType<typeof findingHistoryResponseSchema.parse> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function load() {
    if (pending) return;
    setPending(true); setError('');
    try {
      const next = findingHistoryResponseSchema.parse(await read(`/api/proposals/${encodeURIComponent(proposalId)}/findings/${encodeURIComponent(findingId)}/history${page?.nextCursor ? `?cursor=${encodeURIComponent(page.nextCursor)}` : ''}`));
      if (next.items.some(item => item.proposalId !== proposalId || item.findingId !== findingId)) throw new Error();
      if (active.current) setPage(previous => ({ items: [...(previous?.items ?? []), ...next.items], nextCursor: next.nextCursor }));
    } catch { if (active.current) setError('Unable to load finding history. Retry when your connection is available.'); }
    finally { if (active.current) setPending(false); }
  }
  return <>
    {(!page || page.nextCursor) && <button disabled={pending} onClick={() => void load()}>{page ? 'Load more finding history' : 'Show finding amendments and history'}</button>}
    {error && <p role="alert">{error}</p>}
    {page && (!page.items.length ? <p>No amendments or transitions recorded.</p> : <ol>{page.items.map(event => <li key={event.id}>
      <p>{event.operation} · {event.actor.username} · {event.createdAt}</p>{event.description && <p>{event.description}</p>}<p>{event.reason}</p>
    </li>)}</ol>)}
  </>;
}

export function SubmittedProposal(props: Props) {
  const { id = '' } = useParams();
  return <SubmittedDetail key={id} id={id} {...props} />;
}

function SubmittedDetail({ id, session, onSessionLost }: Props & { id: string }) {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [revisionId, setRevisionId] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [actionLocked, setActionLocked] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const active = useRef(true);
  const generation = useRef(0);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const base = `/api/proposals/${encodeURIComponent(id)}`;
  async function read(path: string, signal?: AbortSignal): Promise<unknown> {
    const response = await fetch(path, { credentials: 'same-origin', signal });
    if (response.status === 401) { if (active.current) setSnapshot(null); onSessionLost(); throw new Error(); }
    if (signal?.aborted) throw new Error();
    if (response.status === 403 || response.status === 404) { if (active.current) setSnapshot(null); throw new Error(); }
    if (!response.ok) throw new Error();
    return response.json();
  }
  async function numbersFor(decisions: Snapshot['decisions']['items'], revisions: Snapshot['revisions']['items'], detail: Detail, signal?: AbortSignal) {
    const numbers: Record<string, number> = { [detail.revision.id]: detail.revision.number,
      ...Object.fromEntries(revisions.map(revision => [revision.id, revision.number])) };
    const missing = [...new Set(decisions.map(decision => decision.revisionId))].filter(revision => numbers[revision] === undefined);
    await Promise.all(missing.map(async revision => {
      const other = submittedProposalDetailResponseSchema.parse(await read(`${base}?revisionId=${encodeURIComponent(revision)}`, signal));
      if (other.id !== id || other.revision.id !== revision) throw new Error();
      numbers[revision] = other.revision.number;
    }));
    return numbers;
  }
  useEffect(() => {
    const controller = new AbortController(); const current = ++generation.current;
    async function load() {
      setLoading(true); setError('');
      try {
        const [rawDetail, rawRevisions, rawFindings, rawDecisions, rawActivity, rawResponses] = await Promise.all([
          read(`${base}${revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : ''}`, controller.signal),
          read(`${base}/revisions`, controller.signal), read(`${base}/findings`, controller.signal),
          read(`${base}/decisions`, controller.signal), read(`${base}/activity`, controller.signal),
          read(`${base}/responses`, controller.signal),
        ]);
        const detail = submittedProposalDetailResponseSchema.parse(rawDetail);
        if (detail.id !== id || (revisionId && detail.revision.id !== revisionId)) throw new Error();
        const revisions = submittedRevisionsResponseSchema.parse(rawRevisions);
        const findings = findingsResponseSchema.parse(rawFindings);
        const decisions = decisionsResponseSchema.parse(rawDecisions);
        const activity = proposalActivityResponseSchema.parse(rawActivity);
        const responses = findingResponsesResponseSchema.parse(rawResponses);
        const numbers = await numbersFor(decisions.items, revisions.items, detail, controller.signal);
        if (!controller.signal.aborted && current === generation.current) setSnapshot({ detail, revisions, findings, decisions, activity, responses, numbers });
      } catch { if (!controller.signal.aborted && current === generation.current) setError('Unable to load this submitted proposal. Check your access and connection, then retry.'); }
      finally { if (!controller.signal.aborted && current === generation.current) setLoading(false); }
    }
    void load(); return () => controller.abort();
    // Reading is tied to the scoped route and explicit refresh, never to draft edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, id, revisionId, attempt, onSessionLost]);

  async function more(kind: PageKind) {
    if (!snapshot || paging || loading || actionLocked) return;
    const cursor = snapshot[kind].nextCursor;
    if (!cursor) return;
    const current = generation.current; setPaging(true); setError('');
    try {
      const page = pageSchemas[kind].parse(await read(`${base}/${kind}?cursor=${encodeURIComponent(cursor)}`));
      const numbers = kind === 'decisions' ? await numbersFor(decisionsResponseSchema.parse(page).items, snapshot.revisions.items, snapshot.detail) : {};
      if (!active.current || current !== generation.current) return;
      setSnapshot(previous => previous ? { ...previous, numbers: { ...previous.numbers, ...numbers }, [kind]: {
        items: [...previous[kind].items, ...page.items], nextCursor: page.nextCursor,
      } } as Snapshot : null);
    } catch { if (active.current && current === generation.current) setError('Unable to load more history. Existing entries are retained; retry when your connection is available.'); }
    finally { if (active.current) setPaging(false); }
  }
  const detail = snapshot?.detail;
  return <>
    <header className="task-heading"><nav aria-label="Breadcrumb"><ol><li><Link to="/contributor/proposals">All your proposals</Link></li>
      <li className="draft-title-crumb"><span aria-current="page" title={detail?.title ?? 'Submitted proposal'}>{detail?.title ?? 'Submitted proposal'}</span></li></ol></nav><h1>Submitted proposal</h1></header>
    {error && <p role="alert">{error}</p>}
    <button disabled={loading || paging || actionLocked} onClick={() => setAttempt(value => value + 1)}>Refresh submitted proposal</button>
    {loading && <p role="status">Loading submitted history...</p>}
    {snapshot && detail && <>
      <h2 style={{ overflowWrap: 'anywhere' }}>{detail.title}</h2><p>Current proposal title and lifecycle metadata. Historical titles are unavailable.</p><p>Current state: {detail.state}. Reviewer: {detail.assignment?.reviewer.username ?? 'Unassigned'}.</p>
      <p>Viewing immutable submitted revision {detail.revision.number}. Latest submitted revision: {detail.latestRevision?.number ?? detail.revision.number}.</p>
      <label htmlFor="submitted-revision">Submitted revision</label>
      <select id="submitted-revision" value={detail.revision.id} disabled={loading || paging || actionLocked} onChange={event => setRevisionId(event.target.value)}>
        {!snapshot.revisions.items.some(revision => revision.id === detail.revision.id) && <option value={detail.revision.id}>Revision {detail.revision.number}</option>}
        {snapshot.revisions.items.map(revision => <option value={revision.id} key={revision.id}>Revision {revision.number}: {revision.summary}</option>)}
      </select>
      {snapshot.revisions.nextCursor && <button disabled={loading || paging || actionLocked} onClick={() => void more('revisions')}>Load older revisions</button>}
      <section aria-label="Immutable submitted content"><h2>Submitted content</h2>
        <dl>{(['summary', 'problem', 'constraints', 'expectedBehavior'] as const).map(field => <div key={field}><dt>{({ summary: 'Contributor summary', problem: 'Problem', constraints: 'Constraints', expectedBehavior: 'Expected behavior' })[field]}</dt><dd>{detail.revision[field] || 'None provided.'}</dd></div>)}</dl>
        <h3>Acceptance criteria</h3><ol>{detail.revision.criteria.map(criterion => <li key={criterion.id}><span>{criterion.required ? 'Required' : 'Optional'}</span><p>{criterion.statement}</p></li>)}</ol>
        <h3>Unified diff</h3><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{detail.revision.diffText}</pre>
        <h3>Plain-text evidence</h3>{detail.revision.evidence.length ? <ol>{detail.revision.evidence.map(item => <li key={item.id}>{item.text}</li>)}</ol> : <p>No evidence supplied.</p>}
      </section>
      <section aria-label="Review findings"><h2>Findings across submitted revisions</h2>
        {!snapshot.findings.items.length && <p>No findings recorded.</p>}
        <ol>{snapshot.findings.items.map(finding => <li key={finding.id}><p>{finding.currentSeverity} · {finding.status} · {finding.actor.username} · Revision {snapshot.numbers[finding.revisionId] ?? finding.revisionId}</p><p>{finding.description}</p>
          <FindingHistory key={`${finding.id}-${attempt}`} proposalId={id} findingId={finding.id} read={read} />
          {['IN_REVIEW', 'CHANGES_REQUESTED'].includes(detail.state) && !loading && <button disabled={actionLocked || paging} onClick={() => { setRespondingTo(finding.id); setActionLocked(true); }}>Respond to finding {finding.id}</button>}
          {respondingTo === finding.id && <FindingResponseForm proposalId={id} findingId={finding.id} version={detail.version}
            revisionId={detail.latestRevision?.id ?? detail.revision.id} session={session} onSessionLost={onSessionLost} read={read}
            onDone={() => { setRespondingTo(null); setActionLocked(false); setAttempt(value => value + 1); }} />}
        </li>)}</ol>
        {snapshot.findings.nextCursor && <button disabled={loading || paging || actionLocked} onClick={() => void more('findings')}>Load more findings</button>}
      </section>
      <section aria-label="Finding responses"><h2>Attributed finding responses</h2>
        {!snapshot.responses.items.length && <p>No responses recorded.</p>}
        <ol>{snapshot.responses.items.map(response => <li key={response.id}><p>{response.actor.username} · Finding {response.findingId} · {response.createdAt}</p><p className="plain-text">{response.text}</p></li>)}</ol>
        {snapshot.responses.nextCursor && <button disabled={loading || paging || actionLocked} onClick={() => void more('responses')}>Load more responses</button>}
      </section>
      <section aria-label="Review decisions"><h2>Decisions</h2>{!snapshot.decisions.items.length && <p>No decisions recorded.</p>}
        <ol>{snapshot.decisions.items.map(decision => <li key={decision.id}><p>Revision {snapshot.numbers[decision.revisionId]} · {decision.decision} · {decision.actor.username}</p><p>{decision.note ?? 'No note supplied.'}</p></li>)}</ol>
        {snapshot.decisions.nextCursor && <button disabled={loading || paging || actionLocked} onClick={() => void more('decisions')}>Load more decisions</button>}
      </section>
      <section aria-label="Chronological activity"><h2>Activity, oldest first</h2>{!snapshot.activity.items.length && <p>No activity recorded.</p>}
        <ol>{snapshot.activity.items.map(item => <li key={item.id}><p><time dateTime={item.timestamp}>{item.timestamp}</time> · {item.actor?.username ?? 'System'} · {item.action}</p><p>{item.summary}</p>{item.reason && <p>{item.reason}</p>}</li>)}</ol>
        {snapshot.activity.nextCursor && <button disabled={loading || paging || actionLocked} onClick={() => void more('activity')}>Load later activity</button>}
      </section>
      {!loading && !paging && <>
        {editableProposalStates.includes(detail.state) && <p><Link to={`/contributor/drafts/${encodeURIComponent(id)}`}>Open private working copy</Link>. Working edits remain private until explicitly submitted. Release-candidate attachments block editing and submission.</p>}
        {!respondingTo && <ProposalActions key={`${detail.version}-${detail.state}`} proposalId={id} version={detail.version} state={detail.state} session={session}
          latestRevisionId={detail.latestRevision?.id ?? detail.revision.id}
          onSessionLost={onSessionLost} onLockChange={setActionLocked} onCommitted={(_result, operation) => {
            if (operation === 'clone-latest') navigate(`/contributor/drafts/${encodeURIComponent(id)}/edit`);
            else { setRevisionId(''); setAttempt(value => value + 1); }
          }} />}
      </>}
    </>}
  </>;
}
