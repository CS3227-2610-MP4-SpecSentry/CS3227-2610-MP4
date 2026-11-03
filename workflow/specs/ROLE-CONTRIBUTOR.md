# Contributor specification

Baseline: 25 October 2026. Normative design; implementation evidence is tracked in [traceability](../TRACEABILITY.md).

[Product index](PRODUCT-SPEC.md) | [Open decisions](OPEN-DECISIONS.md)

## Implementation process

Contributor development uses the scoped [multi-agent workflow](../contributor/README.md): coordinator, implementer, security reviewer, and independent acceptance verifier. Its planned slices map to the requirements below; workflow documents and agent reports do not constitute delivered functionality or acceptance evidence. Product behavior remains governed by this specification and the linked shared/integration/AI requirements. Cross-role contracts require coordination with affected owners before implementation.

## Requirements

| **ID** | **Capability** | **Acceptance criteria** |
| --- | --- | --- |
| REQ-CON-001 | Draft proposal | An authenticated Contributor can create a proposal with title, problem, constraints, and expected behavior. The server stores it as DRAFT and assigns ownership to the current user. |
| REQ-CON-002 | Edit ownership | A Contributor can edit only their own working draft in DRAFT, SUBMITTED, CHANGES_REQUESTED, or IN_REVIEW. Editing after submission creates a new revision rather than modifying submitted content. Reviewers and Maintainers cannot read unsubmitted working drafts. APPROVED proposals require explicit reopening or approval revocation before revision. Reopening, editing, and resubmission are blocked while attached to a release candidate, including after approval revocation; the Maintainer must first remove the item. Direct requests for another user's proposal return 403 and do not reveal its content. |
| REQ-CON-003 | AI specification draft | For an eligible draft, the assistant returns typed objectives, acceptance criteria, edge cases, ambiguities, and test ideas. The result is shown as a suggestion and is never saved into the specification without an explicit user action. |
| REQ-CON-004 | Submit revision | Submission requires at least one required acceptance criterion and a non-empty sanitized diff. Evidence is optional plain text. The server creates an immutable revision and records a SUBMITTED audit event and visible activity entry. An initial submission enters the pool as SUBMITTED. Resubmission retains an existing reviewer and enters or remains IN_REVIEW, otherwise it enters or remains SUBMITTED in the pool. Include a Contributor-written summary of at most 500 characters, frozen in the submitted revision. Input limits are defined in INTEGRATION-SPEC. |
| REQ-CON-005 | Respond to changes | When changes are requested, the Contributor can read findings, clone the latest content into a new editable revision, and resubmit. Earlier revisions remain immutable. |
| REQ-CON-006 | Withdraw | The owner may withdraw a DRAFT, SUBMITTED, IN_REVIEW, or CHANGES_REQUESTED proposal if it is not in an open release candidate. Withdrawal requires confirmation and an audit reason, closes any assignment, notifies the reviewer if assigned, and blocks further review mutations. |
| REQ-CON-007 | Criterion classification | The Contributor sets required or optional on each criterion in an editable revision; required is the default. Changing a submitted criterion's classification requires a new revision. The Reviewer cannot waive a required criterion. |
| REQ-CON-008 | Finding response | The owner may add a plain-text response attached to a finding while the proposal is IN_REVIEW or CHANGES_REQUESTED. Responses are attributed and appear in submission activity. Contributors cannot resolve findings. |
| REQ-CON-009 | Criterion identity | Preserve a criterion's stable key across revisions only while its meaning is unchanged. A materially rewritten criterion receives a new key. Removed criteria remain in revision history; removing or rewriting a criterion does not automatically resolve its findings. |
| REQ-CON-010 | Unsaved draft navigation safety | Before user navigation discards entered private working content or unsaved criterion-meaning choices, require an explicit leave/stay decision. Cover application links, branding/breadcrumbs, Back actions and browser history; register native unload protection for refresh, closing or external navigation when the browser permits it. Staying retains content, choices and location. Clean or successfully reconciled saved content does not prompt. Pending/conflict/uncertain-save safeguards remain in effect; confirming navigation never claims an uncertain save failed or succeeded. Forced session loss clears protected content immediately without a discard prompt. Never persist unsaved sensitive content in browser storage. |
| REQ-CON-011 | Complete private draft detail | Authorized private draft detail includes all saved acceptance criteria in stored order, with explicit required/optional classification and a clear empty state. Render statements as escaped plain text. Display working-draft data without implying it is a submitted immutable revision or reviewer coverage. |
| REQ-CON-012 | Reachable save action and feedback | The private draft editor keeps a compact, keyboard-accessible Save action and adjacent textual feedback reachable while editing long content. Represent pending, saved, validation/failed, conflict and uncertain/reconciliation outcomes accurately. Prevent duplicate submissions and retain input/recovery protections. Do not obscure fields, focused controls or validation; preserve independent workspace scrolling, design identity and reduced-motion support. A saved state requires the existing committed-version/identity reconciliation to succeed. |
| REQ-CON-013 | Task orientation | Contributor list, creation, saved detail and editor each expose one meaningful primary h1 with logical subordinate headings. Contextual semantic breadcrumbs link only to implemented authorized routes and include the loaded draft title where applicable without duplicate protected reads. Long titles remain accessible without horizontal overflow. Breadcrumb navigation uses the existing unsaved-change guard; mobile keeps the current task visible. |
| REQ-CON-014 | Draft row navigation | The primary region of each private draft row is one semantic link with a descriptive accessible name and generous pointer/touch target. Preserve standard keyboard, modified-click and new-tab behavior, visible hover/focus feedback and existing owner-only routes. No nested interactive controls or invented actions. |
| REQ-CON-015 | Long editor navigation | Organize the editor into identifiable Overview, Acceptance Criteria, Patch and Evidence sections with lightweight in-page navigation. Jumping moves focus and scrolls the workspace below the topbar/Save area without introducing untracked history entries, extra scroll containers or discarded edits. Constrain narrative reading width while allowing patch space; preserve all field validation, error focus, manual saving and reduced-motion behavior. |
| REQ-CON-016 | Clear responsive guidance and recovery | Field guidance explains the task, retains applicable limits and programmatic label/description/error associations, and remains readable. Narrow layouts keep the task visible without excessive account-information wrapping, preserve the accessible drawer and touch controls, and reflow under text enlargement. Recovery wording explains known and uncertain outcomes, retained edits and safe next actions without changing existing conflict, duplicate, session or discard safeguards. |
| REQ-CON-017 | Compact consistent presentation | Keep the draft list and real creation action prominent without redundant summary cards. Show a truthful current-page count, distinguish loading/unavailable from zero, and explain draft privacy concisely. Empty states remain compact and actionable. Use the existing navy/blue/white/slate identity and shared controls/tokens; retain readable narrative widths, clear semantic editor groups and usable patch content without unnecessary nested borders. Subtle interaction feedback respects reduced motion and never changes saving, navigation, session, validation or recovery semantics. |

