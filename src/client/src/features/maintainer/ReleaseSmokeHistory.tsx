import { useEffect, useState } from 'react';
import { releaseSmokeTestsResponseSchema, type ReleaseCandidateDetailResponse } from '@specsentry/shared';

type Props = { detail: ReleaseCandidateDetailResponse; onSessionLost(): void };

function Records({ items }: { items: ReleaseCandidateDetailResponse['smokeTests'] }) {
  return <ol>{items.map(test => <li key={test.id}><strong>{test.outcome}</strong> for content version {test.testedContentVersion}: {test.procedure}<p>{test.results}</p></li>)}</ol>;
}

export function ReleaseSmokeHistory({ detail, onSessionLost }: Props) {
  const [requested, setRequested] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [page, setPage] = useState<ReturnType<typeof releaseSmokeTestsResponseSchema.parse> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!requested) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError('');
      const query = new URLSearchParams({ limit: '5' });
      if (cursor) query.set('cursor', cursor);
      try {
        const response = await fetch(`/api/release-candidates/${encodeURIComponent(detail.id)}/smoke-tests?${query}`, {
          credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) { setPage(null); onSessionLost(); return; }
        if (!response.ok) throw new Error();
        const result = releaseSmokeTestsResponseSchema.parse(await response.json());
        if (!controller.signal.aborted) setPage(result);
      } catch {
        if (!controller.signal.aborted) setError('Unable to load bounded smoke-test history. The latest authoritative result remains shown above.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [attempt, cursor, detail.id, onSessionLost, requested]);

  const latest = detail.smokeTests[0];
  return <section><h2>Latest authoritative smoke test</h2>
    {!latest ? <p>No smoke tests recorded.</p> : <Records items={[latest]} />}
    {detail.smokeTestsTruncated && <p>Earlier smoke records are available through byte-bounded history pages.</p>}
    {!requested
      ? <button type="button" onClick={() => setRequested(true)}>Browse smoke-test history</button>
      : <section aria-labelledby="smoke-history-title"><h3 id="smoke-history-title">Smoke-test history</h3>
        <p>Newest records appear first. Each page is limited to five records and 256 KiB of procedure/result text.</p>
        {error && <p role="alert">{error}</p>}
        {loading ? <p role="status">Loading smoke-test history...</p>
          : error ? <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry smoke-test history</button>
            : page?.items.length === 0 ? <p>No smoke tests recorded.</p>
              : page && <Records items={page.items} />}
        {(cursor || page?.nextCursor) && <div className="pagination">
          {cursor && <button type="button" disabled={loading} onClick={() => setCursor(null)}>First smoke-test page</button>}
          {page?.nextCursor && <button type="button" disabled={loading} onClick={() => setCursor(page.nextCursor)}>Next smoke-test page</button>}
        </div>}
      </section>}
  </section>;
}
