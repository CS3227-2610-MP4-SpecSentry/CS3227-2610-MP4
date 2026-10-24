# Reviewer workflow automation

Python 3.11+ standard library only. Run from the repository root; use `python -B` to avoid bytecode artifacts. All scripts, tests, and this execution policy are Reviewer-specific. They neither start agents nor impose this workflow on other functionalities.

```powershell
python -B workflow/reviewer/scripts/workflow.py --help
python -B -m unittest discover -s workflow/reviewer/tests -v
```

Exit codes: `0` success, `1` a failed check or incomplete run, `2` invalid input/operational error. Global `--repo` and `--run` precede the subcommand. These tools are locally editable evidence, not a tamper-proof audit system, authorization service, or process sandbox.

`--repo` explicitly selects an alternate Git checkout for isolated tests or authorized worktrees. Initialization and subsequent writes reject arbitrary directories and checkout subdirectories before creating run artifacts; the default is this repository's root. Selecting a checkout does not expand the caller's file permissions.

## 1. Initialize and record every agent/stage/attempt

```powershell
python -B workflow/reviewer/scripts/workflow.py init --scope reviewer --prompter ngkhengyang --run-id coverage-validation --requirement REQ-REV-002
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation expect --agent main --invocation main-1 --stage compile
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation start --agent main --invocation main-1 --stage compile --model unavailable --effort unavailable
```

Use the returned `record_id` when finishing:

```powershell
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation finish --id RECORD-ID --status succeeded --outcome 'Brief compiled' --unavailable-reason 'Runtime does not expose token telemetry'
```

Replace example IDs/model settings with actual values. The selected model/effort are recorded separately from observed metadata; `unavailable` is appropriate only when the caller cannot observe its own settings, with details in the session log.

Register expected work before dispatch so a missing invocation is detectable. `start` also registers its own record, but cannot discover agents/stages that were never declared. Call start/finish for every main-agent stage and subagent stage, including reused agents, fix attempts, revalidation, failures, and interruptions. Use a new `--attempt` for retries. A crash leaves a running record: finish it as interrupted after inspecting the evidence; never invent a successful outcome. Allowed stages are compile, security, dispatch, implement, integrate, review, fix, revalidate, document, close.

`state.json` is saved under `logs/<prompter>/reviewer/<run-id>/`. Updates are locked and atomically replaced. A writer conflict fails rather than stealing a lock. After a crashed writer, an operator must verify no writer remains before removing its `.lock`; scripts never silently recover it. On this Windows sandbox, atomic replacement in temporary directories required unsandboxed test execution; ordinary supported local execution keeps atomic writes intact.

## 2. Import usage and summarize

Create a repository-local UTF-8 JSON file containing directly attributable final counters:

```json
{
  "import_id": "telemetry-main-compile-1",
  "record_id": "RECORD-ID",
  "scope": "record",
  "source": "Reference to exposed per-stage telemetry",
  "input_tokens": 1200,
  "output_tokens": 240,
  "cache_read_tokens": 400,
  "tool_calls": 6,
  "retries": 0,
  "observed_model": "observed-model-id",
  "observed_effort": "medium"
}
```

These numbers are illustrative, not this project's measured usage. For unavailable counters use `null` and an `unavailable_reasons` object keyed by each missing metric. Cache reads are a subset of input; reasoning already included in output is not added again. Only one final usage import per record and unique import IDs are accepted. Invocation/account totals cannot truthfully be split among stages by this script; keep stage values unavailable when only aggregate telemetry exists.

```powershell
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation usage --input path/to/usage.json
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation summary
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation summary --markdown
```

Summary output is printed for review; the coordinator may save it to an authorized report path. Totals include measured records only, with per-metric coverage. The recorded start/end span and summed agent durations differ when work overlaps. Neither covers unrecorded time; duration includes waiting inside a stage. The scripts cannot retrieve hidden runtime/model/token data.

## 3. Snapshot and run explicit checks

```powershell
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation snapshot --id integrated-1 --base HEAD --path workflow/reviewer/scripts --path workflow/reviewer/tests
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation command --id tests-1 --snapshot integrated-1 --timeout 120 -- python -B -m unittest discover -s workflow/reviewer/tests -v
```

Select relevant source files/directories explicitly. Snapshots capture HEAD/base identifiers, selected-file hashes, deletions/untracked files and a binary-diff hash without storing patch content. All `logs`, Git internals, and conventional credential paths are excluded, so log writes do not stale their own evidence. Path/hash snapshots are not a secret scanner; avoid selecting sensitive content and review the selected scope. A snapshot is evidence only for its selected scope, not the entire repository. Freeze relevant writers before collection; a snapshot cannot prove atomicity against simultaneous edits.

