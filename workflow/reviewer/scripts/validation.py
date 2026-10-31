"""Operation-local read view; never reuse validation across mutations or commands."""
import contextlib

import core


class View:
    def __init__(self, run):
        self.repo, self.path = run.repo, run.path
        self.data = run.state()
        self.scopes = {}
        self.files = {}
        self.checks = {}

    def state(self):
        return self.data

    def file_hash(self, path):
        import evidence
        # Recheck artifact containment on every use, even when its hash is cached.
        path = core.repo_file(self.repo, path)
        if path not in self.files:
            self.files[path] = evidence._file_hash(path)
        return self.files[path]

    def snapshot(self, paths, base):
        import evidence
        key = (tuple(sorted(set(paths))), base)
        if key not in self.scopes:
            self.scopes[key] = evidence._snapshot(self, paths, base)
        return self.scopes[key]

    def ensure_current(self, run):
        import evidence
        # Full content/path/Git checks at the return boundary detect edits, new
        # untracked files, deletions, redirections and HEAD/index/base changes.
        # Stat-only freshness could miss same-size edits with restored mtimes.
        for (paths, base), before in self.scopes.items():
            if evidence._snapshot(self, paths, base) != before:
                raise core.Error("Selected source changed during validation; retry after writers settle")
        for path, before in self.files.items():
            if evidence._file_hash(core.repo_file(self.repo, path)) != before:
                raise core.Error("Evidence artifact changed during validation; retry")
        if run.state() != self.data:
            raise core.Error("Run state changed during validation; retry after its writer finishes")


@contextlib.contextmanager
def operation(run):
    """One stable read operation, shared by nested validators and report views."""
    if isinstance(run, View):
        yield run
        return
    view = View(run)
    yield view
    view.ensure_current(run)
