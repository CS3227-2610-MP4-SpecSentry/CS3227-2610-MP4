# Implemented UI/UX specification

Snapshot:31 October2026, completed UI phases1–3. This document consolidates
implemented presentation and interaction contracts; it does not assert deployment
or delivery of the product's planned Reviewer/Maintainer/AI workflows.

## Authority and requirement boundaries

[PRODUCT-SPEC](PRODUCT-SPEC.md) owns product scope. Functional definitions remain
in [ROLE-CONTRIBUTOR](ROLE-CONTRIBUTOR.md): REQ-CON-010–017 and AC-CON-UX-001–008.
[SHARED-REQUIREMENTS](SHARED-REQUIREMENTS.md) owns REQ-SHR-005 and NFR-A11Y-001.
[INTEGRATION-SPEC](INTEGRATION-SPEC.md) owns wire limits and failure semantics.
This specification supplies implemented layout/design detail and mappings rather
than duplicate or renumbered requirements. No new business capability is added.

## A. Purpose and supported scope

SpecSentry helps software teams prepare specifications and reviewable changes.
Implemented users have exactly one role: Contributor, Reviewer or Release
Maintainer. All roles can sign in, restore a session, navigate their authorized
workspace shell and sign out. Contributor UI implements owned never-submitted
DRAFT listing, creation, saved detail, editing, criteria/evidence preparation and
confirmed draft deletion. Saved detail is working data, not a submitted snapshot.
The current editor only saves eligible DRAFTs; broader lifecycle capabilities in
the product specification are planned and must not be inferred from this UI.

Reviewer/Maintainer landing pages truthfully report that workflow features will
appear when available. No fake queues, statistics, assistant results or disabled
feature previews are supplied. Submission/review/release/AI operations and the
proposed create-to-editor shortcut PROP-CON-001 are outside this implementation.
Successful creation continues to open saved detail, not the editor.

## B. Application layout

[App.tsx](../../src/client/src/App.tsx) provides the persistent authenticated
shell, sidebar, topbar, native mobile navigation dialog and route fallbacks.
[styles.css](../../src/client/src/styles.css) defines its layout. A viewport-height
grid contains the sidebar and a min-width/min-height-zero body. The body stacks
the stationary topbar and independently scrolling main; sidebar navigation has
its own scrolling region with account/sign-out footer outside that region.
Document scrolling is not the authenticated workspace scroll mechanism.

Desktop sidebar width is248px,220px at at-most1100px, and76px when collapsed.
The rail keeps accessible control names while labels are visually hidden. Main
content has1560px maximum width, responsive padding, stable scrollbar gutter and
horizontal reflow. Topbar shows the current task and account context; the account
label is visually clipped at at-most1023px but retains accessible text.

Below768px, the desktop sidebar is replaced by a44px menu button and native modal
dialog, width min(320px,90vw), viewport height. The modal traps focus/inerts the
background through native dialog semantics. Close/Escape restores trigger focus;
crossing the desktop breakpoint closes it and restores the desktop toggle.
Main scrolling pauses while the drawer is open. The current task stays visible.

## C. Navigation and draft safety

[PageHeader](../../src/client/src/features/contributor/PageHeader.tsx) gives each
Contributor list/create/detail/editor one task-specific h1 and semantic ordered
breadcrumbs. Loaded draft titles are reused without an extra metadata read;
long labels truncate visually while the complete accessible/title text remains.
Only implemented authorized routes are linked. The primary area of each draft
row is a real Link, including ordinary keyboard, modified-click and new-tab use;
no nested controls or invented row actions are added.

[main.tsx](../../src/client/src/main.tsx) uses a data router with
[NavigationGuardProvider](../../src/client/src/shared/NavigationGuardProvider.tsx).
[navigationGuard.ts](../../src/client/src/shared/navigationGuard.ts) registers
current dirty/pending/reconciliation messages. Sidebar, branding, breadcrumbs,
Back actions and browser POP navigation ask once before discarding edited fields
or criterion-meaning choices. Cancel retains content/location; confirm proceeds
once. Clean/reverted content and reconciled saved content do not prompt.
Beforeunload requests browser-native refresh/close protection subject to browser
policy; the application cannot guarantee native-dialog wording or display.

