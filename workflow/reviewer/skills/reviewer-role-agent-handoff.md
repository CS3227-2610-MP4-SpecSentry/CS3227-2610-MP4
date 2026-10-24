# Create a Reviewer workflow handoff

Use for assignment, completion, security-review, implementation-review, or fix-revalidation handoffs within the [Reviewer workflow scope](../IMPLEMENTATION.md#scope). The document enables the next agent to resume using focused context without reading the full conversation. It records existing authorization and never expands it.

## Prepare and write

1. Identify sender/recipient, handoff type, run/task IDs, prompter, goal, source requirements, and actual artifact state. For code/review handoffs, identify the base and current commit, or base plus diff/content hashes including relevant untracked files. For design-only handoffs, identify the brief/spec document version or content hash.
2. Select the minimum requirement sections, contracts, decisions, code/diff, prior finding IDs, and evidence needed next. Link them with source/version information; distinguish verified facts, proposals, and assumptions.
3. Summarize current work, results, blocking questions, and the exact next action. Assignment handoffs define write ownership and completion criteria. Completion handoffs enumerate actual changed files and checks. Review/fix handoffs preserve stable finding IDs, dispositions, and regression scope.
4. Populate the [handoff template](../templates/HANDOFF.md). Use `not applicable` with a reason for mode-specific fields and `unavailable` with a reason for missing measurements. Preserve required headings so omitted evidence stays visible.
5. Check links, permissions, state identifiers, and outcome claims. Remove secrets, raw sensitive prompts, hidden reasoning, and unrelated history. Mark stale or incomplete evidence and limitations. Flag urgent blockers immediately; batch routine findings.

## Storage and ownership

Default: `logs/<prompter-name>/reviewer/<run-id>/handoffs/<sequence>-<from>-to-<to>.md`. Use the [handoff generator/validator](../scripts/README.md#4-generate-and-validate-handoffs) with structured seven-section input when a run exists. Each file has one assigned writer and a unique sequence; it supplements the shared prompt/change log and never replaces it. Respect the recipient's context budget. Keep tables and summaries concise; link larger outputs instead of embedding transcripts.

The sender writes the document when authorized for that path. A read-only subagent returns its filled content to the coordinator, which persists it and records its source. A handoff skill cannot grant a read-only reviewer write permission. Keep previous handoffs as evidence; record corrections or superseding handoffs explicitly rather than silently rewriting a recipient's input.

**Completion:** the recipient can identify the goal, authoritative requirements, current state, allowed actions, checks/evidence, unresolved risks, resources, and next authorized step from the document and its focused links. Missing critical information is an explicit blocker, not inferred permission. Report the handoff path and readiness/blocking status.
