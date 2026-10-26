"""Deterministic local consistency checks for Reviewer workflow evidence.

These checks validate recorded evidence; they cannot certify a review's quality.
"""
from __future__ import annotations

import json
import math
import re
from datetime import datetime
from pathlib import Path, PurePosixPath

from core import Error, contained, identifier, now, open_run, read_json, repo_file, text


REQUIRED_STAGES = ("compile", "security", "dispatch", "implement", "integrate", "review", "close")
FINDING_STATUSES = ("open", "fixing", "awaiting-revalidation", "closed", "deferred")


def _emit(value):
    print(json.dumps(value, indent=2, sort_keys=True))


def _string(value, label):
    if not isinstance(value, str):
        raise Error(f"{label} must be a nonempty string")
    return text(value)


def _list(value, label):
    if not isinstance(value, list):
        raise Error(f"{label} must be a list")
    return value


def _input(run, path):
    data = read_json(repo_file(run.repo, path))
    if not isinstance(data, dict):
        raise Error("input must be a JSON object")
    return data


def _path(repo, value):
    """Validate concrete ownership paths, including currently nonexistent paths."""
    value = _string(value, "path").replace("\\", "/")
    if value.startswith("/") or ":" in value or any(c in value for c in "*?[]\x00"):
        raise Error("ownership paths must be concrete repository-relative paths")
    parts = value.split("/")
    if any(p in ("", ".", "..") or p.casefold() == ".git" or p.endswith((".", " "))
           or any(ord(c) < 32 for c in p) for p in parts):
        raise Error("unsafe ownership path")
    contained(repo, Path(repo) / Path(*parts))
    return PurePosixPath(*parts).as_posix()


def _contains(prefix, path):
    prefix, path = prefix.casefold(), path.casefold()
    return path == prefix or path.startswith(prefix + "/")


def _evidence(run, values):
    refs = []
    for value in _list(values, "evidence"):
        value = _string(value, "evidence reference")
        resolved = repo_file(run.repo, value)
        if not resolved.is_file():
            raise Error("evidence must reference an existing repository file")
        refs.append(value)
    return refs


def assignment(args):
    run = open_run(args)
    data = _input(run, args.input)
    aid = identifier(_string(data.get("id"), "assignment id"))
    agent = identifier(_string(data.get("agent"), "agent"))
    paths = [_path(run.repo, p) for p in _list(data.get("paths"), "paths")]
    if not paths:
        raise Error("assignment paths cannot be empty")
    dependencies = [identifier(_string(d, "dependency")) for d in _list(data.get("dependencies", []), "dependencies")]
    if len(set(dependencies)) != len(dependencies):
        raise Error("duplicate assignment dependency")
    role = _string(data.get("role", "implementer"), "role")
    with run.edit() as state:
        assignments = state["assignments"]
        if aid in assignments:
            raise Error("assignment id already exists")
        if aid in dependencies or any(d not in assignments for d in dependencies):
            raise Error("dependencies must name existing assignments and cannot cycle")
        for index, path in enumerate(paths):
            for other in paths[:index]:
                if _contains(path, other) or _contains(other, path):
                    raise Error("overlapping ownership paths in assignment")
            for existing in assignments.values():
                for other in existing["paths"]:
                    if _contains(path, other) or _contains(other, path):
                        raise Error(f"ownership overlaps assignment {existing['id']}")
        assignments[aid] = {"id": aid, "agent": agent, "role": role, "paths": paths,
                            "dependencies": dependencies, "created_at": now()}
    _emit({"assignment": aid})
    return 0


def ownership(args):
    run = open_run(args)
    assigned = run.state()["assignments"].get(args.assignment)
    if assigned is None:
        raise Error("unknown assignment")
    paths = [_path(run.repo, p) for p in args.path]
    outside = [p for p in paths if not any(_contains(prefix, p) for prefix in assigned["paths"])]
    _emit({"assignment": args.assignment, "checked_paths": paths, "outside_ownership": outside,
           "ok": not outside})
    return int(bool(outside))


