# Seedship Forest - Key Decisions

> Session notes on design decisions, their rationale, and outstanding open questions.

---

## 2026-02-17 - Production Greenlight Session

### Context

Full review of the 108-beat arc and a go/no-go assessment for moving to content production.

**Verdict: Greenlit.** The story structure is strong enough to build. The foreshadowing weave, the Three Roots thematic coherence, and beat 108's philosophical landing are all above the bar. The story earns its emotional payoffs.

---

### Decision 1: Multiple Grove Ships (MMO Repeatability Solved)

**Problem:** The central story — Thera's sacrifice — is a one-time unrepeatable event. A traditional MMO server would lock out new players from the full emotional experience.

**Decision:** The Grove is not a single shared world. It is a starting experience:
- Every new player (or small cohort) begins on their own seedship
- They live through the full 108-beat arc, which terminates with a landing
- They arrive on the planet carrying their history — they *witnessed* Thera's sacrifice
- The planet is the persistent shared MMO world where all players converge

**Why this works:**
- Repeatability: every player gets Thera's full arc
- MMO convergence: everyone eventually lands on the same planet
- Lore variety: different ship types (forest, ice, reef, etc.) can use the same 108-beat structural framework with different flavor, functioning as soft class/origin selection

**Instancing: Solo.** Each player gets their own Grove ship instance. Players trickle in individually rather than being grouped into cohorts.

Why this works:
- The Grove's emotional intimacy (Thera's attention, the breaking point, the last night) is cleaner solo — no concurrency problems, no "who does she love?" ambiguity
- The NPC community (Tomas, Kira, Maren, Brennan, the Tenders) provides the liveliness, not other players
- The planet post-landing is where the social MMO layer lives — the Grove is prologue, not the main world
- Simpler to build: no shared world-state sync within the Grove instance

---

### Decision 2: Monastery Arc Retired

**Decision:** The monastery arc and all associated content will be archived, not deleted.

**What gets archived (73 files):**
- 1 storyline (`monastery_arc.yml`)
- 11 quests (5 main + 6 side)
- 2 zones (monastery, whispering_caverns)
- 2 cutscenes
- 16 rooms
- 25 NPCs
- ~10 items (some generic items like prayer_beads may be reused in Grove context)

**Approach:** Move to `archive/monastery-arc/` branch or directory, following the pattern used for the old WorldBuilder GUI (`archive/old-world-builder`). Infrastructure (quest system, dialogue system, YAML loader) is untouched — only content changes.

---

### Decision 3: Spine-First, Fill Later

**Decision:** Build a ~38-beat MVP spine first. Post-alpha, fill in the remaining beats as side content.

**The Alpha Spine (38 beats):**

| Act | Beats | What It Contains |
|-----|-------|------------------|
| Act 1 Arrival | 1-6, 8, 11-12, 14-15, 17-19, 26-27 | Awakening, Thera, Heartwood, the Blight, the melody |
| Act 2 Belonging | 28-33, 35, 38, 49-54 | Rescue/cost, one teaching session, Lira statue, breaking point |
| Act 3 Discovery | 60-67, 70, 73, 79-81 | Edge truth, Yara's story, the stakes, the small grove |
| Act 4 Crisis | 82-87, 90-92, 93-98, 99-100 | Announcement, player fails to substitute, last night, fusion, landing |
| Grief + Joy | 101-108 | All 8 — non-negotiable, this is the payoff |

**Post-alpha fill-in (deferred):**
- Kira's full quest arc (her mother's fate)
- Brennan's side quest (full Seren confession)
- Tomas's trowel (Earth artifact story)
- Maren's locked records room
- Act 1 "Seeds and Mysteries" ambient beats (16, 20-22)
- Act 4 community fractures (89a-89e)
- Most "Conflicts" deep-dive scenes from the Conflict Map

---

### Narrative Weaknesses to Address in Production

These were identified during review — worth flagging for writers:

1. **Act 4 moves too fast.** The last night (beats 90-92) is the emotional centerpiece of the whole story. Three beats is not enough. Plan for this to be significantly expanded in dialogue.

