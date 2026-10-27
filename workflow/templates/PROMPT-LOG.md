# Prompt and change log

Use `logs/<name>/<log_name.md>` for every prompt explicitly requesting code or specification changes. Resolve the name using the [logging skill](../../.agents/skills/log-change-session/SKILL.md) and record whether it was explicit or inferred and from which source. Prefer a date and short task in the filename. Related prompts may share one conversation log, with each change request and outcome accounted for. This recording rule applies to every member and does not prescribe their execution workflow.

The [assignment](../specs/ASSIGNMENT-SPEC.md) additionally requires summaries of all development prompts/interactions: include relevant advice, read-only work, coordination, corrections, and failed/interrupted attempts. Summarize safely; omit credentials, hidden reasoning and raw sensitive content. Humans must verify AI-generated summaries. Do not claim past interaction coverage or timestamps that cannot be reconstructed.

## Context and requests

- Prompter, date/timezone:
- General task/conversation context:
- Explicit change requests and subsequent corrections or decisions:
- Other development prompts/interactions and outcomes (including no-change advice/reviews):
- Human summary verification: pending or actual reviewer/date/reference:

## Changes and evidence

- Changes made and affected files:
- Validation commands/results:
- Unresolved items, unavailable checks, and next actions:

## Resource record

- Structured report / record references (or Reviewer-run references; avoid double-counting):
- Timing coverage: before-first-edit / delayed bootstrap / manual fallback, with explanation:
- Record `start` before editing and `finish` after validation; run `report` before the final response. Missing tokens do not prevent measured time.

| Stage / agent / invocation | Selected model / effort; observed if exposed | Start / end with timezone | Elapsed | Input / output tokens | Cache usage | Tool calls / retries | Outcome / telemetry source or unavailable reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

- End-to-end wall time:
- Summed agent elapsed time (overlaps included):
- Measurement coverage and unavailable reasons:
