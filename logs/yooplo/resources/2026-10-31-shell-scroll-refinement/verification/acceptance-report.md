# Independent shell scroll acceptance

Reviewed the shell refinement against the user attachment and [run brief](../../../2026-10-31-shell-scroll-refinement.md), preserving the earlier uncommitted redesign on base `d44408892e381127c41807fbf50da87ff8ebd3d9`. Scope: App shell/navigation, shared CSS and matching tests. Source review confirms authentication/session-generation handlers and Contributor API/business handlers remain unchanged; new logic concerns the native mobile dialog and navigation presentation only.

## Final execution

Commands: `npm.cmd run dev -w @specsentry/client -- --port 5184`, `node workflow/tests/browser/shell-scroll.mjs`, `node --check workflow/tests/browser/shell-scroll.mjs`, `git diff --check`.

**10/10 browser checks passed**, zero console/page errors. Ten PNG screenshots and `acceptance-results.json` retain final evidence. Chrome/Playwright used synthetic API fixtures; no live backend/database behavior is certified.

| Scope / requirements | Observed result |
| --- | --- |
| Independent scroll, REQ-SHR-005 | At 1440x900, 1920x1080, 1024x900, 768x900 and 375x812 the main has overflow, document scroll remains zero and document height fits the viewport. Wheel moves main by more than 100px; PageDown advances main further. Topbar bounding box remains identical; visible desktop sidebar bounding box remains identical. No horizontal document overflow. |
| Sidebar overflow | Normal navigation fits without overflowing. Test-only noninteractive text rows make `.sidebar-scroll` overflow. Wheel scroll advances that region; main stays unchanged even when wheeling at the sidebar scroll boundary. Brand and footer bounding boxes remain identical, with sign-out within the viewport. No synthetic navigation destinations were added. |
| Rail and stability | Collapse leaves a visible narrow rail with named workspace navigation and sign-out. Unsaved editor text survives repeated toggles. Collapsed width survives navigation from editor to detail/list. Main width remains unchanged between long detail and list; computed scrollbar gutter is stable. |
| Compactness and motion | Empty state is content-driven and below 340px at tested desktop viewport. Reduced-motion computes zero shell/sidebar transition duration; main scroll behavior stays native `auto`. |
| Mobile dialog, REQ-SHR-005 / NFR-A11Y-001 | Native dialog matches `:modal`; page focus remains within it during forward/reverse Tab, while browser controls can receive focus normally. Background input focus attempts are blocked; wheel does not move main/document. Escape closes and restores the opener. Desktop resize closes the dialog and focuses the visible desktop toggle; resizing back leaves background focus/scroll usable and retains unsaved text. At 375x420 the footer/sign-out remains visible and Close navigation restores the trigger. |
| Existing draft workflow, REQ-CON-001/002 | Synthetic create/detail/edit/save/delete/sign-out passes. Deletion confirmation focuses Cancel. Mutating draft requests retain CSRF; fixture asserts expected save version. |
| Accessibility scans | Tagged axe WCAG 2 A/AA, 2.1 AA and 2.2 AA scans report zero violations for five scrolled editor widths, collapsed rail, compact empty state and open mobile dialog. This is partial accessibility evidence, not full manual compliance. |

Visual inspection of `shell-1440.png` and `mobile-drawer-short.png` confirms stationary shell regions around a scrolled editor and accessible drawer footer on a short screen. The screenshots contain synthetic draft/account data only.

## Attempts and disposition

- First verifier interval `e8c94c4f43754b3ea58ca5643c91f22e`: 9/10 passed; an overly strict Tab assertion required `activeElement` to remain inside the native dialog even when Chrome moved focus to browser controls. Preserved in `attempt-1-results.json`.
- `native-focus-trail.json` demonstrates the outside-dialog BODY entries have `document.hasFocus() === false`; subsequent Tab returns into the dialog. This is native browser behavior, not background page focus. The corrected check requires modal containment whenever the document has focus and separately attempts background input focus. No custom focus trap was requested or added.
- Revalidation interval `ff0d6757548148b3b8b8f09d69584d0d`: all final checks pass after the implementer's desktop-resize focus correction. No unresolved scope blockers.

Limits: no live database authorization/concurrency checks, other browser engines, real mobile virtual-keyboard testing, screen-reader testing, full manual WCAG audit, or deployment verification. Root coordinator retains ownership of complete unit/type/lint/build evidence and human teammate sign-off remains pending.

## Follow-up sidebar gutter measurement

Coordinator requested an actual before/after width measurement rather than a speculative fix. `node logs/yooplo/resources/2026-10-31-shell-scroll-refinement/verification/sidebar-gutter-debug.mjs` measured `.sidebar-scroll` client/offset width at 216px and navigation/link width at 208px both before and after 60 synthetic noninteractive rows induced vertical overflow. Computed `scrollbar-gutter` was `auto`; navigation width change was **0px**. Evidence: `sidebar-gutter.json`. No measurable shift in current Chrome justifies an additional source change. Classic/non-overlay scrollbar behavior in other environments remains unverified. Follow-up interval: `432b1989ba164282960eb628aa817a13`.
