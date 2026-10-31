"""Temporary-workspace tests for evidence integrity and usage accounting."""
import argparse
import contextlib
import io
import json
from pathlib import Path
import sys
import subprocess
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import core
import recording


class RecordingTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.repo = Path(self.temporary.name).resolve()
        subprocess.run(["git", "init", str(self.repo)], check=True, capture_output=True)
        self.run = core.create_run(self.repo, "tester", "test-run", ["REQ-REV-002"])

    def call(self, handler, **kwargs):
        args = dict(repo=self.repo, run=self.run.path, agent="main", invocation="one",
                    stage="implement", attempt=1, model="selected-model", effort="medium")
        args.update(kwargs)
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            result = handler(argparse.Namespace(**args))
        return result, json.loads(output.getvalue())

    def begin(self, **kwargs):
        return self.call(recording.start, **kwargs)[1]["record_id"]

    def finish(self, record_id, **kwargs):
        return self.call(recording.finish, id=record_id, status="succeeded", outcome="checked",
                         unavailable_reason="runtime does not expose this counter", **kwargs)

    def import_usage(self, record_id, **changes):
        supplied = dict(import_id="usage-one", record_id=record_id, scope="record",
                        source="fixture telemetry", input_tokens=100, output_tokens=20,
                        cache_read_tokens=40, tool_calls=2, retries=0,
                        observed_model="observed-model", observed_effort="low")
        supplied.update(changes)
        path = self.repo / "usage.json"
        path.write_text(json.dumps(supplied), encoding="utf-8")
        return self.call(recording.usage, input="usage.json")

    def test_record_identity_separates_agents_stages_and_fix_attempts(self):
        ids = {self.begin(), self.begin(agent="worker"), self.begin(stage="fix"),
               self.begin(attempt=2), self.begin(invocation="two")}
        self.assertEqual(len(ids), 5)
        self.assertEqual(len(self.run.state()["expected"]), 5)
        with self.assertRaises(core.Error):
            self.begin()

    def test_expected_but_unstarted_work_is_not_silently_dropped(self):
        self.call(recording.expect, agent="reviewer", stage="review")
        expected = self.run.state()["expected"]["reviewer|one|review|1"]
        self.assertIsNone(expected["record_id"])

    def test_integration_code_changes_are_explicit_without_relabeling_implementation(self):
        record_id = self.begin(stage="integrate", changes_code=True)
        self.assertTrue(self.run.state()["records"][record_id]["changes_code"])
        with self.assertRaisesRegex(core.Error, "for integration"):
            self.begin(stage="review", changes_code=True)

    def test_finish_preserves_missing_telemetry_and_measured_time(self):
        record_id = self.begin()
        self.finish(record_id)
        record = self.run.state()["records"][record_id]
        self.assertGreaterEqual(record["elapsed_seconds"], 0)
        self.assertIsNotNone(record["end"])
        self.assertIsNone(record["usage"]["input_tokens"])
        self.assertIn("input_tokens", record["unavailable_reasons"])
        with self.assertRaises(core.Error):
            self.finish(record_id)

    def test_usage_import_provenance_and_dedup(self):
        record_id = self.begin()
        self.finish(record_id)
        self.import_usage(record_id)
        record = self.run.state()["records"][record_id]
        self.assertEqual(record["usage"]["output_tokens"], 20)
        self.assertEqual(record["selected_model"], "selected-model")
        self.assertEqual(record["observed_model"], "observed-model")
        self.assertNotIn("input_tokens", record["unavailable_reasons"])
        with self.assertRaises(core.Error):
            self.import_usage(record_id)
        other = self.begin(agent="other")
        with self.assertRaises(core.Error):
            self.import_usage(other)

    def test_ambiguous_aggregate_negative_boolean_and_cache_counters_rejected(self):
        record_id = self.begin()
        for changes in ({"scope": "invocation"}, {"input_tokens": -1},
                        {"output_tokens": True}, {"cache_read_tokens": 101},
                        {"input_tokens": None}, {"unknown_counter": 4}):
            with self.subTest(changes=changes), self.assertRaises(core.Error):
                self.import_usage(record_id, **changes)
        self.assertIsNone(self.run.state()["records"][record_id]["usage_import_id"])

    def test_partial_usage_requires_reasons_and_reports_coverage(self):
        record_id = self.begin()
        self.import_usage(record_id, output_tokens=None,
                          unavailable_reasons={"output_tokens": "not exposed"})
        self.finish(record_id)
        self.begin(agent="other")
        report = self.call(recording.summarize, markdown=False)[1]
        self.assertEqual(report["records"], 2)
        self.assertEqual(report["finished"], 1)
        self.assertEqual(report["measured_record_coverage"]["input_tokens"], 1)
        self.assertEqual(report["measured_record_coverage"]["output_tokens"], 0)
        self.assertEqual(report["measured_totals_only"]["input_tokens"], 100)

    def test_summary_does_not_add_parallel_durations_to_wall_span(self):
        one, two = self.begin(), self.begin(agent="other")
        for record_id in (one, two):
            self.finish(record_id)
        with self.run.edit() as data:
            for record in data["records"].values():
                record.update(start="2026-10-24T00:00:00+00:00",
                              end="2026-10-24T00:00:10+00:00", elapsed_seconds=10)
        report = self.call(recording.summarize, markdown=False)[1]
        self.assertEqual(report["summed_agent_elapsed_seconds"], 20)
        self.assertEqual(report["observed_record_span_seconds"], 10)


class BoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.repo = Path(self.temporary.name).resolve()
        subprocess.run(["git", "init", str(self.repo)], check=True, capture_output=True)

    def test_nonrepository_output_root_is_rejected_before_creation(self):
        arbitrary = self.repo / "arbitrary-output"
        arbitrary.mkdir()
        with self.assertRaises(core.Error):
            core.create_run(arbitrary, "tester", "run", ["REQ-REV-002"])
        self.assertFalse((arbitrary / "logs").exists())

    def test_scope_identity_and_traversal(self):
        for name in ("../outside", "CON", "x.", "../other", "a/b"):
            with self.subTest(name=name), self.assertRaises(core.Error):
                core.create_run(self.repo, name, "run", ["REQ-REV-002"])
        with self.assertRaises(core.Error):
            core.create_run(self.repo, "tester", "run", ["REQ-CON-001"])
        with self.assertRaises(core.Error):
            core.contained(self.repo, self.repo.parent / (self.repo.name + "-sibling"))

    def test_exclusive_lock_and_artifacts_preserve_original(self):
        run = core.create_run(self.repo, "tester", "run", ["REQ-REV-002"])
        with run.edit():
            with self.assertRaises(core.Error):
                with run.edit():
                    pass
        path = run.artifact("evidence/test.md", "original")
        with self.assertRaises(core.Error):
            run.artifact("evidence/test.md", "replacement")
        self.assertEqual(path.read_text(), "original")
        with self.assertRaises(core.Error):
            run.artifact("../../outside", "unsafe")
        with self.assertRaises(core.Error):
            core.create_run(self.repo, "tester", "run", ["REQ-REV-002"])

    def test_symlink_redirect_is_rejected(self):
        outside = self.repo / "outside"
        outside.mkdir()
        try:
            (self.repo / "logs").symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest("Creating symlinks requires unavailable OS privileges")
        with self.assertRaises(core.Error):
            core.create_run(self.repo, "tester", "run", ["REQ-REV-002"])

    def test_uncoordinated_state_change_rejects_stale_commit(self):
        run = core.create_run(self.repo, "tester", "run", ["REQ-REV-002"])
        with self.assertRaises(core.Error):
            with run.edit() as data:
                data["run_id"] = "silently-change"
                changed = run.state()
                changed["external"] = True
                (run.path / "state.json").write_text(json.dumps(changed))
        self.assertTrue(run.state()["external"])

    def test_markdown_fields_are_literal(self):
        rendered = core.literal("# heading\n![image](https://bad) <script>x</script>")
        self.assertNotIn("\n", rendered)
        self.assertNotIn("<script>", rendered)
        self.assertNotIn("![image]", rendered)


if __name__ == "__main__":
    unittest.main()
