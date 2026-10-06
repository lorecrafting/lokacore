"""Independent D1 v030 successor over the published C3/B9/D2 v029 answer.
The D1 literals below freeze reviewed authored declarations; expansion, canonical
JSON, SHA-256 and UUID allocation are Python-only and import no compiler/kernel.
"""
import hashlib
import json
from pathlib import Path
import uuid

here = Path(__file__).parent
version = "0.0.30"
prefix = "ashmere_missing_child@" + version
d1 = json.loads(r'''{
  "rooms": {
    "boathouse": {
      "title": "room.boathouse.title",
      "description": "room.boathouse.description",
      "exits": {
        "east": {
          "to": "ferry_landing"
        }
      },
      "details": {
        "ferry": {
          "aliases": [
            "ferry",
            "rope_ferry"
          ],
          "description": "detail.fen_outbound.description",
          "transport": {
            "route": "fen_outbound",
            "title": "detail.ferry.title"
          }
        }
      }
    },
    "fen_isle_landing": {
      "title": "room.fen_isle_landing.title",
      "description": "room.fen_isle_landing.description",
      "exits": {
        "east": {
          "to": "isle_hut"
        },
        "south": {
          "to": "isle_shrine"
        }
      },
      "details": {
        "ferry": {
          "aliases": [
            "ferry",
            "rope_ferry"
          ],
          "description": "detail.fen_return.description",
          "transport": {
            "route": "fen_return",
            "title": "detail.ferry.title"
          }
        }
      }
    },
    "isle_hut": {
      "title": "room.isle_hut.title",
      "description": "room.isle_hut.description",
      "exits": {
        "west": {
          "to": "fen_isle_landing"
        },
        "east": {
          "to": "herb_garden"
        },
        "up": {
          "to": "hut_loft"
        }
      }
    },
    "hut_loft": {
      "title": "room.hut_loft.title",
      "description": "room.hut_loft.description",
      "exits": {
        "down": {
          "to": "isle_hut"
        }
      },
      "dark_description": "room.hut_loft.dark"
    },
    "herb_garden": {
      "title": "room.herb_garden.title",
      "description": "room.herb_garden.description",
      "exits": {
        "west": {
          "to": "isle_hut"
        }
      }
    },
    "isle_shrine": {
      "title": "room.isle_shrine.title",
      "description": "room.isle_shrine.description",
      "exits": {
        "north": {
          "to": "fen_isle_landing"
        }
      }
    }
  },
  "npcs": {
    "sedge": {
      "keywords": [
        "sedge",
        "mother"
      ],
      "short": "npc.sedge.short",
      "room_line": "npc.sedge.room",
      "description": "npc.sedge.description",
      "room": "isle_hut",
      "resource_starts": {
        "pennies": 0
      }
    }
  },
  "dialogues": {
    "sedge_swim": {
      "npc": "sedge",
      "roles": {
        "teacher": {
          "role": "npc",
          "npc": "sedge"
        }
      },
      "policy": {
        "policy_version": 1,
        "root": {
          "op": "fact_compare",
          "fact": "skill_swim",
          "equals": false
        }
      },
      "prompt": "sedge.swim.prompt",
      "choices": {
        "learn": {
          "label": "sedge.swim.choice",
          "narration": "sedge.swim.learned",
          "sequence": [
            {
              "op": "skill.acquire",
              "skill": "swim"
            }
          ]
        }
      },
      "label": "sedge.swim.choice"
    }
  },
  "skills": {
    "swim": {
      "label": "skill.swim.label",
      "requirement": "skill.swim.requirement",
      "qualification": {
        "policy_version": 1,
        "root": {
          "op": "all",
          "items": []
        }
      }
    }
  },
  "transports": {
    "fen_outbound": {
      "room": "boathouse",
      "detail": "ferry",
      "destination": "fen_isle_landing",
      "reverse": "fen_return",
      "recipient": "sedge",
      "currency": "pennies",
      "fare": 2,
      "recovery_rooms": [
        "fen_isle_landing",
        "isle_hut",
        "hut_loft",
        "herb_garden",
        "isle_shrine"
      ],
      "action": "board_ferry",
      "label": "transport.board",
      "narration": "transport.outbound.used"
    },
    "fen_return": {
      "room": "fen_isle_landing",
      "detail": "ferry",
      "destination": "boathouse",
      "reverse": "fen_outbound",
      "recipient": "sedge",
      "currency": "pennies",
      "fare": 0,
      "recovery_rooms": [],
      "action": "return_ferry",
      "label": "transport.return",
      "narration": "transport.return.used"
    }
  },
  "actions": {
    "board_ferry": {
      "label": "transport.board",
      "command": "use_transport",
      "target": {
        "kind": "entity",
        "scopes": [
          "inspectable_details"
        ]
      },
      "input": [
        "route",
        "quoted_fare"
      ],
      "priority": 0,
      "policy": {
        "policy_version": 1,
        "root": {
          "op": "all",
          "items": []
        }
      },
      "accessibility": "transport.board"
    },
    "return_ferry": {
      "label": "transport.return",
      "command": "use_transport",
      "target": {
        "kind": "entity",
        "scopes": [
          "inspectable_details"
        ]
      },
      "input": [
        "route",
        "quoted_fare"
      ],
      "priority": 0,
      "policy": {
        "policy_version": 1,
        "root": {
          "op": "all",
          "items": []
        }
      },
      "accessibility": "transport.return"
    }
  },
  "text": {
    "room.boathouse.title": "Boathouse",
    "room.boathouse.description": "Weathered timbers shelter an unattended [rope ferry](ferry). A taut cable crosses the fen to the isle.",
    "detail.fen_outbound.description": "The rope ferry runs along its cable. Leave two pennies for Mother Sedge before crossing to the isle; passage to recover your belongings is free.",
    "room.fen_isle_landing.title": "Fen Isle Landing",
    "room.fen_isle_landing.description": "Reeds brush the [rope ferry](ferry). A narrow path leads east to a hut; south, a shrine stands among the sedge.",
    "detail.fen_return.description": "The rope ferry returns to the Boathouse without a fare.",
    "room.isle_hut.title": "Isle Hut",
    "room.isle_hut.description": "Bundles of drying herbs hang from the rafters. An open door leads to the garden, and a ladder rises into the loft.",
    "room.hut_loft.title": "Hut Loft",
    "room.hut_loft.description": "The low loft smells of dried leaves and old rope. The ladder is the only way down.",
    "room.hut_loft.dark": "The loft is dark. You know the ladder leads down.",
    "room.herb_garden.title": "Herb Garden",
    "room.herb_garden.description": "Herbs fill crooked beds between the reeds. The hut door lies west.",
    "room.isle_shrine.title": "Isle Shrine",
    "room.isle_shrine.description": "A worn stone marks a quiet sanctuary beside the fen. No priest tends it. The path north returns to the landing.",
    "detail.ferry.title": "Rope ferry",
    "transport.board": "Board",
    "transport.return": "Return",
    "transport.unaffordable": "You need two pennies for passage to the isle.",
    "transport.outbound.used": "You draw the rope ferry across the fen and step onto Fen Isle Landing.",
    "transport.return.used": "You draw the rope ferry back to the Boathouse.",
    "npc.sedge.short": "Mother Sedge",
    "npc.sedge.room": "[Mother Sedge] sorts dried leaves beside the hearth.",
    "npc.sedge.description": "Mother Sedge has lived beside the fen longer than anyone remembers. She teaches swimming freely to those who ask.",
    "skill.swim.label": "Swim",
    "skill.swim.requirement": "No attribute requirement for learning; water access is not yet available.",
    "sedge.swim.prompt": "Mother Sedge offers to teach you to swim.",
    "sedge.swim.choice": "Learn swim — free",
    "sedge.swim.learned": "Mother Sedge teaches you to keep afloat and swim. You have learned swim."
  }
}''')
v = json.loads((here / "missing_child_v029_hash.json").read_text())["value"]
v = json.loads(json.dumps(v).replace("0.0.29", version))
v["manifest"]["requires"]["kernel_api"]["at_least"] = "1.26"
v["manifest"]["requires"]["capabilities"]["transport"] = 1
v["lock"]["capabilities"]["transport"] = 1

