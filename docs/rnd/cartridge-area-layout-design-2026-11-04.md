# Cartridge source by world area (design, loka-vduxr.58)

Design only. No repo file changes, no code. Paths below are in `~/dev/lokacore`.

## 1. Decisions at a glance

| Question | Decision |
|---|---|
| Unit of a file | One definition per file, as today. An area is a folder of the same definition dirs. |
| Folder shape | `areas/<area>/<dir>/<key>.json` (and `.scene`, `.cut`), one level. No `area.json`. |
| Shared layer | The root dirs (`rooms/`, `items/`, ...). No `shared/` folder. |
| Bundles | Kept. `areas/<area>.json` is the one-file form of the same area; it may sit beside the folder. |
| Zones | Merged. The folder name is an implicit zone of every room in it. Explicit `zones` stays for cross-cutting zones. |
| Cross-border rule | An area's file may name: its own area, the root, and any area's **rooms**. Nothing else. The root may name anything. |
| Keys | Global, unprefixed, as today. No prefix rule. |
| Text | Inline prose by default; root `text.json` for lines several areas share. No per-area text file. |
| Map | `layout.json` stays one root file. |
| Compiler errors | `SCHEMA_VIOLATION` with `data.why` `area_crossing` and `area_empty`, plus existing `UNKNOWN_FIELD`, `DUPLICATE_DEFINITION`. No new DiagnosticCode, so no protocol change. |
| Lint findings | `mix loka.lint`: orphan room, unreachable area, astray room. Not `bin/loka check`. |
| Index | Generated `areas/INDEX.md` and `areas/<area>/INDEX.md`, committed, kept fresh by `bin/regen.sh`. |
| `bin/loka new` | `--area <name>` places a file; `--from` joins the source room's area; `new area <name>` makes a folder. |
| Samplers | Stay flat. Both forms are legal in one cartridge. |
| Showcase | Migrated by a script, files moved byte for byte, `content_hash` unchanged (fixture proves it). |
| Artifact | Unchanged. Saves, loader, kernel untouched. |

## 2. What is there today (read-only findings)

