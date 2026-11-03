import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { Icon } from '../../shared/Icon';
import { PageHeader } from './PageHeader';
import { useNavigationGuard } from '../../shared/navigationGuard';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { createProposalRequestSchema, draftResponseSchema, ownDraftsResponseSchema, proposalLifecycleResponseSchema,
  type OwnDraftsResponse, type SessionResponse, type WorkingContent } from '@specsentry/shared';

type Props = { session: SessionResponse; onSessionLost(): void };
const emptyContent = { title: '', problem: '', constraints: '', expectedBehavior: '', summary: '', diffText: '', criteria: [], evidence: [] };
const fields = [
  { name: 'title', label: 'Title', guidance: 'Name the change you want to make.', limit: 200, required: true },
  { name: 'problem', label: 'Problem', guidance: 'Explain the issue and who it affects.', limit: 10000, required: true },
  { name: 'constraints', label: 'Constraints', guidance: 'Note technical limits or requirements the solution must respect.', limit: 10000, required: false },
  { name: 'expectedBehavior', label: 'Expected behavior', guidance: 'Describe what should happen when the change works.', limit: 10000, required: true },
] as const;
type NarrativeField = typeof fields[number]['name'];
const preparationFields = [
  { name: 'summary', label: 'Contributor summary', guidance: 'Summarize the change for a future reviewer.', limit: 500, rows: 3 },
  { name: 'diffText', label: 'Unified diff', guidance: 'Paste the unified diff to review. Stored as text; never executed.', limit: 100000, rows: 10 },
] as const;

function jumpToSection(event: MouseEvent<HTMLAnchorElement>, targetId: string) {
  event.preventDefault();
  const target = document.getElementById(targetId);
  const main = event.currentTarget.closest('main');
  target?.focus({ preventScroll: true });
  if (target && main) {
    const style = getComputedStyle(main);
    const clearance = Number.parseFloat(style.getPropertyValue('--save-actions-height')) || 0;
    const stickyOffset = Number.parseFloat(style.paddingTop) || 0;
    main.scrollTop += target.getBoundingClientRect().top - main.getBoundingClientRect().top - stickyOffset - clearance - 16;
  }
}

function hasPersistedIdentities(content: WorkingContent) {
  return content.criteria.every(criterion => !!criterion.stableKey) && content.evidence.every(item => !!item.id);
}

function DraftFields({ content, errors, disabled, onChange }: {
  content: Pick<WorkingContent, NarrativeField>; errors: Record<string, string>; disabled: boolean;
  onChange(field: NarrativeField, value: string): void;
}) {
  return fields.map(field => <div className="draft-field" key={field.name}>
    <label htmlFor={`draft-${field.name}`}>{field.label}{field.required ? ' (required)' : ' (optional)'}</label>
    <p id={`draft-${field.name}-hint`}>{field.guidance} Maximum {field.limit.toLocaleString('en')} characters.</p>
    {field.name === 'title' ? <input id={`draft-${field.name}`} value={content[field.name]} required disabled={disabled}
      aria-invalid={!!errors[field.name]} aria-describedby={`draft-${field.name}-hint${errors[field.name] ? ` draft-${field.name}-error` : ''}`}
      onChange={event => onChange(field.name, event.target.value)} />
      : <textarea id={`draft-${field.name}`} rows={5} value={content[field.name]} required={field.required} disabled={disabled}
        aria-invalid={!!errors[field.name]} aria-describedby={`draft-${field.name}-hint${errors[field.name] ? ` draft-${field.name}-error` : ''}`}
        onChange={event => onChange(field.name, event.target.value)} />}
    {errors[field.name] && <p className="field-error" id={`draft-${field.name}-error`}>{errors[field.name]}</p>}
  </div>);
}

async function failure(response: Response): Promise<string> {
  const message = response.status === 413 ? 'Request is too large. Reduce the draft text before saving again.' : 'Request could not be completed.';
  try {
    const body: unknown = await response.json();
    const id = body && typeof body === 'object' && 'correlationId' in body ? body.correlationId : null;
    if (typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id)) return `${message} Reference: ${id}`;
  } catch { /* The safe fallback also covers non-JSON responses. */ }
  return response.status === 413 ? message : 'Request could not be completed. Please try again.';
}

