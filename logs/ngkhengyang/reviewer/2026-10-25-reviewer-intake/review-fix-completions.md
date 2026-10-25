# Independent review owner fixes

## Backend F-004 — backend-fix-1

Changed reviews.controller.ts, module comment, reviews.spec.ts and reviews.integration.ts only. Guard-following controller parse boundary writes one restricted event with server actor, fixed operation/route-family target, correlation and rejected outcome. Service authorization errors remain outside the validation catch, avoiding double audit. No raw body/ID/query/cursor values or timeline entries. Failed-before regression observed zero audit events instead of one. Passed-after HTTP and actual DB tests cover malformed fields, secret exclusion, no services/business changes/activity, valid requests and singly audited service conflicts. Server32tests/PG31tests, typecheck/lint/diffcheck pass. Test database cleaned/released. Nonfatal pg concurrent-query deprecation retained. Selected gpt-6.1-sol/high; coordinator rec-8b3eb14a3a2b4b0f; tokens/cache unavailable.

## Frontend F-005/F-006 — frontend-fix-2 attempt1

Changed ReviewerWorkspace.tsx and tests only. Explicit mutation lock preserves claim/drop pending state and rejects duplicate commands/focus supersession; queue/proposal navigation clears obsolete pagination pending. History/activity focus regressions failed before and pass after; activity context labels regression failed before and passes after. Visible proposal/revision/assignment/outcome fields use existing allowlisted API fields. Client34tests/typecheck/scopedlint pass. Main requested additional focused pagination focus-denial/error tests under separately recorded attempt2; no runtime counters estimated. Attempt1 coordinator rec-a732c9256f1a4df7, selected gpt-6.1-sol/medium.

## Frontend F-005 additional failure coverage — attempt2

Only ReviewerWorkspace.test.tsx changed. Four parameterized cases (history/activity × focus403/500) passed; scoped ESLint passed. Held nextpage JSON is released after denial/error; stale page and private detail remain absent, no stuck pending, Refresh queue/Review pool enabled and actual navigation works. No additional production change needed. Client suite now has38tests; combined run pending. Coordinator rec-359f21f1f3394309; gpt-6.1-sol/medium; token/cache unavailable.