Pending, conflicting and uncertain saves retain safety guards. Forced session
loss/replacement clears protected content without a discard veto. No sensitive
draft content is persisted in localStorage/sessionStorage. Skip-to-main and
editor/recovery jumps move focus without adding hash entries that could bypass
subsequent guarded history navigation.

## D. Contributor workspace

[ContributorWorkspace.tsx](../../src/client/src/features/contributor/ContributorWorkspace.tsx)
keeps Create New Draft close to the list heading. The list panel combines one
privacy explanation with “Drafts on this page” and the actual loaded count;
there are no redundant metric/privacy cards. Loading is `...`, failure is
`Unavailable`, and an empty loaded page is0. Counts never claim a global total.
Cursor navigation exposes Next page and First page when applicable.

The first empty page says No drafts yet; a later empty page says No drafts on
this page. Both have real creation guidance/actions without invented data.
Loading has textual status; a failed list read offers retry. Draft links identify
their titles and private DRAFT context. Deletion requires the existing explicit
confirmation; version/ownership checks remain server responsibilities.

Saved detail renders all acceptance criteria in stored order with Required or
Optional text, escaped multiline statements and a clear empty state. Working
detail never claims reviewer coverage or immutable submitted revision status.

## E. Draft editor and feedback

The semantic sections are Overview, Acceptance criteria, Patch and Evidence.
Overview contains title/problem/constraints/expected behavior. Criteria support
required-by-default rows and existing meaning/identity choices. Patch contains
optional Contributor summary and unified diff; evidence contains optional plain
text. No patch/evidence text executes. Current limits are exposed in associated
guidance and validated with shared contracts, not redefined by this document.

Section links focus their headings and scroll only main, clearing actual sticky
Save height, computed main padding and an additional16px gap. Narrative sections
and creation form are capped at76ch; summary at72ch; patch can use the wider
form. Textareas retain native scrolling/resizing. Semantic fieldsets and lightly
grouped criterion/evidence items avoid redundant nested borders; directly
adjacent fieldset fields retain1.5rem spacing. No extra editor scroll pane exists.

The compact Save region is sticky at main top, keyboard accessible, adjacent to
textual status and measured with ResizeObserver for focus/scroll clearance. Save
is disabled while pending/loading/blocked/ineligible, preventing duplicate
requests. Field validation retains text, associates errors/invalid state and
focuses the first relevant control. Row add/remove focus is applied in its DOM
layout effect so an earlier passive effect cannot consume a newer focus request.

| State | Implemented feedback and safe action |
| --- | --- |
| Clean/dirty | No unsaved changes or Unsaved changes beside Save; dirty exits guarded. |
| Saving | Saving private draft, pending disabled control, one request; leaving does not cancel it. |
| Saved | Announce version only after returned mutation identity/version and committed-content readback reconcile. |
| Validation/known failure | Save needs attention, detailed field/region errors, retain input and correction path. |
|409 conflict | Draft changed, saving paused; retain edits and require checking/reloading saved data before retry. |
|5xx/network/invalid result | Outcome uncertain, saving paused; never claim definite failure/success or blindly repeat. |
| PATCH confirmed/readback incomplete | Saved; verification incomplete. Retain edits, pause saves and provide recovery details. |
| Reload | Explicitly confirm discarding entered edits; preserve local text if latest saved read fails. |
| Session expiry/401/replacement | Clear protected state, show login/status; recover only previously server-saved work. |

Compact status links to full recovery information in normal flow. Keyboard use
focuses that region below Save without hash-history mutation. Detailed long
errors must not become a viewport-filling sticky toolbar, including enlarged text.

## F. Implemented visual design system

Tokens are the actual `:root` definitions in styles.css. Existing navy/blue,
white and slate identity remains. One-off layout/accent values may remain local;
this is a small CSS system, not a new framework or a claim every literal is a token.

