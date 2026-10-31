# Fix and revalidation resources

Calendar span 3353.889s; raw logical interval sum 9746.349s; actual-executor summed elapsed 9731.366s (same-main overlaps deduplicated); overlap-aware elapsed 3352.258s.

Intervals include coordination, subprocess checking and waiting, not measured active computation. Worker fix intervals extend through coordinator validation. Documentation evidence-refresh ownership rows share main execution; they are not extra workers. Final rendering/reply is outside finished intervals.

| Owner / invocation / stage | Actual executor | Selected model / effort | UTC start | UTC end | Seconds | Status |
| --- | --- | --- | --- | --- | ---: | --- |
| main / findings-fix-coordination / integrate | main | GPT-6 / unavailable | 2026-10-26T12:05:31.173540+00:00 | 2026-10-26T12:49:41.048795+00:00 | 2649.875 | succeeded |
| gateway / findings-fix-1 / fix | /root/gateway_fixes | gpt-6.1-sol / high | 2026-10-26T12:09:59.524265+00:00 | 2026-10-26T12:37:25.298809+00:00 | 1645.775 | succeeded |
| ui / findings-fix-1 / fix | /root/ui_fix | gpt-6.1-sol / medium | 2026-10-26T12:10:04.467133+00:00 | 2026-10-26T12:37:30.413884+00:00 | 1645.947 | succeeded |
| reviewer-integration / findings-fix-1 / fix | /root/contention_fix | gpt-6.1-sol / high | 2026-10-26T12:10:09.469316+00:00 | 2026-10-26T12:45:56.601190+00:00 | 2147.132 | succeeded |
| code-security / security-fix-1 / security | /root/code_security | gpt-6.1-sol / high | 2026-10-26T12:38:18.885064+00:00 | 2026-10-26T12:44:25.628438+00:00 | 366.743 | succeeded |
| independent-review / revalidate-1 / revalidate | /root/independent_reviewer | gpt-6.1-sol / high | 2026-10-26T12:46:03.495265+00:00 | 2026-10-26T12:50:17.782602+00:00 | 254.287 | succeeded |
| main / findings-fix-document / document | main | GPT-6 / unavailable | 2026-10-26T12:49:43.019520+00:00 | 2026-10-26T13:00:42.092110+00:00 | 659.073 | succeeded |
| gateway / documentation-evidence-refresh / fix | main | GPT-6 / unavailable | 2026-10-26T12:53:11.501880+00:00 | 2026-10-26T12:53:16.302451+00:00 | 4.801 | succeeded |
| ui / documentation-evidence-refresh / fix | main | GPT-6 / unavailable | 2026-10-26T12:53:19.707450+00:00 | 2026-10-26T12:53:24.417422+00:00 | 4.710 | succeeded |
| reviewer-integration / documentation-evidence-refresh / fix | main | GPT-6 / unavailable | 2026-10-26T12:53:27.769314+00:00 | 2026-10-26T12:53:33.242611+00:00 | 5.473 | succeeded |
| independent-review / final-scope-confirmation / revalidate | /root/independent_reviewer | gpt-6.1-sol / high | 2026-10-26T12:53:34.704683+00:00 | 2026-10-26T12:56:29.342999+00:00 | 174.638 | succeeded |
| independent-review / final-closure-confirmation / revalidate | /root/independent_reviewer | gpt-6.1-sol / high | 2026-10-26T12:57:17.528043+00:00 | 2026-10-26T12:59:44.083962+00:00 | 146.556 | succeeded |
| main / findings-fix-close / close | main | GPT-6 / unavailable | 2026-10-26T13:00:43.722538+00:00 | 2026-10-26T13:01:25.062096+00:00 | 41.340 | succeeded |

Exact stage-aligned tokens/cache/tool/retry counts and observed model/effort remain unavailable. Canonical records retain explicit reasons. No aggregate parent-plus-children counters are imported into main.

Earlier implementation attempts including capacity/usage failures are preserved in [pre-review resources](resources.md), [review resources](independent-review-resources.md) and [canonical records](../state.json). They are not reclassified as successful by subsequent completion.

## Sampled current-workflow window

External collector baseline: 2026-10-26-patch-risk-fix1-main-start.json. End delta: 2026-10-26-patch-risk-fix1-final-window.json. Per-stage baselines/end samples are retained alongside it in MP4 sessions/local-resource-tracking; overlapping samples must not be summed. The table below uses one window and each thread once.

| Thread / agent | Input | Cached subset | Output incl reasoning | Cutoff UTC |
| --- | ---: | ---: | ---: | --- |
| main / 01a17748-0c1a-7da1-b49b-024a8cd4b71b | 9369695 | 9207168 | 38177 | 2026-10-26T13:00:43.958Z |
| /root/security / 01a1774d-c902-7d72-b112-36f63937dacf | 0 | 0 | 0 | 2026-10-26T08:31:33.591Z |
| /root/foundation / 01a17766-5ef9-7432-9bd2-6429bcb2bb58 | 0 | 0 | 0 | 2026-10-26T08:56:00.651Z |
| /root/gateway / 01a1776f-8940-7730-a443-39f050ef43d4 | 0 | 0 | 0 | 2026-10-26T09:01:33.642Z |
| /root/reviewer_integration / 01a1776f-d537-79e1-a72b-b404c1ff8660 | 0 | 0 | 0 | 2026-10-26T09:07:56.555Z |
| /root/ui / 01a17770-2a4c-7f52-a86f-ecf7dfb34382 | 0 | 0 | 0 | 2026-10-26T09:01:05.974Z |
| /root/ui_retry / 01a17772-10a2-7b70-a576-86b500153c2a | 0 | 0 | 0 | 2026-10-26T09:07:17.212Z |
| /root/gateway_retry / 01a17773-051c-7840-ae78-b477d5d79433 | 0 | 0 | 0 | 2026-10-26T09:07:13.140Z |
| /root/independent_reviewer / 01a17807-8dd8-7db2-a423-3b3d6982e00e | 2992755 | 2946304 | 8409 | 2026-10-26T12:58:56.360Z |
| /root/code_security / 01a17808-27d8-7d70-b597-476e9fd08dbd | 1087166 | 1070208 | 6245 | 2026-10-26T12:42:55.812Z |
| /root/gateway_fixes / 01a1781e-4dee-7e71-810d-2c309de5bedf | 1499966 | 1457152 | 12405 | 2026-10-26T12:18:03.174Z |
| /root/ui_fix / 01a1781e-c0bc-7610-b52d-68c92a86816e | 659644 | 590848 | 3218 | 2026-10-26T12:13:19.528Z |
| /root/contention_fix / 01a1781e-e916-78b3-bd6e-ad9f33821617 | 1004455 | 962688 | 7525 | 2026-10-26T12:16:20.637Z |

Sampled at 2026-10-26T13:01:25.988908+00:00; distinct sessions 13; skipped headers 0. Counters can lag; final replies and work after each cutoff are not included. Cache is already a subset of input; reasoning is included in output. These are developer-agent samples, not product provider usage or a billing statement.

No exact model-computation/idle duration, dollar cost or causal workflow savings are inferred. No explicit token budget was supplied.
