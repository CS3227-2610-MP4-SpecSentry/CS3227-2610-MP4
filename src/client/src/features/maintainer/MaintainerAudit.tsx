import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { maintainerAuditQuerySchema, maintainerAuditResponseSchema, type SessionResponse } from '@specsentry/shared';

type Props = { session: SessionResponse; onSessionLost(): void };
type Filters = { actorId?: string; proposalId?: string; releaseId?: string; action?: string;
  outcome?: string; from?: string; to?: string };

export function MaintainerAudit({ onSessionLost }: Props) {
  const [filters, setFilters] = useState<Filters>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [page, setPage] = useState<ReturnType<typeof maintainerAuditResponseSchema.parse> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError('');
      const query = new URLSearchParams({ limit: '20' });
      Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
      if (cursor) query.set('cursor', cursor);
      try {
        const response = await fetch(`/api/maintainer/audit?${query}`, {
          credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        });
        if (response.status === 401) { setPage(null); onSessionLost(); return; }
        if (response.status === 403) { setPage(null); onSessionLost(); return; }
        if (!response.ok) throw new Error();
        const result = maintainerAuditResponseSchema.parse(await response.json());
        if (!controller.signal.aborted) setPage(result);
      } catch {
        if (!controller.signal.aborted) setError('Unable to load the restricted audit. Check the filters and try again.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [attempt, cursor, filters, onSessionLost]);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = Object.fromEntries(['actorId', 'proposalId', 'releaseId', 'action', 'outcome', 'from', 'to']
      .flatMap(key => {
        const value = String(data.get(key) ?? '').trim();
        if (!value) return [];
        return [[key, (key === 'from' || key === 'to') ? new Date(value).toISOString() : value]];
      })) as Filters;
    if (!maintainerAuditQuerySchema.safeParse({ ...next, limit: 20 }).success) {
      setError('Check the audit identifiers, action/outcome values, and date range.'); return;
    }
    setCursor(null); setFilters(next);
  }

  return <>
    <p><Link to="/releases">Back to release candidates</Link></p>
    <div className="page-heading"><div><h1>Restricted project audit</h1>
      <p>Safe business, security, AI-metadata, and release-correction events. Raw prompts, responses, credentials and request bodies are excluded.</p></div></div>
    <form className="draft-form" onSubmit={apply}>
      <h2>Filter audit events</h2>
      <label htmlFor="audit-actor">Actor ID</label><input id="audit-actor" name="actorId" defaultValue={filters.actorId} />
      <label htmlFor="audit-proposal">Proposal ID</label><input id="audit-proposal" name="proposalId" defaultValue={filters.proposalId} />
      <label htmlFor="audit-release">Release candidate ID</label><input id="audit-release" name="releaseId" defaultValue={filters.releaseId} />
      <label htmlFor="audit-action">Action</label><input id="audit-action" name="action" defaultValue={filters.action} placeholder="RELEASE_PUBLISHED" />
      <label htmlFor="audit-outcome">Outcome</label><input id="audit-outcome" name="outcome" defaultValue={filters.outcome} placeholder="SUCCESS" />
      <label htmlFor="audit-from">From</label><input id="audit-from" name="from" type="datetime-local" />
      <label htmlFor="audit-to">To</label><input id="audit-to" name="to" type="datetime-local" />
      <button type="submit" disabled={loading}>Apply audit filters</button>
      <button type="button" disabled={loading} onClick={() => { setCursor(null); setFilters({}); }}>Reset audit filters</button>
    </form>
    <section className="draft-panel" aria-labelledby="audit-results-title"><h2 id="audit-results-title">Audit events</h2>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Loading restricted audit...</p>
        : error ? <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry audit</button>
          : page?.items.length === 0 ? <p>No audit events match these filters.</p>
            : <ol>{page?.items.map(item => <li key={`${item.source}:${item.id}`}>
              <p><strong>{item.action}</strong> · {item.outcome} · {item.source}</p>
              <p>{new Date(item.timestamp).toLocaleString()} · Actor {item.actorId ?? 'system'}</p>
              {(item.proposalId || item.releaseId) && <p>Proposal {item.proposalId ?? 'N/A'} · Release {item.releaseId ?? 'N/A'}</p>}
              {item.summary && <p>{item.summary}</p>}{item.reason && <p>Reason: {item.reason}</p>}
              {item.aiMetadata && <p>AI template {item.aiMetadata.templateVersion} · attempts {item.aiMetadata.attemptCount}
                {' · '}latency {item.aiMetadata.latencyMs ?? 'unknown'} ms · error {item.aiMetadata.errorClass ?? 'none'}</p>}
            </li>)}</ol>}
      {(cursor || page?.nextCursor) && <div className="pagination">
        {cursor && <button type="button" disabled={loading} onClick={() => setCursor(null)}>First audit page</button>}
        {page?.nextCursor && <button type="button" disabled={loading} onClick={() => setCursor(page.nextCursor)}>Next audit page</button>}
      </div>}
    </section>
  </>;
}
