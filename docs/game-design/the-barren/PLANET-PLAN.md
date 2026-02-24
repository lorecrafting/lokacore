# The Barren — Planet Design Plan

> **Status**: Design draft, awaiting approval before YAML implementation.
> **Date**: Feb 2026
> **Working title**: "The Barren" (the dying world the Ancestors were sent to revive).
> The planet's real name is discoverable in the Rusted City archive — it is the last thing
> written in the last record of the civilization that was here before.

---

## The Crystal Technology — Design Principles

The civilization built with crystal and dressed stone. Their technology was real and
advanced, but it operated through frequency, vibration, and resonance rather than
mechanism. It is never described as technology in any room description.

**How it appears in writing:**
- Warmth in stone that should be cold
- A faint tone at the edge of perception, or below it — felt in the chest or feet, not heard
- Light that behaves slightly wrong: more even than it should be, or briefly organized, or held
- A calm that is physical rather than emotional — the body settles before the mind does
- Your own voice returning to you differently in certain rooms
- Crystal panels that do something when light crosses them at a specific angle, briefly, without fanfare

**What it never is:**
- Explained
- Named ("ancient technology," "resonance system," "frequency device" — none of these appear)
- Dramatic or overwhelming — it is subtle, consistent, present
- Magical in the fantasy sense — it follows physical logic even if that logic isn't stated

**Thematic connection:**
The Pulse in the grove also operates through resonance. Rootspeakers feel it, not
think it. The civilization's crystal work is the same underlying phenomenon expressed
through mineral rather than biological material. Players who have completed the grove
arc will recognize the family resemblance without being told. Players who encounter
the Crystal City first will find it strange and compelling; players who arrive after
the grove arc will feel something familiar in the strangeness. Neither group is
wrong. The connection is real. It is never confirmed in dialogue.

---

## Overview

The planet is the MMO layer. Each player completes the grove arc solo, witnesses Thera's
full story, then steps through the opened edges onto a shared persistent world. The grove
becomes the home base — the green heart in the center of a vast, almost completely dead
planet that is now, finally, beginning to recover.

**Scale**: ~828 rooms total (108 grove + 720 planet across 6 zones).
**Tone**: Not post-apocalyptic dread. Old, quiet, enormous. Like an ocean that's been
empty for a hundred years — everything that was there is still there, just stopped.

---

## Entry Points from the Grove

Three exits open when `grove_epilogue` completes (post-landing flag):

| Grove Room | Direction | Planet Room | Notes |
|---|---|---|---|
| `the_edge` | north | `threshold_gate` | Main entry — membrane dissolves |
| `edge_east` | east | `eastern_threshold` | Eastern approach |
| `edge_west` | west | `western_threshold` | Western approach |

The three edge rooms get updated descriptions post-landing (same room keys,
flag-gated alternate text via room entry script).

---

## World Map — Zone Connectivity

```
                        [ZONE 5: Northern Wilderness]
                                    ↑ north (from Zone 2)
                        [ZONE 2: The Steppe Lands]
                         ↑ north (highlands)   ↑ east (ruins road)
              ┌──────────────────────────────────────────┐
              │          ZONE 1: THE BARREN               │
              │          (108 rooms, 8 sub-zones)         │
              │  [GROVE] → Margin → Plains → Highlands    │
              │             ↙          ↘         ↓        │
              │       Bone Forest   Rusted City  Deep Rift│
              │           ↓             ↓         ↓       │
              │       Salt Flats      (Zone 6)  (Zone 3)  │
              │           ↓                               │
              │          Shore                            │
              │           ↓ (west, far)                   │
              │        (Zone 4)                           │
              └──────────────────────────────────────────┘
                   ↓ east (Rusted City east road)
              [ZONE 6: Eastern Reaches]

              [ZONE 3: Deep Canyons] — down from Zone 1 Deep Rift
              [ZONE 4: Coastal Basin] — west from Zone 1 Shore
```

### Zone Gateway Rooms

| From Zone | Gateway Room | Direction | To Zone |
|---|---|---|---|
| Zone 1 Highlands | `highland_plateau` | north | Zone 2 |
| Zone 1 Rusted City | `ruins_north_road` | east | Zone 2 (alt) |
| Zone 1 Deep Rift | `rift_abyss` | down | Zone 3 |
| Zone 1 Shore | `shore_basin_edge` | west | Zone 4 |
| Zone 2 Far North | `steppe_northern_pass` | north | Zone 5 |
| Zone 1 Ruins | `ruins_east_road` | east | Zone 6 |

---

## ZONE 1: THE BARREN — 108 Rooms

The immediate landing area. Everything within a half-day walk of the grove.
The civilization's main city is here. The geological fault. The dead forest.
The former coastline. The highlands that look down on everything.

### Sub-Zone Overview

| Sub-Zone | Rooms | Location | Character |
|---|---|---|---|
| The Margin | 10 | Adjacent to grove edges | Transitional, roots spreading |
| The Ashen Plains | 17 | Central | Vast flat hub, former farmland |
| The Bone Forest | 14 | Northwest | Dead-but-standing trees, eerie |
| The Crystal City | 22 | East | Main civilization ruins — crystal and stone |
| The Highlands | 14 | North | Elevated, spectacular views |
| The Salt Flats | 12 | West | Former ocean floor, white expanse |
| The Shore of Gone Water | 9 | Northwest | Former coastline, beached ships |
| The Deep Rift | 10 | Underground | Geological fault, planet contact point |
| **Total** | **108** | | |

