# Maintainer smoke workflow observation

- Author/date/timezone: yu-sutong; 5 November 2026; Asia/Singapore.
- Task/source: REQ-REL-002 smoke-test recording; base `191e65c`, final recorded PR
  head `3735a7db298e26aa8447c7972302f31e650f5fe0` before this harness increment.
- Scope: development-agent workflow observation, not application AI and not a
  controlled single-agent-versus-multi-agent experiment.
- Pattern: orchestrator-subagent for bounded architecture/security analysis, then
  generator-verifier separation for Release, Security and Spec/Docs acceptance.
- Evidence: [interaction log](../../logs/yu-sutong/2026-11-04-maintainer-assembly.md),
  [run record](../../logs/yu-sutong/2026-11-04-maintainer-assembly-run.md) and
  [resource report](../../logs/yu-sutong/2026-11-04-maintainer-assembly-resources.md).

## Outcomes and measurements

| Measure | Observed value | Interpretation |
| --- | ---: | --- |
| Local product checks | 124 server unit; 266 client; 15 focused client; 7 contract | Final local checks passed; PostgreSQL integration remained a CI gate |
| Independent findings after freeze | 0 Release; 0 Security; 0 Spec/Docs | Explicit criteria supported clean independent verdicts; not proof of defect-free software |
| Pre-review security controls | 7 (`SEC-SMOKE-01..07`) | Up-front constraints shaped reconciliation, session, rendering and ownership tests |
| Registered intervals | 13 | Eight coordinator stages and five specialist/verifier invocations |
| End-to-end wall time | 1,256.265787 seconds | Includes analysis, implementation, correction, reviews, docs and initial publication |
| Summed interval time | 2,193.225086 seconds | Overlaps by design; 1.746x wall time is concurrency, not a speedup claim |
| Failed implementation attempt | 1 interval; 122.175881 seconds | Two test-harness assertion problems were preserved rather than hidden |
| Correction | 1 interval; 21.115397 seconds | Focused suite then passed 15/15 |
| Token/cache/tool/retry coverage | 0/13 | Runtime did not expose attributable counters; values remain unavailable, not zero |

## Interpretation

The workflow produced a bounded feature, explicit security behavior, independent
verification and reconstructable evidence in about 21 minutes of wall time. Parallel
read-only reviews explain why summed agent time exceeded wall time. The clean final
verdicts are compatible with useful early constraints, but this run has no matched
single-agent baseline, so it cannot establish that multi-agent coordination was
faster or cheaper. The interrupted unregistered nested attempt also shows a real
coordination-accounting failure mode.

For similar quality-critical slices with explicit acceptance criteria, keep the
orchestrator-subagent plus generator-verifier pattern. For localized documentation,
test assertion or harness changes, prefer one writer and deterministic checks; the
specialized-agent overhead and permission surface are not justified. A later
controlled comparison should hold the task/source/checks constant and expose token
and tool-call telemetry before making resource-efficiency claims.
