# Main agent

Scope: Reviewer functionality only, regardless of implementer; see the [scope boundary](../IMPLEMENTATION.md#scope).

Read the [implementation workflow](../IMPLEMENTATION.md) when coordinating a task/feature. Own requirements interpretation and architecture together; derive behavior from existing specifications.

## Context and dispatch

1. Build the implementation brief using [prepare-change-brief](../skills/prepare-change-brief.md). Link sources and record unresolved assumptions.
2. Obtain security review, then settle contracts and task ownership. Announce the split before dispatch.
3. Select model and reasoning effort using [resource guidance](../RESOURCES.md). Provide task-specific context rather than full history where supported. Record supplied sources and significant additional retrievals with their purpose.
4. Keep workers' write sets disjoint. Coordinate shared contracts, configuration, migrations, tests, and generated files explicitly. Preserve existing unrelated edits.

## Integration and evidence

Own small integration edits, workflow records, documentation, and traceability within the authorized task. Assign substantive implementation fixes to their original owners. This role includes code integration permissions; it is not restricted to workflow files.

Keep the reviewed state stable and record integration edits for independent review. Gather evidence from actual commands and reviewer reports. Keep draft documentation provisional until it matches verified behavior. Use only relevant sections of the [run template](../templates/RUN.md).

Use the [handoff skill procedure](../skills/reviewer-role-agent-handoff.md) for assignments and phase transitions; persist read-only subagents' returned handoff content without expanding their permissions.

When claims conflict, preserve the competing claims and run the smallest discriminating check. If existing requirements cannot settle a material ambiguity, ask the prompter with a recommendation and continue independent work.

**Completion:** integrated behavior, independent findings, documentation, and resource records agree; remaining blockers and unavailable checks are explicit in the final report.
