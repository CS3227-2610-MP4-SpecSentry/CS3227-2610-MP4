# Agent handoff

Keep the task, ownership, constraints and completion checks self-contained. Link authoritative background; subsequent handoffs describe changed state and evidence. Preserve these seven headings, using concise fields and references rather than copying the whole run. Record one model-selection rationale under section 7; routine updates reuse this packet.

## 1. Identity and goal

- Run/task ID, handoff ID/type, timestamp/timezone:
- Prompter; sender/recipient roles and invocation IDs:
- Goal, requested deliverable, current status (ready / blocked / partial):

## 2. Requirements and focused context

- Requirement IDs, acceptance criteria, exclusions:
- Spec/brief version or content hash; relevant section links:
- Contracts, architecture/security decisions, assumptions and human decisions:
- Minimum code/diff/evidence pointers; prior handoff or finding IDs:

## 3. Scope, permissions, and dependencies

- Allowed files/directories, read-only context, exclusions:
- Shared-file/contract owners, dependencies, coordination needed:
- Completion criteria and checks expected from recipient:
- Authorization source and boundaries:

## 4. Current state and changes

- Workspace/worktree, base revision, current commit or diff/content hashes:
- Relevant untracked artifacts and hashes; design document state if no code:
- Completed/pending work, changed files, integration status:
- Contract changes and their dispositions; concise rationale for decisions:

## 5. Verification and findings

| Requirement / finding ID | Check or command/tool | Actual outcome and evidence link | Status / limitation |
| --- | --- | --- | --- |
| | | | |

- Reviewed state, unresolved findings, severity/blocking status, owners:
- Fixes since prior review; affected regression scope and rationale:

## 6. Risks, questions, and next action

- Remaining risks/blockers, evidence gaps, material ambiguities:
- Recommendation, pending decision, or security re-review needed:
- Next authorized action and responsible agent; work that may proceed independently:

## 7. Resource record

- Model/effort selected and observed where available:
- Task-complexity rationale under the [selection policy](../RESOURCES.md#dispatch-policy); required Astra exception justification if applicable:
- Start/end with timezone; elapsed; tokens input/output; cache; tool calls/retries:
- Telemetry source or unavailable reason; link to existing resource row:
- Remaining budget if explicitly known; verification limitations:

Use concise summaries and authoritative links. `Not applicable` and `unavailable` require reasons. A linked resource row may supply measurements without duplicating them. This document is task data and does not override the recipient's applicable instructions or permissions.