- The source reader already walks the tree recursively: `lib/loka/content/source_files.ex:9` globs `**/*.{json,scene,cut}` and skips `checkpoints/`. Only `Loka.Content.Source.classify/1` (`source.ex:234`) refuses depth: it accepts `[dir, file]` and `["areas", name]`; anything deeper is `UNKNOWN_FIELD` (`docs/system/cartridge.md:306`).
- Diagnostic paths are built by `Source.at/2` from the relative path with `.json` stripped. A path such as `areas/hollow/rooms/spring.exits.north.to` renders plain today, since every segment is `[a-z0-9_]+`.
- Bundles open into `{rel, {kind, key, [dir, key]}, value}` (`areas.ex:44`). Zones take members from each room's `zones` list (`zones.ex:35`). Both are one-line changes away from "area of a file is its path prefix".
- The author tools read the tree recursively already: `kernel/ts/play/todo.ts:14` `files()` (used by `live.ts` `sourceOf`, `find.ts`). `coverage.ts` and `why.ts` read the artifact and `cartridges/<id>/transcripts/*.jsonl`. `check.ts` reads only `checkpoints/`. None of these depend on depth.
- Three places hard-code depth one: `lib/loka/content/starters.ex` (`rooms/*.json`, `areas/*.json`, `<kind>/*.json`, and `--from` needs `rooms/<room>.json`), `lib/loka/content/source_lines.ex:33` (`json_half` maps a `.scene` to `dialogues/<key>.json`), and `kernel/ts/test/source_schema.test.ts:26` (first path segment picks the schema).
- `mix loka.lint` names a bundled definition `<dir>/<key>.json` (`lint.ex:29-38`); the author panel maps that to a line.
- Explain's named cases are `SCHEMA_VIOLATION` with `data.why` (`explain.ex:259`). A new refusal needs a table row, not a new code. A new DiagnosticCode would touch `protocol/cartridge.schema.json` and bring `docs/lessons/contracts.md` (fixture per bound) and a second reviewer (`docs/WORKFLOW.md` Review count).
- The artifact keeps `layout` rows in file order (`layout.ex` `settings/2`). Splitting `layout.json` by area would reorder rows and change the hash.
- The showcase: 63 rooms, 42 NPCs, 139 items, 140 reactions, one `text.json` of 1719 keys (about 400 under shared prefixes: `narration` 238, `combat` 58, `condition` 32, `band` 15). No room has `zones`. No `.scene` files. Eight rooms have no exits at all and are reached by nothing: `storeroom`, `timber_yard`, `pond_deep`, `woodpile`, `larder`, `midden`, `stall`, `forge_back`. They are stock stores (crate, timber, fish, smith's goods). An orphan-room check must let a store through.
- Three NPCs walk between what will be areas (`tam`, `warden`, `wat`, `daily_schedule`). Populations list rooms (`goblins.json` `area: [goblin_pit, drill_yard]`). Quests reference nothing; dialogues and reactions reference quests.
- The showcase hash is pinned in `protocol/fixtures/toolbox_showcase_hash.json` (`ba5185a9...ca1e`) by `test/loka/content_showcase_test.exs` and `kernel/ts/test/showcase_fixture.ts`. That is the migration's oracle.
- Owner rules that bind this design: the owner writes every player-facing word (prose in examples is `~`); cartridges own numbers; pre-production, no backward compatibility (`docs/system/owner-rules.md:170`).

## 3. The layout

### 3.1 Folder and file granularity

One definition per file stays the unit. Reasons:

- Every tool already works per file: diagnostics (`file:line`), the author column's "open this line", `find`, `todo`, `bin/loka new` reruns, git diffs. A file-per-room-with-NPCs-inline would need a new source shape, a new flattening pass and a change to the index of every tool, for no gain the index (section 6) does not give.
- An LLM edits one definition without re-reading sixty. A human reads a folder listing and sees the area.
- The one-file area form already exists (the bundle). Keep it for small areas and samplers; do not invent a third shape.

The area folder:

```
cartridges/<id>/
  cartridge.json  facts.json  text.json  layout.json  resources.json  attributes.json
  rooms/ items/ npcs/ ...            root dirs: world-wide (shared)
  areas/
    INDEX.md                         generated
    hollow/
      INDEX.md                       generated
      rooms/  npcs/  items/  quests/  dialogues/  scenes/  reactions/  ...
    hollow.json                      optional: the same area, bundled
```

Rules:

- `areas/<area>/<dir>/<key>.json`, where `<dir>` is any definition directory of the Source layout table and `<area>` is a Key. `.scene` under `scenes/` or `dialogues/`, `.cut` under `scenes/`, as at the root.
- One level. `areas/a/b/rooms/x.json` is `UNKNOWN_FIELD` at `areas/a/b/rooms/x`. A sub-area is a `zones` entry, not a folder.
- Any `.json` directly in `areas/<area>/` is `UNKNOWN_FIELD` (existing behaviour of a `.json` outside a known place). Non-JSON files (`INDEX.md`, a `NOTES.md`) are ignored, as today.
- No `area.json`. Nothing in the artifact needs it, the folder name is the key, the index is generated, and a player-facing area name would be the owner's word with nowhere to go. If a room needs a region title later, that is a room field, not an area file.

### 3.2 The root is the shared layer

The PM sketch had `shared/` for definitions two areas use, and root files for world-wide things. These are the same thing with two spellings. The root dirs already exist and the compiler already reads them. Rule: **what one area uses lives in that area; what two areas use, or the whole world uses, lives at the root.** A `shared/` folder is `UNKNOWN_FIELD` like any other unknown path.

### 3.3 Bundles and zones: merge, do not replace

- `areas/<area>.json` stays legal and means "definitions of area `<area>`". `areas/hollow.json` and `areas/hollow/` may both exist; their definitions are one area. Two definitions of one kind and key across them are `DUPLICATE_DEFINITION` at both sites, as today. `speech_sampler` is unchanged.
- The folder (or bundle) name is an implicit zone. `Zones.expand` adds `<area>` to the member list of every room under `areas/<area>/` or in `areas/<area>.json`. A reaction `"zone": "hollow"` with no `on.room` copies once per Hollow room. Explicit `zones` on a room still works and may name any Key (`indoors`, `underground`, `hollow_east`). A room may list its own area's name in `zones`; it joins once (the existing `uniq`).
- The showcase has no `zones` and no reaction with `zone`, so the implicit zone adds no copy there and the hash stands.

### 3.4 Text and keys

- Words go inline, `{"prose": "~"}` where the key would go, lowered to `<kind>.<key>.<path>` as today. The owner fills the `~`. This is already the house direction (`docs/system/cartridge.md`, Inline prose; the hand-written prose decision).
- Lines several areas share (`combat.goblin_fled_north`, `condition.bleeding`, `narration.*`, `shop.bought`) stay in the root `text.json`. There is no per-area `text.json`: keys are global anyway, a second catalog file would only add `DUPLICATE_KEY` sites, and inline prose already puts an area's words beside its definitions.
- Keys stay global and unprefixed. The folder gives the area, `DUPLICATE_DEFINITION` guards uniqueness, keys cap at 64 and zone and behaviour copies append `_<room>` and `_<holder>` to them, so a prefix costs room. Where a name is generic (`well`, `gate`) the author may prefix by choice. The index answers "which `well`".
- The showcase keeps its hand-keyed `text.json`. Turning its keys into inline prose would rename them (`detail.sign_social.description` would become `room.village_green.details.sign_social.description`) and change the hash. Out of scope.

### 3.5 `layout.json` and the map

One root file, as today. Reasons: it is one drawing with world coordinates; its row order is in the artifact; the compiler's completeness check already covers every room wherever its file sits. The index lists each area's rooms with their `x, y, z` so an author sees the area's footprint without opening `layout.json`. Per-area layout files can come later behind a sort-by-room-key change, which would change the hash and needs its own reason.

### 3.6 Things that cross borders

The one rule (section 4) is: **rooms are the border.** Any file may name any room. Everything else is named only from its own area or from the root.

- **NPC that moves.** Its home `room` decides its folder. Its `daily_schedule`, a `patrol`, an `npc.move` step, an escort's destination may name rooms of other areas. If another area's reaction or dialogue names the NPC (`on.npc`, a role), the NPC is world-wide: move it to `npcs/` at the root. `tam`, `warden` and `wat` stay in their home areas; nothing outside names them.
- **Population.** Lives with its `home` room. Its `area` list may name rooms anywhere. Its `npc`, `item` and `corpse` templates live with it; if two areas' plans share a template, the template moves to the root.
- **Quest spanning areas.** The quest is named by its offer dialogue and its resolving reaction or dialogue. If those sit in two areas, the quest lives at the root `quests/`. Each area's dialogue names the root quest, which is allowed. The item carried across lives at the root (section 11.3).
- **Barrier between areas.** A barrier is named from both rooms' exits. Two areas name it: root `barriers/`. One area on both sides: that area.
- **Transport** (ferry, fast travel) between areas: root.
- **Statuses, skills, liquids, topics, structures, services**: world-wide by nature, root. An area may hold one when only that area names it.
- **Facts**: `facts.json` is root; no area rule. Fact names may follow the area by convention (`hollow.met_thera`).

### 3.7 `extends`, `abstract`, behaviours across areas

A parent (or behaviour) must be in the child's (holder's) area or at the root. A child in `areas/edge/` extending a parent in `areas/hollow/` is refused at `<src>.extends` (section 4). An abstract parent at the root is the normal shape for a family used by several areas (`npcs/wild.json` abstract, `areas/edge/npcs/wolf_thing.json` extends it). The check runs in `Extends.flatten` and `Behaviours.expand`, where both locations are known; it is the same `area_crossing` fault.

