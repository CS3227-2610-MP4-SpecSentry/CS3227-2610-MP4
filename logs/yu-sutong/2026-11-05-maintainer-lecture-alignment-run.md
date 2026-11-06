# Release Maintainer / deployment run

- Prompter and inference source: `yu-sutong`; explicit user request and existing account constraint.
- Goal and requirement IDs: align PR #20 development workflow with relevant CS3227 lecture practices; development-process evidence supporting partial REQ-REL-002, not a new product requirement.
- Source revision / branch: base/head before this increment `3735a7db298e26aa8447c7972302f31e650f5fe0`; `feature/release-maintainer-assembly`; frozen working-tree manifest below.
- Target environment (or local-only): local repository and CI configuration only; no live provider or application environment.
- Approved authority and excluded actions: inspect supplied lectures, add repository workflow harness/docs/tests, validate, and continue PR #20 through `yu-sutong`. No migration, deployment, production action, merge or unrelated product feature.
- Agent assignments and exact write sets: main agent is the sole writer for harness, tests, workflow docs, evaluation and logs. Security and Release Verifiers are read-only after freeze.
- Focused context supplied / retrieved later: lecture concepts for agent testing, workflow contracts, specialized/multi-agent tradeoffs, context/resource evidence and harness engineering; current deployment workflow, resource recorder and PR #20 evidence.
- Secret names required (names only; no values): none.
- Source SHA / immutable image digest: source base above; no image built or immutable digest created.
- Migration compatibility and recovery decision: no database/schema/migration changes; recovery and image rollback are outside this local harness increment.
- Acceptance, denial, failure and rollback checks: valid exact terminal evidence with substantive logs, strict completed resources, an independent-review success and Git-complete manifest passes. Active/mixed/pending status, nested fenced/shallow sections, malformed/timestamp-inconsistent records, missing verifier, omitted/drifted files, traversal, five symlink surfaces, oversized/count-excess evidence and parser/schema marker leakage fail. Root test/lint gates exercise the harness.
- Commands and actual results: third-correction focused harness 16/16. The full gate passed 124 server, 266 client and 16 harness tests plus typecheck, lint, production build, submission presence and diff check. Existing Vite chunk warning remains non-failing. Historical PR #20 evidence passed with 13 records and all 8 candidate hashes. Fresh third Release and Security reviews passed the frozen current candidate.
- Stable findings and dispositions: WF-EVID-001 now uses an anchored terminal-status grammar and catches incomplete review/re-verification markers. WF-EVID-002 compares the manifest with Git's complete non-log inventory and supports committed-candidate verification. WF-EVID-003 / SEC-EVID-001 reject traversal and symlinks for run, prompt, resource directory/file and manifest file. SEC-EVID-002 tracks Markdown fence character and opening length. SEC-EVID-003 bounds file bytes, aggregate bytes, JSON counts, manifest rows and total directory entries. SEC-EVID-004 emits generic parser and structured-value diagnostics. The third independent Release and Security invocations passed every corrected finding with no remaining actionable issue.
- Failed/interrupted attempts and retry cost: Poppler text extraction was not on the default PATH and the system Python lacked `pypdf`; a temporary isolated environment enabled read-only extraction. A broad all-PDF extraction was interrupted after becoming slow; focused relevant lectures/pages were then extracted and visually verified. The first adversarial harness run passed 13/14 because one test combined an invalid timestamp with an elapsed mismatch; the test was corrected to isolate valid timestamps plus inconsistent elapsed time and then passed 14/14. The first third-correction run passed 15/16 because an old assertion expected the intentionally removed raw status value; the assertion was corrected and the harness passed 16/16. No product behavior was changed by these attempts.
- Resource-record references: `logs/yu-sutong/resources/2026-11-05-maintainer-lecture-alignment/`; the [validated report](2026-11-05-maintainer-lecture-alignment-resources.md) covers 12 finished intervals, 46,832.497529 summed overlapping seconds and 42,596.668 seconds end to end.
- Human approvals required / observed evidence: teammate PR review and merge remain pending. Human verification of AI-produced summaries remains pending.
- Unresolved risks and unavailable telemetry: no controlled single-agent baseline; per-agent token/cache/tool/retry telemetry unavailable; the long correction interval includes the overnight user pause and is elapsed wall time, not active model time; the new commit has not yet triggered GitHub CI; no browser/deployed acceptance added.
- Next authorized action: commit and push to PR #20 using `yu-sutong`, then observe configured CI; do not merge or deploy.
- Status: verified

## Frozen code-candidate manifest

| File | SHA-256 |
| --- | --- |
| `package.json` | `ad8995574245bb8a4dbcdb3ea6147cd1139055df835e631e4140a3a86bc17211` |
| `workflow/README.md` | `f37f7c7e342344f60e2dead3b3fb37fc40f9798ad592f5d7dc38a66c0393b0e1` |
| `workflow/deployment/README.md` | `01c167a97ff2386bfec01ac15064f0a4abaa821e235cf75760b96a911e8e8388` |
| `workflow/deployment/CONTRACT.md` | `29ee2e3fde10ef865e0b967fa7174d0530791cd30e928a7abba4a67859d9e8dc` |
| `workflow/deployment/tooling/verify-run-evidence.mjs` | `8fd9480273bb5511fa7150dbae3f504305bca2e710b4da06e3b98f052aa353b3` |
| `workflow/deployment/tests/verify-run-evidence.test.mjs` | `afed09b10b1f75504d782c58de22c11f1fc4b2e6fc404fe75d7e8eacb00eb800` |
| `workflow/evaluations/2026-11-05-maintainer-smoke-workflow-observation.md` | `0bff8ed88a82624e71bf96bb6e9b9bf981c50707dedc7d88f4c0b9f6016cd3a4` |
| `docs/Reflections.md` | `f97f3147388a97796ee983514953d3eaa8526ffb8dc23605b3db09319807d80b` |
