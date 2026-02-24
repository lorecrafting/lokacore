# Alpha Playthrough Plan — Post-Landing World + Validator Fix

> **Status**: Ready to implement. Pick up after context reset.
> **Working dir**: `server/` for all commands and paths.
> **Baseline**: 2270 tests, 0 failures. Grove: 108 rooms complete. Barren: 113 rooms complete.

---

## Context Summary (read this first)

The game has two built worlds:
- **`priv/world/prototypes/rooms/grove/`** — 108 rooms, the pre-landing seedship grove. Thera is alive. Membrane intact. All spine quests work here. 5 quests + 4 side quests fully implemented with dialogue.
- **`priv/world/prototypes/rooms/barren/`** — 113 rooms across 8 zones (margin, plains, bone_forest, crystal_city, highlands, salt_flats, shore, deep_rift). No quests or NPCs yet.

The grove → barren connection is already physically wired:
- `grove/edges/the_edge` → north → `barren/margin/threshold_gate`
- `grove/edges/edge_east` → east → `barren/margin/eastern_threshold`
- `grove/edges/edge_west` → west → `barren/margin/western_threshold`

**The alpha goal**: A player completes the grove arc (5 spine quests ending with grove_epilogue), then gets teleported to a **post-landing version of the grove** on the planet surface, with the membrane gone and real sky visible, before stepping out into the barren.

**The design model**: Two grove zones exist simultaneously for different players:
- Pre-landing players: in `grove/` (membrane intact, Thera alive)
- Post-landing players: in `planet/grove/` (real sky, Thera in Pulse, connected to barren)

No engine changes needed. Different room keys = different descriptions. NPCs exist in both zones. Existing `show_if: completed_quest: grove_epilogue` conditions already gate the post-landing dialogue in all NPC files.

---

## Blocker 1: Fix Content Validator (do this first)

**Problem**: `mix loka.test.validate` fails with 7 errors, all false positives. The validator's `dialogue_topic` cross-reference check uses BFS-reachable nodes rather than ALL nodes. Nodes that are only accessible as `dialogue_topic` entry points (accessed directly by node ID, not via a choice chain) get flagged as "missing" even when they exist.

**The 7 false-positive errors**:
```
Quest 'side_brennan': NPC 'elder_maren' missing dialogue topic 'seren_records'
Quest 'side_brennan': NPC 'brennan' missing dialogue topic 'seren_named'
Quest 'side_tomas': NPC 'tomas' missing dialogue topic 'trowel_story'
Quest 'side_tomas': NPC 'tomas' missing dialogue topic 'trowel_return'
Quest 'side_three_roots': NPC 'tomas' missing dialogue topic 'three_roots_found'
Quest 'side_yara': NPC 'kira' missing dialogue topic 'yara_offer'
Quest 'side_yara': NPC 'kira' missing dialogue topic 'yara_journal_returned'
```

All 7 nodes EXIST in the NPC YAML files — confirmed by reading them. They have `show_if: quest_active: <quest_id>` guards at the node level, which causes the BFS to exclude them from the reachable set.

**How to fix**:
1. Find the content validator: `lib/loka/testing/content/` — look for a module that checks dialogue_topic references in quests
2. Find the function that checks whether a dialogue_topic node exists in an NPC's dialogue tree
3. Change it to search ALL nodes in the dialogue tree (not just BFS-reachable nodes)
4. The fix is likely: instead of `Map.has_key?(reachable_nodes, topic_id)`, use `Map.has_key?(all_nodes, topic_id)` where `all_nodes` is built by iterating all nodes in the dialogue tree regardless of reachability
5. Run `mix loka.test.validate` — should show 0 errors on the 7 false positives
6. Run `mix test --exclude integration` — should still show 2270 tests, 0 failures

---

## Blocker 2: Build `planet/grove/` Zone (~15 key rooms)

Create `priv/world/prototypes/rooms/planet/grove/` as a new directory. This is the post-landing version of the grove — same layout, different descriptions. The membrane is gone. Real sky. Thera's presence is in the Pulse, not physical.

### Narrative Style (CRITICAL — no exceptions)
- **NO hyphens in prose ever**: "well worn" not "well-worn", "half buried" not "half-buried", "sun lit" not "sun-lit"
- Em dash for pauses: "word — word"
- Room descriptions: 2-4 sentences. The grove is the same but different. What was enclosed is now open. The Pulse is still present but changed.
- Every room should have one "real sky" tell — something that was strange before and is explained now, or something new that wasn't possible before.
- Use `extra_desc` (NOT `long_desc`) for room descriptions.

### YAML Format
```yaml
key: room_key
type: room
parent: base_room
short_desc: "Short Name"
extra_desc: |
  Description. No hyphens. Post-landing feel.
exits:
  direction: target_key
tags:
  - outdoor
  - safe_zone
```

