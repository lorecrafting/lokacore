#!/usr/bin/env python3
"""Report Beads/PR drift from `br list --json` and "N STATE" lines; no br/gh calls."""

import json
import re
import sys


def pr_number(issue):
    match = re.search(r"/pull/(\d+)", issue.get("external_ref") or "")
    return match and match.group(1)


def drift(issues, states):
    lines = []
    referenced = set()
    for issue in issues:
        number = pr_number(issue)
        if not number:
            continue
        referenced.add(number)
        state = states.get(number)
        if issue["status"] == "in_progress" and state in ("MERGED", "CLOSED"):
            lines.append(f"drift: {issue['id']} is in_progress but PR #{number} is {state}")
        if issue["status"] == "closed" and state == "OPEN":
            lines.append(f"drift: {issue['id']} is closed but PR #{number} is still OPEN")
    for number, state in states.items():
        if state == "OPEN" and number not in referenced:
            lines.append(f"drift: open PR #{number} has no Beads issue")
    return sorted(lines)


def main(args):
    """`ISSUES STATES` prints drift lines; `--in-progress-prs ISSUES` prints PR numbers to look up."""
    with open(args[-1] if args[0] == "--in-progress-prs" else args[0]) as f:
        issues = json.load(f)["issues"]
    if args[0] == "--in-progress-prs":
        print(" ".join(sorted({n for i in issues if i["status"] == "in_progress" and (n := pr_number(i))})))
        return 0
    with open(args[1]) as f:
        states = dict(line.split() for line in f if line.strip())
    for line in drift(issues, states):
        print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
