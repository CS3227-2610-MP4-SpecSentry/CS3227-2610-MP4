# Independent real end-to-end verification

Both executions of the repository's exact nine `*.spec.ts` tests passed with exit code 0 against a fresh disposable PostgreSQL database and the real built production API. No synthetic API fixture harness substituted for these tests.

| Execution | Passed | Skipped / unexpected / flaky | Duration |
|---|---:|---|---:|
| First | 9 | 0 / 0 / 0 | 134.728 s |
| Repeat | 9 | 0 / 0 / 0 | 31.005 s |

The suite covers private create/list/detail, criterion identity/classification/reconciliation, summary/diff/evidence preparation, editing conflict and uncertain-save recovery, deletion recovery and retained evidence, login accessibility, and Contributor/Reviewer/Release Maintainer session restoration/sign-out. Existing axe, keyboard, escaped text, session-loss, ownership/database and recovery assertions ran unchanged. The intentional per-test network aborts exercise recovery while other operations use the real API/database.

Initial CI evidence is [initial-ci-failures.json](initial-ci-failures.json): six failures in run41159925050/job124415002242 from outdated primary-heading selectors and ambiguous saved-title matches. The first and repeated local result summaries are [live-e2e-attempt1.json](live-e2e-attempt1.json) and [live-e2e-attempt2.json](live-e2e-attempt2.json). No secondary assertion failures occurred. [live-suite-source-hashes.json](live-suite-source-hashes.json) identifies all six tested source files.

Environment: existing portable x64 Node24.19.0 (the pinned argon2 package loads), PostgreSQL16.15, installed Chrome through the existing Playwright1.64.1 runner, five repository migrations applied to a newly initialized cluster, verified UTC. The cluster was created solely in ignored `tmp/pr16-live-e2e-20261031/pgdata` and listened on localhost55439; its fresh disposable database contained only generated test data. No existing database was selected, deleted or modified. The production API listened on5190. User ports5173/3000 were untouched. No dependency installation or product/config source edit was made by the verifier.

Commands from the repository root, after migration and main production build:

```powershell
# Prepend existing .tools/contributor-test/node-v24.19.0-win-x64 to PATH.
# Set TEST_DATABASE_URL to the explicitly disposable migrated local database.
npm.cmd run test:e2e -- --config tmp/pr16-live-e2e-20261031/playwright.config.ts
npm.cmd run test:e2e -- --config tmp/pr16-live-e2e-20261031/playwright-repeat.config.ts
```

Both ignored temporary configs import root `playwright.config.ts` and preserve its tests/projects/assertions. Overrides: absolute repository testDir, dedicated localhost5190 API/baseURL/PORT, explicit existing x64 Node executable for the built server, installed Chrome channel, and isolated result/report locations. The second config differs only in report filename. `--list` confirmed exactly9 tests in6 files before execution. Published JSONs contain case/status/duration summaries, not complete config/environment data.

The initial sandboxed PostgreSQL start failed due to the Windows restricted token; an authorized elevated start of the same fresh cluster succeeded. All first-run test assertions passed; sandboxed Playwright then waited during owned-server termination. After identifying the exact owned server command, the verifier stopped only that API child, and Playwright returned9passed/exit0. The repeat ran with authorized process permissions, shut down its own API normally, and returned9passed/exit0 without intervention. This is local runner teardown behavior, not a product assertion failure. Benign FORCE_COLOR/NO_COLOR warnings were emitted.

Both test API processes have exited. The owned PostgreSQL cluster was stopped successfully; its ignored data directory remains available for inspection. No preview or API server was left running by this verification.

Resources: first invocation76cea71f664243809e2113f0bb643179; repeat invocationbdbe4d7c29364858b41bd75295ac09e3. Exact token/cache/tool/retry execution telemetry is unavailable; elapsed resource timing includes setup and coordination.

Limits: Windows Chrome/PostgreSQL16 is local corroboration; the GitHub Ubuntu/PostgreSQL17 CI rerun remains the authority for that runner. These results do not certify deployment, all browsers, or manual accessibility. No additional tests were invented or existing assertions weakened.
