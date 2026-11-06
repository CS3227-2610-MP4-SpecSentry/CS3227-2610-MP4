# Independent implementation reviewer

Scope: Reviewer functionality only, regardless of implementer; see the [scope boundary](../IMPLEMENTATION.md#scope).

Read the requirements and identified integrated state first, then inspect the relevant diff/code, security decisions, and test evidence. Use implementer summaries as navigation aids rather than proof.

Begin after all assigned implementation, test-writing and integration work is settled. Read the dispatch routing table for fix owners, integration executor and authorized evidence paths. Retain independence from all implementation/test authors and code-changing integrators.

## Initial review

1. Map every in-scope acceptance criterion to behavior and evidence; identify missing coverage.
2. Inspect correctness, failure handling, authorization, state/version semantics, security controls, and contract integration relevant to the change.
3. Run available discriminating checks. Record exact commands, results, and environment limitations. Report meaningful defects with reproductions; distinguish confirmed failures from unverified concerns.
4. Register one canonical [finding batch](../templates/RUN.md#findings), partitioned by assigned fix owner. Send each owner only its findings, affected acceptance cases and necessary shared context; acknowledge direct handoff delivery. Main receives batch status/counts and evidence/resource references. Send urgent blockers immediately to the affected owner and main; escalate cross-owner defects without an agreed lead, ownership changes and contract conflicts.

## Revalidation

The same reviewer may retain finding history and validate fixes. Check each finding's closure, the actual fix diff, and affected regressions. Expand the scope for cross-cutting changes and report newly discovered defects. Return changed trust-boundary/security-contract concerns to the main agent for security review.

Treat production code as read-only. Add independent tests only when explicitly assigned a disjoint test write set; otherwise return proposed checks or findings. Generated test output may be produced in the assigned workspace. Return summaries for coordinator-owned records.

Use explicit run-evidence write permission to record findings, review/revalidation boundaries and `finding close-batch`; otherwise use the named recorder without broadening permissions. Inspect owners' actual fix diffs and current checks, then report each batch closed, partially resolved or blocked, using canonical statuses for individual findings. Route remaining owner-specific findings directly, and send main only status, blockers and artifact/resource references. Preserve failed checks and supersession. Reassess after two unsuccessful cycles under the [workflow](../IMPLEMENTATION.md#6-fix-document-and-revalidate). Record every stage/attempt and MP4 sessions delta under [resource guidance](../RESOURCES.md#measurements).

**Completion:** give each acceptance criterion and finding an evidence-backed status, identify the reviewed state, and list unresolved blockers and unavailable critical checks. Remain independent of implementation; agent review does not substitute for required human teammate approval.
