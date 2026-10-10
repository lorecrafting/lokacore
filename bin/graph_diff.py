#!/usr/bin/env python3
"""The System graph's node and edge changes between two docs/system-graph.gen.json files, as the
Markdown body of the PR comment ci.yml's graph-diff job posts (MARK finds it again to update it).
Usage: graph_diff.py BASE HEAD. A changed node is one whose entry differs other than in `line`."""
import json
import sys

MARK = "<!-- system-graph-diff -->"
LIMIT = 40  # entries listed per section; a PR comment holds at most 65,536 characters


def load(path):
    with open(path, encoding="utf-8") as f:
        g = json.load(f)
    nodes = {n["name"]: {k: v for k, v in n.items() if k != "line"} for n in g["nodes"]}
    edges = {(e["from"], e["to"], e["field"]) for e in g["edges"]}
    return nodes, edges


def section(title, items):
    items = sorted(items)
    if not items:
        return []
    more = [f"- and {len(items) - LIMIT} more"] if len(items) > LIMIT else []
    return [f"**{title} ({len(items)})**", *(f"- {i}" for i in items[:LIMIT]), *more, ""]


def body(base, head):
    (bn, be), (hn, he) = base, head
    keys = lambda n: sorted(k for k in bn[n].keys() | hn[n].keys() if bn[n].get(k) != hn[n].get(k))
    changed = [f"`{n}`: {', '.join(keys(n))}" for n in bn.keys() & hn.keys() if keys(n)]
    edge = lambda e: f"`{e[0]}` → `{e[1]}`" + (f" ({e[2]})" if e[2] else "")
    lines = [
        *section("Nodes added", (f"`{n}`" for n in hn.keys() - bn.keys())),
        *section("Nodes removed", (f"`{n}`" for n in bn.keys() - hn.keys())),
        *section("Nodes changed", changed),
        *section("Edges added", map(edge, he - be)),
        *section("Edges removed", map(edge, be - he)),
    ]
    return "\n".join([MARK, "### System graph vs base (`docs/system-graph.gen.json`)", "", *(lines or ["No node or edge changes."])])


if __name__ == "__main__":
    print(body(load(sys.argv[1]), load(sys.argv[2])))
