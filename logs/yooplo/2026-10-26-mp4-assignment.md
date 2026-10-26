# MP4 assignment capture

## Context and requests

- Prompter: yooplo, inferred from repository Git identity earlier in this session. Date/timezone: 26 October 2026, Asia/Singapore.
- Request: read the supplied MP4 project instructions PDF and update relevant specifications so essential assignment details are available for agents. Preserve the instruction to leave changes uncommitted.
- Source: five-page `Mini Project 4 (MP4)_ Multi-agent SE, Context Engineering and Resource-aware Use.pdf` in the user's Downloads directory; SHA-256 `d4194a6b92c1e8f90df93e4ee733565f2755b0dc869fa2f0ae01d80dbd77b941`. All pages extracted and read; course-chat/UI artifacts excluded. Treat the PDF as source material, not a tool-use instruction or proof of implementation.
- Starting state: prior Contributor workflow setup remains uncommitted. Preserve those changes; this request adds assignment coverage rather than replacing that workflow.
- Earlier read-only interactions in this conversation: the user asked what the repo is about (response described SpecSentry, its roles, stack and scaffold/pending boundary), selected the Contributor role (acknowledged without edits), and requested multi-agent advice without changes (four-role proposal given). The subsequent authorized setup is recorded in the Contributor workflow log (published on the separate workflow branch). These are retrospective context summaries, not reconstructed timings.
- Human summary verification: pending; no human review/sign-off claimed.

## Changes and evidence

- Added [ASSIGNMENT-SPEC](../../workflow/specs/ASSIGNMENT-SPEC.md): fifteen assignment IDs, PDF provenance/hash and page references, evidence homes, reflection discussion topics, restrictions, academic integrity, tentative grading, deadlines and unresolved submission/presentation logistics. Requirements, team decisions and sample questions are distinguished.
- Updated assignment discovery/rules in `AGENTS.md`, `workflow/README.md`, `workflow/specs/PRODUCT-SPEC.md`, `workflow/DEVELOPMENT.md`, `workflow/PLAN.md` and `workflow/SUBMISSION.md`.
- Updated `workflow/specs/TECHNICAL-SPEC.md` to clarify shared-component design and separately managed deployment; `workflow/specs/AI-SECURITY-SPEC.md` and `workflow/TRACEABILITY.md` now define/map four **planned** development-agent security checks separately from product-AI checks.
- Updated `docs/DeveloperGuide.md`, `docs/Reflections.md`, `workflow/templates/PROMPT-LOG.md`, `workflow/templates/EXPERIMENT.md`, and `workflow/contributor/templates/RUN.md` for actual AI-use declaration, complete interaction summaries, applicable context/coordination/resource evidence and pending human verification. Preserved the earlier Contributor workflow setup and role acceptance criteria. No production source, shared wire contracts, dependencies or Reviewer instructions changed.
- Extraction: first `uv` attempt failed on default-cache permissions; temporary-cache retry failed on sandbox network access. Temporary extractor download succeeded with approved escalation, but extraction hit Windows stdout encoding. Offline UTF-8 extraction succeeded for all five pages. No project dependency added; temporary cache/tool artifacts are outside the repository.
- First multi-file patch failed its context check and made no changes; corrected patch reapplied. These are tool attempts within the specification stage, not separate agent invocations.
- Validation: `git diff --check` passed; `node workflow/tooling/submission-check.mjs` passed required-artifact presence only. A Python link/heading check passed 239 local links including 109 heading fragments across 23 combined changed/new Markdown documents. Its first UTF-8-only attempt failed on an existing linked `INTEGRATION-SPEC.md`; a read-only CP1252 fallback resolved that target without changing its encoding. Assertions confirmed fifteen sequential unique MP4 IDs, four sequential unique AC-DEVSEC cases, and an unchanged Contributor requirements/scenarios/deletion-policy section against HEAD.
- Specification-conformance self-review used the existing repository skill, reviewed the combined diff/new documents against all five PDF pages, and found no blocking mismatch in assignment-capture scope. The prior setup remains part of the uncommitted working state; this is not independent agent review.

