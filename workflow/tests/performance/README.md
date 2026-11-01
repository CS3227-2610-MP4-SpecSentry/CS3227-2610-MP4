# Seeded non-AI request performance

`contributor-workload.mjs` implements the fixed workload in
[SHARED-REQUIREMENTS](../../specs/SHARED-REQUIREMENTS.md#performance-and-accessibility-protocol).
It measures API requests through real session authentication, including full JSON body retrieval.
It does not certify browser rendering or deployed-network latency.

Provision a **fresh, empty, separately migrated** loopback database named exactly
`specsentry_contributor_perf_test`. Start the current production server against that database
on a dedicated loopback port, with `TRUST_PROXY_HOPS=1` so the synthetic HTTPS forwarded header
permits Secure session cookies. Keep AI disabled. Do not run other tests or loads concurrently.
The script never loads `.env`, creates a database, truncates records or resets an existing fixture.
It rejects any nonempty public application table before seeding, except the exact required
migration-created `AiQuotaCoordinator` singleton with ID `reviewer-patch-risk`; missing,
different or additional coordinator rows are rejected. Use a new empty database for
each run; cleanup is an explicit operator action after evidence is retained.

```powershell
node workflow/tests/performance/contributor-workload.mjs --self-test
$env:PERF_DATABASE_URL = 'postgresql://synthetic_user:synthetic_password@127.0.0.1:55447/specsentry_contributor_perf_test'
$env:PERF_BASE_URL = 'http://127.0.0.1:3197'
node workflow/tests/performance/contributor-workload.mjs
```

On this Windows checkout, use the existing x64 Node runtime for the installed argon2 native
binding and clear `ELECTRON_RUN_AS_NODE`, as with the PostgreSQL/browser test commands.
The example connection credentials are synthetic placeholders, not runtime credentials.

The fixture contains 1,000 proposals, three submitted revisions each, one required criterion
and optional evidence item per revision, and ten unresolved findings per proposal. Ten
Contributor owners each own 100 proposals. Twenty Reviewers each receive twenty current
assignments: ten IN_REVIEW and ten CHANGES_REQUESTED. An additional 200 SUBMITTED and 200
unassigned CHANGES_REQUESTED proposals form the pool; 200 WITHDRAWN proposals retain closed
assignments and immutable history. Historical revision assignments are closed. The total
state mix is 200 SUBMITTED, 400 CHANGES_REQUESTED, 200 IN_REVIEW and 200 WITHDRAWN.
Synthetic submitted/finding activity and request-changes decisions are included.

Twenty authenticated users run continuously without think time. Each independently cycles
pool, assigned queue, detail, revision history and activity with staggered initial endpoints.
Detail/history requests rotate through ten authorized IN_REVIEW proposals per Reviewer.
After a 60-second warmup, a separate 300-second measurement records every completed request
started inside the measurement window; in-flight requests are drained afterward. Timings
include HTTP headers and complete JSON bodies. Reported elapsed times disclose this drain.
No duration override exists. Default first-page pagination is used.

Output is JSON on stdout: fixture assertions, actual timing boundaries, per-endpoint request
counts/statuses/errors and nearest-rank p95 of successful requests, plus the aggregate.
Any measured error prevents a pass; rejected/authentication requests cannot improve the
successful-request p95. Passing requires aggregate successful p95 strictly below 800 ms.
No provider, prompt, password, cookie, database URL or response body is printed.
