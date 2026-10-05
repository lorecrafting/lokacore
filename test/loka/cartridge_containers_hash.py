# Current controlled receptacle fixtures. Historical inputs remain byte-for-byte evidence.
# Literal holder lists are the oracle; Python stdlib supplies canonical bytes and SHA-256.
import hashlib
import json
from pathlib import Path

HOLDERS = {
    "cartridge_items_hash": ["satchel"],
    "cartridge_locks_hash": ["coffer", "purse", "sewing_box", "trunk"],
    "sampler_v006_hash": ["trunk"],
    "sampler_v007_hash": ["trunk"],
    "sampler_v008_hash": ["player_corpse", "rat_corpse", "trunk"],
    "sampler_v009_hash": ["player_corpse", "rat_corpse", "trunk"],
    "sampler_v010_hash": ["player_corpse", "rat_corpse", "storage_chest", "trunk"],
    "cartridge_sampler_hash": ["player_corpse", "rat_corpse", "storage_chest", "trunk"],
    "reward_storage_hash": ["player_corpse", "rat_corpse", "reward_chest", "trunk"],
}
for name, holders in HOLDERS.items():
    path = Path("protocol/fixtures") / (name + ".json")
    fixture = json.loads(path.read_text())
    value = json.loads(fixture["canonical"])
    for holder in holders:
        item = next(i for i in value["items"].values() if i["key"] == holder)
        item["container"] = True
    canonical = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    fixture.update(description="Current controlled receptacle derivative of " + name + "; literal holder list in test/loka/cartridge_containers_hash.py; historical input remains frozen.", value=value, canonical=canonical, sha256=hashlib.sha256(canonical.encode()).hexdigest())
    path.with_name("containers_" + path.name).write_text(json.dumps(fixture, indent=2, ensure_ascii=False) + "\n")
