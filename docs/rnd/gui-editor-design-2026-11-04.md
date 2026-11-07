# GUI editor: every mechanic with create, edit and delete (design, loka-wfrgk.1)

**Amended 2026-11-04** by the [authoring editor plan](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md)
(the owner's planning session and a Fable audit). Where they differ, the record wins: the layout is
three columns, the order and slices are new (section 9), and section 11 lists the technical changes.
Section 8 marks each ruling kept or changed.

Design only. No code, no repo changes beyond this file. Paths are repo-relative; `file:line` is main
at `6391c1f7a`. Owner goal (2026-11-04, paraphrased): a world-class GUI editor where every mechanic
eventually has a hand-built way to create, edit, update and delete it; contextual actions count;
schema-generated forms are at most a bootstrap. Constraints that bind every section: the owner
writes every player-facing word (the editor never generates prose); the cartridge source files are
the single truth; the compiler is the validator.

## 1. Decisions at a glance

| Question | Decision |
|---|---|
| Where editing happens | Three surfaces, one selection: contextual actions in the Book (`?dev=1`), the Map tab (loka-vduxr.52), and one Edit tab in the existing right pane holding the selected definition's card. No third column. |
| Unit of editing | A definition file (one card) made of mechanic blocks (one per declaration a capability reads). A block is hand-built or, until built, generic from `schemas/source/defs.schema.json`. |
| Fallback | Generic blocks are a bootstrap, not the destination: every generic block is a row in a baseline file that may only shrink, like `test/loka/lint_baseline.txt`. |
| Write path | The watcher (`kernel/ts/play/live.ts`) gains write routes. A structural edit re-serializes the one file with `JSON.stringify(v, null, 2) + '\n'`; `.scene` and `.cut` take line edits only (loka-vduxr.53). No format-preserving JSON dependency. |
| Conflict safety | Whole-file `was` (sha256 of the bytes the card loaded) on every write; a mismatch is refused with the current bytes, the card reloads. No merge. |
| Undo | A watcher-memory journal (`before` bytes per write, `POST /undo`), plus git. No history UI. |
| Create | `mix loka.new` through the watcher (`lib/loka/content/starters.ex`): placeholders, capability lock, layout row, `--area` and `--from` come free. |
| Delete | A file: refuse-or-confirm by referrer count (`find.ts` referrers), then `rm`; the compiler's `UNRESOLVED_REFERENCE` lines land on the referrers' cards. A block: a JSON path delete. |
| Compiler refusals in place | `mix loka.compile --json` emits each Diagnostic (`code`, `path`, `rel`, `line`, `words`) beside today's lines; the card shows a refusal at its field by `path`. No protocol change: Diagnostic already carries `path`. |
| Rename a key | Out of scope for v1 (every referrer and checkpoint changes). The card shows referrers and refuses. |
| Prose | Only through the prose block (loka-vduxr.53's route). New things are born with `~`; the editor never writes words. |
| Coverage gate | `tools/author-panel/src/edit/registry.json`, one source read by the panel and by the gate: each implemented capability's declarations name a create, edit and delete surface, or `engine-only: <reason>`. CI fails on a missing row, a missing component, or a generic row not in the baseline. |

## 2. What is there today (read-only findings)

- The panel is a Book iframe plus a 400 px right pane of six tabs: Play, Write, State, Why, Find, Numbers (`tools/author-panel/src/App.tsx:41-49`, `:83`). It talks to the Book over postMessage (`book.ts:21-30`; the Book end is `mobile/app/author/panel.tsx:160-168`, ops `hello advance jump drop trace go_to_room set_fact`) and to the watcher over `/__author` (`author.ts:5-37`; routes in `live.ts:242-255`: `checkpoints`, `todo`, `numbers`, `find`, `POST /open`, `POST /why`, `events`).
- The watcher writes exactly one thing today, checkpoints (`live.ts:65-88`), with an Origin check on POSTs (`:160-162`) and a loopback bind (`:268`). Artifact writes are atomic, `.tmp` then rename (`author.ts:72-73`). The file watch skips only `checkpoints/` (`author.ts:148`), so a watcher write re-runs compile, lint and the overlay like an editor save.
- The Book knows which definition it shows: `game.entityIds()` and `game.roomIds()` map `cartridge@version:kind/key` to live ids (`panel.tsx:178`); `shown.ts:41-51` lists the scripted actions and dialogues the room could offer. Alt-click posts `{key?, words}` from `textContent` (`panel.tsx:181-187`); loka-vduxr.51 puts the text key on the element.
- Source is 21 definition dirs (`lib/loka/content/source.ex:210-232`) plus six root files; an area file classifies as its root twin (`:235-240`). `bin/loka new` scaffolds 27 kinds (`starters/templates.ex:9`), each with `~` placeholders, the capability lock, a layout row, and `--from` placement (`starters.ex:37-54`); `--area` arrives with loka-vduxr.58.3.
- `schemas/source/` has one JSON Schema per dir and root file, 28 files, over `defs.schema.json` with 188 definitions, 160 carrying a description. They accept every shortcut and are "a writing aid, not a gate" (`docs/system/cartridge.md:529-544`). That is a generic block's whole input.
- The compiler prints `severity: rel:line words` (`lib/loka/content/explain.ex:166-176`); the structured Diagnostic with `path` exists in memory (`Loka.Content.compile/1`, `lib/mix/tasks/loka.compile.ex:18-26`) and is thrown away. The watcher keeps the printed lines (`author.ts:99`).
- Mechanic vocabulary the bespoke blocks must cover: 26 policy leaves (`protocol/policy.schema.json` Policy `oneOf`), 35 step ops (`protocol/step.schema.json` Step `oneOf`), a reaction's `on` trigger union (`protocol/reaction.schema.json` ReactionRule `on`), 60 "declarations" sections in `docs/system/cartridge.md:985-1482`. Room fields: `actions cues dark dark_description description details exits key locks name sanctuary site sound tags variants`; NPC: `ask attack attributes capacity cues daily_schedule description description_variants disposition drops hp immune keywords locks mount name name_variants perception resistances resource_starts room room_line schedule_cases services shop spawn_template unattackable words`; item: `affects bandage barrier block_chance capacity container cues description description_variants edible equip fuel give_allowed identified immune intended_level keywords location locks mass_grams name name_variants readable room_line room_line_variants slot tags vessel weapon words` (`protocol/room.schema.json`, `protocol/entity.schema.json`).
- The registry's `definitions` field is not the declaration list: `quest`, `combat`, `death`, `check` are `null` though `quests/`, `cartridge.json` combat and death settings exist (`protocol/capability_registry.json`). loka-vduxr.59 builds the real "what you declare" column; the gate keys on that, not on `definitions`.
- Measured: of 2160 cartridge `*.json` files, 2090 are byte-identical after `JSON.stringify(JSON.parse(s), null, 2) + '\n'`; the first differing file lacks only a trailing newline. Elixir map reordering (the audit's reason to avoid parse-and-write, `br comments loka-vduxr.51`) does not apply in Node: object insertion order is kept, only integer-like keys sort.
- Owner rulings in force that bind this design: hand-written prose (`docs/decisions/owner-decision-handwritten-prose-2026-10-31.md`), authoring readiness and dev@1 cheats (`owner-decision-authoring-readiness-2026-10-31.md`), cartridges own numbers, pre-production, no third column (studio audit, cut list).

## 3. Interaction model

One selection drives three surfaces. The selection is `{file, kind, key}` (an area file keeps its real path). It is set by: a click in the Book in edit mode, a click on the Map, a Find referrer row, a Todo row, a diagnostic line, or the Edit tab's own picker (kind, then key). The Edit tab opens on any selection; the Book and Map never show forms.

| Surface | What it does | What it never does |
|---|---|---|
| **Book, edit mode** (toggle in the panel header; the Book at `?dev=1` only) | Each rendered thing carries its definition: the room (title), a person, an item, an exit, a detail, a choice. Click selects it. Prose lines get the in-place prose edit (loka-vduxr.53). The room page gets one "add here" menu: exit, item here, NPC here, detail, reaction on this room, action here; each runs the create route with this room filled in and selects the new file. A person gets "add dialogue", "add reaction on this NPC"; an item "add reaction on this item". | Show a form, show a field, or write anything but a prose line. The Book is a snapshot of the compiled artifact; structure is edited on the card and comes back through the compile. |
| **Map tab** (loka-vduxr.52) | Rooms with layout rows drawn, exits as edges, areas as hulls (the folder is the area), reach overlay. Edit affordances: drag a room (writes its `layout.json` row), draw an edge (writes both rooms' `exits`, a one-way toggle writes one), drop a barrier on an edge, "new room from here" (`mix loka.new rooms <key> --from <room> <dir>`), "move to area" (file move; the border rule's refusals then show). Click selects the room. | Draw prose, dialogue, or anything that is not geography. |
| **Edit tab, the card** | The selected definition as mechanic blocks. A block is present (its fields) or absent (one "add <mechanic>" button that inserts the schema's minimal object with `~` for every text key). Each block has "remove". The card header: file path, area, "open in editor" (`POST /open`), referrers (from `find.ts`), delete, and the file's diagnostics. A nested thing with its own file (a dialogue of this NPC, a reaction on this room) is a link that changes the selection. | Generate words, or guess a value: new numbers are the schema's minimum or the sampler's value, named as such. |

Where each kind fits: geography and placement on the Map; words and "what is here" in the Book; everything else on the card. A mechanic with a world file (facts, resources, attributes, calendar, combat and death settings, chapters) is a card with no Book or Map entry, reached from the picker.

The right pane stays 400 px by default; the Edit tab may widen the pane to 480 px on windows wider than 1400 px (ruling 2). A card longer than the pane scrolls; blocks fold.

## 4. Capabilities and declarable kinds, mapped

Legend: **Map**, **Book**, **Card**. "Bespoke" names a block that a schema form would get wrong (a tree, a graph, a table with cross-references, or numbers that need a sampler beside them). "Generic first" means the schema block ships first and stays in the baseline until replaced.

### 4.1 Places and the world (`movement`, `inspectable_detail`, `description_variant`, `tag`, `alternates`, `knowledge`, `light` darkness, `water`, `construction`, `sense_cue`, `calendar`, `tide`)

| Declaration | File | Create | Edit | Delete | Bespoke? |
|---|---|---|---|---|---|
| room | `rooms/<k>.json` | Map "new room from here", Book "add exit" with a new target, picker | Card: Room | Card delete (referrers shown) | Card is bespoke (it is the hub) |
| exits, one-way, `locks` on an exit | room `exits` | Map draw edge, Book "add here", card | Map, card exit table (direction, `to` picker, barrier picker) | edge delete, row delete | **Bespoke** (both ends written; a picker over rooms) |
| details, aliases, detail variants | room `details` | Book "add detail", card | card list, prose through the prose block | row delete | generic first (a list of name, prose, variants) |
| description variants, alternates, `dark_description` | room/npc/item `*_variants`, `alternates` | card "add variant" | card: a `when` policy (Policy block) and a prose line | row delete | **Bespoke** via the Policy block; the rows are generic |
| tags, `sanctuary`, `sound`, `dark`, water depth, `site` | room fields | card "add" | card | remove | generic |
| layout row | `layout.json` | Map drag, `bin/loka new` adds rows | Map drag | row delete | **Bespoke** (the Map) |
| cues (`sense_cue`) | room/npc/item `cues` | card | card | remove | generic |
| structure, site (`construction`) | `structures/<k>.json`, room `site` | picker | card | delete | generic first |
| calendar, tide | `cartridge.json` `calendar` | World card | World card | remove | generic |

### 4.2 Things (`containment`, `equipment`, `liquid`, `food`, `readable`, `bleed`, `light` fuel, `tag`, weapons and affects)

| Declaration | File | Surfaces | Bespoke? |
|---|---|---|---|
| item, `location` | `items/<k>.json` | Book "add item here" (location filled), picker; Card: Item; delete | Card bespoke (placement picker: a room, an NPC, a container) |
| container, capacity, `locks`, `barrier` on an item | item fields | card blocks | generic first; the lock picker is shared with exits |
| `equip`, `slot`, `weapon`, `affects`, `block_chance`, `intended_level`, `mass_grams` | item fields | card blocks | **Bespoke** "Combat numbers" block shared with NPC `attack`: numbers beside the fight matrix (`GET /numbers`), so a change is read against the sampler |
| `vessel`, `liquid_source`; `liquids/<k>.json` | item fields, dir | card; picker | generic |
| `edible`, `readable`, `fuel`, `bandage`; `bleeds/<k>.json` | item fields, dir | card; picker | generic (`readable` words through the prose block) |
| `give_allowed`, `identified`, `immune`, `keywords`, `words`, `room_line(_variants)` | item fields | card | generic; variants through the Policy block |

### 4.3 People (`containment` npc, `schedule`, `commerce`, `service`, `speech`, `emote`, `population`, `patrol`, `escort`, `attribute`, `resource`, `combat`, `death`)

| Declaration | File | Surfaces | Bespoke? |
|---|---|---|---|
| npc, `room` | `npcs/<k>.json` | Book "add NPC here"; Card: NPC; delete | Card bespoke (home room picker; `spawn_template` switch hides placement) |
| `hp`, `attack`, `attributes`, `resistances`, `immune`, `unattackable`, `drops`, `resource_starts` | npc fields | "Combat numbers" block | **Bespoke** (see 4.2) |
| `daily_schedule`, `schedule_cases` | npc fields | **Schedule** block: hours down, room picker across, each row clickable on the Map; a `when` policy per case | **Bespoke** |
| `shop` (`commerce`), `services` (`service`) | npc fields | **Offer table** block: item picker, price, stock, `benefit` step (Steps block) | **Bespoke** (cross-references and a step) |
| `keywords`, `ask`, `words` (`speech`) | npc fields | card list; a keyword picks a dialogue | generic first |
| `disposition`, `perception`, `mount`, `capacity`, `locks` | npc fields | card | generic; `disposition` triggers are policies (Policy block) |
| name and description variants, `room_line` | npc fields | as 4.1 | Policy block |
| emotes | `emotes/<k>.json` | picker; card | generic |
| population plan | `populations/<k>.json` | picker; **Population** block: home and area room pickers (Map-linked), cap, count, every, templates (NPC picker filtered to `spawn_template`) | **Bespoke** (room pickers, template filter) |
| patrol, escort | quest and dialogue choice fields | inside the Quest and Dialogue cards | generic rows inside bespoke cards |
| behaviours and `with` params | `behaviours/<k>.json`, npc/item `behaviours` | picker; card: holder list and a rules list (Reaction blocks) | **Bespoke** rules (Trigger, Policy, Steps); the holder list generic |

### 4.4 Story (`quest`, `dialogue`, `scene`, `topic`, `narration`, `expedition`, chapters, story points)

| Declaration | File | Surfaces | Bespoke? |
|---|---|---|---|
| quest | `quests/<k>.json` | Dialogue card "accept creates quest", picker; **Quest** card: objective (evidence kind, Policy block or event), stage hints (prose), deadline, offer target, expedition route (room pickers), journal keys (prose) | **Bespoke** |
| dialogue (JSON) | `dialogues/<k>.json` | Book person "add dialogue", picker; **Dialogue** card: tree view from the artifact (prompt, choices, `then` links, nested sets, gate badges from `policy`, `once`, `accept`, `hand_over`, `payment`), each choice a folded block: terms as fields, `steps` (Steps block), `policy` (Policy block), `story_point` | **Bespoke** tree; a choice label edit is refused with the reason (its slug is the key, loka-vduxr.51 risk list) |
| dialogue (`.scene`) | `scenes/<k>.scene` | `bin/loka new scene <npc> <k>`; **Scene text** block: the file as text with the lowered tree beside it (the compile's artifact), line-exact prose edits from the Book, structured choice fields written to the same-key JSON twin (`scene_overlap` rule, `docs/system/cartridge.md:958-959`) | **Bespoke** (text first: it is the owner's writing format) |
| modal scene | `scenes/<k>.json` + `.cut` | picker; card: `on` (Trigger block), `control`, steps as the `.cut` text | bespoke through the Trigger block; text for words |
| story points, chapters | choice `story_point`, `cartridge.json` `chapters` | Dialogue card; World card chapter list | generic rows |
| topics, lore | `topics/<k>.json`, choice `topic` | picker; card | generic |
| narration (`narrate` step, `narration` on choices) | steps and fields | Steps block; prose block | generic rows |

### 4.5 Rules (`reaction`, `scripted_action`, `policy`, `fact`, `check`, `status`, `skill`, `replenish`, `resource`, `attribute`, `schedule` waits)

| Declaration | File | Surfaces | Bespoke? |
|---|---|---|---|
| reaction | `reactions/<k>.json` | Book room/person/item "add reaction on this", picker; **Reaction** card: Trigger block (`on`: event picker, then that event's filters with definition pickers), Policy block (`when`), Steps block, `after`, `silent`, `zone` | **Bespoke** (three bespoke blocks) |
| scripted action | `actions/<k>.json` without `command` | Book room "add action here", picker; **Action** card: target (kind picker), `check` (Check block: kind, skill, opposed), `costs`, `cooldown`, `duration`, `craft`, outcomes `success`/`failure` each a Steps block, `narration` roles | **Bespoke** |
| built-in action | `actions/<k>.json` with `command` | picker; card: command picker, `accessibility`, `input` | generic |
| policy tree | everywhere | **Policy** block: `all`/`any`/`not` as nested groups, 26 leaves each with pickers for its refs (fact, item, npc, quest, status, skill, tag) and a value field; "test now" asks `POST /why`-style evaluation on the current world (a later nicety, not v1) | **Bespoke** |
| steps list | everywhere | **Steps** block: ordered list, op picker over the 35 ops, each op's fields with pickers; `wait` rows draw a divider ("later rules") | **Bespoke** |
| facts | `facts.json` | World card: Facts table (name, type, default, scope); referrers per fact from `find.ts` | **Bespoke** table (type decides the value field) |
| statuses, skills, replenish | `statuses/<k>.json`, `skills/<k>.json`, `replenish/<k>.json` | picker; card: numbers plus Steps/Policy where the schema has them | generic first; skills carry `growth` rows (generic) |
| resources, attributes, bands | `resources.json`, `attributes.json`, `cartridge.json` `world.bands` | World card tables | generic tables |
| combat, death settings | `cartridge.json` | World card "Combat numbers" and "Death" blocks | **Bespoke** numbers (sampler beside) |
| checks (`check@1`) | action and choice `check` | Check block inside Action and Dialogue cards | generic rows |

### 4.6 Crossing and travel (`barrier`, `transport`)

| Declaration | File | Surfaces | Bespoke? |
|---|---|---|---|
| barrier | `barriers/<k>.json` | Map drop on an edge, picker; card: state, lock, key item picker, knock responses (prose) | bespoke placement on the Map; fields generic |
| transport | `transports/<k>.json` | picker; card: from/to room pickers drawn on the Map, price, offer prose | bespoke pickers (Map-linked); fields generic |

### 4.7 Engine-only or nothing to declare

`dev` (preview cheats), `target_resolution`, `policy` and `check` as capabilities (their blocks are inside other cards), `position`, `narration` (step-level), `relationship`, `faction` and `tide` (not implemented: the gate skips unimplemented rows as `bin/features.exs` does), `knowledge` beyond `layout.json`, `expedition` beyond the quest field, `speech` beyond NPC keywords. Each is an `engine-only: <reason>` row in the registry, the reason copied from loka-vduxr.59's "declares" column.

### 4.8 Bespoke blocks, counted

Shared blocks built once and used by many cards: **Policy**, **Steps**, **Trigger**, **Check**, **Prose** (loka-vduxr.53), **Picker** (a definition of a kind, from the artifact's keys; a room picker also highlights on the Map), **Combat numbers**, **Schedule**, **Offer table**, **Facts table**. Bespoke cards: Room, Item, NPC, Reaction, Action, Quest, Dialogue, Scene text, Population, World. Everything else is a generic card of generic blocks until it earns a bespoke one.

## 5. The write path

### 5.1 Routes, all in `kernel/ts/play/live.ts`

| Route | Body | Does | Refuses (400 unless noted) |
|---|---|---|---|
| `GET /source?file=` | | `{bytes, sha256, kind, key, area}` for one source file | not in `files(source)` (`todo.ts:14-19`): 404 |
| `GET /schema/<dir>` | | the committed `schemas/source/<dir>.schema.json` with `defs.schema.json` inlined | unknown dir: 404 |
| `GET /diagnostics` | | the last compile's structured diagnostics (also pushed on the SSE message as `diagnostics`) | |
| `POST /edit` | `{file, line, was, words}` | loka-vduxr.53: line-exact prose replacement in JSON, `.scene`, `.cut` | line changed, a tab, a key line, a choice label, a path outside the tree |
| `POST /restructure` | `{file, was, op, carry}` | loka-wfrgk.100.5: a `.scene`/`.cut` line or page added, removed, moved, split, joined, or a choice label renamed with its referrers, in one journal entry ([scene structure rulings](../design/scene-structure-rulings.md#3-the-write-route)) | `was` or `carry` stale: 409; [the refusals](../design/scene-structure-rulings.md#4-refusals-gated-two-ways) |
| `POST /change` | `{file, was, ops: [{path, value} \| {path, delete: true}]}` | parses the file, applies the path ops in order, writes `JSON.stringify(v, null, 2) + '\n'` atomically; answers the new `sha256` and the journal id | `was` mismatch: 409 with the current bytes; not JSON; a path through a non-object; a `.scene`/`.cut` file (text only) |
| `POST /new` | `{kind, name, from?: {room, direction}, area?}` | runs `mix loka.new` through `mise exec` with `--cwd` (`lib/mix/tasks/loka.new.ex:4`), answers the files written; `name` is checked by `Starters.valid_name` on the Elixir side | the task's one-line refusal, verbatim |
| `POST /delete` | `{file, was}` | journals and removes the file; a `layout.json` row for a room is removed in the same journal entry | `was` mismatch; a root file (`cartridge.json`, `facts.json`, `text.json`, `layout.json`, `resources.json`, `attributes.json`: the card deletes rows, never the file) |
| `POST /move` | `{file, was, area: string \| null}` | `rename` to `areas/<area>/<dir>/<key>.<ext>` or back to the root dir; `mkdir -p` | target exists; `was` mismatch |
| `POST /undo` | `{id}` | restores the journal entry's `before` bytes (or re-creates a deleted file, or removes a created one) when the file still equals the entry's `after`; answers the restored `sha256` | changed since: 409; unknown id: 404 |

Every POST keeps the Origin check (`live.ts:160-162`) and the loopback bind. Path guard, once, in one function used by every route: the resolved path must start with the source dir, must not be a symlink, must be `files(source)` for reads and edits, and for creates must classify (`Source.classify/1` grammar: `<dir>/<key>.<ext>` or `areas/<area>/<dir>/<key>.<ext>`). Writes are `.tmp` then `rename` (`author.ts:72-73`). `live.ts` is never bundled into the app (`docs/system/cartridge.md:893-895`); no engine surface changes.

### 5.2 Why re-serialize, and what it costs

A format-preserving edit needs a JSON CST (a dependency such as `jsonc-parser`, or a hand parser). The measurement in section 2 says the house format already is `JSON.stringify(v, null, 2)` for 97 % of files, and the compiler and `bin/loka new` (`starters/merge.ex`) do not care about bytes. So: the first structural edit of one of the 70 odd files reformats it once (a trailing newline, mostly); after that every write is a minimal `git diff` hunk. Integer-like keys sort ascending in Node: 49 exist across the cartridges (`daily_schedule` hours such as `"8"`, `"9"`, `"14"`; boss phases `"0"`..`"3"` in `boss_sampler/npcs/warlord.json`); they are already written ascending, and the compiler reads maps, so semantics hold either way. The prose route stays line-exact because `.scene` and `.cut` are not JSON and because a prose line change must never reflow a hand-formatted file.

### 5.3 The `was` check and conflicts

The card loads `{bytes, sha256}`; every write carries that `sha256` as `was`. The watcher compares with the bytes on disk at write time (not with a cache: VS Code saves between). A mismatch is 409 with the current bytes; the card shows "changed on disk" with the two values of the field it was editing, and a "reload" button. Two cards on one file (the Room card and the Map, both writing `rooms/x.json`) share the selection and so the same `sha256`; after any write the watcher pushes `{file, sha256}` on the SSE stream and every open card for that file reloads. This is the whole conflict story: last writer must have seen the latest bytes.

### 5.4 Undo

The journal is in watcher memory, capped at 200 entries, newest first; each `{id, file, before, after, at, what}`. The panel's Compile card lists the last ten writes with "put it back". `undo` is a conditional write (5.1). Git remains the durable undo and the review surface: every write is one file, so `git diff` reads as the editor's history. No per-file version list, no redo.

### 5.5 Refusals shown in place

`mix loka.compile --json <path>` (a third argument form beside `--allow-placeholders`) writes `[{severity, code, path, rel, line, words}]` (the explained line split: `Loka.Content.explained/2` already computes `rel:line` through `SourceLines.index`, `explain.ex:166-176`). The watcher passes it and pushes `diagnostics` beside `said` (`live.ts:30-35` Message gains one field). A card filters by `rel` equal to its file, then places each diagnostic at the block whose JSON path is a prefix of `path` (`rooms/x.exits.north.to` lands on the exits block, row `north`, field `to`); an unmatched one shows at the card top. The lines stay in the Compile card as today. A failed compile keeps the last good artifact (`author.ts:103`), so the Book never goes blank while a card is mid-edit; the Book is the last good world and the card says so ("not compiled; the Book shows the last good cartridge").

The compile is 0.7 to 1 s warm (studio audit). A card write therefore shows its refusal about a second after the write; the card disables the write button until the compile answers, so a second write never races the first's diagnostics.

## 6. Architecture inside `tools/author-panel`

Reused as is: the iframe and postMessage bridge (`book.ts`), the SSE diagnostics (`author.ts:40-67`), `ask` and `find` (`author.ts:5-26`), the Compile card and the tabs (`App.tsx:39-74`), shadcn `badge button card input scroll-area separator tabs textarea` (`src/components/ui/`), the Book tokens (`index.css`), `GoToRoom` as the Map's click (`cheats.tsx:8-29`).

New, all under `tools/author-panel/src/edit/`. Amended 2026-11-05 (E4a review): each card's logic (edit model, schema walker, validator, card helpers) lives in `kernel/ts/play/`, where `node:test` runs it; `src/edit/` holds only components and `registry.json`.

| Module | Holds |
|---|---|
| `selection.ts` | the one selection `{file, kind, key}`; `select()` called by the Book bridge, the Map, Find, Todo, diagnostics; a React context |
| `source.ts` | `load(file)`, `change(file, was, ops)`, `create`, `remove`, `move`, `undo`, `schema(dir)`; the `author.ts` helpers for the routes in 5.1 |
| `registry.json` | `{ "<capability>": { "declares": ["room.exits", ...], "create": "...", "edit": "...", "delete": "...", "generic": ["..."] } }`, one row per implemented capability (section 7) |
| `cards/<Kind>.tsx` | one per bespoke card (Room, Item, Npc, Reaction, Action, Quest, Dialogue, SceneText, Population, World) |
| `cards/Generic.tsx` | the fallback card: a schema object rendered as blocks; `{"prose": ...}` sites render the Prose block; refs render a Picker when the schema's `$ref` is DefinitionRef with a known kind |
| `blocks/*.tsx` | Policy, Steps, Trigger, Check, Prose, Picker, CombatNumbers, Schedule, OfferTable, FactsTable |
| `EditTab.tsx` | picker (kind, key) when nothing is selected; the card otherwise; the undo list |
| `Map.tsx` (loka-vduxr.52, grown) | edit affordances of section 3 |

The Book end (`mobile/app/author/panel.tsx`) gains two things: an `edit` op toggling edit mode, and a `select` message `{kind, key}` posted on a click in edit mode, using the dev-only key loka-vduxr.51 puts on each element and the entity ids `stateOf` already has (`:178`). An "add here" click posts `{add: {kind, room}}`; the panel runs `POST /new` with `from`/`location` filled. No form renders in the Book; `mobile-book-*` ast-grep rules stay satisfied because the markup is a dev-only attribute and a dev-only menu in the author bridge, as the Alt-click is.

Type sharing: the card types come from the source schemas (`GET /schema`), not from `kernel/ts/src` contracts: the source shape has shortcuts the artifact has not (`extends`, `prose`, `zone`, `behaviours`), and `schemas/source/` is what accepts them (`docs/system/cartridge.md:538-541`). The Picker's key lists come from the compiled artifact the watcher holds (`find.ts:34-35`), so a picker offers only keys that compile.

Tests: the write routes get `node:test` cases in `kernel/ts/test/live.test.ts` on a controlled temp tree: byte-exact output but the edited path; the 409 on a stale `was`; a path outside the tree; a symlink; undo after a later write refused; `--json` shape from a planted refusal. The panel gets no component test framework now (ruling 10): the registry gate proves wiring, and each slice ends with one owner walk in the preview.

## 7. The coverage gate (extends loka-vduxr.59)

loka-vduxr.59's generator fails CI when an implemented capability lacks a summary, its declarations (or `engine-only`), a compiling sampler, and a showcase location. This design adds one input and three checks to the same generator (one gate, one `bin/regen.sh` entry, one `REGEN_DIRTY`):

- Input: `tools/author-panel/src/edit/registry.json`. Per implemented capability: `create`, `edit`, `delete`, each a component path under `tools/author-panel/src/edit/` or the word `generic`, and `declares` listing the declaration sites the row covers (`room.exits`, `npc.shop`, `reactions/`, `facts.json`), copied from the toolbox data's "declares" column so the two cannot drift: the generator fails when a toolbox declaration has no registry row naming it, or a registry row names a declaration the toolbox does not list.
- Check 1, **CRUD complete**: every implemented capability with declarations has all three of `create`, `edit`, `delete`; one with none is `engine-only: <reason>` (the same reason the toolbox row carries). Missing: halt, naming the capability and the missing verb.
- Check 2, **the component exists**: each named path is a file; a `generic` entry is in `test/loka/editor_generic_baseline.txt` (one line per `<capability>.<verb>`), which only shrinks (the lint baseline rule, `bin/regen.sh:12`). A `generic` entry not in the baseline, or a baseline line no longer generic: halt.
- Check 3, **the toolbox page shows it**: the generated page gains an "Editor" column per row (`bespoke`, `generic`, `engine-only`), so a builder sees what is hand-built.

Red controls, in the generator's own test: remove a registry row; rename a component path to a missing file; add a `generic` entry absent from the baseline; delete one baseline line while the registry is still generic. Each fails the run. The Elixir generator reads the registry JSON directly; no TypeScript runs in the gate.

What the gate proves: every mechanic has a named, present surface for each verb. What it does not prove: that the surface works. That is the per-slice route tests and the owner's walk.

## 8. Owner rulings needed

| # | Ruling | Recommendation |
|---|---|---|
| 1 | **Kept, narrowed:** generic only for the existing backlog; a new mechanic ships its hand-built editor; rjsf 6. Hand-built blocks per mechanic, a schema-generic card as the bootstrap, every generic row in a shrink-only baseline. | Yes. The generic card gives every mechanic CRUD in one slice; the baseline makes "eventually hand-built" a CI number that only goes down. |
| 2 | **Changed:** three columns (hierarchy and map left, the Book a phone strip, inspector and console right). Surfaces: Book contextual actions, the Map, one Edit tab in the right pane; no third column; the pane may widen to 480 px above 1400 px windows. | Yes. The studio audit's cut stands; a card is a list of blocks and reads fine at 400-480 px. |
| 3 | **Kept.** Structural edits re-serialize the one file (`JSON.stringify(v, null, 2) + '\n'`), reformatting about 70 files once; prose edits stay line-exact. No JSON CST dependency. | Yes. 97 % of files already have that shape; the compiler reads maps. |
| 4 | **Kept;** every fs change is pushed with its attribution (section 11). Whole-file `was` on every write, 409 and reload on mismatch, no merge. | Yes. One writer at a time is the real case (the owner, VS Code, the panel). |
| 5 | **Changed:** the journal also covers outside changes, one entry per burst, capped by bytes; the console's feed is the history list. Undo is a watcher-memory journal plus git; no history UI, no redo. | Yes. |
| 6 | **Kept;** `/new` journals every file it touched from the snapshot diff. Create runs `mix loka.new` through the watcher. | Yes. Starters already write placeholders, the capability lock, layout rows and `--area`/`--from`; a second scaffolder would drift. |
| 7 | **Kept.** `mix loka.compile --json` is the diagnostics contract for the panel. No new DiagnosticCode, no protocol change. | Yes. The Diagnostic already carries `path`; only the printing changes. |
| 8 | **Kept.** Delete a file with referrers: confirm with the count and delete; the compiler's `UNRESOLVED_REFERENCE` then shows on the referrers' cards. | Yes. Refusing would force the owner to hunt referrers by hand; the undo journal and the diagnostics make it safe. |
| 9 | **Kept**, except a choice key (2026-11-06, ruling 11). Rename a key is out of v1; the card shows referrers and refuses. | Yes. Every referrer, `then:`, checkpoint and text key changes; the Find tab plus the editor covers it until a slice earns it. |
| 10 | **Kept.** No component test framework for the panel now; route tests in `kernel/ts/test`, the registry gate, and one owner walk per slice. | Yes, under the Pro plan. Revisit after the first three cards. |
| 11 | **Reversed 2026-11-06 (owner).** Scene structure, choice labels included, is edited in the Scene text card; a label rename carries its key's referrers ([decision](../decisions/owner-decision-scene-structure-gui-2026-11-06.md), [scene structure rulings](../design/scene-structure-rulings.md)). Was: kept; labels not edited (the slug is the key). | Yes (the studio audit's open question 2). |
| 12 | **Kept.** A `.scene` dialogue is edited as text with the lowered tree beside it; structured fields a scene cannot say go to the same-key JSON twin. | Yes. The scene file is the owner's writing format; a tree editor that rewrites it would reflow the owner's lines. |
| 13 | **Changed:** no edit mode; a Book click plays and selects, double-click edits prose, Alt-click opens source; "add here" lives in the hierarchy and inspector. The Book in edit mode shows one "add here" menu per page and a select on click; nothing else changes in the Book. | Yes. Keeps the Book a snapshot and the `mobile-book-*` rules intact. |
| 14 | **Changed:** see section 9. Slice order below: write path and gate first, then Room with the Book's add-here, then NPC and Item, then Rules, then Story, then Map edits, then World. | Yes. The Room card plus "add here" is where the owner builds a district; rules and story are where a schema form is worst. |

## 9. Slice plan

Superseded by the [plan's slice order](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md#slice-order).
The old G1 to G7 map onto it: G1 is E1 (routes) plus E4a (registry and gate) and E4b (the generic
card); G2 to G5 and G7 are the five E6 slices; G6 is E3b. Each slice still ends with the
fallback list shorter, the owner's walk, and an Author preview bullet in `docs/system/cartridge.md`.
The original table is at [`e278f6a86`](https://github.com/lorecrafting/lokacore/blob/e278f6a86/docs/rnd/gui-editor-design-2026-11-04.md#9-slice-plan).

## 10. Not checked, and risks

- I ran no compile and no panel; every `file:line` is a reading. The two measurements (round-trip of 2160 files; integer-like keys) are the only things executed.
- Integer-like keys were counted (49), not round-tripped one by one; G1's test should pin an NPC with a `daily_schedule` written out of hour order, the one case where the sort changes bytes.
- Not checked that `mix loka.new` can be driven from the watcher for every kind without a TTY (`--cwd` exists; `mise exec` adds 0.3 to 0.5 s per create). If a kind needs interactive input, the route refuses it with the task's line.
- `--json` adds one output form to `mix loka.compile`; `Loka.Content.explained/2` must keep the line form byte-identical, since the Compile card and `bin/loka dev` logs read it. The task's test covers both forms.
- The Picker reads keys from the compiled artifact; after a failed compile the lists are a build stale. The card says "lists from the last good compile".
- The diagnostic `path` grammar names a bundle member as `areas/<name>.<dir>.<key>.<field>` and a flattened `extends` field carries `data.from`; the card places those at the top, not at a field, until a slice maps them (the audit's "inherited from" note). An area folder file's path is plain and places fine.
- Edit mode in the Book adds a click handler and a menu to `mobile/app/author/panel.tsx`; the release bundle keeps dead strings (`cartridge.md:895`) but no behavior. The `mobile-book-*` ast-grep rules must be run on G2; a menu rendered inside `mobile/app/book/` would be a finding.
- The gate counts a surface as present when its file exists. A card that renders an empty block passes the gate; the baseline, the owner's walk and the route tests are the honest checks, and the toolbox page's Editor column makes a hollow `bespoke` claim visible.
- Token cost: seven slices at M/S under the Pro plan is roughly two weeks of agent slots; the owner may stop after G4 with the world, things, people and rules hand-built and story still generic, which is a usable floor.

## 11. Audit changes (2026-11-04)

From the Fable audit of the plan; each is binding on its slice.

- **Hold and the badge live in the watcher.** A structural compile rewrites the artifact and Metro
  reloads the frame (`kernel/ts/play/author.ts:71-75`, `mobile/app/metro.config.js:38-44`), so the
  watcher parks the artifact, answers `POST /hold {on}`, and puts `pending` on the SSE message.
  A held structural change blocks later text overlays; the badge counts every waiting change.
- **Commit points.** Fields write on Enter, blur or picker close; the card shows "compiling" until the SSE answers.
- **Generic card: rjsf 6 with Ajv2020.** JSON Forms 3.8 resolves no `if/then/else` (our top level
  per kind) and has no `anyOf` renderer. rjsf validates a real room with zero errors but its
  defaults invent content, so it mounts with `emptyObjectFields: 'skipDefaults'` and
  `arrayMinItems.populate: 'never'`, and a test pins that an empty room's defaults are `{}`. A pure
  schema walker emits the `ui:field` claims (by `$ref`: TextKey, DefinitionRef, Policy, Step; and by
  registry path), gives `anyOf` branches titles, and is the gate's path list. rjsf owns branch
  switching inside the generic card; the edit model owns block add and remove, the prose or key
  toggle, pickers and the path ops.
- **The gate keys on schema paths** (top-level fields of each source definition and root file,
  plus treatment names), not on the registry's `definitions` field, which is wrong today
  (`protocol/capability_registry.json`: `quest`, `combat`, `death` null).
- **Every fs burst is pushed** as `changed: [{file, sha256, by}]`, `by` being `editor` or
  `outside`, so a card open on a file an agent changed (a `text.json` overlay included) reloads or
  marks its fields. The journal takes one entry per burst and is capped by bytes (about 64 MB).
- **`/new`** journals every file `mix loka.new` touched by diffing the snapshot (it merges into
  `cartridge.json`, `layout.json`, `text.json` and the `--from` room, `lib/loka/content/starters.ex:53-55`).
  Its `area` waits for S3; S3's `--from` and first-room lookups across area folders
  (`starters.ex:141`, `:207-209`) move into S2 so "new room from here" works on area rooms.
- **Guards:** a `Host` check (`localhost` or `127.0.0.1`) beside the Origin check against DNS
  rebinding; the symlink guard checks `realpath` of the parent and `lstat` of the file, for reads
  and writes. Loopback is the trust boundary; Origin only stops browsers.
- **`compile --json`:** `explain.ex` splits its place formatting into a function returning
  `{rel, line}`; the line form stays byte-identical, tested on a planted refusal in both forms.
- **Treatments:** `treatment` is an optional enum on the source scene, `protocol/scene.schema.json`
  SceneDefinition and the GameView's SceneView (the Book has no cartridge definitions in a
  release, so the view must carry it). Revival stays implicitly `spirit`. A treatment's layer sits
  where the spirit layer sits in the under-ink chooser; scene precedence is unchanged.
- **Jank to design out:** a failed compile keeps the card's draft with the refusal at its field;
  a selected file deleted outside shows "deleted, put it back"; `POST /move` answers the new path
  and re-selects; the hierarchy keeps scroll and selection across reloads; pickers after a failed
  compile are labelled stale; keyboard shortcuts while the Book frame has focus need a relay; a
  long recorded path makes every reload slow, so the console offers "trim to a checkpoint".
