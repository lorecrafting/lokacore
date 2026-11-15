#!/usr/bin/env python3
"""Refuse a push that puts unreviewed code on main (docs/PM.md:92).

The two-lane decision (docs/decisions/owner-decision-two-lane-ci-2026-10-09.md) makes a green run
on a *branch* head the merge gate, and ci.yml deliberately does not run on a push to main
(`branches-ignore: [main]`; "nightly on main and by hand"). So a code commit pushed straight to
main is never gated by anything: bin/prepush.sh covers sizes, prettier, regen, tsc, docs and a few
targeted red controls, but it runs no package test suite.

The owner and the PM may push to main directly for status-only commits -- the ROADMAP status line,
the Beads export, the decisions index, docs/HANDOFF.md -- and never for code. This says so at the
point of the push instead of after the fact.

  bin/main_guard.py <remote_sha> <local_sha>     (reads `git diff --name-only <remote> <local>`)
  bin/main_guard.py --files a b c                 (for a red control: the names to judge)

Exit 0 when every changed file is status-only or documentation; exit 1 with the offending files.
A new branch, or a remote sha we do not have, is not this guard's business (exit 0).
"""
import re
import subprocess
import sys

# Status-only: what docs/PM.md:91-92 names as the PM's own lane.
STATUS_ONLY = re.compile(r"^(\.beads/|docs/HANDOFF\.md$)")
# Documentation and records: a push to main may carry these (the PM writes them directly).
DOCS = re.compile(
    r"^(docs/.*\.md|docs/.*\.json|README\.md$|.*/README\.md$|\.github/.*\.md$|AGENTS\.md$|CLAUDE\.md$)"
)

# Everything else is code. An allowlist is used rather than a code regex so a new kind of file
# (a script, a fixture, a workflow) fails closed until someone says which lane it belongs in.


def verdict(files):
    """The files that are neither status-only nor documentation, in the order given."""
    return [f for f in files if f and not STATUS_ONLY.match(f) and not DOCS.match(f)]


def main(argv):
    if len(argv) >= 2 and argv[0] == "--files":
        bad = verdict(argv[1:])
    elif len(argv) == 2:
        remote, local = argv
        # The zero sha is a new branch: not this guard's business.
        if set(remote) == {"0"}:
            return 0
        try:
            out = subprocess.run(
                ["git", "diff", "--no-renames", "--name-only", remote, local],
                capture_output=True,
                text=True,
                check=True,
            ).stdout
        except subprocess.CalledProcessError:
            return 0  # an unknown remote sha: let the push proceed, prepush.sh still runs
        bad = verdict(out.splitlines())
    else:
        print("usage: bin/main_guard.py <remote_sha> <local_sha> | --files <name>...", file=sys.stderr)
        return 2
    if not bad:
        return 0
    print(
        "main_guard: this push puts code on main, which ci.yml never runs on (branches-ignore: [main]).\n"
        "Push it to a branch, open a PR and let the green run be the gate (docs/PM.md, two lanes).\n"
        "Status-only commits (ROADMAP status lines, the Beads export, the decisions index,\n"
        "docs/HANDOFF.md) and documentation are allowed.\n"
        "  code: " + " ".join(bad[:12]) + (f" (+{len(bad) - 12} more)" if len(bad) > 12 else ""),
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