---

### SUB-ZONE 1A — THE MARGIN (10 rooms)

*The membrane is gone. The sky is real. The grove's roots are visibly pushing through
soil that has not been alive in a century. Everything is open. The wind is the first
wind any Tender has ever felt.*

```
[edge_west] ←west— western_threshold
                          |east
          [the_edge] ←south— threshold_gate —east→ eastern_threshold —west→ [edge_east]
                                   |north
                            threshold_path
                          |north        |east
                   threshold_ridge   margin_rootline
                          |north
                   threshold_summit
                          |north
                    margin_clearing
                          |west
                    margin_north_path
                          |north
               (→ ASHEN PLAINS: plains_south_entry)
```

| Room Key | Name | Description Notes |
|---|---|---|
| `threshold_gate` | The Threshold | Center point. First open sky. Wind. The membrane's seam still visible at the base. |
| `western_threshold` | The Western Threshold | Entry from edge_west. The old markings on the membrane (dates, tallies) are now on an exposed hull section. |
| `eastern_threshold` | The Eastern Threshold | Entry from edge_east. The hull stress fractures are visible from outside — not dangerous, just the evidence. |
| `threshold_path` | The Threshold Path | First steps away from the grove. Barren soil with a single root-line threading north. |
| `threshold_ridge` | The Threshold Ridge | Small rise. First time the grove is behind you and the planet is ahead. |
| `threshold_summit` | The Threshold Summit | Highest point of the margin. View south (grove), view north (plains). The scale of emptiness ahead first apparent. |
| `margin_rootline` | The Root Line | Active Seed Front. New roots pushing up through cracked soil. Seedlings 2cm tall. The grove's leading edge. |
| `margin_clearing` | The Clearing | Open ground, the first real wide sky. An old foundation in the middle — something was here once, small, domestic. |
| `margin_north_path` | The North Path | The natural walking route north. Worn already, which means others have been here. |
| `margin_overlook` | The Overlook | Slight elevation. Can see the grove canopy behind and the white plains ahead. Good landmark. |

---

### SUB-ZONE 1B — THE ASHEN PLAINS (17 rooms)

*The central transit zone of Zone 1. Flat, vast, formerly farmed. The civilization
grew food here for generations using irrigation technology that eventually failed.
Everything radiates from the plains: north to the highlands, east to the city, west
to the bone forest, down to the rift.*

```
(margin_north_path → south)
         plains_south_entry
               |north
         plains_south_mid ———east→ plains_east_spur (→ Rusted City approach)
               |north
         ashen_crossroads
         |N      |E      |W      |D
  plains_mid  ashen_east  plains_west  rift_mouth
         |N
  ashen_monument (standing stone — landmark)
         |N
  plains_north_mid
         |N        |E
  plains_north  ashen_northeast (→ Rusted City north approach)
         |N
  highland_foothills_south (→ HIGHLANDS)

  ashen_east (east branch):
  plains_east_spur → ashen_old_farm → ashen_canal → ruins_approach (→ RUSTED CITY)

  plains_west (west branch):
  plains_west → ashen_dust_field → ashen_ridge_approach → bone_forest_edge (→ BONE FOREST)

  additional rooms scattered through plains:
  ashen_grave_field (old burial site, near south)
  ashen_irrigation_ruins (failed infrastructure)
  ashen_cairn_row (navigational cairns, ancient)
```

| Room Key | Name | Description Notes |
|---|---|---|
| `plains_south_entry` | The Southern Plains | Entry from Margin. Flat begins here. |
| `plains_south_mid` | The Plains South | Ground covered in fine grey ash-like dust. |
| `ashen_grave_field` | The Grave Field | Rows of stone markers. Hundreds of them. Old. Not graves exactly — memorials. The civilization marked its losses publicly. |
| `ashen_crossroads` | The Plains Crossroads | The natural junction of all paths. Hub of Zone 1 navigation. Down here goes to the Deep Rift. |
| `plains_mid` | The Mid-Plains | Center of the plains. Nothing in any direction for a long walk. Vast. |
| `ashen_old_farm` | The Old Farm | Terracing visible, irrigation channels carved in stone. Precise engineering that simply ran out of water. |
| `ashen_canal` | The Dry Canal | A main irrigation artery, now just a stone trough 2m deep and bone dry. Runs east toward the city. |
| `ashen_monument` | The Standing Stone | 9-meter pillar, carved, still upright after centuries. Navigational marker. Inscribed with direction-reckoning in the old script. |
| `ashen_dust_field` | The Dust Field | Finer ground. Wind-rippled. Footprints don't last. Easy to lose direction. |
| `ashen_ridge_approach` | The Ridge Approach | Ground rises toward the bone forest ridge. |
| `ashen_northeast` | The Northeast Plains | Quieter branch. Longer route to the city. |
| `plains_north_mid` | The North-Mid Plains | Terrain beginning to texture. Rocks emerging. |
| `plains_north` | The Northern Plains | Final flat ground before the highlands rise. |
| `highland_foothills_south` | The Southern Foothills | Plains end. The highlands begin as a gentle rise. |
| `plains_east_spur` | The Eastern Spur | Branch east. The canal is visible from here running toward the city. |
| `plains_west` | The Western Reach | Branch west. The dead tree line of the bone forest visible in the distance. |
| `rift_mouth` | The Rift Mouth | A crack in the flat ground, 4m wide, dropping into dark. The descent. Down to the Deep Rift. |

