# Adaptable consolidated report outline

Use the sections that carry evidence for the requested run. Keep one canonical narrative and link detailed records. Empty evidence is a limitation to report, not an invitation to reconstruct precise measurements.

## Overview and requests

Run identifier; prompter and identity source; goal and delivered result; scope/exclusions; baseline/final reviewed source; execution cutoff/timezone. Summarize the initiating request and meaningful steering, with outcomes, deferrals, and corrections.

## Execution and agent contributions

Explain the dependency sequence, actual parallel work, integration/review loops, interruptions, and recovery.

| Agent / invocation | Responsibility and owned artifacts | Work and findings | Selected model / effort; observed if exposed | Outcome / evidence |
| --- | --- | --- | --- | --- |

Add short per-agent accounts where needed to explain specific work, discoveries, and fixes. Identify coordinator integration work and unsuccessful attempts as well as worker implementation.

## Findings and rework

| Finding / discovery source | Affected behavior and evidence | Fix or disposition / owner | Revalidation / remaining gap |
| --- | --- | --- | --- |

Include initial failed checks and meaningful supersession. Preserve accepted/deferred risks separately from closed findings.

## Delivered scope and validation

Map delivered features or acceptance scenarios to changed artifacts and final check evidence. If requested, include added/deleted/net lines and file counts by category with baseline, new-file treatment, and exclusions. Distinguish cumulative tests from newly introduced scenarios.

| Check / acceptance scope | Command or evidence reference | Result / counts | Tested source and limits |
| --- | --- | --- | --- |

State independent review results, structural completeness, unavailable checks, and remaining acceptance gaps separately.

## Process timings and resource use

| Agent / stage / attempt | Selected and observed settings | Start / end with timezone | Elapsed | Tokens / cache / tools / retries | Outcome / source / unavailable reason |
| --- | --- | --- | --- | --- | --- |

Provide per-agent aggregates only with compatible scopes and deduplication. State calendar span, merged coverage, summed elapsed, waiting/idle/interruption limitations, and telemetry coverage. Preserve retrospective token corrections with original and corrected scopes and source references.

If requested, add concurrency windows, peak distinct executing agents, and explicitly defined schedule-compression calculations. Keep causal time-saved claims separate. Cross-run comparisons need common definitions, quality outcomes, scope/setup differences, and explicit limits on productivity inference.

## Workflow problems and improvements

| Observed workflow problem / evidence | Impact | Improvement actually made / validation | Pending action or experiment |
| --- | --- | --- | --- |

Distinguish product fixes from changes to coordination, tooling, instructions, or measurement. Record improvements already adopted from earlier work with their original provenance. Prioritize proposals using observed failures or overhead; mark their benefit untested until evaluated.

## Evidence retention and consolidation record

Identify canonical records, superseded summaries, redirects, and any authorized cleanup. Explain retained failure history and review provenance, plus any reduced reconstruction/resumption capability.

Record this report's separate authoring/validation interval and resource reference, checks actually performed, and missing telemetry. Exclude this follow-up from original-run resource totals. State what historical implementation state the report describes.
