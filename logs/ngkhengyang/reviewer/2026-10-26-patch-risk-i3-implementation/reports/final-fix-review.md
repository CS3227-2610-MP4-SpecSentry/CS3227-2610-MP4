# Patch Risk iteration 3: fixes and independent review

All five confirmed findings are fixed and independently endorsed for closure.
The second fix/review cycle passed. Application code is frozen at
`final-reviewed-application`: its 31 paths match the independently reviewed fix1
state exactly. [Application hashes](final-application-manifest.json),
[canonical records](../state.json), [prompt/change log](../../../2026-10-26-reviewer-iteration3.md).

| Finding | Result |
| --- | --- |
| F-001 HIGH | Quoted credentials and encrypted PEM reject before dispatch; normalized token forms redact across submitted fields while legal grounding IDs remain exact. |
| F-002 MEDIUM | Rejected/open response streams abort and cancel with bounded cleanup, including never-settling cancellation and late headers. |
| F-003 MEDIUM | Valid safe usage survives malformed/refused/truncated advisory output; retries do not inherit usage. |
| F-004 MEDIUM | Allowlisted size-limit feedback explains full context/no truncation/manual fallback and preserves manual edits and safe references. |
| F-005 MEDIUM | Six save/lifecycle cases now initiate competing original-scope HTTP operations, prove PostgreSQL blocking before release, and verify atomic winner-only outcomes. Drop and reclaim remain separate real transactions; obsolete saves are rejected before and after reclaim. |

Original owners implemented the fixes with gpt-6.1-sol/high for gateway and
contention tests, and medium for UI. Independent security and implementation
reviewers reused gpt-6.1-sol/high. Their synthetic probes independently reproduced
the corrections; the implementation reviewer additionally ran nine component tests
and inspected the actual concurrency evidence. See [security verdict](../handoffs/13-code-security-to-main-revalidation.md)
and [five-finding verdict](../handoffs/13-independent-review-to-main-revalidation.md).
Neither reviewer changed application files. Main owns integration and recording.

| Registered verification | Passing command |
| --- | --- |
| Server unit 73; client unit 71 | `verify-ce5874e89c7047d7` |
| Typechecks | `verify-d677600fb4884517` |
| Lint | `verify-8f775d2ee2144dc9` |
| Production build | `verify-30e5e9f9933547ba` |
| PostgreSQL 130, including six real save/lifecycle contention cases | `verify-f844c87c574f43f6` |
| Chromium 11 | `verify-1ba0fb0f270f4b93` |
| Named gateway / UI acceptance selectors | `verify-2f44561f13bf446f` / `verify-4978923260f5417f` |

The matrix retains 47 named acceptance cases. A transient disposable-database
migration preflight failure is preserved and superseded by passing
`verify-169db2f1af73421e`. Worker fixture TypeScript errors and PATH/Git diagnostic
failures were corrected or explicitly excluded from pass claims. No provider
calls occurred. Previous capacity/usage failures remain failed historical attempts.

Final guide edits invalidated a snapshot that mixed application and documentation.
Main corrected the evidence scope with three same-executor completion refreshes,
without application changes. These are recorded logical ownership intervals,
not additional independent workers. The same reviewer then verified all 31 final
application hashes and carried forward all five closure endorsements. The stale
architecture sentence and missing report link noted during that check are corrected.

The local harness still reports five historical failed invocation identities as
unresolved despite their later successful owner completions; its latest-attempt
registry groups by invocation identity. Those failures are preserved rather than
rewritten. The [final consistency report](final-completeness.json) distinguishes
this recording limitation from application findings and current passing evidence.
No claim of a fully green canonical consistency result is made.

Live operation remains disabled under OPEN-002. Live model/tokenizer/parameters,
quota/retention compatibility, usefulness and latency are unverified. Actual
BFCache navigation/restoration and guaranteed scheduled physical pruning at 90
days remain evidence gaps. Metadata is logically expired and opportunistically
pruned. Human teammate approval, deployment and all-role release gates remain
pending. Independent review does not supply those approvals.

Resources, failed attempts and measurement limits: [fix/resource report](fix1-resources.md).
No hidden computation time, exact stage token allocation, monetary cost or savings
is inferred from sampled counters.
