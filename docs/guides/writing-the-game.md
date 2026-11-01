# Writing the game

The owner's loop for writing a cartridge by hand. Rules: [owner decision](../decisions/owner-decision-handwritten-prose-2026-10-31.md);
tool behaviour: [author preview](../system/cartridge.md#author-preview).

## Start the tools

One command, from the repository root:

```sh
bin/author.sh cartridges/<name>
```

It starts the cartridge watcher (`bin/loka dev … --watch`), the Book preview (`mobile/app`,
`npm run author`) and the author panel (`tools/author-panel`, installed on its first run). Open
http://localhost:19009: the Book fills the page and the panel is the pane on the right (Compile at
the top, then Play, State and Why; the source line at the foot). The sun/moon button switches light
and dark. Ports: `LOKA_AUTHOR_PORT` (watcher, 19008), 19006 (Book), `LOKA_PANEL_PORT` (panel, 19009).

## Write a scene

Edit `text.json` for any line the Book shows: the page updates as you save, no reload. Add a room,
NPC, item or quest as JSON ([Builders' Guide](../BUILDERS-GUIDE.md)); the page reloads and replays
what you had done. Write a conversation as `scenes/<key>.scene`:

```
npc: maud
when: met_maud

maud: line one
- choice one
  maud: line two
  gives: bowl
```

`when:` names a true/false fact; a choice is keyed by its words (`choice_one`). `gives:` hands
the player that item from the scene's NPC: the NPC must hold it (`"location": {"in": "npc", "npc":
"maud"}`, or moved there in play; otherwise the choice stays hidden and the compile warns) and
`cartridge.json` must name `containment` under `requires.capabilities`. What the scene cannot say (a keyword, a riddle) goes in
`dialogues/<key>.json` beside it. An error names the scene file and line.

Everything a scene names must exist: a fact in `facts.json`, an NPC, item or quest as its own JSON
file.

More lines a scene can hold:

```
npc: maud
with: bram

* line of narration
maud: line one
bram: line two
- choice one
  sets: door_open
  sets: mood calm
  * line of reply
- choice two
  quest: accept bridge_job
  bram: line of reply
```

- `with: bram` lets bram speak too. Bram must be in the room when the player chooses, or the choice
  is refused. The lines read as one passage; only the words say who speaks.
- `* words` is a line nobody says, joined like speech, above the choices or under one.
- `sets: door_open` sets a true/false fact to true; `sets: mood calm` sets the fact to that value
  (`true`, `false`, a whole number or a key).
- `quest: accept bridge_job` starts that quest when the player takes the choice.
- `quest: resolve bridge_job` ends the quest, with the choice as its outcome. Every choice in the
  scene must carry the same line, or the compile refuses it.

`needs`, `once`, `then` and nested choices are not available yet; the compile says so.

### Write a cutscene

`scenes/<key>.cut` is a scene the player reads through, with no choices. Each paragraph is one page,
and one `---` closes the file:

```
line one
line two of the same page

next page

---
```

A `.cut` file cannot say what starts it, and a cutscene with no trigger never plays. Put that in
`scenes/<key>.json` beside it, or the compile refuses the file:

```json
{ "on": { "story_point": "bridge_done", "outcome": "carry" }, "control": "modal" }
```

`bridge_done` is a story point, and it has no file of its own: a choice in a scene that resolves a
quest names it. Take a scene whose every choice ends the quest:

```
npc: maud

maud: line one
- carry
  quest: resolve bridge_job
  maud: line of reply
- leave
  quest: resolve bridge_job
  maud: line of reply
```

and add `dialogues/<key>.json` beside it, with the point and the outcome this choice reaches:

```json
{ "choices": { "carry": { "story_point": "bridge_done/carry" } } }
```

Leave a line as `~` to come back to it; the panel's Still to write lists every `~` by file. A `~`
holds the place of words only: in a `sets:` or `quest:` line it is listed too, but the compile
refuses it until you write the key.

## Jump to a beat

Play to the moment you want to work on, then in the panel's Play tab type a name under Checkpoints and
Save. Later, pick it from the list: the game starts over and replays to that point. Checkpoints
are files in `cartridges/<name>/checkpoints/`, committed with the cartridge.

## Test your checkpoints

`bin/loka check cartridges/<name>` compiles the cartridge and replays every checkpoint from a fresh
start, with no Book. It prints `<checkpoint>: ok`, or the first step the game refused and why, and
exits 1 if any failed. Run it after an edit, and save a checkpoint at each beat you want to keep
working: CI runs it for every cartridge with a `checkpoints/` folder. The preview and the check play
one fixed seed on a frozen clock, so a recording replays alike in both, and time moves only through
the dev clock. A fixed seed means a checkpoint proves one path, not the odds: a chance roll comes
out the same every run, and a change to the chance can flip it.

When you jump to a checkpoint and an edit has made one of its steps impossible, the panel names the
step and offers **drop this step and continue**. It starts over and replays the path without that step. Save under the same name to
keep the shorter path.

## Read an error

A broken edit keeps the last good page; the panel's Compile card says what broke, as
``error: rooms/cellar.json:12 Nothing defines the room `well`. Create it or fix the spelling.``
Every line is `severity: file:line what is wrong, what to do`; half-written JSON also gets a column
(`rooms/cellar.json:4:1`). If a replay stops, the panel names the
step (`step 4 refused: talk Maud`) and the Book stays where the replay got to. Alt-click (Option-click) any
Book line to open its source in your editor (`LOKA_EDITOR`, default `code --goto`). The panel's
Why tab takes an action or dialogue key and explains the last recorded step: which rules fired and
why the action was missing or refused.

## Every kind of content

Every kind's fields are in [source kinds](../reference/source-kinds.gen.md); step ops, policy leaves, events and choice fields are in [vocabulary](../reference/vocabulary.gen.md).

`mise exec -- bin/loka new <kind> <name> [--from <room> <direction>] ... [cartridge dir]` (from any directory; the cartridge dir defaults to the current one, or the cartridge a `cartridge <dir>` pair just made) writes a
compiling file for each pair on one Mix boot (name several pairs in one call; if any is refused, nothing is written), with every line a `~` placeholder, merged into the files it touches
(it never replaces a value already there: it refuses, names the value and writes nothing),
plus the capabilities it needs in `cartridge.json`; it prints what it changed, then what to fill (the list `bin/loka todo` prints) and the
next command. `rooms <name> --from <room> <direction>` writes the exit both ways and, when `layout.json` exists, places the new room's row that way from its source. `cartridge <dir>` stands alone: run it first, then the other pairs with the dir last. A rerun leaves the file it names as you left it, and refuses when that file's steps differ. A kind that refers
to another takes the first one you have (for a room, the entry) and refuses with the command to run first. The shapes
come from the samplers; the rules from the [Builders' Guide](../BUILDERS-GUIDE.md#authoring-paths-and-examples).

Live preview is the same for every kind: a `text.json` edit reaches the page as you save; any
other file (a shop, a structure, a population) recompiles, reloads the page and replays your
recorded steps. An error reads as `error: <file>:<line> <what>` in the panel's Compile card, and the same
when you run `mix loka.compile` by hand.

| Kind | Smallest sampler | Needs first |
|---|---|---|
| `actions` | [`gift_sampler`](../../cartridges/gift_sampler/) | a room; writes its own `<name>_done` fact |
| `areas` | [`speech_sampler`](../../cartridges/speech_sampler/) | nothing; a bundle of rooms (and their NPCs, dialogues) |
| `attributes` | [`barrier_sampler`](../../cartridges/barrier_sampler/) | nothing |
| `barriers` | [`position_sampler`](../../cartridges/position_sampler/) | nothing |
| `behaviours` | [`fishing_sampler`](../../cartridges/fishing_sampler/) | nothing |
| `bleeds` | [`bleed_sampler`](../../cartridges/bleed_sampler/) | a resource |
| `cartridge` | [`cellar_sampler`](../../cartridges/cellar_sampler/) | nothing: `bin/loka new cartridge cartridges/<id>` makes the manifest and a `start` room |
| `dialogues` | [`ask_sampler`](../../cartridges/ask_sampler/) | an NPC |
| `emotes` | [`emote_sampler`](../../cartridges/emote_sampler/) | nothing |
| `facts` | [`shoo_sampler`](../../cartridges/shoo_sampler/) | nothing |
| `items` | [`quest_sampler`](../../cartridges/quest_sampler/) | a room |
| `layout` | [`identity_sampler`](../../cartridges/identity_sampler/) | rooms; every later `bin/loka new` adds the rows of rooms it lacks |
| `liquids` | [`buffs_sampler`](../../cartridges/buffs_sampler/) | nothing |
| `npcs` | [`access_sampler`](../../cartridges/access_sampler/) | a room |
| `populations` | [`boss_sampler`](../../cartridges/boss_sampler/) | a room whose east exit is free, one population per cartridge; also writes the NPC, corpses, loot item, `hp`/`mv` resources, calendar, combat and death settings the engine requires |
| `quests` | [`chapters_sampler`](../../cartridges/chapters_sampler/) | an item (the objective is to hold it) |
| `reactions` | [`scars_sampler`](../../cartridges/scars_sampler/) | an item |
| `replenish` | [`decay_sampler`](../../cartridges/decay_sampler/) | an item, a room and an NPC |
| `resources` | [`affects_sampler`](../../cartridges/affects_sampler/) | nothing |
| `rooms` | [`rooms_sampler`](../../cartridges/rooms_sampler/) | nothing |
| `scenes` | [`scene_sampler`](../../cartridges/scene_sampler/) | an item (it writes its own quest) |
| `services` | [`durability_sampler`](../../cartridges/durability_sampler/) | an NPC and a resource (the currency); also writes the `use_service` action and the service text keys |
| `skills` | [`damage_sampler`](../../cartridges/damage_sampler/) | nothing |
| `statuses` | [`pen_sampler`](../../cartridges/pen_sampler/) | a resource |
| `structures` | [`craft_sampler`](../../cartridges/craft_sampler/) | nothing |
| `text` | [`speech_sampler`](../../cartridges/speech_sampler/) | nothing: `text.json` key `<name>` |
| `topics` | [`spells_sampler`](../../cartridges/spells_sampler/) | nothing (it writes its own fact) |
| `transports` | [`fast_travel_sampler`](../../cartridges/fast_travel_sampler/) | a room, an NPC and a resource; also writes the far room and both legs |

## Keep a fight from starting

An NPC without an `attack` can never be attacked, so a story NPC needs nothing and may have no `hp`.
To keep the profile but protect the NPC, add `"unattackable": true` to `npcs/<name>.json`: the
player sees no Attack, and it never starts a fight. Companions (`world.combat.allies`, or in the
player's group) get the same without the flag, but a spell still hurts them unless they carry it. For a whole room, add `"sanctuary": true` to the
room: nothing engages on entry and Attack is refused, though an attackable NPC there still shows
Attack greyed out. A player's spell neither damages an `unattackable` NPC nor puts an hp-draining status on it. A
status you apply through a reaction still lands and ticks, as authored story: the flag stops the
player, not the writer.

## Cookbook

Each goal names the samplers that already do it; copy their files or start with `bin/loka new`.

| Goal | Samplers |
|---|---|
| A shop | [`prices_sampler`](../../cartridges/prices_sampler/) (buy and sell), [`escrow_sampler`](../../cartridges/escrow_sampler/) (pay now, get later) |
| An item | [`items_sampler`](../../cartridges/items_sampler/); wear it: [`wear_sampler`](../../cartridges/wear_sampler/) |
| An NPC that talks | [`hello_sampler`](../../cartridges/hello_sampler/), [`ask_sampler`](../../cartridges/ask_sampler/) (topics), [`voices_sampler`](../../cartridges/voices_sampler/) |
| A room and an area | [`rooms_sampler`](../../cartridges/rooms_sampler/), [`details_sampler`](../../cartridges/details_sampler/) (things to look at), [`speech_sampler`](../../cartridges/speech_sampler/) (`areas/` bundle) |
| A quest | [`quest_sampler`](../../cartridges/quest_sampler/), [`errand_sampler`](../../cartridges/errand_sampler/), [`chapters_sampler`](../../cartridges/chapters_sampler/) |
| A cutscene | [`scene_sampler`](../../cartridges/scene_sampler/) |
| Environment | [`sky_sampler`](../../cartridges/sky_sampler/), [`terrain_sampler`](../../cartridges/terrain_sampler/), [`time_sampler`](../../cartridges/time_sampler/), [`ambient_sampler`](../../cartridges/ambient_sampler/), [`exposure_sampler`](../../cartridges/exposure_sampler/) |
| Combat and encounters | [`encounter_sampler`](../../cartridges/encounter_sampler/), [`damage_sampler`](../../cartridges/damage_sampler/), [`boss_sampler`](../../cartridges/boss_sampler/), [`ranged_sampler`](../../cartridges/ranged_sampler/), [`raid_sampler`](../../cartridges/raid_sampler/) |
| A skill | [`skills_sampler`](../../cartridges/skills_sampler/), [`levelling_sampler`](../../cartridges/levelling_sampler/) |
| Housing | [`build_sampler`](../../cartridges/build_sampler/) (structures), [`furnish_sampler`](../../cartridges/furnish_sampler/), [`property_sampler`](../../cartridges/property_sampler/) |
| Needs and statuses | [`needs_sampler`](../../cartridges/needs_sampler/), [`status_sampler`](../../cartridges/status_sampler/), [`sleep_sampler`](../../cartridges/sleep_sampler/) |
| A world event | [`schedule_sampler`](../../cartridges/schedule_sampler/), [`settle_sampler`](../../cartridges/settle_sampler/), [`raid_sampler`](../../cartridges/raid_sampler/) |

## Before release

`mise exec -- mix loka.compile cartridges/<name> out.json` refuses placeholders; the preview allows them.
