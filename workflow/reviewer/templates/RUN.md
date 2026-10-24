# Reviewer functionality implementation run template

Copy relevant sections to `logs/<name>/<log_name.md>` (use the prompting person's name); keep the record concise and coordinator-owned. Replace placeholders, omit irrelevant optional fields with a reason, and link large evidence separately. Workers receive only their assignment and necessary references. Avoid duplicating the complete run record into every handoff.

## Prompt context and changes

- Prompter name, date/timezone, conversation or prompt summary:
- Explicit change requests and relevant steering decisions:
- Changes made, affected files, validation, and remaining limitations:
- Include every change-request prompt; summarize related prompts in one conversation log when useful.

## Run and implementation brief

- Run ID, goal, main agent, start time/timezone, status:
- Source requirement IDs and spec commit/document state:
- Acceptance criteria, edge/failure cases, exclusions:
- Current architecture and components to change:
- Contracts: interfaces/schemas, errors, ownership, authorization, transaction/version rules:
- Data flow, trust boundaries, security invariants:
- Material ambiguities, recommendation, prompter decision/source:
- Context supplied and significant additional retrievals with purpose:
- Expected checks and environment prerequisites:

## Security disposition

- Reviewer/invocation and reviewed design state:
- Finding IDs, required controls, validation, owners:
- Main-agent changes and reviewer follow-up:
- Gate outcome and remaining blockers:

## Assignment

- Worker/invocation, goal, requirement IDs, source pointers:
- Model/effort and selection rationale:
- Context pack, contracts, dependencies:
- Allowed files/directories, exclusions, shared-file owner:
- Expected behavior, tests, completion evidence:
- Main-agent announcement reference:

## Completion and handoff

- Handoff ID/path, sender/recipient, readiness/blocking status:
- Use the [handoff procedure](../skills/reviewer-role-agent-handoff.md) and [canonical format](HANDOFF.md) for the full document. Link it here rather than duplicating its contents.

## Integration

- Base and integrated state (commit or diff/content hashes, including relevant untracked files):
- Combined changes and main-agent integration edits:
- Interface/configuration/migration checks:
- Build/integration commands, outcomes, evidence:
- Limitations and gate outcome:

## Findings

| ID | Severity / blocks completion? | Requirement / contract | Observed vs expected; reproduction/evidence | Control or fix and validation expected | Owner | Status / closure evidence |
| --- | --- | --- | --- | --- | --- | --- |
| F-001 | | | | | | |

Use CRITICAL/HIGH/MEDIUM/LOW with a concrete impact explanation. State blocking status explicitly; unresolved acceptance-criterion failures block completion regardless of severity. Statuses: open, fixing, awaiting revalidation, closed, or deferred with rationale and applicable authorization. Deferring a blocker does not make the task complete.

- Reviewer/invocation and reviewed state:
- Acceptance-criterion coverage, including missing evidence:
- Exact checks/results and environment limitations:
- Initial batch / revalidation cycle number:
- Fix diff and regression scope/rationale:
- New findings, security re-review triggers, gate outcome:

## Resource record

| Stage / agent / invocation | Selected model / effort; observed if exposed | Start / end with timezone | Elapsed | Input / output tokens | Cache usage | Tool calls / retries | Outcome / telemetry source or unavailable reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

- End-to-end wall time:
- Summed agent elapsed time (overlaps included):
- Measurement coverage, unavailable values, aggregation limits:

## Final evidence and continuation

- Final reviewed state and requirements delivered:
- Findings closed / remaining blockers:
- Documentation and traceability updated or not applicable:
- Verified checks and outstanding limitations:
- Decisions/findings/open questions retained for continuation:
- Next actions and concise change log:
- Workflow observations: defects, rework, repeated retrieval, coordination cost:
