# Writing the game

The owner's loop for writing a cartridge by hand. Rules: [owner decision](../decisions/owner-decision-handwritten-prose-2026-10-31.md);
tool behaviour: [author preview](../system/cartridge.md#author-preview).

## Start the tools

Two terminals, from the repository root:

```sh
mise exec -- bin/loka dev cartridges/<name> --watch
cd mobile/app && npm run author
```

Open http://localhost:19006/?dev=1. The Book is the left two columns; the author column is the third.

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

Leave a line as `~` to come back to it; the column's Still to write lists every `~` by file.

## Jump to a beat

Play to the moment you want to work on, then in the column type a name under Checkpoints and
Save. Later, pick it from the list: the game starts over and replays to that point. Checkpoints
are files in `cartridges/<name>/checkpoints/`, committed with the cartridge.

## Read an error

A broken edit keeps the last good page; the column's first line says what broke, as
`error: rooms/cellar.json:12 unknown exit target "well"`. If a replay stops, the column names the
step (`step 4 refused: talk Maud`) and the Book stays where the replay got to. Alt-click (Option-click) any
Book line to open its source in your editor (`LOKA_EDITOR`, default `code --goto`). The column's
"Why" takes an action or dialogue key and explains the last recorded step: which rules fired and
why the action was missing or refused.

## Every kind of content

`mise exec -- bin/loka new <kind> <name> [cartridge dir]` (from any directory; the cartridge dir defaults to the current one) writes a
compiling file of that kind with every line a `~` placeholder, merged into the files it touches,
plus the capabilities it needs in `cartridge.json`; it prints what it wrote. A kind that refers
to another takes the first one you have and refuses with the command to run first. The shapes
come from the samplers; the rules from the [Builders' Guide](../BUILDERS-GUIDE.md#authoring-paths-and-examples).

Live preview is the same for every kind: a `text.json` edit reaches the page as you save; any
other file (a shop, a structure, a population) recompiles, reloads the page and replays your
recorded steps. An error reads as `error: <file>:<line> <what>` in the column's first line;
a compile diagnostic you run by hand reads as `CODE path` (`SCHEMA_VIOLATION rooms/well.exits`).

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
| `layout` | [`identity_sampler`](../../cartridges/identity_sampler/) | rooms; lists every room afresh, so run it again after adding rooms |
| `liquids` | [`buffs_sampler`](../../cartridges/buffs_sampler/) | nothing |
| `npcs` | [`access_sampler`](../../cartridges/access_sampler/) | a room |
| `populations` | [`boss_sampler`](../../cartridges/boss_sampler/) | a room; also writes the NPC, corpses, loot item, `hp`/`mv` resources, calendar, combat and death settings the engine requires |
| `quests` | [`chapters_sampler`](../../cartridges/chapters_sampler/) | an item (the objective is to hold it) |
| `reactions` | [`scars_sampler`](../../cartridges/scars_sampler/) | an item |
| `replenish` | [`decay_sampler`](../../cartridges/decay_sampler/) | an item, a room and an NPC |
| `resources` | [`affects_sampler`](../../cartridges/affects_sampler/) | nothing |
| `rooms` | [`rooms_sampler`](../../cartridges/rooms_sampler/) | nothing |
| `scenes` | [`scene_sampler`](../../cartridges/scene_sampler/) | a quest |
| `services` | [`durability_sampler`](../../cartridges/durability_sampler/) | an NPC and a resource (the currency); also writes the `use_service` action and the service text keys |
| `skills` | [`damage_sampler`](../../cartridges/damage_sampler/) | nothing |
| `statuses` | [`pen_sampler`](../../cartridges/pen_sampler/) | a resource |
| `structures` | [`craft_sampler`](../../cartridges/craft_sampler/) | nothing |
| `text` | [`speech_sampler`](../../cartridges/speech_sampler/) | nothing: `text.json` key `<name>` |
| `topics` | [`spells_sampler`](../../cartridges/spells_sampler/) | a fact |
| `transports` | [`fast_travel_sampler`](../../cartridges/fast_travel_sampler/) | a room, an NPC and a resource; also writes the far room and both legs |

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