### The 15 Critical Rooms to Build

**All exits point to other `planet/grove/` rooms unless specified. Use the same exit directions as the corresponding pre-landing rooms.**

---

**Room 1: `planet_awakening_clearing`**
- This is where players arrive when teleported after grove_epilogue
- Pre-landing version: `awakening_clearing` (starting room)
- short_desc: "The Landing Ground"
- Description: The clearing where you first woke. The sky above it is real — clouds moving, wind coming from somewhere off the ship's edge. The trees are the same. The silence is different: no membrane hum. The grove is on the planet now. So are you.
- exits: north→planet_heartwood_spring, south→planet_southern_grove (or whatever connects south in pre-landing version — check `awakening_clearing.yml` exits)
- tags: outdoor, safe_zone

**Room 2: `planet_heartwood`**
- Pre-landing: `heartwood`
- short_desc: "The Heartwood"
- Description: The ancient trees still spiral clockwise, still warm to the touch. Above them, real sky — the first time the canopy has been open to anything other than the membrane. The warmth in the bark is no longer impossible. The grove chose its own sun.
- exits: same as pre-landing heartwood (south→planet_heartwood_spring, north→planet_elder_hall, west→planet_lira_memorial, east→planet_common_fire_circle)
- tags: outdoor, safe_zone

**Room 3: `planet_heartwood_spring`**
- Pre-landing: `heartwood_spring`
- short_desc: "The Spring"
- Description: The water still flows briefly upward along the western edge before rejoining the pool. It did this before anyone knew what it was doing. Now you know: pressure regulation. The grove's water system, still running, still maintaining itself. The pool is still clear.
- exits: same as pre-landing (north→planet_heartwood, south→planet_awakening_clearing, west→planet_morning_meadow, east→planet_south_understory)
- tags: outdoor, safe_zone

**Room 4: `planet_healing_grove`**
- Pre-landing: `healing_grove`
- short_desc: "Thera's Healing Grove"
- Description: The herbs still grow in rows she didn't plant. The temperature is still right. She is not here. The narrow stream along one edge runs exactly as it always did, because the system she tended still runs. Kira has taken over the morning rounds. The tools are in the same places.
- exits: same as pre-landing healing_grove exits
- tags: outdoor, safe_zone

**Room 5: `planet_small_grove`**
- Pre-landing: `small_grove`
- short_desc: "The Small Grove"
- Description: The place she only showed you. It is unchanged. The same quality of light, the same quiet. You understand now why it felt like shelter: it was designed to. The grove built this pocket on purpose, for whoever needed it. She knew. She brought you here anyway.
- exits: south→planet_healing_grove, and any other exits small_grove has
- tags: outdoor, safe_zone

**Room 6: `planet_lira_memorial`**
- Pre-landing: `lira_memorial`
- short_desc: "Lira's Memorial"
- Description: The statue is the same. What is different: you know who she is now. Not historical — present, in the Pulse, in the root network, in every tree that grew exactly where it was supposed to. The grove landed on the planet she chose. She did not stop when she became the Heart. She aimed.
- exits: same as pre-landing lira_memorial exits
- tags: outdoor, safe_zone

**Room 7: `planet_elder_hall`**
- Pre-landing: `elder_hall`
- short_desc: "The Elder Hall"
- Description: The hall where the council met and did not tell you. Where Elder Maren decided, again, to carry the weight alone. The carved seat at the head of the hall is empty. She is sitting in the second seat now, the same one she always used when she was thinking rather than presiding.
- exits: same as pre-landing elder_hall exits
- tags: outdoor, safe_zone

**Room 8: `planet_training_grove`**
- Pre-landing: `training_grove`
- short_desc: "The Training Grove"
- Description: Where she taught. The practice forms she walked you through are still visible in the worn paths between the roots. The grove records use. Kira uses this space now, in the mornings, before she goes to the blight line. She does not talk about why.
- exits: check training_grove.yml for its exits
- tags: outdoor, safe_zone

**Room 9: `planet_the_deep`**
- Pre-landing: `the_deep`
- short_desc: "The Deep"
- Description: The geometric circuit traces on the bark are the same. They were always readable. No one tried to read them. Now they are ship systems documentation, still legible, still accurate. The Pulse here is different: it carries her. Not her voice. Her weight. The way a room holds the shape of someone who lived in it.
- exits: same as pre-landing the_deep exits
- tags: outdoor

**Room 10: `planet_heartroot_chamber`**
- Pre-landing: `heartroot_chamber`
- short_desc: "The Heartroot Chamber"
- Description: Where she went. Where Lira went before her. The chamber is quiet in a way the rest of the grove is not — the Pulse is loudest here and also most still, like the center of something large. If you listen, there is something that is not quite sound. It has always been there. You only know now what to call it.
- exits: check heartroot_chamber.yml for exits
- tags: underground, indoor

