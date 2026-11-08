# Final submission readiness

## Context and requests

- Prompter, date/timezone: Yu Sutong, 8 November 2026, Asia/Singapore. Name
  inferred from the repository Git identity (`Yu Sutong <e0483972@u.nus.edu>`).
- General task/conversation context: PR29 had merged and production recovered from
  a free-tier cold start. A final audit identified unfinished reflection text,
  stale submission/developer-guide status, human-only verification gaps and the
  need to warn graders about Render startup latency before the production link.
- Explicit change requests and subsequent corrections or decisions:
  - Finish the evidence-backed reflection and stale submission documentation.
  - Keep human verification, teammate declarations/contribution confirmations,
    the final peer walkthrough and course-administration checks as explicit human
    actions rather than claiming they are complete.
  - Put a Render free-tier cold-start warning immediately before the deployed
    production application link in the README.
- Other development prompts/interactions and outcomes (including no-change
  advice/reviews): the owner chose accurate disclosure of possible cold starts
  instead of promising that a free service stays awake. No paid-plan change or
  artificial keep-alive mechanism was requested or applied.
- Human summary verification: pending.

## Changes and evidence

- Changes made and affected files:
  - `README.md` and `docs/UserGuide.md` now put the Render free-tier cold-start
    warning before the production link. The duplicated later warning was removed
    from the README.
  - `docs/Reflections.md` is a final evidence synthesis rather than a pending
    scaffold. It analyzes the measured Maintainer and deployment runs, Reviewer
    continuation costs, role-specific application contexts, resource controls and
    unavailable comparisons without inventing causal savings.
  - `workflow/SUBMISSION.md` and `workflow/TRACEABILITY.md` reflect the live Pages
    site, fresh production smoke, completed reflection analysis and explicit
    evidence limits. A consolidated checklist isolates the remaining human-only
    sign-off and course-administration actions.
  - `docs/DeveloperGuide.md` replaces the stale October current-state paragraph
    with the 8 November release state and identifies the required per-member
    declaration/contribution verification.
- Production evidence: recovery deployment `dep-dbo9f08u01pc73ek1er0` had already
  restored the sleeping free service without a code, database, secret or plan
  change. A fresh Node-based public smoke in this session returned root `200`
  (0.555s), health `200` (0.246s), readiness `200` (0.226s), and the expected
  signed-out session `401` (0.450s). No provider mutation was made in this change.
- Validation commands/results: `git diff --check`, `npm run check:submission`,
  local target validation for every link in the seven changed Markdown files and a
  stale-wording scan passed. Root type-check, lint, 193 server tests, 290 client
  tests, 29 deployment-workflow tests and production build passed. The build kept
  the existing non-failing Vite chunk-size advisory.
- Specification review: MP4-005 and MP4-012 remain backed by separate online
  application/Page evidence; MP4-006 and MP4-013 now point to measured observations
  and analysis; MP4-014 and MP4-015 retain human verification/declaration gates.
  No documentation contradiction was found in the changed scope. Lack of matched
  single-agent, context-size, model and cache conditions remains an explicit
  evidence limit rather than a completed comparison.
- Unresolved items, unavailable checks, and next actions: teammate/human/course
  confirmations remain outside this AI-authored change and are listed in the
  submission checklist. The cold-start notice does not guarantee that a free Render
  service stays awake. Broader provider evaluation and production role-AI UI
  acceptance remain as previously documented.

## Resource record

- Structured report / record references:
  `logs/yu-sutong/resources/2026-11-08-final-submission-readiness/`.
- Timing coverage: recording started before the first repository edit. The first
  interval retained the unavailable-`curl` smoke attempt; the retry used the
  available Node runtime.
- Final report: `resource-session report` returned `ok: true` with no unfinished
  records or issues.

| Stage / agent / invocation | Selected model / effort; observed if exposed | Start / end (UTC) | Elapsed | Input / output tokens | Cache usage | Tool calls / retries | Outcome / telemetry source or unavailable reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Main / `main-1` / attempt 1 | `gpt-5` / unavailable; observed unavailable | 2026-11-08 15:49:06.107246 / 15:50:00.343534 | 54.236288s | unavailable | unavailable | unavailable | Failed after branch/evidence preparation because `curl` is unavailable; structured JSON record is the source. |
| Main / `main-2` / attempt 2 | `gpt-5` / unavailable; observed unavailable | 2026-11-08 15:50:00.479674 / 15:58:00.769954 | 480.290280s | unavailable | unavailable | unavailable | Succeeded with Node smoke, documentation/specification reconciliation and full local validation; structured JSON record is the source. |
| Main / `main-3` / attempt 3 | `gpt-5` / unavailable; observed unavailable | 2026-11-08 15:58:37.446027 / 15:58:55.072616 | 17.626589s | unavailable | unavailable | unavailable | Removed the trailing blank line found by commit preflight; the staged diff then passed its whitespace check. |

- End-to-end wall time: 588.965370 seconds from the first registered start to the
  last registered finish.
- Summed agent elapsed time: 552.153157 seconds. The intervals do not overlap; the
  difference is the measured gap between attempts and commit preflight.
- Measurement coverage and unavailable reasons: all three actual main-agent attempts are
  registered. Per-record input/output tokens, cache reads, tool calls, retries,
  observed model and observed effort were not exposed by the desktop runtime and
  remain unavailable rather than zero. Final report rendering, this resource-table
  insertion, commit/push/PR publication and CI observation are outside the measured
  repository-edit boundary.
