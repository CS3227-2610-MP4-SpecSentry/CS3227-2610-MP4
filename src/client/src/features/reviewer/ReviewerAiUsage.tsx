import { useCallback, useEffect, useRef, useState } from 'react';
import { reviewerAiUsageResponseSchema, type ReviewerAiUsageResponse } from '@specsentry/shared';
import type { AuthorizationGeneration } from '../../shared/authorization';

const count = (value: number | null) => value === null ? 'Unknown' : value.toLocaleString();

export function ReviewerAiUsage({ authorization, expiresAt, onAccessLost }: {
  authorization: AuthorizationGeneration; expiresAt: number; onAccessLost: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<ReviewerAiUsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const clear = useCallback(() => {
    generation.current++; controller.current?.abort(); setUsage(null); setLoading(false); setError('');
  }, []);
  useEffect(() => {
    const hide = () => { clear(); setOpen(false); };
    const timer = window.setTimeout(hide, Math.max(0, expiresAt - Date.now()));
    window.addEventListener('pagehide', hide);
    // A restored page must obtain a new server-authorized response before showing totals.
    window.addEventListener('pageshow', hide);
    return () => {
      clear(); window.clearTimeout(timer);
      window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', hide);
    };
  }, [expiresAt, clear]);

  async function refresh() {
    clear(); setOpen(true); setLoading(true);
    const local = generation.current; const auth = authorization.current();
    const abort = new AbortController(); controller.current = abort;
    const current = () => !abort.signal.aborted && local === generation.current && auth === authorization.current() && Date.now() < expiresAt;
    try {
      const response = await fetch('/api/reviews/ai/usage', { credentials: 'same-origin', cache: 'no-store', signal: abort.signal });
      if (!current()) return;
      if ([401, 403].includes(response.status)) { clear(); setOpen(false); onAccessLost(); return; }
      if (!response.ok) throw new Error();
      const body: unknown = await response.json();
      if (!current()) return;
      setUsage(reviewerAiUsageResponseSchema.parse(body));
    } catch {
      if (current()) setError('AI usage is unavailable. You can continue manual review and refresh later.');
    } finally { if (current()) setLoading(false); }
  }

  return <section aria-label="My Reviewer AI usage">
    <h2>My Reviewer AI usage</h2>
    <button aria-expanded={open} aria-controls="reviewer-ai-usage" onClick={() => { if (open) { clear(); setOpen(false); } else void refresh(); }}>{open ? 'Hide my AI usage' : 'Show my AI usage'}</button>
    {open && <div id="reviewer-ai-usage">
      <button disabled={loading} onClick={() => void refresh()}>Refresh AI usage</button>
      {loading && <p role="status">Loading AI usage…</p>}
      {error && <p role="status">{error}</p>}
      {usage && <>
        <p>SGT day: {new Date(usage.startedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} to {new Date(usage.resetsAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} (exclusive end).</p>
        <p>Only your Reviewer feature usage, across current and former assignments. Shared account quotas include other AI features; these totals do not show remaining quota.</p>
        {usage.requests === 0 && usage.attempts === 0 && <p role="status">No Reviewer AI activity in this SGT day.</p>}
        <dl>
          <dt>Requests admitted or rejected today</dt><dd>{usage.requests}</dd>
          <dt>Outbound attempts dispatched today</dt><dd>{usage.attempts}</dd>
          <dt>Retries dispatched today</dt><dd>{usage.retries}</dd>
          <dt>Completed outbound attempts</dt><dd>{usage.completedAttempts}</dd>
          <dt>Failed outbound attempts</dt><dd>{usage.failedAttempts}</dd>
          <dt>Completed outbound attempt failure rate</dt><dd>{usage.failureRate === null ? 'N/A — no completed outbound attempts' : `${(usage.failureRate * 100).toFixed(1)}%`}</dd>
          <dt>Local preflight rejections (no outbound attempts)</dt><dd>{usage.preflightRejections}</dd>
          <dt>Provider prompt tokens</dt><dd>{count(usage.usage.promptTokens)}</dd>
          <dt>Provider completion tokens</dt><dd>{count(usage.usage.completionTokens)}</dd>
          <dt>Provider total tokens</dt><dd>{count(usage.usage.totalTokens)}</dd>
          <dt>Provider cached tokens</dt><dd>{count(usage.usage.cachedTokens)}</dd>
          <dt>Attempts reporting any provider usage</dt><dd>{usage.usageReportedAttempts} of {usage.attempts}</dd>
          <dt>Application cache</dt><dd>Disabled</dd>
          <dt>Provider spend window</dt><dd>{usage.providerSpendWindow}</dd>
        </dl>
        <p>Unknown means no complete provider measurement for that field. Admission estimates are not token usage. A successful outbound attempt stays successful if delivery is later denied.</p>
      </>}
    </div>}
  </section>;
}
