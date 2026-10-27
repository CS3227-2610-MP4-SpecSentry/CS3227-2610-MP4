# Reviewer historical evidence

Retention updated 27 October 2026. The eight completed runs below use **compact historical evidence summaries**, retaining the filename `state.json` for existing links. They are not executable workflow state and cannot be resumed by the workflow CLI. The summary format is `reviewer-historical-evidence-summary-v1`.

| Historical run | Compact evidence summary | Authoritative workflow report |
| --- | --- | --- |
| Reviewer intake | [state.json](2026-10-25-reviewer-intake/state.json) | [Intake report](../2026-10-25-reviewer-intake.md) |
| Manual review | [state.json](2026-10-25-manual-review/state.json) | [Manual-review report](../2026-10-25-manual-review.md) |
| Revision cycle / Iteration 2 | [state.json](2026-10-26-reviewer-iteration2/state.json) | [Iteration 2 report](../2026-10-26-reviewer-iteration2.md) |
| Iteration 3 preparation | [state.json](2026-10-26-patch-risk-i3/state.json) | [Iteration 3 report](../2026-10-26-reviewer-iteration3.md) |
| Iteration 3 implementation/review/fixes | [state.json](2026-10-26-patch-risk-i3-implementation/state.json) | [Iteration 3 report](../2026-10-26-reviewer-iteration3.md) |
| Iteration 4 preparation | [state.json](2026-10-26-reviewer-iteration4/state.json) | [Iteration 4 report](../2026-10-26-reviewer-iteration4.md) |
| Iteration 4 implementation/integration | [state.json](2026-10-27-reviewer-iteration4-implementation/state.json) | [Iteration 4 report](../2026-10-26-reviewer-iteration4.md) |
| Iteration 4 independent review/fixes | [state.json](2026-10-27-reviewer-iteration4-review-fixes/state.json) | [Iteration 4 report](../2026-10-26-reviewer-iteration4.md) |

## How to read the summaries

- Requirements, assignment ownership, findings and all closure/reopen histories, command outcomes and supersession, completions, review cycles and resource records retain their original values. Missing telemetry remains unavailable. Existing briefs, independent reviews, test outputs and final reports remain alongside them.
- `snapshots` retains ID, date, artifact hash, scope reference, Git/diff identifiers and file count. Embedded per-file hash lists are omitted. These fingerprints describe historical source; they do not establish current freshness.
- `source_scopes` stores each distinct path list once. Verification-check and snapshot `scope_ref` values identify those lists. Verification definitions otherwise retain their original fields.
- `acceptance_cases` holds the final cases. Each `acceptance_matrices` entry retains its date, reason, applicability and original case order/hash. Its `case_deltas_from_latest` records changed fields or removed fields relative to the final cases. These preserve earlier matrix contents without repeating all cases. Matrix history is a plan/evidence index, not proof that every case passed.
- `retention.main_report` identifies the authoritative consolidated outcome. Where available, `historical_gate` records the original retained checker's verdict and error count, with its complete diagnostics referenced. It is not a fresh check.
- Consumed JSON inputs are indexed in per-run `inputs-summary.json` files. Each entry retains the original input hash/size, equivalent evidence locator and any unique fields or decisions missing from that equivalent. Original payloads remain recoverable at each index's `source_commit`. These requests do not themselves prove execution. Links in retained handoffs/reports now target the corresponding summary entry; original registered artifact hashes describe the pre-migration documents, with current handoff hashes recorded separately.

## Recovery and verification limits

The complete pre-compaction states are committed at [62a807d](https://github.com/CS3227-2610-MP4-SpecSentry/CS3227-2610-MP4/commit/62a807d7082410d10192f55196e718018ad08d8a). Each summary's `retention` records its original path, working-file and Git-content SHA-256, original size/line count and exact source URL. Locally, `git show 62a807d7082410d10192f55196e718018ad08d8a:<repository-relative-state-path>` retrieves the original committed JSON. Its decoded payload was verified equal to the pre-edit working file; original Windows newline differences are distinguished by the two hashes.

This supersedes earlier claims that full snapshot payloads remain in current `state.json` files or can be reconstructed from them. Full payloads now require the identified Git revision. The earlier [snapshot-removal manifest](../2026-10-27-iteration3-4-cleanup/snapshot-retirement.json) remains a historical removal record; its retention update explains that current pointers locate compact metadata, not full original manifests. Its original removal/reconstruction claims describe the earlier cleanup checkpoint.

The current harness has not been weakened to accept these summaries. Direct automated replay/freshness verification of the compacted historical runs is retired. Recovering original metadata does not restore historical source or resolve workflow gaps; current acceptance requires current source and checks.

Iteration 3's five original invocation issues and Iteration 4's final 34 cross-run acceptance-evidence gaps remain recorded. Independent finding closures retain their historical meaning. Live AI, human approval and deployment limitations remain as documented. Earlier green results are original observations, not certification of this compacted worktree.

## Important supporting evidence

[Requirement traceability](../../../workflow/TRACEABILITY.md), [User Guide](../../../docs/UserGuide.md) and [Developer Guide](../../../docs/DeveloperGuide.md) remain authoritative for their respective purposes. Iteration 3's [final independent fix review](2026-10-26-patch-risk-i3-implementation/reports/final-fix-review.md), and Iteration 4's [final validation](2026-10-27-reviewer-iteration4-review-fixes/reports/final-validation.json), [independent revalidation](2026-10-27-reviewer-iteration4-review-fixes/reports/revalidation.json) and [structural status](2026-10-27-reviewer-iteration4-review-fixes/reports/structural-status.json) remain intact.

The [state-compaction log](../2026-10-27-state-summary.md) records this request, measurements, preservation checks and resources. The [earlier cleanup log](../2026-10-27-iteration3-4-cleanup.md) retains the superseded assessments and earlier removal history. This policy applies only to the eight historical runs listed above; new workflow runs use the existing CLI formats.