def finding_add(args):
    run = open_run(args)
    data = _input(run, args.input)
    fields = {key: _string(data.get(key), key) for key in ("requirement", "owner", "reviewer", "description")}
    fields["owner"] = identifier(fields["owner"])
    fields["reviewer"] = identifier(fields["reviewer"])
    if fields["owner"] == fields["reviewer"]:
        raise Error("finding reviewer must be independent of its owner")
    severity = data.get("severity")
    if severity not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
        raise Error("invalid finding severity")
    if not isinstance(data.get("blocks"), bool):
        raise Error("blocks must be a boolean")
    refs = _evidence(run, data.get("evidence", []))
    with run.edit() as state:
        numbers = [int(key[2:]) for key in state["findings"] if re.fullmatch(r"F-\d+", key)]
        fid = f"F-{max(numbers, default=0) + 1:03d}"
        stamp = now()
        state["findings"][fid] = dict(fields, id=fid, severity=severity, blocks=data["blocks"],
            status="open", evidence=refs, created_at=stamp,
            history=[{"status": "open", "reviewer": fields["reviewer"], "at": stamp, "evidence": refs}])
    _emit({"finding": fid})
    return 0


def finding_update(args):
    run = open_run(args)
    reviewer = identifier(_string(args.reviewer, "reviewer"))
    refs = _evidence(run, args.evidence or [])
    with run.edit() as state:
        finding = state["findings"].get(args.id)
        if finding is None:
            raise Error("unknown finding")
        if reviewer != finding["reviewer"] or reviewer == finding["owner"]:
            raise Error("finding transitions require its assigned independent reviewer")
        if finding["status"] == "closed" and args.status != "open":
            raise Error("closed findings can only be reopened")
        if args.status == finding["status"]:
            raise Error("finding already has that status")
        if args.status == "deferred" and not args.reason:
            raise Error("deferral requires a reason")
        event = {"status": args.status, "reviewer": reviewer, "at": now(), "evidence": refs}
        if args.status == "closed":
            event["record_id"] = identifier(getattr(args, "record", None))
            event["snapshot_id"] = identifier(getattr(args, "snapshot", None))
            validate_closure(run, state, finding, event)
        if args.reason:
            event["reason"] = _string(args.reason, "reason")
        finding["history"].append(event)
        finding["status"] = args.status
        finding["evidence"] = list(dict.fromkeys(finding["evidence"] + refs))
    _emit({"finding": args.id, "status": args.status})
    return 0


def cycle(args):
    run = open_run(args)
    reviewer = identifier(_string(args.reviewer, "reviewer"))
    refs = _evidence(run, [args.evidence])
    reassessment = _string(args.reassessment, "reassessment") if args.reassessment else None
    with run.edit() as state:
        cycles = state["cycles"]
        if len(cycles) >= 2 and all(c["outcome"] == "failed" for c in cycles[-2:]) and not reassessment:
            raise Error("two failed fix/review cycles require reassessment before another cycle")
        cycles.append({"reviewer": reviewer, "outcome": args.outcome, "evidence": refs,
                       "reassessment": reassessment, "at": now()})
    _emit({"cycle": len(cycles), "outcome": args.outcome})
    return 0


def finding_close_batch(args):
    """Preflight every closure before committing any transition; retries are idempotent."""
    from validation import operation
    run = open_run(args)
    value = _input(run, args.input)
    if set(value) != {"reviewer", "record_id", "snapshot_id", "findings"}:
        raise Error("Batch closure requires reviewer, record_id, snapshot_id and findings")
    reviewer, record_id, snapshot_id = (identifier(value[k]) for k in ("reviewer", "record_id", "snapshot_id"))
    items = _list(value["findings"], "findings")
    if not items:
        raise Error("Batch closure requires at least one finding")
    prepared, unchanged, seen = [], [], set()
    with run.edit() as state:
        with operation(run) as view:
            for item in items:
                if not isinstance(item, dict) or set(item) - {"id", "evidence", "reason"}:
                    raise Error("Invalid batch finding fields")
                fid = identifier(item.get("id"))
                if fid in seen:
                    raise Error("Duplicate finding in batch")
                seen.add(fid)
                finding = state["findings"].get(fid)
                if not finding:
                    raise Error("Unknown finding in batch")
                event = {"status": "closed", "reviewer": reviewer, "record_id": record_id,
                         "snapshot_id": snapshot_id, "evidence": _evidence(view, item.get("evidence")), "at": now()}
                if "reason" in item:
                    event["reason"] = _string(item["reason"], "reason")
                if finding["status"] == "closed":
                    previous = finding["history"][-1]
                    if {k: v for k, v in previous.items() if k != "at"} != {k: v for k, v in event.items() if k != "at"}:
                        raise Error("Closed finding differs from batch; reopen explicitly for new review")
                    validate_closure(view, state, finding, previous)
                    unchanged.append(fid)
                else:
                    validate_closure(view, state, finding, event)
                    prepared.append((finding, event))
        for finding, event in prepared:
            finding["history"].append(event)
            finding["status"] = "closed"
            finding["evidence"] = list(dict.fromkeys(finding["evidence"] + event["evidence"]))
    _emit({"closed": [finding["id"] for finding, _ in prepared], "unchanged": unchanged})
    return 0


