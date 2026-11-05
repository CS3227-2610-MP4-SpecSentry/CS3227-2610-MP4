# Reflections

Status: evidence collection initialized, 25 October 2026. This is a working
reflection document, not a claim that planned experiments have been performed.

## Current observations

The architecture task first produced a read-only proposal. Initialization was
interrupted before writes, then resumed on `repo-architecture-init` with the
assignment description. Re-reading branch state exposed an existing `.gitignore`
edit to preserve. This illustrates why a continuation needs current workspace
state as well as conversational context. The session log records the actual
changes and checks; no token-saving measurement follows from this observation.

This initialization uses one main agent because the changes form a small scaffold.
It does not establish the benefits of multi-agent coordination. The repository's
[Reviewer workflow](../workflow/reviewer/README.md) defines specialized assignments;
executed run evidence must be assessed separately.

### Reviewer completion observations, 4 November 2026

The [Reviewer completion run](../logs/ngkhengyang/2026-11-04-reviewer-completion-execution.md)
uses one dashboard vertical-slice worker and one evaluation worker, with shared
retention assigned only after independent security review settled the deletion
contract. Implementers own their tests; the dashboard worker executes integration,
and an independent non-author performs verification. These choices are an executed
coordination example, not a controlled comparison with a single-agent run.

Environment and harness costs were concrete: sandbox visibility obscured native
browser availability, the generated Prisma client was stale, and the coordinator's
Windows command quoting prevented an initial fixture test from launching. Immutable
prerequisites could not be replaced, so the failed run and measured interrupted
attempts were preserved while a corrected canonical validation run continued.
Writers froze source during recovery and verification resources were serialized.
The run log separates these costs from product defects and records actual checks.

The requested pause closed all preparation intervals; resumption used fresh
per-thread stage baselines, excluding idle time. Cumulative parent/descendant
counters were not added to both parent and child records. Waiting counts as elapsed
time, not measured model computation. Token/cache samples can lag, and cached input
is a subset of input. No causal time saving, model advantage, monetary saving,
human usefulness rating or teammate signoff follows from this single run.

## Multi-Agent Software Engineering

The [assignment discussion guide](../workflow/specs/ASSIGNMENT-SPEC.md#reflection-discussion-guide)
preserves the PDF's sample questions. These guide evidence-based discussion;
the controlled experiment protocol below is the team's chosen method, not a
claim that the PDF mandates an experiment for every question. Distinguish
application-AI findings from development-agent findings in each result.

For each real coordinated run, record triggering, responsibility, context supplied,
file ownership, handoff, independent verification, conflicts, retries and blocked
time. Compare against a single-agent task of similar scope using the protocol in
[Development](../workflow/DEVELOPMENT.md#required-experiments-for-reflections).

Include resource sharing, idle/overloaded agents, repeated analysis and unnecessary
calls. Explain whether actual verification showed the coordination pattern was
followed. Development-process security needs its own implemented/tested evidence;
use the planned AC-DEVSEC cases without presenting them as completed experiments.

Results pending: no controlled comparison is reported by this initialization.
Analyze whether reduced defects or parallel progress justified coordination cost,
and identify situations where a single agent was sufficient.

## Context Engineering

Compare focused requirement/interface packs with broader context on comparable
tasks. Record retrievals, missed instructions, rework and output quality. Evaluate
prompt/skill versions using the same acceptance cases. Persist decisions, verified
state, file ownership, unresolved issues and next actions in handoffs; do not
persist hidden reasoning or raw sensitive prompts.

Results pending. Distinguish an observation about easier navigation from a measured
improvement in correctness, time or token use.

## Resource-aware Use

Use [resource recording](../workflow/RESOURCES.md) for model/effort, timestamps,
tokens, cache, calls, retries and measurement sources. Compare model configurations,
repeated-prefix cache behavior and expensive task categories with quality held
constant. Record provider usage separately from development-agent usage.

Results pending. Missing token/cache/reasoning telemetry is unavailable, not zero.
Report a reasoning-token fraction only if a provider exposes compatible counts;
safe summaries are continuation context, not persisted internal reasoning.

## Experiment results and conclusions

Create one [experiment record](../workflow/templates/EXPERIMENT.md) per comparison
under `workflow/evaluations/`, linking input definitions, measured results and
limitations. Include each member's actual role and shared-work contribution.

| Experiment | Evidence | Analysis / limitation |
| --- | --- | --- |
| Single agent versus coordinated agents | Pending | No comparative result yet |
| Focused versus broad context | Pending | No comparative result yet |
| Prompt/skill versions and AI security | Pending | No comparative result yet |
| Model choice and resource cost | Pending | No comparative result yet |
| Repeated context and cache usage | Pending | No comparative result yet |
