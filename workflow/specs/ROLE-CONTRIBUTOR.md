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

## Approved draft deletion policy

The owner may delete only a never-submitted DRAFT, after confirmation. Delete working content and retain a minimal non-content audit tombstone with actor, proposal ID, action and timestamp; no diff, draft text or credentials remain in the tombstone. Submitted proposals cannot be deleted and instead use withdrawal with history preserved. Withdrawing a draft keeps a terminal WITHDRAWN record; deletion is a separate action.

A saved but unsubmitted revision of an already submitted proposal is not permission to delete its submission history. Criterion/finding/response and evidence limits are centralized in [integration](INTEGRATION-SPEC.md#input-limits).