def _number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def _date(value):
    if not isinstance(value, str):
        return None
    try:
        stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return stamp if stamp.tzinfo is not None else None
    except ValueError:
        return None


def _identity(record):
    return "|".join(str(record.get(key, "")) for key in ("agent", "invocation", "stage", "attempt"))


def code_change(record):
    """Integration wiring has the same review-independence boundary as other code."""
    return record.get("stage") in ("implement", "fix") or (
        record.get("stage") == "integrate" and record.get("changes_code") is True)


def validate_closure(run, state, finding, closure):
    """Require fresh independent revalidation, including when rechecking a closed finding."""
    from evidence import snapshot_matches
    reviewer = finding.get("reviewer")
    implementers = {r.get("agent") for r in state["records"].values() if code_change(r)}
    if (closure.get("status") != "closed" or closure.get("reviewer") != reviewer
            or reviewer == finding.get("owner") or reviewer in implementers):
        raise Error("closure requires the assigned independent reviewer")
    if not closure.get("evidence"):
        raise Error("closure requires existing evidence")
    _evidence(run, closure["evidence"])
    record_id = closure.get("record_id")
    record = state["records"].get(record_id)
    if (not record or record.get("agent") != reviewer or record.get("status") != "succeeded"
            or record.get("stage") not in ("review", "revalidate")):
        raise Error("closure requires a successful assigned review/revalidation record")
    registered = state["expected"].get(_identity(record))
    if not registered or registered.get("record_id") != record_id:
        raise Error("closure review record must match the expected invocation registry")
    start, end, at = (_date(record.get("start")), _date(record.get("end")), _date(closure.get("at")))
    created = _date(finding.get("created_at"))
    if start is None or end is None or at is None or created is None or end < start or end > at:
        raise Error("closure review timing is incomplete or inconsistent")
    boundaries = [created]
    for event in finding.get("history", []):
        if event.get("status") == "open":
            reopened = _date(event.get("at"))
            if reopened is None:
                raise Error("finding creation/reopen timing is missing")
            boundaries.append(reopened)
    completed_changes = []
    for row in state["records"].values():
        if row.get("agent") == finding.get("owner") and code_change(row):
            if row.get("status") in ("succeeded", "failed", "interrupted"):
                change_end = _date(row.get("end"))
                if change_end is None:
                    raise Error("owner implementation/fix completion timing is missing")
                completed_changes.append(change_end)
    boundaries.extend(completed_changes)
    if start < max(boundaries):
        raise Error("closure review must start after the finding/reopen and latest completed owner implementation/fix")
    snapshot_id = closure.get("snapshot_id")
    snapshot = state["snapshots"].get(snapshot_id)
    snapshot_at = _date(snapshot.get("created_at")) if snapshot else None
    if snapshot_at is None or not snapshot_matches(run, snapshot_id):
        raise Error("closure requires a current recorded snapshot")
    if completed_changes and snapshot_at < max(completed_changes):
        raise Error("closure snapshot must be recorded after the latest completed owner implementation/fix")


def check_run(run):
    """Return machine-readable consistency violations and telemetry coverage."""
    from validation import operation
    with operation(run) as view:
        return _check_run(view)


