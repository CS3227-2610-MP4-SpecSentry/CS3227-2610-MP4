# Increment 3 independent acceptance-test design

Derived independently by inc3_acceptance_plan against HEAD1de749c; coordinator persists the read-only report. These are proposed tests, not executable tests or passing evidence. [Brief](2026-10-28-contributor-increment-3-brief.md) owns requirements, dependency status and proposed shared decisions; [run](2026-10-28-contributor-increment-3-planning.md) owns dispatch/resources and findings. Authoritative deletion scenario is AC-DEC-009 (deletion portion), with AC-SHR-001/002/003/004/005/007 and applicable reliability/security/accessibility cases. No reason required.

Subsequent [implementation run](2026-10-28-contributor-increment-3-run.md) records yooplo's clarification that both teammates agreed to the brief and current implementation authorization. Findings below remain the original independent design checkpoint; no gate is declared verified fixed by agreement alone. Final executed test coverage and any unavailable cases belong in that implementation run.

## Independent gates

| Finding | Severity / status | Evidence and required decision / recheck |
| --- | --- | --- |
| INC3-ACC-001 | High, blocks dependent implementation | Existing DRAFT_CREATED/SAVED activity has RESTRICT proposal FK and unconditional append-only trigger (reviewer_intake SQL181,263); no ordinary root deletion can succeed. Coordinate narrowly bounded private activity cleanup and check submitted activity remains immutable |
| INC3-ACC-002 | Medium, coordination gate | No DraftTombstone table or delete DTO. SecurityEvent includes extra fields/operational90-day retention; confirm separate durable minimal storage, action name, retention and migration owner. Exact storage assertions wait for agreement |
| INC3-ACC-003 | Low, unresolved proposed boundary | reviewerVersionSchema accepts0 through2147483647; nextVersion rejects increment at maximum. Recommend accepting exact maximum on hard delete without increment; confirm then test. Over-limit remains422 |

## Proposed cases

All database cases use a migrated disposable UTC database, synthetic distinct owners A/B plus Reviewer/Maintainer sessions, existing account/session helpers and actual root locking. Snapshot root, working JSON, private activity and submitted graph before each rejected/fault case. Inspect content markers and exact tombstone columns with restricted test SQL, not a new product tombstone-read API. No disabling immutable triggers for fixtures or cleanup. Retain synthetic immutable evidence until disposal of the test database.

