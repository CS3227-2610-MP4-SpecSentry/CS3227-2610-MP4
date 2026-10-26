# Workflow version 3 resource report

Derived from the shared resource-session CLI. One main agent; implementation, validation, follow-up fix, and consolidation are separate intervals.

| Agent / stage / attempt | Model / effort | Start / end (UTC) | Elapsed seconds | Input / output tokens | Status |
| --- | --- | --- | --- | --- | --- |
| main / implement / 1 | gpt\-6.1\-sol / high | 2026\-10\-26T06:51:22.595086\+00:00 / 2026\-10\-26T07:10:01.181714\+00:00 | 1118.586628 | unavailable / unavailable | succeeded |
| main / fix / 1 | gpt\-6.1\-sol / high | 2026\-10\-26T07:13:18.707317\+00:00 / 2026\-10\-26T07:16:52.790865\+00:00 | 214.083548 | unavailable / unavailable | succeeded |
| main / revalidate / 1 | gpt\-6.1\-sol / high | 2026\-10\-26T07:10:03.211500\+00:00 / 2026\-10\-26T07:13:16.736256\+00:00 | 193.524756 | unavailable / unavailable | succeeded |
| main / consolidate / 1 | gpt\-6.1\-sol / high | 2026\-10\-26T07:16:54.820862\+00:00 / 2026\-10\-26T07:18:49.393020\+00:00 | 114.572158 | unavailable / unavailable | succeeded |

## Interval provenance

- [0e5cb2bf09a443ce9bd05ddbf9cc6c0b](../resources/2026-10-26-reviewer-workflow-v3/0e5cb2bf09a443ce9bd05ddbf9cc6c0b.json): implement; Implemented version 3 workflow tooling and documentation; preliminary harness checks complete, final validation follows
- [3dc72ec4f6064499b9dc044841758c10](../resources/2026-10-26-reviewer-workflow-v3/3dc72ec4f6064499b9dc044841758c10.json): fix; Direct database verification now requires fixture validation; all 13 affected version 3 harness tests passed
- [4ce06ccccb314013a134f8c50c4bef68](../resources/2026-10-26-reviewer-workflow-v3/4ce06ccccb314013a134f8c50c4bef68.json): revalidate; Full harness suite passed: 74 tests, 2 privilege skips; self-review identified direct database verification fixture prerequisite gap for follow-up
- [5ed361107b20406bafd6d597630a5d53](../resources/2026-10-26-reviewer-workflow-v3/5ed361107b20406bafd6d597630a5d53.json): consolidate; Consolidated workflow change report, verified local evidence links and 14 source hashes; final resource rendering follows outside this interval

Summed interval elapsed: 1640.767090 seconds.
Merged recorded coverage: 1640.767090 seconds.
Recorded calendar span: 1646.797934 seconds.

Measured telemetry coverage: {"cache_read_tokens": 0, "input_tokens": 0, "output_tokens": 0, "retries": 0, "tool_calls": 0}.
Null counters are unavailable, not measured zero. Selected settings: gpt-6.1-sol / high. Observed model/effort and per-stage counters are unavailable.

Unavailable reasons:

- Per-stage token, cache, tool-call and retry telemetry is not exposed

Final resource-view rendering, its link/hash checks, and final response generation occur after the last measured interval. These are elapsed intervals including waits, not model/CPU computation time.

[Structured report](resource-summary.json)