def _check_run(run):
    state = run.state()
    errors, warnings = [], []
    records = state.get("records", {})
    expected = state.get("expected", {})
    if not expected:
        errors.append("expected invocation/stage registry is empty")
    rows = {key: [] for key in expected}
    latest = {}
    successful = []
    unavailable = 0
    for rid, record in records.items():
        key = _identity(record)
        if key not in expected:
            errors.append(f"record {rid}: invocation/stage is not registered")
        else:
            rows[key].append(rid)
        label = f"record {rid}"
        status = record.get("status")
        if status not in ("succeeded", "failed", "interrupted"):
            errors.append(f"{label}: unfinished or invalid status")
        start = _date(record.get("start"))
        end = _date(record.get("end"))
        if start is None or end is None or end < start or not _number(record.get("elapsed_seconds")):
            errors.append(f"{label}: missing or invalid complete timing")
        for field in ("selected_model", "selected_effort"):
            if not isinstance(record.get(field), str) or not record[field].strip():
                errors.append(f"{label}: missing {field}")
        source = record.get("usage_source")
        if not isinstance(source, str) or not source.strip():
            reason = record.get("unavailable_reasons", {}).get("usage_source")
            if not isinstance(reason, str) or not reason.strip():
                errors.append(f"{label}: missing usage_source or unavailable reason")
            else:
                warnings.append(f"{label}: usage_source unavailable ({reason})")
        usage = record.get("usage", {})
        reasons = usage.get("unavailable_reasons", record.get("unavailable_reasons", {}))
        for field in ("input_tokens", "output_tokens", "cache_read_tokens"):
            value = usage.get(field)
            if value is None:
                reason = reasons.get(field) if isinstance(reasons, dict) else None
                if not isinstance(reason, str) or not reason.strip():
                    errors.append(f"{label}: unavailable {field} needs a reason")
                else:
                    unavailable += 1
                    warnings.append(f"{label}: {field} unavailable ({reason})")
            elif not _number(value) or int(value) != value:
                errors.append(f"{label}: invalid {field}")
        for field in ("tool_calls", "retries"):
            value = record.get(field)
            if value is None:
                reason = record.get("unavailable_reasons", {}).get(field)
                if not isinstance(reason, str) or not reason.strip():
                    errors.append(f"{label}: unavailable {field} needs a reason")
                else:
                    warnings.append(f"{label}: {field} unavailable ({reason})")
            elif not _number(value) or int(value) != value:
                errors.append(f"{label}: invalid {field}")
        group = tuple(record.get(k) for k in ("agent", "invocation", "stage"))
        attempt = record.get("attempt")
        if isinstance(attempt, int) and not isinstance(attempt, bool):
            if group not in latest or attempt > latest[group][0]:
                latest[group] = (attempt, rid, record)
        else:
            errors.append(f"{label}: invalid attempt")
        if status == "succeeded":
            successful.append(record)
    for key, invocation in expected.items():
        matches = rows[key]
        if len(matches) != 1:
            errors.append(f"expected {key}: requires exactly one resource record, found {len(matches)}")
        elif invocation.get("record_id") not in (None, matches[0]):
            errors.append(f"expected {key}: record_id disagrees with identity")
    for _, rid, record in latest.values():
        if record.get("status") != "succeeded":
            errors.append(f"record {rid}: latest stage attempt remains unresolved")
    stages = {record.get("stage") for record in successful}
    for stage in state.get("required_stages", REQUIRED_STAGES):
        if stage not in stages:
            errors.append(f"required stage {stage}: no successful resource record")
    implementers = {r.get("agent") for r in records.values() if code_change(r)}
    reviewers = {r.get("agent") for r in successful if r.get("stage") in ("review", "revalidate")}
    security_reviewers = {r.get("agent") for r in successful if r.get("stage") == "security"}
    if not reviewers - implementers:
        errors.append("independent review: no successful reviewer distinct from implementation/fix agents")
    if not security_reviewers - implementers:
        errors.append("independent security review: no successful security agent distinct from implementation/fix agents")
    for fid, finding in state.get("findings", {}).items():
        if (finding.get("blocks") or finding.get("severity") in ("HIGH", "CRITICAL")) and finding.get("status") != "closed":
            errors.append(f"finding {fid}: unresolved blocker ({finding.get('status')})")
        if finding.get("reviewer") == finding.get("owner") or finding.get("reviewer") not in reviewers - implementers:
            errors.append(f"finding {fid}: assigned independent reviewer has no successful review record")
        if finding.get("status") == "closed":
            history = finding.get("history", [])
            closure = history[-1] if history else {}
            try:
                validate_closure(run, state, finding, closure)
            except (Error, OSError) as exc:
                errors.append(f"finding {fid}: invalid closure evidence: {exc}")
    cycles = state.get("cycles", [])
    for index in range(2, len(cycles)):
        if all(c.get("outcome") == "failed" for c in cycles[index - 2:index]) and not cycles[index].get("reassessment"):
            errors.append(f"cycle {index + 1}: required reassessment is missing")
    if cycles and cycles[-1].get("outcome") == "failed":
        errors.append("latest fix/review cycle failed")
    from evidence import handoff_is_valid, snapshot_matches
    checked_snapshots = {}
    current_counts = {"commands": 0, "handoffs": 0}
    implementation_handoffs = 0
    for kind in ("commands", "handoffs"):
        items = state.get(kind, {})
        for eid, item in items.items():
            seen = {eid}
            cursor = item
            while cursor.get("superseded_by"):
                successor = cursor["superseded_by"]
                if successor not in items or successor in seen or not cursor.get("superseded_reason"):
                    errors.append(f"{kind} {eid}: invalid or cyclic evidence supersession")
                    break
                seen.add(successor)
                cursor = items[successor]
            if item.get("superseded_by"):
                continue  # Historical evidence remains recorded, but the terminal evidence gates.
            current_counts[kind] += 1
            sid = item.get("snapshot_id")
            if kind == "handoffs" and not handoff_is_valid(run, eid):
                errors.append(f"handoffs {eid}: invalid artifact, references, resource record, or snapshot")
            if kind == "handoffs" and sid is None:
                continue  # Explicit design-only handoffs have no implementation state.
            if kind == "handoffs":
                implementation_handoffs += 1
            if sid not in checked_snapshots:
                try:
                    checked_snapshots[sid] = bool(sid and snapshot_matches(run, sid))
                except (Error, OSError, KeyError):
                    checked_snapshots[sid] = False
            if item.get("stale") or not checked_snapshots[sid]:
                errors.append(f"{kind} {eid}: missing or stale snapshot evidence")
            if kind == "commands" and (item.get("exit_code") != 0 or any(item.get(flag) for flag in ("timed_out", "truncated", "incomplete", "launch_failed"))):
                errors.append(f"command {eid}: failed, timed out, truncated, or incomplete evidence")
    for kind, count in current_counts.items():
        if count == 0:
            errors.append(f"{kind}: no current evidence recorded")
    if implementation_handoffs == 0:
        errors.append("handoffs: no current snapshot-bound implementation handoff recorded")
    if state.get("workflow_version", 2) >= 3:
        from planning import readiness_errors
        errors.extend(readiness_errors(run, state, closing=True))
    return {"ok": not errors, "errors": errors, "warnings": warnings,
            "coverage": {"expected_records": len(expected), "resource_records": len(records),
                         "unavailable_token_metrics": unavailable},
            "scope": "Local consistency checks do not establish semantic correctness."}