Commands use an explicit argv list with `shell=False`, repository cwd, timeout, bounded streaming hashes/counts, and a 64 KiB limit per output stream. Passing a command does not authorize it: use only checks permitted by the task. Arguments and outputs are not saved by default (only executable basename, argv hash, outcomes and output hashes/counts). `--save-output` explicitly opts into retaining bounded output; inspect whether it may contain secrets first. Failed, stale, timed-out, incomplete, or truncated results cannot satisfy completion.

Timeout terminates the directly launched process and closes capture; it is not a descendant-process sandbox. Choose tools that honor cancellation; inspect any child processes separately before retrying. Never execute untrusted submitted product code through this helper.

## 4. Generate and validate handoffs

Prepare JSON with seven nonempty literal string fields matching the [canonical format](../templates/HANDOFF.md): `identity`, `requirements`, `permissions`, `state`, `verification`, `risks`, `resources`. Also supply `references` (a list of repository-local file paths), `snapshot_id` for implementation handoffs, and optionally `resource_record`.

Design-only handoffs may omit the snapshot when their `state` explicitly starts `design:`. Missing references can be represented by an empty list and a blocking explanation; passing format validation does not establish readiness.

```powershell
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation handoff create --id 01-main-to-reviewer --input path/to/handoff.json
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation handoff validate --id 01-main-to-reviewer
```

Generated files live in the run's `handoffs/` directory, matching the handoff skill's default layout. IDs are unique; existing artifacts are never overwritten. Ordinary fields are escaped literal text, with links generated only from validated local references. Code-state freshness and artifact hashes are checked. Read-only agents return structured content for the authorized coordinator to persist; the generator does not expand permissions.

## 5. Ownership, findings and fix cycles

Register an assignment using JSON:

```json
{
  "id": "review-form",
  "agent": "worker-a",
  "role": "implementer",
  "paths": ["src/main/reviewer", "src/test/reviewer"],
  "dependencies": []
}
```

```powershell
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation assignment --input path/to/assignment.json
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation ownership --assignment review-form --path src/main/reviewer/ReviewForm.java
```

Ownership paths are concrete files/subtrees (no globs), case-insensitive for Windows consistency. Overlaps fail, including directory/file overlaps. Dependencies name existing assignments, preventing forward cycles. Ownership is a declared write set; changed-path checks do not prove which agent edited a shared worktree. Reused original owners fix their assignment; new ownership boundaries require a separately coordinated run/assignment plan rather than silently overriding evidence.

Finding input JSON requires `requirement`, `severity` (LOW/MEDIUM/HIGH/CRITICAL), `blocks` (boolean), `owner`, assigned independent `reviewer`, `description`, and optionally `evidence` (existing local file paths). Add allocates a stable F-number. Reviewers must be recorded separately from implementation/fix agents; scripts cannot authenticate an agent identity.

```powershell
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation finding add --input path/to/finding.json
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation finding update --id F-001 --status closed --reviewer verifier --record REVIEW-RECORD-ID --snapshot fixed-state --evidence path/to/revalidation.md
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation cycle --reviewer verifier --outcome failed --evidence path/to/review.md
```

Closure requires the assigned independent reviewer, a successful registered review/revalidation record after the finding and relevant owner fixes, a fresh snapshot after those fixes, and actual evidence references. The same links are rechecked at completion. Both security and implementation review must have successful agents distinct from implementation/fix agents. Findings retain transition history; closed findings can reopen. Deferring a blocker does not satisfy completion. Before another cycle after two failed cycles, supply `--reassessment` with the cause/approach decision; the script does not decide the new approach.

## 6. Supersede stale evidence and check completeness

After fixes, create fresh snapshots/checks/handoffs. Preserve failed earlier evidence and explicitly link its replacement:

```powershell
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation supersede --kind commands --id tests-1 --by tests-2 --reason 'Fix integrated and checked against a new snapshot'
python -B workflow/reviewer/scripts/workflow.py --run logs/ngkhengyang/reviewer/coverage-validation completeness
```

The same command supports `--kind handoffs`. Completion examines current terminal evidence and validates supersession chains; failures disappear from neither history nor recorded totals. Record earlier failed attempts as failed and later successful stage attempts separately.

The completeness report checks the declared invocation/stage registry, timing, usage reasons, required stages, independent review identity, findings, cycles, handoffs, and current snapshot/check evidence. Explicit unavailable telemetry produces coverage warnings rather than invented measurements. The coordinator must declare every actual agent/stage/attempt; undeclared activity cannot be discovered. Semantic acceptance-criterion coverage, security sufficiency, and any human approvals still require agent/human assessment.
