# Disposable PostgreSQL baseline

Verifier: independent acceptance agent, environment-baseline stage `acceptance-2`.
Resource: `292f7730157644ce938b1de27103680d`. Baseline server/schema at HEAD
`03cbea9f94c28011142c3a2a453ce7692df06053`; client implementation was in progress.
This result does not certify the eventual new server or client patch.

Fresh PostgreSQL16.15 cluster: ignored `.tools/contributor-completion/data`.
Loopback port55447, explicitly disposable database
`specsentry_contributor_completion_test`, synthetic test account only.
Verified current database/user and UTC. Seven existing migrations applied cleanly.
No runtime database, old test cluster or runtime .env was used for fixtures.

Successful command: `npm.cmd run test:integration -w @specsentry/server`, with
explicit TEST_DATABASE_URL and DIRECT_DATABASE_URL targeting this database,
existing portable x64Node24.19.0 prepended to PATH, native unrs module path supplied
through NODE_PATH and ELECTRON_RUN_AS_NODE unset. Shared build ran first.

```text
Test Suites: 16 passed, 16 total
Tests:       213 passed, 213 total
Snapshots:   0 total
Time:        206.539 s
Ran all test suites.
Exit code:   0
```

Failed attempts retained: root integration prebuild hit sandbox ancestor-directory
access; approved escalated shared build passed unchanged. pg_ctl restricted-token
startup failed; direct hidden postgres startup succeeded. Existing pg concurrent
query deprecation warnings appeared on the passing run. Raw local output remains
in ignored `.tools/contributor-completion/baseline-integration-direct.log`; this
safe summary is persisted for review. No provider or deployed verification ran.