def ref(kind, key):
    return {"cartridge_id": "ashmere_missing_child", "cartridge_version": version,
            "kind": kind, "key": key}

def add(section, kind, key, value):
    v.setdefault(section, {})[prefix + ":" + kind + "/" + key] = {"key": key, **value}

for key, room in d1["rooms"].items():
    for edge in room["exits"].values():
        edge["to"] = ref("room", edge["to"])
    for detail in room.get("details", {}).values():
        detail["transport"]["route"] = ref("transport", detail["transport"]["route"])
    add("rooms", "room", key, room)
v["rooms"][prefix + ":room/ferry_landing"]["exits"]["west"] = {"to": ref("room", "boathouse")}
for key, npc in d1["npcs"].items():
    npc["room"] = ref("room", npc["room"])
    add("npcs", "npc", key, npc)
for key, dialogue in d1["dialogues"].items():
    dialogue["npc"] = ref("npc", dialogue["npc"])
    for role in dialogue["roles"].values():
        role["npc"] = ref("npc", role["npc"])
    dialogue["policy"]["root"]["fact"] = ref("fact", dialogue["policy"]["root"]["fact"])
    for choice in dialogue["choices"].values():
        for step in choice["sequence"]:
            step["skill"] = ref("skill", step["skill"])
    add("dialogues", "dialogue", key, dialogue)
