#!/usr/bin/env python3
"""Resolve the known additive conflicts of the merge in progress in this repo (bin/pm_merge.sh):
- docs/system/mechanics.md: one conflict that ends the file (two appended sections) keeps both, ours first;
- kernel/ts/src/runtime/world.ts: one conflict whose sides are each one kernel_api line keeps the higher;
- a generated file or a docs/reviews/ file takes theirs, then its generator reruns.
Exit 0: all resolved and staged, not committed. Exit 1: prints the files it left; abort the merge.
Needs merge.conflictStyle=merge (no diff3 base section).
  python3 bin/merge_resolve.py"""
import os
import re
import subprocess
import sys

HUNK = re.compile(r"^<<<<<<< [^\n]*\n(.*?)^=======\n(.*?)^>>>>>>> [^\n]*\n", re.M | re.S)
KERNEL_API = re.compile(r"\s*kernel_api: '(\d+)\.(\d+)',\n")
CONTRACTS = ["mise", "exec", "--", "elixir", "bin/contracts.exs"]
GENERATED = {
    f: CONTRACTS
    for f in [
        "kernel/ts/src/contracts.gen.ts",
        "kernel/ts/test/subset.gen.ts",
        "docs/contracts.gen.md",
        "docs/residency.gen.json",
        "docs/system-graph.gen.json",
        "docs/checks.gen.json",
        "docs/toolbox.gen.json",
    ]
}
GENERATED["docs/features.gen.md"] = ["mise", "exec", "--", "elixir", "bin/features.exs"]
REVIEW_INDEX = ["sh", "bin/review_index.sh"]


def tail_union(text):
    hunks = list(HUNK.finditer(text))
    if len(hunks) != 1 or hunks[0].end() != len(text):
        return None
    h = hunks[0]
    return text[: h.start()] + h[1].rstrip("\n") + "\n\n" + h[2].lstrip("\n")


def higher_kernel_api(text):
    hunks = list(HUNK.finditer(text))
    sides = [KERNEL_API.fullmatch(s) for s in hunks[0].groups()] if len(hunks) == 1 else [None]
    if None in sides:
        return None
    keep = max(sides, key=lambda m: (int(m[1]), int(m[2])))
    return text[: hunks[0].start()] + keep[0] + text[hunks[0].end() :]


RULES = {"docs/system/mechanics.md": tail_union, "kernel/ts/src/runtime/world.ts": higher_kernel_api}


def git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


os.chdir(git("rev-parse", "--show-toplevel").strip())
conflicted = git("diff", "--name-only", "--diff-filter=U").split()
theirs, generators, left = [], [], []
for f in conflicted:
    if f in RULES:
        with open(f) as fh:
            merged = RULES[f](fh.read())
        if merged is None:
            left.append(f)
            continue
        with open(f, "w") as fh:
            fh.write(merged)
        git("add", f)
        continue
    gen = REVIEW_INDEX if f.startswith("docs/reviews/") else GENERATED.get(f)
    if gen is None:
        left.append(f)
        continue
    theirs.append(f)
    if gen not in generators:
        generators.append(gen)
if left:
    print("unresolved: " + " ".join(left))
    sys.exit(1)
if theirs:
    git("checkout", "--theirs", "--", *theirs)
    for gen in generators:  # after the sources above, so each regenerates from the merged tree
        subprocess.run(gen, check=True, stdout=subprocess.DEVNULL)
    git("add", "-u")
print("resolved: " + " ".join(conflicted))