**Room 11: `planet_the_edge`**
- Pre-landing: `the_edge` — described membrane, flicker, seam
- short_desc: "The Open Edge"
- Description: Where the membrane was. The seam is still visible along the ground — a line where the ship's hull met the biological layer for two hundred years, now open to weather. Wind comes through here. Real wind, from the planet, carrying something that isn't grove and isn't ship. The edge is no longer an ending. It is a threshold.
- exits: south→planet_edge_approach, east→planet_edge_east, west→planet_edge_west, north→threshold_gate (THE BARREN — this is the transition to the existing barren zone)
- tags: outdoor

**Room 12: `planet_edge_east`**
- Pre-landing: `edge_east`
- short_desc: "The Eastern Opening"
- Description: The eastern section of what was the membrane boundary. The horizon is visible from here — the planet's horizon, further than the membrane ever showed. The barren stretches east. In the distance, something that might be a formation or might be a structure. Too far to tell yet.
- exits: west→planet_the_edge, east→eastern_threshold (BARREN), north→planet_edge_monitoring_post (new room, optional), south→(whatever edge_east connects to)
- tags: outdoor

**Room 13: `planet_edge_west`**
- Pre-landing: `edge_west`
- short_desc: "The Western Opening"
- Description: The western section of the old boundary. The grove wall is visible here as a physical thing — roots and soil exposed where the membrane seal pulled away. The planet's wind comes from the west. Cold, dry, carrying dust that is not grove dust. The barren begins just past the root line.
- exits: east→planet_the_edge, west→western_threshold (BARREN), north→planet_edge_arch (new room, optional)
- tags: outdoor

**Room 14: `planet_watchers_post`**
- Pre-landing: `watchers_post`
- short_desc: "The Watchers Post"
- Description: Brennan's post, where he watched the membrane for thirty years. The equipment is still here. The numbers on the monitoring log for the last day read differently from every other day — not stress readings. The membrane releasing. He has left a note on the equipment: "I was right. It was worth watching." Beneath it, in older ink: "She was here."
- exits: check watchers_post.yml for exits
- tags: outdoor, safe_zone

**Room 15: `planet_the_thinning`**
- Pre-landing: `the_thinning` — described spatial wrongness, light too even, ground pressing back
- short_desc: "The Former Thinning"
- Description: The spatial distortion is gone. The ground is soil again. The trees that were distressed here are recovering — you can see new growth where the bark was splitting. Whatever the membrane was doing to this area has stopped. The thinning is just forest now. Strange, for the grove's strangest place to become ordinary.
- exits: same as pre-landing the_thinning
- tags: outdoor, safe_zone

---

### Exits from planet/grove/ to barren/ (critical — must be correct)

Three rooms connect to the existing barren zone:
- `planet_the_edge` → north → `threshold_gate` (existing barren room)
- `planet_edge_east` → east → `eastern_threshold` (existing barren room)
- `planet_edge_west` → west → `western_threshold` (existing barren room)

The barren threshold rooms already have their return exits pointing to the pre-landing edge rooms. You need to UPDATE those 3 barren threshold files to point back to the planet/grove rooms instead:
- `barren/margin/threshold_gate.yml`: change `south: the_edge` to `south: planet_the_edge`
- `barren/margin/eastern_threshold.yml`: change `west: edge_east` to `west: planet_edge_east`
- `barren/margin/western_threshold.yml`: change `east: edge_west` to `east: planet_edge_west`

**Important**: The pre-landing grove edge rooms (`grove/edges/the_edge`, etc.) keep their exits to `threshold_gate`, `eastern_threshold`, `western_threshold`. This means pre-landing players can also walk into the barren — which is fine for alpha. A gate can be added later if needed.

---

### NPC Spawns in planet/grove/

Most NPCs don't need post-landing instances for alpha — the empty rooms are part of the grief. The exceptions:

