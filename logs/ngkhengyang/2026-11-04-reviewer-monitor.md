# Reviewer workflow: supervised direct handoffs

## Context and requests

- Prompter: ngkhengyang, inferred from current Git `user.name`; 4 November 2026, Asia/Singapore.
- Scope: revise Reviewer execution instructions, not product behavior or executable harness logic. Earlier read-only advice established that a small dashboard slice is usually one implementation assignment, while substantial integration/testing can justify separate agents. Those earlier advice turns were not edited or retrospectively timed.
- Request: retain main-led requirements, independent security review and settled contracts; conditionally allocate test/integration agents; use batched owner-specific review/fix communication; keep main primarily monitoring with evidence-backed recorded intervention; consolidate using the named skill and account for every agent/step's MP4 sessions token usage.
- Steering: do not commit or create a branch; leave this task's changes staged so the prompter can move them later. This supersedes the earlier read-only restriction for this explicitly authorized update.
- Decisions: main retains initial contract/ownership decisions and accountability. Agents receive narrow run-evidence permissions or a named fallback recorder. Optional test agents map to existing implementer assignments; integration remains a mandatory stage executed by an implementer when no integrator is spawned. Direct handoffs need acknowledgements and supported wake/resume, with a minimal parent-dispatch fallback. Unresolved cross-owner decisions and repeated failed fix cycles escalate to main. Existing version 3 schema and commands remain unchanged.
- Human verification of this AI-produced summary: pending.

## Changes and evidence

- [Implementation procedure](../../workflow/reviewer/IMPLEMENTATION.md): conditional roles, direct handoff routing, quiet main monitoring, owner-scoped finding/fix batches, stable review gates, exceptional intervention records and skill-based closure.
- [Role entry point](../../workflow/reviewer/README.md), [main](../../workflow/reviewer/agents/MAIN.md), [implementer](../../workflow/reviewer/agents/IMPLEMENTER.md), [integrator](../../workflow/reviewer/agents/INTEGRATOR.md), [independent reviewer](../../workflow/reviewer/agents/REVIEWER.md), and new [optional test agent](../../workflow/reviewer/agents/TESTER.md): responsibility and execution mapping.
- [Resources](../../workflow/reviewer/RESOURCES.md): explicit actual-thread cumulative baseline/delta collection for every main/subagent step/attempt using MP4 sessions, safe attribution, cutoffs, unavailable counters and consolidation accounting.
- [Handoff procedure](../../workflow/reviewer/skills/reviewer-role-agent-handoff.md), [handoff template](../../workflow/reviewer/templates/HANDOFF.md), [run template](../../workflow/reviewer/templates/RUN.md): routing, evidence writers, acknowledgements, optional-role decisions and intervention records.
- [Version 3 procedure](../../workflow/reviewer/scripts/V3.md) and [CLI reference](../../workflow/reviewer/scripts/README.md): clarify policy-to-existing-command mapping, delegated evidence recording and automation limits.
- No product source, harness Python, shared contract or skill discovery files changed; no implementation agents dispatched. This documentation task used main only. New policy is not evidence of measured savings or an executed end-to-end implementation run.

## Validation and findings

- Inspected current role definitions, version 3 procedure and harness stage/ownership/independence checks. Existing harness requires `integrate`, recognizes test authors as implementation, and uses locked state updates; new instructions preserve those controls.
- Initial local-link check identified only this log before it was created; corrected by creating this canonical log. Final check passed: 114 local file links across 16 Reviewer/log Markdown documents. `git diff --check` passed. A later resource-link check follows closure.
- Self-review distinguished product-read-only from evidence-read-only access and retained independent review after all writers settle. No independent agent review or human approval claimed.
- Resource start command initially placed `--agent` before the subcommand and was rejected without creating a record. Corrected immediately before any repository edit. Baseline collection preceded both attempts. Preparation reads before recording are not retrospectively timed.
- No product tests or Python harness suite rerun: executable logic is unchanged. Document checks do not prove direct messaging, wakeups or lifecycle recording will be performed in a future run; those remain explicitly invoked operations.

## Resource record and consolidation

