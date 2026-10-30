import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { createProposalRequestSchema, draftResponseSchema, ownDraftsResponseSchema, proposalLifecycleResponseSchema,
  type OwnDraftsResponse, type SessionResponse, type WorkingContent } from '@specsentry/shared';

type Props = { session: SessionResponse; onSessionLost(): void };
const emptyContent = { title: '', problem: '', constraints: '', expectedBehavior: '', summary: '', diffText: '', criteria: [], evidence: [] };
const fields = [
  { name: 'title', label: 'Title', limit: 200, required: true },
  { name: 'problem', label: 'Problem', limit: 10000, required: true },
  { name: 'constraints', label: 'Constraints', limit: 10000, required: false },
  { name: 'expectedBehavior', label: 'Expected behavior', limit: 10000, required: true },
] as const;
type NarrativeField = typeof fields[number]['name'];
const preparationFields = [
  { name: 'summary', label: 'Contributor summary', limit: 500, rows: 3 },
  { name: 'diffText', label: 'Unified diff', limit: 100000, rows: 10 },
] as const;

function hasPersistedIdentities(content: WorkingContent) {
  return content.criteria.every(criterion => !!criterion.stableKey) && content.evidence.every(item => !!item.id);
}

function DraftFields({ content, errors, disabled, onChange }: {
  content: Pick<WorkingContent, NarrativeField>; errors: Record<string, string>; disabled: boolean;
  onChange(field: NarrativeField, value: string): void;
}) {
  return fields.map(field => <div className="draft-field" key={field.name}>
    <label htmlFor={`draft-${field.name}`}>{field.label}{field.required ? ' (required)' : ' (optional)'}</label>
    <p id={`draft-${field.name}-hint`}>Maximum {field.limit.toLocaleString('en')} characters.</p>
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
      } catch { if (!controller.signal.aborted) setError('Unable to load your drafts. Please try again.'); }
    }
    void load();
    return () => controller.abort();
  }, [cursor, attempt, onSessionLost, onLoaded]);
  return <>
    <h3>Your private drafts</h3>
    {location.state?.draftDeleted && <p role="status" tabIndex={-1} ref={notice}>Private draft deleted.</p>}
    <p>Only you can read these working drafts.</p>
    <Link to="/contributor/new">Create a draft</Link>
    {error ? <><p role="alert">{error}</p><button onClick={() => setAttempt(value => value + 1)}>Retry loading drafts</button></>
      : !page ? <p role="status">Loading drafts…</p>
      : <>
        {page.items.length === 0 ? <p>No drafts here yet. Create a draft to get started.</p> : <ul className="draft-list">{page.items.map(item => <li key={item.proposalId}>
          <Link to={`/contributor/drafts/${encodeURIComponent(item.proposalId)}`}>{item.title}</Link> <span>Private · DRAFT</span>
        </li>)}</ul>}
        {page.nextCursor && <button onClick={() => setCursor(page.nextCursor)}>Next page</button>}
        {cursor && <button onClick={() => setCursor(null)}>First page</button>}
      </>}
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
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uncertain) return;
    const parsed = createProposalRequestSchema.safeParse(content);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) nextErrors[String(issue.path[0])] ??= issue.message;
      setErrors(nextErrors); setError('Check the highlighted fields.');
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
      setContent(emptyContent); onCertain();
      if (active.current) navigate(`/contributor/drafts/${encodeURIComponent(result.proposalId)}`);
    } catch {
      onUncertain();
      if (active.current) setError('The response was interrupted. Your draft may have been created.');
    } finally { setPending(false); }
  }
  return <>
    <h3>Create a private draft</h3>
    <p>Title, problem and expected behavior are required. Constraints are optional. Text is saved privately.</p>
    <form className="draft-form" noValidate onSubmit={event => void submit(event)}>
      <DraftFields content={content} errors={errors} disabled={pending} onChange={(field, value) => setContent({ ...content, [field]: value })} />
      {error && <p role="alert">{error}</p>}
      {pending ? <p role="status">Creating your draft. Wait for the result before creating again.</p>
        : uncertain && <p role="status">Check your draft list before creating again to avoid a duplicate. Your entered text stays here.</p>}
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
    <h3>Private draft detail</h3>
    {!pending && <Link to="/contributor">Back to your drafts</Link>}
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading draft...</p>}
    {detail && <>
      <p>Private - {detail.state}</p>
      {detail.state === 'DRAFT' && !pending && <Link to={`/contributor/drafts/${encodeURIComponent(id)}/edit`}>Edit private draft</Link>}
      <dl>{fields.map(field => <div key={field.name}><dt>{field.label}</dt><dd>{detail.content[field.name] || 'None provided.'}</dd></div>)}</dl>
      <dl>{preparationFields.map(field => <div key={field.name}><dt>{field.label}</dt><dd>{detail.content[field.name] || 'None provided.'}</dd></div>)}
        <dt>Plain-text evidence</dt><dd>{detail.content.evidence.length ? <ol>{detail.content.evidence.map(item => <li key={item.id}>{item.text}</li>)}</ol> : 'None provided.'}</dd>
      </dl>
      {detail.state === 'DRAFT' && <button ref={deleteButton} onClick={() => setConfirming(true)} disabled={pending || loading || blocked || confirming}>Delete private draft</button>}
      {confirming && <form aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-description" onSubmit={event => void remove(event)}>
        <h4 id="delete-confirm-title">Confirm permanent deletion</h4>
        <p id="delete-confirm-description">Permanently delete "{detail.content.title}" and all its working content? This cannot be undone. Only never-submitted drafts can be deleted.</p>
        <button type="button" ref={cancelButton} onClick={cancel} disabled={pending}>Cancel deletion</button>
        <button type="submit" disabled={pending}>{pending ? 'Deleting...' : 'Permanently delete draft'}</button>
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
  const [meaning, setMeaning] = useState<Record<string, 'same' | 'replace'>>({});
  const criterionFocus = useRef<number | null>(null);
  const evidenceFocus = useRef<number | null>(null);
  useEffect(() => {
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
          setBaseline(latest); setContent(latest.content); setMeaning({}); setErrors({}); setBlocked(false);
        }
      } catch { if (!controller.signal.aborted) { setBlocked(true); setError('Unable to load this draft. Your entered text has been kept.'); } }
      finally { if (!controller.signal.aborted) { appliedLoad.current = attempt; setLoading(false); } }
    }
    void load(); return () => controller.abort();
  }, [id, attempt, onSessionLost]);

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
      setErrors(nextErrors); setError('Check the highlighted fields.');
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
    setPending(true); setErrors({}); setError(''); setSuccess('');
    let committed = false;
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(id)}/draft`, { method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken },
        body: JSON.stringify({ expectedVersion: baseline.version, content: parsed.data }) });
      if (response.status === 401) { onSessionLost(); return; }
      if (!active.current) return;
      if (!response.ok) {
        if (response.status === 409 || response.status >= 500) setBlocked(true);
        const message = await failure(response);
        if (active.current) setError(response.status === 409 ? `This draft changed or is no longer editable. ${message}` : message);
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
      if (active.current) { setBlocked(true); setError(committed ? 'Draft saved, but its current identities could not be reconciled. Your entered text has been kept. Reload before saving again.' : 'The save result is uncertain. Your draft may have been saved. Your entered text has been kept.'); }
    } finally { if (active.current) setPending(false); }
  }

  function reload() {
    if (pending || loading) return;
    if (content && !window.confirm('Discard your entered changes and reload the latest saved draft?')) return;
    setAttempt(value => value + 1);
  }
  function back() {
    if (content && baseline && JSON.stringify(content) !== JSON.stringify(baseline.content) && !window.confirm('Discard your unsaved changes and return to the draft detail?')) return;
    navigate(`/contributor/drafts/${encodeURIComponent(id)}`);
  }
  return <>
    <h3>Edit private draft</h3>
    <p>Changes stay private. Only a never-submitted DRAFT can be saved.</p>
    {error && <p role="alert">{error}</p>}
    {success && <p role="status">{success}</p>}
    {loading && <p role="status">Loading latest draft…</p>}
    {baseline && content && <>
      <p>Editing version {baseline.version} · {baseline.state}</p>
      {baseline.state !== 'DRAFT' && <p role="alert">This proposal is no longer an editable draft.</p>}
      {blocked && <p role="status">Saving is paused. Reload and confirm discarding your edits to reconcile with the latest saved version before saving again.</p>}
      <form className="draft-form" noValidate onSubmit={event => void save(event)}>
        <DraftFields content={content} errors={errors} disabled={pending || loading} onChange={(field, value) => { setContent({ ...content, [field]: value }); setSuccess(''); }} />
        <fieldset disabled={pending || loading}>
          <legend>Acceptance criteria</legend>
          <p>Up to 50 criteria, each at most 2,000 characters. New criteria are required by default. Empty and all-optional collections may be saved as drafts.</p>
          {errors.criteria && <p role="alert">{errors.criteria}</p>}
          {content.criteria.length === 0 && <p>No criteria yet. You can save this incomplete draft.</p>}
          {content.criteria.map((criterion, index) => {
            const changed = criterion.stableKey && baseline.content.criteria.find(item => item.stableKey === criterion.stableKey)?.statement !== criterion.statement.replace(/\r\n?/g, '\n');
            const statementError = errors[`criteria.${index}.statement`];
            const meaningError = errors[`criteria.${index}.meaning`];
            return <div key={criterion.stableKey ?? `new-${index}`}>
              <label htmlFor={`criterion-${index}-statement`}>Criterion {index + 1} statement</label>
              <textarea id={`criterion-${index}-statement`} value={criterion.statement} rows={3} aria-invalid={!!statementError}
                aria-describedby={statementError ? `criterion-${index}-error` : undefined}
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
          <legend>Submission preparation</legend>
          <p>Optional while drafting. Text is stored privately; patches and evidence are never executed.</p>
          {preparationFields.map(field => <div className="draft-field" key={field.name}>
            <label htmlFor={`draft-${field.name}`}>{field.label} (optional)</label>
            <p id={`draft-${field.name}-hint`}>Maximum {field.limit.toLocaleString('en')} characters. Incomplete draft text may be saved.</p>
            <textarea id={`draft-${field.name}`} rows={field.rows} value={content[field.name]} aria-invalid={!!errors[field.name]}
              aria-describedby={`draft-${field.name}-hint${errors[field.name] ? ` draft-${field.name}-error` : ''}`}
              onChange={event => { setContent({ ...content, [field.name]: event.target.value }); setSuccess(''); }} />
            {errors[field.name] && <p id={`draft-${field.name}-error`} className="field-error">{errors[field.name]}</p>}
          </div>)}
          <h4>Optional plain-text evidence</h4>
          <p id="evidence-hint">Maximum 50,000 characters in total. Each added item must contain text, or remove the item before saving. No evidence is required.</p>
          {errors.evidence && <p id="evidence-error" role="alert">{errors.evidence}</p>}
          {content.evidence.length === 0 && <p>No evidence added.</p>}
          {content.evidence.map((item, index) => <div className="draft-field" key={item.id ?? `new-evidence-${index}`}>
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
        <button type="submit" disabled={pending || loading || blocked || baseline.state !== 'DRAFT'}>{pending ? 'Saving…' : 'Save private draft'}</button>
      </form>
    </>}
    <button onClick={reload} disabled={pending || loading}>{content ? 'Reload latest draft and discard changes' : 'Retry loading draft'}</button>
    <button onClick={back} disabled={pending}>Back to draft detail</button>
  </>;
}

export function ContributorWorkspace(props: Props) {
  const [uncertain, setUncertain] = useState(false);
  const [pending, setPending] = useState(false);
  const [content, setContent] = useState(emptyContent);
  const loaded = useCallback(() => { if (!pending) setUncertain(false); }, [pending]);
  const markUncertain = useCallback(() => setUncertain(true), []);
  const markCertain = useCallback(() => setUncertain(false), []);
  return <section aria-label="Contributor drafts">
    <h2>Contributor workspace</h2>
    <Routes>
      <Route index element={<DraftList onSessionLost={props.onSessionLost} onLoaded={loaded} />} />
      <Route path="new" element={<CreateDraft {...props} content={content} setContent={setContent} pending={pending} setPending={setPending}
        uncertain={uncertain} onUncertain={markUncertain} onCertain={markCertain} />} />
      <Route path="drafts/:id" element={<DraftDetailRoute {...props} />} />
      <Route path="drafts/:id/edit" element={<EditDraftRoute {...props} />} />
      <Route path="*" element={<><h3>Page not found</h3><Link to="/contributor">Your drafts</Link></>} />
    </Routes>
  </section>;
}
