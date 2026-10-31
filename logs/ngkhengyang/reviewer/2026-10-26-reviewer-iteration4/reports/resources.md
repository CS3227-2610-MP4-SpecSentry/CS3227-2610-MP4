# Preparation and separate documentation resource report

Canonical source: ../state.json; six actual stage/attempt records, three agents. Times are UTC (Asia/Singapore UTC+08:00). Elapsed includes coordination/tools/waits; active computation unavailable.

| Agent / stage / invocation | Selected model / effort | Start / end UTC | Elapsed seconds | Outcome |
| --- | --- | --- | ---: | --- |
| main / compile / main-prepare-1 | unavailable / unavailable | 2026-10-26T15:26:32.679582+00:00 / 2026-10-26T15:45:05.414746+00:00 | 1112.735164 | succeeded |
| security / security / security-design-1 | gpt-6.1-sol / high | 2026-10-26T15:31:25.896275+00:00 / 2026-10-26T15:34:58.062458+00:00 | 212.166183 | failed |
| security-retry / security / security-design-2 | gpt-6-sol / high | 2026-10-26T15:34:58.748088+00:00 / 2026-10-26T15:42:45.184976+00:00 | 466.436888 | succeeded |
| security-retry / security / security-design-recheck | gpt-6-sol / high | 2026-10-26T15:42:46.187224+00:00 / 2026-10-26T15:45:04.655314+00:00 | 138.468090 | succeeded |
| main / document / main-consolidation-1 | unavailable / unavailable | 2026-10-26T15:45:06.495863+00:00 / 2026-10-26T15:50:46.451233+00:00 | 339.955370 | succeeded |
| main / document / main-render-correction-1 | unavailable / unavailable | 2026-10-26T15:51:23.889234+00:00 / 2026-10-26T15:53:35.673623+00:00 | 131.784389 | succeeded |

preparation_excluding_later_documentation: {"calendar_seconds": 1112.735164, "summed_agent_elapsed_seconds": 1929.806325, "merged_interval_seconds": 1112.735164}.

all_recorded_including_consolidation_and_correction: {"calendar_seconds": 1622.994041, "summed_agent_elapsed_seconds": 2401.546084, "merged_interval_seconds": 1584.474923}.

Initial renderer used last-started interval end; corrected calendar to latest end minus earliest start. Initial renders and raw intervals retained.
Original preparation totals remain in initial-render-resource-totals.json; initial-render-resources.md and initial-render-pause-bundle.json preserve their historical association. No raw timestamps were changed.

Retry/recheck share one actual child. Main compilation overlaps security; summed durations are not wall time or model computation. No causal savings claim is made. Observed model/effort, exact aligned tokens/cache/tools/retries remain unavailable per record. Collector samples lag boundaries and are retained as separate per-thread windows outside Git; no parent-plus-children total is imported into main. Cache is included in input and reasoning in output.

See external iteration4-01a178d0-sampled-usage.md for original five sampled windows and iteration4-01a178d0-render-correction-end.json for this correction window. Do not sum overlapping windows. Final generated-report/measurement rendering, local rendered-link checks and the final response occur outside the finished intervals.
