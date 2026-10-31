# Review and rework history

Historical assessments below refer to their original named snapshot IDs. Their manifests were retired during cleanup; IDs, dates and hashes remain in state.json. Final dispositions are in the retained final independent reports.

## Design and environment history

F-001 session-generation and F-002 bounded revision history were resolved in design v2, reopened to verify implementation, then independently closed against the final reviewed state. Both initial independent review attempts were interrupted by usage limits; their measurements remain in resources.json. No reports were fabricated for those attempts.

Two broad snapshots mistakenly captured dependencies/build caches. Cache changes invalidated one handoff; narrow source scopes replaced them. Main initially misread snapshot hash metadata during diagnosis, corrected the comparison, and confirmed source was unchanged. These retired manifests are not needed for final-state traceability.

Foundation recovered one lint issue, two fixture assertions that encountered uniqueness before the intended foreign-key check, and sandbox build access. Isolated PostgreSQL/Chromium setup and sandbox recovery were part of this first run; no application database was modified.

# Independent implementation review â€” reviewer-1, attempt 2

Acceptance blocked by F-005 and F-006, plus security-owned F-004. F-003 independently accepted. Read-only assessment of review-state-1, base 99e1cc4f4c6c96010c50f0b99b9a24160eb951a1 plus tracked/untracked changes. Applied specification review and Reviewer handoff skills. No repository file writes or database access. Invocation-local safe.directory resolved initial Git ownership denial without a configuration change.

| Criterion | Evidence independently inspected | Result |
| --- | --- | --- |
| INT-01 | Controller role guard, locked account/version check, HTTP role/anonymous matrix and real authenticated flow | Covered |
| INT-02 | Explicit server selects, DTO mapping and strict schemas; projection tests | Covered |
| INT-03 | Owner/state/age SQL scope, original age, timestamp/ID order, scoped cursor and client filters | Covered; approved severity exclusion retained |
| INT-04 | Account/root lock, version/state checks, transactional assignment/activity and DB uniqueness; real concurrent claim test | Covered |
| INT-05 | Assignee check before detail, same-proposal selector, bounded summaries; foreign-ID/history/revoked-page tests | Covered |
| INT-06 | Preserved closed assignments, incremented versions, state transitions and atomic activity; drop/takeover tests | Covered |
| INT-07 | Strict drop identity/revision/version, frozen-state and same-reviewer ABA/overflow tests | Covered |
| INT-08 | Disable and sorted-root release in same transaction; account/session recheck, DB race/rollback cases | Covered for intake; no effective-approval claim |
| INT-09 | Append-only triggers, activity allowlist/order/50-entry pages/reauthorization and retention tests | Blocked by F-006 UI context omission and security F-004 audit gap |
| INT-10 | Authorization generations, post-parse/unmount checks, focus refresh, client race matrix and browser keyboard/axe | F-003 accepted; blocked by F-005 |
| INT-11 | Strict Zod/limits/cursors, code-point/evidence bounds, guarded transactional seed and large HTTP fixture | Covered at contract/DOM level; full visual/performance acceptance excluded |

F-003 closure: explicit initial-load intent is consumed by synchronous navigation before deferred initialization; callback also checks active state and captured authorization/local generations. Independently ran existing regression keeps assignment navigation: one passed, nine skipped, exit0, via node .tools/package/bin/npm-cli.js run test -w @specsentry/client -- src/features/reviewer/ReviewerWorkspace.test.tsx -t keeps assignment navigation.

F-005 MEDIUM, frontend, blocks INT-10/SHR005: more() sets pending; finally clears only if its local generation is current. Window focus invokes open(), changes generation without resetting/transferring pending. Holding a next-history/activity JSON body, dispatching focus and completing new reads, then releasing old body leaves pending=true; refresh/drop/queue controls disabled. Independent in-memory TypeScript/React/jsdom execution reproduced all four booleans true. Require deterministic history AND activity cases across focus success and denial/error, usable controls afterward, obsolete operations cannot clear newer pending work.

