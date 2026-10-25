# Independent implementation review — reviewer-1, attempt 2

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
