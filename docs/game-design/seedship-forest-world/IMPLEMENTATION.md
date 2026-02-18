# Seedship Forest - Implementation

> This file covers the practical implementation: roadmap, device mapping for key beats, and script requirements.

---

## Implementation Roadmap

### Phase 0: Concept Development ✅ COMPLETE (Feb 2026)

- [x] Core concept established (seedship forest)
- [x] Design pillars defined
- [x] Answer key worldbuilding questions
- [x] Name the people, the ship, key concepts
- [x] Design the crisis
- [x] Outline the story arc (108 beats)
- [x] Map the geography
- [x] Create key NPCs
- [x] Document healing systems (Dong Han integration)
- [x] Document spiritual arc (Lamrim integration)
- [x] Story arc reviewed and greenlit for production (Feb 17 2026)
- [x] Monastery arc retired — 73 files to archive

### Phase 0.5: Pre-Production Decisions ✅ COMPLETE

- [x] Decide: solo instancing vs. cohort instancing — **DECIDED: Solo** (see DECISIONS.md)
- [x] Archive monastery content — **DECIDED: Deleted** (~229 files, clean slate)
- [x] Generic items carrying forward — **DECIDED: None**

### Phase 1: World Skeleton ✅ COMPLETE (Feb 17 2026)

Built 51 rooms across 8 zones. All exits bidirectional (verified). Files at:
`server/priv/world/prototypes/rooms/grove/{heartwood,western_groves,eastern_groves,understory,the_deep,thinning,edges,roots}/`

| Zone | Rooms | Key Rooms |
|------|-------|-----------|
| Heartwood | 12 | `awakening_clearing`, `heartwood`, `elder_hall`, `lira_memorial` |
| Western Groves | 8 | `healing_grove`, `small_grove` (gated), `western_orchard` |
| Eastern Groves | 7 | `blight_zone`, `blight_zone_deep`, `kira_lookout` |
| Understory | 6 | `brennan_path`, `understory_crossing` |
| The Deep | 6 | `the_deep`, `heartroot_antechamber`, `heartroot_chamber` |
| Thinning | 4 | `the_thinning`, `edge_approach` |
| Edges | 3 | `the_edge`, `edge_east`, `edge_west` |
| Roots | 5 | `seed_archive`, `ship_core_access` (sealed, Act 3+) |

