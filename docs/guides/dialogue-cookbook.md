# Dialogue cookbook

Known RPG dialogue patterns, each a small working source to copy. Every word in capitals is a
placeholder for your own. A test compiles this page into one cartridge with no warnings and plays
each pattern once, with a reload (`mobile/authority/local-story/__tests__/dialogue_cookbook.test.ts`).
The pattern files are [area bundles](../system/cartridge.md#source-shortcuts); put each `facts.json`
block into your own `facts.json`. In a `.scene` file a pattern's choices keep their `policy` and `then` in the
`dialogues/<key>.json` beside it, until the scene forms for them land.

A dialogue with more than one choice comes back to the player after each answer (the hub), so a
Leave choice is never needed: Close always ends the talk. Choice ids below are unique across
dialogues because a `choice_resolved` reaction names a choice by its id alone. The Book lists a
dialogue's choices in id order, not file order.

## The room they stand in

```json cartridge.json
{
  "api_version": "loka/v3",
  "id": "dialogue_cookbook",
  "version": "0.0.1",
  "title": "Dialogue cookbook",
  "requires": {
    "kernel_api": { "at_least": "1.137", "below": "2.0" },
    "content_schema": 1,
    "rule_ir": 1,
    "capabilities": {
      "movement": 1, "containment": 1, "fact": 1, "policy": 1, "dialogue": 1, "check": 1,
      "attribute": 1, "skill": 1, "quest": 1, "reaction": 1, "status": 1, "resource": 1,
      "death": 1, "scripted_action": 1
    },
    "client_features": []
  },
  "supported_profiles": ["offline_private"],
  "entry": "yard",
  "world": { "levelling": { "thresholds": [100], "points_per_level": 1, "level_up": "level_up" } }
}
```

```json text.json
{ "level_up": "LEVEL_UP" }
```

```json attributes.json
{ "attributes": { "cha": { "start": 6 } } }
```

```json resources.json
{ "resources": { "hp": { "minimum": 0, "maximum": 20, "start": 10, "gain": 0 } } }
```

```json rooms/yard.json
{ "name": { "prose": "ROOM" }, "description": { "prose": "ROOM_TEXT" }, "exits": {} }
```

## A quest before, during and after, with a reminder and thanks

One dialogue, its choices shown by the quest's state. The reminder repeats as often as the player
asks.

```json quests/errand.json
{
  "name": { "prose": "QUEST" },
  "objective": {
    "evidence": "current_state",
    "policy": { "op": "fact_compare", "fact": "errand_done", "equals": true }
  },
  "journal": {
    "active": { "prose": "QUEST_ACTIVE" },
    "objectives_met": { "prose": "QUEST_MET" },
    "resolved": { "prose": "QUEST_RESOLVED" },
    "failed": { "prose": "QUEST_FAILED" },
    "abandoned": { "prose": "QUEST_ABANDONED" }
  }
}
```

```json facts.json
{
  "errand_done": {
    "version": 1,
    "value_type": { "type": "bool", "default": false },
    "scopes": ["instance"],
    "meaning": "The errand is done."
  }
}
```

```json areas/quest_stages.json
{
  "npcs": {
    "giver": {
      "keywords": ["giver"],
      "name": { "prose": "NPC" },
      "room_line": { "prose": "A [NPC](giver)." },
      "description": { "prose": "NPC_TEXT" },
      "room": "yard"
    }
  },
  "dialogues": {
    "giver": {
      "npc": "giver",
      "prompt": { "prose": "NPC_GREETING" },
      "roles": { "giver": { "role": "npc", "npc": "giver" } },
      "choices": {
        "start_errand": {
          "label": { "prose": "START_LABEL" },
          "narration": { "prose": "START_REPLY" },
          "accept": "errand",
          "policy": {
            "op": "not",
            "item": {
              "op": "any",
              "items": [
                { "op": "quest_state", "quest": "errand", "state": "active" },
                { "op": "quest_state", "quest": "errand", "state": "resolved" }
              ]
            }
          }
        },
        "remind_errand": {
          "label": { "prose": "REMINDER_LABEL" },
          "narration": { "prose": "REMINDER_REPLY" },
          "policy": {
            "op": "all",
            "items": [
              { "op": "quest_state", "quest": "errand", "state": "active" },
              { "op": "not", "item": { "op": "fact_compare", "fact": "errand_done", "equals": true } }
            ]
          }
        },
        "do_errand": {
          "label": { "prose": "PRETEND_THE_WORK_LABEL" },
          "narration": { "prose": "PRETEND_THE_WORK_REPLY" },
          "policy": {
            "op": "all",
            "items": [
              { "op": "quest_state", "quest": "errand", "state": "active" },
              { "op": "not", "item": { "op": "fact_compare", "fact": "errand_done", "equals": true } }
            ]
          },
          "steps": [{ "op": "fact.assign", "fact": "errand_done", "value": true }]
        },
        "hand_in_errand": {
          "label": { "prose": "TURN_IN_LABEL" },
          "narration": { "prose": "TURN_IN_REPLY" },
          "policy": {
            "op": "all",
            "items": [
              { "op": "quest_state", "quest": "errand", "state": "active" },
              { "op": "fact_compare", "fact": "errand_done", "equals": true }
            ]
          }
        },
        "thanks_errand": {
          "label": { "prose": "THANKS_LABEL" },
          "narration": { "prose": "THANKS_REPLY" },
          "policy": { "op": "quest_state", "quest": "errand", "state": "resolved" }
        }
      }
    }
  },
  "reactions": {
    "errand_handed_in": {
      "on": { "event": "choice_resolved", "choice": "hand_in_errand" },
      "steps": [{ "op": "quest.resolve", "quest": "errand", "outcome": "handed_in" }]
    }
  }
}
```

**A single turn-in choice** is `hand_in_errand` and its reaction: its policy reads the same fact as the
objective, because a `current_state` objective is checked when needed and the quest stays `active`
until it resolves. A dialogue-level `quest` would resolve on every choice.

## A label that changes with the state, and what changed

Two choices with opposite policies are one line whose words change. A reply reads the same fact
through `narration_variants`.

```json areas/label_by_state.json
{
  "npcs": {
    "watcher": {
      "keywords": ["watcher"],
      "name": { "prose": "NPC" },
      "room_line": { "prose": "A [NPC](watcher)." },
      "description": { "prose": "NPC_TEXT" },
      "room": "yard"
    }
  },
  "dialogues": {
    "watcher": {
      "npc": "watcher",
      "prompt": { "prose": "NPC_GREETING" },
      "roles": { "watcher": { "role": "npc", "npc": "watcher" } },
      "choices": {
        "ask_before": {
          "label": { "prose": "LABEL_BEFORE" },
          "narration": { "prose": "REPLY_BEFORE" },
          "policy": { "op": "not", "item": { "op": "fact_compare", "fact": "errand_done", "equals": true } }
        },
        "ask_after": {
          "label": { "prose": "LABEL_AFTER" },
          "narration": { "prose": "REPLY_AFTER" },
          "policy": { "op": "fact_compare", "fact": "errand_done", "equals": true }
        },
        "whats_new": {
          "label": { "prose": "WHAT_CHANGED_LABEL" },
          "narration": { "prose": "NOTHING_CHANGED_REPLY" },
          "narration_variants": [
            {
              "when": { "op": "fact_compare", "fact": "errand_done", "equals": true },
              "description": { "prose": "SOMETHING_CHANGED_REPLY" }
            }
          ]
        }
      }
    }
  }
}
```

## Learn a skill, once

```json areas/learn_skill.json
{
  "skills": {
    "knack": {
      "name": { "prose": "SKILL" },
      "requirement": { "prose": "SKILL_TEXT" },
      "growth": [2]
    }
  },
  "npcs": {
    "teacher": {
      "keywords": ["teacher"],
      "name": { "prose": "NPC" },
      "room_line": { "prose": "A [NPC](teacher)." },
      "description": { "prose": "NPC_TEXT" },
      "room": "yard"
    }
  },
  "dialogues": {
    "teacher": {
      "npc": "teacher",
      "prompt": { "prose": "NPC_GREETING" },
      "roles": { "teacher": { "role": "npc", "npc": "teacher" } },
      "choices": {
        "learn_knack": {
          "label": { "prose": "LEARN_LABEL" },
          "narration": { "prose": "LEARN_REPLY" },
          "steps": [{ "op": "skill.acquire", "skill": "knack" }]
        }
      }
    }
  }
}
```

## A check that passes or fails, each with its own next page, and a hand-off

`then` and `then_failed` open another dialogue. When it has another speaker, that is the hand-off:
the other NPC talks from there.

```json areas/check_branches.json
{
  "npcs": {
    "doubter": {
      "keywords": ["doubter"],
      "name": { "prose": "NPC" },
      "room_line": { "prose": "A [NPC](doubter)." },
      "description": { "prose": "NPC_TEXT" },
      "room": "yard",
      "attributes": [{ "attribute": "cha", "value": 5 }]
    },
    "friend": {
      "keywords": ["friend"],
      "name": { "prose": "NPC" },
      "room_line": { "prose": "A [NPC](friend)." },
      "description": { "prose": "NPC_TEXT" },
      "room": "yard"
    }
  },
  "dialogues": {
    "doubter": {
      "npc": "doubter",
      "prompt": { "prose": "NPC_GREETING" },
      "roles": { "doubter": { "role": "npc", "npc": "doubter" } },
      "choices": {
        "persuade_doubter": {
          "label": { "prose": "CHECK_LABEL" },
          "narration": { "prose": "PASS_REPLY" },
          "check": {
            "key": "persuade_doubter",
            "kind": "opposed",
            "attribute": "cha",
            "npc": "doubter",
            "failure": { "prose": "FAIL_REPLY" }
          },
          "then": "friend_takes_over",
          "then_failed": "doubter_retry"
        }
      }
    },
    "doubter_retry": {
      "npc": "doubter",
      "prompt": { "prose": "FAIL_PAGE" },
      "roles": { "doubter": { "role": "npc", "npc": "doubter" } },
      "choices": {
        "shrug_doubter": { "label": { "prose": "FAIL_LABEL" }, "narration": { "prose": "FAIL_END" } }
      }
    },
    "friend_takes_over": {
      "npc": "friend",
      "prompt": { "prose": "HAND_OFF_PAGE" },
      "roles": { "friend": { "role": "npc", "npc": "friend" } },
      "choices": {
        "greet_friend": { "label": { "prose": "HAND_OFF_LABEL" }, "narration": { "prose": "HAND_OFF_END" } }
      }
    }
  }
}
```

## A choice that curses, cures, heals, grants experience or fires your own event

A choice's own `steps` set facts, narrate, teach a skill and grant a topic. Everything else a
reaction does is one `choice_resolved` reaction away, on the choice's id. Healing is a status with
a positive `per_tick`, so it comes over time; an instant heal from a choice is not available.

```json facts.json
{
  "bell_heard": {
    "version": 1,
    "value_type": { "type": "bool", "default": false },
    "scopes": ["instance"],
    "meaning": "Something heard the event the choice fired."
  }
}
```

```json areas/choice_effects.json
{
  "statuses": {
    "hex": {
      "name": { "prose": "CURSE" },
      "duration": "permanent",
      "tick_every": 86400,
      "resource": "hp",
      "narration": { "applied": { "prose": "CURSE_APPLIED" }, "tick": { "prose": "CURSE_TICK" }, "expired": { "prose": "CURSE_ENDS" } }
    },
    "mending": {
      "name": { "prose": "HEAL" },
      "duration": 60,
      "tick_every": 10,
      "per_tick": 1,
      "resource": "hp",
      "narration": { "applied": { "prose": "HEAL_APPLIED" }, "tick": { "prose": "HEAL_TICK" }, "expired": { "prose": "HEAL_ENDS" } }
    }
  },
  "npcs": {
    "healer": {
      "keywords": ["healer"],
      "name": { "prose": "NPC" },
      "room_line": { "prose": "A [NPC](healer)." },
      "description": { "prose": "NPC_TEXT" },
      "room": "yard"
    }
  },
  "dialogues": {
    "healer": {
      "npc": "healer",
      "prompt": { "prose": "NPC_GREETING" },
      "roles": { "healer": { "role": "npc", "npc": "healer" } },
      "choices": {
        "take_curse": { "label": { "prose": "CURSE_LABEL" }, "narration": { "prose": "CURSE_REPLY" } },
        "take_cure": { "label": { "prose": "CURE_LABEL" }, "narration": { "prose": "CURE_REPLY" } },
        "take_heal": { "label": { "prose": "HEAL_LABEL" }, "narration": { "prose": "HEAL_REPLY" } },
        "take_lesson": { "label": { "prose": "XP_LABEL" }, "narration": { "prose": "XP_REPLY" } },
        "ring_bell": { "label": { "prose": "EVENT_LABEL" }, "narration": { "prose": "EVENT_REPLY" } }
      }
    }
  },
  "reactions": {
    "curse_taken": {
      "on": { "event": "choice_resolved", "choice": "take_curse" },
      "steps": [{ "op": "status.apply", "status": "hex" }]
    },
    "curse_cured": {
      "on": { "event": "choice_resolved", "choice": "take_cure" },
      "steps": [{ "op": "status.cure", "status": "hex" }]
    },
    "heal_taken": {
      "on": { "event": "choice_resolved", "choice": "take_heal" },
      "steps": [{ "op": "status.apply", "status": "mending" }]
    },
    "lesson_taken": {
      "on": { "event": "choice_resolved", "choice": "take_lesson" },
      "steps": [{ "op": "experience.grant", "amount": 5 }]
    },
    "bell_rung": {
      "on": { "event": "choice_resolved", "choice": "ring_bell" },
      "steps": [{ "op": "event.emit", "event": "bell" }]
    },
    "bell_heard": {
      "on": { "event": "custom_event", "custom": "bell" },
      "steps": [{ "op": "fact.assign", "fact": "bell_heard", "value": true }]
    }
  }
}
```