- Main authoring/validation interval: [300f5e19217747409655ff8640efcc3d](resources/2026-11-04-reviewer-monitor/300f5e19217747409655ff8640efcc3d.json), started before first edit; succeeded, 293.886 seconds, 10:09:11.234–10:14:05.119 UTC. Preparation before start is excluded.
- Separate main consolidation/closure interval: [823a86e2031e48c9934e450bca8bcffc](resources/2026-11-04-reviewer-monitor/823a86e2031e48c9934e450bca8bcffc.json), started 10:14:07.768 UTC. Uses the user-supplied consolidation skill and its report outline, current diff and actual validation evidence, not historical run claims. Final timing is supplied by the shared resource report below.
- MP4 sessions baseline: `C:/Users/User/Documents/NUS/CS3227/MP4 sessions/local-resource-tracking/reviewer-monitor-20261104-start.json`, actual thread from `CODEX_THREAD_ID`. Historical descendants in the collector output are not participants in this change and are excluded from current-stage attribution.
- Exact model/effort and tool/retry counters are unavailable unless exposed by the collector; local token samples can lag. Cached input is within input; reasoning is within output. No historical totals allocated to current work.
- Final report/response rendering is outside the finished measurement boundaries. No earlier evidence or failure history removed.

### Consolidated outcome and resource coverage

- Baseline: `1e3be1a82ec506d1c9fa309c55ca2d3ec327f6ce`; initial worktree clean. Final state is the uncommitted workflow-document patch and new optional-test role, with this log and two resource records; not a product implementation run. No branch or commit created.
- Participant: main only, selected/observed model and effort unavailable. Stages: document/validate, then separately consolidate/close/stage. No running-agent concurrency claimed. Historical merge agents discovered in telemetry are excluded.
- Authoring sample window: baseline cutoff 10:08:50.724 UTC to endpoint cutoff 10:13:48.548 UTC, 4 November. Main delta: input 571,261, including cached input 551,936; output 10,982; total input+output 582,243. These are local runtime sample-window counters, not exact recorder-boundary usage or billing. MP4 sessions artifact: `reviewer-monitor-20261104-document-end.json` beside the baseline outside Git. Recorder counters remain unavailable because event cutoffs differ from interval timestamps.
- Consolidation uses its own fresh cumulative `reviewer-monitor-20261104-consolidate-start.json` and endpoint delta in the same MP4 sessions directory. Final sample values and timing are appended after closure; neither stage reuses a delta as a cumulative baseline or attributes old descendants' counters.
- All requested policy changes are represented in the procedure, role guidance and templates. Independent implementation review remains after settled writers, security review remains before implementation and on material security changes, and human approval remains separate.
- Remaining limit: documentation checks cannot establish future message delivery, correct sampling, scenario completeness, measured context savings or runtime enforcement of routing. No new automated harness control is claimed. Human summary verification and a future exercised workflow remain pending.

### Final validation and measured closure

- Final local-link check: 115 links across 16 Markdown documents, zero missing. Staged `git diff --cached --check` passed; workflow Python and product files unchanged. All requested edits and recording artifacts are staged, with no commit or branch creation.
- Final Reviewer Markdown source identity: SHA-256 `4a758ad68e0f92c7417a9196b9cb341ce66ca63e63735e89853fade1064cbc50`. Method: sorted repository-relative POSIX path plus each file's raw-byte SHA-256, LF-delimited UTF-8 manifest, then SHA-256 of that manifest, for every Markdown file beneath `workflow/reviewer/`. Log/resource updates are excluded from that workflow manifest.
- Shared `resource-session.py report --markdown`: both declared intervals succeeded; none unfinished. Main document 293.885553 s, consolidation 90.729164 s. Summed and merged recorded interval coverage: 384.614717 s; calendar span first start to last end: 387.264050 s. The gap and pre-recording preparation are not measured work; no active-computation or causal time-saved claim.
- Consolidation token sample window: 10:13:48.548–10:15:23.477 UTC, main input 324,589 including cached input 317,568; output 2,991; total 327,580. Delta source: `C:/Users/User/Documents/NUS/CS3227/MP4 sessions/local-resource-tracking/reviewer-monitor-20261104-consolidate-end.json`. This sample overlaps neither the prior counter delta nor old descendant usage, but runtime event cutoffs differ from recorder timestamps. Exact per-record token values therefore remain unavailable in recorder JSON; the measured sample-window figures are preserved here with their limits.
- Final measurement rendering, this measurement append, restaging finalized evidence and the final response occur after closure and are excluded from those intervals. Human verification remains pending.
