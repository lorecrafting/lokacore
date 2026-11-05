#!/usr/bin/env python3
"""Moves a flat cartridge into area folders (docs/rnd/cartridge-area-layout-design-2026-11-04.md §9).
Each room goes to its area in ROOMS_JSON (room -> area). Any other definition goes to the one area it
touches: the rooms it names (an NPC: only its home room, §3.6) and the definitions it names or that
name it; two areas or none leave it at the root. Moves by `git mv` (bytes unchanged), compiles again
and exits 1, printing the first differing definition, unless the content_hash is unchanged.
Usage: bin/area_split.py CARTRIDGE ROOMS_JSON (run from the repo root on an unsplit tree).
toolbox_showcase: bin/area_split_toolbox_showcase.json."""
import json
import os
import subprocess
import sys
import tempfile

ROOT = "~root"
DIRS = {"status": "statuses", "replenish": "replenish", "scripted_action": "actions"}
SHARED = {"fact", "attribute", "resource", "story_point"}  # defined in root files, never moved


def compile_cart(cart):
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "a.json")
        r = subprocess.run(["mix", "loka.compile", cart, out], capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit(f"area_split: compile failed\n{r.stdout}{r.stderr}")
        with open(out, encoding="utf-8") as f:
            return json.load(f)


def refs(value, found):
    if isinstance(value, dict):
        if {"cartridge_id", "kind", "key"} <= value.keys():
            found.add((value["kind"], value["key"]))
        for v in value.values():
            refs(v, found)
    elif isinstance(value, list):
        for v in value:
            refs(v, found)
    return found


def first_difference(before, after):
    for section in sorted(before.keys() | after.keys()):
        b, a = before.get(section), after.get(section)
        if isinstance(b, dict) and isinstance(a, dict):
            for key in sorted(b.keys() | a.keys()):
                if b.get(key) != a.get(key):
                    return key
        if b != a:
            return section
    return "no definition (the hash differs elsewhere)"


def main(cart, rooms_json):
    with open(rooms_json, encoding="utf-8") as f:
        room_area = json.load(f)
    on_disk = {f[:-5] for f in os.listdir(os.path.join(cart, "rooms")) if f.endswith(".json")}
    if on_disk != room_area.keys():
        sys.exit(f"area_split: {rooms_json} is not the room set: {sorted(on_disk ^ room_area.keys())}")

    before = compile_cart(cart)
    defs = {}  # node (dir, key) => its refs; shared kinds are the node ROOT and never move
    by_key = {}  # (kind, key) => node
    homes = {}  # npc node => home room key
    for section, ds in before["cartridge"].items():
        if not isinstance(ds, dict) or not all(":" in k for k in ds):
            continue  # a whole-section root file; the root may name any area
        for full, d in ds.items():
            kind, key = full.split(":", 1)[1].split("/")
            node = ROOT if kind in SHARED else (DIRS.get(section, DIRS.get(kind, kind + "s")), key)
            by_key.setdefault((kind, key), node)
            if node != ROOT:
                defs[node] = refs(d, set())
                if kind == "npc":  # its home room decides its area; its schedule may walk anywhere
                    homes[node] = d["room"]["key"]

    # An abstract `extends` parent is in no section: by_key[r] is then a KeyError before any move.
    area = {("rooms", r): a for r, a in room_area.items()}
    area |= {n: room_area[r] for n, r in homes.items()}
    links = {n: set() for n in defs}  # the definitions each one names or is named by
    for n, rs in defs.items():
        for m in {by_key[r] for r in rs} - {ROOT}:
            if n not in homes or m[0] != "rooms":  # an NPC's other rooms are walks, not its area
                links[n].add(m)
                links[m].add(n)

    def touched(n):
        return {area[m] for m in links[n] if m in area}

    # Place in rounds outward from the rooms and NPCs. A placed definition never moves, and one is
    # placed only when everything placed around it is in one area, so every area file names only
    # its own area, a room or the root. Two areas around it, or none: it stays at the root.
    while True:
        ready = [n for n in sorted(links) if n not in area and len(touched(n)) == 1]
        for n in ready:
            if len(touched(n)) == 1:  # recheck: an earlier one in this round may have added an area
                area[n] = touched(n).pop()
        if not ready:
            break

    moved = 0
    for (d, key), a in sorted(area.items()):
        for f in sorted(os.listdir(os.path.join(cart, d))):
            if f.split(".")[0] == key:
                os.makedirs(os.path.join(cart, "areas", a, d), exist_ok=True)
                src, dst = os.path.join(cart, d, f), os.path.join(cart, "areas", a, d, f)
                subprocess.run(["git", "mv", src, dst], check=True)
                moved += 1
    for r, a in room_area.items():
        assert os.path.exists(os.path.join(cart, "areas", a, "rooms", r + ".json")), r

    after = compile_cart(cart)
    want, got = before["content_hash"], after["content_hash"]
    print(f"area_split: {moved} files moved; content_hash {got}; before {want}")
    if got != want:
        sys.exit(f"area_split: first differing definition {first_difference(before['cartridge'], after['cartridge'])}")


if __name__ == "__main__":
    main(*sys.argv[1:])
