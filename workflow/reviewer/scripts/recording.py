"""Explicit stage boundaries, usage attribution and measured coverage."""
from __future__ import annotations

import datetime as dt
import json
import uuid

from core import (Error, add_identity, create_run, emit, identifier, literal, now,
                  open_run, read_json, record_key, repo_file, text)


METRICS = ("input_tokens", "output_tokens", "cache_read_tokens", "tool_calls", "retries")


def identity(args):
    return {"agent": args.agent, "invocation": args.invocation,
            "stage": args.stage, "attempt": args.attempt}


def initialize(args):
    if args.scope != "reviewer":
        raise Error("Only Reviewer workflow runs are supported")
    run = create_run(args.repo, args.prompter, args.run_id, args.requirement,
                     getattr(args, "workflow_version", 3))
    emit({"run": str(run.path), "scope": "reviewer"})
    return 0


def expect(args):
    run = open_run(args)
    key = record_key(args.agent, args.invocation, args.stage, args.attempt)
    with run.edit() as data:
        if key in data["expected"]:
            raise Error("Agent/stage/attempt is already registered")
        data["expected"][key] = {**identity(args), "record_id": None}
    emit({"expected": key})
    return 0


def start(args):
    run = open_run(args)
    key = record_key(args.agent, args.invocation, args.stage, args.attempt)
    record_id = "rec-" + uuid.uuid4().hex[:16]
    with run.edit() as data:
        assignment_id = getattr(args, "assignment", None)
        changes_code = getattr(args, "changes_code", False)
        if changes_code and args.stage != "integrate":
            raise Error("--changes-code is for integration; implementation/fix already implies code changes")
        if data.get("workflow_version", 2) >= 3 and args.stage in ("implement", "fix"):
            from planning import readiness_errors
            owner = data["assignments"].get(assignment_id)
            if not owner or owner["agent"] != args.agent:
                raise Error("Version 3 implementation/fix starts require --assignment owned by this agent")
            errors = readiness_errors(run, data, assignment_id)
            if errors:
                raise Error("Dispatch prerequisites: " + "; ".join(errors))
        expected = data["expected"].setdefault(key, {**identity(args), "record_id": None})
        if expected.get("record_id"):
            raise Error("This agent/stage/attempt already has a record")
        expected["record_id"] = record_id
        data["records"][record_id] = {
            **identity(args), "id": record_id, "status": "running", "start": now(),
            "end": None, "elapsed_seconds": None, "selected_model": text(args.model),
            "selected_effort": text(args.effort), "observed_model": None,
            "observed_effort": None, "usage": {k: None for k in METRICS[:3]},
            "tool_calls": None, "retries": None, "usage_source": None,
            "unavailable_reasons": {}, "usage_import_id": None,
            "assignment": assignment_id,
        }
        if changes_code:
            data["records"][record_id]["changes_code"] = True
    emit({"record_id": record_id, "key": key})
    return 0


def finish(args):
    run = open_run(args)
    with run.edit() as data:
        elapsed = finish_record(data, args.id, args.status, args.outcome, args.unavailable_reason)
    emit({"record_id": args.id, "status": args.status, "elapsed_seconds": elapsed})
    return 0


def finish_record(data, record_id, status, outcome, unavailable_reason):
    """Mutate a caller-owned transaction; completion uses the same recording rules."""
    record = data["records"].get(record_id)
    if not record or record["status"] != "running":
        raise Error("Only a running record can be finished")
    if status not in ("succeeded", "failed", "interrupted"):
        raise Error("Invalid completion status")
    end = now()
    elapsed = (dt.datetime.fromisoformat(end) - dt.datetime.fromisoformat(record["start"])).total_seconds()
    if elapsed < 0:
        raise Error("System clock moved backwards; inspect timing before completing")
    record.update(status=status, end=end, elapsed_seconds=elapsed, outcome=text(outcome))
    reason = text(unavailable_reason)
    if not record.get("usage_source"):
        record["unavailable_reasons"]["usage_source"] = reason
    for metric in METRICS:
        value = record["usage"].get(metric) if metric in record["usage"] else record.get(metric)
        if value is None:
            record["unavailable_reasons"][metric] = reason
    for setting in ("observed_model", "observed_effort"):
        if not record[setting]:
            record["unavailable_reasons"][setting] = reason
    return elapsed