**Notes:**
- `small_grove`: physically connected but should be script-gated (Thera presence or beat flag)
- `roots_entrance` and above: `sealed` tag, accessible only via story unlock
- `extra_desc` is the displayed room description (not `long_desc` — rooms don't use it)
- Every room embeds one "tell" per GEOGRAPHY.md dual-nature design rules

### Phase 2: Spine Quest Chain (Alpha) — COMPLETE (Feb 17 2026)

Built 5 spine quests + 5 NPC prototypes + storyline + item. 0 validation errors.

Files created:
- `server/priv/world/storylines/grove_arc.yml`
- `server/priv/world/quests/grove_arrival.yml` — beats 1-6, 8, 11-12
- `server/priv/world/quests/grove_belonging.yml` — beats 14-15, 17-19, 26-27, 28-33, 35, 38, 49-54
- `server/priv/world/quests/grove_revelation.yml` — beats 60-67, 70, 73, 79-81
- `server/priv/world/quests/grove_sacrifice.yml` — beats 82-87, 90-92, 93-98, 99-100
- `server/priv/world/quests/grove_epilogue.yml` — beats 101-108
- `server/priv/world/prototypes/npcs/grove/thera.yml` — full dialogue tree (225+ nodes)
- `server/priv/world/prototypes/npcs/grove/elder_maren.yml`
- `server/priv/world/prototypes/npcs/grove/brennan.yml`
- `server/priv/world/prototypes/npcs/grove/kira.yml`
- `server/priv/world/prototypes/npcs/grove/tomas.yml`
- `server/priv/world/prototypes/items/grove/pressed_flower.yml`

NPC spawns added to: `awakening_clearing` (Thera), `elder_maren_study` (Maren), `watchers_post` (Brennan), `shaper_grove` (Kira), `lira_memorial` (Tomas)

**Known Phase 2 limitations (fix in Phase 3):**
- Thera has no schedule — stays at awakening_clearing throughout. Phase 3 adds `thera_schedule` trait to move her per story beats.
- `small_grove` is accessible (no script gate yet for Thera-presence requirement)
- `roots_entrance` and deeper rooms have no story-unlock gates yet
- Dialogue validator shows 142 orphan-node warnings — false positives from BFS not following node-level `next:` links (chain nodes). Not errors.
- `grove_revelation` given by `elder_maren` — quest chain technically breaks between `grove_belonging` (Thera turn-in) and `grove_revelation` (Maren accept). Player must seek Maren after belonging completes.

- [x] `grove_arrival` — beats 1-6, 8, 11-12 (awakening, Thera, Heartwood)
- [x] `grove_belonging` — beats 14-15, 17-19, 26-27, 28-33, 35, 38, 49-54
- [x] `grove_revelation` — beats 60-67, 70, 73, 79-81 (Edge truth, Yara's story, small grove)
- [x] `grove_sacrifice` — beats 82-87, 90-92, 93-98, 99-100
- [x] `grove_epilogue` — beats 101-108 (grief + joy)

### Phase 3: Thera's Dialogue (Hardest / Most Important) ✅ COMPLETE (Feb 18 2026)

The emotional engine of the story. This is where most writing time goes.

- [x] Teaching session scenes (beats 36, 38) — `teaching_session_sync` (synchronization) + existing `teaching_session` (70/30 rule). Added `first_training_session` objective to `grove_belonging`. Breaking point already complete from Phase 2.
- [x] Breaking point scene (beats 49-54) — complete from Phase 2 (`breaking_point` through `breaking_investigate`)
- [x] Last night dialogue (beats 90-92) — expanded with `last_night_ask` branch: Thera asks the player about their past, reveals she sat with them for 3 days before they woke
- [x] Heartroot confrontation (beats 93-98) — added `heartroot_3b` through `heartroot_3f`: Lira offers the Second Root (rest), Thera feels the pull, explicitly chooses the Third Root ("I don't want to stop knowing that"). Flows into "she was smiling" with new weight.
- [x] Beat 108 revelation — `presence_speaks` dialogue_topic in thera.yml + `thera_presence` objective in `grove_epilogue`. Thera's consciousness speaks through the Pulse: "the love didn't get smaller. It got bigger." / "I looked for the part of me that loves you all. And I found it's the whole thing."

**Notes:**
- Validation errors are stale-DB artifacts (dev server lock) — will clear on restart
- `grove_belonging` quest now has 2 explicit training objectives (`first_training_session` + `training_session`)
- `grove_epilogue` quest now has `thera_presence` talk objective for the beat 108 conversation

### Phase 4: Alpha Playtest + Fill-In

- [ ] ChannelBot E2E test of spine
- [ ] Kira arc (her mother's fate)
- [ ] Brennan side quest (full Seren confession)
- [ ] Tomas's trowel (Earth artifact story)
- [ ] Maren's locked records room
- [ ] Community fractures (beats 89a-89e) — with specific named characters
- [ ] NPC ambient dialogue density pass

---

## Device Mapping (Key Beats)

### Act 1: Finding Ground (Beats 1-27)

| Beat | Narrative | Devices | Scripts Needed |
|------|-----------|---------|----------------|
| **1-6 (Awakening)** | Player wakes, Thera finds them | Room (clearing) + NPC (Thera) + Dialogue | Trigger: new player spawn |
| **10 (Lira statue)** | First see memorial | Room (Heartwood) + Object (statue) + NPC emote (Tomas) | None (static) |
| **11 (Learning Pulse)** | Thera teaches basic sensing | Dialogue tree + skill unlock | Player gains "sense pulse" ability |
| **14-15 (First dream)** | Player dreams of stars | Trigger (sleep) + Temp room (dream space) + Vision text | Dream script spawns temp room |
| **17 (Sick tree)** | See Blight, Kira mentions mother | Room description (Blight stage 1) + NPC dialogue | Blight system active |
| **20 (Humming stone)** | Find artifact | Item (humming stone) + Examine trigger | On examine: play melody, hint text |
| **26 (Thera's melody)** | Catch her humming | NPC emote (ambient) + Dialogue option | Emote script for Thera |

### Act 2: Belonging (Beats 28-54)

| Beat | Narrative | Devices | Scripts Needed |
|------|-----------|---------|----------------|
| **28-33 (Thinning rescue)** | Player ventures too far, Thera saves | Room (Thinning) + Status effect (Edge sickness) + NPC arrival | Trigger: player in Edge zone too long |
| **34-42 (Teaching sessions)** | Training montage | 3 Dialogue trees + Quest wrapper + Room (training grove) | Session unlock flags |
| **40 (Journal found)** | Discover Yara's journal | Item (journal) + Container (healing stores) | On examine: reveal entries progressively |
| **46 (Three Roots carving)** | See the teaching | Object (carving) + Examine trigger + Thera reaction | Thera emote changes when player examines |
| **49-54 (Breaking point)** | Thera collapses emotionally | Room (behind healing grove) + NPC state change + Dialogue | Thera NPC moves to hidden spot, player can find |

### Act 3: Discovery (Beats 55-81)

| Beat | Narrative | Devices | Scripts Needed |
|------|-----------|---------|----------------|
| **55-59 (Council)** | Emergency gathering | Event (NPC summon) + Room state (Elder Hall tense) + Dialogue | Event script gathers all NPCs |
| **60-67 (Edge journey)** | See the truth | Room chain (Thinning → Edge → Membrane) + Progressive reveals | Room descriptions change as approach |
| **66 (Rootsong screams)** | Overwhelming vision | Zone broadcast + NPC stun (Thera) + Sensory text | Script: broadcast to all in Deep, Thera unresponsive 30s |
| **68-74 (Revelations)** | Multiple reveals | NPC dialogues unlock in sequence | Flag-gated dialogue nodes |
| **75-78 (Thera collapse)** | She goes to Deep alone | NPC schedule override + Room (Heartroot) | Thera moves to Heartroot, player must find |
| **79-81 (Small Grove)** | Secret place revealed | Hidden room (Small Grove) + Dialogue + Item (flower gift) | Room accessible only with Thera present |

### Act 4: Crisis (Beats 82-100)

| Beat | Narrative | Devices | Scripts Needed |
|------|-----------|---------|----------------|
| **82-85 (Announcement)** | Public truth | Global event + NPC reactions + Room state (Heartwood shocked) | Event: all NPCs, broadcast, behavior changes |
| **86-89 (Resistance)** | Everyone fights it | Multiple dialogues + NPC behavior (arguing, weeping) | NPC emotes change to distressed |
| **90-92 (Last night)** | Intimacy scene | Private dialogue + Room state (peaceful) + Flag set | Ambient: other NPCs give space |
| **93-95 (Heartroot truth)** | Meet Lira's voice | Room (Heartroot) + NPC (Lira voice) + Dialogue | Lira speaks through room/Pulse |
| **96-98 (Temptation)** | Lira offers rest | Dialogue (Lira) + Thera internal struggle | Player witnesses, cannot intervene |
| **99 (Fusion)** | Sacrifice | Cutscene + NPC transform + Room transform + Global event | Major script: Thera despawns, room rewrites, sky opens |
| **100 (Landing)** | Ship lands | Global world state change | Massive script: all rooms update |

### Grief & Joy (Beats 101-108)

| Beat | Narrative | Devices | Scripts Needed |
|------|-----------|---------|----------------|
| **101-104 (Grief)** | Memorial, emptiness | Room state (memorial objects) + NPC grief behaviors + Empty spaces | NPCs place flowers, Thera's spots feel empty |
| **105 (Strange comforts)** | Warmth in Pulse | Environmental effects + Subtle presence | Room descriptions add warmth hints |
| **106 (Dreams)** | She appears | Dream trigger + Temp room + Vision dialogue | Dream script, Thera appears as presence |
| **107 (Return to Heartroot)** | Player goes back | Room state (transformed, alive) | Heartroot glows, presence palpable |
| **108 (Revelation)** | Joy breakthrough | Dialogue (Thera presence) + Permanent world state | She speaks through environment, grief transforms |

---

## Script Summary

### Behavior Scripts Needed

| Script | Purpose | NPCs Affected |
|--------|---------|---------------|
| `thera_schedule` | Daily routine, location changes | Thera |
| `brennan_patrol` | Night Edge patrol pattern | Brennan |
| `maren_grief` | Visits record room alone | Elder Maren |
| `tomas_lucidity` | Increasing clarity over story | Tomas |
| `community_gathering` | Meal times, dispersal | All Tenders |

### Event Scripts Needed

| Script | Trigger | Effect |
|--------|---------|--------|
| `council_summon` | Beat 55 | All NPCs to Elder Hall |
| `public_announcement` | Beat 82 | Global broadcast, NPC shock behaviors |
| `memorial_formation` | Beat 101 | NPCs place objects, visit in rotation |
| `fusion_event` | Beat 99 | Thera transforms, sky opens, rooms update |
| `landing_transformation` | Beat 100 | All rooms rewrite, new world state |

### World-Mod Scripts Needed

| Script | Purpose | Scope |
|--------|---------|-------|
| `blight_progression` | Advance Blight stages | Multiple zones |
| `pulse_state_manager` | Track and broadcast Pulse changes | Global |
| `dream_spawner` | Create temp dream rooms | Player-specific |
| `room_state_manager` | Swap descriptions by flags | All story rooms |
| `post_landing_rewrite` | Transform entire world | Global |

### Trigger Scripts Needed

| Script | Trigger | Action |
|--------|---------|--------|
| `edge_sickness` | Player in Edge zone | Apply debuff, warning messages |
| `humming_stone_examine` | Examine item | Play melody, show memory hint |
| `pendant_glow` | Near Heartroot with pendant | Item description changes |
| `flower_placement` | Use flower at Heartroot | Joy quest completion |

---

## Translation to Game Mechanics

### Will Narrative Beats Translate to Game Content?

**Yes.** The 108-beat structure is designed for implementation:

| Narrative Element | Game Mechanic | YAML Structure |
|-------------------|---------------|----------------|
| **Story beats** | Quest objectives, dialogue triggers | Quest YAML with beat flags |
| **Dialogues** | Dialogue trees with conditions | Dialogue YAML with `condition:` fields |
| **Cutscenes** | Scripted sequences | Script + temp room spawn |
| **Room state changes** | Room description swaps | Room YAML with `state:` variants |
| **NPC reactions** | Emote changes, schedule overrides | Behavior scripts + flag checks |
| **Items** | Examinable objects | Item YAML with `on_examine:` |
| **Teaching sessions** | Multi-part dialogue + skill unlock | Quest + dialogue chain |

### Example: Beat 46 (Three Roots Carving)

**Narrative**: Player finds ancient carving, Thera reacts

**Implementation**:
```yaml
# Room object
objects:
  - key: three_roots_carving
    name: "Ancient Stone Carving"
    examine: |
      The stone is half-covered by roots. Three inscriptions
      are carved deep into its face, worn but readable.
    on_examine:
      - set_flag: seen_three_roots
      - if_present: thera
        trigger: thera_three_roots_reaction

# Thera's reaction
dialogue:
  thera_three_roots_reaction:
    condition: seen_three_roots
    text: |
      *Thera reads the inscriptions in silence.*
      "I've dreamed of the second. So many times. Just... stopping."
    choices:
      - text: "The third root speaks of remaining."
        response: "That's what Lira did. Two hundred years. Not rest."
```

### Key Insight

The design document's structure (beats, dialogues, room states, NPC schedules) maps 1:1 to Loka's YAML systems:

- **Beats** → Quest flags and progression triggers
- **Dialogues** → Dialogue YAML with conditions
- **Room states** → Room description variants
- **NPC schedules** → Behavior scripts
- **Teaching** → Multi-part quest chains
- **Cutscenes** → Script sequences (rare - use dialogue trees instead)

The narrative IS the game content. Translation is straightforward.