2. **Player agency in Act 4 needs selling.** The player physically cannot change the outcome. This needs to be *felt* as a meaningful choice to be the witness, not experienced as the story blocking them. Lira's line ("you are the witness... without you, her story dies") needs to land hard.

3. **Beats 89a-89e are generic.** "Some refuse to believe" / "someone shouts blame" — if these make the alpha cut, they need specific named characters, specific lines. Generic crowd reactions waste the narrative investment of Acts 1-3.

4. **Tomas needs a quirk.** "Wise elder with dementia who has lucid moments" is a template. Give him a specific obsessive behavior or speech pattern that makes him feel like a person first.

---

### Decision 4: Content Deletion — World Content Only

**Decision:** Delete all monastery/world content. Keep engine infrastructure.

**Deleted (~229 files):** all quests, zones, rooms, NPCs, items, cutscenes, storylines, recipes, foraging nodes, combat config, and all non-trait world scripts.

**Kept (66 files):**
- `prototypes/_base/` — base templates EntitySeeder uses to spawn anything
- `scripts/traits/` — 12 behavior trait scripts (patrol, wander, guard, etc.) — engine-wide, not world-specific
- `skills/` — 25 skill YAML files (engine-defined, see below)
- `statuses/` — 13 status effects
- `config/` — day/night, weather, ambient messages, sound mappings
- `resources/` — mana.yml, mv.yml
- `socials.yml`

**Rationale:** Clean slate to build all world content to V2 standards from scratch. The Grove story is the first world — nothing from the monastery is worth porting.

---

### Decision 5: Skills Are Engine-Defined (YAML), Not Script-Defined

**Decision:** Skills stay as YAML entity definitions, not sandboxed scripts.

**Why:** Skills have structured mechanical contracts (cost, stat, effect type, cooldown, trainers) that the engine validates and enforces. Moving them to scripts would mean re-implementing all of that in sandboxed Elixir strings — fragile for something this foundational.

**The division:**
- **Engine-defined YAML**: skills, statuses, resources — structured mechanical contracts
- **Script-defined**: traits, NPC behaviors, room events, quest hooks — flexible custom logic per entity

---

### Decision 6: Grove Skills vs. Planet Skills

Of the 25 surviving skill YAMLs, 8 are relevant to the Grove. The rest are combat/magic and belong to the planet layer.

**Grove skills (active now):**

| Skill | Role in Grove |
|-------|---------------|
| `forage` | Core Tender identity — living by tending the forest |
| `first_aid` | Thera is a healer; players learn basic medicine |
| `meditate` | Pulse sensing and spiritual practice — central to story |
| `meditation` | Advanced heal bonus — fits the healing philosophy |
| `sneak` | Beat 61: sneaking past Brennan's patrol to the Edge |
| `sprint` | Exploration and movement |
| `climb` | Vertical terrain — the Thinning, Deep, mountain areas |
| `focus` | Advanced Pulse skill (prereq: meditate) |

**Planet-layer skills (dormant, don't touch yet):**
All combat skills (bash, kick, thrust, disarm, combo_strike, parry, dodge_skill, agility, endurance, toughness, strength_training, intimidate), all magic skills (dispel, mana_shield, quickcast, ward), and commerce skills (haggle).

**Trainer refs to fix when building Grove NPCs:**
- `meditate` — trainer currently `monastery_elder`, update to `thera` or `elder_maren`
- `forage` — trainer currently `herbalist`, update to a Grove Tender NPC

---

## Open Questions (As of 2026-02-17)

| Question | Options | Status |
|----------|---------|--------|
| Solo vs. cohort instancing | Solo (narrative control) / Cohort 10-30 (social bonds) | **DECIDED: Solo** |
| Grove ship variety timing | Build one grove type first / Design all variants before building | Recommendation: one first |
| Monastery archive method | Git branch / Directory move / Both | **DECIDED: Deleted** |
| Generic item reuse | Which monastery items carry to Grove | **DECIDED: None — full clean slate** |
