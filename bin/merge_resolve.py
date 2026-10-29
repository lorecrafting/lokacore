#!/usr/bin/env python3
"""Resolve the known additive conflicts of the merge in progress in this repo (bin/pm_merge.sh):
- docs/system/mechanics.md: one conflict where both sides only add whole `## `/`### ` sections at one
  spot keeps both, ours first, with the leading lines both sides share kept once; a shared part that
  ends inside a section, or a duplicate heading afterwards, refuses;
- docs/MECHANICS-TOOLBOX.md: the same for table rows (a row id on both sides refuses);
- kernel/ts/src/runtime/world.ts: one conflict whose sides are each one kernel_api line keeps the higher;
- a generated file (GENERATED, GENERATED_GLOBS) or docs/reviews/README.md takes theirs, as does a review record whose sides differ
  only in whitespace (another review record is left); then every generator reruns (a GENERATED_GLOBS
  family needs `sh bin/regen.sh` after the merge).
Exit 0: all resolved and staged, not committed. Exit 1: prints the files it left; abort the merge.
Needs merge.conflictStyle=diff3 (the base section proves an append).
  python3 bin/merge_resolve.py"""
import fnmatch
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
    "test/loka/lint_baseline.txt",
    "protocol/fixtures/toolbox_showcase_hash.json",  # the one hash fixture bin/regen.sh rebuilds; the others are kept by hand
}
GENERATED_GLOBS = [  # bin/regen.sh rebuilds these; `*` crosses `/`
    "cartridges/*/transcripts/*.jsonl",
    "mobile/app/stories/live/*.sql",
    "schemas/source/*.json",
]
GENERATORS = [
    ["mise", "exec", "--", "elixir", "bin/contracts.exs"],
    ["mise", "exec", "--", "elixir", "bin/features.exs"],
    ["sh", "bin/review_index.sh"],
]


def both_insert(text):
    """The one conflict where both sides only insert at one spot: (hunk, ours lines, theirs lines after the part they share)."""
    hunks = list(HUNK.finditer(text))
    if len(hunks) != 1 or hunks[0][2]:
        return None
    h = hunks[0]
    ours, theirs = h[1].splitlines(True), h[3].splitlines(True)
    return h, ours, theirs[len(os.path.commonprefix([ours, theirs])) :]  # a part both sides added (a cherry-pick) stays once


def section_union(text):
    got = both_insert(text)
    if not got:
        return None
    h, ours, theirs = got
    rest = "".join(theirs).strip("\n")
    after = text[h.end() :].lstrip("\n")
    # each side adds whole sections: the shared part ends at a section edge and a heading (or the end) follows
    if (rest and not rest.startswith(("## ", "### "))) or (after and not after.startswith("#")):
        return None
    if len(set(re.findall(r"^(#{2,3}) ", "".join(ours + theirs), re.M))) > 1:  # mixed levels: a ### section could land under the wrong ## parent
        return None
    merged = text[: h.start()] + h[1].rstrip("\n") + ("\n\n" + rest if rest else "") + ("\n\n" + after if after else "\n")
    heads = re.findall(r"^#{2,3} .*$", merged, re.M)
    return merged if len(heads) == len(set(heads)) else None


def rows_union(text):
    got = both_insert(text)
    if not got:
        return None
    h, ours, theirs = got
    if not all(l.startswith("| ") for l in ours + theirs):  # table rows only
        return None
    ids = [{l.split("|")[1].strip() for l in side} for side in (ours, theirs)]
    if ids[0] & ids[1]:  # no row id on both sides
        return None
    return text[: h.start()] + h[1] + "".join(theirs) + text[h.end() :]


def higher_kernel_api(text):
    hunks = list(HUNK.finditer(text))
    sides = [KERNEL_API.fullmatch(hunks[0][i]) for i in (1, 3)] if len(hunks) == 1 else [None]
    if None in sides:
        return None
    keep = max(sides, key=lambda m: (int(m[1]), int(m[2])))
    return text[: hunks[0].start()] + keep[0] + text[hunks[0].end() :]


RULES = {
    "docs/system/mechanics.md": section_union,
    "docs/MECHANICS-TOOLBOX.md": rows_union,
    "kernel/ts/src/runtime/world.ts": higher_kernel_api,
}


def same_but_whitespace(f):
    try:
        return len({"\n".join(" ".join(l.split()) for l in git("show", f":{n}:{f}").splitlines()) for n in (2, 3)}) == 1  # line breaks count
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
            try:
                merged = RULES[f](fh.read())
            except (subprocess.CalledProcessError, ValueError) as e:  # a missing stage, or a side that is not the expected JSON text: modify/delete, add/add
                print(f"{f}: {e}", file=sys.stderr)
                merged = None
        if merged is None:
            left.append(f)
            continue
        with open(f, "w") as fh:
            fh.write(merged)
        git("add", f)
    elif f in GENERATED or any(fnmatch.fnmatchcase(f, g) for g in GENERATED_GLOBS) or f == "docs/reviews/README.md" or (f.startswith("docs/reviews/") and same_but_whitespace(f)):
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