---

### SUB-ZONE 1C — THE BONE FOREST (14 rooms)

*Northwest. Trees that have been dead for a hundred years but refuse to fall. Their
root systems are intact — they are standing in death the same way they stood in life.
The Pulse reaches here faintly because their roots once connected to the same deep
network the grove uses. The eeriest zone in Zone 1. The only living thing is grey
lichen on the north-facing bark.*

```
(ashen_ridge_approach / plains_west → east)
     bone_forest_edge
          |north
     bone_forest_path ——west→ bone_forest_west_track
          |north                    |north
     bone_forest_mid          bone_hollow (giant dead trunk, enterable)
          |north
     bone_forest_deep ——east→ bone_lichen_field (discovery: lichen glows faintly at night)
          |north
     bone_forest_clearing ——west→ bone_west_ridge
          |north                       |north
     bone_forest_heart           bone_salt_approach (→ SALT FLATS)
          |up
     bone_ridge_top ——north→ bone_ridge_north ——north→ shore_ridge_east (→ SHORE)

     additional rooms:
     bone_campsite (old campsite — previous people rested here)
     bone_stone_circle (deliberate stone arrangement, old)
     bone_deep_path (extends the forest)
     bone_far_north (northernmost forest room)
```

| Room Key | Name | Description Notes |
|---|---|---|
| `bone_forest_edge` | The Forest Edge | First dead trees. Still upright. Branches intact, stripped of leaves. |
| `bone_forest_path` | The Forest Path | Picking through trunks. Muffled sound — the dead wood absorbs rather than reflects. |
| `bone_forest_west_track` | The West Track | Quieter branch. More open. Older trees. |
| `bone_forest_mid` | The Mid-Forest | Densest part. The canopy of interlaced dead branches creates a lattice roof. Light is filtered grey. |
| `bone_lichen_field` | The Lichen Field | Patch of grey-green lichen on north-facing bark and rocks. The only biological life in the forest. Faintly bioluminescent in dark. |
| `bone_forest_deep` | The Deep Forest | Older growth. Trunks are larger, more widely spaced. The ground is soft with a century of bark debris. |
| `bone_stone_circle` | The Stone Circle | Eleven standing stones in a circle. Much older than the civilization. Pre-dates the city entirely. Something was happening here before them. |
| `bone_forest_clearing` | The Dead Clearing | A natural clearing. In the center, a sapling — still dead, but younger than the others. The last thing that tried to grow here. |
| `bone_west_ridge` | The West Ridge | Elevated ground. Looking west, the white expanse of the salt flats is visible. |
| `bone_forest_heart` | The Heart Tree | Largest tree in the forest. The root system at its base is massive, exposed. Something carved at the base — the old script again. It says something about water. |
| `bone_salt_approach` | The Salt Approach | Where the forest gives way. Ground whitens underfoot. The trees thin and stop. |
| `bone_ridge_top` | The Ridge Top | High point of the bone forest ridge. View east (plains, city), west (salt flats, former coast). |
| `bone_ridge_north` | The Ridge North | The ridge continues north. The shore is visible below and northwest. |
| `shore_ridge_east` | Shore Ridge East | Where ridge connects to the shore's elevated approach. |

---

### SUB-ZONE 1D — THE CRYSTAL CITY (22 rooms)

*East. The civilization's main settlement. Not dramatic ruins — the abandonment of
people who had time to leave carefully. They built in crystal and dressed stone,
and it has not crumbled. It has gone quiet. The city still stands almost completely
intact. Walking through it you feel — not see, not hear, but feel — a faint
something in the walls when you touch them. In certain rooms, at certain angles to
the light, the crystal panels still do what they were built to do. No one here
could tell you what that is. It is felt before it is thought.*

*Design principle: The ancient technology is never named, explained, or described
as technology. It manifests as: inexplicable warmth in cold stone, a faint tone
at the edge of perception, light that behaves slightly wrong, a calm that isn't
emotional but physical. Players encounter the effects, not the mechanism.*

```
(ashen_canal / plains_east_spur → west)
     ruins_approach ——east→ ruins_outer_road
          |east                    |east
     ruins_gate              ruins_residential_north
          |east                    |south
     ruins_outer_plaza      ruins_residential_south
          |east  |north
     ruins_square     ruins_market ——north→ ruins_market_north
          |east  |north
     ruins_resonance_hall    ruins_library ——north→ ruins_archive (KEY DISCOVERY)
          |east
     ruins_inner_plaza ——north→ ruins_residential_inner
          |east
     ruins_spire_base ——up→ ruins_spire_mid ——up→ ruins_spire_top
          |north
     ruins_north_district ——east→ ruins_east_quarter
          |north                      |north
     ruins_north_road (→ ZONE 2)   ruins_east_road (→ ZONE 6)

     additional rooms:
     ruins_crystal_plaza (large crystal panels — the most visually striking room)
     ruins_convergence (where multiple crystal channels meet — the "feel" is strongest here)
     ruins_temple_approach
     ruins_temple
```

