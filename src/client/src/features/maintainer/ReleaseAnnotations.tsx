import { useEffect, useRef, useState, type FormEvent } from 'react';
import { appendReleaseAnnotationRequestSchema, releaseAnnotationSchema, releaseAnnotationsResponseSchema,
  type ReleaseCandidateDetailResponse, type SessionResponse } from '@specsentry/shared';

type Props = { detail: ReleaseCandidateDetailResponse; owner: boolean; session: SessionResponse; onSessionLost(): void };

export function ReleaseAnnotations({ detail, owner, session, onSessionLost }: Props) {
  const [page, setPage] = useState<ReturnType<typeof releaseAnnotationsResponseSchema.parse> | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [locked, setLocked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError('');
      const query = new URLSearchParams({ limit: '20' });
      if (cursor) query.set('cursor', cursor);
      try {
        const response = await fetch(`/api/release-candidates/${encodeURIComponent(detail.id)}/annotations?${query}`, {
          credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        });
        if (response.status === 401) { setPage(null); onSessionLost(); return; }
        if (response.status === 403) { setPage(null); onSessionLost(); return; }
        if (!response.ok) throw new Error();
        const result = releaseAnnotationsResponseSchema.parse(await response.json());
        if (!controller.signal.aborted) { setPage(result); setLocked(false); }
      } catch {
        if (!controller.signal.aborted) setError('Unable to load release annotations. Try again.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [attempt, cursor, detail.id, onSessionLost]);

  async function append(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || loading || locked || !detail.publication) return;
    const form = event.currentTarget;
    const parsed = appendReleaseAnnotationRequestSchema.safeParse({
      expectedVersion: detail.version, snapshotId: detail.publication.snapshotId,
      text: new FormData(form).get('annotation'),
    });
    if (!parsed.success) { setError('Enter a non-empty correction of at most 2,000 characters.'); return; }
    setPending(true); setError('');
    try {
      const response = await fetch(`/api/release-candidates/${encodeURIComponent(detail.id)}/annotations`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken },
        body: JSON.stringify(parsed.data),
      });
      if (!active.current) return;
      if (response.status === 401) { setPage(null); onSessionLost(); return; }
        if (response.status === 403) { setPage(null); onSessionLost(); return; }
      if (!response.ok) {
        if (response.status === 409 || response.status >= 500) setLocked(true);
        throw new Error(response.status === 409 ? 'stale' : 'request');
      }
      releaseAnnotationSchema.parse(await response.json());
      if (!active.current) return;
      form.reset(); setLocked(true); setCursor(null); setAttempt(value => value + 1);
    } catch (cause) {
      if (!active.current) return;
      setError(cause instanceof Error && cause.message === 'stale'
        ? 'This release record changed. Refresh annotations before trying again.'
        : 'The correction result may be uncertain. Refresh annotations before adding another.');
      setLocked(true);
    } finally { if (active.current) setPending(false); }
  }

  return <section className="draft-panel" aria-labelledby="release-annotations-title">
    <div className="panel-heading"><div><h2 id="release-annotations-title">Release corrections</h2>
      <p>Corrections are append-only and never rewrite the published snapshot.</p></div></div>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Loading release corrections...</p>
      : page?.items.length === 0 ? <p>No release corrections.</p>
        : <ol>{page?.items.map(annotation => <li key={annotation.id}><p>{annotation.text}</p>
          <p>Added by {annotation.actor.username} · {new Date(annotation.createdAt).toLocaleString()}</p></li>)}</ol>}
    {(cursor || page?.nextCursor) && <div className="pagination">
      {cursor && <button type="button" disabled={loading || pending} onClick={() => setCursor(null)}>First correction page</button>}
      {page?.nextCursor && <button type="button" disabled={loading || pending} onClick={() => setCursor(page.nextCursor)}>Next correction page</button>}
    </div>}
    {(locked || error) && <button type="button" disabled={loading || pending} onClick={() => setAttempt(value => value + 1)}>Refresh release corrections</button>}
    {owner && <form className="draft-form" onSubmit={event => void append(event)}>
      <h3>Append a correction</h3>
      <label htmlFor="release-annotation">Correction text</label>
      <textarea id="release-annotation" name="annotation" rows={4} maxLength={2000} required disabled={loading || pending || locked} />
      <button type="submit" disabled={loading || pending || locked}>{pending ? 'Adding correction...' : 'Add correction'}</button>
    </form>}
  </section>;
}
