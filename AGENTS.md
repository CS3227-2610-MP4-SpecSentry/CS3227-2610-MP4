# SpecSentry agent context

SpecSentry is a secure specification and review workspace for Contributors, Reviewers, and Release Maintainers. Build a new codebase; prior MPs supply neither source nor documentation.

## Product context

Use [PRODUCT-SPEC](workflow/specs/PRODUCT-SPEC.md) for requirements, scope, architecture direction, ownership, and open decisions. Read the relevant sections for the task. Resolve conflicts using applicable higher-priority instructions and surface unresolved product conflicts.

## Shared invariants

- Product AI is advisory: typed, bounded suggestions through a server-side SoC LLM gateway. Business mutations require deterministic server-side authorization and validation.
- Preserve ownership/assignment boundaries, immutable submitted revisions, audit evidence, and manual operation when AI fails.
- Keep credentials and raw sensitive prompts out of handoffs and logs. Record verified outcomes and available measurements; label missing telemetry unavailable.
- Work within assigned file ownership. Preserve other contributors' changes and request coordination before changing shared contracts.

## Shared recording requirements

- Record model use, tokens, and time for main-agent stages and subagent invocations using [resource recording](workflow/RESOURCES.md). Mark unavailable telemetry explicitly.
- Log every prompt explicitly requesting a code or specification change, including subsequent steering, in `logs/<name>/<log_name.md>`. Record general context, requested changes, changes made, affected files, and validation. Related prompts may share one conversation log; distinguish requests from outcomes. Use the [prompt log template](workflow/templates/PROMPT-LOG.md).
- Resolve the prompter's name using the [logging skill](.agents/skills/log-change-session/SKILL.md): explicit session identity takes precedence; otherwise infer from Git identity or the relevant role owner and record the source.

## Task-specific context

Repository-wide skills are available for [specification conformance review](.agents/skills/review-changes-to-specs/SKILL.md), [security review](.agents/skills/review-security/SKILL.md), and [change-session logging](.agents/skills/log-change-session/SKILL.md). Invoke [resource-use analysis](.agents/skills/analyze-resource-use/SKILL.md) explicitly when comparing recorded runs. These capabilities do not prescribe an agent orchestration process.

When working on Reviewer functionality, read the [Reviewer workflow entry point](workflow/reviewer/README.md).

Discover current source, commands, and CI from the repository before checks. Product-spec paths may describe planned artifacts; distinguish those from working controls. Link authoritative artifacts instead of copying broad histories.