| Tokens | Values |
| --- | --- |
| `--navy`, `--blue`, `--blue-hover` | `#172b4d`, `#2563eb`, `#1d4ed8` |
| `--text`, `--text-secondary`, `--text-strong`, `--muted` | `#0f172a`, `#475569`, `#334155`, `#64748b` |
| `--canvas`, `--surface`, `--surface-muted` | `#f8fafc`, `#ffffff`, `#f1f5f9` |
| `--border`, `--border-strong`, `--control-border` | `#e2e8f0`, `#cbd5e1`, `#94a3b8` |
| `--info-bg`, `--info-border`, `--info-text` | `#eff6ff`, `#bfdbfe`, `#1e40af` |
| `--danger`, `--danger-text`, `--danger-border`, `--danger-bg` | `#b91c1c`, `#991b1b`, `#fecaca`, `#fef2f2` |
| `--font-sans` | Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif (system fallback; no font download). |
| `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-heading` | `.75rem`, `.875rem`, `1rem`, `1.125rem`, `1.5rem` |
| `--text-title` | `clamp(1.6rem, 3vw, 2rem)` |
| `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8` | `.25rem`, `.5rem`, `.75rem`, `1rem`, `1.5rem`, `2rem`, respectively |
| `--radius-sm`, `--radius-control`, `--radius` | `6px`, `8px`, `12px` |
| `--shadow`, `--shadow-control`, `--shadow-raised` | `0 2px 6px #0f172a05`, `0 1px 2px #0f172a0d`, `0 12px 35px #172b4d08` |
| `--motion-fast`, `--motion-base` | `140ms`, `180ms` |
| `--focus-ring`, `--focus-offset` | `3px solid var(--blue)`, `4px` (button offset3px; inset row focus avoids clipping). |

Primary buttons are blue; secondary actions use white/slate/borders; destructive
actions use explicit danger text/borders. Disabled controls do not adopt enabled
hover styles. Pressed controls use inset shadow without translation/layout shift.
Forms retain label/input distinction, invalid borders and textual feedback.
Cards/rows, role/fallback surfaces, login and loading/error states share these
conventions; status is never colour-only. Existing local SVG Icon is reused.
Background/border/shadow transitions and sidebar width/label feedback run only
under prefers-reduced-motion:no-preference; no animation dependency is present.

## G. Responsive behavior and overflow

Implemented breakpoints include1100px shell padding/sidebar reduction,1023px
account clipping,767px mobile shell/drawer and479px compact controls/Save wrapping.
Media rules and minmax/min-width-zero prevent document horizontal overflow.
Mobile buttons/row links/section links have generous targets; general buttons and
mobile icon toggles are at least44px high. This is not a claim every inline link
or checkbox is44px; labels/native controls remain available.

Verification uses375/768/1440×1000 plus existing wider/enlarged regressions.
Two-hundred-percent root text enlargement exercises reflow, long errors and
focus/Save clearance. Narrow viewport tests support the browser-zoom expectation
of reflow; an independent manual matrix of actual browser zoom/platform settings
is not certified. Tall textareas need usable focused/native-scroll area and
clearance from Save, not impossible whole-control containment at every size.
The mobile header remains compact and the drawer operable under enlargement.

## H. Accessibility

Semantic Link/button/form/fieldset/legend/native dialog controls retain standard
keyboard operation. Task h1/subordinate sections, visible focus, associated
labels/guidance/errors, aria-invalid and textual status/alert regions are required.
The skip link hides by its own height and becomes visible on focus. Focus returns
after drawer close, moves to added/adjacent remaining rows, section/recovery
targets and invalid fields, and remains clear of sticky controls. Save and
recovery remain usable without pointer or motion. Escaped plain text protects
criteria/draft display; no unsafe HTML rendering is introduced.

Automated axe tagged checks and keyboard/geometry assertions are bounded evidence
for REQ-SHR-005/NFR-A11Y-001, not full WCAG2.2AA or assistive-technology compliance.

## I. Other application states

