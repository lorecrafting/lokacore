#!/usr/bin/env python3
"""Check that the Git-tracked Beads export is portable and complete."""

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
    staged = sys.argv[1:] == ["--staged"]
    complete = staged or not sys.argv[1:] or sys.argv[1:2] == ["--complete"]
    if staged:
        data = subprocess.run(
            ["git", "show", ":.beads/issues.jsonl"], check=True, capture_output=True, text=True
        ).stdout
    else:
        args = sys.argv[2:] if sys.argv[1:2] == ["--complete"] else sys.argv[1:]
        path = Path(args[0]) if args else Path(".beads/issues.jsonl")
        if not path.exists():
            return 0
        data = path.read_text()

    issues = []
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
        issues.append(issue)
    if complete:
        plan = Path("docs/MISSING-CHILD-PLAN.md").read_text()
        expected = re.findall(r"^\| \*\*([A-E]\d+) ", plan, re.MULTILINE)
        actual = [re.match(r"^([A-E]\d+) — ", issue.get("title", "")) for issue in issues]
        codes = [match.group(1) for match in actual if match]
        ids = {issue.get("id") for issue in issues}
        if len(codes) != len(issues) or sorted(codes) != sorted(expected) or len(ids) != len(issues):
            print("Beads export does not contain each Chapter 1 slice exactly once", file=sys.stderr)
            return 1
        if any("-wisp-" in issue_id for issue_id in ids if isinstance(issue_id, str)):
            print("Beads export uses a reserved ephemeral issue ID", file=sys.stderr)
            return 1
        if any(
            dependency.get("depends_on_id") not in ids
            for issue in issues
            for dependency in issue.get("dependencies", [])
        ):
            print("Beads export has a dependency on a missing issue", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
