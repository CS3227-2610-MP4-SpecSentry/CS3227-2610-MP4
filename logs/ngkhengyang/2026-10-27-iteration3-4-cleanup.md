# Iterations 3 and 4: evidence cleanup

> State retention update, 27 October 2026: linked state files are now compact historical summaries. Full original payloads are recoverable from Git; see [retained evidence and verification limits](reviewer/RETAINED-EVIDENCE.md). Earlier preservation/replay claims below describe their original checkpoint.

Prompter: **ngkhengyang**, inferred from the current Git identity (`git config user.name`). Date: 27 October 2026, Asia/Singapore. Main execution identifies the GPT-6 family; exact alias/effort and attributable usage counters are unavailable. No subagents were launched.

## Request and outcome

The user requested cleanup of excess documentation, logs and temporary files created in the **Iteration 3** and **Iteration 4** chats, with traceability and important details retained. Both referenced chats were read through their available turn pages, including final corrections and implementation/review outcomes.

Removed **141 consumed JSON inputs, 574,328 bytes** across the five associated Reviewer run directories. Their file count fell from **831 to 690**. These figures exclude the small new cleanup log, manifest and resource record/report. No application code, specification, guide, workflow implementation or original consolidated report changed.

| Run | Files before | Removed | Files retained |
| --- | ---: | ---: | ---: |
| Iteration 3 preparation | 80 | 10 | 70 |
| Iteration 3 implementation/review/fixes | 342 | 63 | 279 |
| Iteration 4 preparation | 53 | 1 | 52 |
| Iteration 4 implementation/integration | 241 | 29 | 212 |
| Iteration 4 independent review/fixes | 115 | 38 | 77 |

| Removed category | Files | Retained equivalent |
| --- | ---: | --- |
| Handoff generation inputs | 2 | Original input hash, byte-verified generated sections, references and resource/snapshot provenance |
| Assignment inputs | 5 | Every supplied field exactly retained in canonical state |
| Verification-check definitions | 126 | Every supplied field exactly retained in canonical state |
| Acceptance-matrix inputs | 8 | Exact cases and applicability declarations in canonical matrix history |

The [removal manifest](2026-10-27-iteration3-4-cleanup/manifest.json) records each original path, SHA-256, byte count, reason and retained file/JSON pointer. It also records per-run totals, baseline HEAD, inventory digests and validation results. JSON-pointer fragments identify canonical records; they are locators inside JSON, not Markdown headings. Removed input formatting is no longer separately present; its substantive fields remain at those locators.

Only inputs with an exact retained equivalent and **no incoming repository reference** were removed. Reference inspection included historical metadata, reports, scripts, documentation and source text; dependencies and generated output trees were excluded. Before individual file deletion, resolved targets were checked against the five explicit run roots, links/junctions rejected, current hashes rechecked and replacement pointers resolved. No recursive deletion or archive conversion occurred.

Inputs used by operational scripts, referenced artifacts, superseded definitions without an exact equivalent, and handoffs whose historical rendering differs were retained. Five initially considered byte-identical report/output copies were also retained: independent execution context and diagnostic labels matter even when captured text matches. One-off operational scripts and their referenced inputs remain together. The inspected `tmp/lecture-extraction` directory was unrelated to these iterations; `test-results` contained only the generic Playwright last-run marker, without sufficient iteration attribution. Neither was removed. External MP4 session measurements were inspected and preserved as provenance.

## Authoritative evidence to use

