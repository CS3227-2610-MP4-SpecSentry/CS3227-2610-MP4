# Contributor breadcrumb refinement

Prompter: yooplo, inferred from Git identity. Baseline61de42d. User requested a
focused navigation correction, no commit/push: remove duplicate Workspace/Drafts
destinations, use My Drafts hierarchy, semantic ancestor links/current text,
preserve dirty guard/history/keyboard/mobile behavior and existing visual styling.
Human verification of this summary is pending.

## Cause, scope and acceptance

PageHeader hardcoded Workspace and Drafts as separate items pointing to the same
/contributor route. Existing router/guard already handles links; no route or
guard rewrite is needed. Intended paths: My Drafts (list current), My Drafts →
title (detail), My Drafts → title → Edit, My Drafts → Create Draft.
Each ancestor has a unique real destination; one plain-text aria-current item;
loaded title reuse, keyboard and normal browser history remain. Dirty navigation
prompts once, cancel retains edits, confirm proceeds, clean exits do not prompt.

REQ-CON-013 and AC-CON-UX-004 clarified in place; no new identifiers. REQ-CON-010,
REQ-SHR-005 remain preserved. UI-UX-SPEC section C updated with exact paths.
No CSS, backend, dependency, authorization or persistence changes planned.

## Assignments and verification

- Main: specs/traceability/log and coordination; intervalc3e5e98c6f9344349d15571621abd801.
- breadcrumb_implementer: PageHeader, NavigationPhase2 and FunctionalUx tests,
  relevant legacy browser assertions only; preserve handlers/guard/routes.
- breadcrumb_verifier: independent browser fixtures and full client/lint/all
  workspace typecheck/production build; no source writes or real-data mutations.
- No security specialist needed: existing router links and guard remain unchanged,
  with no trust-boundary, sensitive-data or external-call changes.

Initial source inspection: other Contributor all-proposals/submitted breadcrumbs
already use distinct destinations. Reviewer and Maintainer have no Breadcrumb
navigation implementation in the inspected source; do not invent new navigation.

## Final results

PageHeader alone changed production behavior: duplicate root removed, My Drafts
and Create Draft labels applied. Existing Link/router/guard/CSS preserved.
NavigationPhase2 tests now check exact labels, unique hrefs, current SPAN,
title-link stay/leave and history return, and clean ancestor PUSH/Back. FunctionalUx
uses the new breadcrumb name while retaining its original guard assertions.
Legacy browser navigation checks gained exact hierarchy/current/destination checks.
Other role/source inspection found no duplicate breadcrumb destinations requiring edits.

Independent full client suite passed242tests/15files; root lint, all-workspace
typechecks and production build passed. Existing535.22kB bundle advisory remains.
Chrome1440/768/375 passed12screen checks and9navigation cases: exact hierarchy,
unique links/current plain text, escaped long titles/no overflow, keyboard
stay/leave for both editor ancestors, guarded browser Back, clean Back/Forward
history and no-prompt navigation. Zero business mutations and page errors.
Main reviewed source diff and mobile screenshot; whitespace checks passed.

First browser harness run checked dialog count before its asynchronous event;
verifier corrected synchronization using expect.poll and reran unchanged product
behavior. Sandboxed esbuild parent-directory access failed; approved elevated
typecheck/build reruns passed with no source workaround. No approval rejection.

Evidence: [independent report](resources/2026-11-02-breadcrumb-refinement/verification/independent-verification.md),
[browser measurements](resources/2026-11-02-breadcrumb-refinement/verification/browser-results.json).
Verification directory retains reproducible script and12screenshots. No real
database mutation, production deployment or full manual accessibility audit;
browser checks use isolated synthetic API responses. No commit or push.

Resource intervals started before edits/dispatch. Initial
read-only lookup and final report/response rendering outside timing; model/effort
and attributable usage telemetry unavailable.

All three resource intervals closed successfully; no unfinished records. Main interval259.346s; overlapping summed elapsed 518.587s, not compute time. [Resource report](resources/2026-11-02-breadcrumb-refinement/verification/resource-report.md).
