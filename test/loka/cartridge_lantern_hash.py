# Writes protocol/fixtures/cartridge_lantern_hash.json: the compiled lantern_proof cartridge written
# out by hand (every short reference expanded here, not by a kernel), its canonical bytes by
# json.dumps and its sha256 by hashlib. Run from the repository root before compiling;
# test/loka/content_lantern_test.exs then compares the compiler to it. Only the text catalog is
# read from the source (copied as is).
import json, hashlib
ID, V = "lantern_proof", "0.0.1"
def ref(kind, key): return {"cartridge_id": ID, "cartridge_version": V, "kind": kind, "key": key}
def k(kind, key): return f"{ID}@{V}:{kind}/{key}"
P = lambda root: {"policy_version": 1, "root": root}
caps = {"movement":1,"description_variant":1,"containment":1,"barrier":1,"policy":1,"behavior":1,
        "calendar":1,"fact":1,"quest":1,"dialogue":1,"resource":1,"schedule":1}
def room(key, exits, variants=None):
    r = {"title": f"room.{key}.title", "description": f"room.{key}.description", "exits": exits, "key": key}
    if variants: r["variants"] = variants
    return r
gate = lambda to: {"to": ref("room", to), "barrier": ref("barrier", "old_gate")}
plan = lambda v: {"when": P({"op":"fact_compare","fact":ref("fact","search_plan"),"equals":v}), "description": f"room.landing.{v}"}
assign = lambda v: [{"op":"fact.assign","fact":ref("fact","search_plan"),"value":v}]
value = {
 "format": "loka-cartridge-v2",
 "manifest": {"api_version": "loka/v3", "id": ID, "version": V, "title": "The Ferryman's Lantern",
   "requires": {"kernel_api": {"at_least": "1.0", "below": "2.0"}, "content_schema": 1, "rule_ir": 1,
     "capabilities": caps, "client_features": []},
   "supported_profiles": ["offline_private"]},
 "lock": {"format": "loka-capability-lock-v1", "capabilities": caps},
 "facts": {k("fact","search_plan"): {"version": 1,
   "value_type": {"type": "enum", "values": ["undecided","player_led","party_led"], "default": "undecided"},
   "scopes": ["player"],
   "meaning": "Whether the player carries the lantern along the bank or leaves it with Bram's search party (pre-release-proof.md).",
   "key": "search_plan"}},
 "policies": {}, "actions": {},
 "rooms": {
   k("room","landing"): room("landing", {"north": {"to": ref("room","green")}, "west": gate("shelter")},
                             [plan("player_led"), plan("party_led"),
                              {"when": P({"op":"time_window","from":6,"to":19}), "description": "room.landing.day"}]),
   k("room","green"): room("green", {"south": {"to": ref("room","landing")}, "east": {"to": ref("room","reed_bank")}}),
   k("room","reed_bank"): room("reed_bank", {"west": {"to": ref("room","green")}, "east": {"to": ref("room","shelter")}}),
   k("room","shelter"): room("shelter", {"west": {"to": ref("room","reed_bank")}, "east": gate("landing")})},
 "barriers": {k("barrier","old_gate"): {"keywords": ["gate","old_gate"], "short": "barrier.old_gate.short",
   "initial": "locked", "key_item": ref("item","lantern"), "key": "old_gate"}},
 "npcs": {k("npc","bram"): {"keywords": ["bram","ferryman"], "short": "npc.bram.short", "room_line": "npc.bram.room",
   "description": "npc.bram.description", "room": ref("room","landing"),
   "daily_schedule": {"6": ref("room","landing"), "19": ref("room","green")}, "key": "bram"}},
 "items": {k("item","lantern"): {"keywords": ["lantern","brass_lantern"], "short": "item.lantern.short",
   "room_line": "item.lantern.room", "description": "item.lantern.description",
   "location": {"in": "room", "room": ref("room","shelter")}, "key": "lantern"}},
 "quests": {k("quest","lantern"): {"title": "quest.lantern.title",
   "offer": {"label": "quest.lantern.accept", "policy": P({"op":"all","items":[]})},
   "objective": {"evidence": "current_state", "policy": P({"op":"has_item","item":ref("item","lantern")})},
   "key": "lantern"}},
 "dialogues": {k("dialogue","bram"): {"npc": ref("npc","bram"),
   "policy": P({"op":"quest_state","quest":ref("quest","lantern"),"state":"active"}),
   "prompt": "dialogue.bram.prompt",
   "roles": {"bram": {"role":"npc","npc":ref("npc","bram")}, "lantern": {"role":"item","item":ref("item","lantern")}},
   "quest": ref("quest","lantern"),
   "choices": {"carry": {"label":"dialogue.bram.carry","narration":"proof.carry","sequence":assign("player_led")},
               "leave": {"label":"dialogue.bram.leave","narration":"proof.leave","sequence":assign("party_led"),
                         "hand_over": {"item":"lantern","to":"bram"}}},
   "key": "bram"}},
 "story_points": {k("story_point","proof_terminal"): {"key": "proof_terminal", "outcomes": {
   "carry": {"dialogue": ref("dialogue","bram"), "choice": "carry"},
   "leave": {"dialogue": ref("dialogue","bram"), "choice": "leave"}}}},
 "resources": {k("resource","hp"): {"minimum":0,"maximum":20,"start":20,"gain":5,"key":"hp"},
               k("resource","ma"): {"minimum":0,"maximum":100,"start":100,"gain":4,"key":"ma"},
               k("resource","mv"): {"minimum":0,"maximum":82,"start":82,"gain":18,"key":"mv"}},
 "entry": ref("room","landing"),
 "text": json.load(open("cartridges/lantern_proof/text.json")),
 "calendar": {"start": 21600},
}
c = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
assert c.isascii()
sha = hashlib.sha256(c.encode()).hexdigest()
DESC = ("Known answer for the loka-cartridge-v2 content hash of cartridges/lantern_proof, the pre-release proof cartridge "
 "The Ferryman's Lantern (pre-release-proof.md, Concrete proof; R6P P3; 05 §11; CartridgeArtifact.content_hash): its own ID "
 "and save lineage; four rooms (landing north to green, green east to reed bank, reed bank east to shelter, each reciprocal) and "
 "the blocked west exit, the barrier old_gate between landing (west) and shelter (east), locked, key_item the lantern "
 "(room.schema.json BarrierDefinition; PM ruling 1, docs/decisions/pm-decision-lantern-proof-content-2026-10-01.md); landing's "
 "description variants on search_plan (player_led, party_led), then Bram's opening while he is there (time_window 6 to 19), else neutral prose; calendar@1 starting at 06:00 and Bram's daily schedule "
 "(landing from hour 6, green from hour 19); the lantern at the shelter; the quest lantern (offered, current_state has_item "
 "objective); the player fact search_plan; Bram's dialogue (talk while the quest is active, roles bram and lantern, carry "
 "setting player_led with narration proof.carry, leave setting party_led, handing the lantern to Bram, narration proof.leave); "
 "the story point proof_terminal (outcomes carry and leave, Bram's dialogue choice of that name). Assembled by hand from the "
 "source files (manifest without entry and calendar plus resource@1 and schedule@1, the lock, empty policies and actions, each "
 "fact, room, barrier, NPC, item, quest, dialogue and story point with key added and short references expanded, the default "
 "pools, entry, text, calendar) before the compiler was run, its canonical bytes by Python json.dumps(sort_keys=True, "
 "separators=(',', ':'), ensure_ascii=False) and sha256 by hashlib, never by the kernels. For these values (small integers "
 "only, ASCII only, no control characters) Python's output is the loka-numeric-v1 encoding.")
out = {"description": DESC, "value": value, "canonical": c, "sha256": sha}
open("protocol/fixtures/cartridge_lantern_hash.json","w").write(json.dumps(out, indent=2, ensure_ascii=False)+"\n")
print(sha)
