# Maintainer smoke-test increment resource report

Generated from `logs/yu-sutong/resources/2026-11-04-maintainer-assembly/` after all
registered intervals finished. The recorder reported `ok: true` with no invalid or
unfinished records.

| Agent / stage / attempt | Start / end (UTC) | Elapsed seconds | Status | Outcome |
| --- | --- | ---: | --- | --- |
| main / orchestrate / 1 | 15:41:51.814625 / 15:48:07.976058 | 376.161433 | succeeded | Chose the bounded smoke slice after design/security pre-review |
| Maintainer Architect / analyze / 1 | 15:42:10.726469 / 15:46:18.857761 | 248.131292 | succeeded | Recommended smoke recording and deferred eligibility API design |
| Security Reviewer / pre-review / 1 | 15:42:10.791925 / 15:47:39.659920 | 328.867995 | succeeded | Defined SEC-SMOKE-01 through SEC-SMOKE-07 |
| main / implement / 1 | 15:48:08.042066 / 15:50:10.217947 | 122.175881 | failed | Product implementation completed; two test-harness assertions failed |
| main / fix / 2 | 15:50:10.272310 / 15:50:31.387707 | 21.115397 | succeeded | Corrected matcher/mount isolation; focused 15/15 passed |
| main / validate / 1 | 15:50:31.441536 / 15:52:03.691866 | 92.250330 | succeeded | Unit, type, lint, build and diff checks passed; PostgreSQL unavailable |
| main / review coordination / 1 | 15:52:03.747151 / 15:54:13.818501 | 130.071350 | succeeded | Coordinated frozen Release/Security review |
| Release Verifier / independent review / 1 | 15:52:03.799954 / 15:53:14.841472 | 71.041518 | succeeded | PASS; no reportable findings |
| Security Reviewer / independent review / 1 | 15:52:03.852634 / 15:54:13.742301 | 129.889667 | succeeded | PASS; SEC-SMOKE-01..07 closed |
| main / documentation / 1 | 15:54:13.926822 / 15:58:38.086311 | 264.159489 | succeeded | Reconciled guides, traceability and run evidence |
| main / Spec/Docs review / 1 | 15:58:38.998953 / 16:01:20.353351 | 161.354398 | succeeded | Coordinated frozen documentation review |
| Spec/Docs Verifier / independent review / 1 | 15:58:39.963867 / 16:01:20.296305 | 160.332438 | succeeded | PASS; links, counts, hashes and scope claims consistent |
| main / publish feature branch / 1 | 16:01:20.406514 / 16:02:48.080412 | 87.673898 | succeeded | Pushed commit `6289c3b` and opened PR #20 through `yu-sutong` |

## Totals and limitations

- Registered intervals: 13 (12 succeeded, 1 failed and corrected).
- End-to-end wall time: 1,256.265787 seconds (20 minutes 56.265787 seconds).
- Summed registered interval time: 2,193.225086 seconds. This is intentionally
  higher than wall time because architecture/security and independent reviews ran
  concurrently.
- Input/output tokens, cache reads, tool calls, retries, observed model and observed
  effort have 0/13 coverage because the collaboration runtime exposes no attributable
  per-interval telemetry. Null values are unavailable, not measured zero usage.
- An unexpected nested architect child appeared interrupted without a handoff,
  edits or a coordinator-started boundary. It is disclosed in the run/prompt logs
  but excluded from measured totals because its timing cannot be reconstructed.
- Final report rendering and this evidence-only follow-up are outside the finished
  measurement boundary, as permitted by the recording procedure.
