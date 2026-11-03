import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { contributorAiUsageResponseSchema, contributorDraftResponseSchema, workingContentSchema, type SessionResponse, type WorkingContent } from '@specsentry/shared';

type Props = { proposalId: string; workingRevisionId: string; version: number; content: WorkingContent; disabled: boolean;
  session: SessionResponse; onSessionLost(): void; onApply(content: WorkingContent): void };
type Suggestion = ReturnType<typeof contributorDraftResponseSchema.parse>;
type Usage = ReturnType<typeof contributorAiUsageResponseSchema.parse>;
function errorReference(value: unknown) {
  const id = value && typeof value === 'object' && 'correlationId' in value ? value.correlationId : null;
  return typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(id)
    ? ` Reference: ${id}.` : ' Reference unavailable.';
}

export function SpecDraftAssistant({ proposalId, workingRevisionId, version, content, disabled, session, onSessionLost, onApply }: Props) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [usage, setUsage] = useState<Usage | null>(null);
  const [usageMessage, setUsageMessage] = useState('');
  const [usagePending, setUsagePending] = useState(false);
  const active = useRef(true); const generation = useRef(0); const locked = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const usageLocked = useRef(false);
  const invalidate = useCallback(() => {
    generation.current++; controller.current?.abort(); controller.current = null; locked.current = false;
  }, []);
  const clear = useCallback(() => {
    invalidate();
    setSuggestion(null); setSelected([]); setPending(false); setMessage('');
  }, [invalidate]);
  useEffect(() => {
    active.current = true;
    window.addEventListener('pagehide', clear); window.addEventListener('pageshow', clear);
    return () => {
      active.current = false; invalidate();
      window.removeEventListener('pagehide', clear); window.removeEventListener('pageshow', clear);
    };
  }, [clear, invalidate]);
  useLayoutEffect(() => {
    // Erase stale protected output before painting changed working content.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    clear();
  }, [proposalId, workingRevisionId, version, disabled, clear]);

  async function generate() {
    if (disabled || locked.current) return;
    clear(); locked.current = true; setPending(true); setUsage(null);
    const current = generation.current; const abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}/ai/draft`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: abort.signal,
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken }, body: JSON.stringify({ expectedVersion: version, workingRevisionId }) });
      if (response.status === 401) { if (active.current) clear(); onSessionLost(); return; }
      if (!active.current || current !== generation.current) return;
      if ([403, 404].includes(response.status)) { clear(); onSessionLost(); return; }
      if (!response.ok) {
        const reference = errorReference(await response.json().catch(() => null));
        if (!active.current || current !== generation.current) return;
        const fallback = response.status === 429 ? 'AI request limit reached. Try later; manual editing and saving remain available.'
          : response.status === 409 ? 'This saved draft changed. Reload and reconcile the saved working copy before generating again.'
            : response.status === 422 ? 'This draft cannot fit the assistant context or contains unsupported input. Keep editing manually; no content was changed.'
              : 'The assistant is unavailable. Your draft is unchanged; continue editing and saving manually.';
        setMessage(fallback + reference); return;
      }
      const result = contributorDraftResponseSchema.parse(await response.json());
      if (!active.current || current !== generation.current) return;
      if (result.analyzedScope.proposalId !== proposalId || result.analyzedScope.workingRevisionId !== workingRevisionId || result.analyzedScope.expectedVersion !== version) throw new Error();
      setSuggestion(result); setMessage('Suggestions only. Select individual items, then apply them to your local editor. Nothing has been saved.');
    } catch {
      if (active.current && current === generation.current) setMessage('The assistant could not return a valid suggestion. Your draft is unchanged; continue manually. Reference unavailable.');
    } finally { if (active.current && current === generation.current) { locked.current = false; controller.current = null; setPending(false); } }
  }
  async function loadUsage() {
    if (usageLocked.current) return; usageLocked.current = true; setUsagePending(true); setUsageMessage('');
    try {
      const response = await fetch('/api/contributor/ai/usage', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { if (active.current) clear(); onSessionLost(); return; }
      if (!active.current) return;
      if (response.status === 403) { clear(); onSessionLost(); return; }
      if (!response.ok) throw new Error();
      const result = contributorAiUsageResponseSchema.parse(await response.json());
      if (active.current) setUsage(result);
    } catch { if (active.current) setUsageMessage('AI resource measurements are unavailable. Manual editing remains available.'); }
    finally { usageLocked.current = false; if (active.current) setUsagePending(false); }
  }
  const valid = !disabled && suggestion && suggestion.analyzedScope.expectedVersion === version
    && suggestion.analyzedScope.proposalId === proposalId && suggestion.analyzedScope.workingRevisionId === workingRevisionId;
  const options = valid ? [
    { key: 'objective', label: 'Replace expected behavior', text: suggestion.result.objective, target: 'objective' },
    ...suggestion.result.acceptanceCriteria.map((text, index) => ({ key: `criterion-${index}`, label: 'Add a new required criterion', text, target: 'criterion' })),
    ...(['edgeCases', 'ambiguities', 'testIdeas'] as const).flatMap(kind => suggestion.result[kind].map((text, index) => ({ key: `${kind}-${index}`, label: `Append to constraints (${({ edgeCases: 'Edge case', ambiguities: 'Ambiguity', testIdeas: 'Test idea' })[kind]})`, text, target: kind }))),
  ] : [];
  function apply() {
    if (!valid || !selected.length || pending) return;
    const chosen = options.filter(option => selected.includes(option.key));
    const notes = chosen.filter(option => !['objective', 'criterion'].includes(option.target)).map(option => `${({ edgeCases: 'Edge case', ambiguities: 'Ambiguity', testIdeas: 'Test idea' })[option.target as 'edgeCases']}: ${option.text}`);
    const next = workingContentSchema.safeParse({ ...content,
      expectedBehavior: chosen.find(option => option.target === 'objective')?.text ?? content.expectedBehavior,
      criteria: [...content.criteria, ...chosen.filter(option => option.target === 'criterion').map(option => ({ statement: option.text, required: true }))],
      constraints: notes.length ? [content.constraints, ...notes].filter(Boolean).join('\n') : content.constraints,
    });
    if (!next.success) { setMessage('Selected suggestions exceed a field or criterion limit. Nothing was applied. Select fewer items or adjust the draft manually.'); return; }
    clear(); onApply(next.data);
  }
  return <section aria-label="Spec Draft Assistant" className="narrative-section">
    <h2>Spec Draft Assistant</h2><p>Advisory suggestions from saved working version {version}. Save and reconcile changes before requesting suggestions. Patch and evidence are excluded from this assistant.</p>
    <button type="button" disabled={disabled || pending} onClick={() => void generate()}>{pending ? 'Generating suggestions...' : 'Generate draft suggestions'}</button>
    {disabled && <p>Save or reconcile the working copy before using the assistant. Manual editing remains available in eligible states.</p>}
    {message && <p role="status">{message}</p>}
    {valid && <>
      <h3>Select suggestions to apply</h3><p>Selection starts empty. The objective replaces Expected behavior; new criteria are required; selected notes append to Constraints. Apply only changes this unsaved editor.</p>
      {options.map(option => <label className="plain-text" key={option.key}><input type="checkbox" checked={selected.includes(option.key)} onChange={event => setSelected(previous => event.target.checked ? [...previous, option.key] : previous.filter(key => key !== option.key))} />{option.label}: {option.text}</label>)}
      <button type="button" disabled={!selected.length || pending} onClick={apply}>Apply selected suggestions to editor</button>
      <button type="button" onClick={clear}>Discard suggestions</button>
    </>}
    <h3>Your AI resource use</h3><p>Application limits reset at Singapore midnight (SGT). Provider spend windows use UTC and are separate. Application response caching is disabled.</p>
    <button type="button" disabled={usagePending} onClick={() => void loadUsage()}>{usagePending ? 'Loading AI resource use...' : 'Refresh my AI resource use'}</button>
    {usageMessage && <p role="status">{usageMessage}</p>}
    {usage && <dl><div><dt>Application day</dt><dd>{usage.startedAt} to {usage.resetsAt} (SGT calendar day)</dd></div>
      <div><dt>Requests / outbound attempts / retries</dt><dd>{usage.requests} / {usage.attempts} / {usage.retries}</dd></div>
      <div><dt>Failed attempts / completed attempts / preflight rejections</dt><dd>{usage.failedAttempts} / {usage.completedAttempts} / {usage.preflightRejections}</dd></div>
      <div><dt>Failure rate among completed attempts</dt><dd>{usage.failureRate === null ? 'N/A (no completed attempts)' : `${(usage.failureRate * 100).toFixed(1)}%`}</dd></div>
      <div><dt>Provider usage reporting coverage</dt><dd>{usage.usageReportedAttempts} of {usage.attempts} outbound attempts</dd></div>
      {(['promptTokens', 'completionTokens', 'totalTokens', 'cachedTokens'] as const).map(field => <div key={field}><dt>{({ promptTokens: 'Reported input tokens', completionTokens: 'Reported output tokens', totalTokens: 'Reported total tokens', cachedTokens: 'Provider-reported cached tokens' })[field]}</dt><dd>{usage.usage[field] ?? 'Unknown'}</dd></div>)}
    </dl>}
  </section>;
}
