---
name: analyze-resource-use
description: Compare recorded agent model use, tokens, elapsed time, retries, and useful outcomes across repository runs or controlled experiments. Invoke explicitly to evaluate resource efficiency and measurement limitations.
---

# Analyze resource use

Repository-wide, explicitly invoked analysis. Read existing logs and telemetry; analysis alone does not authorize rerunning tasks, spending model quota, changing models/settings, or editing code. Write a report only when requested; otherwise return it in the conversation.

1. Establish the comparison question, runs, measurement interval, workload, and desired outcome. Use the shared [measurement rules](../../../workflow/RESOURCES.md) and actual resource records. Identify missing/incompatible measurements before aggregating.
2. Extract observed/selected model and effort separately, input/output tokens, cache usage, elapsed time, tool calls/retries, defects found, first-pass success, rework, and reviewer corrections where recorded. Preserve raw-source references and definitions. Missing measurements are not zero.
3. Separate end-to-end wall time from summed agent elapsed time and overlapping parallel work. Avoid double-counting aggregate/child token records or reasoning already included in output. Compute costs only from supplied or verified applicable rates and supported usage fields; otherwise compare tokens without fabricating monetary savings.
4. Compare like-for-like workloads and make sample size, environment differences, confounders, and telemetry coverage explicit. Report relationships as observations, not causal conclusions without a controlled design.
5. Return a compact comparison table, supported findings, limitations, and prioritized improvements or a proposed controlled experiment. Include quality/risk outcomes alongside consumption so lower usage is not automatically treated as better.

**Completion:** every numerical conclusion traces to measured inputs or clearly labelled calculations; unsupported metrics remain unavailable. Proposed experiments and configuration changes stay proposals until separately authorized.