| Room Key | Name | Description Notes |
|---|---|---|
| `ruins_approach` | The Road In | Old paved road approaching the city. The paving stones are translucent at the edges — crystal aggregate in the stone mix. The road catches and holds late light differently from ordinary ground. |
| `ruins_outer_road` | The Outer Road | The road rings the city's exterior. The walls here are thick with inlaid crystal veins in geometric patterns — purely structural, apparently. The patterns are too precise to be decorative. |
| `ruins_gate` | The City Gate | Archway, 14m tall. Built from large blocks of pale stone with crystal panels set into the arch at intervals. When you walk through, something shifts at the edge of your hearing — or your chest — briefly. Gone before you can name it. |
| `ruins_outer_plaza` | The Outer Plaza | The first open space inside the gate. The plaza floor is polished stone inlaid with crystal channels running in spoke patterns toward the center. Where the channels meet, the floor is warmer than it should be. |
| `ruins_residential_north` | The North Residences | Homes built from the same pale stone. Each doorframe has a single crystal panel set above the threshold — consistent, deliberate, every home. Small personal objects left in place: a carved stone figure, a child's cup. |
| `ruins_residential_south` | The South Residences | Slightly different construction period — the crystal work is more refined here. Later-generation craftsmanship. The inlay is finer. Someone was learning and getting better. |
| `ruins_square` | The Central Square | The city's heart. At center: a structure that might be a fountain, or might not be — a large crystal formation in a stone basin, the crystal unbroken, still clear. Whatever it was for, it was not decoration. The square is quiet in a way that feels deliberate. |
| `ruins_crystal_plaza` | The Crystal Plaza | The showcase. Large vertical crystal panels — 3m tall, set in frames of dark stone — line three sides of an open space. In sunlight, they do something with the light that cannot be exactly described. Not prismatic. More like the light is briefly organized. |
| `ruins_market` | The Market | Covered hall. The roof is partially crystalline — translucent panels that filter light to an even, directionless quality inside. Stalls have sealed containers, preserved goods. They left food. The crystal roof kept everything from degrading. |
| `ruins_resonance_hall` | The Resonance Hall | A civic hall unlike anything in the grove tradition. The walls are entirely inlaid with crystal in a dense overlapping lattice. When you stand in the center and breathe, you feel the exhale more than you should. The room does something with pressure, or sound, or both. The seats face a raised platform with a single large uncut crystal at its center. For gathering. For speaking. |
| `ruins_library` | The Library | The great library. The shelves are carved into the stone walls — nothing freestanding, nothing portable. Most are empty. What remains is inscribed directly into the stone and crystal panels set into the wall at reading height. The inscription cannot be removed. That was the intention. |
| `ruins_archive` | The Archive | *KEY DISCOVERY ROOM.* A separate structure, lower, built into the ground. The archive is entirely crystal-lined — the whole room, floor to ceiling. Everything inscribed here is embedded in crystal panels and has been stable for centuries. The last inscription: carved in a different hand from the formal records. Simpler. Direct. The planet's real name. And: "They will come from the sky. Preserve this for them." |
| `ruins_convergence` | The Convergence | Where multiple crystal channels from different parts of the city meet underground and surface here. You feel it standing anywhere in the room — a low, slow something in the soles of your feet. Not unpleasant. The Pulse feels close here, but different — older, less biological. |
| `ruins_inner_plaza` | The Inner Plaza | The city's original center, before it grew outward. An older stone, a different construction vocabulary. The crystal inlay here is minimal — early period, before they fully understood what they were working with. The understanding built over generations. |
| `ruins_temple_approach` | The Temple Approach | A processional path lined with tall crystal obelisks — uncarved, just shaped, set at precise intervals. Walking between them you pass through something at each gap. Not quite a sound. Not quite a feeling. A series of thresholds. |
| `ruins_temple` | The Resonance Temple | The ritual center. The interior is pure crystal and stone — no organic material. The ceiling is a single massive crystal panel through which the sky is visible, slightly blue-shifted. In the center of the floor, a depression filled with sand. The sand has been disturbed, repeatedly, over a very long time. This room was used constantly until it wasn't. |
| `ruins_spire_base` | The Spire Base | The city's tallest structure — a spire rather than a tower. The exterior is completely clad in crystal panels in a spiral pattern. At the base, looking up, the spiral seems to continue moving for a moment when you stop rotating your gaze. |
| `ruins_spire_mid` | The Spire Mid | Halfway up. The view is beginning. The crystal cladding outside is translucent here — you can see through the walls in a diffused way. The city is visible as shapes and channels of light rather than walls and streets. |
| `ruins_spire_top` | The Spire Top | The highest point in the city. Visible: the plains (south), the highlands (north), the bone forest (northwest), the salt flats (far west), the grove (small green dot, south). On clear days, Zone 2 terrain (north). The crystal structure at the very top catches the horizon light at dawn and dusk and does something brief with it — directs it, or amplifies it, or marks it. Once every dawn and dusk, briefly. |
| `ruins_north_district` | The North District | Northern district — workshops and production spaces. The crystal work here is functional rather than civic: tools, formed crystal pieces in various states of completion. They were still making things up until they left. The work on the benches stopped mid-process. |
| `ruins_north_road` | The North Road | Exit from the city heading north. The road surface here has crystal aggregate throughout — it catches light at any angle, makes the road glow faintly in low light. Connects north to Zone 2 (Steppe Lands). |
| `ruins_east_road` | The East Road | Exit east. The road is older here, the crystal aggregate worn down to flush with the stone. Long-used before the new east quarter was built. Connects to Zone 6 (Eastern Reaches). |

