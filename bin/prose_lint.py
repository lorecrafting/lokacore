#!/usr/bin/env python3
"""Report-only prose lint over one cartridge's text.json and cartridge.json `alternates` (balance N6 text health).
Exit 0 whatever it finds; exit 2 only on bad input (missing or malformed file, alternate key not in text.json).
Sections: shared openers within a W7 variant group, sentence length per key kind, keys with one alternate,
Flesch-Kincaid grade. Band-phrase coverage is skipped: N6 names it but defines no bands.
  python3 bin/prose_lint.py cartridges/raid_sampler"""
import json
import re
import statistics
import sys
from collections import defaultdict


def plain(s):  # [[label|target]] and [label] link markup read as their label
    return re.sub(r"\[([^\]|]*)(?:\|[^\]]*)?\]\]?", r"\1", s).replace("[", "")


def sentences(s):
    return [x for x in re.split(r"[.!?]+\s*", plain(s)) if re.search(r"\w", x)]


def words(s):
    return re.findall(r"[A-Za-z']+", s)


def syllables(w):  # ponytail: vowel-group heuristic, +-10% off; fine for a trend, not a score
    return max(1, len(re.findall(r"[aeiouy]+", w.lower())) - (w.lower().endswith("e") and not w.lower().endswith("le")))


def bad(msg):
    print(msg, file=sys.stderr)
    sys.exit(2)


def load(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError) as e:
        bad(f"prose_lint: {path}: {e}")


def main(argv):
    if len(argv) != 2:
        bad(__doc__)
    d = argv[1].rstrip("/")
    text = load(f"{d}/text.json")
    alts = load(f"{d}/cartridge.json").get("alternates", {})
    for k, v in alts.items():
        for x in [k, *v]:
            if x not in text:
                bad(f"prose_lint: {d}: alternate key {x} is not in text.json")
    print(f"cartridge: {d} ({len(text)} keys, {len(alts)} with alternates)")
    for k, v in sorted(alts.items()):
        first = defaultdict(list)
        for x in [k, *v]:
            first[(words(plain(text[x])) or [""])[0].lower()].append(x)
        for w, ks in sorted(first.items()):
            if len(ks) > 1:
                print(f'shared opener "{w}": {", ".join(ks)}')
        if len(v) == 1:
            print(f"one alternate: {k}")
    kinds = defaultdict(list)
    for k, v in text.items():
        kinds[k.split(".")[0]] += [len(words(s)) for s in sentences(v)]
    for kind, n in sorted(kinds.items()):
        sd = statistics.pstdev(n) if n else 0
        print(f"sentence words {kind}: n={len(n)} mean={statistics.fmean(n) if n else 0:.1f} sd={sd:.1f}")
    ss = [s for v in text.values() for s in sentences(v)]
    ws = [w for s in ss for w in words(s)]
    if ss and ws:
        grade = 0.39 * len(ws) / len(ss) + 11.8 * sum(map(syllables, ws)) / len(ws) - 15.59
        print(f"reading grade (Flesch-Kincaid): {grade:.1f}")


main(sys.argv)
