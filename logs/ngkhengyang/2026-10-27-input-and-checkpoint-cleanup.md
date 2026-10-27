# Consumed-input and checkpoint cleanup

Prompter: **ngkhengyang**, established session identity and Git identity. Date: 27 October 2026, Asia/Singapore. Main runtime identifies GPT-6; exact execution alias/effort and attributable usage counters are unavailable. Applied change-session logging; no subagents.

## Requested sequence

The user requested: remove consumed inputs after preserving unique requirements, decisions and results; **commit** that stage; **then** retain final results and significant failure evidence while consolidating repeated checkpoints. The checkpoint stage follows the commit and is left uncommitted unless separately requested. No push was requested.

## Stage 1: consumed inputs

Removed **196 consumed JSON inputs, 11,180 lines / 575,412 bytes** from five completed run directories. Replaced them with **five `inputs-summary.json` files, 241 lines / 102,971 bytes**. Net reduction within that artifact set: **191 files, 10,939 lines and 472,441 bytes**. Reference edits, this log and resource metadata are separate overhead.

| Original input category | Files |
| --- | ---: |
| Assignment definitions | 16 |
| Verification definitions | 103 |
| Acceptance plans | 9 |
| Handoff requests | 37 |
| Completion requests | 20 |
| Finding requests | 9 |
| Review/closure decisions | 2 |

Every summary entry records the original filename, SHA-256, byte count and input category. Equivalent retained evidence is referenced; **107 entries** also retain unique fields/differences or whole unique decisions that the equivalent did not contain. The remaining entries are fully represented by the retained equivalents. Historical requests are explicitly distinguished from executed results. Actual command outcomes and final result evidence remain in the original reports/state summaries.

All original input payloads were verified against committed JSON at **9a7e5410f38e48a59743f03816dc8d1c75bf1538** before removal. The original path pattern and this commit are in each summary; `git show <source_commit>:<original_input_path>` retrieves the exact original committed payload. Local newline differences are not mistaken for changed JSON semantics.

Original assignment-scope variants, check-definition differences, matrix cases, handoff context, completion risks/next actions and review/closure decisions were compared before deletion. Every supplied field is represented by the equivalent or preserved supplemental fields. Supplementary content is historical and does not replace later decisions.

Updated links in **37 Markdown files** and structured evidence/reference fields in **9 JSON files** to point to per-run summary entries. The retention index explains this migration. Historical handoff artifact hashes remain recorded; a separate `artifact_sha256_after_input_link_migration` verifies each present-day document changed only for link targets. Original handoff content remains in the source commit. Historical path/manifest inventory fields and one-off scripts are retained as provenance, not supported execution/replay links.

### Stage 1 validation

- All **196** original inputs checked for field coverage and original Git recovery; **37** handoff payloads compared against preserved sections and original registrations.
- All **182** retained-equivalent locators resolved, and all **196** new input-summary entry locators resolved before deletion.
- **578 baseline files** outside the declared input/reference/index edits remain byte-for-byte unchanged, including product source, tests, documentation and workflow tooling.
- Recorded resource metrics, commands/results, verification definitions, acceptance cases/matrices and review-cycle outcomes remain unchanged. Scope variants and earlier input differences remain supplemental evidence.
- Candidate hashes were rechecked before individual deletion, with resolved targets restricted to the five named run input directories and symlink/junction traversal rejected. No recursive deletion.
- One validation comparison initially treated migrated completion reference paths as lost original values. The independent comparison was corrected to normalize the declared path migration, and all field-coverage checks passed. No evidence repair or application change was needed.

Source/test behavior did not change; application test suites were not rerun for evidence-only pruning. Link, JSON-pointer and final change-scope checks are recorded at closure below.

### Stage 1 resources and commit boundary

Resource interval [26b24f24685b4db7a99234ac04edea21](resources/2026-10-27-consumed-inputs/26b24f24685b4db7a99234ac04edea21.json) started before the first edit and covers preservation, pruning and validation. Actual timing is appended after completion. Attributable token/cache/tool/retry measurements are unavailable, not estimated. Original implementation measurements remain separate. Commit execution is separately recorded and precedes the checkpoint consolidation stage.

Stage 1 closure checks: **305 local Markdown targets** and **182 equivalent-evidence locators** resolve, including JSON pointers. The tracked diff matches the declared cleanup scope; `git diff --check` passed.

Stage 1 resource report: **ok=true**, one completed interval, no issues. Selected model GPT-6 / effort unavailable; UTC boundaries **2026-10-27T12:10:33.600308+00:00** to **2026-10-27T12:21:45.408177+00:00**; measured span and summed agent elapsed both **671.807869s**. Tokens/cache/tools/retries and observed alias/effort are unavailable. Report rendering and commit execution are outside this finished interval.