---

### SUB-ZONE 1E — THE HIGHLANDS (14 rooms)

*North. The planet's spine, at least in this region. Cold, rocky, clear. From the
peak, the entire Zone 1 landscape is visible at once — the grove a small green
patch far south, the city ruins east, the white flats west, the plains center.
The first sense of the planet's actual scale.*

```
(highland_foothills_south → south)
     highland_lower_path ——east→ highland_east_slopes
          |north                      |north
     highland_mid_path          highland_cirque (ancient frozen lake)
          |north
     highland_west_trail ——east→ highland_ridge
          |north                      |north
     highland_upper_path        highland_ridge_north
          |north
     highland_peak ——east→ highland_summit (360° view, landmark)
          |north
     highland_descent_north ——east→ highland_plateau (→ ZONE 2)
          |north
     highland_far_north ——north→ highland_zone2_gate (→ ZONE 2)

     additional rooms:
     highland_cairn_field (ancient navigational cairns)
     highland_cave (natural cave, shelter)
     highland_spring (only surface water in Zone 1 — snowmelt seep)
     highland_lookout_east (dedicated view point east over city)
```

| Room Key | Name | Description Notes |
|---|---|---|
| `highland_lower_path` | The Lower Path | The first real slope. Flat behind you, rising ahead. |
| `highland_mid_path` | The Mid-Path | Real mountain terrain begins. Fewer footprints here — most people stop at the peak. |
| `highland_cirque` | The Frozen Cirque | A sheltered depression. Permanent shadow. Old ice still present — a compressed snowpack that has survived centuries. This is water. The only exposed surface water in Zone 1. |
| `highland_ridge` | The Highland Ridge | The main east-west ridge. Exposed. Wind. The sensation of being genuinely small. |
| `highland_ridge_north` | The Ridge North | The ridge continues north. The view opens further. The Other Ship's faint light visible from here on clear days (Zone 2). |
| `highland_upper_path` | The Upper Path | Final approach to peak. Rock scramble. |
| `highland_peak` | The Peak | Near the top. The true summit is a short way east. Most NPCs and players call this "the peak." |
| `highland_summit` | The True Summit | Highest point in Zone 1. 360° view. Room description names what's visible in each direction. An orientation map in prose. A landmark everyone knows. |
| `highland_cairn_field` | The Cairn Field | Dozens of cairns of varying age. This summit has been a landmark for as long as anyone can count. The oldest cairns predate the city. |
| `highland_cave` | The Highland Cave | Natural shelter. Signs of use over many generations — the oldest markings on the cave wall are pre-civilization. |
| `highland_spring` | The Spring | Water seeps from a crack in the rock. A thin trickle. Real liquid water. The first the Tenders have seen outside the grove. |
| `highland_descent_north` | The Northern Descent | The far side of the ridge. The terrain changes. More vegetation remnants (Zone 2 is more recently alive). |
| `highland_plateau` | The Highland Plateau | A broad flat area behind the summit. The transition to Zone 2 begins here. |
| `highland_zone2_gate` | The Northern Gate | The pass. Zone 1 ends, Zone 2 begins. The terrain opens into the steppe. |

---

### SUB-ZONE 1F — THE SALT FLATS (12 rooms)

*West. What was an ocean floor. Completely flat, completely white, disorienting.
No landmarks — the horizon is identical in all directions. Ancient marine fossils
at the surface. Salt crystals up to 3 meters tall. The loneliest zone in Zone 1.
Getting lost here is genuinely possible.*

```
(bone_salt_approach → east)
     salt_flats_entry ——west→ salt_flats_mid
          |west                    |west
     salt_approach_south     salt_crystal_south
          |north                   |north
     salt_mid_east          salt_crystal_field ——north→ salt_crystal_north
          |north                   |north
     salt_north_mid         salt_flats_north ——north→ shore_south (→ SHORE)
          |north
     salt_flats_far ——west→ salt_flats_end (zone boundary, connects west)
          |north
     salt_flats_northwest → shore_basin_edge (→ ZONE 4 gateway)

     additional rooms:
     salt_fossil_field (marine fossils exposed at surface)
     salt_brine_pool (relic brine pool — liquid, but undrinkable)
     salt_depth_marker (old survey marker showing ocean floor depth)
```

