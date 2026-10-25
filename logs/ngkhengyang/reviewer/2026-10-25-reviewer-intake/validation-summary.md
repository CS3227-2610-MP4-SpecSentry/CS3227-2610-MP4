# Integrated validation before independent review

Base99e1cc4f4c6c96010c50f0b99b9a24160eb951a1; stable integrated-source-2 pins actual source/config/tests, backend-validation-1 independently pins unchanged backend/shared inputs. Environment: Node24.19.0/npm12.2.1, isolated PostgreSQL16.6 loopback, pinned Playwright1.64.1 Chromium156.0.8078.4. No application DB or production provider used.

Recorded commands all PASS: typecheck-2 (allworkspaces), lint-2, unit-client-2 (30backend unit/HTTP,30client), postgresql-1 (5suites30tests), build-1 (allworkspaces), browser-1 (5Chromiumtests, two-Reviewer intake + existing3roleauth/loginaxe). Safe stdout/stderr JSON artifacts live in commands/. Initial unit-client-1 failed two expiry cases; F-003 initial-load intent race reproduced/fixed and new regression added. Failed and obsolete checks retained with explicit supersession.

Acceptance mapping: INT-01 authentication/roles/CSRF through reviews.spec.ts and realHTTP integration; INT-02/03 projections/filters/order/paging/ages; INT-04 concurrent claim; INT-05/06/07 currentassignee/history/foreignID/drop/ABA and statefreezes; INT-08 disable races/sessionversion/assignmentwrite+activityrollback/frozen noninterference; INT-09 safe ordered activity/retention/immutability; INT-10 client matrix plus Chromium claim/history/drop/takeover/denials/escapedtext/focus/axe and F-003 regression; INT-11 strict wire/cursor/limits/large manual context, fixture production refusal/rerun/rollback. Test names in reviews.integration.ts explicitly identify corresponding INT cases.

Scoped exclusions remain: Contributor writes, findings/coverage/decisions, notification acknowledgement, AI and releases. Full severity filter, effective approval integration, fullperformance/deployed/allroleaccessibility acceptance remain pending. No fullrequirement completion or deployment claim.

Independent review must inspect code and derive checks; summaries are navigation aids only. F-003 awaits implementation-reviewer closure. Prior design DS-001/F-001 and DS-002/F-002 need fresh current-implementation security revalidation because old snapshot included nowchanged source; design decisions themselves are retained.
