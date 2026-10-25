# Specification review and restructuring

## Context and requests

- Prompter: ngkhengyang, explicitly established in the related requirements conversation. Date: 25 October 2026, Asia/Singapore (UTC+08:00).
- Request: re-review the specification set for SDD quality, revise it as needed, and split concerns into focused files where useful. Preserve established product decisions and omit supplementary source attribution as requested.
- Scope: specification and planning documentation only. The reviewed baseline was HEAD's single PRODUCT-SPEC.md. Initial repository status was clean once Git was invoked with a command-scoped safe.directory setting. No application implementation, dependency installation, deployment, external messaging, or changes to agent instructions were requested or performed.

## Findings and outcomes

| Finding | Outcome |
| --- | --- |
| SPEC-001: Product behavior mixed with architecture, process and execution milestones | Split into focused product/role/shared/technical/integration/AI documents; moved execution milestones to PLAN.md and process/experiments to DEVELOPMENT.md. |
| SPEC-002: Missing explicit role UI descriptions and use cases | Added screen contracts, primary/alternative flows, empty/error/conflict states and role-specific manual/AI interactions. |
| SPEC-003: No requirement-to-verification map | Added 48 requirement-linked acceptance scenarios and TRACEABILITY.md with all actual application evidence explicitly pending. Scenarios are planned obligations, not executed tests or exhaustive coverage. |
| SPEC-004: Broad failure/authorization prose inconsistent with audit and read operations | Clarified REQ-SHR-001 to cover product pages and APIs, REQ-SHR-002 to require applicable access/state checks and mutation version validation, and NFR-REL-001 to distinguish unchanged business/form state from safe audit/resource accounting. Other requirement definitions remain verbatim. |
| SPEC-005: Overview contradicts request-changes coverage and omits awaiting-revision pool metadata | Aligned the overview with existing detailed criteria: individual takeover coverage confirmation is needed for approval, not requesting changes; pool may expose awaiting-revision status. |
| SPEC-006: Referenced integration contracts absent | Extracted logical entities, added operation input/scope/outcome, transactional/event boundaries and proposed HTTP/error contracts; unresolved endpoint/payload/idempotency details explicitly await ratification. |
| SPEC-007: Important implementation choices left implicit | Added OPEN-001 through OPEN-009 with affected behavior, gates and role contacts. AI schemas/limits, identity/session/project scope, release policies, timeline fields, queue semantics and quality measurement details remain unresolved rather than invented. |
| SPEC-008: Process and targets could be mistaken for implementation evidence | Added baseline/evidence status, dependency-based work packages, maintenance gates and pending verification state. Imported milestone dates are preserved as targets; historical completion and teammate approval are not asserted. |

## Changes and evidence

- Revised [PRODUCT-SPEC.md](../../workflow/specs/PRODUCT-SPEC.md) as the product index, scope, cross-role lifecycle/invariants and glossary.
- Added [Contributor](../../workflow/specs/ROLE-CONTRIBUTOR.md), [Reviewer](../../workflow/specs/ROLE-REVIEWER.md), [Maintainer](../../workflow/specs/ROLE-MAINTAINER.md), [shared requirements](../../workflow/specs/SHARED-REQUIREMENTS.md), [technical](../../workflow/specs/TECHNICAL-SPEC.md), [integration](../../workflow/specs/INTEGRATION-SPEC.md), [AI security](../../workflow/specs/AI-SECURITY-SPEC.md), and [open decisions](../../workflow/specs/OPEN-DECISIONS.md).
- Added [PLAN.md](../../workflow/PLAN.md), [TRACEABILITY.md](../../workflow/TRACEABILITY.md), and [DEVELOPMENT.md](../../workflow/DEVELOPMENT.md). Existing TypeScript stack and agreed Reviewer/evidence/history/revocation behavior were preserved. Existing workflow automation and historical logs were not modified.
- Used the specification-conformance and change-session logging procedures. This was a main-agent documentation review; no independent teammate/subagent approval or security certification is claimed.
- Validation: compared all normative requirement definitions with `git show HEAD:workflow/specs/PRODUCT-SPEC.md` using a Python standard-library check. All 48 IDs are conserved and unique. Exactly REQ-SHR-001, REQ-SHR-002 and NFR-REL-001 changed wording as described above; the other 45 definitions match verbatim.
- Standard-library checks verified 48 scenario mappings, one traceability row per requirement, and 141 local document links/anchors. The checker was corrected to recognize alphanumeric quality prefixes, including NFR-A11Y-001, before reporting final results.
- `git -c safe.directory=C:/Users/User/Documents/NUS/CS3227/CS3227-2610-MP4 diff --check` passed. Read back Reviewer scenarios, AI gates and the product/technical entry points. Final checks also include this log's links and new-file whitespace. No product runtime tests were run because this task changes documentation and the application is not yet implemented.
- Tooling limitations: ordinary Git invocation reported repository ownership mismatch; command-scoped safe.directory permitted read-only inspection without global configuration changes. The unqualified Python command was absent, the user-installed interpreter could not execute under the current account, and the bundled interpreter worked. An initial extraction regex failed before any file writes; it was corrected and rerun. No partial specification changes from those failed attempts remained.
- Remaining work: resolve relevant OPEN decisions before affected implementation, obtain actual role-owner/teammate review, finalize schemas and API contracts, implement bounded slices, and replace pending traceability cells with verified code/test/release evidence.

## Resource record

| Stage / agent / invocation | Selected model / effort; observed if exposed | Start / end with timezone | Elapsed | Input / output tokens | Cache usage | Tool calls / retries | Outcome / telemetry source or unavailable reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Main agent: baseline inspection | Unavailable: model/effort execution metadata not exposed | Exact start unavailable; timestamp sampled 2026-10-25 11:04:18 SGT | Unavailable: complete interval not timed | Unavailable: no usage telemetry | Unavailable | Visible conversation history; initial Git ownership failure | Review findings and split boundaries established |
| Main agent: restructure and consistency review | Unavailable: model/effort execution metadata not exposed | Samples 11:04:18 and 11:11:14 SGT; complete end unavailable | 416 seconds between samples only, not full stage elapsed | Unavailable: no usage telemetry | Unavailable | Visible conversation history; Python command/interpreter/extraction retries described above | 48 requirements conserved, scenarios/traceability complete, 141 local links checked |

- End-to-end wall time and summed agent elapsed time: unavailable because full stage boundaries were not recorded. No subagents invoked; sampled intervals are not total runtime.
- Measurement sources: visible command outputs and conversation tool history. Missing token/cache/model metadata is not estimated.