## 4. Ownership rule and compiler refusals

Definition: `area(rel)` is `<area>` for `areas/<area>/...` and `areas/<area>.json`, else `nil` (root). The rule, checked after `Resolve.expand` has turned short refs into full `DefinitionRef`s (the compiler's located definitions carry `rel`): a reference from a file with area `A` to a definition with area `B` is allowed when `A == nil`, or `B == nil`, or `A == B`, or the target kind is `room`. `extends`, `behaviours` and `zone` (a zone named after another area is a set of rooms, so it is allowed) follow the same rule at their own fields. Text keys and facts are root and are never checked.

| Case | Code | Path | data |
|---|---|---|---|
| A reference from area A to a non-room definition of area B | `SCHEMA_VIOLATION` | `<src>.<path to the ref>` (`areas/edge/dialogues/brennan_warns.choices.go_back.accept`) | `{"why": "area_crossing", "target": "quests/tend_fields", "area": "hollow"}` |
| `extends` or a `behaviours[i]` naming a parent or behaviour of another area | `SCHEMA_VIOLATION` | `<src>.extends`, `<src>.behaviours[<i>]` | same, `target` `npcs/wild` or `behaviours/spoils` |
| An area with no room (folder or bundle; counted after bundles open) | `SCHEMA_VIOLATION` | `areas/<area>` | `{"why": "area_empty"}` |
| A folder deeper than one area level, or a `.json` directly in `areas/<area>/`, or a `shared/` dir | `UNKNOWN_FIELD` | `areas/a/b/rooms/x`, `areas/hollow/notes`, `shared/items/water` | `{}` (existing) |
| One kind and key in two areas, or an area and the root | `DUPLICATE_DEFINITION` | each site | `{}` (existing) |

Explain rows (one sentence, one fix, existing style):

```
area_crossing | `{target}` belongs to the area `{area}`, and only that area and the root may name it. | Move {target} to the root folder of its kind, or move this file into areas/{area}/. Rooms may be named from anywhere.
area_empty    | The area `{field}` has no room. | Add a room under areas/{field}/rooms/, or move these files to the root folders of their kinds.
```

Severity: errors. They fail the compile, so `bin/loka dev --watch` keeps the last good artifact and names the fault, as for any other refusal. A warning would let a border quietly rot; the owner asked for solid checks.

Order in `Source.load`: open bundles, refuse repeats, flatten `extends` (area check on parents here), lower prose, expand behaviours (area check on behaviours here), expand zones (implicit zone added to members), split waits. The reference check runs in `Compiler` beside `Resolve.check`, after short refs expand. Each check is a fault tuple `{code, {rel, steps}, data}` as the other passes return; `Source` builds the diagnostic.

## 5. Lint findings (`mix loka.lint`)

These are structure findings, not shape errors, and some need judgment (a store room, a one-way cave). They go to `mix loka.lint`, which already is the content gate: exit 1 on any finding, run by CI on story cartridges against `test/loka/lint_baseline.txt` (which only shrinks), shown in the author panel after each compile. `bin/loka check` replays checkpoints and runs only for cartridges that have them, so it is the wrong home. The PM sketch put them in `bin/loka check`; this overturns that for those two reasons.

| Finding | Rule | Line |
|---|---|---|
| orphan room | No exit of any room and no transport destination names the room, the room is not the entry, and nothing is kept there (no item `location` in it, no NPC `room`, no population `home` or `area`, no replenish source, no structure site). | `areas/hollow/rooms/old_well.json: no exit or transport reaches this room and nothing is kept here; link it or delete it` |
| unreachable area | No exit or transport from a room outside the area (or the entry) reaches any room of the area. | `areas/deep: no exit or transport leads into this area; add an exit from another area's room` |
| astray room | A room with two or more exits, all leading to rooms of one other area. | `areas/hollow/rooms/thinning.json: every exit leads into areas/edge; move the file there, or add an exit within hollow` |

The showcase's eight store rooms keep stock, so they pass. Nothing new enters the baseline.

## 6. The generated index

`bin/loka index <cartridge dir>` writes `areas/INDEX.md` and `areas/<area>/INDEX.md`. It compiles the source (as `check.ts` does through `compiled.ts`), reads the artifact's full refs (the way `find.ts` `referrers` does), and takes each definition's area from its source path. It never reads prose. `bin/regen.sh` runs it for every changed cartridge; a stale index fails `REGEN_DIRTY`, like the other generated files (`docs/CHECKS.md:10`). An LLM reads `areas/INDEX.md` first, then the area it will touch.

`areas/INDEX.md`:

```
# Areas of <id> (generated by bin/loka index; do not edit)

| area   | rooms | npcs | items | quests | dialogues | reactions | other |
| hollow | 8     | 6    | 5     | 0      | 7         | 9         | 1     |
| edge   | 4     | 1    | 2     | 0      | 2         | 4         | 0     |
| (root) | 0     | 0    | 3     | 1      | 0         | 2         | 14    |

Borders (exit or transport): hollow --high_terrace north--> edge/thinning; edge --thinning south--> hollow/high_terrace
Entry: hollow/awakening_clearing
Root definitions named by two or more areas: items/water_skin (hollow, deep); quests/water_for_seren (hollow, deep); statuses/hungry (hollow, edge, deep)
Root definitions named by no area: statuses/afraid
```

`areas/hollow/INDEX.md`:

```
# hollow (generated by bin/loka index; do not edit)

## Rooms (8)
awakening_clearing (0,0,0) [entry]  exits: north healing_grove
healing_grove (0,1,0)  exits: south awakening_clearing, east heartwood
...
high_terrace (2,3,0)  exits: south heartwood, north -> edge/thinning

## NPCs (6)
thera @healing_grove
maren @high_terrace  schedule: 9 heartwood, 20 -> edge/thinning
...

## Items (5)
trowel @tending_fields ; herb_bag held by thera ; ...

## Dialogues and scenes (7)
thera_first (thera) -> then thera_rite ; kira_fields (kira) accepts quests/tend_fields ...

## Reactions (9)
first_fruit on story_point_reached ; wanderer zone:hollow (x8) ; ...

## Quests, barriers, populations, other (1)
quests/tend_fields  offered by kira_fields, resolved by reactions/trowel_found

## Crosses the border
Names other areas' rooms: maren.daily_schedule.20 -> edge/thinning ; high_terrace.exits.north -> edge/thinning
Named from the root: quests/water_for_seren <- dialogues/thera_water (accept)
Names the root: items/water_skin (thera_water), statuses/hungry (first_fruit)
```

Format rules: one line per definition, key first, `@room` for a placement, `->` for an outgoing cross-border name with `<area>/<key>`, `<-` for an incoming one. Counts in the header table. No prose, ever.

## 7. `bin/loka new`

- `bin/loka new area <name> [dir]` writes `areas/<name>/rooms/<name>.json` (a starter room) and the layout row. It replaces the present `areas` kind, which writes a bundle `areas/<name>.json` with one room (`starters/templates.ex:85`). Pre-production: the bundle starter goes.
- `--area <name>` after any pair places that pair's own file under `areas/<name>/<dir>/`. It refuses when the area has no room yet, except for `rooms`: `no rooms in areas/<name> yet: bin/loka new area <name> first`.
- `rooms <name> --from <room> <direction>` joins the new room to `<room>`'s area. `--area` with `--from` makes a border room on purpose. `--from` finds `<room>`'s file wherever it is (`rooms/`, `areas/*/rooms/`, a bundle), not only `rooms/<room>.json`.
- Placements: a starter that needs a room (an item, an NPC) takes the first room of its own area when `--area` is given, else the entry, as today.
- `scene <npc> <key>` writes under the NPC's area (`areas/<a>/scenes/<key>.scene`), or `scenes/` for a root NPC.
- Without `--area` and `--from`, a file goes to the root, as today. The "Still to write" footer says where each file went.

## 8. Samplers

Flat stays legal. A cartridge may be all root (every sampler), all areas, or both. A sampler is one mechanic, not a world, and moving 110 samplers buys nothing. `speech_sampler`'s bundle is already an area.

## 9. Migration of `toolbox_showcase`

A script, `bin/area_split.py <cartridge dir> <rooms.json>` (Python 3, stdlib only), kept in `bin/` for the next cartridge:

1. Input: `rooms.json`, a hand-written map room → area for all 63 rooms, from the district briefs in `docs/showcase/` (hub, `fell_road`, `tidewater`, `low_wardle`, `combat`, `homestead`, `economy_law`, `magic`, `traps`). Each store room goes with the area that stocks from it (`timber_yard` with homestead, `pond_deep` with the croft, ...). The script refuses an unmapped room.
2. Compile the flat tree once (`mix loka.compile`) and read every definition's full refs from the artifact.
3. Place each non-room definition: the set of areas it touches is its own room refs' areas plus the areas of the files that name it (rooms excluded from the count, per the rule). Exactly one area: it goes there. None or several: root. Iterate to a fixpoint (a quest's area depends on its dialogues' areas).
4. `git mv` each file. Bytes do not change. `text.json`, `facts.json`, `layout.json`, `cartridge.json`, `transcripts/` stay.
5. Compile the moved tree. The compiler's own `area_crossing` check is the placement oracle. Compare `content_hash` with `protocol/fixtures/toolbox_showcase_hash.json`; they must be equal, since no path enters the artifact (prose keys come from kind and key, zone copies from `zones`, which the showcase does not use). The script exits 1 on any difference and prints the first differing definition.
6. CI proves it again: `test/loka/content_showcase_test.exs`, `kernel/ts/test/showcase_fixture.ts`, the 30 transcripts, the sim pass and the walkthrough all run on the same bytes. The fixture is not regenerated.

Expected result, from today's references: three NPCs keep walking across areas (rooms, allowed); quests `carry_letter`, `errand`, `bounty` end at the root if their offer and resolution sit in two districts; shared statuses, skills, liquids, topics, structures and the death templates go to the root; most items, barriers, reactions and dialogues land in one district. The index then shows the showcase's borders for the first time.

## 10. What changes where

Compiler (Elixir), artifact unchanged:
- `lib/loka/content/source.ex` `classify/1`: accept `["areas", area, dir, file]` for `.json`, `.scene`, `.cut`; add `area_of/1`.
- `lib/loka/content/zones.ex` `members/1`: add the implicit zone.
- New `lib/loka/content/area_rules.ex`: the reference check and `area_empty`; `extends.ex` and `behaviours.ex` ask it about parents and behaviours.
- `lib/loka/content/explain.ex`: two rows.
- `lib/loka/content/source_lines.ex` `json_half/1`: the same-key JSON of a scene is beside it.
- `lib/loka/content/lint.ex`: `lint_rel` keeps an area file's real path; three findings.
- `lib/loka/content/starters.ex`, `lib/mix/tasks/loka.new.ex`: `--area`, `area` kind, `--from` across folders.
- `lib/loka/content/source_schema.ex`: no change (schemas are per dir). The `source.areas` bundle schema stays.

Tools (TypeScript):
- `kernel/ts/test/source_schema.test.ts`: walk `areas/<area>/<dir>/` and pick the schema by `<dir>`; walk `areas/*.json` as `areas`.
- New `kernel/ts/play/index.ts`; `bin/loka index`; `bin/regen.sh` runs it per changed cartridge.
- `bin/area_split.py`.
- No change: `live.ts`, `todo.ts`, `find.ts`, `check.ts`, `coverage.ts`, `why.ts`, `author.ts`, the author panel, `kernel/ts/src/`, `protocol/`, the loader, saves.

Docs:
- `docs/system/cartridge.md`: Source layout table (the area folder row, implicit zone, root as shared), Source shortcuts "Area bundles" becomes "Areas" with the refusal table above, Content reports gains the index.
- `docs/BUILDERS-GUIDE.md`: "An area in one file" row becomes "An area" (folder or bundle; `bin/loka new area`); a line: what two areas use lives at the root; read `areas/INDEX.md` first.
- `docs/guides/writing-the-game.md`: `--area` in "Every kind of content"; `bin/loka index`.
- `docs/guides/area-authoring.md`: rule 16, "A thing lives in the area that uses it; what two areas use lives at the root; rooms are the border."
- `docs/CHECKS.md`: the lint findings and the regen entry.
- `docs/SHOWCASE.md` Structure: the districts are area folders.

## 11. Worked examples

Prose is `~` throughout: the owner writes every player-facing word.

### 11.1 A small area: the Hollow, first slice (8 rooms)

```
cartridges/lira/
  cartridge.json            entry: awakening_clearing
  facts.json  text.json  layout.json
  items/water_skin.json     shared (section 11.3)
  quests/water_for_seren.json
  areas/
    INDEX.md
    hollow/
      INDEX.md
      rooms/   awakening_clearing.json healing_grove.json heartwood.json spring.json
               memorial.json tending_fields.json elder_hall.json high_terrace.json
      npcs/    thera.json maren.json kira.json tomas.json dov.json
      items/   trowel.json pendant.json herb_bag.json
      quests/  tend_fields.json
      scenes/  thera_first.scene kira_fields.scene maren_rite.scene
      reactions/ first_fruit.json trowel_found.json wanderer.json
```

`areas/hollow/rooms/high_terrace.json`:

```json
{
  "name": {"prose": "~"},
  "description": {"prose": "~"},
  "exits": {
    "south": {"to": "heartwood"},
    "north": {"to": "thinning"}
  }
}
```

`thinning` is in `areas/edge/rooms/`. A room may be named from anywhere, so this compiles. The index shows `north -> edge/thinning` under "Crosses the border".

`areas/hollow/reactions/wanderer.json` with `"zone": "hollow"` and no `on.room` copies once per Hollow room; no room lists `zones`.

### 11.2 A quest that spans two areas

Thera (Hollow) asks the player to carry water to Seren (Deep caves). Brennan (Deep) takes it.

```
quests/water_for_seren.json                       root: two areas name it
items/water_skin.json                             root: carried across
areas/hollow/scenes/thera_water.scene             quest: accept water_for_seren
areas/deep/scenes/brennan_takes_water.scene       quest: resolve water_for_seren ; gives nothing, takes water_skin
areas/deep/reactions/seren_drinks.json            on choice_resolved of brennan_takes_water; names quests/water_for_seren (root, allowed)
```

Had `water_for_seren.json` been left in `areas/hollow/quests/`, the compile stops:

```
error: areas/deep/scenes/brennan_takes_water.scene:7 `quests/water_for_seren` belongs to the area `hollow`, and only that area and the root may name it. Move quests/water_for_seren to the root folder of its kind, or move this file into areas/hollow/. Rooms may be named from anywhere.
```

### 11.3 A shared item

`items/water_skin.json` at the root:

```json
{
  "name": {"prose": "~"},
  "description": {"prose": "~"},
  "location": {"in": "spring"},
  "vessel": {"liquid": "water", "capacity": 2}
}
```

Its start room is in Hollow (a room, allowed from the root). Hollow's and Deep's dialogues name it (root, allowed). `liquids/water.json` is root too. The index lists `items/water_skin (hollow, deep)` under "Root definitions named by two or more areas".

### 11.4 Each refusal, as the author sees it

```
error: areas/edge/npcs/wolf_thing.json:2 `npcs/wild` belongs to the area `hollow`, and only that area and the root may name it. Move npcs/wild to the root folder of its kind, or move this file into areas/hollow/. Rooms may be named from anywhere.
error: areas/bestiary The area `bestiary` has no room. Add a room under areas/bestiary/rooms/, or move these files to the root folders of their kinds.
error: areas/hollow/notes.json:1 `notes` is not a field here. Remove it or fix its name.
error: areas/hollow/items/water.json:1 This name or key is already taken. Rename it. If no other file uses it, it is a built-in word such as a command (look, talk).
error: areas/deep/items/water.json:1 This name or key is already taken. Rename it. ...
```

And the lint lines:

```
areas/hollow/rooms/old_well.json: no exit or transport reaches this room and nothing is kept here; link it or delete it
areas/deep: no exit or transport leads into this area; add an exit from another area's room
areas/hollow/rooms/thinning.json: every exit leads into areas/edge; move the file there, or add an exit within hollow
```

## 12. Owner rulings needed

| # | Ruling | Recommendation |
|---|---|---|
| 1 | The root dirs are the shared layer; no `shared/` folder. | Yes. One spelling, already read by the compiler. |
| 2 | Border rule: an area names its own things, the root, and any area's rooms; all else crosses via the root. A compiler error, not a warning. | Yes. It mirrors the world (rooms are geography) and needs no per-kind list. |
| 3 | The folder name is an implicit zone; explicit `zones` stays. | Yes. One line in `Zones.expand`, removes a repeated list from every room. |
| 4 | No area-prefixed key rule. | No rule. Keys are global and capped at 64; the index disambiguates. |
| 5 | Orphan room, unreachable area and astray room are `mix loka.lint` findings, not `bin/loka check` refusals; a room that keeps stock is not an orphan. | Yes. Lint is the content gate with baseline and panel display; the showcase's eight store rooms show the exemption is needed. |
| 6 | Words inline by default; root `text.json` for shared lines; no per-area text file. | Yes. Already the house direction. |
| 7 | `layout.json` stays one root file. | Yes, for now. Row order is in the artifact. |
| 8 | Bundles stay as the one-file form of an area. | Yes. Samplers keep working; no third shape. |
| 9 | The index is generated and committed (`bin/regen.sh`, `REGEN_DIRTY`). | Yes. An LLM reads it before touching an area; stale copies are refused by CI. |
| 10 | Migrate `toolbox_showcase` now, hash unchanged. | Yes. It proves the rules on real content and gives the first real index. |
| 11 | Samplers stay flat; both forms are legal in one cartridge. | Yes. |
| 12 | Add no new DiagnosticCode (`SCHEMA_VIOLATION` + `why`). | Yes. A new code touches `protocol/`, needs a fixture per bound and a second reviewer, for the same message. |

## 13. Slice plan

| Slice | Size | Content | Review |
|---|---|---|---|
| S1 compiler | M | `classify` for area paths (`.json`, `.scene`, `.cut`), `area_of`, implicit zone, `area_rules.ex` (`area_crossing` in refs, `extends`, `behaviours`; `area_empty`), Explain rows, `source_lines.ex` `json_half`, `lint.ex` `lint_rel`, `source_schema.test.ts` walk, `cartridge.md` tables. Tests: a fixture tree per refusal (each a red control: remove the check, the test fails); a flat sampler compiles to the same bytes with one file moved into an area folder. | One fresh reviewer (engine change). No protocol change, so no second opinion. |
| S2 showcase migration | M | `bin/area_split.py`, the room map, the moves, index not yet. Gate: fixture hash equal, transcripts, sim and walkthrough green with no fixture regenerated. `SHOWCASE.md` Structure. | One fresh reviewer; the hash fixture is the oracle. |
| S3 lint and `bin/loka new` | S | Three lint findings (red control each; the showcase stays baseline-clean); `--area`, `area` kind, `--from` across folders; `writing-the-game.md`. | One fresh reviewer. |
| S4 index and docs | M | `kernel/ts/play/index.ts`, `bin/loka index`, `bin/regen.sh` entry, committed indexes for the showcase and `speech_sampler`; Builders' Guide, `area-authoring.md` rule 16, `CHECKS.md`. | One review on the final head (housekeeping and docs batch rule). |

Order: S1, S2, S3, S4. S2 before S3 so the lint findings are tested against a real area tree. S4 last because an index of a flat tree says nothing. Every slice leaves the artifact, saves and kernel untouched; a diff under `protocol/` or `kernel/ts/src/` in any of them is a finding.

## 14. Not checked, and risks

- I did not run the compiler or a trial move; the "same hash" claim rests on reading that no source path reaches the artifact (prose keys from kind and key, zone copies from `zones`, layout from the root file). S2's script verifies it.
- The room-to-district map for the showcase is hand work from `docs/showcase/*.md`; eight store rooms need a judgment each.
- The implicit zone changes the hash of any cartridge that already has a reaction with `zone` equal to an area or bundle name. Today none does (`speech_sampler` has no `zone` rule; the showcase has no `zones`). S1's test should pin this.
- `Explain` maps a path to a line by scanning the JSON; nested paths render the same way, but the `.scene` same-key JSON lookup (`json_half`) must change or an area scene's error points at a root file.