def usage(args):
    run = open_run(args)
    supplied = read_json(repo_file(run.repo, args.input))
    allowed = {"import_id", "record_id", "source", "scope", *METRICS,
               "observed_model", "observed_effort", "unavailable_reasons"}
    if not isinstance(supplied, dict) or set(supplied) - allowed:
        raise Error("Usage JSON contains unknown fields or is not an object")
    if supplied.get("scope") != "record":
        raise Error("Only directly attributed per-record usage is accepted; aggregate counters cannot be split")
    import_id = identifier(supplied.get("import_id"))
    source = text(supplied.get("source"))
    unavailable = supplied.get("unavailable_reasons", {})
    if not isinstance(unavailable, dict):
        raise Error("Usage unavailable_reasons must be an object")
    for metric in METRICS:
        value = supplied.get(metric)
        if value is not None and (isinstance(value, bool) or not isinstance(value, int) or value < 0):
            raise Error("Usage counters must be nonnegative integers or null")
        if value is None:
            text(unavailable.get(metric))
    if supplied.get("cache_read_tokens") is not None:
        if supplied.get("input_tokens") is None or supplied["cache_read_tokens"] > supplied["input_tokens"]:
            raise Error("Cache reads must be a subset of input tokens")
    with run.edit() as data:
        record = data["records"].get(supplied.get("record_id"))
        if not record:
            raise Error("Usage record does not exist")
        if any(r.get("usage_import_id") == import_id for r in data["records"].values()):
            raise Error("Duplicate usage import ID")
        if record.get("usage_import_id"):
            raise Error("Record already has a usage import; use exact final counters once")
        record.update(usage_import_id=import_id, usage_source=source)
        for metric in METRICS:
            value = supplied.get(metric)
            if metric in record["usage"]:
                record["usage"][metric] = value
            else:
                record[metric] = value
            if value is None:
                record["unavailable_reasons"][metric] = unavailable[metric]
            else:
                record["unavailable_reasons"].pop(metric, None)
        for setting in ("observed_model", "observed_effort"):
            if supplied.get(setting) is not None:
                record[setting] = text(supplied[setting])
                record["unavailable_reasons"].pop(setting, None)
    emit({"record_id": record["id"], "import_id": import_id})
    return 0


def summarize(args, data=None):
    if data is None:
        data = open_run(args).state()
    records = list(data["records"].values())
    ended = [r for r in records if r.get("end")]
    intervals = [(dt.datetime.fromisoformat(r["start"]), dt.datetime.fromisoformat(r["end"])) for r in ended]
    totals = {m: sum((r["usage"].get(m) or 0) if m in r["usage"] else (r.get(m) or 0)
                     for r in records) for m in METRICS}
    coverage = {m: sum((r["usage"].get(m) if m in r["usage"] else r.get(m)) is not None
                       for r in records) for m in METRICS}
    report = {
        "records": len(records), "finished": len(ended), "expected": len(data["expected"]),
        "measured_totals_only": totals, "measured_record_coverage": coverage,
        "summed_agent_elapsed_seconds": sum(r["elapsed_seconds"] for r in ended),
        "observed_record_span_seconds": (max(e for _, e in intervals) - min(s for s, _ in intervals)).total_seconds() if intervals else None,
        "note": "Span covers recorded boundaries only, not unrecorded full-run time. Missing usage is not zero. Cache reads are included in input; reasoning is not added again.",
    }
    if args.markdown:
        rows = ["# Reviewer resource summary", "", f"Records: {len(records)}; finished: {len(ended)}.", "",
                "| Agent / invocation / stage / attempt | Selected model / effort | Status | Elapsed seconds | Input / output / cache |",
                "| --- | --- | --- | --- | --- |"]
        for r in records:
            values = [f"{r['agent']} / {r['invocation']} / {r['stage']} / {r['attempt']}",
                      f"{r['selected_model']} / {r['selected_effort']}", r["status"],
                      r.get("elapsed_seconds"), " / ".join(str(r["usage"].get(m)) if r["usage"].get(m) is not None else "unavailable" for m in METRICS[:3])]
            rows.append("| " + " | ".join(literal(v) for v in values) + " |")
        rows += ["", literal(json.dumps(report, sort_keys=True)), ""]
        print("\n".join(rows))
    else:
        emit(report)
    return 0


def register(subparsers):
    parser = subparsers.add_parser("init", help="Initialize a Reviewer-only run")
    parser.add_argument("--scope", required=True, choices=("reviewer",))
    parser.add_argument("--prompter", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--requirement", action="append", required=True)
    parser.add_argument("--workflow-version", type=int, choices=(2, 3), default=3)
    parser.set_defaults(func=initialize)
    for name, handler in (("expect", expect), ("start", start)):
        parser = subparsers.add_parser(name)
        add_identity(parser)
        if name == "start":
            parser.add_argument("--model", required=True)
            parser.add_argument("--effort", required=True)
            parser.add_argument("--assignment", help="required for version 3 implementation/fix dispatch")
            parser.add_argument("--changes-code", action="store_true",
                                help="mark integration wiring edits for independent review and closure timing")
        parser.set_defaults(func=handler)
    parser = subparsers.add_parser("finish")
    parser.add_argument("--id", required=True)
    parser.add_argument("--status", choices=("succeeded", "failed", "interrupted"), required=True)
    parser.add_argument("--outcome", required=True)
    parser.add_argument("--unavailable-reason", required=True)
    parser.set_defaults(func=finish)
    parser = subparsers.add_parser("usage")
    parser.add_argument("--input", required=True)
    parser.set_defaults(func=usage)
    parser = subparsers.add_parser("summary")
    parser.add_argument("--markdown", action="store_true")
    parser.set_defaults(func=summarize)
