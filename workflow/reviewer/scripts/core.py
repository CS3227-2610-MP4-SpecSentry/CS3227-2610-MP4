"""Storage and boundary helpers for Reviewer workflow evidence (not a sandbox)."""
from __future__ import annotations

import contextlib
import copy
import datetime as dt
import html
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


class Error(ValueError):
    """An actionable input or evidence error, safe to show without a traceback."""


STAGES = ("compile", "security", "dispatch", "implement", "integrate", "review",
          "fix", "revalidate", "document", "close")
REQUIRED_STAGES = ("compile", "security", "dispatch", "implement", "integrate", "review", "close")
REPO = Path(__file__).resolve().parents[3]


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,99}", value):
        raise Error("IDs must be 1-100 letters/digits, underscores, dots or hyphens")
    if value.endswith(".") or value.split(".")[0].upper() in {
        "CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(10)),
        *(f"LPT{i}" for i in range(10)),
    }:
        raise Error("Reserved filesystem identifier")
    return value


def text(value):
    if not isinstance(value, str) or not value.strip():
        raise Error("A nonempty text value is required")
    return value.strip()


def literal(value):
    value = html.escape(str(value), quote=True).replace("\r", "").replace("\n", " &#10; ")
    return re.sub(r"([\\`*_{}\[\]()#!|>~+-])", r"\\\1", value)


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise Error("Cannot read valid UTF-8 JSON input") from exc


def contained(root, value):
    """Reject redirections in existing ancestors, including Windows junctions."""
    root = Path(root).absolute()
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = root / candidate
    # Reject traversal rather than silently normalizing it, also on POSIX for Windows input.
    if ".." in candidate.parts or ".." in str(value).replace("\\", "/").split("/"):
        raise Error("Parent traversal is not allowed")
    for segment in (candidate, *candidate.parents, root, *root.parents):
        if segment.is_symlink() or (hasattr(segment, "is_junction") and segment.is_junction()):
            raise Error("Symlink/junction paths are not accepted for workflow artifacts")
        if os.name == "nt" and segment.exists():
            import stat
            if getattr(segment.lstat(), "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                raise Error("Reparse-point paths are not accepted for workflow artifacts")
    resolved = candidate.resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise Error("Path is outside its allowed directory")
    return resolved


def repo_file(repo, value):
    path = contained(repo, value)
    if ".git" in path.relative_to(Path(repo).resolve()).parts or not path.is_file():
        raise Error("Expected an existing repository file outside .git")
    return path


def record_key(agent, invocation, stage, attempt):
    identifier(agent)
    identifier(invocation)
    if stage not in STAGES or isinstance(attempt, bool) or not isinstance(attempt, int) or attempt < 1:
        raise Error("Invalid stage or attempt")
    return f"{agent}|{invocation}|{stage}|{attempt}"


def validate_repo(repo):
    """Alternate checkouts are explicit, but arbitrary output roots are rejected."""
    path = Path(repo).absolute()
    contained(path, path)
    if not path.is_dir() or not (path / ".git").exists():
        raise Error("--repo must identify an actual Git checkout root")
    try:
        result = subprocess.run(["git", "--no-optional-locks", "rev-parse", "--show-toplevel"],
                                cwd=path, capture_output=True, timeout=10, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise Error("Cannot validate the selected Git checkout") from exc
    if result.returncode or Path(os.fsdecode(result.stdout).rstrip("\r\n")).resolve() != path.resolve():
        raise Error("--repo must be the Git checkout root, not a subdirectory")
    return path.resolve()


def create_run(repo, name, run_id, requirements):
    repo = validate_repo(repo)
    identifier(name)
    identifier(run_id)
    if not requirements or any(not re.fullmatch(r"REQ-REV-00[1-6]", r) for r in requirements):
        raise Error("Reviewer runs require REQ-REV-001 through REQ-REV-006 references")
    path = contained(repo, Path("logs") / name / "reviewer" / run_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    contained(repo, path)
    try:
        path.mkdir(exist_ok=False)
    except FileExistsError as exc:
        raise Error("Run already exists; select a new run ID") from exc
    state = {
        "schema_version": 1, "scope": "reviewer", "run_id": run_id, "prompter": name,
        "requirements": list(dict.fromkeys(requirements)), "created_at": now(),
        "required_stages": list(REQUIRED_STAGES), "expected": {}, "records": {},
        "assignments": {}, "findings": {}, "cycles": [], "snapshots": {},
        "commands": {}, "handoffs": {},
    }
    (path / "state.json").write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    return Run(repo, path)


class Run:
    def __init__(self, repo, path):
        self.repo = validate_repo(repo)
        self.path = contained(self.repo, path)
        parts = self.path.relative_to(self.repo).parts
        if len(parts) != 4 or parts[0] != "logs" or parts[2] != "reviewer":
            raise Error("Run must be logs/<prompter>/reviewer/<run-id>")
        identifier(parts[1])
        identifier(parts[3])
        self.state()

    def state(self):
        data = read_json(contained(self.repo, self.path / "state.json"))
        if not isinstance(data, dict) or data.get("schema_version") != 1 or data.get("scope") != "reviewer":
            raise Error("Unsupported or non-Reviewer run state")
        if data.get("run_id") != self.path.name or data.get("prompter") != self.path.parent.parent.name:
            raise Error("Run identity does not match its directory")
        for key in ("expected", "records", "assignments", "findings", "snapshots", "commands", "handoffs"):
            if not isinstance(data.get(key), dict):
                raise Error("Malformed run collections")
        if not isinstance(data.get("cycles"), list):
            raise Error("Malformed cycle history")
        return data

    @contextlib.contextmanager
    def edit(self):
        lock = contained(self.repo, self.path / ".lock")
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError as exc:
            raise Error("Run is locked; retry after its writer finishes (locks are never stolen)") from exc
        try:
            os.close(fd)
            before = self.state()
            data = copy.deepcopy(before)
            yield data
            if self.state() != before:
                raise Error("Run changed outside the writer lock; refusing stale update")
            self._save(data)
        finally:
            # A redirected/replaced run must not cause unlink outside the original boundary.
            contained(self.repo, lock).unlink(missing_ok=True)

    def _save(self, data):
        target = contained(self.repo, self.path / "state.json")
        fd, temporary = tempfile.mkstemp(prefix=".state-", suffix=".tmp", dir=self.path)
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
                json.dump(data, stream, indent=2, allow_nan=False)
                stream.write("\n")
                stream.flush()
                os.fsync(stream.fileno())
            contained(self.repo, target)
            os.replace(temporary, target)
        finally:
            Path(temporary).unlink(missing_ok=True)

    def artifact(self, relative, data):
        path = contained(self.path, relative)
        path.parent.mkdir(parents=True, exist_ok=True)
        contained(self.repo, path)
        try:
            with path.open("x", encoding="utf-8", newline="\n") as stream:
                stream.write(data)
        except FileExistsError as exc:
            raise Error("Artifact already exists; evidence is never overwritten") from exc
        return path


def open_run(args):
    if not args.run:
        raise Error("Supply --run logs/<prompter>/reviewer/<run-id> before the command")
    return Run(args.repo, args.run)


def add_identity(parser):
    parser.add_argument("--agent", required=True)
    parser.add_argument("--invocation", required=True)
    parser.add_argument("--stage", choices=STAGES, required=True)
    parser.add_argument("--attempt", type=int, default=1)


def emit(data):
    print(json.dumps(data, indent=2, ensure_ascii=True, allow_nan=False))
