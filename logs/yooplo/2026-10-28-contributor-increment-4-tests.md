# Increment 4 independent test design

Independent acceptance specialist derived this matrix against86dc8f2, read-only/no runtime tests. Coordinator persists it. [Brief/run](2026-10-28-contributor-increment-4.md) distinguishes decisions, implementation and executed evidence. Covers only never-submitted REQ-CON-007/009 portions, ownership/version/audit/UI shared requirements. Submitted classification/history/findings scenarios remain deferred.

| Case | Observable check |
| --- | --- |
| Defaults/classification | Omit required in API→persisttrue; new UI rowrequired; optional toggle persists through reload without key change |
| Incomplete collection | Zero/alloptional saves with empty summary/diff succeed; no submission minimum/required gate. Per yooplo decision blank row remains unsaved with retained text/accessibly identified error |
| Boundaries |50 accepted/51rejected,2000Unicode code points accepted/2001rejected,CRLF normalization/astral characters; no truncation |
| New/repeated identity | Keyless new row receives serverkey; matching post-saveGET adopted; repeated unchanged saves retainkey; identical statements may have distinct identities |
| Same meaning | Explicit correction retaining authorized issued key preserves identity after agreed semantic helper change; unchanged/classificationonly retainskey |
| Material rewrite | Explicit replacement omitskey, server issues differentkey; repeated saves retain replacement |
| Removal/re-add | Working item removed; later readd newkey; forging removed/foreign/unknown/duplicatekey422without mutation |
| Role/session | Other owner/roles403; anonymous/invalidsession401; missing/wrongCSRF403; forged mutation fields422, safe errors/no content disclosure |
| Scope/state | Every nonDRAFT, markers/assignment/attachment/actual submittedrevision despite cleared pointers rejected; immutable history/findings untouched |
| Version/races | Stale409/one concurrentwinner; existing edit/delete schedules and tombstone protections stay intact |
| Atomicity | Criteria/classification/version/DRAFT_SAVED together; audit or finalexpiry failure restoresall; no criteriontext in safe summary |
| Reconciliation | Matching GET identity/version adoptskeys; failed/malformed/wrongworking/newerversion GET retainsinput+blocks save, no blindrepeat; committed-save-readfailure distinguished from ambiguousPATCH |
| Recovery | Validation403409422500/network retainrows/choices/input; confirmed reload replacescontent+version; cancel/failedreload preservesinput |
| Callback isolation | Oldproposal/authresponse cannot replace neweditor/login; genuinecurrentsession401still handled |
| Accessibility | Keyboardadd/edit/classify/remove; rowlabels/errors; focusafteradd/remove/validation; pending/status/escapedstatements; axe/reflow |
| Regression | Full existing create/list/detail/narrativeedit/delete/auth/session/failure tests; no deletionmigrationchanges |

Proposed future test writes: existing Contributor contract/integration tests; new working-revisions identity unit test; new CriteriaDraft RTL; browser criterion flow. Implementer owns tests during slice; independent verifier read-only final execution, no product fixes. Coordinator sole docs/log writer.

Discovered commands (planned, not executed by design assignment):

```powershell
npm run test -w @specsentry/server -- --runTestsByPath test/contributor-contracts.spec.ts
npm run test:integration -w @specsentry/server -- --runTestsByPath test/contributor-drafts.integration.ts
npm run test -w @specsentry/client -- src/features/contributor/CriteriaDraft.test.tsx
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build
npm run test:e2e
git diff --check
```

Prerequisites: supported installed Node/npm, generated Prisma, migrated disposable PostgreSQL default/sessionUTC verified after reconnect, explicit test/migration URLs, installedChromium, builtclient/server and freeport3000. Do not commit credentials/fixtures/tooldata or weakenassertions. No production/AI checks. INC2-VER-001 remains unconfirmed/unresolved despite laterpasses.
