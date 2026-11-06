import { useCallback, useEffect, useRef, useState } from 'react';
import { maintainerAiUsageResponseSchema, maintainerGateRequestSchema, maintainerGateResponseSchema,
  type MaintainerAiUsageResponse, type MaintainerGateResponse,
  type ReleaseCandidateDetailResponse, type SessionResponse } from '@specsentry/shared';

type AssistantProps = { detail: ReleaseCandidateDetailResponse; disabled: boolean;
  session: SessionResponse; onSessionLost(): void; onBusyChange?(busy: boolean): void };

export function ReleaseGateAssistant({ detail, disabled, session, onSessionLost, onBusyChange }: AssistantProps) {
  const [suggestion, setSuggestion] = useState<MaintainerGateResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const active = useRef(true);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    generation.current++; controller.current?.abort(); controller.current = null;
    onBusyChange?.(false);
  }, [onBusyChange]);
  const clear = useCallback(() => {
    cancel(); setSuggestion(null); setPending(false); setMessage('');
  }, [cancel]);
  useEffect(() => {
    active.current = true;
    window.addEventListener('pagehide', clear); window.addEventListener('pageshow', clear);
    return () => {
      active.current = false; cancel();
      window.removeEventListener('pagehide', clear); window.removeEventListener('pageshow', clear);
    };
  }, [cancel, clear]);

  async function generate() {
    if (disabled || pending) return;
    clear(); setPending(true); onBusyChange?.(true);
    const local = generation.current; const abort = new AbortController(); controller.current = abort;
    const body = maintainerGateRequestSchema.parse({ expectedVersion: detail.version,
      expectedContentVersion: detail.contentVersion });
    try {
      const response = await fetch(`/api/release-candidates/${encodeURIComponent(detail.id)}/ai/readiness`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: abort.signal,
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken }, body: JSON.stringify(body),
      });
      if (!active.current || local !== generation.current || abort.signal.aborted) return;
      if (response.status === 401) { clear(); onSessionLost(); return; }
      if ([403, 404].includes(response.status)) { clear(); onSessionLost(); return; }
      if (!response.ok) {
        const text = response.status === 409 ? 'The candidate changed. Refresh before requesting another advisory summary.'
          : response.status === 422 ? 'This candidate cannot fit the assistant context or contains unsupported input. Use the deterministic gates manually.'
            : response.status === 429 ? 'AI request limit reached. Try later; the manual release workflow remains available.'
              : 'The Release Gate Assistant is unavailable. The manual release workflow remains available.';
        setMessage(text); return;
      }
      const result = maintainerGateResponseSchema.parse(await response.json());
      if (!active.current || local !== generation.current) return;
      if (result.analyzedScope.candidateId !== detail.id || result.analyzedScope.expectedVersion !== detail.version ||
          result.analyzedScope.expectedContentVersion !== detail.contentVersion ||
          result.analyzedScope.candidateItemCount !== detail.members.length) throw new Error();
      if (result.status === 'STALE') {
        setMessage('The candidate changed while the assistant was running. Its output was discarded; refresh and use current server gates.'); return;
      }
      setSuggestion(result);
      setMessage('Advisory summary only. It cannot clear deterministic blockers, publish, or change candidate data.');
    } catch {
      if (active.current && local === generation.current && !abort.signal.aborted)
        setMessage('The assistant returned an invalid or incomplete result. Use the deterministic gates manually.');
    } finally {
      if (active.current && local === generation.current) { controller.current = null; setPending(false); onBusyChange?.(false); }
    }
  }

  return <section className="draft-panel" aria-labelledby="release-gate-assistant-title">
    <h2 id="release-gate-assistant-title">Release Gate Assistant</h2>
    <p>Uses structured item summaries and current gate statuses. It never publishes or changes release state.</p>
    <button type="button" disabled={disabled || pending} onClick={() => void generate()}>
      {pending ? 'Generating advisory summary...' : 'Generate advisory readiness summary'}</button>
    {disabled && <p>Refresh and reconcile the candidate before using the assistant. Manual gates remain available.</p>}
    {message && <p role="status">{message}</p>}
    {suggestion?.status === 'CURRENT' && <div>
      <p><strong>Recommendation:</strong> {suggestion.result.readinessRecommendation} · confidence {suggestion.result.confidence}</p>
      <h3>Advisory blockers</h3>{suggestion.result.blockers.length ? <ul>{suggestion.result.blockers.map((blocker, index) =>
        <li key={`${index}:${blocker.itemIds.join(':')}`}>{blocker.description}{blocker.itemIds.length ? ` (${blocker.itemIds.join(', ')})` : ''}</li>)}</ul> : <p>None suggested.</p>}
      {([
        ['Dependencies', suggestion.result.dependencies], ['Release notes', suggestion.result.releaseNotes],
        ['Rollback considerations', suggestion.result.rollbackConsiderations],
      ] as const).map(([label, items]) => <div key={label}><h3>{label}</h3>{items.length ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>None suggested.</p>}</div>)}
    </div>}
  </section>;
}

export function MaintainerAiUsage({ onSessionLost }: { session: SessionResponse; onSessionLost(): void }) {
  const [usage, setUsage] = useState<MaintainerAiUsageResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    if (pending) return;
    setPending(true); setMessage('');
    try {
      const response = await fetch('/api/maintainer/ai/usage', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { setUsage(null); onSessionLost(); return; }
      if (response.status === 403) { setUsage(null); onSessionLost(); return; }
      if (!response.ok) throw new Error();
      setUsage(maintainerAiUsageResponseSchema.parse(await response.json()));
    } catch { setMessage('Project AI resource measurements are unavailable. Role workflows remain usable.'); }
    finally { setPending(false); }
  }

  return <section className="draft-panel" aria-labelledby="maintainer-ai-usage-title"><h2 id="maintainer-ai-usage-title">Project AI resource use</h2>
    <p>Aggregated across project features without exposing another user’s prompts, outputs, or run history.</p>
    <button type="button" disabled={pending} onClick={() => void load()}>{pending ? 'Loading project AI use...' : 'Refresh project AI resource use'}</button>
    {message && <p role="status">{message}</p>}
    {usage && <dl><div><dt>Application day</dt><dd>{usage.startedAt} to {usage.resetsAt} (SGT)</dd></div>
      <div><dt>Requests / outbound attempts / retries</dt><dd>{usage.requests} / {usage.attempts} / {usage.retries}</dd></div>
      <div><dt>Failed / completed attempts / preflight rejections</dt><dd>{usage.failedAttempts} / {usage.completedAttempts} / {usage.preflightRejections}</dd></div>
      <div><dt>Failure rate</dt><dd>{usage.failureRate === null ? 'N/A' : `${(usage.failureRate * 100).toFixed(1)}%`}</dd></div>
      <div><dt>Provider usage reporting coverage</dt><dd>{usage.usageReportedAttempts} of {usage.attempts} attempts</dd></div>
      {(['promptTokens', 'completionTokens', 'totalTokens', 'cachedTokens'] as const).map(field => <div key={field}><dt>{field}</dt><dd>{usage.usage[field] ?? 'Unknown'}</dd></div>)}
      <div><dt>Application cache</dt><dd>{usage.applicationCache}</dd></div><div><dt>Provider spend window</dt><dd>{usage.providerSpendWindow}</dd></div>
    </dl>}
  </section>;
}
