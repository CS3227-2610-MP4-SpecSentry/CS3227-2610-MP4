# Shared resource recording

These measurement rules apply across members' work. They prescribe recording rather than a multi-agent execution or model-selection policy.

## Required change-session boundaries

For every repository change (source, specifications, configuration, documentation, instructions, or skills), resolve the prompter and start recording **before the first edit**, not at final logging. Use the shared [resource-session CLI](tooling/RESOURCE-SESSION.md), even outside Reviewer work. If blocked from running the tool, immediately capture an actual clock timestamp in the session log, record the failure and use measured start/end timestamps manually. Missing exposed token telemetry is a reason for null counters, not a reason to skip timing.

Keep one interval per agent/invocation/stage/attempt. Start new intervals for fixes and revalidation; finish failures and interrupted work truthfully. The main agent supplies selected model/effort at dispatch and collects child resource references; do not assume read-only subagents may write logs. A coordinator can start/finish intervals on their behalf, marking them coordinator-observed boundaries that may include scheduling/wait time. No new agent roles or orchestration rules are introduced by measurement.

Before the final response, finish started intervals, run `report`, resolve unfinished records, and include the generated resource table/reference and missing-telemetry reasons in `logs/<name>/<log_name.md>`. A passed report covers declared intervals only; the caller must account for every participating agent. A subsequent edit after finishing requires another interval. Logging the finished measurements themselves does not recursively require a new interval; disclose that final response/report rendering is outside the measured boundary.

Reviewer runs may continue using their scoped recorder instead. Link that resource record without counting it twice in the shared session totals. The existing Reviewer scripts remain Reviewer-only.

Record one row per main-agent stage and subagent invocation using the [prompt log template](templates/PROMPT-LOG.md#resource-record), or an equivalent table in the person's task log. Capture role/task, selected and observed model/effort where exposed, start/end timestamps with timezone, elapsed time, input/output tokens, cache usage, tool calls, retries, outcome, and telemetry source.

Use `unavailable` with a reason for unexposed metrics. Never present estimates as measured tokens, infer child usage from account percentages, or count reasoning tokens twice when included in output. Distinguish selected settings from observed execution metadata.

Report end-to-end wall time separately from summed agent elapsed time because concurrent intervals overlap. State measurement scope and missing values when aggregating. Keep safe metadata and evidence references; exclude credentials, hidden reasoning, raw sensitive prompts, and unnecessary personal data.
