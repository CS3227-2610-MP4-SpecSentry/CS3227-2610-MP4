# Contributor workflow setup

## Context and requests

- Prompter: yooplo, inferred from repository Git `user.name`; no explicit session name supplied. Date: 26 October 2026, Asia/Singapore.
- Context: the user selected the Contributor role and requested advice for independently owned role workflows. The earlier advice-only request explicitly prohibited edits; no edits were made for that request.
- Change request: set up the proposed Contributor multi-agent workflow, update relevant specifications and agent guidance, and do not commit.
- Accepted direction: four agent responsibilities, bounded vertical slices, independent verification, shared-interface coordination, and existing recording tools rather than new automation.

## Changes and evidence

- Starting state: `git status --short` returned no changes. Product workflows remain pending; this task sets up development instructions only.
- Reviewed base: `99e1cc4` plus this session's uncommitted documentation changes, including new files.
- Added [Contributor entry point](../../workflow/contributor/README.md), four agent instructions under `workflow/contributor/agents/` (COORDINATOR, IMPLEMENTER, SECURITY-REVIEWER, ACCEPTANCE-VERIFIER), and [run template](../../workflow/contributor/templates/RUN.md). Defined scope, permissions, dispatch/context, security and acceptance gates, fixes/rechecks, shared-owner coordination, resource evidence, handoffs, and five planned slices.
- Updated `AGENTS.md`, `workflow/README.md`, `workflow/DEVELOPMENT.md`, `workflow/PLAN.md`, `workflow/specs/ROLE-CONTRIBUTOR.md`, and `docs/DeveloperGuide.md` to route Contributor work and reconcile the generic responsibility model. No Reviewer instructions changed. No application code, shared wire contracts, schemas, dependencies, or product acceptance criteria changed.
- Validation: `git diff --check` passed; Python local-link check passed (64 local targets across 13 documents at that checkpoint); `node workflow/tooling/submission-check.mjs` passed required-artifact presence checks only. A Python comparison against HEAD confirmed that the Contributor requirements, acceptance scenarios, and deletion policy were unchanged, and asserted four agent instruction files exist.
- Specification-conformance self-review used the repository skill and examined tracked diff and new workflow files. No blocking mismatch found in this documentation scope. Coverage below is document evidence, not independent product verification.

| Criterion | Evidence / outcome |
| --- | --- |
| Establish the proposed four-role Contributor workflow | Entry point, four assignment instructions, run template; covered |
| Align specifications and root/process discovery | Contributor implementation-process section, AGENTS routing, workflow index, development process, plan and Developer Guide; covered |
| Preserve ownership and product invariants | Shared-contract coordination, bounded write sets, independent verification, immutable/privacy/transaction checks; instructions present; runtime behavior unverified |
| Preserve other role procedures and existing acceptance criteria | No Reviewer file changes; comparison against Contributor requirement section passed |
| Do not commit | No commit, staging, merge, push or deployment performed |

- Limitations: no app/unit/database/browser tests run because the diff is documentation only; no workflow execution experiment or independent agent review performed. Teammate review remains pending. Instructions are not a workflow runner, and Contributor product implementation remains planned. No model performance or cost comparison was requested or performed.

## Resource record

- Before-first-edit interval: [main setup record](resources/2026-10-26-contributor-workflow/3649907128cf45499cfff55eb422406a.json).
- Exact model identifier, reasoning effort, and attributable token/cache/tool/retry telemetry are unavailable from this session. Model family supplied by session: GPT-6.
- Conformance/closure interval: [main review record](resources/2026-10-26-contributor-workflow/d00ae08b324f45dd840a8998566ae5fe.json). No subagents dispatched for this workflow-documentation setup.
- `python -B workflow/tooling/resource-session.py --name yooplo --session 2026-10-26-contributor-workflow report --markdown` passed with both declared intervals finished. Generated rows:

| Agent / stage / attempt | Model / effort | Start / end (UTC) | Elapsed seconds | Input / output tokens | Status |
| --- | --- | --- | --- | --- | --- |
| main / setup / 1 | GPT-6 / unavailable | 2026-10-26T09:48:33.223991+00:00 / 2026-10-26T09:52:11.344221+00:00 | 218.12023 | unavailable / unavailable | succeeded |
| main / conformance-review / 1 | GPT-6 / unavailable | 2026-10-26T09:52:11.854566+00:00 / 2026-10-26T09:53:07.735840+00:00 | 55.881274 | unavailable / unavailable | succeeded |

- End-to-end recorded wall time: 274.511849 seconds (first start to last finish); summed agent elapsed: 274.001504 seconds. Intervals are sequential and include tool/wait time, not model-only compute.
- Per-interval input/output tokens, cache usage, tool calls/retries, and observed exact model/effort are unavailable because attributable runtime counters/settings are not exposed. Null metrics in the linked records do not mean measured zero usage.
- Coverage: all edit and review stages in this setup, no subagents. Initial reads before the first resource start and final measurement transcription/report/response rendering are outside the measured edit-stage boundaries. This final measurement transcription uses the shared recording exception and does not create a recursive interval.
