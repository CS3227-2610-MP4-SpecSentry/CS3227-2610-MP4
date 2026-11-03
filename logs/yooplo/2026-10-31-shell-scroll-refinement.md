# Shell scrolling refinement: prompt log and run brief

## Context and request

- Prompter yooplo, inferred previously from Git identity. Date 31 October 2026 Asia/Singapore. Human summary verification pending.
- User attached a UI refinement request: stationary desktop sidebar and topbar, independent workspace/navigation scrolling, smooth icon-rail collapse, accessible mobile drawer, subtle scrollbars/transitions, smaller content-driven empty state, responsive and reduced-motion verification. Preserve authorization, auth, data/API/business logic and all prior work. No commit/push/merge/deploy.
- Baseline is the existing uncommitted SaaS redesign on `d44408892e381127c41807fbf50da87ff8ebd3d9`; earlier logs describe that patch. Preserve it, append only this request's changes and evidence.
- Read root AGENTS, current App/CSS/tests and shared/Contributor workflow requirements. Previously read assignment/product/specs and relevant skills remain applicable. Skills: log-change-session, Ponytail; independent verifier applies specification-conformance review. No external UI library/assets.

## Design and acceptance brief before implementation

- Root cause: `.app-shell` has only `min-height:100vh`; `.app-body` and `main` lack a bounded scroll area. The document grows with the editor, moving sidebar and topbar. `hidden` currently removes desktop navigation entirely; new collapsed behavior must retain accessible icon navigation.
- Interpret request under REQ-SHR-005 / NFR-A11Y-001 and existing private-draft REQ-CON-001/002/007/009 presentation scope. No material domain requirements change; no API/shared contract/transaction edits. Security-specialist gate does not apply unless trust boundaries or sensitive handling change; those edits are excluded.
- Desktop shell: `100vh` fallback then `100dvh`, bounded grid/flex with min sizes zero and outer overflow hidden. Workspace main owns vertical scrolling; topbar remains a sibling above it. Sidebar brand/footer stay accessible; nav region scrolls only on overflow with overscroll containment and usable subtle scrollbar. No desktop document scroll.
- Collapse: icon rail with accessible names/tooltips, CSS width/label transitions, no child-remount or unsaved-input loss; state survives route navigation in current app instance. Mobile: accessible drawer with Escape, focus return/trap, background scroll prevention and no unreachable sign-out. Reduced-motion disables transitions; no global smooth scrolling.
- Preserve active authorized workspace navigation and existing routes/actions. Compact empty state with balanced content-driven padding and stable scrollbar gutters. Existing list/create/detail/edit/delete and session safeguards remain intact.
- Verify desktop 1440x900 and 1920x1080, plus 1024/768/375 widths, document/main/sidebar scroll ownership, topbar position, overflow nav independent wheel, collapsed rail usability, mobile dialog keyboard/focus/background scroll, reduced-motion, long text, no horizontal overflow and draft workflow regression. Run client units, root lint/typecheck/build; use synthetic API browser fixtures without claiming server authorization proof.

## Assignments and resources

- Main coordinator owns this log, docs/plan/traceability and final checks. Resource `cd95e4d881d247039ef264cbf644a644` started before edits. Exact model/effort and attributable counters not exposed.
- Implementer owns `src/client/src/App.tsx`, `styles.css`, `App.test.tsx`, `shared/Icon.tsx` if needed; no other writers. Budget about 15 minutes; inspect callers/tests; no subagents. Resource assigned separately below. Next authorized action: implement this bounded refinement and unit/type checks, then hand off stable source.
- Independent verifier owns a new scroll verification script and evidence directory only. Prepare while implementation runs, then final source/browser acceptance after ready. Coordinator will serialize shared builds to avoid previous dist interference.
- Existing agents resumed as actual new assignments: implementer interval `e5406ce11e5b4a78a68cf7340d818937`; verifier interval `e8c94c4f43754b3ea58ca5643c91f22e`. Both coordinator-observed boundaries may include scheduling. Verifier uses a fresh Vite port 5184 and synthetic API fixtures, preserving the user's running services. Budget about 15 minutes per assignment; no further delegation.
- Consulted platform documentation for [native dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) and [scrollbar gutters](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-gutter) and supplied those references to implementer. These are references, not imported source. Native dialog semantics and stable gutter behavior inform checks; actual browser evidence remains required.

## Outcomes and validation

Implemented the requested layout refinement in four frontend files:

- `src/client/src/App.tsx`: shared SidebarContent presentation, desktop rail and viewport shell, native MobileNavigation dialog with close/Escape/resize focus handling. Sidebar branding/footer outside its scrolling middle region; topbar outside main scrolling content. Existing auth/session-generation/fetch/business mutation handlers unchanged.
- `src/client/src/styles.css`: viewport-bounded grid/flex/min-size/overflow structure, scroll containment and subtle scrollbar styling, stable main scrollbar gutter, 180ms shell width transition and 120ms label opacity transition under no-preference only, compact content-driven empty state. Main wheel/keyboard behavior remains native; no global smooth scrolling.
- `src/client/src/App.test.tsx`: updated rail expectations and native-dialog cancel/close/focus/state regression (JSDOM dialog methods stubbed; real behavior tested in Chrome).
- `src/client/src/shared/Icon.tsx`: close icon for the mobile drawer. No new package, backend/API/schema, permission or data-model changes.

Documentation/workflow updates: `docs/UserGuide.md`, `docs/DeveloperGuide.md`, `workflow/PLAN.md`, `workflow/TRACEABILITY.md`, this run/prompt log and resources. New independent harness `workflow/tests/browser/shell-scroll.mjs`; synthetic evidence lives under this session's verification directory. Earlier redesign changes remain present and uncommitted.