- **Kira** should be in `planet_healing_grove` (she took over Thera's rounds) — add `spawns: [prototype: kira]` to `planet_healing_grove.yml`
- **Elder Maren** in `planet_elder_hall` — add spawn
- **Brennan** in `planet_watchers_post` — add spawn
- **Tomas** in `planet_training_grove` or `planet_heartwood` — add spawn
- **Thera**: NO physical instance. Her presence is in `planet_heartroot_chamber` via ambient script.

---

## Step 3: Wire grove_epilogue → Teleport

Edit `priv/world/quests/grove_epilogue.yml`.

The final objective (currently something like `thera_presence` — talking to Thera's Pulse presence in heartroot_chamber and turning in to Elder Maren) needs a teleport action on completion.

Find the `on_complete:` section of grove_epilogue (or add one if it doesn't exist). Add a teleport to `planet_awakening_clearing`.

The format for quest completion actions — look at other quests for the exact `on_complete:` syntax. It likely uses an action type `teleport` with a `destination` key. If `on_complete:` doesn't exist in this quest, check `docs/builder-reference/` for quest YAML schema, or look at how `grove_sacrifice` handles its completion trigger (the landing event).

If there's no built-in `on_complete: teleport` mechanic in quests, the alternative is:
- Add a final dialogue node in Elder Maren's post-epilogue dialogue that fires a `teleport.()` script binding
- Or add a special final room `landing_arrival` with a room entry effect that auto-teleports

Check `priv/world/quests/grove_epilogue.yml` first to see what the final objective's completion looks like.

---

## Step 4: Add a Barren Storyline File

Create `priv/world/storylines/barren_arc.yml` — even a minimal one so the validator doesn't complain about barren rooms being orphaned from any storyline.

Minimal format (look at `grove_arc.yml` for the exact structure):
```yaml
key: barren_arc
type: storyline
name: "The Barren"
description: "The planet's surface — what the grove landed on."
acts: []
side_quests: []
```

This prevents any future validator errors about barren rooms having no storyline.

---

## Step 5: Verify and Test

1. `mix loka.test.validate` — should show 0 errors (after validator fix)
2. `mix test --exclude integration` — should show 2270 tests, 0 failures (no regressions)
3. Walk the alpha path via dev console:
   ```bash
   curl -s http://localhost:4000/dev/reset -H "Content-Type: application/json" -d '{}' | jq -r '.output'
   curl -s http://localhost:4000/dev/cmd -H "Content-Type: application/json" -d '{"command":"look"}' | jq -r '.output'
   # verify you're in awakening_clearing
   # manually set quest state complete to jump to epilogue end
   # or walk the full arc: talk thera, complete all quests
   # verify teleport to planet_awakening_clearing fires
   # walk north through threshold_gate into the barren
   ```

4. Verify planet/grove rooms are accessible and have correct exits
5. Verify barren rooms are reachable from planet_the_edge north

---

## File Checklist

### New files to create:
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_awakening_clearing.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_heartwood.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_heartwood_spring.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_healing_grove.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_small_grove.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_lira_memorial.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_elder_hall.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_training_grove.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_the_deep.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_heartroot_chamber.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_the_edge.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_edge_east.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_edge_west.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_watchers_post.yml`
- [ ] `priv/world/prototypes/rooms/planet/grove/planet_the_thinning.yml`
- [ ] `priv/world/storylines/barren_arc.yml`

### Existing files to edit:
- [ ] Content validator (fix dialogue_topic node lookup — search ALL nodes not just reachable)
- [ ] `priv/world/prototypes/rooms/barren/margin/threshold_gate.yml` — change south exit to `planet_the_edge`
- [ ] `priv/world/prototypes/rooms/barren/margin/eastern_threshold.yml` — change west exit to `planet_edge_east`
- [ ] `priv/world/prototypes/rooms/barren/margin/western_threshold.yml` — change east exit to `planet_edge_west`
- [ ] `priv/world/quests/grove_epilogue.yml` — add teleport to `planet_awakening_clearing` on completion

### Rooms to connect within planet/grove/ (internal exits):
All 15 planet/grove rooms need exits to each other. Before writing them, read the corresponding pre-landing room to copy the exit structure, then replace room keys with `planet_` prefixed versions. Exception: exits that go to the barren use the real barren room keys (no planet_ prefix).

---

## Notes on What Comes After Alpha

These are NOT needed for alpha but are next:
- Fill out remaining 93 planet/grove rooms (copy pre-landing rooms with post-landing descriptions)
- Add Thera ambient script to `planet_heartroot_chamber` (presence_speaks ambient trigger)
- Barren quests and NPCs (barren_arc storyline content)
- Per-player room description variants (Option B engine work) for a richer experience
- Gate the pre-landing grove → barren path (so pre-landing players can't walk onto the planet accidentally before the epilogue)

---

## Key Files for Context

- Story beats: `docs/game-design/seedship-forest-world/STORY.md`
- Grove design: `docs/game-design/seedship-forest-world/GEOGRAPHY.md`
- Planet plan: `docs/game-design/the-barren/PLANET-PLAN.md`
- Grove expansion (complete): `docs/game-design/the-barren/GROVE-EXPANSION.md`
- Implementation history: `docs/game-design/seedship-forest-world/IMPLEMENTATION.md`
- Architecture memory: `.claude/projects/-Users-raymondluong-dev-lokacore/memory/MEMORY.md`
- Quest YAML reference: `docs/builder-reference/`
- Pre-landing edge rooms (read before writing planet versions): `priv/world/prototypes/rooms/grove/edges/`
- Barren margin zone (read for barren context): `priv/world/prototypes/rooms/barren/margin/`
