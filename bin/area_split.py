#!/usr/bin/env python3
"""Moves cartridges/toolbox_showcase into area folders (docs/rnd/cartridge-area-layout-design-2026-11-04.md
§9): each room goes to its district in ROOMS; any other definition goes to the one area every file
naming it (and every room it names) is in, else stays at the root. Moves by `git mv` (bytes
unchanged), then compiles and exits 1 unless the content_hash equals the fixture's sha256.
Usage: bin/area_split.py CARTRIDGE FIXTURE (run from the repo root on an unsplit tree)."""
import json
import os
import subprocess
import sys
import tempfile

ROOMS = {
    "hub": "crossroads_inn",
    "fell_road": "fell_gate fell_top shepherd_hut still_room the_fold smithy woodstore",
    "tidewater": "shore_steps cliff_path cliff_top smugglers_stair sea_cave tide_pools wayside_shrine",
    "low_wardle": "village_green warden_gate tollhouse mill church moot_hall hall_closet",
    "combat": "drill_yard boar_run gate_yard goblin_pit tilt_yard",
    "traps": "sapper_stair plate_passage chief_den lever_hall lever_vault dial_vault sapper_cellar",
    "homestead": "holding_lane carpenter_shop farm_yard farm_kitchen glade pond holding_croft larder "
    "midden pond_deep timber_yard woodpile stall",
    "economy_law": "undercroft market_row cell drain counting_house pawn_alley strongroom vault_yard "
    "forge_stall forge_back storeroom",
    "magic": "reading_room crypt_stair crypt loft loft_attic golem_yard",
}
ROOT = "~root"  # sorts after every area name: a definition two areas name stays shared
DIRS = {"status": "statuses", "replenish": "replenish", "scripted_action": "actions"}
SHARED = {"fact", "attribute", "resource", "story_point"}  # defined in root files, never moved


def compile_hash(cart):
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


def main(cart, fixture):
    room_area = {r: a for a, rs in ROOMS.items() for r in rs.split()}
    on_disk = {f[:-5] for f in os.listdir(os.path.join(cart, "rooms")) if f.endswith(".json")}
    if on_disk != room_area.keys():
        sys.exit(f"area_split: ROOMS is not the room set: {sorted(on_disk ^ room_area.keys())}")

    art = compile_hash(cart)["cartridge"]
    by_key = {}  # (kind, key) => source dir
    edges = []  # (referrer node, named node); a node is (dir, key) or ROOT
    for section, defs in art.items():
        if not isinstance(defs, dict) or not all(":" in k for k in defs):
            edges += [(ROOT, r) for r in refs(defs, set())]  # a whole-section root file
            continue
        for full, d in defs.items():
            kind, key = full.split(":", 1)[1].split("/")
            node = ROOT if kind in SHARED else (DIRS.get(section, DIRS.get(kind, kind + "s")), key)
            by_key.setdefault((kind, key), node)
            edges += [(node, r) for r in refs(d, set())]
    # A ref with no definition is a KeyError before any move. An abstract `extends` parent is in no
    # section, so it stays at the root, which any child may name.
    edges = [(a, by_key[b]) for a, b in edges]
    area = {("rooms", r): a for r, a in room_area.items()}
    for _ in range(len(by_key) + 2):  # monotone: None < one area < ROOT, so each pass only widens
        touched = {}
        for a, b in edges:
            if b != ROOT and b[0] != "rooms":  # b is named from a's area
                touched.setdefault(b, set()).add(ROOT if a == ROOT else area.get(a))
            elif a != ROOT and a[0] != "rooms" and b != ROOT:  # a names a room: a is in its area
                touched.setdefault(a, set()).add(area[b])
        new = dict(area)
        for n, s in touched.items():
            s.discard(None)
            new[n] = s.pop() if len(s) == 1 else (ROOT if s else None)
        if new == area:
            break
        area = new
    else:
        sys.exit("area_split: placement did not settle")

    moved = 0
    for (d, key), a in sorted(area.items(), key=lambda x: x[0]):
        if a in (None, ROOT):
            continue
        for f in sorted(os.listdir(os.path.join(cart, d))):
            if f.split(".")[0] == key:
                os.makedirs(os.path.join(cart, "areas", a, d), exist_ok=True)
                src, dst = os.path.join(cart, d, f), os.path.join(cart, "areas", a, d, f)
                subprocess.run(["git", "mv", src, dst], check=True)
                moved += 1
    for r, a in room_area.items():
        assert os.path.exists(os.path.join(cart, "areas", a, "rooms", r + ".json")), r

    with open(fixture, encoding="utf-8") as f:
        want = json.load(f)["sha256"]
    got = compile_hash(cart)["content_hash"]
    print(f"area_split: {moved} files moved; content_hash {got}; fixture {want}")
    sys.exit(0 if got == want else 1)


if __name__ == "__main__":
    main(*sys.argv[1:])