## UI and use cases

- Draft list: own proposals with lifecycle and latest submitted revision; show a clear empty state and create action.
- Editor: title, problem, constraints, expected behavior, criteria with required/optional classification, unified diff and optional plain-text evidence. Show validation next to fields; keep entered text after validation or AI failure. Working drafts are private and visually distinct from submitted snapshots.
- Submission detail: revision selector, immutable submitted content, findings and plain-text response form, current reviewer/state, and authorized chronological activity. Display submitted revision number beside every decision.
- Submission requires explicit action. Withdraw/reopen actions explain consequences; withdrawal requires confirmation and reason. Editing remains blocked while attached to a candidate.
- Spec Draft Assistant occupies a suggestion panel with explicit selection before saving content; its errors do not disable manual editing.

Primary flow: create working draft, enter required criterion and diff, optionally add evidence, submit to pool, inspect findings, respond, create a new revision and resubmit. Alternatives include pooled replacement, withdrawal during review, and explicit reopening of an unattached approval. Ownership/state/version rejection never overwrites the existing record.

## Acceptance scenarios

Each case is a verification obligation derived from the referenced requirement, not an executed test. Expand conjunctions into independent cases in implementation. Shared denial, failure, accessibility and version rules also apply.

| Scenario | Requirement | Setup/action and observable result |
| --- | --- | --- |
| AC-CON-001 | REQ-CON-001 | Create a draft as Contributor A; stored owner is A and state DRAFT. A non-Contributor cannot create it. |
| AC-CON-002 | REQ-CON-002 | Attempt to read A's draft as another Contributor, Reviewer or Maintainer; no draft content is returned. Attached-item edits are rejected. |
| AC-CON-003 | REQ-CON-003 | Generate a draft suggestion; no specification field changes until explicit selection. AI failure preserves the editor. |
| AC-CON-004 | REQ-CON-004 | Submit with a required criterion, diff and no evidence; submission succeeds. All-optional criteria or an empty diff are rejected. |
| AC-CON-005 | REQ-CON-005 | Request changes, edit a cloned working revision and resubmit; old submitted content is unchanged and assigned reviewer is retained. |
| AC-CON-006 | REQ-CON-006 | Withdraw an IN_REVIEW item; assignment closes, notification and activity exist, and later review writes fail. |
| AC-CON-007 | REQ-CON-007 | Change a submitted criterion from required to optional; old revision is immutable and the change requires a new revision. |
| AC-CON-008 | REQ-CON-008 | Post a Contributor response to a finding; attributed text appears but the finding stays unresolved. |
| AC-CON-009 | REQ-CON-009 | Remove or materially rewrite a criterion; history remains and its unresolved finding is not auto-resolved. |
| AC-CON-UX-001 | REQ-CON-010; REQ-CON-002/009 | Edit fields, criteria/evidence or criterion-meaning choices, then leave through sidebar, branding, breadcrumbs where present, Back or browser history. Stay retains the editor/location/content; Leave navigates once. Skip-to-main transfers keyboard focus without creating untracked history entries that could bypass a later editor Back guard. Clean content and successful reconciled saves do not prompt; failed/conflicting/uncertain saves do not silently mark content saved. Refresh/tab-close registers browser-native protection subject to browser policy. Pending navigation never enables duplicate/obsolete saves. Session expiry, 401 and replacement login clear old protected state without blocking; no browser-storage draft persistence. |
| AC-CON-UX-002 | REQ-CON-011; REQ-CON-007 | Read saved draft detail with multiple required/optional criteria, multiline/HTML-like statements and an empty collection. Preserve exact stored order and classification; display text safely and explain empty criteria. No submission/coverage state is fabricated. |
| AC-CON-UX-003 | REQ-CON-012; REQ-SHR-005 / NFR-A11Y-001 | On long desktop/mobile drafts, operate Save using pointer/keyboard and observe adjacent pending/success/validation/failure/conflict/uncertain feedback without scrolling to the top. Duplicate clicks produce one pending request. Focused fields/errors remain unobscured, workspace scroll remains independent, and reduced motion is respected. Test version conflict, failed post-save reconciliation and session expiry; manual recovery and entered content remain usable within authorization. |
| AC-CON-UX-004 | REQ-CON-013; REQ-CON-010 | At list/create/detail/edit, inspect a single meaningful h1 and logical heading sequence; traverse breadcrumb links using keyboard. Dirty editor exits require one stay/leave decision; clean navigation does not. Long loaded draft titles remain available to assistive technology and fit at 375px, 768px and desktop without another draft fetch. |
| AC-CON-UX-005 | REQ-CON-014 | Activate a draft row away from its title, by keyboard and by modified/new-tab navigation. The real link covers its primary region and reaches existing detail; accessible name identifies the draft, focus is visible and no nested control exists. |
| AC-CON-UX-006 | REQ-CON-015; REQ-CON-010/012 | On long drafts, jump to each named section by pointer/keyboard at mobile/tablet/desktop and enlarged text. Correct section focus/content clears the actual sticky Save area; only workspace scroll changes. URL/router history does not gain untracked entries, dirty state remains, and later browser Back still guards. Field validation still focuses the correct visible control. |
| AC-CON-UX-007 | REQ-CON-016; REQ-SHR-005 / NFR-A11Y-001 | Inspect task-oriented field hints with unchanged limits and correct described-by/error references. Verify compact task-visible mobile topbar, drawer Escape/focus/background protection, usable controls, no horizontal overflow at 375/768/desktop and text enlargement. The unfocused skip link stays fully offscreen regardless of text height and remains usable when focused. Exercise validation,409,5xx/network uncertainty, successful-PATCH/readback failure and reload/discard, including375px with200% text and error feedback: wording remains truthful, Save stays reachable and section links/fields remain operable without a viewport-filling sticky feedback area. Phase1 guard/reconciliation/duplicate/session behavior remains intact. |
| AC-CON-UX-008 | REQ-CON-017; REQ-CON-010–016; REQ-SHR-005 / NFR-A11Y-001 | Compare identical before/after fixtures at375/768/1440px: list/action move closer, empty state is compact, page count reflects loaded pagination and loading/error never imply zero or a total. Inspect login, list, create, detail, editor, implemented role landings, loading/error and not-found for consistent surfaces, type, spacing and action hierarchy. Verify keyboard focus, hover/pressed/disabled states, drawer, independent main scrolling, section/Save/error clearance, long patch usability,200% text/reflow and reduced motion. Re-run Phase1/2 guards/save/recovery checks; investigate criterion/evidence row focus timing without arbitrary sleeps or weakened assertions. Screenshots/scanners are bounded evidence, not full accessibility certification. |