F-006 MEDIUM, frontend, blocks INT-09/SHR007: timeline render omits API revisionId/assignmentId/outcome; shows only time/actor/action/summary/reason. Identical events on different revisions lack required attribution/outcome. Render authorized revision/entity and success outcome in understandable text; test distinct revisions and optional assignment, reauthorize any added links.

Independent probe rendered exactly100000 diff and50000 evidence characters and verified both pre node lengths; this proves no DOM truncation, not visual/zoom/fullWCAG. Probe preparation corrected two harness assumptions (nonexistent .tools/bin/node.exe and omitted ?revisionId mock path); not product failures. Existing HTTP/DB/browser tests inspected and result artifacts read; no broad reruns or new DB/browser claims. Scope excludes Contributor writes, findings/coverage/decisions, notifications, AI, effective approvals and releases.

Next: original owners fix F004/F005/F006; main freezes new state, reruns affected checks and requests independent revalidation. Selected gpt-6-astra/high; coordinator record rec-b2fcc472ab894729 includes dispatch/wait/report; token/cache/final runtime counters and observed execution settings unavailable, not estimated.


# Frontend fix completion â€” F-003

Frontend/frontend-fix-1, selected gpt-6.1-sol/medium, changed only ReviewerWorkspace.tsx, ReviewerWorkspace.test.tsx and App.test.tsx. Deterministically reproduced obsolete initial pool loading after assigned navigation and replacing the newer user action. Capturing generation only inside the mount effect was insufficient and a root rerun still failed two tests. Explicit initialLoadNeeded intent is now consumed by queue/proposal actions even before effect setup; the deferred task checks intent and authorization/local generation. New regression failed before fix and passed after. Expiry matrix awaits held JSON-parser barrier and resolves delayed bodies in act without removing assertions.

Final whole rootnpmtest: sharedbuild/backend30/client30 passed; scopedESLint and clienttypecheck pass. Initial sandbox build failure required approved benign escalation, no config workaround. One final newline in changed files. No DB/browser/server/schema/contracts/log edits. Main independent closure remains pending. Coordinator record rec-1efe6d306f42492e; tokens/cache/final-runtime counters unavailable.


# Independent review owner fixes

## Backend F-004 â€” backend-fix-1

Changed reviews.controller.ts, module comment, reviews.spec.ts and reviews.integration.ts only. Guard-following controller parse boundary writes one restricted event with server actor, fixed operation/route-family target, correlation and rejected outcome. Service authorization errors remain outside the validation catch, avoiding double audit. No raw body/ID/query/cursor values or timeline entries. Failed-before regression observed zero audit events instead of one. Passed-after HTTP and actual DB tests cover malformed fields, secret exclusion, no services/business changes/activity, valid requests and singly audited service conflicts. Server32tests/PG31tests, typecheck/lint/diffcheck pass. Test database cleaned/released. Nonfatal pg concurrent-query deprecation retained. Selected gpt-6.1-sol/high; coordinator rec-8b3eb14a3a2b4b0f; tokens/cache unavailable.

## Frontend F-005/F-006 â€” frontend-fix-2 attempt1

Changed ReviewerWorkspace.tsx and tests only. Explicit mutation lock preserves claim/drop pending state and rejects duplicate commands/focus supersession; queue/proposal navigation clears obsolete pagination pending. History/activity focus regressions failed before and pass after; activity context labels regression failed before and passes after. Visible proposal/revision/assignment/outcome fields use existing allowlisted API fields. Client34tests/typecheck/scopedlint pass. Main requested additional focused pagination focus-denial/error tests under separately recorded attempt2; no runtime counters estimated. Attempt1 coordinator rec-a732c9256f1a4df7, selected gpt-6.1-sol/medium.

## Frontend F-005 additional failure coverage â€” attempt2

Only ReviewerWorkspace.test.tsx changed. Four parameterized cases (history/activity Ã— focus403/500) passed; scoped ESLint passed. Held nextpage JSON is released after denial/error; stale page and private detail remain absent, no stuck pending, Refresh queue/Review pool enabled and actual navigation works. No additional production change needed. Client suite now has38tests; combined run pending. Coordinator rec-359f21f1f3394309; gpt-6.1-sol/medium; token/cache unavailable.