Validation and interactions:

- Implementer: 87/87 client units passed, client typecheck passed; corrected mobile-to-desktop close focus to target the now-visible desktop toggle. Original route/document-style scroll retention is preserved; no route-scroll JavaScript added.
- Main: `npm.cmd run typecheck --workspaces --if-present` passed all three workspaces; root lint passed twice including final source; client production build passed; full `npm.cmd run build` passed after browser/unit completion using approved sandbox escalation needed by esbuild parent-directory inspection. Shared builds were serialized to avoid the previous task's import-reload interference. `git diff --check` passed.
- Verifier: [independent acceptance report](resources/2026-10-31-shell-scroll-refinement/verification/acceptance-report.md), [final results](resources/2026-10-31-shell-scroll-refinement/verification/acceptance-results.json), [harness](../../workflow/tests/browser/shell-scroll.mjs). 10/10 Chrome browser checks pass, zero console/page errors and zero tagged axe violations on tested screens. Dimensions: 1440x900, 1920x1080, 1024x900, 768x900, 375x812 and short drawer375x420. Main wheel/PageDown advances only main; document scroll stays0; topbar/sidebar bounds stable. Test-only inert sidebar rows verify independent overflow/wheel boundary containment with fixed brand/footer. Rail names/sign-out, route-persisted collapse/unsaved input, main gutter stability, compact empty state, reduced motion, native modal background focus/scroll blocking, Escape/resize focus return and synthetic create/save/delete/sign-out pass.
- First verifier attempt9/10 failed an overly strict assertion about native dialog focus. [Native focus trail](resources/2026-10-31-shell-scroll-refinement/verification/native-focus-trail.json) showed BODY only while `document.hasFocus()` was false (Chrome browser controls), then Tab returned inside. Test corrected to require containment when the document has focus and separately reject background-input focus. No custom focus trap or weakened background-focus requirement added. Failed evidence remains [attempt1](resources/2026-10-31-shell-scroll-refinement/verification/attempt-1-results.json); fresh verifier invocation reran all checks.
- Main visually inspected collapsed desktop rail and mobile drawer screenshots. Verifier also inspected scrolled desktop and short drawer. Ten screenshots include [1440 desktop](resources/2026-10-31-shell-scroll-refinement/verification/shell-1440.png), [1920 desktop](resources/2026-10-31-shell-scroll-refinement/verification/shell-1920.png), [rail](resources/2026-10-31-shell-scroll-refinement/verification/rail-desktop.png), [mobile drawer](resources/2026-10-31-shell-scroll-refinement/verification/mobile-drawer.png), [compact empty state](resources/2026-10-31-shell-scroll-refinement/verification/empty-compact.png).
- Follow-up sidebar-gutter measurement: navigation width208px before/after60 overflow rows; scroll-region client/offset width216px unchanged in current Chrome. [Measurement](resources/2026-10-31-shell-scroll-refinement/verification/sidebar-gutter.json). No measured jump; no speculative extra source fix. Classic/non-overlay scrollbar configurations remain unverified.

Remaining limits: live DB authorization/concurrency and backend suites were not rerun because no backend/business changes; browser workflow uses synthetic responses. Other browser engines, real mobile virtual-keyboard/dynamic toolbar behavior, screen readers and full manual WCAG audit remain unverified. Existing product workflow gaps are unchanged. No full accessibility compliance, deployed functionality or human teammate sign-off inferred.

Human teammate review remains required before merge. No commit, push, merge or deployment performed. Next action: user review of the running UI and screenshots.

Subsequent user instruction authorized local commits in relevant batches. See the
[commit preparation and results](2026-10-31-ui-batch-commits.md); earlier no-commit
statements describe the implementation checkpoint. Push, merge and deployment
remain unauthorized and unperformed.

## Resource record

All intervals begin at actual agent dispatch/stage boundaries; main interval began before edits. Exact selected/observed model/effort, token/cache/tool/retry counters unavailable from runtime; do not estimate. Coordinator-observed child boundaries include scheduling/waiting. Structured records/report and final timing table appended after closure; final log/report rendering is outside measured boundary.

`resource-session.py report --markdown` passed with all five records finished. UTC date below is 30 October; these times are 31 October in Asia/Singapore.

| Agent / stage | Start–end UTC | Elapsed seconds | Status / record |
| --- | --- | --- | --- |
| Main coordination | 16:09:19.883662–16:17:00.098906 | 460.215244 | Succeeded; [record](resources/2026-10-31-shell-scroll-refinement/cd95e4d881d247039ef264cbf644a644.json) |
| Implementer | 16:09:51.475092–16:14:00.403099 | 248.928007 | Succeeded; [record](resources/2026-10-31-shell-scroll-refinement/e5406ce11e5b4a78a68cf7340d818937.json) |
| Verifier acceptance1 | 16:10:08.053097–16:14:01.641689 | 233.588592 | Failed assertion; [record](resources/2026-10-31-shell-scroll-refinement/e8c94c4f43754b3ea58ca5643c91f22e.json) |
| Verifier revalidation2 | 16:14:01.713554–16:15:30.754791 | 89.041237 | Succeeded; [record](resources/2026-10-31-shell-scroll-refinement/ff0d6757548148b3b8b8f09d69584d0d.json) |
| Verifier gutter measurement | 16:15:50.198825–16:16:36.587427 | 46.388602 | Succeeded; [record](resources/2026-10-31-shell-scroll-refinement/432b1989ba164282960eb628aa817a13.json) |

Measured end-to-end wall time: 460.215244 seconds; summed overlapping agent intervals: 1078.161682 seconds. Counters unavailable for every row, not measured zero. Human summary/teammate verification pending. No model-price or usage-savings claim is made.