function DraftList({ onSessionLost, onLoaded }: { onSessionLost(): void; onLoaded(): void }) {
  const location = useLocation();
  const notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (location.state?.draftDeleted) notice.current?.focus(); }, [location.state]);
  const [page, setPage] = useState<OwnDraftsResponse | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setPage(null); setError('');
      try {
        const response = await fetch(`/api/proposals${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { credentials: 'same-origin', signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 401) { onSessionLost(); return; }
        if (!response.ok) { setError(await failure(response)); return; }
        const result = ownDraftsResponseSchema.parse(await response.json());
        if (!controller.signal.aborted) { setPage(result); onLoaded(); }
      } catch { if (!controller.signal.aborted) setError('Unable to load your drafts. Retry when your connection is available.'); }
    }
    void load();
    return () => controller.abort();
  }, [cursor, attempt, onSessionLost, onLoaded]);
  return <>
    <div className="page-heading"><div><PageHeader title="Private drafts" list /><p>Create, manage, and refine your specifications.</p></div><Link className="button" to="/contributor/new"><Icon name="plus" />Create New Draft</Link></div>
    {location.state?.draftDeleted && <p role="status" tabIndex={-1} ref={notice}>Private draft deleted.</p>}
    <section className="draft-panel" aria-labelledby="private-drafts-title">
      <div className="panel-heading"><div><h2 id="private-drafts-title">Your private drafts</h2><p className="privacy-note"><Icon name="lock" />Only you can read these working drafts.</p></div><p className="draft-count"><span>Drafts on this page</span><strong data-testid="draft-page-count">{error ? 'Unavailable' : page ? page.items.length : '...'}</strong></p></div>
      {error ? <div className="panel-state"><p role="alert">{error}</p><button onClick={() => setAttempt(value => value + 1)}>Retry loading drafts</button></div>
        : !page ? <div className="panel-state"><span className="loading-dot" aria-hidden="true" /><p role="status">Loading drafts...</p></div>
        : <>
          {page.items.length === 0 ? <div className="empty-state"><span className="empty-icon"><Icon name="file" /></span><h3>{cursor ? 'No drafts on this page' : 'No drafts yet'}</h3><p>{cursor ? 'Return to the first page to see your available drafts.' : 'Start by creating your first specification draft.'}</p><Link className="button" to="/contributor/new"><Icon name="plus" />{cursor ? 'Create New Draft' : 'Create your first draft'}</Link></div> : <ul className="draft-list">{page.items.map(item => <li key={item.proposalId}>
            <Link className="draft-row-link" aria-label={item.title} to={`/contributor/drafts/${encodeURIComponent(item.proposalId)}`}><span className="draft-row-icon"><Icon name="file" /></span><span className="draft-row-content"><strong>{item.title}</strong><span>Private working draft</span></span><span className="status-badge">DRAFT</span><Icon name="arrow" /></Link>
          </li>)}</ul>}
          {(page.nextCursor || cursor) && <div className="pagination">{cursor && <button className="secondary-button" onClick={() => setCursor(null)}>First page</button>}{page.nextCursor && <button className="secondary-button" onClick={() => setCursor(page.nextCursor)}>Next page</button>}</div>}
        </>}
    </section>
  </>;
}

function CreateDraft({ session, onSessionLost, uncertain, onUncertain, onCertain, content, setContent, pending, setPending }: Props & {
  uncertain: boolean; onUncertain(): void; onCertain(): void; content: typeof emptyContent; setContent(content: typeof emptyContent): void;
  pending: boolean; setPending(pending: boolean): void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const active = useRef(true);
  const navigate = useNavigate();
  const createDirty = JSON.stringify(content) !== JSON.stringify(emptyContent);
  const createGuard = useNavigationGuard(pending ? 'A draft is being created. Leaving does not cancel the request, and its result may be uncertain. Leave this page?' : uncertain ? 'The create result is uncertain. Check your draft list before creating again. Leave this page?' : createDirty ? 'Leave without saving your entered draft? Choose Cancel to keep editing.' : '');
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uncertain) return;
    const parsed = createProposalRequestSchema.safeParse(content);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) nextErrors[String(issue.path[0])] ??= issue.message;
      setErrors(nextErrors); setError('Check the highlighted fields. Your text is still here.');
      const first = fields.find(field => nextErrors[field.name]);
      if (first) document.getElementById(`draft-${first.name}`)?.focus();
      return;
    }
    setErrors({}); setError(''); setPending(true); onUncertain();
    try {
      const response = await fetch('/api/proposals', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken }, body: JSON.stringify(parsed.data) });
      if (response.status === 401) { onSessionLost(); return; }
      if (!response.ok) {
        if (response.status < 500) onCertain();
        const message = await failure(response);
        if (active.current) setError(message);
        return;
      }
      const result = proposalLifecycleResponseSchema.parse(await response.json());
      createGuard.release();
      setContent(emptyContent); onCertain();
      if (active.current) navigate(`/contributor/drafts/${encodeURIComponent(result.proposalId)}`);
    } catch {
      onUncertain();
      if (active.current) setError('The response was interrupted. Your draft may have been created.');
    } finally { setPending(false); }
  }
  return <>
    <PageHeader title="Create a private draft" />
    <p>Title, problem and expected behavior are required. Constraints are optional. Text is saved privately.</p>
    <form className="draft-form" noValidate onSubmit={event => void submit(event)}>
      <DraftFields content={content} errors={errors} disabled={pending} onChange={(field, value) => setContent({ ...content, [field]: value })} />
      {error && <p role="alert">{error}</p>}
      {pending ? <p role="status">Creating your draft. Wait for the result before creating again.</p>
        : uncertain && <p role="status">The draft may already exist. Check your draft list before creating again to avoid a duplicate. Your entered text stays here.</p>}
      <button type="submit" disabled={pending || uncertain}>{pending ? 'Creating…' : 'Create private draft'}</button>
    </form>
    <Link to="/contributor">Back to your drafts</Link>
  </>;
}

function DraftDetailRoute(props: Props) {
  const { id } = useParams();
  return <DraftDetail key={id} id={id ?? ''} {...props} />;
}

function DraftDetail({ id, session, onSessionLost }: Props & { id: string }) {
  const [detail, setDetail] = useState<ReturnType<typeof draftResponseSchema.parse> | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const active = useRef(true);
  const appliedLoad = useRef(-1);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const restoreDeleteFocus = useRef(false);
  const navigate = useNavigate();
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (confirming) cancelButton.current?.focus();
    else if (restoreDeleteFocus.current) { deleteButton.current?.focus(); restoreDeleteFocus.current = false; }
  }, [confirming]);
  useEffect(() => {
    if (appliedLoad.current === attempt) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(''); setConfirming(false);
      try {
        const response = await fetch(`/api/proposals/${encodeURIComponent(id)}/draft`, { credentials: 'same-origin', signal: controller.signal });
        if (response.status === 401) { onSessionLost(); return; }
        if (controller.signal.aborted) return;
        if (response.status === 404 || response.status === 403) {
          setDetail(null); setUnavailable(true); setBlocked(true);
          setError(response.status === 404 ? 'This draft is no longer available.' : 'You do not have access to this draft.'); return;
        }
        if (!response.ok) { setError(await failure(response)); return; }
        const result = draftResponseSchema.parse(await response.json());
        if (result.proposalId !== id) throw new Error();
        if (!controller.signal.aborted) { setDetail(result); setBlocked(false); setUnavailable(false); }
      } catch { if (!controller.signal.aborted) setError('Unable to check this draft. Please try again.'); }
      finally { if (!controller.signal.aborted) { appliedLoad.current = attempt; setLoading(false); } }
    }
    void load(); return () => controller.abort();
  }, [id, attempt, onSessionLost]);

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !confirming || pending || loading || blocked) return;
    setPending(true); setError('');
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken },
        body: JSON.stringify({ expectedVersion: detail.version, confirmed: true }) });
      if (response.status === 401) { onSessionLost(); return; }
      if (!active.current) return;
      if (response.status === 204) {
        setDetail(null); navigate('/contributor', { replace: true, state: { draftDeleted: true } }); return;
      }
      setConfirming(false);
      if (response.status === 403 || response.status === 404) {
        setDetail(null); setUnavailable(true); setBlocked(true);
        setError(response.status === 404 ? 'This draft is no longer available.' : 'You do not have access to this draft.'); return;
      }
      if (response.status === 409 || response.status >= 500 || response.ok) setBlocked(true);
      const message = await failure(response);
      if (active.current) setError(response.status === 409 ? `This draft changed or is no longer deletable. ${message}`
        : response.status >= 500 || response.ok ? `The deletion result is uncertain. ${message}` : message);
    } catch {
      if (active.current) { setConfirming(false); setBlocked(true); setError('The deletion result is uncertain. Check the current draft before trying again.'); }
    } finally { if (active.current) setPending(false); }
  }
  function cancel() { restoreDeleteFocus.current = true; setConfirming(false); }
  return <>
    <PageHeader title="Private draft detail" draftId={id} draftTitle={detail?.content.title} />
    {!pending && <Link to="/contributor">Back to your drafts</Link>}
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading draft...</p>}
    {detail && <>
      <p>Private - {detail.state}</p>
      {detail.state === 'DRAFT' && !pending && <Link to={`/contributor/drafts/${encodeURIComponent(id)}/edit`}>Edit private draft</Link>}
      <dl>{fields.map(field => <div key={field.name}><dt>{field.label}</dt><dd>{detail.content[field.name] || 'None provided.'}</dd></div>)}</dl>
      <section className="saved-criteria" aria-labelledby="saved-criteria-title">
        <h2 id="saved-criteria-title">Saved acceptance criteria</h2>
        <p>Private working content, not a submitted revision.</p>
        {detail.content.criteria.length ? <ol>{detail.content.criteria.map((criterion, index) => <li key={criterion.stableKey ?? index}><span className="status-badge">{criterion.required ? 'Required' : 'Optional'}</span><p>{criterion.statement}</p></li>)}</ol> : <p>No acceptance criteria saved yet.</p>}
      </section>
      <dl>{preparationFields.map(field => <div key={field.name}><dt>{field.label}</dt><dd>{detail.content[field.name] || 'None provided.'}</dd></div>)}
        <dt>Plain-text evidence</dt><dd>{detail.content.evidence.length ? <ol>{detail.content.evidence.map(item => <li key={item.id}>{item.text}</li>)}</ol> : 'None provided.'}</dd>
      </dl>
      {detail.state === 'DRAFT' && <button className="danger-button" ref={deleteButton} onClick={() => setConfirming(true)} disabled={pending || loading || blocked || confirming}>Delete private draft</button>}
      {confirming && <form className="delete-confirmation" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-description" onSubmit={event => void remove(event)}>
        <h2 id="delete-confirm-title">Confirm permanent deletion</h2>
        <p id="delete-confirm-description">Permanently delete "{detail.content.title}" and all its working content? This cannot be undone. Only never-submitted drafts can be deleted.</p>
        <button type="button" ref={cancelButton} onClick={cancel} disabled={pending}>Cancel deletion</button>
        <button className="danger-button" type="submit" disabled={pending}>{pending ? 'Deleting...' : 'Permanently delete draft'}</button>
      </form>}
    </>}
    {pending && <p role="status">Deleting private draft...</p>}
    {blocked && !unavailable && <p role="status">Deletion is paused. Check the current draft and confirm again before another deletion request.</p>}
    {!unavailable && (error || blocked) && <button onClick={() => setAttempt(value => value + 1)} disabled={pending || loading}>Check current draft</button>}
  </>;
}

function EditDraftRoute(props: Props) {
  const { id } = useParams();
  return <EditDraft key={id} id={id ?? ''} {...props} />;
}

function EditDraft({ id, session, onSessionLost }: Props & { id: string }) {
  const [baseline, setBaseline] = useState<ReturnType<typeof draftResponseSchema.parse> | null>(null);
  const [content, setContent] = useState<WorkingContent | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saveOutcome, setSaveOutcome] = useState<'conflict' | 'uncertain' | 'verification' | null>(null);
  const [meaning, setMeaning] = useState<Record<string, 'same' | 'replace'>>({});
  const criterionFocus = useRef<number | null>(null);
  const evidenceFocus = useRef<number | null>(null);
  // Apply each focus request in its DOM commit before another event can replace it.
  useLayoutEffect(() => {
    if (criterionFocus.current !== null) {
      (document.getElementById(`criterion-${criterionFocus.current}-statement`) ?? document.getElementById('add-criterion'))?.focus();
      criterionFocus.current = null;
    }
    if (evidenceFocus.current !== null) {
      (document.getElementById(`evidence-${evidenceFocus.current}-text`) ?? document.getElementById('add-evidence'))?.focus();
      evidenceFocus.current = null;
    }
  }, [content]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const appliedLoad = useRef(-1);
  const active = useRef(true);
  const navigate = useNavigate();
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    // A callback refresh within the same login must not replace unsaved text.
    if (appliedLoad.current === attempt) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(''); setSuccess('');
      try {
        const response = await fetch(`/api/proposals/${encodeURIComponent(id)}/draft`, { credentials: 'same-origin', signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 401) { onSessionLost(); return; }
        if (!response.ok) {
          const message = await failure(response);
          if (!controller.signal.aborted) setError(message);
          return;
        }
        const latest = draftResponseSchema.parse(await response.json());
        if (latest.proposalId !== id || !hasPersistedIdentities(latest.content)) throw new Error();
        if (!controller.signal.aborted) {
          appliedLoad.current = attempt;
          setBaseline(latest); setContent(latest.content); setMeaning({}); setErrors({}); setBlocked(false); setSaveOutcome(null);
        }
      } catch { if (!controller.signal.aborted) { setBlocked(true); setError('Unable to load this draft. Your entered text has been kept.'); } }
      finally { if (!controller.signal.aborted) { appliedLoad.current = attempt; setLoading(false); } }
    }
    void load(); return () => controller.abort();
  }, [id, attempt, onSessionLost]);

  const dirty = !!content && !!baseline && (JSON.stringify(content) !== JSON.stringify(baseline.content)
    || content.criteria.some(criterion => criterion.stableKey && meaning[criterion.stableKey]
      && baseline.content.criteria.find(item => item.stableKey === criterion.stableKey)?.statement !== criterion.statement.replace(/\r\n?/g, '\n')));
  const leaveMessage = pending ? 'A save is still in progress. Leaving does not cancel it, and its result may be uncertain. Leave this page?'
    : blocked && content ? 'Saving is paused because the latest result needs reconciliation. Leaving will discard your local edits. Leave this page?'
    : dirty ? 'Leave without saving your changes? Choose Cancel to keep editing.' : '';
  const editGuard = useNavigationGuard(leaveMessage);
  const saveActionsRef = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const main = element.closest('main');
    const measure = () => main?.style.setProperty('--save-actions-height', `${element.offsetHeight}px`);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => { observer?.disconnect(); main?.style.removeProperty('--save-actions-height'); };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!baseline || !content || pending || loading || blocked || baseline.state !== 'DRAFT') return;
    const original = new Map(baseline.content.criteria.map(criterion => [criterion.stableKey, criterion.statement]));
    const nextErrors: Record<string, string> = {};
    const criteria = content.criteria.map((criterion, index) => {
      if (!criterion.stableKey || original.get(criterion.stableKey) === criterion.statement.replace(/\r\n?/g, '\n')) return criterion;
      if (!meaning[criterion.stableKey]) nextErrors[`criteria.${index}.meaning`] = 'Choose whether this changes the criterion meaning.';
      if (meaning[criterion.stableKey] === 'replace') return { statement: criterion.statement, required: criterion.required };
      return criterion;
    });
    const parsed = createProposalRequestSchema.safeParse({ ...content, criteria });
    if (!parsed.success || Object.keys(nextErrors).length) {
      if (!parsed.success) for (const issue of parsed.error.issues) nextErrors[issue.path.join('.')] ??= issue.message;
      setErrors(nextErrors); setError('Check the highlighted fields. Your text is still here.');
      const first = fields.find(field => nextErrors[field.name]);
      const criterionError = Object.keys(nextErrors).find(key => /^criteria\.\d+\.statement$/.test(key)) ?? Object.keys(nextErrors).find(key => key.startsWith('criteria.'));
      const preparationError = preparationFields.find(field => nextErrors[field.name]);
      const evidenceError = Object.keys(nextErrors).find(key => /^evidence\.\d+\.text$/.test(key));
      if (first) document.getElementById(`draft-${first.name}`)?.focus();
      else if (criterionError) document.getElementById(`criterion-${criterionError.split('.')[1]}-${criterionError.endsWith('meaning') ? 'meaning' : 'statement'}`)?.focus();
      else if (preparationError) document.getElementById(`draft-${preparationError.name}`)?.focus();
      else if (evidenceError) document.getElementById(`evidence-${evidenceError.split('.')[1]}-text`)?.focus();
      else if (nextErrors.evidence) (document.getElementById('evidence-0-text') ?? document.getElementById('add-evidence'))?.focus();
      else document.getElementById('add-criterion')?.focus();
      return;
    }
    if (!parsed.success) return;
    setPending(true); setErrors({}); setError(''); setSuccess(''); setSaveOutcome(null);
    let committed = false;
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(id)}/draft`, { method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken },
        body: JSON.stringify({ expectedVersion: baseline.version, content: parsed.data }) });
      if (response.status === 401) { onSessionLost(); return; }
      if (!active.current) return;
      if (!response.ok) {
        if (response.status === 409 || response.status >= 500) setBlocked(true);
        if (response.status === 409) setSaveOutcome('conflict');
        else if (response.status >= 500) setSaveOutcome('uncertain');
        const message = await failure(response);
        if (active.current) setError(response.status === 409 ? `This draft changed or is no longer editable. ${message} Your edits are still here. Reload the saved draft before trying again.`
          : response.status >= 500 ? `The save result is uncertain. Your draft may have been saved. ${message} Your edits are still here. Reload the saved draft before saving again.` : message);
        return;
      }
      const saved = proposalLifecycleResponseSchema.parse(await response.json());
      if (saved.proposalId !== id || saved.workingRevisionId !== baseline.workingRevisionId || saved.version !== baseline.version + 1 || saved.state !== 'DRAFT') throw new Error();
      committed = true;
      const read = await fetch(`/api/proposals/${encodeURIComponent(id)}/draft`, { credentials: 'same-origin' });
      if (read.status === 401) { onSessionLost(); return; }
      if (!active.current) return;
      if (!read.ok) throw new Error();
      const latest = draftResponseSchema.parse(await read.json());
      if (latest.proposalId !== id || latest.workingRevisionId !== saved.workingRevisionId || latest.version !== saved.version || latest.state !== 'DRAFT' || !hasPersistedIdentities(latest.content)) throw new Error();
      if (active.current) {
        setBaseline(latest); setContent(latest.content); setMeaning({});
        setSuccess(`Draft saved. Version ${saved.version}.`);
      }
    } catch {
      if (active.current) { setBlocked(true); setSaveOutcome(committed ? 'verification' : 'uncertain'); setError(committed ? 'Draft saved, but we could not verify the saved criteria and evidence. Your entered text has been kept. Reload before saving again.' : 'The save result is uncertain. Your draft may have been saved. Your entered text has been kept. Reload the saved draft before saving again.'); }
    } finally { if (active.current) setPending(false); }
  }

  function reload() {
    if (pending || loading) return;
    if (leaveMessage && !window.confirm('Discard your entered changes and reload the latest saved draft?')) return;
    setAttempt(value => value + 1);
  }
  function back() {
    if (!editGuard.managed && !editGuard.confirmDiscard()) return;
    navigate(`/contributor/drafts/${encodeURIComponent(id)}`);
  }
  return <>
    <PageHeader title="Edit private draft" draftId={id} draftTitle={baseline?.content.title} editing />
    <p>Changes stay private. Only a never-submitted DRAFT can be saved.</p>
    {(!baseline || !content) && error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading latest draft…</p>}
    {baseline && content && <>
      <p>Editing version {baseline.version} · {baseline.state}</p>
      {baseline.state !== 'DRAFT' && <p role="alert">This proposal is no longer an editable draft.</p>}
      <div className="save-actions" ref={saveActionsRef} role="region" aria-label="Save draft and status">
        <button type="submit" form="edit-draft-form" disabled={pending || loading || blocked || baseline.state !== 'DRAFT'}>{pending ? 'Saving...' : 'Save private draft'}</button>
        <div className="save-feedback">
          <p role="status">{pending ? 'Saving your private draft.' : blocked ? saveOutcome === 'conflict' ? 'Draft changed. Saving is paused.' : saveOutcome === 'verification' ? 'Saved; verification incomplete.' : saveOutcome === 'uncertain' ? 'Save result uncertain. Saving is paused.' : 'Saving is paused.' : error ? 'Save needs attention.' : success || (dirty ? 'Unsaved changes.' : 'No unsaved changes.')}</p>
          {(error || blocked) && <a href="#save-recovery" onClick={event => jumpToSection(event, 'save-recovery')}>Recovery details</a>}
        </div>
      </div>
      <nav className="editor-sections" aria-label="Draft sections">{[
        ['editor-overview', 'Overview'], ['editor-criteria', 'Acceptance criteria'], ['editor-patch', 'Patch'], ['editor-evidence', 'Evidence'],
      ].map(([targetId, label]) => <a key={targetId} href={`#${targetId}`} onClick={event => jumpToSection(event, targetId!)}>{label}</a>)}</nav>
      {(error || blocked) && <section id="save-recovery" className="save-recovery" tabIndex={-1} aria-label="Save recovery details">
        {error ? <p role="alert">{error}</p> : <p>Check the saved draft before saving again. Your local edits stay here until a reload succeeds.</p>}
        {blocked && <p>Reload the saved draft when you are ready to discard local changes and check the latest version.</p>}
      </section>}
      <form id="edit-draft-form" className="draft-form" noValidate onSubmit={event => void save(event)}>
        <section className="narrative-section" aria-labelledby="editor-overview"><h2 id="editor-overview" tabIndex={-1}>Overview</h2>
          <DraftFields content={content} errors={errors} disabled={pending || loading} onChange={(field, value) => { setContent({ ...content, [field]: value }); setSuccess(''); }} />
        </section>
        <fieldset className="narrative-section" disabled={pending || loading}>
          <legend><h2 id="editor-criteria" tabIndex={-1}>Acceptance criteria</h2></legend>
          <p id="criteria-hint">Describe a testable outcome in each criterion. Up to 50 criteria, each at most 2,000 characters. New criteria are required by default; incomplete drafts may be saved.</p>
          {errors.criteria && <p role="alert">{errors.criteria}</p>}
          {content.criteria.length === 0 && <p>No criteria yet. You can save this incomplete draft.</p>}
          {content.criteria.map((criterion, index) => {
            const changed = criterion.stableKey && baseline.content.criteria.find(item => item.stableKey === criterion.stableKey)?.statement !== criterion.statement.replace(/\r\n?/g, '\n');
            const statementError = errors[`criteria.${index}.statement`];
            const meaningError = errors[`criteria.${index}.meaning`];
            return <div className="editor-item" key={criterion.stableKey ?? `new-${index}`}>
              <label htmlFor={`criterion-${index}-statement`}>Criterion {index + 1} statement</label>
              <textarea id={`criterion-${index}-statement`} value={criterion.statement} rows={3} aria-invalid={!!statementError}
                aria-describedby={`criteria-hint${statementError ? ` criterion-${index}-error` : ''}`}
                onChange={event => {
                  setContent({ ...content, criteria: content.criteria.map((item, i) => i === index ? { ...item, statement: event.target.value } : item) });
                  if (criterion.stableKey) setMeaning(previous => { const next = { ...previous }; delete next[criterion.stableKey!]; return next; });
                  setSuccess('');
                }} />
              {statementError && <p id={`criterion-${index}-error`}>{statementError}</p>}
              <label><input type="checkbox" checked={criterion.required} onChange={event => {
                setContent({ ...content, criteria: content.criteria.map((item, i) => i === index ? { ...item, required: event.target.checked } : item) }); setSuccess('');
              }} />Criterion {index + 1} required</label>
              {changed && <>
                <label htmlFor={`criterion-${index}-meaning`}>Criterion {index + 1} meaning</label>
                <p id={`criterion-${index}-meaning-hint`}>Declare whether your wording keeps the same meaning. A materially rewritten criterion receives a new identity.</p>
                <select id={`criterion-${index}-meaning`} value={meaning[criterion.stableKey!] ?? ''} aria-invalid={!!meaningError}
                  aria-describedby={`criterion-${index}-meaning-hint${meaningError ? ` criterion-${index}-meaning-error` : ''}`}
                  onChange={event => { setMeaning({ ...meaning, [criterion.stableKey!]: event.target.value as 'same' | 'replace' }); setSuccess(''); }}>
                  <option value="">Choose meaning</option><option value="same">Same meaning / wording correction</option><option value="replace">Materially changed meaning / replace criterion</option>
                </select>
                {meaningError && <p id={`criterion-${index}-meaning-error`}>{meaningError}</p>}
              </>}
              <button type="button" onClick={() => {
                criterionFocus.current = index < content.criteria.length - 1 ? index : index - 1;
                setContent({ ...content, criteria: content.criteria.filter((_, i) => i !== index) }); setErrors({}); setSuccess('');
              }}>Remove criterion {index + 1}</button>
            </div>;
          })}
          <button id="add-criterion" type="button" disabled={content.criteria.length >= 50} onClick={() => {
            criterionFocus.current = content.criteria.length;
            setContent({ ...content, criteria: [...content.criteria, { statement: '', required: true }] }); setErrors({}); setSuccess('');
          }}>Add criterion</button>
        </fieldset>
        <fieldset disabled={pending || loading}>
          <legend><h2 id="editor-patch" tabIndex={-1}>Patch</h2></legend>
          <p>Optional while drafting. Text is stored privately; patches and evidence are never executed.</p>
          {preparationFields.map(field => <div className="draft-field" key={field.name}>
            <label htmlFor={`draft-${field.name}`}>{field.label} (optional)</label>
            <p id={`draft-${field.name}-hint`}>{field.guidance} Maximum {field.limit.toLocaleString('en')} characters.</p>
            <textarea id={`draft-${field.name}`} rows={field.rows} value={content[field.name]} aria-invalid={!!errors[field.name]}
              aria-describedby={`draft-${field.name}-hint${errors[field.name] ? ` draft-${field.name}-error` : ''}`}
              onChange={event => { setContent({ ...content, [field.name]: event.target.value }); setSuccess(''); }} />
            {errors[field.name] && <p id={`draft-${field.name}-error`} className="field-error">{errors[field.name]}</p>}
          </div>)}
        </fieldset>
        <fieldset className="narrative-section" disabled={pending || loading}>
          <legend><h2 id="editor-evidence" tabIndex={-1}>Evidence</h2></legend>
          <p id="evidence-hint">Add optional plain-text notes that help a reviewer assess the change. Maximum 50,000 characters in total. Each added item must contain text, or remove it before saving.</p>
          {errors.evidence && <p id="evidence-error" role="alert">{errors.evidence}</p>}
          {content.evidence.length === 0 && <p>No evidence added.</p>}
          {content.evidence.map((item, index) => <div className="draft-field editor-item" key={item.id ?? `new-evidence-${index}`}>
            <label htmlFor={`evidence-${index}-text`}>Evidence {index + 1} text</label>
            <textarea id={`evidence-${index}-text`} rows={4} value={item.text} aria-invalid={!!errors[`evidence.${index}.text`] || !!errors.evidence}
              aria-describedby={`evidence-hint${errors.evidence ? ' evidence-error' : ''}${errors[`evidence.${index}.text`] ? ` evidence-${index}-error` : ''}`}
              onChange={event => { setContent({ ...content, evidence: content.evidence.map((entry, i) => i === index ? { ...entry, text: event.target.value } : entry) }); setSuccess(''); }} />
            {errors[`evidence.${index}.text`] && <p id={`evidence-${index}-error`} className="field-error">{errors[`evidence.${index}.text`]}</p>}
            <button type="button" onClick={() => {
              evidenceFocus.current = index < content.evidence.length - 1 ? index : index - 1;
              setContent({ ...content, evidence: content.evidence.filter((_, i) => i !== index) }); setErrors({}); setSuccess('');
            }}>Remove evidence {index + 1}</button>
          </div>)}
          <button id="add-evidence" type="button" disabled={content.evidence.length >= 50000} onClick={() => {
            evidenceFocus.current = content.evidence.length;
            setContent({ ...content, evidence: [...content.evidence, { text: '' }] }); setErrors({}); setSuccess('');
          }}>Add evidence</button>
        </fieldset>
      </form>
    </>}
    <button onClick={reload} disabled={pending || loading}>{content ? 'Reload latest draft and discard changes' : 'Retry loading draft'}</button>
    <button onClick={back} disabled={pending}>Back to draft detail</button>
  </>;
}

export function ContributorWorkspace(props: Props) {
  const location = useLocation();
  const [uncertain, setUncertain] = useState(false);
  const [pending, setPending] = useState(false);
  const [content, setContent] = useState(emptyContent);
  const loaded = useCallback(() => { if (!pending) setUncertain(false); }, [pending]);
  const markUncertain = useCallback(() => setUncertain(true), []);
  const markCertain = useCallback(() => setUncertain(false), []);
  return <section className={`contributor-workspace${location.pathname === '/contributor' || location.pathname === '/contributor/' ? ' is-draft-list' : ''}`} aria-label="Contributor drafts">
    <Routes>
      <Route index element={<DraftList onSessionLost={props.onSessionLost} onLoaded={loaded} />} />
      <Route path="new" element={<CreateDraft {...props} content={content} setContent={setContent} pending={pending} setPending={setPending}
        uncertain={uncertain} onUncertain={markUncertain} onCertain={markCertain} />} />
      <Route path="drafts/:id" element={<DraftDetailRoute {...props} />} />
      <Route path="drafts/:id/edit" element={<EditDraftRoute {...props} />} />
      <Route path="*" element={<><h1>Page not found</h1><Link to="/contributor">Your drafts</Link></>} />
    </Routes>
  </section>;
}
