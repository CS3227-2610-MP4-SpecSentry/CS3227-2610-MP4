# Final resource ledger

38 intervals finished; 0 running. Human verification pending.

Calendar span: 35086.639s (includes pauses). Summed stage elapsed: 14261.372s. Merged observed interval coverage: 6843.625s.

Sampled totals only: {"input_tokens": 102059741, "output_tokens": 265170, "cache_read_tokens": 101295744, "tool_calls": null, "retries": null}. Coverage: {"input_tokens": 37, "output_tokens": 37, "cache_read_tokens": 37, "tool_calls": 0, "retries": 0} / 38 records per metric.

| Agent / invocation / stage / attempt | Selected model / effort | Start → end (Asia/Singapore) | Elapsed s / status | Input / output / cache (included) | Source record |
| --- | --- | --- | --- | --- | --- |
| main / main-prep-1 / compile / 1 | unavailable / unavailable | 2026-11-04T18:35:01+08:00 → 2026-11-04T18:40:23+08:00 | 322.038 / succeeded | 1892354 / 11257 / 1820672 | [rec-f462cbde1be242fc](../../2026-11-04-reviewer-completion/state.json) |
| security / security-design-1 / security / 1 | gpt-6.1-sol / high | 2026-11-04T18:38:13+08:00 → 2026-11-04T18:42:01+08:00 | 228.404 / succeeded | 1276710 / 5770 / 1211648 | [rec-e00e8eae18874575](../../2026-11-04-reviewer-completion/state.json) |
| main / main-contracts-1 / security / 1 | unavailable / unavailable | 2026-11-04T18:40:24+08:00 → 2026-11-04T18:43:03+08:00 | 159.164 / succeeded | 1316614 / 3792 / 1312384 | [rec-73cc09b38ec24410](../../2026-11-04-reviewer-completion/state.json) |
| main / main-checkpoint-consolidation-1 / close / 1 | unavailable / unavailable | 2026-11-04T18:43:04+08:00 → 2026-11-04T18:45:12+08:00 | 128.633 / succeeded | 381578 / 6047 / 377728 | [rec-eae61ec091584765](../../2026-11-04-reviewer-completion/state.json) |
| main / main-resume-1 / dispatch / 1 | unavailable / unavailable | 2026-11-04T20:23:05+08:00 → 2026-11-04T20:27:13+08:00 | 247.705 / succeeded | 1575680 / 8317 / 1551616 | [rec-0e1ad746f26847fe](../../2026-11-04-reviewer-execution/state.json) |
| dashboard / dashboard-implement-1 / implement / 1 | gpt-6.1-sol / high | 2026-11-04T20:25:52+08:00 → 2026-11-04T20:36:40+08:00 | 647.358 / interrupted | 3262351 / 23200 / 3209216 | [rec-5413d89182894dcc](../../2026-11-04-reviewer-execution/state.json) |
| evaluation / evaluation-implement-1 / implement / 1 | gpt-6.1-sol / medium | 2026-11-04T20:25:55+08:00 → 2026-11-04T20:36:28+08:00 | 632.674 / interrupted | 3721084 / 18319 / 3669504 | [rec-89c82d2f8080450c](../../2026-11-04-reviewer-execution/state.json) |
| security / security-retention-1 / security / 1 | gpt-6.1-sol / high | 2026-11-04T20:26:58+08:00 → 2026-11-04T20:28:32+08:00 | 94.373 / succeeded | 350539 / 1157 / 346496 | [rec-8531c76407be48db](../../2026-11-04-reviewer-execution/state.json) |
| main / main-environment-1 / compile / 1 | unavailable / unavailable | 2026-11-04T20:27:13+08:00 → 2026-11-04T20:37:16+08:00 | 602.976 / failed | 5917219 / 14985 / 5896576 | [rec-9e289f962b2d4873](../../2026-11-04-reviewer-execution/state.json) |
| retention / retention-1 / implement / 1 | gpt-6.1-sol / high | 2026-11-04T20:30:44+08:00 → 2026-11-04T20:42:40+08:00 | 715.926 / succeeded | 3460692 / 16645 / 3435264 | [0f76c1d42e9d4417a40f7195e3b9156f](../../../resources/2026-11-04-ai-retention/0f76c1d42e9d4417a40f7195e3b9156f.json) |
| main / main-validation-recovery-1 / dispatch / 1 | unavailable / unavailable | 2026-11-04T20:37:17+08:00 → 2026-11-04T20:44:27+08:00 | 430.028 / succeeded | 4282353 / 11978 / 4268032 | [rec-378a679e3dcb456d](../state.json) |
| evaluation / evaluation-implement-2 / implement / 2 | gpt-6.1-sol / medium | 2026-11-04T20:42:01+08:00 → 2026-11-04T20:47:40+08:00 | 339.050 / succeeded | 2868740 / 5214 / 2858752 | [rec-678d7c8324ef4cc1](../state.json) |
| dashboard / dashboard-implement-2 / implement / 2 | gpt-6.1-sol / high | 2026-11-04T20:42:11+08:00 → 2026-11-04T20:59:24+08:00 | 1033.611 / succeeded | 6427181 / 8703 / 6403456 | [rec-95237763f2b44d96](../state.json) |
| main / main-document-1 / document / 1 | unavailable / unavailable | 2026-11-04T20:44:28+08:00 → 2026-11-04T20:47:28+08:00 | 180.021 / succeeded | 1314814 / 5370 / 1307008 | [rec-fee7b56af87d4cc7](../state.json) |
| retention / retention-verify-1 / verify / 1 | gpt-6.1-sol / high | 2026-11-04T20:46:35+08:00 → 2026-11-04T20:48:19+08:00 | 104.444 / failed | 835135 / 1348 / 826368 | [9c4df6f6fbec422ea02945edf66271f0](../../../resources/2026-11-04-ai-retention/9c4df6f6fbec422ea02945edf66271f0.json) |
| main / main-requirements-recheck-1 / compile / 1 | unavailable / unavailable | 2026-11-04T20:47:28+08:00 → 2026-11-04T20:49:40+08:00 | 131.723 / succeeded | 908079 / 5672 / 903552 | [rec-4ca9c50bbf28494a](../state.json) |
| retention / retention-fix-1 / fix / 1 | gpt-6.1-sol / high | 2026-11-04T20:48:19+08:00 → 2026-11-04T20:50:06+08:00 | 106.243 / failed | 714509 / 2575 / 705792 | [237baa8a0de24e0e8879d5ba4f52cbb2](../../../resources/2026-11-04-ai-retention/237baa8a0de24e0e8879d5ba4f52cbb2.json) |
| main / main-monitor-1 / dispatch / 1 | unavailable / unavailable | 2026-11-04T20:49:41+08:00 → 2026-11-04T21:07:27+08:00 | 1066.170 / interrupted | unavailable / unavailable / unavailable | [rec-ec676c674ad04133](../state.json) |
| retention / retention-fix-2 / fix / 2 | gpt-6.1-sol / high | 2026-11-04T20:50:06+08:00 → 2026-11-04T20:53:54+08:00 | 228.182 / succeeded | 1337117 / 6832 / 1322368 | [764ea8546b8945549ebf783cd4bce26c](../../../resources/2026-11-04-ai-retention/764ea8546b8945549ebf783cd4bce26c.json) |
| dashboard / dashboard-integrate-1 / integrate / 1 | gpt-6.1-sol / high | 2026-11-04T21:00:00+08:00 → 2026-11-04T21:03:21+08:00 | 201.736 / interrupted | 2662527 / 5018 / 2647808 | [rec-1987b796d6174ef5](../state.json) |
| main / main-resume2-1 / dispatch / 1 | unavailable / unavailable | 2026-11-04T21:07:28+08:00 → 2026-11-04T21:42:32+08:00 | 2103.992 / succeeded | 24740810 / 17061 / 24704000 | [rec-324eb55e3cf04795](../state.json) |
| retention-resume / retention-resume2 / fix / 2 | gpt-6.1-sol / medium | 2026-11-04T21:08:57+08:00 → 2026-11-04T21:14:26+08:00 | 329.174 / succeeded | 1095446 / 2381 / 1087104 | [4878015ee1a1433099067eeda4564ba5](../../../resources/2026-11-04-ai-retention/4878015ee1a1433099067eeda4564ba5.json) |
| dashboard / dashboard-fix-resume2 / fix / 1 | gpt-6.1-sol / high | 2026-11-04T21:09:03+08:00 → 2026-11-04T21:13:39+08:00 | 276.325 / succeeded | 1387640 / 4557 / 1354624 | [rec-c44874be8cc44fb6](../state.json) |
| dashboard / dashboard-integrate-resume2 / integrate / 1 | gpt-6.1-sol / high | 2026-11-04T21:13:54+08:00 → 2026-11-04T21:15:18+08:00 | 84.214 / failed | 622897 / 1844 / 615936 | [rec-56a8d16a20b74693](../state.json) |
| evaluation / evaluation-fix-resume2 / fix / 1 | gpt-6.1-sol / medium | 2026-11-04T21:16:21+08:00 → 2026-11-04T21:18:37+08:00 | 136.664 / succeeded | 597253 / 1595 / 580608 | [rec-5961c35aae354a6a](../state.json) |
| dashboard / dashboard-integrate-resume3 / integrate / 1 | gpt-6.1-sol / high | 2026-11-04T21:19:03+08:00 → 2026-11-04T21:29:21+08:00 | 618.186 / failed | 4041325 / 7604 / 4013952 | [rec-bfd3c739599340a5](../state.json) |
| dashboard / dashboard-admin-resume3 / document / 1 | gpt-6.1-sol / high | 2026-11-04T21:29:43+08:00 → 2026-11-04T21:30:42+08:00 | 58.936 / succeeded | 504341 / 1127 / 502528 | [rec-0367f271b90341e7](../state.json) |
| gateway-tests / gateway-tests-diagnose1 / implement / 1 | gpt-6.1-sol / high | 2026-11-04T21:30:53+08:00 → 2026-11-04T21:38:48+08:00 | 475.733 / succeeded | 2418746 / 9119 / 2392832 | [rec-4b3d18a909e24a2b](../state.json) |
| dashboard / dashboard-integrate-resume4 / integrate / 1 | gpt-6.1-sol / high | 2026-11-04T21:38:01+08:00 → 2026-11-04T21:41:17+08:00 | 195.778 / failed | 1464140 / 3402 / 1458944 | [rec-903ec9e3cf714ab4](../state.json) |
| main / main-consolidation-resume2 / close / 1 | unavailable / unavailable | 2026-11-04T21:42:32+08:00 → 2026-11-04T21:48:38+08:00 | 365.235 / interrupted | 5675231 / 6118 / 5665152 | [rec-1f08a79ebb7d441b](../state.json) |
| verifier / verifier-security1 / security / 1 | gpt-6.1-sol / high | 2026-11-04T21:42:43+08:00 → 2026-11-04T21:46:04+08:00 | 200.300 / succeeded | 827805 / 2716 / 729984 | [rec-7c87a59d95a94a8e](../state.json) |
| verifier / verifier-review1 / review / 1 | gpt-6.1-sol / high | 2026-11-04T21:45:44+08:00 → 2026-11-04T21:49:15+08:00 | 211.375 / succeeded | 1175299 / 4235 / 1166080 | [rec-95eda3dc3b404ace](../state.json) |
| evaluation / evaluation-f001 / fix / 1 | gpt-6.1-sol / medium | 2026-11-04T21:47:58+08:00 → 2026-11-04T21:48:11+08:00 | 12.932 / interrupted | 76591 / 318 / 76032 | [rec-1e4dcce8616a4010](../state.json) |
| main / main-f001-resume3 / dispatch / 1 | unavailable / unavailable | 2026-11-05T04:02:04+08:00 → 2026-11-05T04:07:53+08:00 | 348.830 / succeeded | 3516718 / 8607 / 3510272 | [rec-974b303721164956](../state.json) |
| evaluation / evaluation-f001-resume3 / fix / 1 | gpt-6.1-sol / medium | 2026-11-05T04:03:34+08:00 → 2026-11-05T04:09:08+08:00 | 333.907 / succeeded | 1521691 / 5582 / 1505280 | [rec-410a44abf6014abb](../state.json) |
| main / main-f001-docs / document / 1 | unavailable / unavailable | 2026-11-05T04:07:53+08:00 → 2026-11-05T04:10:13+08:00 | 139.653 / succeeded | 2897807 / 5784 / 2893056 | [rec-e8ebfe6de0464986](../state.json) |
| verifier / verifier-f001-resume3 / revalidate / 1 | gpt-6.1-sol / medium | 2026-11-05T04:10:00+08:00 → 2026-11-05T04:13:14+08:00 | 194.780 / succeeded | 515722 / 3085 / 496640 | [rec-59390f005e08461b](../state.json) |
| main / main-final-consolidation3 / close / 1 | unavailable / unavailable | 2026-11-05T04:10:13+08:00 → 2026-11-05T04:19:48+08:00 | 574.899 / succeeded | 4475003 / 17836 / 4468480 | [rec-59ba54302cf54b59](../state.json) |

## Limits

- Calendar span includes user pauses; merged observed intervals include the explicitly unknown idle gap in the recovered main monitor. None measures CPU/model computation.
- Summed stage elapsed overlaps across agents and briefly across administrative verifier stages; no schedule savings or billing inference.
- Input includes cache; output includes reasoning. Unavailable counters are null, never measured zero. Samples exclude unflushed/bootstrap/final tails as each source records.
- The main pause-recovery interval has unavailable attributable token telemetry; do not import cumulative idle-era totals into it.
- Preparation, failed bootstrap execution, active validation and generic shared intervals are counted once by unique record ID. Per-stage actual-thread sources/cutoffs remain in rows.
- Final resource/report rendering and final answer follow the last closed interval; this is measurement rendering, not more implementation.

Exact source/cutoff/unavailable metadata: [full ledger](final-resources.json).
