#!/usr/bin/env python3
"""Refuse machine-local paths in the Git-tracked Beads export."""

import json
import re
import subprocess
import sys
from pathlib import Path


LOCAL_PATH = re.compile(r"/Users/|/home/|/private/|/tmp/|/var/folders/|~/|[A-Za-z]:[\\/]")


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from strings(child)


def main():
    if sys.argv[1:] == ["--staged"]:
        data = subprocess.run(
            ["git", "show", ":.beads/issues.jsonl"], check=True, capture_output=True, text=True
        ).stdout
    else:
        path = Path(sys.argv[1]) if len(sys.argv) == 2 else Path(".beads/issues.jsonl")
        if not path.exists():
            return 0
        data = path.read_text()

    for number, line in enumerate(data.splitlines(), 1):
        try:
            issue = json.loads(line)
        except json.JSONDecodeError:
            print(f"Beads export row {number} is invalid JSON", file=sys.stderr)
            return 1
        if not isinstance(issue, dict) or issue.get("source_repo_path") or any(
            LOCAL_PATH.search(value) for value in strings(issue)
        ):
            print(f"Beads export row {number} contains a local path", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
