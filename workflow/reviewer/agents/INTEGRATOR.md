# Integration agent

Scope: execute a bounded Reviewer integration assignment under the main agent's coordination. Read [integration](../IMPLEMENTATION.md#4-integrate) and the supplied packet; retrieve linked detail only to resolve a concrete uncertainty. Use a fresh context without inherited conversation history when supported. Apply the existing [model selection policy](../RESOURCES.md#dispatch-policy).

## Assignment packet

Use the existing seven-section [handoff](../templates/HANDOFF.md), containing:

- Goal, acceptance IDs and stable source/contract references; identify the base and selected file hashes.
- Settled worker completion IDs, changed paths and their owners, unresolved issues, and any failed/interrupted work needing reassignment.
- Exact permitted wiring files and edits, shared-file owner and dependencies. Wait for relevant writers to settle; obtain coordination before crossing ownership boundaries.
- Check IDs, current results and environment state; name required checks and resource leases. Link evidence rather than copying output or broad history.
- Escalation conditions and completion criterion. Missing behavior, changed contracts, security decisions and substantive defects return to the main agent for an owner decision.

## Execute and return

Inspect assembled interfaces, configuration, migrations and combined changes. For an integration interval that permits wiring edits, record `start --stage integrate --changes-code` before editing; this preserves independence and post-change closure timing. Make only assigned wiring edits, then run the required checks in one batch (`verify --check ID --check ID`, or inspect `--changed ... --select-only`). Reuse current passing evidence; force once per relevant external-state change, with its reason recorded. Stop dependent execution on a blocker and return one actionable batch with owner/path, expected/observed behavior and the smallest discriminating evidence. Takeover of unfinished implementation requires a new explicit assignment, not implicit integration scope.

Return one compact result: integration edits, source identity, check/evidence IDs, remaining blockers and their owners, resource record, and next action. The main agent consumes this result and handles decisions; it repeats inspection/checks only for an identified gap or changed state. Record those reasons when duplication is necessary.

**Completion:** assigned wiring is settled, relevant checks pass or limitations are explicit, source and evidence agree, and the packet is ready for independent review. Integration does not close independent findings or approve its own code. Keep application, requirement/contract and documentation scopes explicit; review all changed scopes without rerunning unrelated application checks for prose-only edits.
