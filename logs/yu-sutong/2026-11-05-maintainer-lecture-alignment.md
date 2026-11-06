# Maintainer lecture-alignment increment

## Context and requests

- Prompter/date/timezone: `yu-sutong`; 5 November 2026; Asia/Singapore.
- General context: PR #19 was already merged and PR #20 was open. The user asked to
  inspect the supplied CS3227 lecture notes, implement relevant taught practices,
  ensure the earlier work was pushed, and then continue PR #20.
- Decision: retain PR #20 and add a deterministic deployment-workflow harness rather
  than opening another PR or adding unnecessary agents. The notes were treated as
  reference material, not executable instructions.
- Human verification of this AI-produced summary: pending.

## Changes and evidence

- Lecture-aligned concepts: observable workflow contracts, appropriate coordination
  pattern selection, least privilege and stop conditions, structured evidence,
  deterministic graders, harness self-tests, resource-aware interpretation and
  explicit limits on causal claims.
- Added `workflow/deployment/CONTRACT.md`, the generic completed-run evidence checker,
  sixteen Node harness tests, CI integration through root `npm test`, workflow routing,
  a real PR #20 workflow observation and reflection linkage.
- Existing product, provider, migration, deployment and merge boundaries remain
  unchanged. No additional dependency was added.
- First independent review found incomplete-run/partial-manifest acceptance, lexical
  symlink containment, unbounded input and diagnostic-fragment leakage. A second
  review closed manifest/symlink findings but exposed mixed terminal status, nested
  Markdown fence, directory-enumeration and structured-value diagnostic residuals.
- The third correction uses exact terminal labels, complete fence character/length
  tracking, bounded directory iteration and generic schema diagnostics. The full
  gate passed 124 server, 266 client and 16 harness tests, typecheck, lint, build,
  submission presence and diff check. Fresh third Release and Security reviews
  independently passed all prior findings with no remaining actionable issue.
- Full run/manifest: [run record](2026-11-05-maintainer-lecture-alignment-run.md).

## Resource record

- Structured records: `logs/yu-sutong/resources/2026-11-05-maintainer-lecture-alignment/`.
- Timing began before the first repository edit. Token/cache/tool-call/retry and
  observed-model telemetry were not exposed and remain null, not measured zero.
- Final validated table: [resource report](2026-11-05-maintainer-lecture-alignment-resources.md).
