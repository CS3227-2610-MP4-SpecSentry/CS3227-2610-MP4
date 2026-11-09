# Reflections

Status: final evidence synthesis updated on 9 November 2026. It reports measured
observations and their limitations; it does not turn missing baselines, telemetry
or human verification into positive results.

## Evidence and method

We separate application AI from development-agent work because they have different
inputs, risks and resource measurements. Application AI is the bounded NUS SoC LLM
feature used by the three SpecSentry roles. Development agents helped specify,
implement, review and release the repository. The main evidence is:

| Evidence | What it establishes | Important limit |
| --- | --- | --- |
| [Maintainer smoke workflow observation](../workflow/evaluations/2026-11-05-maintainer-smoke-workflow-observation.md) | A measured orchestrator, implementer and independent-verifier run | No matched single-agent run |
| [Deployment-agent workflow observation](../workflow/evaluations/2026-11-07-deployment-agent-workflow-observation.md) | Three specialist pre-reviews, implementation, correction and independent re-review | Repository-only at the time; no provider mutation in that experiment |
| [Azure migration run](../logs/yu-sutong/2026-11-09-azure-container-apps-migration-run.md) | Provider migration, isolated OIDC/RBAC, recovery from quota/registration failures and final same-digest Azure release evidence | Long-running intervals include waiting and cannot isolate agent-only cost |
| [Reviewer completion run](../logs/ngkhengyang/2026-11-04-reviewer-completion-execution.md) | A long coordinated run with pause/resume, blocked prerequisites and retained failed attempts | Environment and harness overhead cannot be separated cleanly from agent overhead |
| [Final release and AI activation run](../logs/yu-sutong/2026-11-08-final-session-banner.md) | Strict-contract live probes, deployed development role checks, production activation and fresh reviews | Representative cases only; production role UI was not exercised |
| [AI security specification](../workflow/specs/AI-SECURITY-SPEC.md) and tests linked from [traceability](../workflow/TRACEABILITY.md) | Context boundaries, schemas, quotas, timeout, retry and manual fallback | Provider quota and retention policy were not independently verified |

The repository's role allocation assigns Contributor to `yooplo`, Reviewer to
`ngkhengyang`, and Release Maintainer plus deployment work to `yu-sutong`. The logs
record implementation evidence, but each person must still confirm their actual
contribution and AI-use declaration before submission.

## Multi-Agent Software Engineering

### What coordination changed

The Maintainer smoke workflow used a bounded architecture/security analysis before
implementation, followed by independent Release, Security and Spec/Docs checks. It
registered 13 intervals. End-to-end wall time was 1,256.265787 seconds, while
summed overlapping interval time was 2,193.225086 seconds. Seven security controls
were defined before review. One failed implementation attempt consumed 122.175881
seconds and the focused correction consumed 21.115397 seconds. The final independent
reviews reported no remaining findings in their scoped criteria. This is useful
quality and coordination evidence, but the overlap ratio is not a speedup: there is
no equivalent single-agent run and waiting time is included in elapsed time.

The deployment workflow gave the same repository-only release problem to a
Deployment Architect, Security Reviewer and Database/Recovery Specialist. Their
different perspectives were not interchangeable. Coordinator reconciliation
rejected the first `workflow_run`/`develop` design because its attestation identity
would not truthfully describe the checked-out source. A later integration pass found
that Render could not bootstrap an image-backed service before the first GHCR image
existed. The correction separated first-image publication from development release
and production promotion. The run recorded 16 intervals and 12,756.592400 seconds
of summed, overlapping time. The first independent Release, Security and Spec/Docs
reviews all found issues; bounded fixes then passed fresh re-review. Specialization
therefore exposed concrete trust, migration and bootstrap defects before provider
deployment, while also adding three pre-reviews, a large implementation handoff and
a correction cycle.

The Reviewer completion run showed a different cost. A stale Prisma client, native
browser visibility, Windows command quoting and database timing made some attempts
fail for harness reasons rather than product reasons. Pausing correctly closed all
active measurement intervals; resuming used fresh state and retained unresolved
gates. This prevented a conversation summary from being treated as current source
truth, but required coordination time and careful accounting.

### Our conclusion

Multiple agents were most valuable for cross-cutting, high-risk work where the
acceptance views were genuinely different: authorization/security, migration and
recovery, release identity, and specification/documentation consistency. A single
coordinator remained necessary to resolve incompatible recommendations and own the
final tree; parallel opinions did not integrate themselves. For a localized
documentation correction, test assertion or small harness change, one writer plus
deterministic checks is preferable because specialist setup, handoff and permission
overhead would dominate the work.

We did not execute a matched single-agent condition on the same source revision and
task. Consequently, the evidence supports defect-prevention and coordination-cost
claims, not claims that multi-agent work was faster, cheaper or used fewer tokens.

## Context Engineering

### Application AI

Each role receives a server-owned context pack rather than a browser-supplied prompt
or a repository dump:

- Contributor AI receives only the authenticated user's eligible draft fields and
  server-owned instructions for a strict five-field specification suggestion.
- Reviewer AI receives the immutable assigned submission, sanitized unified diff,
  optional evidence and one to five selected criterion IDs. It must return exactly
  those IDs and cannot write manual coverage or a review decision.