| Room Key | Name | Description Notes |
|---|---|---|
| `salt_flats_entry` | The Flats Entry | Ground suddenly whitens. The crunch underfoot of salt crust. The smell is different. |
| `salt_flats_mid` | The Mid-Flats | The center of nowhere. Disorienting. The horizon the same in all directions. |
| `salt_crystal_south` | The Crystal Approaches | First of the large salt formations. Columns, branching. |
| `salt_crystal_field` | The Crystal Field | Dense formation of salt crystals up to 3m tall. White, geometric, beautiful. Navigating through them requires care — the spacing is irregular. |
| `salt_crystal_north` | The Crystal North | Northern edge of crystal field. More scattered. The formations decrease toward the former shoreline. |
| `salt_fossil_field` | The Fossil Field | Marine fossils right at the surface — shells, creatures, the detailed record of an ocean ecosystem. Extraordinary density. This was the seafloor. |
| `salt_depth_marker` | The Depth Marker | A carved stone pillar with notched markings. An old ocean-depth survey marker. This spot was underwater at a specific known depth. |
| `salt_north_mid` | The Northern Mid-Flats | Moving north toward the former shoreline. The terrain begins to have slight relief — old seafloor ridges. |
| `salt_flats_north` | The Northern Flats | The approach to the former shoreline cliffs. |
| `salt_flats_far` | The Far Flats | Furthest west on the flat ground. The only direction with any variation is north, where the old shoreline rises. |
| `salt_flats_end` | The Flats End | Former cliff edge looking down into the coastal basin. Zone 4 begins below. An extraordinary view of the dry ocean's depth. |
| `salt_flats_northwest` | The Northwest Flats | The coastal basin approach. Zone 4 gateway: `shore_basin_edge` is accessible from here. |

---

### SUB-ZONE 1G — THE SHORE OF GONE WATER (9 rooms)

*Northwest. The former coastline. The ocean retreated over a century, exposing this
gradually. Old harbor infrastructure stands in dry air. Ships that were docked when
the water left are still there, settled on the seafloor that is now open ground.
The shore holds the evidence of the civilization's end — when the water left,
they didn't leave. They stayed and watched it go.*

```
(bone_ridge_north / shore_ridge_east → south)
     shore_ridge ——south→ shore_cliff_north
          |south               |south
     shore_cliff_mid       shore_cliff_overlook (view of entire coastal basin)
          |south
     shore_descent ——east→ shore_mid
          |south              |south  |east
     shore_low           shore_dock   shore_ships
          |south              |south
     shore_south_reach  shore_basin_edge (→ ZONE 4 gateway)

     additional rooms:
     shore_harbor_ruins (old harbor infrastructure)
     shore_lighthouse (lighthouse, no longer at the water's edge)
```

| Room Key | Name | Description Notes |
|---|---|---|
| `shore_ridge` | The Shore Ridge | The elevated coastal bluff. Below and ahead: what was a harbor. |
| `shore_cliff_north` | The Cliff North | The former sea cliff face, now exposed. Layers of sediment visible — the history of the ocean level over millennia. |
| `shore_cliff_overlook` | The Cliff Overlook | Best view of the coastal basin from Zone 1. The former ocean floor extends for many kilometers west. |
| `shore_cliff_mid` | The Cliff Mid | Partway down the cliff face. The old waterline is visible as a horizontal stain 30m up. |
| `shore_descent` | The Descent | The path down to the former seafloor. Steep in places. Old stairs carved into the cliff. |
| `shore_mid` | The Former Shore | The old beach — pebbles, sand, tide pools (dry). The smell of old salt. |
| `shore_dock` | The Old Dock | Harbor infrastructure standing in dry air. The dock boards are intact, rotted to soft wood. The bollards still have rope through them. |
| `shore_ships` | The Beached Ships | Three ships resting on the seafloor, tilted. They were at anchor when the water left. The civilization apparently couldn't move them in time. Enterable. |
| `shore_lighthouse` | The Lighthouse | A lighthouse standing on what was a rocky promontory. Still has the lens mechanism. If lit, it would be visible from the highland summit. |

---

### SUB-ZONE 1H — THE DEEP RIFT (10 rooms, underground)

*Accessible via down from `rift_mouth` in the Ashen Plains. A geological fault.
Not a human-made space — the planet's own geology. The first contact between the
grove's descending roots and the planet's bedrock. The Pulse feels different here:
more geological than biological, slower, older. This is where Thera is reaching.*

```
(rift_mouth → up)
     rift_entrance ——north→ rift_passage
          |down                    |north
     rift_descent           rift_narrowing
          |down                    |north
     rift_deep ——east→ rift_side_chamber (discovery: ancient geological formations)
          |down  |west
     rift_chamber   rift_biolume (bioluminescent mineral formations — only light source)
          |down
     rift_abyss (gateway to ZONE 3 — down further)

     rift_heart (accessible from rift_chamber, going north)
     — where grove roots first contact planetary bedrock —
     rift_exit (up from rift_deep, emerges at plains_north — exit point)
```

