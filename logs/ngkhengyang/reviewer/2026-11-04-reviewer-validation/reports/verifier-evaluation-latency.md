# C3 evaluation latency finding evidence

Independent verifier, `verifier-review1`; source HEAD 8707d19b94f1bf00e26564b67c84a0e76eee42f8, integration-source-resume3 (152/152 hashes match). Product/test sources are read-only.

The settled C3 brief (`../2026-11-04-reviewer-completion/brief.md`, C3) explicitly requires measured latency and p50/p95 where enough observations exist. AI-SECURITY-SPEC AI Evaluation Gates sets median <8s and p95 <18s. `src/server/src/ai/reviewer-live-verification.ts:85` returns only case metadata and `passed` based on status; it has no aggregate latency metrics or explicit latency-gate outcome. `verify-live-ai.mjs` prints this report and uses passed for exit status. This does not establish actual live latency, and the defect exists before provider activation.

One native `node` stdin probe loaded the current compiled `verifyReviewerLive` and `readAiConfig`, passed only a fixed synthetic model/key/config, an injected no-network transport and clock. Each response advanced the clock 19,000ms (inside the existing 20s deadline), returned strict selected-ID coverage plus valid usage, and contained no human/business mutations. Observed stdout:

```json
{"synthetic":true,"providerCalls":0,"admitted":9,"passed":true,"latencies":[19000,19000,19000,19000,19000,19000,19000,19000,19000],"percentileFields":[]}
```

No database, provider call, credential inspection, build, source/test edit or broad regression rerun. The injected transport is evidence about the reporting path, not provider performance.

Required bounded fix: add the requested sample count and median/p95 summary using a declared simple percentile rule; expose latency target outcome separately and truthfully (dry-run/no samples unavailable). Ensure the aggregate report/CLI cannot be read as passing every declared evaluation target when this measured latency target fails; either incorporate the target in passed or explicitly name the narrower success contract and report the failed latency outcome. Preserve external live/human gates. Existing evaluation-unit coverage should include deterministic synthetic-clock all-fast, slow/failing-target and no-sample cases; rerun only affected checks and normal required integration per workflow. No provider activation or target relaxation.
