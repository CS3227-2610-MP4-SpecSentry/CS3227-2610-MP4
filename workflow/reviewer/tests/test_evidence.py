"""Requirement-focused local evidence tests, using disposable Git repositories."""
import argparse
import base64
import contextlib
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import core
import evidence
import validation


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git("init", "--quiet")
        self.git("config", "user.name", "Evidence fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        (self.repo / "src").mkdir()
        (self.repo / "src" / "code.txt").write_text("original\n", encoding="utf-8")
        (self.repo / "context.md").write_text("context\n", encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "--quiet", "-m", "fixture")
        self.run = core.create_run(self.repo, "fixture", "run", ["REQ-REV-001"])

    def git(self, *argv):
        return subprocess.run(["git", *argv], cwd=self.repo, check=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout

    def args(self, **kwargs):
        return argparse.Namespace(repo=self.repo, run=self.run.path, **kwargs)

    def invoke(self, function, **kwargs):
        with contextlib.redirect_stdout(io.StringIO()):
            return function(self.args(**kwargs))

    def snapshot(self, key="source", paths=None):
        return self.invoke(evidence.snapshot, id=key, path=paths or ["src"], base="HEAD")

    def command(self, key="check", code="print('ok')", rest=None, **kwargs):
        return self.invoke(evidence.command, id=key, snapshot="source", timeout=kwargs.get("timeout", 5),
                           save_output=kwargs.get("save_output", False),
                           argv=["--", sys.executable, "-c", code, *(rest or [])])

    def handoff_input(self, **changes):
        value = {name: "Recorded " + name for name, _ in evidence.SECTIONS}
        value.update({"snapshot_id": "source", "references": ["context.md"]})
        value.update(changes)
        # Inputs are workflow evidence and deliberately outside snapshot scope.
        path = self.run.path / "handoff-input.json"
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def test_snapshot_tracks_untracked_changes_and_deletions(self):
        self.snapshot()
        self.assertTrue(evidence.snapshot_matches(self.run, "source"))
        untracked = self.repo / "src" / "new.txt"
        untracked.write_text("new", encoding="utf-8")
        self.assertFalse(evidence.snapshot_matches(self.run, "source"))
        self.snapshot("untracked")
        untracked.write_text("changed", encoding="utf-8")
        self.assertFalse(evidence.snapshot_matches(self.run, "untracked"))
        self.git("rm", "--quiet", "src/code.txt")
        self.snapshot("deletion")
        record = self.run.state()["snapshots"]["deletion"]
        self.assertEqual({"deleted": True}, record["snapshot"]["files"]["src/code.txt"])
        self.assertTrue(evidence.snapshot_matches(self.run, "deletion"))

    def test_validation_reuses_scopes_but_rechecks_artifacts_and_return_boundary(self):
        self.snapshot("one")
        self.snapshot("two")
        with patch.object(evidence, "_snapshot", wraps=evidence._snapshot) as rebuilt:
            with validation.operation(self.run) as view:
                for _ in range(4):
                    self.assertTrue(evidence.snapshot_matches(view, "one"))
                    self.assertTrue(evidence.snapshot_matches(view, "two"))
                self.assertEqual(rebuilt.call_count, 1)
            self.assertEqual(rebuilt.call_count, 2)  # One initial pass + one return-boundary pass.
        (self.repo / "src/code.txt").write_text("later edit", encoding="utf-8")
        with validation.operation(self.run) as view:
            self.assertFalse(evidence.snapshot_matches(view, "one"))

    def test_validation_detects_source_and_state_changes_during_operation(self):
        self.snapshot()
        for change in ("edit", "untracked", "delete", "state", "artifact", "head", "index"):
            with self.subTest(change=change):
                self.snapshot("s-" + change)
                with self.assertRaises(core.Error), validation.operation(self.run) as view:
                    self.assertTrue(evidence.snapshot_matches(view, "s-" + change))
                    if change == "edit":
                        target = self.repo / "src/code.txt"
                        stat = target.stat()
                        original = target.read_bytes()
                        target.write_bytes(bytes((b ^ 1) for b in original))
                        # Same size and restored mtime must not evade content checks.
                        __import__("os").utime(target, ns=(stat.st_atime_ns, stat.st_mtime_ns))
                    elif change == "untracked":
                        (self.repo / "src/new.txt").write_text("new", encoding="utf-8")
                    elif change == "delete":
                        (self.repo / "src/code.txt").unlink()
                    elif change == "state":
                        with self.run.edit() as state:
                            state["extra"] = True
                    elif change == "artifact":
                        artifact = self.repo / view.state()["snapshots"]["s-" + change]["artifact"]
                        artifact.write_text("tampered", encoding="utf-8")
                    elif change == "head":
                        self.git("commit", "--allow-empty", "--quiet", "-m", "head moved")
                    else:
                        self.git("rm", "--cached", "--quiet", "src/code.txt")
                self.git("reset", "--hard", "--quiet", "HEAD")
                (self.repo / "src/new.txt").unlink(missing_ok=True)

    def test_validation_rejects_redirection_even_on_cached_artifact(self):
        self.snapshot()
        outside = self.repo / "outside.json"
        artifact = self.repo / self.run.state()["snapshots"]["source"]["artifact"]
        outside.write_bytes(artifact.read_bytes())
        try:
            probe = self.repo / "probe-link"
            probe.symlink_to(outside)
            probe.unlink()
        except OSError:
            self.skipTest("Symlink creation unavailable on this host")
        with self.assertRaises(core.Error), validation.operation(self.run) as view:
            self.assertTrue(evidence.snapshot_matches(view, "source"))
            artifact.unlink()
            artifact.symlink_to(outside)
            self.assertFalse(evidence.snapshot_matches(view, "source"))
        (self.repo / "src" / "code.txt").write_text("restored", encoding="utf-8")
        self.assertFalse(evidence.snapshot_matches(self.run, "deletion"))

    def test_snapshot_checks_head_and_artifact_integrity(self):
        self.snapshot()
        self.git("commit", "--quiet", "--allow-empty", "-m", "new HEAD")
        self.assertFalse(evidence.snapshot_matches(self.run, "source"))
        self.snapshot("second")
        artifact = self.repo / self.run.state()["snapshots"]["second"]["artifact"]
        artifact.write_text("{}", encoding="utf-8")
        self.assertFalse(evidence.snapshot_matches(self.run, "second"))

    def test_snapshot_excludes_secrets_git_and_logs(self):
        (self.repo / ".env").write_text("SECRET=fixture", encoding="utf-8")
        (self.repo / "src" / "private.key").write_text("fixture key", encoding="utf-8")
        self.git("add", ".env", "src/private.key")
        self.snapshot(paths=["."])
        files = self.run.state()["snapshots"]["source"]["snapshot"]["files"]
        self.assertIn("src/code.txt", files)
        self.assertNotIn(".env", files)
        self.assertNotIn("src/private.key", files)
        self.assertFalse(any(p.startswith((".git/", "logs/")) for p in files))
        (self.run.path / "new-evidence.txt").write_text("evidence", encoding="utf-8")
        self.assertTrue(evidence.snapshot_matches(self.run, "source"))

    def test_snapshot_rejects_path_escapes_and_secret_selection(self):
        for path in ("../outside", ".git/config", ".env", "missing-selection", str(self.repo.parent)):
            with self.subTest(path=path), self.assertRaises(core.Error):
                self.snapshot(paths=[path])

    def test_snapshot_rejects_symlink_if_available(self):
        link = self.repo / "src" / "redirect"
        try:
            link.symlink_to(self.repo / "context.md")
        except OSError:
            self.skipTest("Creating symlinks is unavailable in this Windows session")
        with self.assertRaises(core.Error):
            self.snapshot()

    def test_command_shell_metacharacters_are_literal(self):
        self.snapshot()
        argument = "hello && echo injected > marker.txt; $(echo danger)"
        self.assertEqual(0, self.command(code="import sys; sys.stdout.buffer.write(sys.argv[1].encode())", rest=[argument]))
        result = self.run.state()["commands"]["check"]
        self.assertEqual(hashlib.sha256(argument.encode()).hexdigest(), result["streams"]["stdout"]["sha256"])
        self.assertFalse((self.repo / "marker.txt").exists())

    def test_command_default_never_retains_output_argv_or_exception(self):
        self.snapshot()
        secret = "SECRET_FIXTURE_DO_NOT_RETAIN_142"
        self.assertEqual(0, self.command(code="print(" + repr(secret) + ")"))
        for path in self.run.path.rglob("*"):
            if path.is_file():
                self.assertNotIn(secret.encode(), path.read_bytes())
        self.assertEqual({}, self.run.state()["commands"]["check"]["output_artifacts"])
        self.assertEqual(1, self.invoke(evidence.command, id="missing", snapshot="source", timeout=1,
                                      save_output=False, argv=[str(self.repo / secret / "missing.exe")]))
        self.assertNotIn(secret, json.dumps(self.run.state()))

    def test_command_output_limit_is_gate_failure_with_or_without_capture(self):
        self.snapshot()
        for save_output in (False, True):
            key = "saved" if save_output else "discarded"
            self.assertEqual(1, self.command(key=key, code="import sys; sys.stdout.write('x' * 200000)", save_output=save_output))
            result = self.run.state()["commands"][key]
            self.assertTrue(result["truncated"])
            self.assertEqual(200000, result["streams"]["stdout"]["bytes"])
            if save_output:
                data = core.read_json(self.repo / result["output_artifacts"]["stdout"])
                self.assertEqual(evidence.OUTPUT_LIMIT, len(base64.b64decode(data["base64"])))

    def test_command_timeout_nonzero_and_source_mutation_fail(self):
        self.snapshot()
        self.assertEqual(1, self.command(key="timeout", code="import time; time.sleep(10)", timeout=.1))
        self.assertTrue(self.run.state()["commands"]["timeout"]["timed_out"])
        self.assertEqual(1, self.command(key="nonzero", code="raise SystemExit(7)"))
        self.assertEqual(7, self.run.state()["commands"]["nonzero"]["exit_code"])
        self.assertEqual(1, self.command(key="mutation", code="from pathlib import Path; Path('src/code.txt').write_text('changed')"))
        self.assertTrue(self.run.state()["commands"]["mutation"]["stale"])
        with self.assertRaises(core.Error):
            self.command(key="stale")

    def test_command_rejects_bad_timeout_and_duplicate_ids(self):
        self.snapshot()
        for timeout in (0, -1, 3601, float("nan"), float("inf")):
            with self.subTest(timeout=timeout), self.assertRaises(core.Error):
                self.command(timeout=timeout)
        self.command()
        with self.assertRaises(core.Error):
            self.command()
        with self.assertRaises(core.Error):
            self.snapshot()

    def test_handoff_escapes_hostile_markdown_and_has_exact_canonical_headings(self):
        self.snapshot()
        hostile = "![remote](https://attacker.invalid/a)\n## Forged heading\n<script>bad</script>"
        source = self.handoff_input(identity=hostile)
        self.invoke(evidence.handoff, id="handoff", input=str(source))
        record = self.run.state()["handoffs"]["handoff"]
        rendered = (self.repo / record["artifact"]).read_text(encoding="utf-8")
        self.assertEqual(["## " + title for _, title in evidence.SECTIONS],
                         [line for line in rendered.splitlines() if line.startswith("## ")])
        self.assertNotIn("![remote]", rendered)
        self.assertNotIn("<script>", rendered)
        self.assertNotIn("](https://", rendered)
        self.assertIn("context.md", rendered)
        self.assertEqual(0, self.invoke(evidence.handoff_validate, id="handoff"))
        with self.assertRaises(core.Error):
            self.invoke(evidence.handoff, id="handoff", input=str(source))

    def test_handoff_rejects_remote_and_outside_references(self):
        self.snapshot()
        for reference in ("https://attacker.invalid/file", "../outside", ".git/config"):
            with self.subTest(reference=reference):
                source = self.handoff_input(references=[reference])
                with self.assertRaises(core.Error):
                    self.invoke(evidence.handoff, id="bad", input=str(source))

    def test_handoff_validates_artifact_references_snapshot_and_resource(self):
        self.snapshot()
        source = self.handoff_input()
        self.invoke(evidence.handoff, id="code", input=str(source))
        (self.repo / "src" / "code.txt").write_text("stale", encoding="utf-8")
        with self.assertRaises(core.Error):
            self.invoke(evidence.handoff_validate, id="code")
        source = self.handoff_input(snapshot_id=None, state="design: brief version 1")
        self.invoke(evidence.handoff, id="design", input=str(source))
        artifact = self.repo / self.run.state()["handoffs"]["design"]["artifact"]
        artifact.write_text("changed", encoding="utf-8")
        with self.assertRaises(core.Error):
            self.invoke(evidence.handoff_validate, id="design")
        self.invoke(evidence.handoff, id="reference", input=str(source))
        (self.repo / "context.md").unlink()
        with self.assertRaises(core.Error):
            self.invoke(evidence.handoff_validate, id="reference")
        source = self.handoff_input(references=[], resource_record="unknown")
        with self.assertRaises(core.Error):
            self.invoke(evidence.handoff, id="resource", input=str(source))

    def test_handoff_requires_all_sections_and_state_identity(self):
        self.snapshot()
        for fields in ({"permissions": ""}, {"snapshot_id": None}, {"resources": []}):
            source = self.handoff_input(**fields)
            with self.subTest(fields=fields), self.assertRaises(core.Error):
                self.invoke(evidence.handoff, id="invalid", input=str(source))

    def test_registration_supports_documented_command_shapes(self):
        parser = argparse.ArgumentParser()
        evidence.register(parser.add_subparsers())
        parsed = parser.parse_args(["handoff", "--id", "ready", "--input", "input.json"])
        self.assertEqual(evidence.handoff, parsed.func)
        parsed = parser.parse_args(["handoff", "validate", "--id", "ready"])
        self.assertEqual(evidence.handoff_validate, parsed.func)
        parsed = parser.parse_args(["command", "--id", "check", "--snapshot", "source", "--", "echo", "a;b"])
        self.assertEqual(["--", "echo", "a;b"], parsed.argv)

    def test_supersede_preserves_history_and_requires_current_successor(self):
        self.snapshot()
        self.command(key="failed", code="raise SystemExit(1)")
        self.command(key="passed")
        before = self.run.state()["commands"]["failed"].copy()
        self.assertEqual(0, self.invoke(evidence.supersede, kind="commands", id="failed", by="passed", reason="Corrected command"))
        record = self.run.state()["commands"]["failed"]
        self.assertEqual("passed", record["superseded_by"])
        for key, value in before.items():
            self.assertEqual(value, record[key])
        for old, new in (("passed", "failed"), ("passed", "passed"), ("passed", "missing"), ("failed", "passed")):
            with self.subTest(old=old, new=new), self.assertRaises(core.Error):
                self.invoke(evidence.supersede, kind="commands", id=old, by=new, reason="Invalid replacement")
        self.command(key="another-failure", code="raise SystemExit(1)")
        (self.repo / "src" / "code.txt").write_text("changed", encoding="utf-8")
        with self.assertRaises(core.Error):
            self.invoke(evidence.supersede, kind="commands", id="another-failure", by="passed", reason="Stale replacement")

    def test_handoff_successor_is_validated_and_old_artifact_preserved(self):
        self.snapshot()
        source = self.handoff_input()
        self.invoke(evidence.handoff, id="old", input=str(source))
        old_artifact = self.repo / self.run.state()["handoffs"]["old"]["artifact"]
        old_content = old_artifact.read_bytes()
        self.invoke(evidence.handoff, id="new", input=str(source))
        self.assertTrue(evidence.handoff_is_valid(self.run, "new"))
        self.invoke(evidence.supersede, kind="handoffs", id="old", by="new", reason="Updated summary")
        self.assertEqual(old_content, old_artifact.read_bytes())
        new_artifact = self.repo / self.run.state()["handoffs"]["new"]["artifact"]
        new_artifact.write_text("tampered", encoding="utf-8")
        self.assertFalse(evidence.handoff_is_valid(self.run, "new"))


if __name__ == "__main__":
    unittest.main()
