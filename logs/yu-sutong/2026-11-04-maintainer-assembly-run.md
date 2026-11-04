# Release Maintainer / deployment run

- Prompter and inference source: `yu-sutong`; explicit current request and the existing Git identity/account constraint.
- Goal and requirement IDs: implement the next smallest complete Maintainer slice and document every deployment-agent interaction for presentation evidence; partial REQ-REL-002 / AC-REL-002.
- Source revision / branch: base `191e65c`; `feature/release-maintainer-assembly`; review candidate is the base plus the current working-tree manifest recorded below. Commit/push/PR identity is added only after it occurs.
- Target environment (or local-only): local-only source and tests. No Render, Neon, GHCR, migration or live application target.
- Approved authority and excluded actions: repository source/tests/docs/logs, safe checks, feature-branch publication and PR preparation under the user's `yu-sutong` instruction. Provider provisioning, secrets, remote migration, deployment, production promotion/rollback and merge remain excluded.
- Agent assignments and exact write sets: coordinator/main agent alone writes client, test, documentation and logs. Maintainer Architect, pre-review Security Reviewer, fresh Release Verifier and fresh Security Reviewer are read-only. A Spec/Docs Verifier receives the frozen documentation diff read-only.
- Focused context supplied / retrieved later: REQ-REL-002 smoke defaults, existing strict smoke request/command/detail contracts, release service transaction, client session remount, current diff, tests and explicit stop conditions.
- Secret names required (names only; no values): none.
- Source SHA / immutable image digest: base SHA above; no image was built or pushed and no immutable image digest exists.
- Migration compatibility and recovery decision: no schema or migration changes. Database recovery and image rollback are not applicable to this local slice and remain separate authorized release operations.
- Acceptance, denial, failure and rollback checks: owner PASS/FAIL with exact versions and CSRF; strict text bounds; non-owner/RELEASED controls absent; wrong-owner/RELEASED/stale server denial; no insert on conflict; atomic rollback after late database failure; server-only blockers; old PASS invalidation; 401 cleanup; 409/network/5xx reconciliation; unmount/session late-response suppression; escaped text.
- Commands and actual results: focused Maintainer client 15/15; Security Reviewer smoke contracts 7/7; full server units 18 suites/124 tests; full client 16 files/266 tests; type-check, lint, production build, submission-presence and `git diff --check` passed. Build retained the existing non-failing chunk-size warning. PostgreSQL integration was unavailable locally because `TEST_DATABASE_URL` was unset and Docker was unavailable. Final Spec/Docs verification passed with no findings and confirmed that relative links resolve.
- Stable findings and dispositions: pre-review `SEC-SMOKE-01` through `SEC-SMOKE-07` shaped the implementation. Fresh Release and Security verification returned PASS with no reportable findings and retained configured PostgreSQL CI as the acceptance gate.
- Failed/interrupted attempts and retry cost: the first focused client run failed two test-harness checks: a matcher crossed a nested `<strong>` node and one test left its first render mounted. A separate fix interval corrected both; 15/15 then passed. An unexpected nested architect child appeared interrupted without a handoff, edits or a coordinator-started interval; its exact timing/model/usage are unavailable and it contributed no evidence.
- Resource-record references: `logs/yu-sutong/resources/2026-11-04-maintainer-assembly/`; generated table is linked from the main interaction log.
- Human approvals required / observed evidence: teammate review, merge authorization and any protected production approval remain pending. Human verification of AI-produced interaction summaries is pending.
- Unresolved risks and unavailable telemetry: PostgreSQL execution and CI are pending; no browser E2E or live deployment evidence; per-agent model/token/cache/tool/retry telemetry is not exposed. Proposal assembly needs a new minimum-data eligibility API and remains deferred.
- Next authorized action: commit/push/open a PR using `yu-sutong`; wait for configured CI before treating PostgreSQL cases as passed.
- Status: verified local code and documentation candidate; feature-branch publication active; not deployed, merged or released.

## Frozen code-candidate manifest

Base `191e65c` plus these SHA-256 identities. Documentation changes do not alter
the reviewed code candidate.

| File | SHA-256 |
| --- | --- |
| `src/client/src/features/maintainer/MaintainerWorkspace.tsx` | `1253d1fee9d6788c0b49f080ebb9553d75a9fb2b562d64454a73f4762b646092` |
| `src/client/src/features/maintainer/MaintainerWorkspace.test.tsx` | `70f8aef72820c29c5fab19bc8235be4799012202560578238cafcff03530f6fb` |
| `src/server/test/release-revocation.integration.ts` | `5f5966c286d8f3d618f43497cb7459db459f06a6a34d4a7de6f6f9ba9c9d732c` |
