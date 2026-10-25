# Workflow directory guide

| Path | Purpose |
| --- | --- |
| specs/ | Authoritative product, role, shared, technical, integration, AI security and open-decision requirements; start at PRODUCT-SPEC.md |
| PLAN.md | Team allocation, delivery dependencies and planned work |
| TRACEABILITY.md | Requirement-to-implementation/test evidence; pending is explicit |
| DEVELOPMENT.md | Spec-driven process, agent coordination and verification rules |
| RESOURCES.md | Resource telemetry definitions and unavailable-value rules |
| SUBMISSION.md | Assignment deliverables, verification gaps and final handover checks |
| reviewer/README.md | Entry point for the existing Reviewer-specific multi-agent process |
| reviewer/agents/ | Main, implementer, security reviewer and independent reviewer definitions |
| reviewer/skills/ | Reviewer briefing and handoff procedures |
| reviewer/templates/ | Reviewer run and handoff record formats |
| reviewer/scripts/ | Workflow CLI, evidence validation, checks and recording helpers; see its README |
| reviewer/tests/ | Python tests of the workflow tooling, not product acceptance |
| templates/PROMPT-LOG.md | Prompt/change/resource summary format |
| templates/EXPERIMENT.md | Controlled comparison and result format |
| evaluations/ | Versioned evaluation and experiment evidence; initialized, results pending |
| tooling/smoke.mjs | Existing HTTP liveness/readiness smoke check |
| tooling/submission-check.mjs | Local required-artifact presence check; does not certify grading readiness |
| tests/browser/ | Playwright setup-page and accessibility smoke checks |

Production source stays under `src/`, including the static GitHub Pages product
website at `src/website/`. Root agent instructions and `.agents/skills` stay in
their natural discovery locations; CI and Pages workflows stay in `.github/`.
Prompt summaries stay in `logs/<prompter>/`. Read only the context relevant to the
assigned task and link authoritative artifacts rather than copying histories.
