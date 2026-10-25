# Resource recording for repository changes

This shared helper records measurements only; it does not invoke agents or adopt the Reviewer workflow for other work. Python 3.11+ standard library. Use `python -B` or an absolute available Python executable. In the current desktop environment, the bundled runtime is `C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe` when Python is not on PATH.

Before editing:

```powershell
python -B workflow/tooling/resource-session.py --name ngkhengyang --session 2026-10-25-example start --agent main --invocation main-1 --stage implement --model unavailable --effort unavailable --settings-reason 'Exact execution settings not exposed'
```

Use the real selected model/effort when known. Preserve the returned record ID. Artifacts are isolated per interval at `logs/<name>/resources/<session>/<id>.json`; separate agents need separate records. Include attempt with `--attempt 2` for a retry. Start a new record for each stage. Script time boundaries are measured UTC; elapsed includes waiting between calls, not CPU/model-only effort.

After validation:

```powershell
python -B workflow/tooling/resource-session.py --name ngkhengyang --session 2026-10-25-example finish --id RECORD-ID --status succeeded --outcome 'Changes validated' --unavailable-reason 'Per-record usage telemetry not exposed'
python -B workflow/tooling/resource-session.py --name ngkhengyang --session 2026-10-25-example report
python -B workflow/tooling/resource-session.py --name ngkhengyang --session 2026-10-25-example report --markdown
```

`finish` also supports failed/interrupted status. Report returns exit 1 for empty/unfinished sessions; invalid input/write conflicts return exit 2. Finish uses an exclusive lock and atomic replacement, never overwrites a finished interval, and does not steal stale locks. Inspect crashed writers before manual lock recovery. JSON records are editable local evidence, not tamper-proof audit records. Paths reject traversal and symlink/junction redirection.

If exposed usage exists, supply `finish --usage path/to/usage.json`. Schema:

```json
{
  "record_id": "RECORD-ID",
  "scope": "record",
  "source": "Actual attributable runtime telemetry reference",
  "input_tokens": 120,
  "output_tokens": 40,
  "cache_read_tokens": 0,
  "tool_calls": null,
  "retries": null,
  "unavailable_reasons": {"tool_calls": "not exposed", "retries": "not exposed"},
  "observed_model": "actual-observed-id",
  "observed_effort": "medium"
}
```

Numbers above illustrate the schema, not project measurements. Input/output/cache counters are nonnegative integers or null; cache is included within input. The import must identify this exact interval. Do not distribute whole-account/invocation totals among stages or import duplicate totals into multiple intervals. Without per-record telemetry, keep null and reasons. The helper cannot access hidden runtime counters. Summed intervals may overlap, so they are not end-to-end wall time; missing values have separate coverage counts and are never represented as measured zero usage.

Copy the Markdown report or link JSON records in the prompter-named change log, together with unavailable reasons. Preserve prior logs as historical evidence; do not fabricate start times for past tasks. This is an explicit agent-invoked recorder: instructions require calls, but it is not an automatic file watcher/runtime hook. Human review and future tooling can audit missing calls. It cannot detect completely unregistered work or include final response generation in already-finished intervals.
