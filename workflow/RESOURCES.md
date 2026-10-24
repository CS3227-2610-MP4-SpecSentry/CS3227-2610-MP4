# Shared resource recording

These measurement rules apply across members' work. They prescribe recording rather than a multi-agent execution or model-selection policy.

Record one row per main-agent stage and subagent invocation using the [prompt log template](templates/PROMPT-LOG.md#resource-record), or an equivalent table in the person's task log. Capture role/task, selected and observed model/effort where exposed, start/end timestamps with timezone, elapsed time, input/output tokens, cache usage, tool calls, retries, outcome, and telemetry source.

Use `unavailable` with a reason for unexposed metrics. Never present estimates as measured tokens, infer child usage from account percentages, or count reasoning tokens twice when included in output. Distinguish selected settings from observed execution metadata.

Report end-to-end wall time separately from summed agent elapsed time because concurrent intervals overlap. State measurement scope and missing values when aggregating. Keep safe metadata and evidence references; exclude credentials, hidden reasoning, raw sensitive prompts, and unnecessary personal data.