| Room Key | Name | Description Notes |
|---|---|---|
| `rift_entrance` | The Rift Entrance | The crack in the plain's surface. Wide enough to descend carefully. The air below is cool and different. |
| `rift_passage` | The Rift Passage | The crack widens into a navigable fissure. Geological layers visible in the walls — compressed time. |
| `rift_descent` | The Descent | Steeper. The surface sounds fade. It gets quiet in a way the surface never is. |
| `rift_narrowing` | The Narrowing | Must turn sideways and work through. The rock has been here undisturbed for millennia. |
| `rift_deep` | The Deep Rift | Opens into the first substantial underground space. The scale is larger than expected. |
| `rift_biolume` | The Bioluminescent Wall | A wall of mineral that glows faintly — chemical reaction, not life. Cold blue-white light. Enough to see by. |
| `rift_chamber` | The Rift Chamber | The main underground space. Large enough to get lost in if you stray from the walls. The Pulse is perceptible here — from below, not above. |
| `rift_heart` | The Rift Heart | Where the grove's deepest roots first contacted this bedrock. A faint warmth in the rock. The Pulse is two-way here — going down as well as up. Thera's consciousness reaching into the planet's geology. |
| `rift_abyss` | The Abyss | The rift continues down. Far down. Too far to see the bottom. Zone 3 begins here (down). |
| `rift_exit` | The Rift Exit | A second way up — emerges at `plains_north` on the surface. The rift runs further north underground than the entrance suggests. |

---

## ZONE 2: THE STEPPE LANDS — 120 Rooms

**Connection to Zone 1**: North from `highland_zone2_gate` (main). East from
`ruins_north_road` (secondary, arrives at steppe eastern edge).

**Character**: Vast rolling grassland — dead now, but more recently alive than Zone 1.
The civilization grazed animals here, ran seasonal camps, built seasonal infrastructure.
The Other Ship landed here. Their Tenders are alive and present. This is where the
two communities first meet.

**Sub-zones**:
| Sub-Zone | Rooms | Character |
|---|---|---|
| The Transition | 12 | Highland to steppe, terrain change |
| The Open Steppe | 28 | Vast rolling dry grass, navigational challenge |
| The Dry River | 18 | Ancient river system carved into terrain |
| The Pastoral Ruins | 15 | Seasonal camp infrastructure, different from city |
| The Hot Springs | 14 | Geological activity, liquid water, first real warmth |
| The Other Ship | 18 | Second landing site, living community, different biome |
| The Steppe Caves | 15 | Underground cave system connecting to Zone 3 |
| **Total** | **120** | |

**Key discovery**: The Other Ship's Tenders have the records the city archive was missing.
The civilization had two settlements — the city (Zone 1) and a pastoral community here (Zone 2).
The full story requires both archives.

**Zone 2 → Zone 5 connection**: `steppe_northern_pass` (far north) → Zone 5 Northern Wilderness.

---

## ZONE 3: THE DEEP CANYONS — 115 Rooms

**Connection to Zone 1**: Down from `rift_abyss` (primary). Also accessible from Zone 2
via the steppe cave system.

**Character**: The underground geological realm. Vast subterranean canyons, underground
rivers (dry), cave systems extending for many kilometers. The deepest accessible points
on the planet. Bioluminescent life (fungi, mineral processes) — the only biology still
functioning underground. Ancient cave paintings on certain walls — pre-civilization,
and before that.

**Sub-zones**:
| Sub-Zone | Rooms | Character |
|---|---|---|
| The Canyon Rim | 18 | Surface level, looking down |
| The Canyon Descent | 15 | The way down into the main canyon |
| The Canyon Floor | 22 | Bottom of primary canyon, vast |
| The Underground River | 20 | Following the ancient water course |
| The Deep Caves | 22 | Bioluminescent, older life |
| The Geological Core | 18 | Deepest accessible, where Thera's roots reach |
| **Total** | **115** | |

**Key discovery**: The cave paintings. There were people here before the civilization
in Zone 1 — much older, different culture. And before them, evidence of a biological
period the planet had millions of years ago. The geological core shows the timeline
of the planet's entire history in compressed form.

**Zone 3 → Zone 2 connection**: Up from deep caves into steppe cave system.

---

## ZONE 4: THE COASTAL BASIN — 120 Rooms

**Connection to Zone 1**: West from `shore_basin_edge` (primary). Also accessible
from Zone 1 salt flats northwest.

**Character**: The former ocean floor, now exposed. The deepest point of the former
sea is now the lowest accessible terrain on the planet. Ancient reef structures
(fossilized) up to 30 meters tall. The civilization had a coastal/maritime culture
before the water retreated — their underwater structures and coastal cities are here.
Thermal vents still active in the deepest basin.

**Sub-zones**:
| Sub-Zone | Rooms | Character |
|---|---|---|
| The Shallow Basin | 18 | Former continental shelf, exposed |
| The Reef Fields | 20 | Fossilized reef structures, mazelike |
| The Deep Basin | 22 | Former deepwater, vast open floor |
| The Seafloor City | 22 | Coastal civilization's submerged city (now dry) |
| The Thermal Vents | 18 | Geological activity, some heat, mineral life |
| The Basin Depths | 20 | The absolute deepest point of the former ocean |
| **Total** | **120** | |

**Key discovery**: The seafloor city. The coastal civilization predates the inland
city (Zone 1) and was built partly for the ocean. When the water retreated over
a century, they moved inland — which is why the Zone 1 city has two architectural
periods. The seafloor city is the older half of the same story.

**Zone 4 has no further zone connections** — it terminates at the basin depths.
That might change if deep-sea content is added later.

---

## ZONE 5: THE NORTHERN WILDERNESS — 110 Rooms

**Connection to Zone 2**: North from `steppe_northern_pass`.

