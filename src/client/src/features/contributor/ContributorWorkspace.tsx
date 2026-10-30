import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { createProposalRequestSchema, draftResponseSchema, ownDraftsResponseSchema, proposalLifecycleResponseSchema,
  type OwnDraftsResponse, type SessionResponse } from '@specsentry/shared';

type Props = { session: SessionResponse; onSessionLost(): void };
const emptyContent = { title: '', problem: '', constraints: '', expectedBehavior: '', summary: '', diffText: '', criteria: [], evidence: [] };
const fields = [
  { name: 'title', label: 'Title', limit: 200, required: true },
  { name: 'problem', label: 'Problem', limit: 10000, required: true },
  { name: 'constraints', label: 'Constraints', limit: 10000, required: false },
  { name: 'expectedBehavior', label: 'Expected behavior', limit: 10000, required: true },
] as const;

async function failure(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const id = body && typeof body === 'object' && 'correlationId' in body ? body.correlationId : null;
    if (typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id)) return `Request could not be completed. Reference: ${id}`;
  } catch { /* The safe fallback also covers non-JSON responses. */ }
  return 'Request could not be completed. Please try again.';
}

function DraftList({ onSessionLost, onLoaded }: { onSessionLost(): void; onLoaded(): void }) {
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
      {fields.map(field => <div className="draft-field" key={field.name}>
        <label htmlFor={`draft-${field.name}`}>{field.label}{field.required ? ' (required)' : ' (optional)'}</label>
        <p id={`draft-${field.name}-hint`}>Maximum {field.limit.toLocaleString('en')} characters.</p>
        {field.name === 'title' ? <input id={`draft-${field.name}`} value={content[field.name]} required disabled={pending}
          aria-invalid={!!errors[field.name]} aria-describedby={`draft-${field.name}-hint${errors[field.name] ? ` draft-${field.name}-error` : ''}`}
          onChange={event => setContent({ ...content, [field.name]: event.target.value })} />
          : <textarea id={`draft-${field.name}`} rows={5} value={content[field.name]} required={field.required} disabled={pending}
            aria-invalid={!!errors[field.name]} aria-describedby={`draft-${field.name}-hint${errors[field.name] ? ` draft-${field.name}-error` : ''}`}
            onChange={event => setContent({ ...content, [field.name]: event.target.value })} />}
        {errors[field.name] && <p className="field-error" id={`draft-${field.name}-error`}>{errors[field.name]}</p>}
      </div>)}
      {error && <p role="alert">{error}</p>}
      {pending ? <p role="status">Creating your draft. Wait for the result before creating again.</p>
        : uncertain && <p role="status">Check your draft list before creating again to avoid a duplicate. Your entered text stays here.</p>}
      <button type="submit" disabled={pending || uncertain}>{pending ? 'Creating…' : 'Create private draft'}</button>
    </form>
    <Link to="/contributor">Back to your drafts</Link>
  </>;
}

function DraftDetail({ onSessionLost }: { onSessionLost(): void }) {
  const { id } = useParams();
  const [detail, setDetail] = useState<ReturnType<typeof draftResponseSchema.parse> | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setDetail(null); setError('');
      try {
        const response = await fetch(`/api/proposals/${encodeURIComponent(id ?? '')}/draft`, { credentials: 'same-origin', signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 401) { onSessionLost(); return; }
        if (!response.ok) { setError(await failure(response)); return; }
        const result = draftResponseSchema.parse(await response.json());
        if (!controller.signal.aborted) setDetail(result);
      } catch { if (!controller.signal.aborted) setError('Unable to load this draft. Please try again.'); }
    }
    void load(); return () => controller.abort();
  }, [id, attempt, onSessionLost]);
  return <>
    <h3>Private draft detail</h3><Link to="/contributor">Back to your drafts</Link>
    {error ? <><p role="alert">{error}</p><button onClick={() => setAttempt(value => value + 1)}>Retry loading draft</button></>
      : !detail || detail.proposalId !== id ? <p role="status">Loading draft…</p> : <>
        <p>Private · {detail.state}</p>
        <dl>{fields.map(field => <div key={field.name}><dt>{field.label}</dt><dd>{detail.content[field.name] || 'None provided.'}</dd></div>)}</dl>
      </>}
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
      <Route path="drafts/:id" element={<DraftDetail onSessionLost={props.onSessionLost} />} />
      <Route path="*" element={<><h3>Page not found</h3><Link to="/contributor">Your drafts</Link></>} />
    </Routes>
  </section>;
}