def completeness(args):
    report = check_run(open_run(args))
    _emit(report)
    return int(not report["ok"])


def register(subparsers):
    parser = subparsers.add_parser("assignment", help="register exclusive file/directory ownership")
    parser.add_argument("--input", required=True)
    parser.set_defaults(func=assignment)
    parser = subparsers.add_parser("ownership", help="check explicit changed paths against an assignment")
    parser.add_argument("--assignment", required=True)
    parser.add_argument("--path", action="append", required=True)
    parser.set_defaults(func=ownership)
    parser = subparsers.add_parser("finding", help="record findings and append-only transitions")
    commands = parser.add_subparsers(dest="finding_command", required=True)
    add = commands.add_parser("add")
    add.add_argument("--input", required=True)
    add.set_defaults(func=finding_add)
    update = commands.add_parser("update")
    update.add_argument("--id", required=True)
    update.add_argument("--status", choices=FINDING_STATUSES, required=True)
    update.add_argument("--reviewer", required=True)
    update.add_argument("--evidence", action="append")
    update.add_argument("--record", help="successful assigned review/revalidation record; required for closure")
    update.add_argument("--snapshot", help="current post-fix snapshot; required for closure")
    update.add_argument("--reason")
    update.set_defaults(func=finding_update)
    batch = commands.add_parser("close-batch", help="validate all finding closures before one atomic state update")
    batch.add_argument("--input", required=True)
    batch.set_defaults(func=finding_close_batch)
    parser = subparsers.add_parser("cycle", help="record fix/review outcomes with a reassessment guard")
    parser.add_argument("--reviewer", required=True)
    parser.add_argument("--outcome", choices=("passed", "failed"), required=True)
    parser.add_argument("--evidence", required=True)
    parser.add_argument("--reassessment")
    parser.set_defaults(func=cycle)
    parser = subparsers.add_parser("completeness", help="report evidence consistency as JSON")
    parser.set_defaults(func=completeness)
