#!/usr/bin/env python3
"""Repository-wide resource boundaries; no agent orchestration or hidden telemetry."""
import argparse
import datetime as dt
import html
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[2]
METRICS = ("input_tokens", "output_tokens", "cache_read_tokens", "tool_calls", "retries")


def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def nonempty(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Nonempty text required")
    return value.strip()


def component(value):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,99}", value) or value.endswith("."):
        raise ValueError("Invalid prompter/session name")
    if value.split(".")[0].upper() in {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(10)), *(f"LPT{i}" for i in range(10))}:
        raise ValueError("Reserved filename")
    return value


def safe(root, target):
    root, target = Path(root).absolute(), Path(target).absolute()
    if not target.is_relative_to(root) or ".." in target.parts:
        raise ValueError("Resource paths must remain inside repository logs")
    for item in (target, *target.parents):
        if item.is_symlink() or getattr(item, "is_junction", lambda: False)():
            raise ValueError("Redirected resource paths are unsupported")
        if os.name == "nt" and item.exists():
            import stat
            if getattr(item.lstat(), "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                raise ValueError("Redirected resource paths are unsupported")
    return target


def paths(args):
    name, session = component(args.name), component(args.session)
    folder = safe(ROOT, ROOT / "logs" / name / "resources" / session)
    return folder


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def start(args):
    folder = paths(args)
    folder.mkdir(parents=True, exist_ok=True)
    safe(ROOT, folder)
    identifier = uuid.uuid4().hex
    data = {"id": identifier, "prompter": args.name, "session": args.session,
            "agent": args.agent, "invocation": args.invocation, "stage": args.stage,
            "attempt": args.attempt, "selected_model": args.model, "selected_effort": args.effort,
            "observed_model": None, "observed_effort": None,
            "settings_reason": args.settings_reason, "started_at": stamp(), "ended_at": None,
            "elapsed_seconds": None, "status": "running", "usage": None}
    if args.attempt < 1:
        raise ValueError("Attempt must be positive")
    # One file/writer per interval, so parallel agents do not share a mutable table.
    with (folder / f"{identifier}.json").open("x", encoding="utf-8") as stream:
        json.dump(data, stream, indent=2)
        stream.write("\n")
    return {"id": identifier, "record": str(folder / f"{identifier}.json"), "started_at": data["started_at"]}


def record_path(args):
    if not re.fullmatch(r"[a-f0-9]{32}", args.id):
        raise ValueError("Invalid record ID")
    return safe(ROOT, paths(args) / f"{args.id}.json")


def finish(args):
    nonempty(args.unavailable_reason)
    path = record_path(args)
    lock = safe(ROOT, path.with_suffix(".lock"))
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    temporary = None
    try:
        data = load(path)
        if data["status"] != "running":
            raise ValueError("Record already finished; use a new attempt for further work")
        usage = {key: None for key in METRICS}
        reasons = {key: args.unavailable_reason for key in METRICS}
        if args.usage:
            supplied = load(safe(ROOT, ROOT / args.usage))
            allowed = {"record_id", "scope", "source", "unavailable_reasons", "observed_model", "observed_effort", *METRICS}
            if not isinstance(supplied, dict) or set(supplied) - allowed:
                raise ValueError("Unknown usage fields")
            if supplied.get("record_id") != args.id or supplied.get("scope") != "record":
                raise ValueError("Usage must identify this record, scope=record, and an attributable telemetry source")
            nonempty(supplied.get("source"))
            if not isinstance(supplied.get("unavailable_reasons", {}), dict):
                raise ValueError("Unavailable reasons must be an object")
            for key in METRICS:
                value = supplied.get(key)
                if value is not None and (isinstance(value, bool) or not isinstance(value, int) or value < 0):
                    raise ValueError("Counters must be nonnegative integers or null")
                usage[key] = value
                if value is None:
                    reasons[key] = supplied.get("unavailable_reasons", {}).get(key, args.unavailable_reason)
                    nonempty(reasons[key])
                else:
                    reasons.pop(key, None)
            cache, inputs = usage["cache_read_tokens"], usage["input_tokens"]
            if cache is not None and (inputs is None or cache > inputs):
                raise ValueError("Cache reads must be included within input tokens")
            data["usage_source"] = supplied["source"]
            for key in ("observed_model", "observed_effort"):
                data[key] = supplied.get(key)
        else:
            data["usage_source"] = None
        end = stamp()
        duration = (dt.datetime.fromisoformat(end) - dt.datetime.fromisoformat(data["started_at"])).total_seconds()
        if not math.isfinite(duration) or duration < 0:
            raise ValueError("Clock moved backwards; inspect the interval")
        data.update(ended_at=end, elapsed_seconds=duration, status=args.status, outcome=args.outcome,
                    usage=usage, unavailable_reasons=reasons, unavailable_reason=args.unavailable_reason)
        fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".resource-", suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(data, stream, indent=2, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        safe(ROOT, path)
        os.replace(temporary, path)
        return {"id": args.id, "status": args.status, "elapsed_seconds": duration}
    finally:
        if temporary:
            Path(temporary).unlink(missing_ok=True)
        safe(ROOT, lock).unlink(missing_ok=True)


def report(args):
    folder = paths(args)
    records = [load(safe(ROOT, p)) for p in sorted(folder.glob("*.json"))]
    issues = []
    for row in records:
        if row["status"] == "running":
            issues.append(f"Unfinished record: {row['id']}")
        if row["status"] != "running" and not row.get("ended_at"):
            issues.append(f"Missing end: {row['id']}")
        if row["status"] not in ("running", "succeeded", "failed", "interrupted"):
            issues.append(f"Invalid status: {row['id']}")
        if row["status"] != "running":
            elapsed = row.get("elapsed_seconds")
            if not isinstance(elapsed, (int, float)) or isinstance(elapsed, bool) or not math.isfinite(elapsed) or elapsed < 0:
                issues.append(f"Invalid elapsed time: {row['id']}")
            for key in METRICS:
                value = (row.get("usage") or {}).get(key)
                if value is None and not row.get("unavailable_reasons", {}).get(key):
                    issues.append(f"Missing telemetry reason: {row['id']} / {key}")
    if not records:
        issues.append("No resource records exist")
    measured = {k: sum(r.get("usage", {}).get(k) or 0 for r in records if r.get("usage")) for k in METRICS}
    coverage = {k: sum(r.get("usage") is not None and r["usage"].get(k) is not None for r in records) for k in METRICS}
    result = {"records": records, "issues": issues, "ok": not issues, "measured_totals_only": measured,
              "coverage": coverage, "summed_interval_seconds": sum(r.get("elapsed_seconds") or 0 for r in records),
              "limit": "Only explicitly registered intervals. Null telemetry is unavailable, not zero; overlapping intervals are not wall time."}
    if args.markdown:
        def cell(value):
            value = html.escape(str(value)).replace("\n", " ").replace("\r", " ")
            return re.sub(r"([\\`*_{}\[\]()#!|>~+-])", r"\\\1", value)
        print("| Agent / stage / attempt | Model / effort | Start / end (UTC) | Elapsed seconds | Input / output tokens | Status |")
        print("| --- | --- | --- | --- | --- | --- |")
        for r in records:
            usage = r.get("usage") or {}
            values = [f"{r['agent']} / {r['stage']} / {r['attempt']}", f"{r['selected_model']} / {r['selected_effort']}",
                      f"{r['started_at']} / {r['ended_at']}", r["elapsed_seconds"],
                      f"{usage.get('input_tokens') if usage.get('input_tokens') is not None else 'unavailable'} / {usage.get('output_tokens') if usage.get('output_tokens') is not None else 'unavailable'}", r["status"]]
            print("| " + " | ".join(cell(v) for v in values) + " |")
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True)
    parser.add_argument("--session", required=True)
    subs = parser.add_subparsers(dest="command", required=True)
    p = subs.add_parser("start")
    for key in ("agent", "invocation", "stage", "model", "effort"):
        p.add_argument("--" + key, required=True)
    p.add_argument("--attempt", type=int, default=1)
    p.add_argument("--settings-reason", default="Selected settings supplied by caller; observed metadata may be unavailable")
    p.set_defaults(func=start)
    p = subs.add_parser("finish")
    p.add_argument("--id", required=True)
    p.add_argument("--status", choices=("succeeded", "failed", "interrupted"), required=True)
    p.add_argument("--outcome", required=True)
    p.add_argument("--usage")
    p.add_argument("--unavailable-reason", required=True)
    p.set_defaults(func=finish)
    p = subs.add_parser("report")
    p.add_argument("--markdown", action="store_true")
    p.set_defaults(func=report)
    try:
        args = parser.parse_args(argv)
        result = args.func(args)
        if not getattr(args, "markdown", False):
            print(json.dumps(result, indent=2))
        return 1 if result.get("ok") is False else 0
    except (ValueError, OSError, KeyError, TypeError):
        print("Resource operation failed: check input, paths, state, or writer lock; no record was intentionally overwritten", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
