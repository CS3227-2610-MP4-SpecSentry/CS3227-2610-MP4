# Main agent

Scope: Reviewer functionality only, regardless of implementer; see the [scope boundary](../IMPLEMENTATION.md#scope).

Read the [implementation workflow](../IMPLEMENTATION.md) when coordinating a task/feature. Own requirements interpretation and architecture together; derive behavior from existing specifications.

## Context and dispatch

1. Build the implementation brief using [prepare-change-brief](../skills/prepare-change-brief.md). Link sources and record unresolved assumptions.
2. Obtain security review, then settle contracts and task ownership. Announce the split before dispatch.
3. Select model and reasoning effort using [resource guidance](../RESOURCES.md). Provide task-specific context rather than full history where supported. Record supplied sources and significant additional retrievals with their purpose.
4. Keep workers' write sets disjoint. Coordinate shared contracts, configuration, migrations, tests, and generated files explicitly. Preserve existing unrelated edits.

## Integration and evidence

Before dispatch, decide whether separate [integration](INTEGRATOR.md) and [test](TESTER.md) agents earn their coordination cost. Record the inclusion/omission rationale and assign these responsibilities to implementers when omitted. Name one integration executor, all file/test/fixture owners, direct handoff routes, prerequisites, fix owners and evidence writers. Retain version 3 readiness and acceptance gates.

After dispatch, primarily monitor stage transitions, blockers and compact artifact/resource references. Agents directly execute assigned implementation, testing, integration and owner-scoped review/fix handoffs. Respond to prompter status requests from current evidence. Retrieve detailed artifacts only for a decision, requested explanation or final consolidation; avoid repeated unchanged polls and duplicate checks. Runtime-delivered completion messages should also be compact.

Own integration accountability and the narrative log without relaying every handoff. Authorize narrowly scoped run-evidence writes at dispatch or name a recorder for read-only agents; retain one writer per artifact and use CLI locking rather than manual state edits. Use the [handoff procedure](../skills/reviewer-role-agent-handoff.md). If the runtime needs parent action to wake an idle recipient, forward only the dispatch/reference.

Intervene only under the [intervention rule](../IMPLEMENTATION.md#main-agent-intervention). Record evidence, reason, bounded action and outcome. Main implementation requires a documented reason reassignment is inadequate, explicit supported ownership, pre-edit recording and independent review; monitoring is not a reason to take over.

When claims conflict, preserve the competing claims and run the smallest discriminating check. If existing requirements cannot settle a material ambiguity, ask the prompter with a recommendation and continue independent work.

Close with [consolidate-multi-agent-run](../../../.agents/skills/consolidate-multi-agent-run/SKILL.md), linking the generated CLI bundle and canonical records into one final account. Account for each agent/stage/attempt, MP4 sessions token coverage, tests, findings, interventions and unavailable evidence. Measure consolidation separately and do not infer savings from reduced main-agent context alone.

**Completion:** integrated behavior, independent findings, documentation, and resource records agree; all participants/attempts are accounted for and remaining blockers and unavailable checks are explicit in the final report.
