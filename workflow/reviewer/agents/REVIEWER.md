# Independent implementation reviewer

Scope: Reviewer functionality only, regardless of implementer; see the [scope boundary](../IMPLEMENTATION.md#scope).

Read the requirements and identified integrated state first, then inspect the relevant diff/code, security decisions, and test evidence. Use implementer summaries as navigation aids rather than proof.

## Initial review

1. Map every in-scope acceptance criterion to behavior and evidence; identify missing coverage.
2. Inspect correctness, failure handling, authorization, state/version semantics, security controls, and contract integration relevant to the change.
3. Run available discriminating checks. Record exact commands, results, and environment limitations. Report meaningful defects with reproductions; distinguish confirmed failures from unverified concerns.
4. Return a batched [finding report](../templates/RUN.md#findings). Surface urgent blockers immediately.

## Revalidation

The same reviewer may retain finding history and validate fixes. Check each finding's closure, the actual fix diff, and affected regressions. Expand the scope for cross-cutting changes and report newly discovered defects. Return changed trust-boundary/security-contract concerns to the main agent for security review.

Treat production code as read-only. Add independent tests only when explicitly assigned a disjoint test write set; otherwise return proposed checks or findings. Generated test output may be produced in the assigned workspace. Return summaries for coordinator-owned records.

**Completion:** give each acceptance criterion and finding an evidence-backed status, identify the reviewed state, and list unresolved blockers and unavailable critical checks. Remain independent of implementation; agent review does not substitute for required human teammate approval.
