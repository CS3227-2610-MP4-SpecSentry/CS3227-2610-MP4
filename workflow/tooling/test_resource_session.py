import argparse
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("resource_session", Path(__file__).with_name("resource-session.py"))
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


class ResourceSessionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.previous = tool.ROOT
        tool.ROOT = Path(self.temp.name).resolve()
        self.addCleanup(setattr, tool, "ROOT", self.previous)
        self.args = dict(name="tester", session="session", agent="main", invocation="one", stage="implement",
                         model="selected", effort="low", settings_reason="selected by dispatcher", attempt=1)

    def args_for(self, **updates):
        return argparse.Namespace(**(self.args | updates))

    def begin(self):
        return tool.start(self.args_for())["id"]

    def end(self, identifier, **updates):
        return tool.finish(self.args_for(id=identifier, status="succeeded", outcome="validated",
                          usage=None, unavailable_reason="not exposed", **updates))

    def test_measures_time_even_when_tokens_unavailable(self):
        identifier = self.begin()
        self.assertFalse(tool.report(self.args_for(markdown=False))["ok"])
        self.end(identifier)
        report = tool.report(self.args_for(markdown=False))
        self.assertTrue(report["ok"])
        self.assertGreaterEqual(report["summed_interval_seconds"], 0)
        self.assertEqual(report["coverage"]["input_tokens"], 0)
        self.assertIsNone(report["records"][0]["usage"]["input_tokens"])

    def test_separate_invocations_and_finished_record_not_overwritten(self):
        first, second = self.begin(), self.begin()
        self.assertNotEqual(first, second)
        self.end(first)
        with self.assertRaises(ValueError):
            self.end(first)
        self.assertFalse(tool.report(self.args_for(markdown=False))["ok"])

    def test_valid_attributed_usage_and_selected_vs_observed(self):
        identifier = self.begin()
        usage = dict(record_id=identifier, scope="record", source="fixture", input_tokens=10,
                     output_tokens=2, cache_read_tokens=5, tool_calls=1, retries=0, observed_model="observed")
        path = tool.ROOT / "usage.json"
        path.write_text(json.dumps(usage))
        args = self.args_for(id=identifier, status="succeeded", outcome="checked", usage=str(path), unavailable_reason="not exposed")
        tool.finish(args)
        report = tool.report(self.args_for(markdown=False))
        self.assertEqual(report["measured_totals_only"]["input_tokens"], 10)
        self.assertEqual(report["records"][0]["observed_model"], "observed")
        self.assertEqual(report["records"][0]["selected_model"], "selected")

    def test_bad_attribution_and_counters_leave_interval_running(self):
        identifier = self.begin()
        path = tool.ROOT / "usage.json"
        base = dict(record_id=identifier, scope="record", source="fixture", input_tokens=10, output_tokens=2)
        for change in ({"record_id": "other"}, {"scope": "account"}, {"input_tokens": True},
                       {"output_tokens": -1}, {"cache_read_tokens": 11}):
            path.write_text(json.dumps(base | change))
            with self.subTest(change=change), self.assertRaises(ValueError):
                tool.finish(self.args_for(id=identifier, status="succeeded", outcome="checked", usage=str(path), unavailable_reason="missing"))
        self.assertFalse(tool.report(self.args_for(markdown=False))["ok"])

    def test_paths_and_empty_session(self):
        for value in ("../escape", "CON", "bad/name", "a."):
            with self.subTest(value=value), self.assertRaises(ValueError):
                tool.start(self.args_for(name=value))
        self.assertFalse(tool.report(self.args_for(markdown=False))["ok"])

    def test_lock_never_stolen(self):
        identifier = self.begin()
        lock = tool.paths(self.args_for()) / f"{identifier}.lock"
        lock.write_text("another writer")
        with self.assertRaises(FileExistsError):
            self.end(identifier)
        self.assertEqual(lock.read_text(), "another writer")


if __name__ == "__main__":
    unittest.main()
