# Draft detail action spacing

## Request and scope

Prompter: yooplo, inferred from Git identity. Source baseline: `3e7f90d`.
User requested presentation-only refinement: group Submit/Withdraw with larger
consistent gaps, retain primary Submit, secondary Withdraw, separate destructive
Delete, and stack comfortably on mobile. Preserve handlers and behavior.
Human verification of this AI summary remains pending.

Applies REQ-CON-017, REQ-SHR-005 and existing lifecycle/deletion protections.
Acceptance: spaced grouped actions on desktop; full-width stacked actions on
narrow screens; distinct destructive row; targets at least 44px; unchanged
confirmation/cancel/disabled behavior and keyboard sequence. No API, dependency,
authorization, persistence or lifecycle changes are authorized or needed.

## Assignments

- Main: scoped design documentation, coordination and evidence. Resource interval
  `c5de075a4fd04906a860625acfe1af11` started before edits/dispatch.
- spacing_implementer: only ContributorWorkspace.tsx, SubmittedProposal.tsx and
  styles.css; reuse tokens/secondary style, preserve all event logic.
- spacing_verifier: independent desktop/mobile browser fixture checks, focused
  existing tests and typecheck; isolated synthetic network routing, no real data
  mutations. Own temporary scripts and safe verification evidence only.

Security review is not dispatched: this change touches presentation wrappers and
classes only, with no trust-boundary or sensitive-data handling changes. Independent
verification will check that event behavior and confirmation protections remain.

## Results

Completed with three source files: ContributorWorkspace.tsx adds a separate Delete
row; SubmittedProposal.tsx groups lifecycle buttons and makes Withdraw secondary;
styles.css uses16px group gaps and24px destructive separation, stacking below768px.
All event handlers, refs, conditionals, disabled rules and forms remain unchanged.
Shared submitted ProposalActions receives the same consistent spacing/hierarchy.
UI-UX-SPEC section D documents the refinement; TRACEABILITY links this evidence.

Independent verifier passed56existing lifecycle/deletion tests and client typecheck.
Main root lint and whitespace checks passed. Chrome at1440/768/375px passed measured
spacing, hierarchy, keyboard sequence, confirmation opening/cancellation and focus
checks, with zero business mutations/page errors. Mobile buttons measured333x44px;
desktop/tablet gaps16px, Delete separation24px. Main also visually inspected desktop
and mobile screenshots. No blockers found.

- [Independent report](resources/2026-11-02-draft-action-spacing/verification/independent-verification.md)
- [Browser measurements](resources/2026-11-02-draft-action-spacing/verification/browser-results.json)
- [Reproducible browser check](resources/2026-11-02-draft-action-spacing/verification/check-layout.mjs)
- [Desktop screenshot](resources/2026-11-02-draft-action-spacing/verification/draft-actions-1440.png)
- [Mobile screenshot](resources/2026-11-02-draft-action-spacing/verification/draft-actions-375.png)

Browser checks used isolated synthetic API routes on the actual frontend; no real
data mutation, full-suite rerun, deployment or manual-device/accessibility
certification. No dependencies, backend, credentials or unrelated source changed.
Changes remain uncommitted; no push/deployment.

## Resources

Records: [session directory](resources/2026-11-02-draft-action-spacing).
Exact runtime model/effort and per-record usage telemetry unavailable. Initial
read-only instruction/source lookup and final rendering are outside measured time.

Resource closure: all three intervals succeeded, zero unfinished records. Main wall interval154.776s; summed overlapping agent intervals273.422s, not compute time. [Resource report](resources/2026-11-02-draft-action-spacing/verification/resource-report.md).

## Commit authorization

User subsequently requested committing the changes. Reviewed status shows only
this layout refinement, its specification/traceability and safe evidence. Prior
tests remain applicable; whitespace validation passed again. Stage this explicit
file set only; local secrets/configuration are excluded. No push authorized.
The additional resource interval records commit preparation; Git commit execution
and final response occur after measurement closure so finalized records can be
included in the same commit. Commit success is reported from actual Git output.
