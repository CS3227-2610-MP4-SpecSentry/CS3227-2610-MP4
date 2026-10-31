# SpecSentry agent context

SpecSentry is a secure specification and review workspace for Contributors, Reviewers, and Release Maintainers. Build a new codebase; prior MPs supply neither source nor documentation.

## Product context

Use [PRODUCT-SPEC](workflow/specs/PRODUCT-SPEC.md) for requirements, scope, architecture direction, ownership, and open decisions. Read the relevant sections for the task. Resolve conflicts using applicable higher-priority instructions and surface unresolved product conflicts.

Read the relevant [MP4 assignment constraints](workflow/specs/ASSIGNMENT-SPEC.md) before planning or changing deliverables. They distinguish course requirements from team design choices and evidence. Use SoC LLM for product AI; do not reuse prior MPs or use an integrated build-and-host environment. Deployment is separately team-managed. Record AI use and reused sources in acknowledgements; do not claim compliance from instructions alone.

## Shared invariants

- Product AI is advisory: typed, bounded suggestions through a server-side SoC LLM gateway. Business mutations require deterministic server-side authorization and validation.
- Preserve ownership/assignment boundaries, immutable submitted revisions, audit evidence, and manual operation when AI fails.
- Keep credentials and raw sensitive prompts out of handoffs and logs. Record verified outcomes and available measurements; label missing telemetry unavailable.
- Work within assigned file ownership. Preserve other contributors' changes and request coordination before changing shared contracts.

## Shared recording requirements

- Before the first repository edit, start a resource interval using [resource recording](workflow/RESOURCES.md); finish it after validation and link its report in the change log. Record every main-agent stage and subagent attempt, including failed/interrupted work. Never defer start-time capture until writing the final log. Mark unavailable telemetry explicitly.
- Log every prompt explicitly requesting a code or specification change, including subsequent steering, in `logs/<name>/<log_name.md>`. Record general context, requested changes, changes made, affected files, and validation. Related prompts may share one conversation log; distinguish requests from outcomes. Use the [prompt log template](workflow/templates/PROMPT-LOG.md).
- Assignment coverage also requires safe summaries of all development prompts/interactions, including read-only advice, reviews, coordination, and failed/interrupted attempts. Append related interactions without erasing earlier decisions. Humans must verify AI-produced summaries; never claim that verification without evidence. Resource intervals remain required for edits and actual agent stages/attempts; do not fabricate retrospective timing.
- Resolve the prompter's name using the [logging skill](.agents/skills/log-change-session/SKILL.md): explicit session identity takes precedence; otherwise infer from Git identity or the relevant role owner and record the source.

## Task-specific context

Repository-wide skills are available for [specification conformance review](.agents/skills/review-changes-to-specs/SKILL.md), [security review](.agents/skills/review-security/SKILL.md), and [change-session logging](.agents/skills/log-change-session/SKILL.md). Invoke [resource-use analysis](.agents/skills/analyze-resource-use/SKILL.md) explicitly when comparing recorded runs. These capabilities do not prescribe an agent orchestration process.

When working on Contributor functionality, read the [Contributor workflow entry point](workflow/contributor/README.md). When working on Reviewer functionality, read the [Reviewer workflow entry point](workflow/reviewer/README.md). Apply each procedure only to its role portion; standalone shared infrastructure retains the generic [development process](workflow/DEVELOPMENT.md). Coordinate shared contracts before editing them.

Discover current source, commands, and CI from the repository before checks. Product-spec paths may describe planned artifacts; distinguish those from working controls. Link authoritative artifacts instead of copying broad histories.

## Code Review Rules

- Flag protected data reads or business mutations that bypass deterministic server-side role, ownership/assignment, lifecycle, or session/CSRF checks. Check the applicable [product requirements](workflow/specs/PRODUCT-SPEC.md); the existing public health/readiness routes are intentional exceptions.
- Flag changes that overwrite submitted revisions, accept stale revision decisions, or separate a business mutation from its required audit/notification transaction. Preserve immutable submission evidence and the current revision/assignment boundaries defined in the specifications.
- Flag client-side credentials, sensitive prompt/body logging, or AI output that directly authorizes or performs a business mutation. Product AI must use the bounded server-side SoC gateway, validate typed output, and leave the manual workflow usable on failure. Developer PR review through Codex is separate from product AI.
