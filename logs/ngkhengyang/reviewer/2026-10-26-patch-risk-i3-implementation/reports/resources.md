# Pre-review resource report

Calendar span: 8318.417 seconds. Summed actual-agent elapsed (same-executor overlap deduplicated): 21244.569 seconds. Overlap-aware elapsed across agents: 8317.310 seconds. Raw logical-interval sum (not actual-agent total): 30654.675 seconds.

Boundaries are coordinator-observed and include scheduling, waiting and an unknown idle period across the user continuation/account limit. No precise inactive/model-computation duration is inferred. Initial read-only bootstrap and final report/response rendering are outside their respective finished intervals.

| Stage / logical owner / invocation | Actual executor | Selected model / effort | Start UTC | End UTC | Seconds | Outcome |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| compile / main / main-resume | main | GPT-6 / unavailable | 2026-10-26T08:45:16.620631+00:00 | 2026-10-26T08:48:52.799034+00:00 | 216.178 | succeeded |
| dispatch / main / main-resume | main | GPT-6 / unavailable | 2026-10-26T08:48:53.906644+00:00 | 2026-10-26T09:00:21.362923+00:00 | 687.456 | succeeded |
| implement / foundation / foundation-1 | /root/foundation | gpt-6.1-sol / high | 2026-10-26T08:48:56.667480+00:00 | 2026-10-26T08:57:51.709605+00:00 | 535.042 | succeeded |
| implement / gateway / gateway-1 | /root/gateway | gpt-6.1-sol / high | 2026-10-26T08:58:03.086643+00:00 | 2026-10-26T09:02:38.452550+00:00 | 275.366 | failed |
| implement / reviewer-integration / integration-1 | /root/reviewer_integration | gpt-6.1-sol / high | 2026-10-26T08:58:12.227664+00:00 | 2026-10-26T10:07:07.795004+00:00 | 4135.567 | interrupted |
| implement / ui / ui-1 | /root/ui | gpt-6.1-sol / medium | 2026-10-26T08:58:21.751890+00:00 | 2026-10-26T09:01:37.071253+00:00 | 195.319 | failed |
| integrate / main / main-resume | main | GPT-6 / unavailable | 2026-10-26T09:00:22.583544+00:00 | 2026-10-26T11:03:55.037768+00:00 | 7412.454 | succeeded |
| implement / ui / ui-2 | /root/ui_retry | gpt-6-sol / medium | 2026-10-26T09:01:42.835100+00:00 | 2026-10-26T10:07:06.864974+00:00 | 3924.030 | interrupted |
| implement / gateway / gateway-2 | /root/gateway_retry | gpt-6-sol / high | 2026-10-26T09:02:44.175015+00:00 | 2026-10-26T10:07:07.330035+00:00 | 3863.155 | interrupted |
| implement / gateway / coordinator-takeover | main | GPT-6 / unavailable | 2026-10-26T10:08:10.294694+00:00 | 2026-10-26T11:00:18.049004+00:00 | 3127.754 | succeeded |
| implement / reviewer-integration / coordinator-takeover | main | GPT-6 / unavailable | 2026-10-26T10:08:15.218073+00:00 | 2026-10-26T11:00:23.770023+00:00 | 3128.552 | succeeded |
| implement / ui / coordinator-takeover | main | GPT-6 / unavailable | 2026-10-26T10:08:20.009228+00:00 | 2026-10-26T11:00:29.873081+00:00 | 3129.864 | succeeded |
| fix / foundation / coordinator-revalidate | main | GPT-6 / unavailable | 2026-10-26T10:49:07.813002+00:00 | 2026-10-26T10:49:31.749683+00:00 | 23.937 | succeeded |

Exact record-aligned input/output/cache/tool/retry counters and observed model/effort are unavailable. Captured runtime deltas are sampled windows with lagging cutoffs; they are not imported into logical ownership records. Coordinator takeover rows run on the same actual main thread, so neither tokens nor elapsed time is duplicated as independent agents.

Main and descendant sampled evidence is in the external MP4 sessions collector files. Cache is already included in input and reasoning in output. No billing, model-computation or workflow-savings claim is made. Product AI usage is separate from these development-agent measurements.

Historical independent security design review is in the earlier preparation run; its elapsed/tokens are not added to this execution run. Independent implementation review is unstarted by user instruction.
