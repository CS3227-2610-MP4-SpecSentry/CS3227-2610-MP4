# Release Maintainer specification

Baseline: 25 October 2026. Normative design; implementation evidence is tracked in [traceability](../TRACEABILITY.md).

[Product index](PRODUCT-SPEC.md) | [Open decisions](OPEN-DECISIONS.md)

## Requirements

| **ID** | **Capability** | **Acceptance criteria** |
| --- | --- | --- |
| REQ-REL-001 | Release candidate | A Release Maintainer can create one or more release candidates and add only APPROVED proposals that are not attached to another open candidate. Only the candidate creator/responsible Maintainer may edit membership or candidate fields; other Maintainers have read access. |
| REQ-REL-002 | Deterministic gates | Readiness requires every item to retain approval against its latest submitted revision, all required criteria covered, no unresolved HIGH or CRITICAL finding, a rollback note, and a successful Maintainer release smoke-test record. Contributor evidence is optional plain text and has no type, mandatory flag, or pass/fail status; it is not an automated gate. The separate release smoke-test record remains a Maintainer release requirement. |
| REQ-REL-003 | AI readiness summary | The assistant receives structured item summaries and gate statuses, not raw credentials or unrelated source. It returns blockers, dependencies, release notes, rollback considerations, and confidence. |
| REQ-REL-004 | Publish release | Only a Release Maintainer may publish. The server reevaluates every gate in one transaction, snapshots the evidence, assigns a unique release version, and records the action. Only the responsible Maintainer may publish. Candidate must contain at least one item; version is a project-unique major.minor.patch label with nonnegative integers and no prerelease/build suffix. |
| REQ-REL-005 | Post-release record | Released records are immutable. A correction creates an append-only annotation and cannot rewrite the original decision or evidence snapshot. |
| REQ-REL-006 | Audit view | The Maintainer can filter audit events by actor, proposal, release, action, date, and outcome, but raw LLM prompts and secrets are never displayed. |
| REQ-REL-007 | Candidate responsibility and revocation notice | Each candidate has a responsible Release Maintainer, initially its creator (createdBy). A member approval revocation creates a durable in-app notification for that Maintainer and a visible blocker on candidate detail. Opening the affected candidate marks the notice read but does not clear the blocker. The item stays attached until the Maintainer explicitly removes it; a notification or acknowledgement never restores approval. |
| REQ-REL-008 | Publication and revocation race | Publication and approval revocation use shared transactional locking or equivalent version checks on candidate and member approvals so both cannot succeed against the same stale approved state. If revocation wins, publication is blocked. If publication wins, the candidate/items become RELEASED and revocation is rejected without altering the release snapshot. |

### Release Candidate States

| **State** | **Meaning and permitted behavior** | **Next state** |
| --- | --- | --- |
| OPEN | Responsible Maintainer may edit candidate details and add/remove items. Readiness is computed from current deterministic gates; revocation leaves the candidate OPEN with a visible blocker. Publication requires every gate to pass. | RELEASED |
| RELEASED | Published immutable release record and member snapshots. Approval revocation, membership edits, and reopening are forbidden; corrections use append-only annotations under REQ-REL-005. | None |

Readiness is computed rather than persisted as a separate READY state, so revocation cannot leave a stale ready flag. OPEN is the definition of an open candidate throughout this specification. An IN_RELEASE item's review approval remains a separate gate from its proposal lifecycle state.

## UI and use cases

- Candidate list/detail shows responsible Maintainer, OPEN/RELEASED status, selected revision identities, current gate results, rollback note and smoke-test record. Blockers are textual and do not depend on color.
- Add/remove actions operate only on eligible items; submitted plain-text evidence is read-only and has no pass/fail classification. Approval revocation remains a visible blocker while the item is attached.
- Notifications identify affected candidate/proposal, reviewer and reason. Opening the candidate marks the notice read without restoring readiness.
- Publish is an explicit human action. Successful publication shows the unique version and immutable snapshot; a concurrent revocation produces a failed gate/conflict instead of a partially published release.
- Audit filters expose only authorized safe metadata. Released corrections append annotations without editing the original evidence or decision.

Primary flow: create OPEN candidate, select approved revisions, record rollback and release smoke-test information, inspect deterministic gates, optionally request advisory AI summary, and publish. Failure paths include revoked approvals, another candidate owning an item, stale membership/version and publication/revocation races. The approved release validation defaults below define smoke-test/version/ownership behavior.

## Acceptance scenarios

Each case is a verification obligation derived from the referenced requirement, not an executed test. Expand conjunctions into independent cases in implementation. Shared denial, failure, accessibility and version rules also apply.

| Scenario | Requirement | Setup/action and observable result |
| --- | --- | --- |
| AC-REL-001 | REQ-REL-001 | Try to add an unapproved item or one in another OPEN candidate; reject without changing either candidate. |
| AC-REL-002 | REQ-REL-002 | Test every gate independently, including revoked approval and required coverage. Missing optional Contributor evidence is not a blocker. |
| AC-REL-003 | REQ-REL-003 | Get advisory readiness output with failed deterministic gate; gate remains failed and publication remains blocked. |
| AC-REL-004 | REQ-REL-004 | Publish with all gates passing; one version and immutable snapshot result. Inject persistence failure; no partial publication survives. |
| AC-REL-005 | REQ-REL-005 | Annotate released record; original decision and snapshot are unchanged. |
| AC-REL-006 | REQ-REL-006 | Filter audit by actor/target/action/date/outcome; raw prompts and secrets never appear. |
| AC-REL-007 | REQ-REL-007 | Revoke member approval; creator receives durable notice, item stays attached, opening notice does not clear blocker. |
| AC-REL-008 | REQ-REL-008 | Exercise both transaction orderings: revocation first prevents publish; publication first prevents revoke. |

## Approved release validation defaults

A candidate smoke-test record contains performer (current responsible Maintainer), server timestamp, tested candidate-content version, non-empty plain-text procedure/results, and explicit PASS or FAIL. This structured release record is distinct from optional plain-text Contributor evidence. Membership or included-revision changes increment candidate-content version and invalidate earlier smoke tests. Readiness requires PASS against the current content version and all other deterministic gates. Approval revocation independently blocks readiness; reading a notification never restores it.

Dependency notes are advisory plain text in this release; no dependency graph or automatic dependency-resolution gate is required. Versions are unique within the single project; reject empty publication and duplicate version labels atomically. Candidate responsibility remains with its creator; no transfer/admin UI is introduced.

Another Maintainer cannot edit or publish a candidate by direct API request. An invalidated smoke test remains in history, but cannot satisfy current gates. After a revoked item is removed, the content change requires a new passing smoke test.
