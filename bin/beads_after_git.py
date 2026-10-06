#!/usr/bin/env python3
"""Import reviewed Beads JSONL after Git advances the integration checkout."""

import json
import shutil
import subprocess
from pathlib import Path


def output(*args):
    return subprocess.run(args, capture_output=True, text=True, check=True).stdout.strip()


def main():
    try:
        root = Path(output("git", "rev-parse", "--show-toplevel")).resolve()
        selected = output("git", "config", "--get", "loka.beads.integrationRoot")
        branch = output("git", "branch", "--show-current")
    except subprocess.CalledProcessError:
        return 0
    if not selected or Path(selected).resolve() != root or branch != "main":
        return 0
    if not shutil.which("br") or not (root / ".beads/issues.jsonl").is_file():
        return 0
    try:
        status = json.loads(output("br", "sync", "--status", "--json"))
        if status["dirty_count"] or status["db_newer"]:
            print("Beads has unexported local changes; inspect br sync --status before import.")
        elif status["jsonl_newer"]:
            subprocess.run(["br", "sync", "--import-only"], check=True)
    except (KeyError, ValueError, subprocess.CalledProcessError):
        print("Beads import needs attention; inspect br sync --status and import manually.")
    return 0  # A post-Git hook cannot undo the completed checkout or merge.


if __name__ == "__main__":
    raise SystemExit(main())
