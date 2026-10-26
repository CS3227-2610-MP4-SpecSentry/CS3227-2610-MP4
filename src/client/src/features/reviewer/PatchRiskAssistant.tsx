import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createFindingRequestSchema, findingCommandResponseSchema, patchRiskResponseSchema, type PatchRiskResponse, type ProposalDetailResponse } from '@specsentry/shared';
import type { AuthorizationGeneration } from '../../shared/authorization';

type Props = {
  detail: ProposalDetailResponse;
  stale: boolean;
  authorization: AuthorizationGeneration;
  csrfToken: string;
  onAccessLost: () => void;
  onSaved: () => void;
};
type Draft = { index: number; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; description: string; criterionId: string; path: string; line: string };
const base = (id: string) => `/api/proposals/${encodeURIComponent(id)}`;
function reference(value: unknown): string {
  const id = value && typeof value === 'object' && 'correlationId' in value ? value.correlationId : null;
  return typeof id === 'string' && /^[A-Za-z0-9-]{1,128}$/.test(id) ? ` Reference: ${id}` : '';
}

export function PatchRiskAssistant({ detail, stale, authorization, csrfToken, onAccessLost, onSaved }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<PatchRiskResponse | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const liveResult = useRef<PatchRiskResponse | null>(null);
  const requestLocked = useRef(false);
  const saveLocked = useRef(false);
  const scope = { revisionId: detail.revision.id, assignmentId: detail.assignment.id, expectedVersion: detail.version, expectedAssignmentVersion: detail.assignment.version };
  const currentRevision = detail.revision.id === detail.assignment.revisionId && ['IN_REVIEW', 'CHANGES_REQUESTED'].includes(detail.state);
  const validResult = !!result && result.status === 'CURRENT' && !stale && currentRevision && result.analyzedScope.proposalId === detail.id && result.analyzedScope.revisionId === scope.revisionId && result.analyzedScope.assignmentId === scope.assignmentId && result.analyzedScope.expectedVersion === scope.expectedVersion && result.analyzedScope.expectedAssignmentVersion === scope.expectedAssignmentVersion;

  const invalidatePending = useCallback(() => {
    generation.current++;
    controller.current?.abort(); controller.current = null;
    liveResult.current = null;
  }, []);
  const clear = useCallback(() => {
    invalidatePending();
    requestLocked.current = false; saveLocked.current = false;
    setResult(null); setDraft(null); setPending(false); setSaving(false); setMessage('');
  }, [invalidatePending]);
  useEffect(() => {
    mounted.current = true;
    const hide = () => clear();
    window.addEventListener('pagehide', hide);
    // A restored document must require a fresh analysis rather than revive page memory.
    window.addEventListener('pageshow', hide);
    return () => { mounted.current = false; invalidatePending(); window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', hide); };
  }, [clear, invalidatePending]);
  useEffect(() => {
    // Authorization/scope changes must erase protected page memory immediately.
    // Deferring this reset could clear a new request or display obsolete output.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    clear(); setSelected([]);
  }, [detail.id, detail.revision.id, detail.version, detail.assignment.id, detail.assignment.version, stale, clear]);

  function toggle(id: string) {
    if (requestLocked.current || saving) return;
    clear();
    setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : previous.length < 5 ? [...previous, id] : previous);
  }
  async function analyze() {
    if (requestLocked.current || !currentRevision || stale || selected.length < 1 || selected.length > 5) return;
    clear(); requestLocked.current = true; setPending(true);
    const local = generation.current;
    const auth = authorization.current();
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetch(`${base(detail.id)}/ai/patch-risk`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: abort.signal, headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ ...scope, selectedCriterionIds: selected }) });
      if (!mounted.current || local !== generation.current || auth !== authorization.current()) return;
      if ([401, 403, 404].includes(response.status)) { clear(); onAccessLost(); return; }
      if (!response.ok) {
        const failure: unknown = await response.json().catch(() => null);
        const suffix = reference(failure);
        if (!mounted.current || local !== generation.current || auth !== authorization.current()) return;
        const inputLimit = response.status === 422 && failure !== null && typeof failure === 'object'
          && 'code' in failure && failure.code === 'AI_UNAVAILABLE' && 'reason' in failure && failure.reason === 'INPUT_LIMIT';
        setMessage((response.status === 409 ? 'Review scope changed. Refresh review before running the assistant again.' : inputLimit
          ? 'The complete review context exceeds the AI size limits. No specification, diff, or evidence was truncated. Manual review remains available.'
          : 'Patch Risk is unavailable. Continue with manual review or try again later.') + suffix); return;
      }
      const parsed = patchRiskResponseSchema.parse(await response.json());
      if (!mounted.current || local !== generation.current || auth !== authorization.current()) return;
      if (parsed.analyzedScope.proposalId !== detail.id || parsed.analyzedScope.revisionId !== scope.revisionId || parsed.analyzedScope.assignmentId !== scope.assignmentId || parsed.analyzedScope.expectedVersion !== scope.expectedVersion || parsed.analyzedScope.expectedAssignmentVersion !== scope.expectedAssignmentVersion || parsed.selectedCriterionIds.length !== selected.length || parsed.selectedCriterionIds.some(id => !selected.includes(id))) throw new Error('Mismatched analysis scope');
      liveResult.current = parsed; setResult(parsed);
      if (parsed.status === 'STALE') setMessage('This analysis is stale. Refresh review and rerun; suggestions cannot be applied.');
    } catch {
      if (mounted.current && local === generation.current && auth === authorization.current() && !abort.signal.aborted) setMessage('Patch Risk is unavailable. Continue with manual review or try again later.');
    } finally {
      if (mounted.current && local === generation.current) { requestLocked.current = false; setPending(false); controller.current = null; }
    }
  }
  function openDraft(index: number) {
    if (!mounted.current || !validResult || liveResult.current !== result) return;
    const risk = result!.result.risks[index];
    if (!risk) return;
    setDraft({ index, severity: risk.severity, description: risk.description, criterionId: risk.criterionIds.length === 1 ? risk.criterionIds[0]! : '', path: '', line: '' });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mounted.current || !validResult || liveResult.current !== result || !draft || saveLocked.current) return;
    let body;
    try {
      body = createFindingRequestSchema.parse({ revisionId: result!.analyzedScope.revisionId, assignmentId: result!.analyzedScope.assignmentId, expectedVersion: result!.analyzedScope.expectedVersion, expectedAssignmentVersion: result!.analyzedScope.expectedAssignmentVersion, severity: draft.severity, description: draft.description, ...(draft.criterionId ? { criterionId: draft.criterionId } : {}), ...(draft.path || draft.line ? { diffLocation: { path: draft.path, line: Number(draft.line) } } : {}) });
    } catch { setMessage('Check finding description, criterion, and diff location.'); return; }
    saveLocked.current = true; setSaving(true); setMessage('');
    const local = generation.current; const auth = authorization.current();
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetch(`${base(detail.id)}/findings`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: abort.signal, headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(body) });
      if (!mounted.current || local !== generation.current || auth !== authorization.current()) return;
      if ([401, 403, 404].includes(response.status)) { clear(); onAccessLost(); return; }
      if (!response.ok) {
        const suffix = reference(await response.json().catch(() => null));
        if (!mounted.current || local !== generation.current || auth !== authorization.current()) return;
        clear(); setMessage((response.status === 409 ? 'Review scope changed. Refresh review before saving a finding.' : 'Finding was not saved. Refresh review before trying again.') + suffix); return;
      }
      findingCommandResponseSchema.parse(await response.json());
      if (!mounted.current || local !== generation.current || auth !== authorization.current()) return;
      clear(); onSaved();
    } catch { if (mounted.current && local === generation.current && !abort.signal.aborted) { clear(); setMessage('Finding outcome is uncertain. Refresh review before trying again.'); } }
    finally { if (mounted.current && local === generation.current) { saveLocked.current = false; setSaving(false); controller.current = null; } }
  }
  return <section aria-label="Patch Risk assistant">
    <h4>Patch Risk assistant</h4>
    <p>Advisory suggestions only. Confirm the submitted material and save findings yourself. Confidence is model judgment, not a calibrated probability. Rerunning may produce different suggestions.</p>
    {!currentRevision && <p>Open the current assigned revision to run Patch Risk.</p>}
    <fieldset disabled={!currentRevision || stale || pending || saving}><legend>Select 1 to 5 criteria</legend>
      {detail.revision.criteria.map(criterion => <label key={criterion.id}><input type="checkbox" checked={selected.includes(criterion.id)} disabled={!selected.includes(criterion.id) && selected.length >= 5} onChange={() => toggle(criterion.id)} />{criterion.stableKey} ({criterion.id})</label>)}
    </fieldset>
    <button disabled={!currentRevision || stale || pending || saving || selected.length < 1} onClick={() => void analyze()}>{pending ? 'Analyzing…' : result ? 'Rerun Patch Risk' : 'Analyze selected criteria'}</button>
    {pending && <p role="status">Analyzing selected criteria. Manual review remains available.</p>}
    {message && <p role="status">{message}</p>}
    {result && <section aria-label="Patch Risk result">
      <p>Analyzed revision {result.analyzedScope.revisionId}; assignment {result.analyzedScope.assignmentId}; selected criterion IDs: {result.selectedCriterionIds.join(', ')} ({result.selectedCriterionIds.length} of {detail.revision.criteria.length}).</p>
      <p>Not analyzed in this batch: {detail.revision.criteria.filter(item => !result.selectedCriterionIds.includes(item.id)).map(item => item.id).join(', ') || 'None'}.</p>
      <p>{result.status === 'STALE' || !validResult ? 'Stale analysis; refresh review and rerun. No finding can be created from this result.' : 'Current analysis for the selected criteria only.'}</p>
      <p>Confidence: {result.result.confidence}. Rerun after any review or revision change.</p>
      <h5>Suggested coverage</h5><ul>{result.result.coverage.map(item => <li key={item.criterionId}>{item.criterionId}: {item.status} — {item.rationale}</li>)}</ul>
      <h5>Suggested risks</h5>{result.result.risks.length === 0 && <p>No risks suggested.</p>}<ol>{result.result.risks.map((risk, index) => <li key={index}>{risk.severity}: {risk.description} · Criteria: {risk.criterionIds.join(', ') || 'None'} <button disabled={!validResult || saving} onClick={() => openDraft(index)}>Create finding from risk {index + 1}</button></li>)}</ol>
      <h5>Questions</h5><ul>{result.result.questions.map((question, index) => <li key={index}>{question}</li>)}</ul>
      <h5>Suggested tests</h5><ul>{result.result.suggestedTests.map((test, index) => <li key={index}>{test}</li>)}</ul>
    </section>}
    {draft && validResult && <form aria-label="Create finding from Patch Risk" onSubmit={event => void save(event)}><fieldset disabled={saving}>
      <legend>Edit finding before saving</legend>
      <label>Severity<select value={draft.severity} onChange={event => setDraft({ ...draft, severity: event.target.value as Draft['severity'] })}>{(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Description<textarea required maxLength={2000} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
      <label>Criterion reference<select value={draft.criterionId} onChange={event => setDraft({ ...draft, criterionId: event.target.value })}><option value="">None</option>{result!.selectedCriterionIds.map(id => <option key={id} value={id}>{id}</option>)}</select></label>
      <label>Diff path<input value={draft.path} onChange={event => setDraft({ ...draft, path: event.target.value })} /></label>
      <label>Diff line<input type="number" min="1" step="1" value={draft.line} onChange={event => setDraft({ ...draft, line: event.target.value })} /></label>
      <button type="submit">Save finding</button><button type="button" onClick={() => setDraft(null)}>Cancel</button>
    </fieldset></form>}
  </section>;
}
