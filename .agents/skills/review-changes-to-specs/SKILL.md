---
name: review-changes-to-specs
description: Review repository changes against existing specifications and acceptance criteria. Use when checking a patch, branch, or worktree for requirement discrepancies, missing behavior, or traceability gaps across any product role.
---

# Review changes to specifications

Repository-wide. Assess specification conformance without imposing a particular agent orchestration process. Review is read-only unless edits are separately authorized.

1. Establish the requested diff boundary and record base/current state, including relevant untracked files. If no boundary is supplied, inspect current uncommitted changes first; ask when multiple materially different targets remain plausible.
2. Identify relevant requirement IDs and current authoritative spec sections from [PRODUCT-SPEC](../../../workflow/specs/PRODUCT-SPEC.md) and supporting specifications that actually exist. Inspect relevant code, contracts, tests, and available evidence. Code is evidence of behavior, not authority to rewrite a requirement.
3. Map each in-scope criterion to implementation and verification, including boundaries, failures, authorization, state/version semantics, and exclusions. Run discriminating non-destructive checks when useful; distinguish confirmed failures, unverified concerns, and unavailable evidence. Do not create tests or edit sources merely because review was requested.
4. Batch actionable findings with stable IDs, severity/impact, blocking status, requirement reference, code location, observed versus expected behavior, reproduction/evidence, and validation expected for a fix. Surface urgent blockers immediately. For material spec ambiguity, state the question and recommendation instead of silently inventing behavior.
5. On fix review, preserve finding IDs, identify the new reviewed state, inspect fixes and affected regressions, and report new defects. Never close a finding solely because the implementer says it is fixed.

Return a concise coverage table and findings, plus exact checks/results and limitations. A missing critical check remains an evidence gap; no findings is not proof of complete correctness. Use existing finding IDs and report structures when supplied rather than duplicating reports. If a broader review already includes this comparison, reuse its spec evidence and make gaps explicit.

**Completion:** every in-scope criterion is covered by evidence, contradicted by a finding, or explicitly unresolved. Review the requested result; do not start the Reviewer-specific multi-agent workflow for other functionalities.
