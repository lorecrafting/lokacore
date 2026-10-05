"""Independent v018 UUIDv8 answers using Python's SHA-256 and authored definitions.

Enumeration follows numeric-profile.md initial/detail/slot order. Corpse template
items have no fresh instance; scheduled NPC jobs precede distinct slot holders.
No kernel or compiler implementation is imported.
"""
import hashlib
import json
from pathlib import Path
import uuid

cartridge = json.loads(Path(__file__).with_name("missing_child_v018_hash.json").read_text())["value"]
labels = ["character", "body"]
rooms = sorted(cartridge["rooms"].items())
labels += [f"room/{room['key']}" for _, room in rooms]
labels += [f"detail/{room['key']}/{key}" for _, room in rooms for key in sorted(room.get("details", {}))]
labels += [f"npc/{npc['key']}" for _, npc in sorted(cartridge["npcs"].items())]
labels += [f"item/{item['key']}" for _, item in sorted(cartridge["items"].items()) if item["location"]["in"] != "template"]
labels += [f"job/{npc['key']}" for _, npc in sorted(cartridge["npcs"].items()) if npc.get("daily_schedule")]
labels += [f"slot/{slot}" for slot in sorted({item["slot"] for item in cartridge["items"].values() if "slot" in item})]

answers = {}
for ordinal, label in enumerate(labels):
    domain = ["loka-id-v1", "0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f", "00000000-0000-0000-0000-000000000000", ordinal]
    digest = bytearray(hashlib.sha256(json.dumps(domain, separators=(",", ":")).encode()).digest()[:16])
    digest[6] = (digest[6] & 15) | 128
    digest[8] = (digest[8] & 63) | 128
    answers[label] = str(uuid.UUID(bytes=bytes(digest)))

Path(__file__).with_name("missing_child_v018_ids.json").write_text(json.dumps(answers, indent=2) + "\n")
print(f"Wrote {len(answers)} independent initial IDs.")
