#!/usr/bin/env python3
"""Resolve the known additive conflicts of the merge in progress in this repo (bin/pm_merge.sh):
- docs/system/mechanics.md: one conflict that ends the file and only adds text on both sides (two
  appended sections) keeps both, ours first, with the leading lines both sides share kept once;
  a duplicate `## ` heading afterwards refuses;
- kernel/ts/src/runtime/world.ts: one conflict whose sides are each one kernel_api line keeps the higher;
- a generated file or docs/reviews/README.md takes theirs, as does a review record whose sides differ
  only in whitespace (another review record is left); then every generator reruns.
Exit 0: all resolved and staged, not committed. Exit 1: prints the files it left; abort the merge.
Needs merge.conflictStyle=diff3 (the base section proves an append).
  python3 bin/merge_resolve.py"""
import os
import re
import subprocess
import sys

HUNK = re.compile(r"^<<<<<<< [^\n]*\n(.*?)^\|{7}[^\n]*\n(.*?)^=======\n(.*?)^>>>>>>> [^\n]*\n", re.M | re.S)
KERNEL_API = re.compile(r"\s*kernel_api: '(\d+)\.(\d+)',\n")
GENERATED = {
    "kernel/ts/src/contracts.gen.ts",
    "kernel/ts/test/subset.gen.ts",
    "docs/contracts.gen.md",
    "docs/residency.gen.json",
    "docs/system-graph.gen.json",
    "docs/checks.gen.json",
    "docs/toolbox.gen.json",
    "docs/features.gen.md",
}
GENERATORS = [
    ["mise", "exec", "--", "elixir", "bin/contracts.exs"],
    ["mise", "exec", "--", "elixir", "bin/features.exs"],
    ["sh", "bin/review_index.sh"],
]


def tail_union(text):
    hunks = list(HUNK.finditer(text))
    if len(hunks) != 1 or hunks[0].end() != len(text) or hunks[0][2]:
        return None
    h = hunks[0]
    ours, theirs = h[1].splitlines(True), h[3].splitlines(True)
    shared = len(os.path.commonprefix([ours, theirs]))  # a section both sides appended (a cherry-pick) stays once
    merged = text[: h.start()] + h[1].rstrip("\n") + "\n\n" + "".join(theirs[shared:]).lstrip("\n")
    heads = re.findall(r"^## .*$", merged, re.M)
    return merged if len(heads) == len(set(heads)) else None


def higher_kernel_api(text):
    hunks = list(HUNK.finditer(text))
    sides = [KERNEL_API.fullmatch(hunks[0][i]) for i in (1, 3)] if len(hunks) == 1 else [None]
    if None in sides:
        return None
    keep = max(sides, key=lambda m: (int(m[1]), int(m[2])))
    return text[: hunks[0].start()] + keep[0] + text[hunks[0].end() :]


RULES = {"docs/system/mechanics.md": tail_union, "kernel/ts/src/runtime/world.ts": higher_kernel_api}


def same_but_whitespace(f):
    try:
        return len({" ".join(git("show", f":{n}:{f}").split()) for n in (2, 3)}) == 1
    except subprocess.CalledProcessError:  # modify/delete: a side is missing
        return False


def git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


os.chdir(git("rev-parse", "--show-toplevel").strip())
conflicted = git("diff", "--name-only", "--diff-filter=U").split()
theirs, left = [], []
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
    elif f in GENERATED or f == "docs/reviews/README.md" or (f.startswith("docs/reviews/") and same_but_whitespace(f)):
        theirs.append(f)
    else:
        left.append(f)
if left:
    print("unresolved: " + " ".join(left))
    sys.exit(1)
if theirs:
    git("checkout", "--theirs", "--", *theirs)
for gen in GENERATORS:  # always: mechanics.md feeds contracts.exs, so a resolved source regenerates too
    subprocess.run(gen, check=True, stdout=subprocess.DEVNULL)
git("add", "-u")
print("resolved: " + " ".join(conflicted))
