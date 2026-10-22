"""Independent fresh-world id answers (mechanics.md, A fresh world; numeric-profile.md, Initial
world ids) for two pinned cartridges: wear_sampler (scheduled NPC, slots) and harvest_sampler
(a room detail, slots). Python SHA-256 over the authored definitions; no kernel or compiler code.
Order: character, body, rooms, each room's details, NPCs, placed items, scheduled-NPC jobs, slot
holders. Checked by kernel/ts/test/fresh_ids.test.ts.
"""
import hashlib
import json
from pathlib import Path
import uuid

here = Path(__file__).parent


def labels(cartridge):
    out = ["character", "body"]
    rooms = sorted(cartridge["rooms"].items())
    out += [f"room/{room['key']}" for _, room in rooms]
    out += [f"detail/{room['key']}/{key}" for _, room in rooms for key in sorted(room.get("details") or {})]
    npcs = sorted((cartridge.get("npcs") or {}).items())
    out += [f"npc/{npc['key']}" for _, npc in npcs if not npc.get("spawn_template")]
    out += [f"item/{item['key']}" for _, item in sorted(cartridge["items"].items()) if item["location"]["in"] != "template"]
    out += [f"job/{npc['key']}" for _, npc in npcs if npc.get("daily_schedule")]
    out += [f"slot/{slot}" for slot in sorted({item["slot"] for item in cartridge["items"].values() if item.get("slot")})]
    return out


def answer(ordinal):
    domain = ["loka-id-v1", "0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f", "00000000-0000-0000-0000-000000000000", ordinal]
    digest = bytearray(hashlib.sha256(json.dumps(domain, separators=(",", ":")).encode()).digest()[:16])
    digest[6] = (digest[6] & 15) | 128
    digest[8] = (digest[8] & 63) | 128
    return str(uuid.UUID(bytes=bytes(digest)))


answers = {}
for fixture in ["cartridge_wear_hash.json", "harvest_sampler_hash.json"]:
    cartridge = json.loads((here / fixture).read_text())["value"]
    answers[fixture] = {label: answer(n) for n, label in enumerate(labels(cartridge))}
(here / "fresh_ids.json").write_text(json.dumps(answers, indent=2) + "\n")
