# Create a Reviewer workflow handoff

Use for assignment, completion, security-review, implementation-review, or fix-revalidation handoffs within the [Reviewer workflow scope](../IMPLEMENTATION.md#scope). The document enables the next agent to resume using focused context without reading the full conversation. It records existing authorization and never expands it.

## Prepare and write

1. Identify sender/recipient, handoff type, run/task IDs, prompter, goal, source requirements, and actual artifact state. For code/review handoffs, identify the base and current commit, or base plus diff/content hashes including relevant untracked files. For design-only handoffs, identify the brief/spec document version or content hash.
2. Keep a self-contained core: task/acceptance criteria, ownership, relevant constraints and completion checks. Link versioned authoritative requirements/contracts instead of restating the full brief, policy or conversation. Each additional code/specification section should answer an assignment-relevant question.
3. Summarize current work, results, blocking questions, and the exact next action. Assignment handoffs define write ownership and completion criteria. Completion handoffs enumerate actual changed files and checks. Subsequent review/fix handoffs emphasize the delta: changed contracts/files, stable finding IDs, new evidence and affected regressions. Link the initial acceptance matrix and unchanged decisions rather than duplicating them; independently assess evidence needed for the new decision.
4. Populate the [handoff template](../templates/HANDOFF.md), aiming for a short summary with links rather than a transcript. Material security/contract detail takes precedence over brevity. Use `not applicable` with a reason for mode-specific fields and `unavailable` with a reason for missing measurements. Preserve required headings; a resource-record link supplies repeated measurements.
5. Check links, permissions, state identifiers, and outcome claims. Remove secrets, raw sensitive prompts, hidden reasoning, and unrelated history. Mark stale or incomplete evidence and limitations. Flag urgent blockers immediately; batch routine findings.

## Storage and ownership

Default: `logs/<prompter-name>/reviewer/<run-id>/handoffs/<sequence>-<from>-to-<to>.md`. Use the [handoff generator/validator](../scripts/README.md#4-generate-and-validate-handoffs) with structured seven-section input when a run exists. Each file has one assigned writer and a unique sequence; it supplements the shared prompt/change log and never replaces it. Respect the recipient's context budget. Keep tables and summaries concise; link larger outputs instead of embedding transcripts.

The sender writes the document when authorized for that path. A read-only subagent returns its filled content to the coordinator, which persists it and records its source. A handoff skill cannot grant a read-only reviewer write permission. Reuse the current handoff for unchanged context and record routine progress in the current run summary. Create a new handoff for an actual assignment/completion/review/fix transition or material correction. Keep previous handoffs and explicit supersession while the run is active; closure/retention follows the [evidence policy](../scripts/README.md#7-evidence-efficiency-and-retention).

**Completion:** the recipient can identify the goal, authoritative requirements, current state, allowed actions, checks/evidence, unresolved risks, resources, and next authorized step from the document and its focused links. Missing critical information is an explicit blocker, not inferred permission. Report the handoff path and readiness/blocking status.
