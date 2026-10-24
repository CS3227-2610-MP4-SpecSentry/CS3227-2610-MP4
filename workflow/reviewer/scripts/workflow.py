#!/usr/bin/env python3
"""CLI for explicitly recorded Reviewer workflow evidence."""
import argparse
from pathlib import Path
import sys

from core import Error, REPO
import recording


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--repo", type=Path, default=REPO, help="Repository root (default: this checkout)")
    result.add_argument("--run", help="Existing logs/<prompter>/reviewer/<run-id>; precedes subcommand")
    commands = result.add_subparsers(dest="command", required=True)
    recording.register(commands)
    import evidence
    import checks
    evidence.register(commands)
    checks.register(commands)
    return result


def main(argv=None):
    try:
        args = parser().parse_args(argv)
        return args.func(args) or 0
    except (Error, OSError) as exc:
        # OSError may contain sensitive paths; persist no raw exception context.
        message = str(exc) if isinstance(exc, Error) else "Filesystem/process operation failed"
        print(f"error: {message}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