Session/list/detail loading has readable status. Empty states explain the next
real action. Generic errors provide safe retry/correction without server traces.
Successful deletion/sign-out uses textual status. Access-denied/not-found routes
give truthful headings and available navigation. Unavailable role workflows are
described as unavailable, not implemented by visual placeholders. Login retains
pending/failed/throttled feedback and proper autocomplete labels. Authentication,
authorization, CSRF, ownership and version validation remain server-enforced;
client visibility and this specification cannot authorize business operations.

## J. Nonfunctional scope and verification

Reuse the existing React/router/shared-contract/CSS architecture; do not add a
component library for these refinements. Reuse loaded metadata, avoid duplicate
protected reads/submissions, keep feedback synchronous where practical and
transitions short/reduced-motion-aware. No UI latency benchmark or project-wide
NFR-PERF-001 completion is claimed by screenshot/unit evidence.

Chrome/Chromium synthetic API fixtures are verified at the linked dimensions.
Modern browser CSS/native-dialog support is an expectation, not tested Safari,
Firefox, real mobile keyboard, live backend/cross-role or deployed certification.
Do not claim production readiness from local build/accessibility scans alone.

| Authoritative requirement | Acceptance | Implementation/test entry points |
| --- | --- | --- |
| REQ-CON-010 | AC-CON-UX-001 | navigationGuard/Provider, main.tsx, FunctionalUx.test.tsx, navigation-phase2.mjs guarded/history/session cases. |
| REQ-CON-011 | AC-CON-UX-002 | Contributor saved detail, FunctionalUx.test.tsx criteria cases, browser saved-criteria checks. |
| REQ-CON-012 | AC-CON-UX-003 | editor Save/reconciliation/recovery, FunctionalUx/NavigationPhase2 tests, browser pending/conflict/uncertain/enlarged cases. |
| REQ-CON-013 | AC-CON-UX-004 | PageHeader/App, NavigationPhase2.test.tsx, task/breadcrumb browser checks. |
| REQ-CON-014 | AC-CON-UX-005 | semantic draft-row Link, NavigationPhase2.test.tsx, modified/new-tab/touch browser checks. |
| REQ-CON-015 | AC-CON-UX-006 | jumpToSection/form, NavigationPhase2.test.tsx, main-only focus/history/clearance browser cases. |
| REQ-CON-016 | AC-CON-UX-007 | hints/topbar/drawer/recovery, NavigationPhase2.test.tsx, enlarged error/skip/recovery checks. |
| REQ-CON-017 | AC-CON-UX-008 | App/Contributor/styles, ContributorWorkspace/CriteriaDraft tests, visual-phase3.mjs matched screen matrix and focused browser checks. |
| REQ-SHR-005 / NFR-A11Y-001 (partial) | AC-SHR-005 / AC-NFR-A11Y-001 | App/Icon/styles; keyboard, axe, drawer, focus, enlargement and reduced-motion cases above; manual/live gaps remain. |

Reproducible browser entry points live under `workflow/tests/browser`:
`navigation-phase2.mjs` (48 cases), `visual-phase3.mjs` (34 matched-screen cases),
and [visual-phase3-checks.mjs](../tests/browser/visual-phase3-checks.mjs) (seven
layout/state checks plus criterion/evidence focus). The latter accepts
`UI_BASE_URL` and `UI_CHECK_OUTPUT`, defaults generated output to ignored tmp,
and uses three retained baseline empty-state PNGs for density measurements.
Historical hardcoded-output harnesses can be copied with an output-directory-only
substitution for a fresh run; record byte equivalence and never overwrite evidence.

[TRACEABILITY](../TRACEABILITY.md) provides exact linked tests and executed
evidence. Historical outcomes: [Phase1](../../logs/yooplo/2026-10-31-functional-ux.md),
[Phase2](../../logs/yooplo/2026-10-31-navigation-phase2.md),
[integration](../../logs/yooplo/2026-10-31-phase2-integration.md),
[Phase3](../../logs/yooplo/2026-10-31-visual-phase3.md).
Final publication checks and curated file manifest belong to the
[publication run](../../logs/yooplo/2026-10-31-ui-spec-publication.md).