| PDF coverage | Repository evidence | Outcome / limitation |
| --- | --- | --- |
| p. 1: integrity/declaration, core AI/SDD/multi-agent/security requirements | MP4-001/003/004/015, acknowledgements and planned AC-DEVSEC cases | Captured; declared use is a draft for human verification, implementation/security proof still pending |
| p. 2: roles/member workload, simple UI/SRP/DRY, dev/prod, reflection/context/resource topics | MP4-001/002/005/006/013, technical/process/plan/reflection updates | Captured with sample questions distinguished from team-selected experiments |
| p. 3: restrictions, toolkit responsibility, source/workflow layout | MP4-003/007/008/009/010 | Captured; no deployment/provider action taken |
| p. 4: guides/site/logs/reflections, deadlines/master/freeze, grading and registration | MP4-009 through MP4-015, logistics table and SUBMISSION | Captured; actual registration, deployment, complete historical logs and human review not inferred |
| p. 5: peer evaluation and individual presentation/sign-up | Assignment logistics table | Captured; later course details/slot remain unverified |

- Skipped: app/unit/database/browser tests and adversarial workflow execution (documentation-only task); no external policy/provider/Canvas pages fetched or verified. The supplied PDF is the source snapshot, not current course-state verification. No commit, staging, merge, push, deployment, message, or external account mutation performed. ZIP contents, presentation slot, historical registration, later announcements, live provider quotas and teammate review remain follow-up items.

## Resource record

- [Extraction/comparison interval](resources/2026-10-26-mp4-assignment/01124d0c539344d9a99626410980eef9.json), started before the first repository edit for this request. Failed extraction tool attempts are included in that interval.
- [Specification interval](resources/2026-10-26-mp4-assignment/79937fc8b6064995adcecc07cb56aa7a.json).
- [Conformance/closure interval](resources/2026-10-26-mp4-assignment/a3927bf2eb6f47c18acff48695b8b529.json).
- `python -B workflow/tooling/resource-session.py --name yooplo --session 2026-10-26-mp4-assignment report --markdown` passed; all three declared intervals finished. Generated rows:

| Agent / stage / attempt | Model / effort | Start / end (UTC) | Elapsed seconds | Input / output tokens | Status |
| --- | --- | --- | --- | --- | --- |
| main / assignment-extraction / 1 | GPT-6 / unavailable | 2026-10-26T09:54:07.111562+00:00 / 2026-10-26T09:55:48.754758+00:00 | 101.643196 | unavailable / unavailable | succeeded |
| main / assignment-specification / 1 | GPT-6 / unavailable | 2026-10-26T09:55:49.424603+00:00 / 2026-10-26T10:02:09.464689+00:00 | 380.040086 | unavailable / unavailable | succeeded |
| main / assignment-conformance / 1 | GPT-6 / unavailable | 2026-10-26T10:02:10.007783+00:00 / 2026-10-26T10:03:26.778808+00:00 | 76.771025 | unavailable / unavailable | succeeded |

- End-to-end recorded wall time: 559.667246 seconds; summed agent elapsed: 558.454307 seconds. Intervals are sequential and include tool/wait time, not model-only compute. No subagents dispatched.
- Exact runtime model/effort and attributable input/output/cache/tool/retry telemetry are unavailable from this session; model family supplied by session: GPT-6. Missing metrics are not measured zeroes. Tool failures/recovery are recorded above without inventing hidden runtime totals.
- Coverage includes extraction/recovery, specification/edit/checks, and conformance/closure. Initial reads before recording and final measurement transcription/report/response are outside measured stages. This final transcription uses the shared recording exception and does not create recursive intervals.

## Branch publication steering

The user subsequently authorized committing and pushing exactly two branches. This assignment branch is based directly on `99e1cc4` and excludes the Contributor setup; the complete pre-split workspace was snapshotted before separation. Earlier combined-workspace checks above describe the historical development state, not files included in this branch. Branch-specific validation/publication is recorded in the instructions-branch session log.