for key, skill in d1["skills"].items():
    add("skills", "skill", key, skill)
    add("facts", "fact", "skill_" + key,
        {"version": 1, "scopes": ["player"], "value_type": {"type": "bool", "default": False},
         "meaning": "Skill " + key + "'s acquisition (skills@1): only skills@1 writes it."})
for key, route in d1["transports"].items():
    for field, kind in {"room": "room", "destination": "room", "reverse": "transport",
                        "recipient": "npc", "currency": "resource"}.items():
        route[field] = ref(kind, route[field])
    route["recovery_rooms"] = [ref("room", room) for room in route["recovery_rooms"]]
    add("transports", "transport", key, route)
for key, action in d1["actions"].items():
    action.setdefault("accessibility", action["label"])
    action.setdefault("priority", 0)
    action.setdefault("policy", {"policy_version": 1, "root": {"op": "all", "items": []}})
    add("actions", "action", key, action)
v["text"].update(d1["text"])
canonical = json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
digest = hashlib.sha256(canonical.encode()).hexdigest()
(here / "missing_child_v030_hash.json").write_text(json.dumps({
    "description": "D1 ferry, free Sedge swim and safe isle return over published C3/B9/D2 v029.",
    "value": v, "canonical": canonical, "sha256": digest,
}, indent=2, ensure_ascii=False) + "\n")
rooms = sorted(v["rooms"].items())
labels = ["character", "body"] + ["room/" + room["key"] for _, room in rooms]
labels += ["detail/" + room["key"] + "/" + key for _, room in rooms for key in sorted(room.get("details", {}))]
labels += ["npc/" + npc["key"] for _, npc in sorted(v["npcs"].items()) if not npc.get("spawn_template")]
labels += ["item/" + item["key"] for _, item in sorted(v["items"].items()) if item["location"]["in"] != "template"]
labels += ["job/" + npc["key"] for _, npc in sorted(v["npcs"].items()) if npc.get("daily_schedule")]
labels += ["slot/" + slot for slot in sorted({item["slot"] for item in v["items"].values() if "slot" in item})]
# The published C3 initial population appends four members/pelts and its job after fixed content.
labels += ["population/fen_hounds/slot" + str(slot) + "/" + kind
           for slot in range(1, 5) for kind in ("member", "pelt")]
labels += ["population/fen_hounds/job"]
answers = {}
for ordinal, label in enumerate(labels):
    domain = ["loka-id-v1", "0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f",
              "00000000-0000-0000-0000-000000000000", ordinal]
    raw = bytearray(hashlib.sha256(json.dumps(domain, separators=(",", ":")).encode()).digest()[:16])
    raw[6] = (raw[6] & 15) | 128
    raw[8] = (raw[8] & 63) | 128
    answers[label] = str(uuid.UUID(bytes=bytes(raw)))
(here / "missing_child_v030_ids.json").write_text(json.dumps(answers, indent=2) + "\n")
print("Independent D1 v030/API1.26: " + digest + "; " + str(len(answers)) + " initial IDs.")