| ID / requirements | Fixture/request/interleaving | Expected observable result |
| --- | --- | --- |
| D01 / AC-DEC-009, SHR004/007 | A creates and saves full-content draft with distinctive title/narrative/summary/diff/criterion/evidence markers; DELETE current version,true |204 empty body; working and root gone under agreed cleanup; owner list excludes it; detail/save404; one server actor/time tombstone; unrelated proposal unchanged |
| D02 / AC-DEC-009 | Inspect D01 retained business storage | Exactly proposalId,actorId,action,timestamp in tombstone; no content/hash/summary/reason/owner copy/version/correlation/session/credential. No leaked shared timeline; operational audit stays separate under its policy |
| D03 / confirmation | Open UI confirmation, cancel; raw API missing/false/string confirmed | Opening/cancel makes no mutation; invalid API422; unchanged root/content/activity, zero tombstones |
| D04 / strict integration input | Missing/negative/fractional/string/null/>max version; malformed ID; extra actor/owner/state/time/reason/content |422 safe envelope; no business changes or payload dump; ordinary opaque-ID validation reused |
| D05 / SHR001/002 | Anonymous/expired/logout/disabled/stale account; B/Reviewer/Maintainer direct DELETE A | Invalid auth401, authenticated non-owner/role403; zero deletion/tombstone and no protected content; safe restricted rejection evidence |
| D06 / NFR-SEC-001 | Owner with missing/wrong/malformed CSRF |403; no business change |
| D07 / absent object | Authorized request nonexistent opaque ID |404 safe envelope; no tombstone/access grant |
| D08 / deletion eligibility | Each non-DRAFT state while WorkingRevision exists |409; complete submitted and working graph/history preserved; no withdrawal performed |
| D09 / immutable history | DRAFT with firstSubmittedAt; DRAFT with currentRevisionId; DRAFT with both null but actual historical ProposalRevision |409; real history preserved. Construct legal disposable fixtures without dropping guards; working row never proves never-submitted |
| D10 / graph defenses | Attachment/current assignment/unexpected linked submission/review/notification/idempotency data | Fail closed without cascade, cleanup or raw DB detail; exact inconsistent-record error mapping agreed before assertions |
| D11 / SHR003 | Read v0; another save commits v1; delete v0 |409; v1 intact, no deletion tombstone; UI preserves display and does not silently use v1 |
| D12 / version bounds | Matching0, matching2147483647, >max |0 succeeds; exact max follows INC3-ACC-003 decision; >max422, no overflow |
| D13 / edit wins | Real account/root lock barrier: save v0→v1 before delete check | Delete409; winning edit content/event intact; no tombstone |
| D14 / delete wins vs edit | Delete holds lock and commits before queued save | One deletion; save404 safely; no recreation/orphan working content |
| D15 / duplicate | Concurrent same-version confirmed deletes from two sessions, then repeat | One204 and one tombstone; loser/repeat proposed404. No automatic replay204 or extra idempotency platform; confirm mapping |
| D16 / submit wins | Locked fixture commits submitted revision/state/version before delete check | Delete409; immutable snapshot/history preserved. Actual Contributor submit endpoint unavailable: fixture is structural evidence only, not real submit integration |
| D17 / delete wins vs submit | Delete commits before queued simulated/future submit | Submit sees absent root and cannot create orphan revision or reconstruct working row. Rerun against production submit path when available |
| D18 / NFR-REL-001 | Inject tombstone failure; failure after working removal; activity/root deletion failure | Full pre-delete root/content/activity restored, zero committed tombstone; safe rejection audit may be separate. No early204 |
| D19 / auth lock races | Logout/disable while deletion waits; persisted session expiry at transaction end |401 and total rollback; use observed pg_blocking_pids row-lock barriers, not timing alone |
| D20 / uncertain recovery | Commit then lose response; separately failure before commit; fail reconciliation | No blind DELETE retry or definite success claim. Explicit authorized GET: found→current content/version+fresh confirmation;404→unavailable/list recovery, not attribution; failed recheck remains blocked |
| D21 / pending/error | Deferred request;403/409/422/500/malformed error body | One mutation per confirmation; textual pending/errors; duplicate controls disabled; safe correlation when supplied; current content retained for actionable failure.500/network treated uncertain; no newer-version retry |
| D22 / callback scope | A→B route before late response; replace login before late204/401; current-login401 after route unmount | Old route cannot clear/navigate B; obsolete authentication cannot invalidate replacement; genuine current-session401 still invokes current auth guard. Preserve inherited App regression assertions |
| D23 / SHR005, NFR-A11Y-001 | Keyboard open/cancel/confirm; focus/labels/status; axe, zoom/reflow | Explicit consequence/target; safe initial focus, restore cancel focus, useful focus/status after navigation; visible focus, text states, escaped title; cancel preserves content |
| D24 / SHR004/007 | Direct SQL UPDATE/DELETE tombstone/submitted activity/evidence; regress create/list/read/save | Tombstone/submitted guards still reject changes; cleanup exception cannot cover submitted or historical root; privacy/session/edit tests remain unchanged |

Use deterministic lock barriers for both schedules rather than Promise.all alone; tests should prove blocked/check ordering and committed graph, not just HTTP status. Add direct attempts to misuse the eventual private cleanup guard (missing tombstone, submitted root, nonallowlisted activity, partial transaction) once its actual agreed interface exists. Proposed implementation-specific case labels D01–D24 supplement existing requirement IDs; they do not add new product requirements.

## Future test ownership and commands

One test writer per file. Agreed implementer/shared owner can add strict DTO validation tests using existing server/shared test convention; independent verifier owns targeted additions to `src/server/test/contributor-drafts.integration.ts`, new `src/client/src/features/contributor/DeleteDraft.test.tsx` and new `workflow/tests/browser/contributor-deletion.spec.ts`. Replace only current DELETE404 unavailable-action assertion, preserve submit/withdraw/reopen404. Persistence owner adds migration/guard integrity tests in agreed existing integration test layout. Coordinator alone owns shared logs/guides/traceability; verifier reviews actual claims, no product fixes.

Commands discovered from package files and CI; **not executed in this planning run**:

```powershell
npm run db:validate
npm run db:generate
npm run db:migrate:deploy
npm run test:integration -w @specsentry/server -- --runTestsByPath test/contributor-drafts.integration.ts
npm run test -w @specsentry/client -- src/features/contributor/DeleteDraft.test.tsx
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build
npm run test:e2e -- workflow/tests/browser/contributor-deletion.spec.ts --project=chromium
git diff --check
```

Prerequisites: supported locked Node/npm dependencies; generated Prisma; reviewed clean and upgrade migration paths on explicitly disposable database (never production); TEST_DATABASE_URL plus migration URL settings from repository configuration; verify database default/session UTC after reconnect; Chromium installed; built server/client for Playwright; free port3000 (reuseExistingServer:false), synthetic authenticated accounts. Environment URLs/credentials must stay out of committed evidence. After implementation, execute proportional targeted tests, then required CI/regression checks; do not claim planned commands passed. Full manual WCAG/deployment/performance/real future submission integration remain separate unavailable evidence until run.

Next authorized action: confirm shared storage/cleanup decisions and review the plan. This design does not authorize implementation or certify deletion behavior.
