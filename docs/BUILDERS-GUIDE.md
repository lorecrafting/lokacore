# Builder's guide: authoring Loka today

Writing a cartridge by hand? Start at [writing the game](guides/writing-the-game.md). This page is
the agents' reference: source shortcuts, mechanics by kind, compile and coverage checks.

Loka currently has a file-based builder workflow. You write JSON source, compile it into a
versioned [cartridge](system/glossary.md), and play or replay the result. The compiler and
loader validate content before a world starts. A visual Builder app, live editing and arbitrary builder spawning are
[future work](system/future.md#authoring-and-certification). Authored bounded
[population plans](system/mechanics.md#c3-bounded-living-hounds-selected-contract) already
create and replace live NPC instances.

This is a route through the installed system, not a second specification. The
[cartridge source and validation rules](system/cartridge.md), [installed mechanics](system/mechanics.md),
[capability map](features.gen.md) and [protocol contracts](../protocol/README.md) govern details.

## The pieces

| Builder term | What you author | What the engine does |
|---|---|---|
| Cartridge | A manifest plus JSON files for a world or chapter | Compiles, hashes and pins the whole release and its capability lock |
| NPC and item definitions | `npcs/<key>.json`, `items/<key>.json` | Instantiates ordinary placements at world creation; population/death templates create their admitted instances with separate IDs and state |
| Room and detail | Places, exits and things to examine | Creates the map and resolves movement, visibility and targets |
| Fact and policy | Typed world values and conditions | Evaluates whether actions, dialogue and reactions apply |
| Action | A player action: a built-in command, or a scripted action with outcomes | Checks target and policy, then runs the command or its outcome's steps |
| Quest, dialogue, story point, scene | Story flow and presentation | Tracks objectives and choices, delivers outcomes and shows authored text |

These rules hold across every kind:

- A definition's displayed name is `name` (an item's, NPC's, room's, action's); an option the player
  picks (a dialogue or scene choice, a quest offer) has a `label`.
- A policy is its condition tree, and it is optional: an absent gate always holds, and an absent trigger (`disposition.hostile`, `friendly`) never fires.
- A story point is `story_point: "<key>/<outcome>"` on the dialogue choice that reaches it (a
  scene's `on_end` may also claim one); there is no story point file. Reaching one ends the talk.
- One `steps` list serves reactions, scripted action outcomes and dialogue choices; a service's `benefit`
  is one Step whose `op` the service context runs ([steps and checks](system/cartridge.md#steps-and-checks)).
- A dialogue choice's terms (`accept`, `hand_over`, `payment`, `patrol`) are fields; its effects are `steps`.
- One `Check` serves scripted actions and dialogue choices; a choice runs only `opposed`.
- Custom events are the one message between rules: an `event.emit` step in a reaction or scripted action emits a `custom_event`,
  and a reaction `on` `custom_event` with `custom: "<key>"` hears it.

The [glossary](system/glossary.md) distinguishes a definition from a live entity. A compiled
cartridge is an immutable release; changing source and recompiling creates a different content
hash. The [retired first chapter](https://github.com/lorecrafting/lokacore/blob/9b94cb5f094175727ff8cd7f7b26db44775c7a4d/docs/system/cartridge.md#retired-first-chapter-e1-candidate) owns its
release and oracle identity. Existing saves remain pinned to the release that created
them ([save model](system/save.md)).

## Cartridge layout

Read this before creating, moving or restructuring cartridge files. Rationale:
[area layout design](rnd/cartridge-area-layout-design-2026-11-04.md); rules:
[Area folders](system/cartridge.md#area-folders).

**Read the index first.** Every cartridge with an `areas/` folder carries a generated
`areas/INDEX.md`: each area's counts, the world's borders, the entry, and the root definitions two
or more areas name. Open it before any file; then the area you will touch has its own
`areas/<area>/INDEX.md` with its rooms, its definitions and what crosses its border. Both are
generated: never edit them, run `bin/regen.sh` ([content reports](system/cartridge.md#content-reports)).
Worked examples: [the showcase's](../cartridges/toolbox_showcase/areas/INDEX.md) and
[a bundle-only area's](../cartridges/speech_sampler/areas/INDEX.md).

```
cartridges/<id>/
  cartridge.json facts.json text.json layout.json   root files: one per world
  rooms/ npcs/ items/ reactions/ ...                root folders: shared by two or more areas
  areas/
    INDEX.md                                        generated: read this first
    hollow.json                                     optional: area hollow as one bundle file
    hollow/                                         area hollow: lowercase snake_case
      INDEX.md                                     generated: hollow's own contents
      rooms/ npcs/ items/ dialogues/ scenes/ ...    the same folders, owned by hollow
```

**The border rule.** A file in `areas/hollow/` may name its own things, anything at the root, and
any area's rooms; nothing else. Rooms are geography, so anyone may point at a place (an exit, a
schedule, a patrol); everything else (an NPC, an item, a quest, a behaviour, a parent named by
`extends`) is owned, and another area reaches it only through the root. The root may name
anything.

**Where a new thing goes.** Used by one area: in that area (`areas/hollow/npcs/wren.json`). Used by
two or more areas, or world-wide (statuses, skills, transport, a quest whose offer and reward sit
in two areas): at the root (`npcs/wren.json`). Text keys and facts stay in the root files.

**Moving a thing across a border.** Move the file; do not edit it. When a second area starts naming
`areas/hollow/items/lamp.json`, move it to `items/lamp.json`. Keys do not change, so saves stand, and
`content_hash` stands unless the moved room enters or leaves an area that a reaction `zone` names. The folder is an implicit zone: `"zone": "hollow"` on a
reaction with no `on.room` copies it to every Hollow room.

| The compiler says | Fix |
|---|---|
| `` `npcs/wren` belongs to the area `hollow`, and only that area and the root may name it. `` (`area_crossing`, also at `extends` and `behaviours[i]`) | Move `wren` to `npcs/`, or move the naming file into `areas/hollow/`. |
| `` The area `bestiary` has no room. `` (`area_empty`) | Add a room under `areas/bestiary/rooms/`, or move its files to the root folders. |
| `This area folder's name cannot be a key.` (`area_name`, `areas/Hollow`) | Rename the folder to lowercase snake_case. |
| `This file is in no folder the compiler reads.` (`UNKNOWN_FIELD`: an unknown folder, a deeper folder, or a `.json` directly in `areas/hollow/`) | Use a definition folder of the [Source layout](system/cartridge.md#source-layout); one level only. |
| `` `area` is not a field here. `` (`UNKNOWN_FIELD`: an `area` field) | Remove it: the folder is the area. |
| `This name or key is already taken.` (one key in two areas, or an area and the root) | Rename one; keys are global. |

`mix loka.lint` reads an area file as its root twin (`items/lamp.json: ...`) and runs the same
findings on it. Its area findings (orphan room, unreachable area, astray room) arrive with
loka-vduxr.58.3.

**No `area` field, no key prefix.** The folder already says the area; a field would be a second
copy that can disagree with it, and nothing in play needs it. Keys stay global so a file can move
without renaming anything; prefix a generic key (`well`, `gate`) only when you choose to.

## Make and try a cartridge

Start from a small development cartridge such as
[`recipe_sampler`](../cartridges/recipe_sampler/) for a composed action or
[`toolbox_showcase`](../cartridges/toolbox_showcase/) for a connected world. Copy its
source into a new cartridge directory before changing it, including its `cartridge.json`
manifest and `text.json` catalog. Give your new cartridge its own ID and version. Keep
references within that cartridge; the compiler resolves short keys by their expected kind.

From the repository root, with the pinned toolchain installed:

```sh
mise exec -- mix loka.compile cartridges/recipe_sampler /tmp/bell.json
mise exec -- bin/loka play /tmp/bell.json
```

The terminal player also accepts a script or a replay transcript:

```sh
mise exec -- bin/loka play /tmp/bell.json --replay cartridges/recipe_sampler/transcripts/scripted_action.jsonl
```

Use the transcript for the cartridge you compiled; see its `transcripts/` directory. A
failed compile prints diagnostics instead of an artifact. Validation covers schema and
capability locks, references, placements and capacities, dialogue/quest links, text keys
and other content relationships ([compiler checks](system/cartridge.md#compiler)). A
compiled artifact is checked again when loaded ([loader](system/cartridge.md#artifact-and-loader)).

## Preview an edit

The writer's loop (watcher, Book preview, panel) is in [writing the game](guides/writing-the-game.md);
its rules are the [author preview](system/cartridge.md#author-preview). Release, test and e2e builds
always use the pinned chapter ([`metro.config.js`](../mobile/app/metro.config.js),
[`bin/loka dev`](../kernel/ts/play/author.ts)).

The same compiled cartridge runs headless and in a scripted browser walk, so a sampler
([toolbox](MECHANICS-TOOLBOX.md)) is checked without a fixture of its own:

```sh
mise exec -- mix loka.compile cartridges/cellar_sampler /tmp/sampler.json
node kernel/ts/test/sim.ts --cartridge /tmp/sampler.json 1 2 3   # every seed on that cartridge
cd mobile/app && LOKA_WALK=build_sampler mise exec -- npm run walkthrough   # after bin/loka dev cartridges/build_sampler
```

The walk plays `mobile/app/walkthrough/<id>.walk.ts` on the author preview's artifact and writes
the contact sheet to `mobile/app/.walkthrough/contact-sheet.html`; without `LOKA_WALK` it plays
the toolbox showcase.

## Authoring paths and examples

| You want to make… | Source and working example | Engine behavior and limit |
|---|---|---|
| A place with exits or examinable details | `rooms/<key>.json`; [Bell cartridge rooms](../cartridges/recipe_sampler/rooms/) | [Movement and inspection](system/mechanics.md#movement1-kerneltssrcmechanicsmovementrulets); exits and targets must resolve. |
| An item, container, key or piece of equipment | `items/<key>.json`; [showcase items](../cartridges/toolbox_showcase/items/) | [Containment](system/mechanics.md#containment1-kerneltssrcmechanicscontainmentrulets), [barriers](system/mechanics.md#barrier1-kerneltssrcmechanicsbarrierrulets), [equipment](system/mechanics.md#equipment1-kerneltssrcmechanicsequipmentrulets) and carrying settings apply. |
| An NPC definition with HP | `npcs/<key>.json`; [one cellar rat](../cartridges/cellar_sampler/npcs/cellar_rat_1.json) | Its room and text are authored. HP is per entity; [resource rules](system/mechanics.md#resource1-kerneltssrcmechanicsresourcets) govern changes. A schedule is optional. An ordinary NPC definition creates one placement at fresh-world birth; a definition marked `spawn_template` supplies a population/death template and is not placed directly. |
| An NPC's mood ("a cowering goblin") | `name_variants` and `description_variants` on the NPC, each `{when, description}`; [the den goblin](../cartridges/toolbox_showcase/areas/traps/npcs/den_goblin.json) | The first variant whose `when` holds replaces the name or description where the Book shows it ([W6](system/mechanics.md#entity-description-variants-toolbox-row-w6)); the room line has no variants. A line the NPC does now and then is an ambient emote (Beads `loka-8ghm`), a gesture an emote (`loka-kgd.193`); both are separate tools, not built yet. |
| A fact or condition | `facts.json`, with each policy inline where it is read; [showcase facts](../cartridges/toolbox_showcase/facts.json) | Typed facts and pure policies drive eligibility; see [policy and fact](system/mechanics.md#target_resolution1-policy1-fact1). |
| A player action | `actions/<key>.json`; [ring the bell](../cartridges/recipe_sampler/actions/ring_bell.json) | With `command`, the action names a built-in command; without it, a target, policy, optional check and `success`/`failure` outcomes whose `steps` use registered ops; see [scripted actions](system/mechanics.md#scripted_action1-mechanicsscripted_actionrulets49). No arbitrary script runs. |
| A quest and conversations | `quests/<key>.json`, `dialogues/<key>.json`; [the wizard's errand](../cartridges/toolbox_showcase/areas/magic/quests/errand.json), [its offer](../cartridges/toolbox_showcase/areas/magic/dialogues/wizard_errand.json) | A choice can accept or resolve the quest; [quest](system/mechanics.md#quest1-mechanicsquestrulets-kerneltssrcmechanicsquestlifecyclets) and [dialogue](system/mechanics.md#dialogue1-mechanicsdialoguerulets-kerneltssrcmechanicsdialoguesharedts) document the supported objective and choice forms. |
| Definitions that share most fields | `"extends": "<key>"` and `"abstract": true` in any definition file; [shoo's deer and crow](../cartridges/shoo_sampler/npcs/); `bin/loka new <kind> <name> --extends <key>` starts a child | The compiler merges the parent in before anything else reads the source ([Source shortcuts](system/cartridge.md#source-shortcuts)): objects merge, everything else replaces, and the artifact is unchanged. |
| A family of definitions that differ in a few values | `"params"` on the abstract parent with `{"param": "<name>"}` markers, `"with"` on each child; [the showcase wheel](../cartridges/toolbox_showcase/reactions/wheel_shows.json) and [one child](../cartridges/toolbox_showcase/reactions/wheel_1_x_shows_0.json) | Each marker is replaced whole by the child's value, then the child merges over the parent ([Source shortcuts](system/cartridge.md#source-shortcuts)). |
| The same reactions on many NPCs or items | `behaviours/<name>.json` and `"behaviours": ["<name>"]` on each holder; [the fishing spoils](../cartridges/fishing_sampler/behaviours/spoils.json) on [a trout](../cartridges/fishing_sampler/items/trout_02.json) | The compiler copies the reactions per holder, with `holder` bound to it ([Source shortcuts](system/cartridge.md#source-shortcuts)). |
| An area | a folder `areas/<area>/` of the folders above, or one bundle file `areas/<area>.json` of the same definitions; [the showcase's areas](../cartridges/toolbox_showcase/areas/), [the speech village in one file](../cartridges/speech_sampler/areas/village.json) | `bin/loka new area <name>` starts the folder with a first room. A file in an area names its own things, the root and any area's rooms; a second area's NPC, item or quest is reached through the root ([the border rule](#cartridge-layout)). A bundle compiles to ordinary definitions before anything else reads the source ([Source shortcuts](system/cartridge.md#source-shortcuts)): diagnostics name the bundle path, and the artifact is unchanged. |
| One rule for many rooms | `"zones"` on rooms and `"zone"` on a reaction; [codex wanderer](../cartridges/codex_sampler/reactions/wanderer.json) | The compiler copies a zone rule per member room ([zones](system/cartridge.md#source-shortcuts)). |
| A consequence that plays out over time | `{"op": "wait", "seconds": <n>}` in a reaction's `steps` | The compiler splits the list into delayed rules ([waits](system/cartridge.md#source-shortcuts)) |
| A consequence or story presentation | `reactions/<key>.json`, a dialogue choice's `story_point`, `scenes/<key>.json`; [bell scene](../cartridges/scene_sampler/scenes/bell_rung.json) | [Reactions](system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts), [chapters](system/mechanics.md#chapters-kerneltssrcviewviewts) and [scenes](system/mechanics.md#scene1-mechanicsscenerulets) have bounded, typed triggers and steps. |
| A scene that opens play | `scenes/<key>.json` with `"on": {"start": true}` and `"control": "modal"` (one per cartridge); [opening dream](../cartridges/opening_sampler/scenes/dream.json) | Play starts on its first line before any room page; its last Continue shows the entry room ([scene@1](system/mechanics.md#scene1-mechanicsscenerulets)). |

Put player-facing words in `text.json` and reference their keys from NPC, item and story
definitions ([text rules](system/cartridge.md#text)), or write them in place as
`{"prose": "<words>"}`; the compiler lowers each to a generated key
([inline prose](system/cartridge.md#source-shortcuts)). Put tunable costs, resource bounds and
other world numbers in cartridge data, not engine code ([world parameters](world-parameters.md)).

To check content, replay its transcripts: `node kernel/ts/play/coverage.ts <artifact> [<transcript.jsonl> ...]`
lists the definitions that no transcript exercises
([transcript coverage](system/cartridge.md#transcript-coverage-loka-kgd1942)), and
`node kernel/ts/play/why.ts <artifact> <transcript.jsonl> <ordinal> [--action <key> | --dialogue <key>]`
says why a rule did or did not run at that step ([rule explainer](system/cartridge.md#rule-explainer-loka-kgd1943)).

## What the current builder can express

The [toolbox page](TOOLBOX.gen.md) lists every installed mechanic with what it does, what you
declare, its sampler cartridge and its showcase district; read it before asking for a new mechanic.
[Mechanics](system/mechanics.md) has the exact behavior. The [field guide](FIELD-GUIDE.gen.md) lists each kind's fields
with what each does, its allowed values and a sampler file that sets it.

Before a district or area plan, read the [area authoring checklist](guides/area-authoring.md).

## Story patterns

Each pattern below is one short, checkable recipe: the pattern in a line, the keys it needs, a
tiny example whose words are `~` placeholders (you write the words), and the check that proves
your copy works. They come from the [2026-11-04 adoption shortlist](rnd/prologue-adoption-shortlist-2026-11-04.md),
and each mechanic was verified against [mechanics](system/mechanics.md) and a sampler before it
was written here. The shortlist's engine claims were unchecked; where one did not hold, this
page says so instead of inventing a recipe.

### Act now, hear it later

A choice sets a fact; one or two later NPCs read it back in a line, and a return visit shows the
change. No combination matrix.

- **Keys:** a fact in `facts.json`; `fact.assign` on the choice that sets it; a `reaction` on
  `fact_changed` whose `when` is a `fact_compare`.
- **Example.** The choice sets `scene_letter_read` to 1. A standing counter reads it back:

  ```json
  {
    "on": {"event": "fact_changed", "fact": "scene_letter_read"},
    "when": {"op": "fact_compare", "fact": "scene_letter_read", "equals": 1},
    "steps": [{"op": "fact.adjust", "fact": "wardle_standing", "amount": 1}]
  }
  ```

  A later NPC's greeting reads `wardle_standing` with `fact_compare` and narrates one of two lines.
- **One line, read back later:** a reaction's `steps` may hold `{"op": "wait", "seconds": <n>}`,
  which the compiler splits into a delayed rule ([waits](system/cartridge.md#source-shortcuts)).
- **Check:** replay a transcript that reads the letter, then talk to the NPC;
  `node kernel/ts/play/why.ts <artifact> <transcript.jsonl> <ordinal>` says whether the
  `fact_changed` rule fired at that step.
- **Verified by:** [showcase `letter_read_after.json`](../cartridges/toolbox_showcase/reactions/letter_read_after.json)
  and its `letter_late.json`.

### Regard shown, never scored

Hidden standing changes a greeting, a description or an emote at two or three moments; fame and
infamy stay separate facts so no single score has to mean both.

- **Keys:** one fact per kind of regard in `facts.json`; `fact_compare` in an NPC's
  `description_variants`/`name_variants` `when`, or in a reaction's `when`.
- **Example.** A greeting variant that appears only once the player is trusted:

  ```json
  "description_variants": [
    {"when": {"op": "status_active", "subject": "target", "status": "afraid"},
     "description": "npc.goblin.description_afraid"}
  ]
  ```

  The first variant whose `when` holds replaces the NPC's description
  ([W6](system/mechanics.md#entity-description-variants-toolbox-row-w6)). The room line has no
  variants, so put regard on the description or a reaction line, never the room line.
- **Check:** the variant sampler pairs each `when` with a value the default cannot produce, so a
  test that passes with the variant deleted proves nothing; replay a transcript that reaches the
  threshold and confirm the changed line at that ordinal.
- **Verified by:** the [den goblin](../cartridges/toolbox_showcase/areas/traps/npcs/den_goblin.json)
  and `description_variants` in the variants sampler.

### Quest rewards that are verbs, not loot

A resolved quest opens a path or teaches a recipe for good, rather than dropping an item.

- **Keys:** `quests/<key>.json` with objectives that a dialogue resolves; a `reaction` on
  `quest_resolved` whose steps are `barrier.set` (open a path) or a recipe grant.
- **Example.** Resolving the errand lifts a barrier:

  ```json
  {
    "on": {"event": "fact_changed", "fact": "warden_lets_pass"},
    "when": {"op": "fact_compare", "fact": "warden_lets_pass", "equals": true},
    "steps": [{"op": "barrier.set", "barrier": "toll_gate", "to": "open"}]
  }
  ```

  The barrier's own name is the `barrier` field, and `to` takes `open` or `shut`; a quest that
  resolves can set the fact the rule reads, or share the rule's `when`.
- **Check:** replay the transcript that resolves the quest; `coverage.ts` lists a quest or
  barrier no transcript exercised, and `why.ts` names the step where the rule did not run.
- **Verified by:** [`gate_lifted.json`](../cartridges/toolbox_showcase/areas/low_wardle/reactions/gate_lifted.json)
  (the form above) and [the wizard's errand](../cartridges/toolbox_showcase/areas/magic/quests/errand.json)
  for the quest side.

### A check that fails into words, then a second way through

Two things a check can do when it fails, both verified: name the failure, or leave the player a
second route. Neither is a dead end.

- **A check with its own failure line.** Every choice that carries a `check` names a `failure`
  line, and its `steps` run only on success:

  ```json
  "persuade": {
    "label": "dialogue.guard.persuade",
    "narration": "narration.guard.persuade",
    "steps": [{"op": "fact.assign", "fact": "gate_open", "value": true}],
    "check": {"key": "persuade_guard", "kind": "opposed", "attribute": "cha",
              "npc": "guard", "failure": "narration.guard.persuade_failed"}
  }
  ```

  A sibling choice `intimidate` sets the same `gate_open` by a `skill` check with a `rating`, so
  the gate opens either way, and the words differ ([`guard.json`](../cartridges/persuade_sampler/dialogues/guard.json)).
- **A quest whose objective is a check.** A quest objective holds the same `skill_compare` a
  choice's `policy` does, and a dialogue can `skill.acquire` on success
  ([`old_carver_carpentry.json`](../cartridges/craft_sampler/dialogues/old_carver_carpentry.json)).
- **Check:** replay one transcript per route; `coverage.ts` names a choice no transcript ever took.
- **Not available:** `then_failed` — opening a *different scene* on failure — is in
  [DialogueChoice](contracts.gen.md) but **no sampler or cartridge uses it**, so this page cannot
  show a working example and no check proves a copy works. The `failure` line above is the
  supported form today.

### Every carried seed pays off

Anything the player can pick up and carry for a long time needs a reaction that does something
with it, so a seed is never dead weight in the pack.

- **Keys:** a `reaction` whose `on.event` matches when the item's moment comes, and `item.move` in
  its steps to put it down somewhere.
- **Example.** When a `spoiling` status expires, the food leaves for the midden:

  ```json
  {
    "on": {"event": "status_expired", "status": "spoiling"},
    "steps": [{"op": "item.move", "room": "midden"}]
  }
  ```

  ([`spoil.json`](../cartridges/decay_sampler/reactions/spoil.json).) A carried item's other payoff
  is a `story_point` (see below), which needs no room to move it to.
- **Check:** `coverage.ts` lists an item no transcript ever moved or used.

### Rest that plays what is due

A `rested` trigger fires on the room you name, so a night can carry a dream, a status or a line
without the player having to remember to go anywhere.

- **Keys:** `statuses/<key>.json` describing the effect, and a reaction on `rested`.
- **Example.** A hut with a bed gives `well_rested`:

  ```json
  {"on": {"event": "rested", "room": "hut"},
   "when": {"op": "item_present", "tag": "bed"},
   "steps": [{"op": "status.apply", "status": "well_rested"}]}
  ```

  The status itself is data, not code: `duration` in seconds, an optional `tick_every`, the
  `resource` it moves and `per_tick` ([`well_rested.json`](../cartridges/furnish_sampler/statuses/well_rested.json)).
  A dream at rest is a scene the same trigger opens, as the sleep sampler's `hound_dream` does.
- **Check:** replay a transcript that rests in the room and confirm the status at that ordinal.

### One new line per death, once per visit

The shrine keeper says a fresh line for each death the player has died, and stays quiet when they
wake somewhere he is not. This one is worth copying whole rather than paraphrasing.

- **Keys:** a player-scope death-count fact (`keeper_greeted`), a `resource_compare` on the
  subject's `hp` that skips NPC deaths, an `npc_present` gate, and one `narrate` step per line.
- **Why the hp comparison is there.** On a death event the subject is the victim, and the keeper's
  tally must count the *player's* death, not a rat's. The showcase documents the composition
  ([death lines](system/mechanics.md#death-lines-outside-a-combat-round-loka-3w3q)) as: a
  player-scope fact tallies deaths, `resource_compare` on the subject's `hp` skips NPC deaths, and
  `npc_present` keeps him silent when the body wakes elsewhere.
- **Example** ([`keeper_line_1.json`](../cartridges/toolbox_showcase/areas/tidewater/reactions/keeper_line_1.json)):

  ```json
  {
    "on": {"event": "entity_died"},
    "when": {"op": "all", "items": [
      {"op": "npc_present", "npc": "keeper"},
      {"op": "resource_compare", "resource": "hp", "subject": "subject", "at_least": 1},
      {"op": "fact_compare", "fact": "keeper_greeted", "equals": 0}
    ]},
    "steps": [{"op": "narrate", "text": "npc.keeper.revived_1"}]
  }
  ```

  The tally itself is a silent reaction on the same event
  ([`keeper_tally.json`](../cartridges/toolbox_showcase/reactions/keeper_tally.json)) with
  `"silent": true`.
- **Check:** the showcase transcript `walk_combat.jsonl` contains a real `entity_died` whose
  `fact_changed` sets `keeper_greeted` to 1, so this path is exercised, not just declared.

### Asides and room lines that change on a return visit

A dry second-person line on failure, on an odd act or on a death; a "familiar" room line once the
player has been there. Both are authored words selected by a condition, not new engine.

- **Keys:** a `description_variants` (or `name_variants`) entry whose `when` holds, or a reaction
  that narrates.
- **Where it may go:** an NPC's description or name takes variants; **the room line does not**
  ([W6](system/mechanics.md#entity-description-variants-toolbox-row-w6)). A room's returning
  line is therefore a reaction on entry, not a variant.
- **Check:** the variant must be paired with a value the default path cannot produce, or a test
  that passes with the variant deleted proves nothing.

### A mark kept from a hard moment

A title, mood or scar that later lines can read. It is a fact plus the same variant and reaction
machinery as above, so there is no separate mechanic to learn.

- **Keys:** a fact set by the reaction on the hard moment, read later by `fact_compare` in a
  variant, a reaction's `when`, or a choice's `policy`.
- **Check:** as with regard, replay the transcript through the moment and confirm the changed line.

### Not written yet

- **Two ways past every gate** (row 2) and **word gets around** (row 10) are the remaining
  shortlist rows with engine work worth checking first: barriers and `barrier.set` exist (see
  *Quest rewards that are verbs*), but pick/force and the witness ledger were not verified here.
  Check them before writing a recipe rather than trusting the shortlist.
- **Failure opens a *scene*** (row 1's stronger form) stays blocked: `then_failed` has no user
  anywhere in the repo. The `failure` line above is what works today.
