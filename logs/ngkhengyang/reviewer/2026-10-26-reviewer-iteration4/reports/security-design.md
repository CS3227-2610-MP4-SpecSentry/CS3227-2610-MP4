# Independent security design assessment and disposition

Scope: Reviewer iteration 4 preparation only. Baseline `9556b72b5cce9da8df0b40887c8ba816cccdaaf8`. Coordinator persists read-only reviewers' returned findings; no source or test changes were made by either reviewer.

| Attempt | Actual agent/chat | Selected settings | Result |
| --- | --- | --- | --- |
| Initial review | `/root/security_design`, `01a178d7-0f6d-7ca2-8b30-54a45781639c` | gpt-6.1-sol/high | Partial SEC-I4-001 returned, then model capacity failure; `rec-4d2056abe9ad4820` failed |
| Full independent retry | `/root/security_retry`, `01a178da-0c8e-7490-aa0c-c1f8e98d6eed` | gpt-6-sol/high | Three controls assessed; earlier v3 hash `BC33ED972B1C9B7E7B2214DEF912873DC4C8026DAC06995B2C79D2A7F49D0C57` passed design with matrix/wording follow-up; `rec-297e2377dfb24aec` succeeded |
| Focused final recheck | Same retry agent/chat | gpt-6-sol/high | Final brief and49-case matrix independently confirmed; `rec-336587cf3be5418d` succeeded |

Final brief SHA-256: `2031C9CA6E3A4A23FCD9573ED99361AACCB8D5706E38ABC6DF4478E81F7C42F0`.
Final matrix SHA-256: `F7B29C9D054A1E0ECB05E1C4C631C40806E20DA3A09966DDA9138A65432D16FF`.

| Finding | Severity; original blocker | Abuse/failure and source | Required control and disposition | Future verification |
| --- | --- | --- | --- | --- |
| SEC-I4-001 | HIGH; yes | Conditional affected-Reviewer account lock on removal allowed disablement to complete while an invalid item stayed IN_RELEASE, releasing nothing, followed by removal into CHANGES_REQUESTED with a disabled assignee. Existing account-administration order is account then proposal. | Removal always pre-resolves and locks affected Reviewer before candidate/proposal; recovery is decided under locks. Closed in final design by independent recheck. Owner: foundation lock contract + release removal. | Barrier-backed disable/removal both orderings; attached disable preserves attachment until removal; unavailable assignment released atomically when now unfinished. |
| SEC-I4-002 | MEDIUM; yes | Candidate GET acknowledgement would bypass existing guard's non-GET CSRF enforcement and let a GET/prefetch silently change readAt. | Side-effect-free GET; application explicitly POSTs exact displayed notification IDs with CSRF and recipient/candidate authorization; read audit in same transaction. Closed in final design. Owner: release notification + UI. | GET leaves markers unchanged; absent/mismatched CSRF and wrong recipient/candidate deny; newer undisplayed notices remain unread. Actual app opening may intentionally issue its own authorized POST. |
| SEC-I4-003 | MEDIUM; yes | Aggregate candidate blockers in Reviewer response/replay could disclose other members' data. | Candidate ID/version and own member invalid-approval blocker only; no other members/aggregate readiness/rollback/dependency/smoke text. After removal ends candidate scope, deny stored attached-result replay even when proposal assignment remains. Closed in final design. Owner: Reviewer response + release projection. | Two-member candidate privacy across direct read, revoke response and replay; candidate-scope loss replay; separately authorized proposal history remains available. |

The final independent endorsement states: **security design gate passes**; no remaining blocker found for the assessed brief/matrix. All cases are planned, not executed. This assessment does not certify implementation or replace code/security re-review after implementation. Source/spec inspection only; reviewers ran no product database/browser checks and authored no implementation. Migration verification still must prove legacy cause/provenance, append-only evidence and that synthetic attachment references are not mistaken for real membership.

References: [brief](../brief.md), [final matrix](../inputs-summary.json#/entries/acceptance-security-v3-final.json), [canonical state](../state.json), [business context](../../../../../src/server/src/identity/business-context.ts), [account disablement](../../../../../src/server/src/identity/account-administration.service.ts), [identity guard](../../../../../src/server/src/identity/identity.guard.ts), [notification controller](../../../../../src/server/src/notifications/notifications.controller.ts), [integration specification](../../../../../workflow/specs/INTEGRATION-SPEC.md).