**Character**: Cold. Harsh. The planet's highest elevations. What was once a boreal
forest is now dead taiga — different from the bone forest (those were deciduous),
these are dead conifers, still standing, still fragrant in a faint resinous way.
Glaciers persist here. The most water anywhere on the planet, but frozen.
The Northern Peak is the highest point on the entire planet.

**Sub-zones**:
| Sub-Zone | Rooms | Character |
|---|---|---|
| The Cold Transition | 12 | Where steppe becomes tundra |
| The Dead Taiga | 22 | Ancient dead conifer forest |
| The Glacial Fields | 20 | Remnant ice, snowmelt streams |
| The Mountain Passes | 20 | High altitude, challenging terrain |
| The Northern Peaks | 18 | Highest ground, extreme conditions |
| The Ice Caves | 18 | Frozen underground, preserved specimens |
| **Total** | **110** | |

**Key discovery**: The ice caves. Preserved biological specimens — flora and fauna
from the planet's more recently alive period (within the last few thousand years).
The planet was not always this dead. Something happened. The ice preserves the
timeline. The specimens are intact enough to potentially revive — seeds of plant
species now extinct on the surface.

**Zone 5 is a terminus** — the northernmost zone. The Northern Peak is a landmark
visible from Zone 2 on clear days.

---

## ZONE 6: THE EASTERN REACHES — 125 Rooms

**Connection to Zone 1**: East from `ruins_east_road` (primary).

**Character**: The civilization's agricultural heartland — the vast network of
irrigation canals that made Zone 1's city possible originated here. A second,
smaller city, less crystalline than Zone 1 (more utilitarian, agricultural) but
with crystal work at key points: channel junctions, water distribution nodes,
grain stores. The crystal technology here was applied to practical problems.
Sacred/ritual grounds at the civilization's edge — and beyond that: the Eastern
Desert, where the land gives out entirely.

**Sub-zones**:
| Sub-Zone | Rooms | Character |
|---|---|---|
| The Canal Plains | 20 | The irrigation network's main arteries |
| The Second City | 22 | Smaller, more intact, agricultural focus |
| The Sacred Grounds | 18 | Ritual complex at civilization's edge |
| The Eastern Desert | 25 | Total aridity, the most barren zone |
| The Desert Towers | 15 | Ancient astronomical/navigational structures |
| The Aquifer | 25 | Underground groundwater system, still partly present |
| **Total** | **125** | |

**Key discovery**: The aquifer. Still contains water — ancient, deep groundwater
that the civilization tapped and eventually depleted. Not fully depleted. The grove's
roots could reach this if they extend east — and they will, eventually. The aquifer
discovery is the first sign that the planet's revival has a resource to build on.

**Zone 6 → Zone 4 connection**: The aquifer connects to the former coastal water
table. Deep underground, Zones 4 and 6 share geology (the aquifer feeds the
coastal thermal vents). A physical connection exists for players who explore both.

---

## Summary

| Zone | Rooms | Access | Key Discovery |
|---|---|---|---|
| Grove (expanded) | 108 | Starting area | — |
| Zone 1: The Barren | 108 | Grove edges (3 entry points) | The crystal archive: who was here, what they built, what happened |
| Zone 2: Steppe Lands | 120 | Zone 1 north (Highlands) | The Other Ship; the second half of the archive |
| Zone 3: Deep Canyons | 115 | Zone 1 underground (Deep Rift) | Pre-civilization cave paintings; the deep timeline |
| Zone 4: Coastal Basin | 120 | Zone 1 west (Shore) | The seafloor city; the older civilization |
| Zone 5: Northern Wilderness | 110 | Zone 2 north | Ice-preserved specimens; seeds of extinct life |
| Zone 6: Eastern Reaches | 125 | Zone 1 east (Ruins) | The aquifer; crystal-water infrastructure; the planet's surviving water |
| **Total** | **828** | | |

---

## Naming Note

The planet is called "The Barren" in the Ancestors' records — the dying world they
were sent to revive. But the civilization that was here had their own name for it.
That name is the last thing written in the `ruins_archive`, preserved specifically
for whoever found it: **"They will come from the sky. Preserve this for them."**

The planet's real name is a first-play discovery, worth finding. Players who reach
the archive unlock it for the whole server — it appears in the game's world header,
the maps, the lore — after someone has read it for the first time.

---

## Implementation Sequence

**Phase A** (First build): Zone 1 complete (108 rooms)
— Gets players out of the grove, establishes the planet, delivers the civilization story.

**Phase B**: Zone 2 (Steppe Lands, 120 rooms)
— Introduces the Other Ship, living NPCs from a different culture, the second archive.

**Phase C**: Zone 6 (Eastern Reaches, 125 rooms)
— Extends the civilization story east, introduces the aquifer mechanic.

**Phase D**: Zone 4 (Coastal Basin, 120 rooms)
— Opens the underwater world, connects the seafloor city to Zone 1's history.

**Phase E**: Zone 3 (Deep Canyons, 115 rooms)
— The underground arc, pre-civilization history, deep planet access.

**Phase F**: Zone 5 (Northern Wilderness, 110 rooms)
— End-game exploration content, ice specimens, the planet's distant past.

---

*Status: Awaiting approval. No YAML written yet.*
*Next step after approval: implement Zone 1 Phase A (108 rooms) in YAML.*
