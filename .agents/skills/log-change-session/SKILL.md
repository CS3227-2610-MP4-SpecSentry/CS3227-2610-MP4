---
name: log-change-session
description: Record prompts explicitly requesting repository code or specification changes, subsequent steering, actual changes, validation, and available resources in a prompter-named session log. Use across all product roles, including changes to agent instructions and skills.
---

# Log change session

Repository-wide. Use the shared [prompt log template](../../../workflow/templates/PROMPT-LOG.md) and [measurement rules](../../../workflow/RESOURCES.md). Logging preserves evidence; it does not prescribe agent orchestration.

1. Establish the human prompter's name from trusted session context. Ask when unknown; never substitute an agent, feature owner, git author, or guessed identity. Select `logs/<name>/<date>-<short-task>.md`, or update the related existing conversation log.
2. Record general context, each explicit change request, relevant steering/decisions, and actual outcomes. Summarize rather than dump the transcript. Distinguish proposed work, completed changes, no-change prompts, corrections, and unresolved items. Preserve historical decisions and append superseding corrections.
3. Inspect the actual change set and command/review evidence. List affected files, behavior/spec changes, verification commands/results, and limitations. Identify the relevant implementation state when available. Never claim an action or check happened without evidence.
4. Include available model/effort, timestamps/timezone, tokens, cache, tool/retry measurements, and telemetry source. Mark missing values unavailable with reasons. For retrospective logs, identify which facts/timings cannot be reconstructed.
5. Keep one writer per log. A read-only agent returns a summary to the authorized coordinator for persistence. Handoffs may be linked but do not replace the prompt log. Remove credentials, sensitive raw prompts, hidden reasoning, and unnecessary personal data.

Verify that all change-request prompts in the recorded interval have outcomes, links resolve, and evidence matches the final state. Return the log path and remaining gaps. Future updates should add meaningful context/outcomes rather than recursively logging the act of updating the same log.
