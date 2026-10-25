---
name: log-change-session
description: Record prompts explicitly requesting repository code or specification changes, subsequent steering, actual changes, validation, and available resources in a prompter-named session log. Use across all product roles, including changes to agent instructions and skills.
---

# Log change session

Repository-wide. Use the shared [prompt log template](../../../workflow/templates/PROMPT-LOG.md) and [measurement rules](../../../workflow/RESOURCES.md). Logging preserves evidence; it does not prescribe agent orchestration.

Apply this skill when a change request begins, not only at closure. After resolving the prompter, start an interval using the [shared resource CLI](../../../workflow/tooling/RESOURCE-SESSION.md) before the first edit. Capture start/end at every actual agent-stage/attempt boundary; do not reconstruct durations from a final clock checkpoint. Reviewer-scoped recorder references may be reused without double-counting. If execution is blocked, capture real timestamps manually immediately and log the limitation.

1. Use an explicitly supplied prompter name first. Otherwise infer it from the current repository's Git identity (`git config user.name` and, if needed, the email username) or the relevant role owner in the product specification. Prefer Git identity when it identifies a team member; use the role owner as the fallback. Record the inference source, and ask only when neither source yields a usable identity. Select `logs/<name>/<date>-<short-task>.md`, or update the related existing conversation log. A later explicit correction supersedes the inference.
2. Record general context, each explicit change request, relevant steering/decisions, and actual outcomes. Summarize rather than dump the transcript. Distinguish proposed work, completed changes, no-change prompts, corrections, and unresolved items. Preserve historical decisions and append superseding corrections.
3. Inspect the actual change set and command/review evidence. List affected files, behavior/spec changes, verification commands/results, and limitations. Identify the relevant implementation state when available. Never claim an action or check happened without evidence.
4. Finish each started resource interval after validation, run its report, and include the resource table or artifact references in the log before responding. Include model/effort, measured timestamps/durations, attributable token/cache/tool/retry counters and sources. Token telemetry may be unavailable while time remains measured. Never use account percentages or estimated token counts as task usage. For retrospective logs, identify which facts/timings cannot be reconstructed.
5. Keep one writer per log. A read-only agent returns a summary to the authorized coordinator for persistence. Handoffs may be linked but do not replace the prompt log. Remove credentials, sensitive raw prompts, hidden reasoning, and unnecessary personal data.

Verify that all change-request prompts in the recorded interval have outcomes, links resolve, and evidence matches the final state. Return the log path and remaining gaps. Future updates should add meaningful context/outcomes rather than recursively logging the act of updating the same log.