- [Iteration 3 consolidated log](2026-10-26-reviewer-iteration3.md), [final independent fix review](reviewer/2026-10-26-patch-risk-i3-implementation/reports/final-fix-review.md), and [canonical implementation state](reviewer/2026-10-26-patch-risk-i3-implementation/state.json).
- [Iteration 4 consolidated log](2026-10-26-reviewer-iteration4.md), [final validation](reviewer/2026-10-27-reviewer-iteration4-review-fixes/reports/final-validation.json), [independent revalidation](reviewer/2026-10-27-reviewer-iteration4-review-fixes/reports/revalidation.json), [structural status](reviewer/2026-10-27-reviewer-iteration4-review-fixes/reports/structural-status.json), and [canonical review/fix state](reviewer/2026-10-27-reviewer-iteration4-review-fixes/state.json).
- [Requirement traceability](../../workflow/TRACEABILITY.md), [User Guide](../../docs/UserGuide.md) and [Developer Guide](../../docs/DeveloperGuide.md).

Original briefs, canonical state, all matrix histories, immutable generated handoffs, review findings/closures, failed/interrupted attempts, snapshots, test captures, resource records and original token samples remain. Separate workflow-efficiency work from the Iteration 3 chat remains preserved and separate from product-iteration measurements.

Iteration 3's five historical invocation issues and Iteration 4's final **34 cross-run acceptance-evidence gaps** are not reclassified as successful formal closure. All five Iteration 3 findings and four Iteration 4 findings retain their original independently recorded closures. Live AI, human approval and deployment retain their original limitations. This cleanup does not refresh historical snapshots or certify current application acceptance.

## Validation

| Check | Result |
| --- | --- |
| Retained run files | **690/690 SHA-256 and byte counts unchanged** |
| Original iteration logs, workflow-efficiency log, traceability and two guides | **6/6 unchanged** |
| Declared snapshot and handoff artifact hashes | **261 snapshots and 61 handoffs verified** |
| Saved command streams | **2 decoded streams match recorded hashes and lengths**; other captures retained unchanged |
| Local Markdown file links in retained run documents and protected reports/guides | **556 resolve; zero new or existing missing file targets**, with URL decoding and supported line suffixes handled |
| Removed-file replacement locators | All retained files and JSON pointers resolve |
| Current workflow consistency before/after | **All five complete result objects identical**, with digests in the manifest |

Current historical-run diagnostic counts are respectively **75, 173, 69, 171 and 69** in the table's run order. These include current-HEAD freshness and historical bookkeeping issues and differ from the original closure-cutoff counts; they were already present before pruning. The final Iteration 4 closure-cutoff report still records its original 34 cross-run gaps. No tests were rerun solely to refresh metadata. `git diff --check` passed for the deletion patch; final audit links and change scope were checked separately.

During inspection, a strict regeneration check encountered historical handoff-renderer differences; those inputs were retained. Planning retries stopped before deletion on that comparison and on Git's Windows safe-directory spelling. An initial read-only diagnostic invocation also stopped on the latter issue. Per-command forward-slash safe-directory configuration resolved it without modifying global Git settings. Both complete diagnostic passes then succeeded in returning the same non-green historical results. These tool retries fall within the measured main interval; they are not hidden product failures or additional agents.

## Resource record

Interval `2727821de82c4b95b1dcbeaed26c9574` started before the first repository edit. The [resource report](2026-10-27-iteration3-4-cleanup/resources.md) links the original shared-recorder interval and supplies measured UTC boundaries, elapsed time and telemetry coverage. This cleanup interval is separate from both original iteration totals. Inspection, tool retries and waits are included; active CPU/model time and attributable token/cache/tool/retry counters are unavailable. No estimates or account percentages are substituted. Final report/log rendering and response generation occur outside the finished measurement boundary.

## Follow-up: snapshot necessity assessment

The user asked whether the snapshots are needed and requested removal if unnecessary. Read-only inspection found **261 snapshot JSON files, 2,406,604 bytes**, across the same five run directories: 2 preparation and 145 implementation snapshots for Iteration 3; 4 preparation, 89 implementation and 21 review/fix snapshots for Iteration 4. Every file is registered in its original canonical state. All 261 artifact hashes and decoded payloads match their canonical records. There are **zero unregistered/orphan snapshot files**.