## Proposed creation shortcut — not approved or implemented

PROP-CON-001 proposes opening `/contributor/drafts/:id/edit` after a confirmed
successful creation, with textual creation feedback and a route back to saved
detail. REQ-CON-001 permits creating an owned DRAFT without prescribing its next
screen, so this is compatible with storage/authorization requirements; current
guides/tests intentionally open detail and would need coordinated updates.
The benefit is one fewer action before adding criteria/patch/evidence. A trade-off
is losing the immediate saved-detail review step. This proposal requires explicit
user approval; Phase2 preserves the existing detail destination.

Proposed acceptance (future, inactive): create once, verify saved ID/version and
open that editor only after confirmed success; announce creation, retain the safe
create-guard release and all uncertainty/duplicate/session behavior, allow detail
inspection, and never redirect on failed or uncertain creation. No implementation
or completion is claimed by this proposal.

## Approved draft deletion policy

The owner may delete only a never-submitted DRAFT, after confirmation. Delete working content and retain a minimal non-content audit tombstone with actor, proposal ID, action and timestamp; no diff, draft text or credentials remain in the tombstone. Submitted proposals cannot be deleted and instead use withdrawal with history preserved. Withdrawing a draft keeps a terminal WITHDRAWN record; deletion is a separate action.

A saved but unsubmitted revision of an already submitted proposal is not permission to delete its submission history. Criterion/finding/response and evidence limits are centralized in [integration](INTEGRATION-SPEC.md#input-limits).