- Maintainer AI receives selected approved-item summaries and deterministic gate
  states, not credentials, raw patches or authority to publish.

All three paths delimit untrusted text, prohibit tools and provider-side conversation
state, cap input/output, validate one strict JSON object and recheck authorization
after any queue wait. Unknown grounding IDs, extra fields, malformed JSON, refusal
and truncation fail closed; the manual role workflow stays available.

On 8 November, one representative request through each role's exact preparation and
decoder returned HTTP 200 with schema-valid output. Authenticated Contributor,
Reviewer and Maintainer development workflows also passed. This shows that the
chosen context and contracts work for representative cases. It does not show that
every multilingual, delimiter-heavy or near-limit input works, and it does not
verify the provider's retention policy or quantitative key limits.

### Development agents

The useful pattern was a minimum sufficient owner pack followed by a fresh verifier
view. Owners received the relevant requirements, interfaces, target files, tests and
stop conditions. Verifiers received the frozen diff, acceptance criteria and prior
failures, not the implementer's hidden reasoning. Persisted handoffs kept decisions,
blocked prerequisites and next actions, while continuations re-read the current
branch and worktree before acting.

This mattered in practice. The deployment specialists could focus on distinct trust
boundaries, but the coordinator still needed broader repository context to catch the
attestation and first-image integration errors. In the final release/AI run, focused
independent review caught stale gate wording and duplicated User Guide text after the
functional change passed. The initialization and Reviewer continuation records also
show why summaries alone are insufficient: current workspace state exposed existing
edits, stale generated clients and unresolved checks that conversational context did
not guarantee.

We did not run the same task once with a focused pack and once with a broad repository
pack, so we cannot quantify token or correctness improvement from context size. The
evidence instead supports a design decision: use focused, permission-bounded context
for each owner; use a current-tree/diff view at integration; and use broad context
only for cross-cutting reconciliation. More context was not automatically better,
but too little integration context caused rework.

## Resource-aware Use

### Application controls

Application limits are enforced locally rather than relying on an unknown provider
quota: 10 outbound attempts per user per rolling 10 minutes, 60 per user per SGT
day, 30 globally per rolling minute, a queue cap of 10 and a 20-second overall
deadline covering queue, authorization, database, provider and retry time. Output is
capped at 800 tokens and response bodies at 64 KiB. Only one transient retry is
allowed, within the same deadline and only after reserving quota; validation errors,
refusals and most 4xx responses are not retried. Overload returns a safe retry/fallback
response, and the deterministic manual workflow remains usable.

Application response caching is deliberately disabled because role context is
private, mutable and authorization-sensitive. Provider token/cache figures are
recorded only when the provider actually returns them; absent values stay unknown.
This trades possible cache savings for simpler privacy and freshness guarantees.

### Development-agent measurements

Resource intervals started before repository edits and retained failed or interrupted
attempts. The Maintainer run's 1,256.265787-second wall time versus 2,193.225086
summed seconds demonstrates overlap, not saved time. The deployment run retained
16 intervals and 12,756.592400 summed seconds, including failed first reviews and
their corrections. The final release/AI run recorded 6,429.285679 seconds end to
end and 7,144.845127 summed seconds, including failed setup attempts and review-driven
rework.

Attributable input/output tokens, cache reads, tool calls, retries, observed model
and reasoning effort were not exposed for these runs. We therefore report them as
unavailable rather than zero, do not derive cost from account percentages and do not
claim a cache or model-choice saving. Summed agent time can exceed wall time because
intervals overlap; neither value is CPU/model-only computation.

The practical resource decision is to reserve coordinated specialists for work where
an independent viewpoint can prevent a high-impact defect. Use one owner for small
edits, stop after a discriminating failed check instead of launching blind retries,
and keep provider attempts bounded independently from development-agent activity.

## Experiment results and final conclusions

| Question | Evidence-backed result | Limit retained |
| --- | --- | --- |
| Did coordinated agents improve quality? | Maintainer and deployment observations show explicit pre-review controls, two corrected deployment design defects and fresh independent verification. | No matched single-agent condition; no causal speed or cost claim. |
| How was context shared? | Role-specific owner packs, frozen diffs, structured handoffs and current-tree rechecks separated ownership from verification. | No controlled focused-versus-broad token/quality comparison. |
| Were resources measured honestly? | Wall and interval times, failures and corrections were retained; unavailable telemetry stayed null. | Token/cache/tool/retry and exact model/effort telemetry were not exposed for these runs. |
| Did application context contracts work? | Representative strict-contract calls and all three development role workflows passed. | Broader model edge cases, provider quotas/retention and production role-UI acceptance were not tested. |
| Did caching or model choice reduce cost? | No supported reduction claim. Application caching was disabled and development cache/model comparison was not executed. | A future controlled run would need the same task/revision/checks and attributable telemetry. |

The strongest result is not that more agents or more context are always better. It
is that explicit responsibility, minimum necessary context, deterministic gates,
fresh independent review and honest resource accounting made defects and evidence
gaps visible. The remaining limitations are part of the final result, not silently
converted into successful experiments.