These files contain selected file hashes, sizes, Git/diff identifiers and scope metadata, rather than copies of application source. They bind executions, completions, handoffs and finding closures to the content inspected at the time. In `workflow/reviewer/scripts/evidence.py`, `snapshot_matches` requires the registered artifact to exist and match its recorded SHA-256 before checking source freshness; the embedded state payload alone is insufficient for that validator.

**258** snapshot IDs occur in other canonical state records. Of the remaining three, `integrated-docs-review1` and `final-integrated-docs` occur in retained review-preparation scripts; `final-guides` is a standalone registered documentation checkpoint. The latter is historical evidence rather than an active downstream execution prerequisite. All three were retained to keep original registration/artifact references intact. No snapshot, original canonical state, source or test was changed, and no application tests or expensive completeness passes were rerun for this read-only assessment. The prior cleanup manifest remains the historical record of the 141 actual removals.

Removing registered copies while keeping equivalent evidence usable would require a deliberate artifact-storage/validator change with reference migration. That is outside this conditional pruning request. No extra cleanup was justified by the orphan/reference check.

Assessment logging uses shared interval `ef7200a5a93647458e1f8e4160a03f4f`, started before the follow-up repository edit. Read-only discovery preceded that measured interval; it is not represented as measured inspection time. The [follow-up resource report](2026-10-27-iteration3-4-cleanup/snapshot-resources.md) includes actual logging/validation boundaries and unavailable telemetry. No subagents were launched. Final resource rendering and response generation occur outside the finished boundary.

## Superseding evaluation and snapshot cleanup

The user challenged whether every snapshot was necessary for traceability and suggested retaining a workflow log/report instead, then explicitly instructed: **"Review/Evaluate again and clean it up."** This supersedes the conservative retention conclusion above. Human traceability does not require separate copies of every machine manifest. The earlier assessment over-weighted current harness compatibility relative to the user's requested historical cleanup.

Removed **all 261 separate snapshot JSON copies, 2,406,604 bytes**. Together with the initial 141 consumed-input removals, this conversation has removed **402 intermediate files, 2,980,932 bytes**, reducing the five run directories from **831 files to 429**. These are gross reductions within those directories; new audit/retention metadata is separate overhead. Empty snapshot directories contain no files and have no Git representation.

The important distinction is that **no snapshot payload or original hash was lost**. All 261 files matched their registered state records, and all 261 could be reproduced byte-for-byte from `state.json` using the existing canonical JSON serialization. After deletion, the same reconstruction and hash checks passed again from each retained JSON pointer. All five original `state.json` files remain byte-for-byte unchanged. Consequently commands, handoffs, finding closures and completion records retain their snapshot-ID relationships, file hashes, source scopes, Git identifiers and original timings.

The [snapshot-removal manifest](2026-10-27-iteration3-4-cleanup/snapshot-retirement.json) records every removed file's path, SHA-256, byte count and retained payload pointer, along with before/after inventory digests and state hashes. The original 141-file removal manifest remains unchanged as the historical record of the first cleanup.

The [single retained-evidence index](reviewer/RETAINED-EVIDENCE.md) links the authoritative iteration reports, final reviews/validation, original states, requirement traceability and guides. A dated retention notice was inserted into each consolidated iteration report; both original report bodies were otherwise preserved exactly. Those notices supersede earlier descriptions of all artifacts remaining in active CLI format. No direct Markdown snapshot links needed redirection: **1,087 local Markdown file links were screened and none targeted a removed snapshot**.

All **429 remaining run files** are byte-for-byte unchanged, including briefs, requirement/acceptance histories, original handoffs, findings and resolutions, independent reviews, historical passing/failing reports, test captures, command records and resources. External raw usage evidence, source, tests, specifications, guides and the workflow harness remain unchanged. Operational scripts and other outputs were evaluated but retained where they carry unique diagnostic/execution context or are referenced by retained evidence. No additional undocumented pruning occurred.

### What the compacted history supports

