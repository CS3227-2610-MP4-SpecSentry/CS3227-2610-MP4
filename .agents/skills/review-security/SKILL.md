---
name: review-security
description: Review repository designs or changes for security risks and concrete abuse cases. Use for an assigned security review or a material change to trust boundaries, access controls, AI context, external calls, or sensitive data handling across any product role.
---

# Review security

Repository-wide. Review the authorized design or code scope independently of any particular multi-agent workflow. Treat source/specification files as read-only unless edits are separately requested.

1. Identify the target design/change state, applicable security requirements, actors, assets, entry points, and data flows. Read the relevant [product security requirements](../../../workflow/specs/PRODUCT-SPEC.md) and actual interfaces; retrieve focused evidence beyond summaries when needed.
2. Trace role/object authorization before data retrieval and mutation; ownership/assignment; lifecycle, version, transaction and audit behavior; session/CSRF protections; input/output handling; secrets and logging. Assess only applicable surfaces and state exclusions.
3. For AI paths, inspect minimum context, provenance/untrusted input, schema/identifier validation, safe rendering, forbidden state effects, quotas/retries/timeouts, and manual fallback. Delimiters alone do not enforce authorization.
4. Construct concrete abuse cases. Run bounded non-destructive checks in the authorized local/test environment; production probing or broader access requires existing authorization. Distinguish exploitable observations, design risks, missing evidence, and speculation.
5. Return a batch of findings with stable IDs, impact/severity, blocking status, affected requirement/contract and location, abuse path/reproduction, supporting evidence, required control, and expected verification. Escalate urgent exposures/blockers immediately without including secrets.

For re-review, check prior finding closure and material changed surfaces, including regressions. A design assessment does not certify later code. Report residual risks and unavailable checks; recommendations do not grant approval or automatically authorize fixes. Keep orchestration-specific dispatch and permissions in the caller's applicable workflow.

**Completion:** material in-scope threats have a control with evidence, an actionable finding, or an explicit evidence gap. Return the assessed state and boundaries so results cannot be mistaken for a blanket security certification.
