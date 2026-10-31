# Preparation and consolidation resource report

Canonical source: ../state.json. Elapsed includes coordination, tools and waits; active model computation is unavailable. All times below are UTC; Asia/Singapore is UTC+08:00.

| Agent / stage / invocation | Selected model / effort | Start / end UTC | Elapsed seconds | Outcome |
| --- | --- | --- | ---: | --- |
| main / compile / main-prepare-1 | unavailable / unavailable | 2026-10-26T15:26:32.679582+00:00 / 2026-10-26T15:45:05.414746+00:00 | 1112.735164 | succeeded |
| security / security / security-design-1 | gpt-6.1-sol / high | 2026-10-26T15:31:25.896275+00:00 / 2026-10-26T15:34:58.062458+00:00 | 212.166183 | failed |
| security-retry / security / security-design-2 | gpt-6-sol / high | 2026-10-26T15:34:58.748088+00:00 / 2026-10-26T15:42:45.184976+00:00 | 466.436888 | succeeded |
| security-retry / security / security-design-recheck | gpt-6-sol / high | 2026-10-26T15:42:46.187224+00:00 / 2026-10-26T15:45:04.655314+00:00 | 138.468090 | succeeded |
| main / document / main-consolidation-1 | unavailable / unavailable | 2026-10-26T15:45:06.495863+00:00 / 2026-10-26T15:50:46.451233+00:00 | 339.955370 | succeeded |

Preparation excluding later consolidation: {"calendar_seconds": 1111.975732, "summed_agent_elapsed_seconds": 1929.806325, "merged_interval_seconds": 1112.735164}.
All recorded boundaries including separate consolidation: {"calendar_seconds": 1453.771651, "summed_agent_elapsed_seconds": 2269.761695, "merged_interval_seconds": 1452.6905339999998}.

Three actual agents; retry and recheck are the same child chat. Main compilation overlaps read-only security, so summed elapsed differs from calendar/merged coverage. No same-agent overlapping logical ownership intervals were created. These are elapsed measurements, not causal time saved.

Exact input/output/cache/tool/retry counters and observed model/effort remain unavailable per record. Selected child settings are declared; main settings are not exposed. External samples provide per-thread counters and explicit cutoffs without importing them into misaligned records. Cached input is within input; reasoning within output. No account percentages, monetary estimates or whole-thread totals are attributed to multiple stages.

Initial instruction discovery/recorder bootstrap preceded the first measured interval. Final bundle/resource/log rendering, link checks on rendered outputs and final response lie outside the finished consolidation interval. No implementation timing exists.