The workflow reports and retained records preserve requirements-to-work, ownership, findings-to-fixes, validation results, revision provenance, resource measurements and known limitations. The original five Iteration 3 invocation issues and Iteration 4's final 34 cross-run evidence gaps remain historical facts; no passing closure or current acceptance was fabricated.

Direct CLI artifact verification of these old runs is **retired in their compacted worktree form**: the existing validator still requires the separate artifact paths, which intentionally no longer exist. Original state artifact paths and script references are retained as historical metadata, with this policy made explicit in the retention index. Although snapshot files can be reconstructed exactly, doing so would not make old source freshness current or resolve earlier workflow gaps. No harness checks were weakened, and no current product test result is inferred from historical reports. Application tests and completeness checks were not rerun because this is an evidence-retention change and missing-file diagnostics are intentional.

### Validation and execution notes

- Verified every removed snapshot hash, payload and byte-exact canonical reconstruction before deletion; repeated all 261 reconstructions against retained state after deletion.
- Checked resolved deletion targets are inside the five named snapshot directories; rejected symlinks/junctions, rechecked hashes and removed only individual named files. No recursive deletion occurred.
- Verified all five original state hashes and all 429 retained run-file hashes/byte counts are unchanged.
- Screened 1,087 local Markdown targets for links to removed artifacts; checked the new retention/audit links and all 261 JSON pointers separately. Original report bodies were checked for exact preservation after removing only their newly inserted notices.
- Inspected the final Git change scope and ran `git diff --check`. No source/harness edits or application tests were required.

The first deletion-planning attempt was stopped before any deletion because its Markdown scan redundantly resolved the same target set for each link. The replacement computed that set once and completed. An unrelated non-UTF-8 historical Markdown file encountered during discovery was handled with replacement decoding for read-only scanning; it was not modified. Windows process inspection through CIM was unavailable, so the owned scan was identified with `Get-Process` and stopped by its observed PID. These limitations did not affect retained evidence or validation results.

Resource records: initial attempt [34fc3061210f49c0ba75a90a730cba68](resources/2026-10-27-iteration3-4-cleanup/34fc3061210f49c0ba75a90a730cba68.json) is explicitly interrupted; the successful retry uses [c8cf8774965048b68999e2afbc5e48da](resources/2026-10-27-iteration3-4-cleanup/c8cf8774965048b68999e2afbc5e48da.json). Recording began before the first edit in each attempt. No subagents were launched. Measured resource results follow after actual closure; attributable usage and exact runtime alias/effort remain unavailable, and report rendering/final response lie outside the finished boundaries.

### Snapshot-retirement measured resources

Shared recorder `report` returned `ok: true`, zero unfinished records and no issues across all four declared conversation intervals. The two rows below cover only this superseding cleanup; earlier intervals are not counted again.

| Main stage / attempt | Selected model / effort | Start / end (UTC) | Elapsed seconds | Input / output / cache / tools / retries | Outcome |
| --- | --- | --- | ---: | --- | --- |
| retire-snapshot-copies / 1 | GPT-6 / unavailable | 2026-10-27T09:40:14.038467+00:00 / 2026-10-27T09:44:41.936376+00:00 | 267.897909 | unavailable / unavailable / unavailable / unavailable / unavailable | interrupted |
| retire-snapshot-copies / 2 | GPT-6 / unavailable | 2026-10-27T09:44:42.112200+00:00 / 2026-10-27T09:47:04.237517+00:00 | 142.125317 | unavailable / unavailable / unavailable / unavailable / unavailable | succeeded |

This request: measured boundary span **410.199050s**; summed agent intervals **410.023226s**. Boundaries include inspection, waits, the interrupted scan and retry, rather than CPU/model-only effort. Exact observed model/effort and attributable usage counters are not exposed. All four conversation intervals together sum to 1,052.580014s; intervening user idle time is excluded from that sum and it is not continuous task runtime. Resource rendering and final response occur outside the finished boundaries.
