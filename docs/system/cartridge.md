# Cartridges: source, compiler, artifact, loader

## Source layout

A cartridge source is a directory of JSON files (`lib/loka/content.ex:2`). The cartridge packages
its NPC and item definitions with the rest of the world's definitions and text:

| File | Holds |
|---|---|
| `cartridge.json` | the manifest: `api_version`, `id`, `version`, `title`, `requires` (`kernel_api {at_least, below}`, `content_schema`, `rule_ir`, `capabilities {key: version}`, `client_features`), `supported_profiles`, optional `entry` room, `calendar {start}` (`cartridges/lantern_proof/cartridge.json`) and `world {movement {cost {resource, amount}}, bands}`: what a move costs and the cartridge's default condition bands; optional `chapters [{name, story_point?, outcome?}]` ([Chapters](mechanics.md#chapters-kerneltssrcviewviewts)) |
| `facts.json` | `{"facts": {name: FactSpec}}`; a dotted name maps to a snake_case key, two names mapping to one key is `FACT_NAME_COLLISION` |
| `text.json` | the TextCatalog: key → string |
| `resources.json` | overrides of the default pools' fields, or further ResourceSpecs, each with optional condition `bands [{at_percent, key, tone}]` (`lib/loka/content/resources.ex:2`) |
| `attributes.json` | `{"attributes": {key: {start}}}`: the cartridge's attributes (AttributeSpec without `key`; an authored `key` is `UNKNOWN_FIELD`), definition `start` supplies the fallback; [D11](mechanics.md#d11-character-choice-selected-contract) saves the selected character's values ([mechanics.md](mechanics.md#attribute1-kerneltssrcmechanicspolicyts60); `lib/loka/content/resources.ex:2`) |
| `layout.json` | static drawing metadata for rooms; real room exits remain the graph (`lib/loka/content/layout.ex:2`) |
| `rooms/`, `items/`, `npcs/`, `barriers/`, `quests/`, `dialogues/`, `reactions/`, `scenes/`, `actions/`, `skills/`, `topics/`, `liquids/`, `populations/`, `replenish/`, `services/`, `transports/`, `bleeds/`, `statuses/`, `structures/` | one file per definition, `<key>.json`, the frozen shape without `key` |
| `actions/<key>.json` | a player action, one of two shapes chosen by one field: with `command`, an action that names a built-in command (ActionDefinition); without it, a scripted action whose `outcomes` the author writes (ScriptedAction, `scripted_action@1`, [mechanics](mechanics.md#scripted_action1-mechanicsscripted_actionrulets49)). The compiler routes the file by `command` before any other stage reads it; the artifact keeps its `actions` and `scripted_actions` maps and ref kinds ([Actions with outcomes](#source-shortcuts)) |
| `rooms/<key>.json` `zones` | source only: `["<Key>", ...]`, the zones the room belongs to; the compiler strips it ([Source shortcuts](#source-shortcuts)) |
| `behaviours/<name>.json`; `npcs/` and `items/` `behaviours` | source only: `{"reactions": {"<rule>": ReactionRule without key}}`, and the NPC's or item's `["<name>", ...]` (or `{"behaviour": "<name>", "with": {...}}` entries); the compiler expands each to copies and strips both ([Source shortcuts](#source-shortcuts)) |
| `areas/<name>.json` | an area bundle: several definitions of any of those directories in one file, `{"<dir>": {"<key>": definition without key}}` ([Source shortcuts](#source-shortcuts)) |

`requires.kernel_api` is a range `{at_least, below}` with `at_least < below` (`KERNEL_API_RANGE_INVALID` at `cartridge.requires.kernel_api`, compiler); the loader refuses an installed API outside it (`KERNEL_API_UNSUPPORTED`). `at_least` rises only when the content uses a newer kernel feature; a contract bump alone changes `INSTALLED.kernel_api` and never a cartridge (the save pin carries the kernel_api, [save.md](save.md#opening-a-story); loka-daha). Floors raised by contract bumps before loka-daha (the dialogue cartridges at 1.124, the showcase at 1.126; 2026-10-30) stand; they are not lowered. No field carries its own floor; a cartridge released later states the API it was compiled against here.

A reference is a full DefinitionRef naming this cartridge, or short: the key alone, of the kind
its field takes (`Loka.Content.Resolve.expand/2`, `lib/loka/content/resolve.ex:37`). A `.json`
file outside these recognized root files and definition directories is `UNKNOWN_FIELD`. A
definition may sit in an area bundle, may name a parent of its own kind with `"extends"` and may
be marked `"abstract": true`; the compiler opens bundles and flattens the rest away first
([Source shortcuts](#source-shortcuts)). A
source with rooms, text or an entry compiles to
`loka-cartridge-v2`; v1 (manifest, facts, actions) is the R4 form.

## Current bundled chapter

The shared app bundles the [toolbox showcase](../SHOWCASE.md), `toolbox_showcase`, as its
chapter: the [artifact](../../protocol/fixtures/toolbox_showcase_hash.json) compiled from
`cartridges/toolbox_showcase`, under the
[retirement decision](../decisions/owner-decision-retire-first-chapter-2026-10-21.md). The
first release will bundle the real game's chapter. The app's save has one fixed name,
`loka-showcase.db` (the web build keeps a storage slot per save file); after a content change or a kernel_api bump the
app shows the pinned-release refusal with [explicit Start over](save.md#opening-a-story), with no
save compatibility in pre-production.
Earlier saves, the retired chapter's save included, stay on the device untouched and
are never deleted.
The app opens only the chapter file and offers no story picker. Missing pins follow
[explicit Start over](save.md#opening-a-story), without automatic deletion or migration.

## Carrying settings and item mass

An authored `world.carry = {max_grams: nonnegative safe integer}` opts a v2 cartridge into
[voluntary carrying admission](mechanics.md#containment1-kerneltssrcmechanicscontainmentrulets).
There is no engine carrying default. `ItemDefinition.mass_grams` is an optional nonnegative
integer at most 2147483647; with carry opted in, every item definition must author it, including
nested items. Explicit zero is valid; omission never means zero under opt-in. Missing mass is
`SCHEMA_VIOLATION` with `data.error = missing_property` at the item's `mass_grams`; schema
validation rejects malformed, negative or out-of-range mass and carry settings. The compiler
enforces the same requirement before any world or save mutation. Without carry, old
content, hashes and carrying behavior retain their existing meaning.

Carry requires `containment@1`. This extension
uses the existing containment capability and source/world settings seams, without a new
capability or format tag.

Room details may embed `readable {label, text}` under the `readable@1` lock; both
fields resolve to catalog TextKeys in the compiler. Optional `readable.title` supplies
a noun page title; absent titles fall back to the label for older fixture content. Ferry
Landing retains its direct notice; Drowned Lantern groups two readable sibling notices under
its rumor board.

## Notice-board metadata

An inspectable detail may declare `notice_board: {title: TextKey, notices:
[{detail: Key, title: TextKey}]}`. The ordered list has 1–64 entries (the existing room-detail
ceiling), all distinct, each naming an ordinary readable sibling in the same room. Self,
missing, non-readable and board references are rejected as `UNRESOLVED_REFERENCE` at the
notice's `detail`; duplicate references are rejected at their repeated `detail`. A board
itself cannot also be readable (`UNRESOLVED_REFERENCE` at `notice_board`). Its title and
every notice title resolve in the catalog. Board metadata requires the existing readable@1
lock. These are local detail Keys, not DefinitionRefs or recursive document nodes. Grouped
notices are reached through their board; room touch-link warnings require the board and
standalone details, without requiring separate room links to its children.

The chapter's Lost tin whistle body is “Lost a tin whistle? Ask at the Drowned Lantern.”;
Help in the cellar says “Maud needs help clearing rats from the cellar. Speak to her at the
bar.” Reading either grants no quest, fact or reward.

## Compiler

`mix loka.compile <source dir> <artifact path>` (`lib/mix/tasks/loka.compile.ex:12`) writes
the artifact and prints warnings as JSON lines, or prints every diagnostic and exits 1.
`Loka.Content.compile/2` (`lib/loka/content.ex:38`) runs the stages on the parts earlier
stages accepted, so one bad file hides no other diagnostic; diagnostics are unique and sorted by
path, code, then canonical text (`:73`). The artifact is the canonical encoding of
`{"cartridge": …, "content_hash": sha256(canonical cartridge)}` (`:53`), at most 4 MiB
(`ARTIFACT_TOO_LARGE`, `:67`). Every v2 cartridge gets the pools hp, ma, mv and
`resource@1` and `schedule@1` in its lock, with or without `resources.json`
(`lib/loka/content/resources.ex:141`, `def requires`); the engine defaults are hp 0..20 start 20 gain 5, ma
0..100 start 100 gain 4, mv 0..82 start 82 gain 18 per game hour (`:15`), and
`minimum <= start <= maximum` else `RESOURCE_SPEC_INVALID`. Without `world`, a move costs 1 mv
and every pool takes the engine default band table ([protocol.md](protocol.md#gameview)); the
compiler writes `world` and `bands` only where the source authors them.

An optional `NpcDefinition.hp` contains exactly `minimum`, `maximum`, `start`, and `gain`
for the cartridge's existing hp pool. Bounds/start are ResourceInt; gain is a nonnegative
ResourceInt. The compiler requires `minimum <= start <= maximum`
(`RESOURCE_SPEC_INVALID`). No bands, regen, key or arbitrary pool map is accepted.
Missing hp preserves legacy behavior. Presence requires resource@1. Older-development compatibility is not required under the [owner policy](../decisions/owner-decision-forward-development-2026-10-05.md). Runtime definition and
row semantics live in [resource@1](mechanics.md#resource1-kerneltssrcmechanicsresourcets).


A ResourceSpec may opt into `regen {every, by_position}`. `every` is a positive safe integer;
`by_position` requires all four keys `standing`, `sitting`, `resting`, `sleeping`, each a
nonnegative ResourceInt gain per interval (zero allowed). The compiler enforces
`every <= floor(9007199254740991 / (max_authored_rate + 1))` (`RESOURCE_SPEC_INVALID` at
the pool's `regen`) and require `position@1` (`UNDECLARED_CAPABILITY` at `regen`)
and `time_policy.profile=real_elapsed` (`INVALID_TIME_POLICY` at `regen`).
`gain` remains required for
legacy compatibility and is ignored for opted recovery; no new capability or numeric
profile version is introduced. The active chapter consumes this opt-in under the
[M2 adoption](../decisions/pm-decision-m2-a-position-recovery-2026-10-04.md).
A cartridge whose manifest requires `position@1` gets the engine fact
`<id>@<version>:fact/position`, exactly `{"key": "position", "version": 1, "value_type":
{"type": "enum", "values": ["standing", "sitting", "resting", "sleeping"], "default":
"standing"}, "scopes": ["player"], "meaning": "The character's position (position@1): only its
rule writes it."}`, and `fact@1` in its requires and lock, since its rule's `fact.assign` logs
`fact_changed` (`lib/loka/content/position.ex`). Without position@1 a fact named `position` is
the cartridge's own. The compiler validates authored capability versions before adding this
dependency, and includes it in the effective requirements before checking content ownership.

A cartridge requiring scene@1 gets one engine FactSpec per scene and fact@1, as
specified byte-exactly in [scene@1](mechanics.md#scene1-mechanicsscenerulets). The compiler
validates authored requirements before adding this dependency. The source scene key
is at most 58 characters, so `scene_<key>` remains a Key.

What the compiler checks (`lib/loka/content/*.ex` moduledocs; codes in
`protocol/cartridge.schema.json` DiagnosticCode):

- every command, policy op, definition kind and event the cartridge uses has its owner in the
  lock (`UNDECLARED_CAPABILITY`); an action's command is never `run_job`;
- every reference resolves to a definition of this cartridge and of its field's kind
  (`UNRESOLVED_REFERENCE`); a fact value matches its FactSpec (`FACT_TYPE_MISMATCH`,
  `FACT_DEFAULT_INVALID`); every text key has a catalog entry, including each of a quest's five `journal` stage texts
  and every `journal.outcomes` value;
- an action's, quest's or dialogue's key is no registered command's and no other action's
  or quest's (`DUPLICATE_DEFINITION`: each is an ActionSet identity); an NPC may speak
  several dialogues; no dialogue role named `actor`; a choice's `accept` names a quest, in a
  dialogue without a `quest`, on a choice without a `hand_over` (`OUTCOME_MISMATCH`); an action with outcomes has a `failure` outcome exactly when it has a
  check (`content_dusk_test.exs`); `time_window` needs `schedule@1` and a non-empty window
  (`EMPTY_TIME_WINDOW`); a schedule needs `schedule@1` and a calendar `calendar@1`;
- `calendar` may author a nonnegative multi-day `start`, positive `units_per_hour` and
  `hours_per_day`, a positive `subdivisions_per_hour` dividing the hour, and ordered solar
  and lunar cuts. The compiler checks safe day arithmetic, cut order and bounds,
  schedule keys and time-window endpoints against the authored day. Solar and lunar phases
  are labels, not engine values; the current chapter authors the complete cycle;
- attributes (`attributes.json`, the artifact's `attributes`) need `attribute@1` in the lock, as
  do the policy leaves `stat_compare` and `resource_compare`, whose `attribute` or `resource`
  names an attribute or a pool of this cartridge (the compiler);
- condition band tables (a pool's `bands`, `world.bands`): cuts strictly descending, the last
  0 and keys unique within the table, else `RESOURCE_SPEC_INVALID` at the table; each key has
  `band.<key>` in the catalog; `world.movement.cost` names a pool of this cartridge
  (`UNRESOLVED_REFERENCE`);
- item receptacles explicitly declare `container: true`; absence means no children. Only
  receptacles may declare `capacity` or a lid `barrier` (`SCHEMA_VIOLATION` at the
  contradictory field). An initial item location must name a receptacle
  (`SCHEMA_VIOLATION` at `location.item`). NPC and body custody is unchanged.
- items and NPCs start somewhere real with no containment cycle and within capacity
  (`CONTAINMENT_CYCLE`, `CAPACITY_EXCEEDED`); details are reachable (`UNREACHABLE_DETAIL`);
- barriers: each exit's barrier and its reciprocal face name the same one (`BARRIER_MISMATCH`);
  an item's `barrier` (a container's lid, c1-locks) names a barrier (`UNRESOLVED_REFERENCE`)
  that no exit and no other item names (`BARRIER_MISMATCH` at the item's `barrier`); no locked
  barrier on an exit of a reachable room or on an item in reach has a key that is never in reach
  (`BARRIER_UNREACHABLE_KEY`, also for a locked one with no `key_item`;
  `lib/loka/content/barriers.ex:2`). Reach starts at the entry; an item is in reach when it
  starts in a reached room or inside an item in reach whose barrier is absent, not locked, or
  locked with its key in reach (never inside an NPC). The compiler rejects only keys that can never
  be reached (its own key inside a locked chest, circular keys); every other case is a runtime
  refusal (barrier@1, containment@1);
- under position@1 the position fact is the engine's: an authored fact named `position`
  (`facts.facts.position`) and a `fact.assign` of it in an action's outcome, a reaction's `steps` or
  a dialogue choice are `RESERVED_FACT` (at the fact, `actions/nap.outcomes.success.steps[0].fact`);
  reading it is allowed;
- scenes: each `on.story_point` resolves and its `on.outcome` names one of that point's
  keys; every narrate text is catalogued (`UNRESOLVED_REFERENCE`, data.target the full
  story-point reference string, outcome key or text key). Steps must be narrate×n
  (n ≥ 1), await_ack, end: the first misplaced `.steps[i].type` is SCHEMA_VIOLATION
  with data.error `not_in_enum`; closed SceneStep schema rejects unknown step types
  as `unknown_variant` before this ordered check. No steps minimum count preempts it.
  Two scenes naming the same story-point/outcome are DUPLICATE_DEFINITION, data `{}`,
  at each colliding scene's `on` in the compiler (`scenes/<key>.on`). Under scene@1, an authored
  `scene_<key>` fact (`facts.facts.scene_<key>`) and each action, reaction or dialogue
  fact.assign of it are RESERVED_FACT at the same write-site paths as position;
  fact_compare and reaction on.fact reads remain legal;
- story points: there is no story point file. A dialogue choice's `story_point: "<key>/<outcome>"`
  and a scene's `on_end` declare the point's outcomes, and the point is located at its first
  claim. A second claim of one outcome is `DUPLICATE_DEFINITION` at its site
  (`dialogues/<d>.choices.<c>.story_point` or `scenes/<s>.on_end`); a claiming choice's dialogue
  resolves a quest (`OUTCOME_MISMATCH` at the choice's `story_point`); a scene-claimed key is at most
  52 characters (`SCHEMA_VIOLATION` at `scenes/<s>.on_end.story_point`); a point needs dialogue@1
  (`UNDECLARED_CAPABILITY`, `lib/loka/content/dialogues.ex`);
- policies: a policy is its condition tree inline (`protocol/policy.schema.json` `Policy`); no
  policy field is required; an absent gate holds, and an absent trigger
  (`disposition.hostile`, `friendly`) never fires;
- chapters: a non-empty ordered list; chapter 0 has neither `story_point` nor `outcome`
  (`UNKNOWN_FIELD` at that member), and every later chapter has `story_point`
  (`SCHEMA_VIOLATION`, `data.error: missing_property`, at that member); each title has a
  catalog entry, each story point resolves and each selected outcome names one of its keys
  (`UNRESOLVED_REFERENCE`, `data.target` the text key, full reference string or outcome key).
  A counted trigger whose dialogue's quest and choice id are also named by another dialogue
  is ambiguous (`OUTCOME_MISMATCH`, data `{}`, at `cartridge.chapters[i].story_point`). Only the
  selected outcome is counted when `outcome` is declared; otherwise all are. These checks
  implement [Chapters](mechanics.md#chapters-kerneltssrcviewviewts), using the existing diagnostic
  code, without changing dialogue or quest rules;
- touch links in catalog strings: `[words]` links the thing whose text it is, and `[words]` followed by
  `(key)` a detail, item or NPC; an unresolved target is an error; a room description or room line without
  a link to its visible details or entity is a `TOUCH_LINK_MISSING` warning
  (`lib/loka/content/links.ex:2`).

Each development cartridge compiles to its independent known answer
(`protocol/fixtures/cartridge_<name>_hash.json`, derived by `test/loka/cartridge_lantern_hash.py`
for the Lantern; `test/loka/content_*_test.exs`).

Static locked-barrier reachability also treats an item as potentially obtainable when it
starts directly held by the NPC named by an authored receive choice, the bound item matches,
and that NPC and the dialogue speaker start in the same reachable room. This is an authoring
potential check, not proof that quest/policy/carry conditions will be met. Unreachable speakers,
wrong custody, and keys behind inaccessible rooms or lids retain the lockout diagnostic.

Dialogue `receive` role references must name an item and NPC and exclude accept/hand_over.
A receive needs no resolving quest.
Optional item `give_allowed: false` refuses Give; absence preserves ordinary Give. Dialogue `fact.adjust` must name a bounded integer fact, never
a reserved engine fact. Both validators enforce references, types and ownership; source short
fact references expand for this new spelling. Current bundled content follows the [chapter pin](#current-bundled-chapter).
there is no per-feature minimum-version detector for legacy quest-resolving receive, fact.adjust or Put under the
[pre-production policy](../decisions/owner-decision-forward-development-2026-10-05.md). Generic manifest range/schema validation remains. An unknown dialogue choice step `op`
reports `unknown_variant` (the `Step` `op` discriminator); an op the choice context does not run is
SCHEMA_VIOLATION `invalid_value` at its `op` ([Steps and checks](#steps-and-checks)); valid legacy dialogue and hand_over semantics are unchanged.

### Steps and checks

One `Step` (`protocol/step.schema.json`, discriminated by `op`) serves four contexts: a reaction's
`steps`, a scripted action outcome's `steps`, a dialogue choice's `steps` (a choice's terms, such as
`accept`, `hand_over`, `payment` or `patrol`, are its own fields; its effects are `steps`), and a service's `benefit`, which is
one Step. One `Check` (same file) serves scripted actions and dialogue choices; a dialogue choice runs only the
`opposed` kind and needs `failure`, a scripted action refuses `failure` and `rating`, and a check key
is unique across both (`lib/loka/content/check_kinds.ex`). The schema admits every op in every context; the
compiler (`lib/loka/content/steps.ex` `@ops`) refuses an op a context does not run, or a field it
does not run there, with SCHEMA_VIOLATION `invalid_value` at that `op` or field, and an op whose
owning event's capability is not declared with UNDECLARED_CAPABILITY at its `op`. A service `build` needs
`site` (SCHEMA_VIOLATION `missing_property`). References are checked only in the fields a context runs, and
each bad `build.structure` gives one diagnostic. "all" means every
field of the op; a list names the only fields run besides `op`.

| `op` | Owning event | Reaction | Action outcome | Dialogue choice | Service benefit |
| --- | --- | --- | --- | --- | --- |
| `fact.assign` | `fact_changed` | all | `fact`, `value` | `fact`, `value` | |
| `fact.adjust` | `fact_changed` | all | | `fact`, `amount` | |
| `fact.stamp` | `fact_changed` | all | | | |
| `event.emit` | `custom_event` | all | all | | |
| `quest.activate` | `quest_activated` | all | | | |
| `quest.resolve` | `quest_resolved` | all | | | |
| `barrier.set` | `barrier_changed` | all | | | |
| `npc.move` | `entity_entered_room` | all | | | |
| `quest.fail`, `population.suppress`, `population.spawn`, `experience.grant`, `narrate`, `item.move`, `replenish.run` | | all | | | |
| `status.apply` | | all | `npc`, `status` | | |
| `status.cure` | | all | all | | |
| `damage`, `light.ignite`, `resource.adjust` | | | all | | |
| `build` | | | `structure`, `direction` | | all |
| `skill.acquire`, `topic.grant` | | | | all | |
| `entitlement`, `meal`, `drink`, `repair`, `claim`, `cancel`, `deposit`, `withdraw`, `mend`, `raze` | | | | | all |

### Source shortcuts

The compiler rewrites the source before any other stage reads it (`Loka.Content.Source.load/1`,
`lib/loka/content/areas.ex`, `lib/loka/content/extends.ex`, `lib/loka/content/prose.ex`,
`lib/loka/content/behaviours.ex`, `lib/loka/content/params.ex`,
`lib/loka/content/zones.ex`),
so `mix loka.compile` and `mix loka.lint` see the same flattened definitions. The order is: open
area bundles, refuse repeated definitions, flatten `extends`, lower inline prose, expand
behaviours, expand zone rules, refuse repeated definitions again. The artifact
never carries a bundle, `extends`, `abstract`, a prose marker, a behaviour or a zone;
the loader is unchanged.

**Actions with outcomes.** Every player action is `actions/<key>.json`. A file with `command`
names a built-in command and is checked as an ActionDefinition; a file without it carries
authored `outcomes` and is checked as a ScriptedAction (`Loka.Content.Source.of_kind/2`). One
field decides, so a file never mixes the two shapes: the contract it is routed to refuses the
other shape's fields. The artifact keeps both maps, so a diagnostic that names a reference shows
the internal kind (`UNRESOLVED_REFERENCE` `data.target` `"<id>@<version>:action/<key>"`); the
author still writes the key alone. The refusals:

| Case | Code | Path | data |
|---|---|---|---|
| `command` beside `outcomes` or any other scripted-action-only field (`aliases`, `check`, `costs`, `cooldown`, `duration`, `craft`, `tip`, `reason`) | `UNKNOWN_FIELD` | `actions/<key>.<field>`, one per field | `{}` |
| the same file then also misses ActionDefinition's own required fields (`accessibility`, `input`) or uses a scripted action target (`{kind: "detail"}`) | `SCHEMA_VIOLATION` | `actions/<key>.<field>`, `actions/<key>.target.kind` | `{"error": "missing_property"}`, `{"error": "unknown_variant"}` |
| neither `command` nor `outcomes` | `SCHEMA_VIOLATION` | `actions/<key>.outcomes` | `{"error": "missing_property"}` |
| a `scripted_actions/` directory (the retired source kind) | `UNKNOWN_FIELD` | `scripted_actions/<key>` | `{}` |

A built-in action and a scripted action cannot share a key: two files cannot, and a bundled
definition beside a file is `DUPLICATE_DEFINITION` at both sites (`actions/<key>`,
`areas/<name>.actions.<key>`).

**Area bundles.** `areas/<name>.json` (one level; `areas/x/y.json` is `UNKNOWN_FIELD`) holds
`{"<dir>": {"<key>": <definition without key>}}`, where each `<dir>` is a definition directory
of the [Source layout](#source-layout) table. `text` and `facts` stay in their root files.
- A bundled definition is exactly the file `<dir>/<key>.json` would be: every stage checks it, and
  its diagnostics carry the bundle path, `areas/<name>.<dir>.<key>.<field>` (for example
  `areas/village.dialogues.elder_ward.keyword`).
- A prototype may live in a bundle: bundles open before `extends` resolves.
- `mix loka.lint` names a bundled definition by its definition address, `<dir>/<key>.json`
  (`reactions/elder_hears.json: ...`), not by the bundle file.
- A bundle that fails to decode adds nothing; its `INVALID_JSON` fails the build. While any
  bundle is refused (undecodable, not an object, or with an unknown or non-object member), every
  `UNRESOLVED_REFERENCE` is held back, since its definitions are missing; the other diagnostics
  stand.
- An `actions/` file refused at load or by its `extends` holds back every other file's
  `UNRESOLVED_REFERENCE` the same way until it is fixed (its kind is unknown); its own stand.

| Case | Code | Path | data |
|---|---|---|---|
| The bundle is not an object | `SCHEMA_VIOLATION` | `areas/<name>` | `{"error": "invalid_type"}` |
| A member that is not a definition directory | `UNKNOWN_FIELD` | `areas/<name>.<member>` | `{}` |
| A member whose value is not an object | `SCHEMA_VIOLATION` | `areas/<name>.<member>` | `{"error": "invalid_type"}` |
| Two definitions of one kind and key (a file and a bundle, or two bundles) | `DUPLICATE_DEFINITION` | each site | `{}` |

[speech_sampler](../../cartridges/speech_sampler/areas/village.json) is the working example: its
rooms, NPCs, dialogue and reactions are one file.

**`extends`.** A file in a definition directory may hold `"extends": "<key>"`, the key of a
definition of the same kind (the short-reference convention), in any file of that kind.
- One parent, any depth; resolution stops on a cycle.
- Objects merge key by key, recursively; everything else (strings, numbers, lists, `null`)
  replaces. There is no append, and a child cannot delete an inherited key, so a field whose
  maps differ between children (shoo's deer `sight.narration`) stays out of the parent.
- A child never inherits `extends` or `abstract`.
- A schema error inside an inherited field reports at the child's path.

**Parameters.** An abstract definition may declare `"params": ["<Key>", ...]` and hold a marker,
`{"param": "<name>"}` (an object with that one member), in place of any value. Its direct
child passes `"with": {"<name>": <value>, ...}`, one value per declared name: each marker is
replaced whole by its value (no interpolation, no defaults), then the child merges over the
filled parent, so the child's own fields still win. The child never inherits `params`, and the
artifact carries neither `params` nor `with`. A grandchild sees the filled result: only the
direct parent's markers are filled. Behaviours take the same `params` and `with`, per
attachment (below). The refusals, with `<at>` the child's `<src>.with` or the attachment's
`<src>.behaviours[<i>].with`, and `<def>` the declaring definition's or behaviour's path:

| Case | Code | Path | data |
|---|---|---|---|
| `with` names an undeclared parameter | `UNKNOWN_FIELD` | `<at>.<name>` | `{}` |
| A declared parameter is missing from `with` (one diagnostic, however many) | `SCHEMA_VIOLATION` | `<at>` | `{"error": "missing_property"}` |
| `with` is not an object | `SCHEMA_VIOLATION` | `<at>` | `{"error": "invalid_type"}` |
| A marker names no declared parameter (reported once, at the declaring site) | `UNRESOLVED_REFERENCE` | `<def>.<path to the marker>` | `{"target": "<name>"}` |
| `params` is not a list of Keys | `SCHEMA_VIOLATION` | `<def>.params` | `{"error": "invalid_type"}` |

`params` on a definition that is not abstract is not checked as a declaration (no `<def>.params` or
marker diagnostic); it stays and is `UNKNOWN_FIELD` at `<def>.params`, while a child's `with` is
still checked against it and fills its markers (`extends.ex`, `inherit/4`); when it is not a list, each
child is refused with `SCHEMA_VIOLATION` `invalid_type` at `<def>.params`. A parent with a
`params` fault, like a parent in a cycle, drops its children without diagnostics of their own.
The [toolbox_showcase](../../cartridges/toolbox_showcase/reactions/wheel_shows.json) is the
working example: its 30 `wheel_*_x_shows_*` reactions are one line each.

**`abstract`.** A definition with `"abstract": true` is removed after its children resolve. It
is never validated (an abstract NPC needs no `room`), and a reference to it is an ordinary
`UNRESOLVED_REFERENCE`. Any other `abstract` value stays and is `UNKNOWN_FIELD`.

Root files are not flattened: `extends` in `cartridge.json`, `facts.json`, `resources.json`,
`attributes.json` or `layout.json` is `UNKNOWN_FIELD` (for example `cartridge.extends`);
in `text.json` it is an ordinary TextKey. A child whose parent failed to decode, or whose parent
chain reaches a cycle it is not in, is dropped without a diagnostic of its own; the parent's
diagnostic fails the build. The refusals, with `<src>` the file's source path:

| Case | Code | Path | data |
|---|---|---|---|
| No definition of the child's kind has the key | `UNRESOLVED_REFERENCE` | `<src>.extends` | `{"target": "<dir>/<key>"}` |
| The key exists only in another kind | `UNRESOLVED_REFERENCE` | `<src>.extends` | `{"target": "<dir>/<key>", "from": "<other src>"}` |
| A cycle, including a file that extends itself | `SCHEMA_VIOLATION` | `<src>.extends` of each member | `{"error": "invalid_value", "from": "<its parent's src>"}` |
| `extends` is not a string | `SCHEMA_VIOLATION` | `<src>.extends` | `{"error": "invalid_type"}` |

[shoo_sampler](../../cartridges/shoo_sampler/) is the working example: `npcs/wild.json`,
`items/corpse.json` and `populations/herd.json` are abstract prototypes.

**Inline prose.** A text field may hold its words in place: `"name": {"prose": "the elder"}`.
- The marker is an object whose only member is `"prose"`, a non-empty string, anywhere inside a
  definition (a plain file or a bundle). Any other `{"prose": ...}` shape stays, and the schema
  reports it at its site. Root files (`text.json` too) are not lowered.
- The compiler writes the generated key `<kind>.<key>.<path>` in its place: `<kind>` singular
  (`npc`, `room`, `story_point`), `<key>` the definition key, `<path>` the steps from the
  definition to the marker joined by `.`, array indexes in decimal. One alias: a step
  `room_line` is written `room` (the house `npc.<key>.room` convention). So `npcs.elder.name`
  is `npc.elder.name`, a choice label `dialogue.elder_ward.choices.thank.label`, and a room
  variant `room.lane.variants.0.description`.
- The words join the one `text.json` catalog (created when absent; an undecodable one takes
  nothing, its `INVALID_JSON` fails the build). A generated key that fails TextKey is the
  schema's error at the marker and again at `text["<key>"]`; a word-length error is reported
  at the marker and again at `text["<key>"]`.
- Prose runs after `extends`: an inherited marker gets a key per child, from the child's kind,
  key and path; the prototype owns no line.
- A shared line (`shop.bought`) stays an authored key; there is no per-site key override.

| Case | Code | Path | data |
|---|---|---|---|
| A generated key already in the catalog (authored, or generated earlier) | `DUPLICATE_KEY` | the marker's site | `{"target": "<key>"}` |

[speech_sampler](../../cartridges/speech_sampler/areas/village.json) writes 21 of its 23 lines
inline; its artifact equals the hand-keyed one byte for byte.

**Zones.** One reaction for many rooms.
- A room's source may carry `"zones": ["<Key>", ...]`; the compiler strips it from every room.
- A reaction with `"zone": "<Key>"` and no `on.room` is replaced by one copy per room listing
  that zone (once, however often the room lists it). A copy has `on.room` set to its room, no
  `zone`, the key `<rule>_<room>` (`wanderer` in `hall` is `wanderer_hall`), and the authored
  rule's location, so every diagnostic of a copy reports once at the authored rule.
- Copies sort by the bytes of `<rule>_<room>`: copies of one rule sort among themselves by room
  key, and `_` (0x5F) sorts after digits and before lowercase letters, so `wanderer9` <
  `wanderer_hall` < `wanderer_mill` < `wanderera` < `wandererx`. An entry or rest event matches
  only the copy for its room, so the order that matters is between a copy and that room's own
  rules; pick the zone rule's key for the order you want.
- Prose lowers before zones, so all copies share the authored rule's generated text key. A zone
  rule may use `extends`, because flattening runs first. An abstract zone rule is never checked,
  so its unknown zone compiles; a concrete child that inherits it is refused at its own
  `<src>.zone`.

| Case | Code | Path | data |
|---|---|---|---|
| `zones` is not a list of Keys | `SCHEMA_VIOLATION` | `rooms/<key>.zones` | `{"error": "invalid_type"}` |
| `zone` together with `on.room` | `SCHEMA_VIOLATION` | `<src>.zone` | `{"error": "invalid_value"}` |
| No room lists the zone | `UNRESOLVED_REFERENCE` | `<src>.zone` | `{"target": "<zone>"}` |

Existing checks cover the rest: a trigger with no room filter is `UNKNOWN_FIELD` at
`<src>.on.room`; a copy key over 64 characters is `SCHEMA_VIOLATION` at `<src>`; a copy key equal
to an authored reaction or another copy (rule `a` in room `b_c` and rule `a_b` in room `c`) is
`DUPLICATE_DEFINITION` at each site. [codex_sampler](../../cartridges/codex_sampler/reactions/wanderer.json)
is the working example: one zone rule for its five rooms; its artifact equals the five hand-written
rules byte for byte.

**Behaviours.** One set of reactions for many NPCs or items.
- `behaviours/<name>.json` (or `"behaviours": {"<name>": ...}` in an area bundle) holds
  `{"reactions": {"<rule>": <ReactionRule without key>}}`. An NPC or item may carry
  `"behaviours": ["<Key>", ...]`; the compiler strips it from every NPC and item and drops every
  behaviour. `behaviours` on any other kind is `UNKNOWN_FIELD`; a behaviour no holder lists adds
  no reaction, and its rule bodies are not checked beyond their [parameter](#source-shortcuts)
  markers (its inline prose lines, lowered first, stay in the text catalog). `holder` is a
  reserved parameter name, always bound.
- A behaviour may declare `"params"` like a prototype; each holder then attaches it as
  `{"behaviour": "<name>", "with": {...}}` (a bare name or an object without `with` passes no
  arguments) and its copies fill the markers from that `with` (an argument is inserted as is: a
  marker inside it is not filled). An inline prose line in `with`
  gets the holder's key, `<item|npc>.<holder>.behaviours.<i>.with.<name>`, so each holder has
  its own words.
- Each rule becomes one reaction per holder (once, however often the holder lists the same
  attachment; two attachments of one behaviour with different `with` are `DUPLICATE_DEFINITION`
  at the behaviour rule),
  keyed `<rule>_<holder>` (`take` on `trout_01` is `take_trout_01`). In the copy, every
  `{"param": "holder"}` (an object with that one member) becomes the holder's key, so the
  trigger names the holder; a marker naming no declared parameter is refused at the behaviour. A
  copy keeps the behaviour rule's location, so each of its diagnostics reports once at
  `behaviours/<name>.reactions.<rule>...`.
- Copies sort by the bytes of `<rule>_<holder>`, as zone copies do: a holder's rules sort by rule
  name.
- Prose lowers first, so all copies share the rule's generated key
  `behaviour.<name>.reactions.<rule>...`. Flattening runs first, so a holder inherits
  `behaviours` through `extends` and an abstract holder gets no copy. Zones run
  after, so a behaviour rule may carry a `zone`.

| Case | Code | Path | data |
|---|---|---|---|
| `behaviours` is not a list of Keys and `{"behaviour": "<Key>", "with": ...}` objects | `SCHEMA_VIOLATION` | `<src>.behaviours` | `{"error": "invalid_type"}` |
| A name with no behaviour (reported at its first index) | `UNRESOLVED_REFERENCE` | `<src>.behaviours[<i>]` | `{"target": "behaviours/<name>"}` |
| A behaviour that is not an object | `SCHEMA_VIOLATION` | `behaviours/<name>` | `{"error": "invalid_type"}` |
| A behaviour member other than `reactions` and `params` (`extends` and `abstract` too) | `UNKNOWN_FIELD` | `behaviours/<name>.<member>` | `{}` |
| `reactions` is missing or not an object | `SCHEMA_VIOLATION` | `behaviours/<name>.reactions` | `{"error": "invalid_type"}` |
| `params` names `holder` | `SCHEMA_VIOLATION` | `behaviours/<name>.params` | `{"error": "invalid_value"}` |

A behaviour that fails to decode, is not an object, has no `reactions` object or has a
`params` fault gives its holders no copies and no diagnostic of their own. Existing checks cover the rest: a copy key over 64 characters is `SCHEMA_VIOLATION` at
the behaviour rule; a copy key equal to another reaction's is `DUPLICATE_DEFINITION` at each site,
and an NPC and an item sharing a key give one `DUPLICATE_DEFINITION` at the behaviour rule.
[fishing_sampler](../../cartridges/fishing_sampler/behaviours/spoils.json) is the working
example: one behaviour on its four fish (without parameters); its artifact equals the four hand-written `take_*`
rules byte for byte.

### Source schema

`schemas/source/` holds one JSON Schema (draft 2020-12) per source file kind, for editors and
LLM authors: one per definition directory (`rooms.schema.json`, `behaviours.schema.json`, ...),
one per root file (`cartridge`, `facts`, `text`, `resources`, `attributes`, `layout`)
and `areas.schema.json` for bundles, each a `$ref` into the shared `defs.schema.json`.
`mix loka.source_schema` writes them from the contracts the compiler checks source with plus the
shortcuts above (`lib/loka/content/source_schema.ex`); a test fails when the committed files
are stale, and `kernel/ts/test/source_schema.test.ts` validates every committed cartridge file
with them. They accept every shortcut: no `key`, an `abstract` parent (checked only as an
object), an `extends` child (no inherited member required), `with`, `{"prose": ...}` wherever a
text key goes (root files too), `zone` and `zones`, and
`behaviours`. They are a writing aid, not a gate: nothing reads them, the compiler remains the
judge, and they do not check references, bundle-member keys against file stems, or the
`resources` and `attributes` entries beyond being objects, or a behaviour's rule bodies beyond
being objects (they hold parameter markers).

## Artifact and loader

`loadCartridge(bytes, installed)` (`kernel/ts/src/content/cartridge.ts:23`) returns the decoded
cartridge and its hash, or the first diagnostic of the first failing stage (`:15`): size
(`ARTIFACT_TOO_LARGE`), JSON (`INVALID_JSON`), format (`UNKNOWN_FORMAT`: v1 or v2), the
`CartridgeArtifact` schema (`SCHEMA_VIOLATION`, `UNKNOWN_FIELD`), `CONTENT_HASH_MISMATCH`,
map keys against manifest and definition (`ARTIFACT_DEFINITION_KEY_MISMATCH`, `:109`), the
lock (`:134`: `LOCK_MANIFEST_MISMATCH`), and the installed kernel
(`content/cartridge_installed.ts:25`: `CAPABILITY_NOT_INSTALLED`, `FACT_SCOPE_UNSUPPORTED` (a
fact has exactly one scope, `player` or `instance`, and a subject site names only what this
kernel can read, `content/cartridge_scoped_facts.ts`), `KERNEL_API_UNSUPPORTED`,
`PINNED_VERSION_UNSUPPORTED`, `CLIENT_FEATURE_UNSUPPORTED`). Semantic checks run once, in the
compiler (`lib/loka/content`); the loader trusts a hash-valid compiled artifact's references
and rules. A dangling reference or a containment cycle in a hash-valid artifact is therefore a
runtime error, not a load refusal; the re-entry point for a loader check is PREP-03 (signed
artifacts or a server compile). Compiled artifacts load in TypeScript with identical bytes,
hash and lock (`test/loka/cartridge_cross_kernel_test.exs:169`); the loader corpus is
`protocol/fixtures/cartridge_loader.json`.

A compiled cartridge is a CompiledCartridge ([contracts](../contracts.gen.md#cartridge-artifact-contracts-protocolcartridgeschemajson)):
the manifest, lock and definition maps keyed by DefinitionRefString
(`<id>@<version>:<kind>/<key>`; `content/cartridge.ts:113`).

## Content reports

Balance tool 5 ([study](../rnd/balance-diagnostics-2026-10-11.md) §6 R1, R2, §1 I4, §8 N2;
Beads `loka-kgd.107.5`) answers what a player can never reach and what content nothing uses. Like
the lockout above it is an authoring potential check, not proof. `node kernel/ts/play/reach.ts
<artifact>` loads a `mix loka.compile` artifact through `loadCartridge` with `INSTALLED`, prints
the loader diagnostic and exits 1 on refusal, otherwise prints one canonical JSON document
`{graph, report}` and exits 0. Nothing is committed or checked in CI.

- **Graph.** Nodes: the keys of every top-level map keyed by DefinitionRefString, each `{ref,
  kind}`. Edges: each DefinitionRef object anywhere inside a definition is `{from, to, path, op?}`:
  `from` the definition's ref (the section name, such as `world` or `entry`, for other sections),
  `path` the JSON path inside it, `op` the `op` of the object holding the ref, when it has one.
- **Reach.** The lockout's fixpoint (`reach` in `content/cartridge_barriers.ts`), run with keys and
  with every locked barrier shut. `unreachable`: rooms not reached with keys; placed items (not
  templates) not in reach, an item an NPC holds counting as in reach with that NPC; NPCs none of
  whose referenced rooms (start, schedule) is reached; dialogues whose speaker is unreachable;
  quests with no `offer` of their own that no reached room, placed item, NPC or dialogue
  references. `behind_lock`: rooms and placed items reached only
  with keys. Template items' obtainability needs the simulator (study P rows); details stay with
  UNREACHABLE_DETAIL.
- **Orphans.** `orphan_items`: template items with no inbound edge. `orphan_facts`: `unused` (no
  inbound edge), `write_only` (every inbound edge a write), `read_only` (inbound edges, none a
  write). A write is an edge with op `fact.assign` or `fact.adjust`, or at an engine write site
  with no op: `world.death_credit[n].fact`; a topic's `fact` (also a read: the codex lists known
  topics); a scene's `on_end.assign[n].fact` and `on.rest.credit`; a quest's
  `expedition.survived_fact`, `expedition.faction`, `exchange.contribution`, `exchange.faction`,
  `deadline.fact` and `deadline.trust_fact`; an ancestry's `faction.fact`; an item's
  `weapon.durability.fact` (a hit wears it); a service's `benefit.fact` (a repair restores it). Facts the engine owns
  are left out: the [Compiler](#compiler)'s reserved facts (position, `scene_<key>`,
  `story_point_<key>`, `skill_<key>`, `uses_<key>`, `seen_tip_<key>`), a quest patrol's
  `trust_fact` and an entitlement service's fact, as RESERVED_FACT keeps them.
- Each list is sorted by ref. ponytail: static initial state, rooms reached through exits only (a
  room reached by travel, a ferry or a scripted action shows unreachable, a quest's own `offer` counts
  without evaluating its policy, only if its target's room or NPC is reachable (a bare offer counts), and a quest without one that only a scripted action, reaction or action
  names shows unreachable), no dialogue choices or reaction chains, and engine read sites with no op are not reads (such a fact may show `write_only`); any
  other engine writer shows its fact `read_only`. A committed graph waits for a consumer (R6, L6).

Balance tool 6 ([study](../rnd/balance-diagnostics-2026-10-11.md) §2 C1, §1 I1; Beads
`loka-kgd.107.6`) answers how strong a character gets per level and what each piece of gear adds.
`node kernel/ts/play/power.ts <artifact>` loads and refuses as `reach.ts` does and prints one
canonical JSON document `{levels, items}` (`{levels, items, budget}` with a gear budget). Every bonus is the engine's
[derived stat](mechanics.md#stats-derived-from-attributes-toolbox-row-2) formula (`derived` in
`mechanics/attribute/shared.ts`) read with the attribute values below in place of a character's.

- **Tables.** The authored `world.derived` tables whose base exists: `hit_chance` and `damage`
  with `world.combat.player_attack`, `carry_grams` with `world.carry`, `hp_max` with the `hp` pool.
  A final value is clamped as that section says: `hit_chance` is `chance + bonus` in 0..100;
  `damage` is `[damage_min + bonus, damage_max + bonus]`, each at least 0; `carry_grams` is
  `max_grams + bonus`, at least 0; `hp_max` is the pool's `maximum + bonus`, at least its `minimum`.
- **Levels.** Levels 1 to the `thresholds` count + 1 of
  [world.levelling](mechanics.md#experience-and-levelling-toolbox-row-4) (level 1 only without it);
  level L grants `points_per_level × (L − 1)` points. Attributes start at their definition starts.
  Each level is `{level, <table>: {none, focused}}`: `none` spends no point; `focused` spends every
  point on the one attribute among the table's terms that gives the highest bonus.
- **Items.** Every item with a slot, sorted by slot, then ref: `{ref, slot, affects, affect_total,
  delta, mass_grams?, tags?}`. `affect_total` is the signed sum of its modifiers; `delta`, per
  table, is the bonus with the item worn alone at the starts minus the bonus at the starts,
  unclamped.
- **Budget.** Only with [world.gear_budget](#item-affect-declarations) (without it the document
  is `{levels, items}`, byte for byte), a third key `budget: {over, unbudgeted}`, both in the item
  order above. Each item with affects lands in at most one list: without `intended_level` it is
  unbudgeted `{ref, missing: "intended_level"}`; with a slot absent from `per_slot` it is
  unbudgeted `{ref, missing: "slot"}` (never budget 0); otherwise `allowed` is `per_slot[slot] +
  per_level × (intended_level − 1)`, saturated as the level points are, and the item is over,
  `{ref, slot, intended_level, affect_total, allowed}`, when its signed `affect_total` exceeds
  `allowed` (a curse offsets a bonus). Items without affects are in neither list. A report only:
  no check fails on it.
- ponytail: no gear in the curve, no ancestries (C5, I5) and no statuses; best-in-slot, dominance
  and allocation sweeps (I3, I6, C2) are `loka-kgd.107.10`'s; no CI warning on an over-budget item
  until a consumer asks; where an item is found and its price (NPC shop stock, not the item) wait for a consumer of the graph above.

### Economy and ecology ledger (balance tool 1)

Balance tool 1 ([study](../rnd/balance-diagnostics-2026-10-11.md) §0, §5, §12-13; Beads
`loka-kgd.107.1`) answers where coins and items come from and go, and what lives and regrows.
`node kernel/ts/play/ledger.ts <artifact>` loads and refuses as `reach.ts` above, otherwise prints
one canonical JSON document `{currencies, coins, items, ecology}` and exits 0. Nothing is
committed or checked in CI. Refs are DefinitionRefStrings.

- **Currencies.** Every resource a shop's `resource`, a service's or transport's `currency`, or a
  dialogue choice's `payment.resource` or `lesson_payment.resource` names, each `{resource,
  player_start, maximum, purses, supply}`: its `start` and `maximum`, `purses` each NPC's
  `resource_starts` for it by NPC ref, and `supply` the player start plus every purse. Coins are
  conserved transfers between the player and NPC purses (`transfer` in
  `mechanics/resource.ts`), so a faucet is bounded by the paying NPC's purse; stated, never
  simulated.
- **Rows.** Each row is `{site, ref, ...}`: `ref` the definition of the site, `npc` the NPC on the
  other side, `resource` and `amount` for coins. `coins.sinks`: `shop_buy` (ref the shop's NPC,
  `item`, amount its `buy`, the shop's `buy_discount` as authored), `service` (`npc` its provider,
  amount its `price`, `stock` the provider's `resource_starts` for its `benefit.stock` when
  present), `transport` (`npc` its recipient, amount its `fare`), `lesson` (ref the dialogue,
  `choice`, `npc` its `lesson_payment.to` role). `coins.faucets`: `shop_sell` (ref the NPC,
  `item`, amount its `sell`), `payment` (ref the dialogue, `choice`, `npc` its `payment.from`
  role, `through` its `availability.through` when present). `coins.unclassified`: every graph
  edge (`contentGraph` above) to a currency at any other path, `{from, path, resource}`, so a new
  paying mechanic shows.
- **Items.** `items.faucets`: `receive` (ref the dialogue, `choice`, `item` and `npc` its roles),
  `drop` (ref the NPC, `item`, `chance`). `items.sinks`: `hand_over` (ref the dialogue, `choice`,
  `item` and `npc` its roles), `edible` (ref the item, `resource`, `amount`).
- **Ecology.** `populations`: each plan `{ref, home, area, cap, day_target, night_target,
  replacement_delay, chance?, npc, item?, corpse}`, `chance` only on an encounter plan; a replacement is the only thing that mints an item. `seams`: each harvest detail `{room, detail, items, tool?,
  careful?}`: the count of its items, its tool's tag, its careful count.
- Lists sort by site, then ref, then choice, then item; currencies by resource, unclassified by
  from then path, populations by ref, seams by room then detail. ponytail: authored static sites
  only; no per-day caps exist; replenish is not listed yet (Beads `loka-kgd.107.3`) and the ledger does not count `item.move` sinks (decay, row 41) yet, so items can leave play that way; death
  moves custody with no coin penalty; per-district grouping waits for L8 tags; placed items stay
  with `reach.ts`; corpse custody, crow scavenge, quest exchange and coin-like items are not
  money rows; ammo a row 17 shot spends and durability a row 21 hit wears or a repair restores
  are not reported (a repair shows only as its service coin sink).

### Measured flows (balance tool 2)

Balance tool 2 ([study](../rnd/balance-diagnostics-2026-10-11.md) §5, §12 L2-L3, §13; Beads
`loka-kgd.107.2`) measures what a purposeful player earns and spends. `node kernel/ts/play/flows.ts
<artifact> [--seeds N] [--days D]` (defaults 16 and 3) loads and refuses as `reach.ts` above,
otherwise plays each seed from a new world and prints one canonical JSON document. Nothing is
committed or checked in CI.

- **Policy `worker`.** Each step it takes only the GameView's available offers: the simulator's
  (`offers` in `kernel/ts/test/sim.ts`, the candidates its random player picks from), plus each
  shop's available sell, each available choice and each available harvest action. It tries them
  in rank order, ties shuffled by the seed's generator: `choose_ancestry` (nothing else is
  accepted before it), sell, harvest, choose, accept_quest, take, talk; then moves, least-visited
  room first; then a wait to the next game hour. The first the kernel accepts is played; a command
  already played in the current game hour (continuation ids ignored) is skipped, so a repeatable
  conversation cannot spend the run without passing time. In a real-elapsed world (`time_policy`,
  where Wait is refused) the wait is the authority's elapsed delivery to the same time. The run
  ends at start + D days (calendar `units`), when no candidate is accepted (the worker never
  fights, so a fight it walks into ends its run), or at 5000 steps. A refused candidate
  takes the plain kernel `step`; the accepted one is replayed through the simulator's checked
  step, so every played step keeps every registered invariant (checking each candidate cost most
  of a run).
- **Attribution.** At the command level: the state before and after each accepted step. Coin is
  the player body's rows of each currency `ledger` lists; items are the item entities directly in
  the body. A gain is `in`, a loss `out`, under the label `<payload type>:<definition key of its
  item or target>`, else the bare type; a wait's job effects are labelled `wait`.
- **Output** `{cartridge, policy, seeds, days, coin, items, populations}`: `coin.per_hour`
  `{min, median, max}` of each seed's net coin over its elapsed game hours, as decimal strings
  with two places; `coin.by_source` and `items.by_source` `{label: {in?, out?}}` summed over
  seeds; `coin.supply` per game hour from 0 `{hour, player, purses}`, the median over seeds of the
  player's coin and of all NPC purses; `populations` per game hour `{hour, living}`, the median
  living members of each population plan. A seed that ended early adds no sample after its end.
  Medians are lower medians, so every value stays an integer. ponytail: one policy; command-level
  labels (per-job attribution is L2); direct body contents only; no shop stock curve.

### Fight matrix and encounter rating (balance tool 7)

Balance tool 7 ([study](../rnd/balance-diagnostics-2026-10-11.md) §4 F1, F2, §13 order 3; Beads
`loka-kgd.107.7`) answers whether a level L player beats NPC N, from the real round code and RNG.
`node kernel/ts/play/fight.ts <artifact> [--seeds N] [--rounds R]` (defaults 32 and 100) loads
and refuses as `flows.ts` above, otherwise prints one canonical JSON document and exits 0. Nothing
reads it and nothing runs it in CI.

- **Targets.** Every NPC living at genesis with an `attack`, by its DefinitionRef string, and
  every population plan, by its ref, fought through its lowest-EntityId living member. An
  encounter plan (`chance`, [mechanics.md](mechanics.md#random-encounters-toolbox-row-9)) births
  none at genesis: the tool elapses the world one `wander_interval` at a time, at most R times,
  until a member lives; none counts `unborn`.
- **Cells.** Target × level × build. Levels 1 to the `thresholds` count + 1 of `world.levelling`
  (1 only without it), as the power report above. Builds: `none` (no point spent) and one per
  declared attribute, by ref, with all `points_per_level × (L − 1)` points on it. The level is
  set by overriding the player's levelling row: `{experience: thresholds[L − 2] (0 at level 1),
  allocated}`.
- **One fight.** A new world per seed, its RNG drawn from the seed's generator as `flows.ts` draws
  it; the player's body moved into the target's room by state override; one Attack on the target;
  then the authority's elapsed delivery of `world.combat.interval` per step, one combat round
  each, until the step's `entity_died` names the target (a win) or the player's body (a death),
  the target is out of the player's room (fled: it fled, or its pack withdrew with it), or R
  rounds pass (a timeout). An Attack the kernel refuses makes the cell `{level, build,
  refused: <code>}` and plays no further seed. Seed 1 runs every step through the simulator's
  checked step (`checked`, `kernel/ts/test/sim.ts`), so it keeps every registered invariant; the
  other seeds take the plain step. Checking every step took 359 s for the 84 cells of
  `toolbox_showcase` on the M1 (about 6 ms a checked step against 0.3 ms plain), the plain rest
  30 s.
- **Cell values** `{level, build, n, wins, deaths, timeouts, fleds, unborn (plans only), win_pct,
  death_pct, fled_pct, rounds, hp_left}`: `win_pct`, `death_pct` and `fled_pct` are k × 100 / n as decimal strings with
  two places; `rounds` (combat rounds fought) and `hp_left` (the player's hp at the win) are
  `{min, median, max}` over the won fights, lower medians, absent with no win.
- **Rating** (F2) per target `{target, rating, cells}`: `first_win_level` is the lowest level
  at which any build's cell has `win_pct` at least 50.00, and `first_win_build` that level's first
  such build in cell order (`none`, then the attributes sorted); both null if no cell does (no
  combat code reads the level itself, only the points a build spends); `death_pct_level_1` is the
  `none` cell's at level 1 (null if refused). A plan's rating adds `chance` (null for an ecology
  plan) and `opportunities_per_day`, the calendar day over `wander_interval` with two places.
- **Pinned limits.** Allies are removed: the player fights alone (`world.combat.allies` is dropped
  from a copy of the cartridge before any fight, so a former ally with an attack is an ordinary
  target), with no group member and no gear beyond the start. The target is fought where it
  stands at genesis or birth; a plan is fought one member at a time (a pack's assistance is
  whatever the round code does). ponytail: no flee, consumables, spells, statuses or gear sweeps;
  the authored `rating` field (study L5) is not read.

### Refusal and friction report (balance tool 8)

Balance tool 8 ([study](../rnd/balance-diagnostics-2026-10-11.md) §7 X1 and X3, §13; Beads
`loka-kgd.107.8`) reports which commands a purposeful player is refused, where and why, whether the
view offered what admission refused, and how much the walk backtracks. `node
kernel/ts/play/friction.ts <artifact> [--seeds N] [--days D]` (defaults 16 and 3) loads and refuses
as `flows.ts` above, exits 2 on a bad flag, and prints one canonical JSON document. Nothing is
committed or checked in CI (gating is `loka-kgd.107.3`).

- **The run.** Measured flows' run, policy `worker` by default, unchanged: its optional
  `observe(before, payload, result, at)` hook sees every candidate it steps, refused or accepted,
  with the plain step's result and `at = {command, seed, step}`. Every candidate stepped is one
  command.
- **Refusals (X1).** `commands`, `refused`, `per_100` (refused × 100 / commands, a decimal string
  with two places), and refused counts `by_code` (the rejection's error code), `by_room` (the
  definition key of the room the player stood in) and `by_command` (the payload type, with
  `:<action key>` for a cartridge action's `perform`).
- **Drift.** Each refused candidate is checked with `gameview_agrees_with_admission` on the
  GameView before it and the actor's resolved actions (as the simulator builds them); accepted
  ones are already checked by the run. `drift: {count, first}`, `first` the earliest five
  `{seed, step, room, command, code}`.
- **Walk (X3).** From accepted steps only: `revisits` per room key (each seed's entries minus one,
  the start room's first entry counting; a room never re-entered is absent), `moves` (accepted steps that change the room), `backtracks`
  (moves back into the room left on the previous room change), and `new_facts: {count,
  median_steps_between}`: a new fact is an accepted step after which `state.facts` holds a key it
  did not hold or a different value; steps between are counted from the run's start or its
  previous new fact (lower median, null when none).
- **Output** `{cartridge, policy, seeds, days, commands, refused, per_100, by_code, by_room,
  by_command, drift, revisits, moves, backtracks, new_facts}`, summed over seeds. ponytail: one
  policy; no heat map image (the by-room table is the map); no gate.

### Transcript coverage (loka-kgd.194.2)

Beads `loka-kgd.194.2` ([design audit](../rnd/design-audit-abilities-authoring-2026-10-23.md)
findings 16 and 23, approach F, plan phase 4) lists the definitions that no example transcript
exercises. `node kernel/ts/play/coverage.ts <artifact> [<transcript.jsonl> ...]` replays each
transcript (by default `cartridges/<manifest id>/transcripts/*.jsonl`, sorted) against the
artifact. It loads and refuses as `reach.ts` above (the loader diagnostic on stderr, exit 1), exits
1 when a transcript does not replay byte for byte (`<transcript>: replay differs at ordinal <n>`,
the path relative to the repository) or when a replayed decision reaches the 64-line narration cap
(`<transcript>: narration cap reached at ordinal <n>`: a cut marker would report a fired rule as
never fired), exits 2 on bad arguments (none, or an artifact path that does not exist), and
otherwise prints one canonical
JSON document. Nothing is committed or checked in CI; only its unit test runs.

- **The replay.** A `Run` starts with the trace header's own ids (its `content_hash` too, so an
  edited cartridge still writes the recorded header) and decides each entry as
  `transcripts.test.ts` does. Each produced line is compared with the recorded line at its
  ordinal; the first difference stops the tool.
- **Reactions.** No committed event names the rule that produced it, so the replay runs a copy of
  the cartridge in which each reaction's `steps` ends with one more `narrate` step whose text is a
  key unique to that rule ([reaction@1](mechanics.md#reaction1-kerneltssrcmechanicsreactionts)).
  Narration is neither a trace field nor state, so the marked replay must still equal the
  recording, and the byte check above proves it on every transcript. A rule is exercised when its
  key is in an accepted decision's narration: its `when` held and (for `after`) its job ran.
- **Scripted actions.** Exercised by a committed `action_completed` whose `action` is the scripted action's key (a
  cast too); a `failure` outcome emits none.
- **Dialogue choices.** Exercised by a committed `choice_resolved {continuation_id, choice_id}`,
  attributed to the dialogue named by the `source` of that continuation in the world before the
  step; rows whose source is a scene are not dialogue choices.
- **Quests.** Exercised by a committed `quest_resolved`; `quest_failed` does not count.
- **Output** `{cartridge: "<id>@<version>", transcripts, never: {reactions, scripted actions, choices,
  quests}}`: sorted DefinitionRefStrings, and `choices` as `[{dialogue, choice}]` sorted by
  dialogue, then choice. ponytail: firing means steps ran, so a delayed rule whose job never ran
  in a transcript shows unfired; scene choices and cartridge `actions` are out of scope;
  transcripts only, not browser walks.

### Rule explainer (loka-kgd.194.3)

Beads `loka-kgd.194.3` ([design audit](../rnd/design-audit-abilities-authoring-2026-10-23.md)
finding 22, approach E, plan phase 4) says why a rule did or did not run at one transcript step.
`node kernel/ts/play/why.ts <artifact> <transcript.jsonl> <ordinal> [--action <key> | --dialogue <key>]`
loads and refuses as `reach.ts` above (exit 1). It reads the transcript with its own pinned
`content_hash`, so an edited, recompiled artifact still runs. It replays ordinals `1..ordinal-1`
on the marked copy of Transcript coverage above, comparing each line with the recording; a
difference exits 1 (`<transcript>: replay differs at ordinal <n>`, the path relative to the
repository). Step `<ordinal>` itself is decided, never compared, so an edited rule can be
explained. Exit 2: wrong arguments, both flags, an ordinal that is not an integer in
1..entries, or a `--action`/`--dialogue` key no definition has. Otherwise it prints one canonical
JSON document. Nothing is committed or checked in CI; only its unit test runs.

- **Output** `{ordinal, command: <payload type>, outcome: <accepted outcome, else the decision
  kind>, reactions: [{rule, causes: [{event, position, filters: {<name>: bool}}], fired, when?}],
  scripted action?: {rule, policy}, dialogue?: {rule, policy}}`. `reactions` holds every rule in rule-key
  order; `rule` is the DefinitionRefString.
- **Causes.** Each committed event of the step whose type is the rule's `on.event`, with every
  declared filter evaluated on the world before the step, as the proposal matches triggers
  ([reaction@1](mechanics.md#reaction1-kerneltssrcmechanicsreactionts)). No such event: `[]`.
- **Fired.** The number of the rule's markers in the step's narration: deliveries whose `when`
  held and whose steps ran.
- **When.** Each leaf gets `held`: the deliveries at which it held. The step is decided again
  from the same world, once per leaf, with the rule replaced under its own key by one whose
  `when` is that leaf alone and whose only step narrates a probe key. The kernel then evaluates
  the leaf at the rule's own place in rule-key order, reading the writes of the rules and
  deliveries before it in the same command (reaction@1). `all`, `any` and `not` keep their
  shape; every leaf is evaluated, with no short-circuit.
- **Policy** (on demand). A scripted action's or dialogue's `policy`, each leaf with `holds`, read on the
  world before the step, where admission reads it: the scripted action for the command's primary target,
  the dialogue for its NPC.
- ponytail: a leaf's value is its truth (`held`, `holds`), not the fact or stat it read, which
  needs a kernel hook. For a rule delivered more than once in a step, only the first delivery is
  exact. A delayed rule's `fired` shows at its job's step, and a job run's narration can be
  deduplicated. The scripted action target is the payload's primary target, not a detail resolved
  through `detailAt`; the dialogue target is the authored NPC, not a `choose` row's bound
  speaker (`speakerOf`), which differs only when the binding is not the npc's entity.

## Installed capabilities

`INSTALLED` in `kernel/ts/src/runtime/world.ts` declares the current kernel API,
content schema, rule IR and installed capabilities. The [current bundled chapter](#current-bundled-chapter)
records the release/API pin; the generated [feature map](../features.gen.md) records each
capability's implemented subset and locations. `bin/features.exs --check` fails when a rule
module exists without its row. A cartridge locking an uninstalled capability fails
`CAPABILITY_NOT_INSTALLED`.

## Text

`Text` is `{key, bindings}`; a committed narration line may carry `participants`, each name
bound to an EntityId at commit (`kernel/ts/src/mechanics/scripted_action/rule.ts:89`), so redisplay and
replay never resolve a name again. Catalog strings carry the touch links above; the phone's
model strips them to prose until details are tappable (`mobile/app/book/model.ts:25`). In
source, a line may be written in place and lowered to a generated key
([inline prose](#source-shortcuts)).

## Author preview

`bin/loka dev <cartridge dir> --watch` ([`author.ts`](../../kernel/ts/play/author.ts)) compiles the
source tree into the artifact the web preview bundles (`mobile/app/.dev-cartridge/current.json`,
[`metro.config.js`](../../mobile/app/metro.config.js), `npm run author`) and serves a local,
loopback-only author API (`LOKA_AUTHOR_PORT`, default 19008) that the preview proxies at
`/__author/`. Release, test and e2e bundles never set `LOKA_DEV_CARTRIDGE`; a production bundle
with it set fails to build, and the app throws when the dev cartridge flag reaches a non-`__DEV__`
build. The author tools below are reachable only in that bundle (a production export keeps a few dead strings) and change no protocol, save or kernel_api.

- **Keep my place.** The preview records each input the Book sends that the session saved (the
  intent, its targets as definition refs `cartridge@version:kind/key`, and each dev-clock advance
  in milliseconds) under the artifact's hash. After a reload into a different hash it replays the
  path through the normal command path, one step at a time; the first step the session does not
  save and accept stops the replay and is named by its ordinal and reply. Nothing writes state directly.
- **Fast loop.** A `text.json` save is pushed to the open page as a text overlay before its
  compile and shows at once: no compile, reload or replay. The compile still runs after it and
  reports its diagnostics to the page; an edit whose compiled cartridge differs from the page's
  only in text values (inline prose too) is pushed the same way once compiled, and the artifact
  is written on the next structural edit. Any other edit compiles, and the page reloads and
  replays. The overlay lives in the watcher's memory and the page; no file carries it. A failed compile keeps the last good
  artifact and names the fault. The release compile (`mix loka.compile`) and every CI check are
  unchanged by the fast path; the overlay never becomes an artifact.
- **Checkpoints.** A recorded path saved under a name is a plain file in the source tree,
  `checkpoints/<name>.json` (`{"steps": [...]}`, the same steps as keep my place, versioned with
  the cartridge; a name is `[a-z0-9_-]+`, never a path). The watcher reads and writes them
  (`GET /__author/checkpoints`, `GET|PUT /__author/checkpoints/<name>`); the compiler and the
  watcher's rebuild skip the directory. The panel lists them; jumping to one starts the game over
  and replays it.
- **Author panel** (`tools/author-panel`, its own web page framing the Book at `?dev=1`; nothing of it enters the app's dependencies or bundles): the last compile's diagnostics in plain words
  (`severity: file:line message`); current facts, quests and flags from the view; why an action
  is missing or refused ([rule explainer](#rule-explainer-loka-kgd1943) on the recorded path); each Book
  line opens its source `file:line` in the owner's editor (`POST /__author/open`, `LOKA_EDITOR`,
  default `code --goto`); the game-time control; the checkpoint list; the still-to-write list.
- **Still to write.** A text value with a line that trims to `~` is a placeholder, in JSON or in
  a scene file. The panel and
  `bin/loka todo <cartridge dir>` list placeholders grouped by the beat (file) that owns them with
  word counts of what is written. A release compile refuses a cartridge with placeholders
  (`placeholder_text` at the key's path) unless `--allow-placeholders` is given.
- **Scene files.** `scenes/*.scene` (or `dialogues/*.scene`) is a plain-text form of one dialogue
  lowered by [Source shortcuts](#source-shortcuts) into today's dialogue JSON and `text.json` keys
  before any other pass; what it cannot say stays in a JSON file of the same key. Errors name the
  scene file and line. Gate: a sampler dialogue re-expressed as a scene compiles byte-identical.
  Rules: [owner decision](../decisions/owner-decision-handwritten-prose-2026-10-31.md).

## Development cartridges

`cartridges/scene_sampler` exercises [modal scenes](mechanics.md#scene1-mechanicsscenerulets),
`cartridges/chapters_sampler` exercises [Chapters](mechanics.md#chapters-kerneltssrcviewviewts) and
`cartridges/journal_sampler` exercises [quest journal selection](mechanics.md#quest1-mechanicsquestrulets-kerneltssrcmechanicsquestlifecyclets).
These are development proofs, not a retained-release or save migration requirement; forward-development
policy is in the [owner decision](../decisions/owner-decision-forward-development-2026-10-05.md); preserve
saved bytes and exact mismatch refusal.

The slice samplers (`cartridges/<name>_sampler`) each exercise one slice; most carry replayable
transcripts (`cartridges/<name>/transcripts/<capability>.jsonl`, replayed by
`kernel/ts/test/transcripts.test.ts`). `cartridges/lantern_proof` is a frozen conformance fixture, not a game, and never ships: it hosts
the frozen traces in `docs/spec/conformance/lantern-traces.json` (R6P, "The Ferryman's Lantern";
its stats and gate: [owner rules](owner-rules.md#product-and-scope)). Its manifest carries no
description field, so this line is its marker; nothing else may be built on it.

## Skill and bleed declarations

A skill source `skills/<key>.json` supplies `name`, `requirement` and `qualification`
(`SkillDefinition`, capability `skill@1`, with `attribute@1`); its key comes from its file.
The compiler creates the exact reserved player Boolean `skill_<key>`, default false, reserved
to `skill@1`. No writable stat, progression or skill-percentage field is introduced. A teacher
dialogue's typed acquisition step identifies the declared skill; its payment binds a live NPC
role, penny resource and positive amount.

A [bleed](mechanics.md#c5-hound-bleeding-and-bandage-selected-contract) attacker opts in with
`on_positive_hit: {effect}`; the effect declares `{duration, tick_every, hp_loss, narration:
{applied, refreshed, tick, expired}}`, each narration a required local TextKey; a bandage item
declares `bandage: {effect, skill, action, narration}`. These are content values; the engine
encodes no default. The compiler validates the closed positive safe-integer duration,
interval and loss, interval < duration, local HP pool, supported producer/effect reference,
required skill/action/text references and bandage-only noncontainer/nonwearable/nonedible
opt-in; they reject unknown fields, an absent effect or an invalid skill qualification.
`cartridges/bleed_sampler` exercises it.

## M1-A elapsed policy

Optional manifest `time_policy {profile: "real_elapsed", rate}` declares logical seconds per real second; rate is an integer in `1..9007199254740991`. Absence retains frozen legacy play_time. Opt-in requires `schedule@1`. The installed API follows the [current bundled chapter](#current-bundled-chapter); current requirement ranges are validated; obsolete development fixtures follow the [forward-development policy](../decisions/owner-decision-forward-development-2026-10-05.md).

The compiler rejects actions naming authority-only `elapsed` or `run_job` (`UNKNOWN_COMMAND`), and actions naming Wait when the policy opts into elapsed (`UNKNOWN_COMMAND`); custom action keys cannot alias around this. Elapsed scripted actions with duration are `INVALID_TIME_POLICY` at the scripted action's duration; elapsed rate/profile fields are schema checked. Duration omission is zero, while legacy duration semantics are unchanged. The policy itself requires schedule (`UNDECLARED_CAPABILITY`). This additive optional manifest field keeps artifact tags and old canonical bytes. See [contract decision](../decisions/pm-decision-m1-a-elapsed-contract-2026-10-04.md).

## Corpse templates and shrine settings (M5-B)

`world.death` requires `death@1`, `containment@1`, `position@1`. It
names `player_corpse` and `npc_corpse` item templates, the existing `shrine` room,
and `restore {hp, mv}` values within the corresponding declared pools. References accept
source short keys. A corpse template has `location: {in: "template"}` and ordinary item
text/mass and `container: true`; it has no capacity, slot or barrier. Templates are never minted or placed at
birth, cannot hold authored children, and must be the configured corpse templates.
The compiler validates these constraints and reference kinds.

The sampler's 0.0.8 release binds chapel_nave, HP10/MV100 and two corpse templates.
This is a foundation release: the first live lethal producer remains M6. Older bundled release lists
refuse its unknown content pin.

### Death penalty declarations

[Death penalties](mechanics.md#death-penalties-toolbox-row-47) read the optional
`world.death.penalty` (`DeathSettings.penalty`):
`experience {percent, narration}`, percent an integer 1 to 100 and narration a TextKey, and
`items`, `corpse` or `kept`. The compiler (`lib/loka/content/death.ex`) refuses an `experience` without `world.levelling`
(SCHEMA_VIOLATION at `world.death.penalty.experience`), an unknown narration key
(UNRESOLVED_REFERENCE at its `narration`);
the schema refuses the bounds and any other field. `cartridges/penalty_sampler` is the sampler.

### Death narration declarations

[Death lines](mechanics.md#death-lines-outside-a-combat-round-loka-3w3q) read the optional
`world.death.narration` (`DeathSettings.narration`, Beads
`loka-3w3q`): `player_died` and `woke`, each an optional TextKey. The compiler
(`lib/loka/content/death.ex`) refuses an unknown key (UNRESOLVED_REFERENCE at `world.death.narration.<field>`); the schema refuses any other field. The toolbox showcase declares
`woke`.

## First encounter authoring (M6-A)

`world.combat` requires combat@1, schedule@1, death@1, valid `world.death`
corpse/shrine settings. It owns
`player_attack {chance, damage_min, damage_max}`, positive `interval`,
`sleep_multiplier` and `flee_multiplier`, and `narration` text keys for player_hit,
player_miss, npc_hit, npc_miss, player_died and npc_died. All six resolve in the
cartridge catalog. An NPC's optional `attack` profile explicitly
makes it attackable and supplies its own chance/damage bounds; it requires explicit HP.
Chances are integers 0..100, damage bounds positive and ordered, multipliers positive.
Room `sanctuary: true` forbids admission. All new objects reject unknown fields.

Optional `world.combat.target_choice: true` opts into [target choice](mechanics.md#target-choice-in-the-same-room-toolbox-row-6a)
(toolbox row 6a). `cartridges/targets_sampler` is the sampler.

Optional `world.combat.allies` lists NPC DefinitionRefs (short keys in source, at least one) that
fight [beside the player](mechanics.md#npc-vs-npc-damage-allies-and-kill-credit-toolbox-row-6b)
(toolbox row 6b). Each must resolve to an authored NPC (not a `spawn_template`) with an `attack`,
and the combat narration must name `ally_hit` and `ally_miss`; otherwise SCHEMA_VIOLATION (or
UNRESOLVED_REFERENCE) at the entry. `cartridges/targets_sampler`'s yard is the sampler.

Optional `world.death_credit` is a list of `{npc, room, fact}` DefinitionRefs, expanded
from normal short references. Each NPC/fact appears once; NPC is an authored attackable
NPC, room its authored room, fact a player Boolean with false default. Runtime binds the
NPC definition to its exact fresh instance; this is finite authored credit, not spawn or
multiplayer accounting. The [combat consumer](mechanics.md#combat1--first-live-encounter-m6-a)
validates the actual fatal occurrence and hydrated corpse before assigning the fact.

The sampler release after0.0.8 adds five distinct rat credit facts and these profiles,
preserving the five finite rats. It removes cellar_door from both reciprocal exits and
removes the obsolete barrier/key/text. Cellar access is an ordinary free passage, so
shrine recovery requires no equipment/key. Other barriers and owner prose remain.
The historical0.0.8 fixture retains its original answer.

## Stock price declarations

[Stock-sensitive prices](mechanics.md#stock-sensitive-prices-toolbox-row-w11) add one optional ShopOffer field (`protocol/entity.schema.json`): `stock {items, buy}`, no other keys. `items` are 2 to 16 item refs (short keys in source) and `buy` 2 to 16 prices of at least 1, one per count held. The compiler (`lib/loka/content/commerce.ex`) refuses a `buy` whose length differs from `items`, an `items[0]` other than the offer's `item` or a flat `buy` other than `stock.buy[0]` (SCHEMA_VIOLATION `invalid_value` at the offer's `stock`), an item named twice or the `item` of a plain offer of the same shop (DUPLICATE_DEFINITION at `stock.items`: commerce save tracks a plain offer's item by receipt, and stock and trade jobs move set items) and an entry that names no item (UNRESOLVED_REFERENCE at `stock.items[i]`). Only the offer's `item` must start with the shopkeeper; the other set items may start in any authored holder. A `buy_discount`'s bounds cover every table entry. Sampler: `cartridges/prices_sampler`.

## Fast travel declarations

[Fast travel](mechanics.md#fast-travel-toolbox-row-32) reuses the transport endpoint declarations
(`protocol/transport.schema.json` `TransportDefinition`) unchanged: a reciprocal route pair between two waypoint rooms that share no exit,
each with its own `use_transport` action whose `policy` is
`{"op": "visited_count", "room": "<destination>", "at_least": 1}`.

## Escrow declarations

[Escrow custody](mechanics.md#escrow-custody-toolbox-row-20a) adds one optional field to the `entitlement` benefit (`protocol/service.schema.json` `benefit`, a [Step](#steps-and-checks)): `escrow {items, quantity, custody}`, no other keys. `items` are 1 to 16 item refs and `custody` a room ref (short keys in source); `quantity` is an integer 1 to 16. The compiler (`lib/loka/content/services.ex`) refuses an `items` entry that is not an item and a `custody` that is not a room (UNRESOLVED_REFERENCE at each), a `quantity` above the number of `items` (SCHEMA_VIOLATION `invalid_value` at `.benefit.escrow.quantity`) and an `items` entry that is any NPC's shop offer (SCHEMA_VIOLATION `invalid_value` at `.benefit.escrow.items[i]`: commerce save reconciles offer custody by receipt), and an item named twice in `items` (DUPLICATE_DEFINITION at `.benefit.escrow.items`). The cartridge text must hold `service.order_open` and `service.missing_inputs` when `escrow` is present.

## Claim and cancel declarations

[Timed job claim and cancel](mechanics.md#timed-job-claim-and-cancel-toolbox-row-20b) adds two optional fields to `escrow`:

- `ready_after`: an integer, 1 to 31536000.
- `output`: an item ref.

`ready_after` needs `output`; an `output` alone is a [barter](#barter-declarations). It also adds two service benefit ops, `{op: "claim", service}` and `{op: "cancel", service}` (`protocol/step.schema.json` `Step`), each naming a service ref (short keys in source).

The compiler (`lib/loka/content/services.ex`) refuses:

- An `output` that is not an item: UNRESOLVED_REFERENCE at `.benefit.escrow.output`.
- An `output` not located in the custody room: SCHEMA_VIOLATION `invalid_value` at the same path.
- A claim or cancel `service` that is not a service: UNRESOLVED_REFERENCE at `.benefit.service`.
- A claim or cancel `service` whose benefit is not an escrow with `ready_after`: SCHEMA_VIOLATION `invalid_value` at `.benefit.service`.
- Another service's `entitlement` naming the `fact` of a commission whose escrow declares `ready_after`: SCHEMA_VIOLATION `invalid_value` at that service's `.benefit.fact`. It would open an order with no inputs and no job.
- A `ready_after` without the `schedule` capability: UNDECLARED_CAPABILITY at `.benefit.escrow.ready_after`.

Required cartridge text:

- A claim: `service.no_order`, `service.not_ready` and `service.no_output`.
- A cancel: `service.no_order` and `service.ready`.
- A commission with `ready_after`: also `service.no_output`.

## Barter declarations

[Barter](mechanics.md#barter-toolbox-row-kgd70) admits a service `price` of 0 (`protocol/service.schema.json`; `quoted_price` minimum 0 in `protocol/command.schema.json` and `protocol/action.schema.json`, GameView `ServiceOffer.price` minimum 0) and an escrow `output` without `ready_after`. The compiler (`lib/loka/content/services.ex`) refuses:

- `price` 0 on a service that is not an `entitlement` with `escrow`: SCHEMA_VIOLATION `invalid_value` at `.price`.
- A claim or cancel naming a commission with no `ready_after`: SCHEMA_VIOLATION `invalid_value` at `.benefit.service` (nothing is left to claim).

Required cartridge text: an escrow with `output`: `service.no_output`.

## Property and bank declarations

[Property and bank](mechanics.md#property-and-bank-toolbox-rows-24-and-25) adds two service benefit ops (`protocol/step.schema.json` `Step`), `{op: "deposit", account, vault, amount}` and `{op: "withdraw", account, vault, amount}`, no other keys. `account` is a fact ref and `vault` an NPC ref (short keys in source); `amount` is an integer 1 to 1000000. Property itself declares nothing new: an `entitlement` service and G7 `locks`.

The compiler (`lib/loka/content/services.ex`) refuses:

- An `account` that is not a fact, or a `vault` that is not an NPC: UNRESOLVED_REFERENCE at `.benefit.account` or `.benefit.vault`.
- An `account` that is not a bounded int player fact (scopes `["player"]`, `minimum` 0, a `maximum`, default 0), or that another engine writer owns (a reserved fact such as `skill_<key>`, `uses_<key>` or `scene_<key>`, a dream-owned scene fact, a patrol `trust_fact` or an entitlement fact; `foreign_names` in `lib/loka/content/position.ex`): SCHEMA_VIOLATION `invalid_value` at `.benefit.account`.
- An `account` whose `maximum`, or a currency whose `maximum` − `minimum`, is below `amount` (no deposit could ever succeed): SCHEMA_VIOLATION `invalid_value` at `.benefit.amount`.
- A `vault` without a `resource_starts` entry in the service's currency: SCHEMA_VIOLATION `invalid_value` at `.benefit.vault`.
- Two deposit or withdraw services naming one `account` with different vaults or currencies: SCHEMA_VIOLATION `invalid_value` at each one's `.benefit.vault`.

The account is engine-written: an authored write to it (a dialogue, reaction or scripted action `fact.assign` or `fact.adjust`) is RESERVED_FACT, as for an entitlement fact. Another benefit cannot name it: an entitlement needs a Boolean fact and a repair a durability fact.

Required cartridge text: `service.unaffordable`, and `service.no_funds` for either kind.

## Status declarations

[Status effects](mechanics.md#status-effects-over-time-toolbox-row-1) read `statuses/<key>.json` (compiled `statuses`, capabilities `status@1` and `death@1` since a fatal hp tick runs the death sequence): `{duration, tick_every, resource, per_tick, name, narration: {applied, tick, expired}}`. `duration` and `tick_every` are positive logical seconds with `tick_every < duration`; `resource` names one pool of this cartridge; `per_tick` is a nonzero signed integer added each tick; `name` and each narration key must exist in the text catalog. A reaction step `{op: "status.apply", status: <key>}` names a declared status. An edible item's optional `cures: [<key>, ...]` names declared statuses it ends. The compiler (`lib/loka/content/status.ex`) refuses each violation. `cartridges/status_sampler` is the sampler: `poison` (hp −1 every 60 s for 300 s), `blessing` (mv +5 every 600 s for 3600 s), an antidote curing `poison`, and two room-entry reactions. [Row G3](mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3) adds: an NPC or item definition's optional `immune: [<key>, ...]` (declared statuses, at least one); a `status.apply` step's optional `item: <key>` (an item of this cartridge, whose authored instance takes the status); and the triggers `{event: "status_ticked"}` and `{event: "status_expired"}` with an optional `status: <key>` filter. The compiler refuses an unresolved name (`UNRESOLVED_REFERENCE`). `cartridges/npc_status_sampler` is its sampler. [Row 2c](mechanics.md#status-modifiers-toolbox-row-2c) adds a status's optional `modifies: [{attribute, modifier}, ...]` (1 to 16 `ItemAffect`): `attribute` names an attribute of this cartridge (source: its short key), `modifier` is a ResourceInt. The compiler refuses an unresolved attribute (UNRESOLVED_REFERENCE at the entry's `attribute`). A status with `modifies` may omit `per_tick` and then never ticks; the compiler refuses a status with neither (SCHEMA_VIOLATION at `per_tick`). Its samplers are `might` in `cartridges/derived_sampler` and `fury` in `cartridges/npc_status_sampler`, neither of which ticks. [Homestead row hs-5](mechanics.md#cooking-homestead-row-hs-5) adds an edible item's optional `applies: [<key>, ...]` (declared statuses, at least one), applied to the eater's body after the meal and its cures. The compiler refuses an unresolved name (UNRESOLVED_REFERENCE at the entry) and a listed status whose `modifies` names a `world.derived.hp_max` term attribute (SCHEMA_VIOLATION at the entry; loka-kgd.50). Sampler: `cartridges/kitchen_sampler`. Row loka-x6t.64 adds a status's optional `kind: "buff" | "debuff"`, the polarity of its icon in the GameView's `ConditionView.kind`; without it the kernel derives one from the effect fields (`kernel/ts/src/view/resources.ts`): debuff on any harm (a negative `per_tick`, modifier or resistance, `fear`, `blocks`, `allows`, `perception` blind or deaf, a `movement.cost_percent` above 100), buff on a gain alone, and no kind for a status with no effect field. The compiler refuses another value (SCHEMA_VIOLATION at `kind`). Samplers, all authored debuffs: `bruised` and `notched` in `cartridges/variants_sampler` (a positive tick that is harm), `gored` in `cartridges/toolbox_showcase` and `scar` in `cartridges/scars_sampler`. Row loka-kgd.176 adds a status's optional `narration.observed` (a TextKey), told when a first application lands on an NPC or item the player sees in the room, or on the room the player stands in, and for an item it also turns on the expired line when the player sees it go out (for a room, when the player stands in it; loka-x6t.37; a room's lines describe what is felt or heard, not seen, because they also play in a dark room) ([row G3](mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3); loka-y6yg.48). The compiler refuses a key missing from the text catalog (SCHEMA_VIOLATION at `narration`, as for the other narration keys). Samplers: the golem's `wet`, `shocked`, `stunned` and `warm`, and the bier's `burning`, in `cartridges/toolbox_showcase`. Row `loka-x6t.30` adds the optional `narration.skipped` (TextKey): told when the status bars a combat blow, in place of the engine's `combat.skipped`; the compiler refuses a missing key.

[Rows 18 and 42](mechanics.md#potions-and-songs-toolbox-rows-18-and-42) add a `status.apply` step's optional `npc: <key>`: an NPC of this cartridge, whose authored instance takes the status. The compiler refuses an unresolved NPC (UNRESOLVED_REFERENCE at the step's `npc`), a spawn template or a step that also names `item` (SCHEMA_VIOLATION at `npc`). A potion is content: a liquid kind, a vessel holding it and a reaction on `{event: "drank", kind: <key>}`. `cartridges/buffs_sampler` is the sampler.

[Row W8](mechanics.md#permanent-statuses-toolbox-row-w8) allows `duration: "permanent"`: such a status is exempt from `tick_every < duration`, may declare a nonzero `per_tick` (it then ticks until cured, Beads `loka-rn3b`; the compiler refuses a `status.apply` of such a status naming `item`, `room` or `tag`, or using the default subject on a `status_applied`, `status_ticked` or `status_expired` trigger, SCHEMA_VIOLATION at that step's key, or its `status` for the default subject; a non-body holder those checks do not reach, a structure's `weathering` or another event's default subject, never folds and costs one step per tick) and may omit `narration.expired`, which a timed status still requires; its `modifies` may not name an attribute the derived hp maximum reads. The compiler refuses each violation (SCHEMA_VIOLATION at `narration.expired` or at `modifies[i].attribute`). `cartridges/scars_sampler` is the sampler.

[Row W21](mechanics.md#fear-and-morale-for-npcs-toolbox-row-w21) adds a status's optional `fear: true` and a `status.apply` step's optional `co_present: true`: such a status may omit `per_tick`, as one with `modifies` may; such a step names no holder. The compiler refuses a `co_present` step that also names `item` or `npc` (SCHEMA_VIOLATION at that field); the schema refuses any other value. `cartridges/fear_sampler` is the sampler.

[The status readers](mechanics.md#status-readers-toolbox-rows-sr1-sr2-and-sr3) add: a `status_active` leaf's `subject: "self"` or `"subject"`; the trigger `{event: "status_applied"}` with an optional `status: <key>` filter; and the reaction step `{op: "status.cure", status: <key>}`, which names a declared status and no holder. The compiler refuses an unresolved status (UNRESOLVED_REFERENCE at the step's `status`); the schema refuses a cure step naming `item`, `npc` or `co_present`. `cartridges/elements_sampler` is the sampler.

[Rows SR4 and SR5](mechanics.md#command-blocks-and-resistances-on-a-status-toolbox-rows-sr4-and-sr5) add a status's optional `blocks` and `allows` (each 1 to 64 Command type names) and `resistances` (`Resistances`, as on an NPC), and such a status may omit `per_tick`. The compiler (`lib/loka/content/status.ex`) refuses a name that is no registered command, or is `run_job` or `elapsed` (UNKNOWN_COMMAND at `blocks[i]` or `allows[i]`). `cartridges/ward_sampler` is the sampler.

[Rows SR6 and SR8](mechanics.md#perception-and-concealment-on-a-status-toolbox-rows-sr6-and-sr8) add a status's optional `perception` (`sight`: `blind`, `dark_sight` or `see_invisible`; `hearing`: `deaf`; at least one) and `concealment` (`invisible` or `hidden`), and such a status may omit `per_tick`. The compiler (`lib/loka/content/status.ex`) refuses an empty `perception` (SCHEMA_VIOLATION at `perception`).

[Row 16](mechanics.md#sneak-and-hide-toolbox-row-16) adds a concealing status's optional `pierced_by: {skill, attribute}` (both required). The compiler refuses it without `concealment` (SCHEMA_VIOLATION at `pierced_by`), a skill or attribute naming nothing (UNRESOLVED_REFERENCE at `pierced_by.skill` or `.attribute`). `cartridges/sneak_sampler` is the sampler.

[Row SR7](mechanics.md#movement-on-a-status-toolbox-row-sr7) adds a status's optional `movement`: `cost_percent` (0 to 1000) and `passes` (1 to 3 of `air`, `chasm`, `water`), and such a status may omit `per_tick`. `air`, `chasm` and `water` are `Tag` members a room, item or barrier may carry.

[Status reader 9](mechanics.md#a-room-as-a-status-holder-status-reader-9) adds an optional `room` (a DefinitionRef of a room of the cartridge) to a reaction's `status.apply` step. The compiler (`lib/loka/content/reactions.ex`) refuses an unknown room (UNRESOLVED_REFERENCE), `room` beside `item`, `npc` or `co_present` (SCHEMA_VIOLATION at `room`).

[Fire](mechanics.md#fire-toolbox-row-w22) adds: a `co_present` `status.apply` step's optional `tag: <Tag>` (the schema refuses a `tag` without `co_present`, missing_property at `co_present`), and the reaction step `{op: "barrier.set", to: <BarrierState>}` with exactly one of `barrier: <key>` or `tag: <Tag>` (the schema refuses both or neither). The compiler (`lib/loka/content/reactions.ex`) refuses an unresolved `barrier` (UNRESOLVED_REFERENCE at the step's `barrier`) and a `to: "locked"` step whose named barrier, or any barrier carrying its `tag` on an exit (of the trigger's `room` filter when it has one), has no `key_item` (BARRIER_UNREACHABLE_KEY at the step's `to`): no key could ever unlock it. A `barrier.set` uses `barrier_changed`, so its cartridge requires `barrier@1`. `cartridges/toolbox_showcase` (the smithy) is the sampler.

[Decay](mechanics.md#decay-toolbox-row-41) adds the reaction step `{op: "item.move", room: <key>}` (a short room key the compiler expands, `Loka.Content.LeafRefs.steps/0`). The compiler (`lib/loka/content/reactions.ex`) refuses an unresolved room (UNRESOLVED_REFERENCE at the step's `room`); the schema refuses a step without `room` or with another key. The step emits no event, so it needs no owner capability. `cartridges/decay_sampler` is the sampler.

[Phased world events](mechanics.md#phased-world-events-toolbox-row-37a) add the reaction step `{op: "population.spawn", plan: <key>}` (a short population plan key the compiler expands, `Loka.Content.LeafRefs.steps/0`), on any trigger. The compiler (`lib/loka/content/reactions.ex`) refuses a plan that names no population plan of the cartridge (UNRESOLVED_REFERENCE at the step's `plan`); the schema refuses a step without `plan` or with another key. The step emits no event, so it needs no owner capability beyond the plan's own `population`. The same row lowers a plan's `day_target` and `night_target` minimum to 0 (a plan only the step fills), and the schema refuses a negative target (below_minimum). `cartridges/raid_sampler` is the sampler.

[Replenish on an event](mechanics.md#replenish-on-an-event-homestead-hs-1) adds the reaction step `{op: "replenish.run", key: <key>}` (a short replenish entry key the compiler expands, `Loka.Content.LeafRefs.steps/0`), on any trigger. The compiler (`lib/loka/content/reactions.ex`) refuses a key that names no replenish entry of the cartridge (UNRESOLVED_REFERENCE at the step's `key`) and a second step with the same key in one rule (DUPLICATE_DEFINITION at that step's `key`); the schema refuses a step without `key` or with another key, and a rule with `after` carrying the step is SCHEMA_VIOLATION `invalid_value` at its `op`. The step emits no event, so it needs no owner capability.

[Population plans reading populations](mechanics.md#population-plans-reading-populations-toolbox-row-w12) add the policy leaf `population_count {plan, at_least}` (a short population plan key the compiler expands, `Loka.Content.LeafRefs`) and three optional population plan fields: `floor` (1 to `day_target`, refused with `chance`), `birth_when` and `wander_when` (versioned policies whose trees may use only `all`, `any`, `not`, `population_count`, `time_window`, `sky` and `barrier_state`; SCHEMA_VIOLATION otherwise). A `plan` naming no population plan of the cartridge is UNRESOLVED_REFERENCE at the leaf's `plan`. `cartridges/fen_sampler` is the sampler.

[The attacker filter](mechanics.md#attacker-filter-loka-kgd79) adds an optional `attacker: <key>` filter to the `attack_result` trigger (a short NPC key the compiler expands, `Loka.Content.Reactions.filters/0`). The compiler (`lib/loka/content/reactions.ex`) refuses an unresolved NPC (UNRESOLVED_REFERENCE at `reactions/<key>.on.attacker`) and a spawn template (SCHEMA_VIOLATION `invalid_value` there: a template has no authored instance to attack). `cartridges/toolbox_showcase` (the boars' gore) is the sampler.

*Not supported yet:* a status whose `modifies` names an attribute the derived hp maximum reads (`con`): one that ends before a later hp write in the same wait faults (Beads `loka-kgd.50`); author such buffs on other attributes until it lands.

## Terrain declarations

[Terrain movement costs](mechanics.md#terrain-movement-costs-toolbox-row-43a) (row 43a) read cartridge.json's `world.movement.terrain`: an object whose keys are `Tag` values and whose values are integer percents, 0 to 1000 (`protocol/cartridge.schema.json` `WorldSettings`). A move into a room scales its fare by the percent of each tag the room carries, in the room's tag order, each step rounded down: on the default 1 mv fare any percent under 100 makes the move free, and stacked tags floor per step (`[road, marsh]` at 50 then 300 costs 0). A room's tags are unique (SCHEMA_VIOLATION `duplicate_items`). `world.movement.cost` is now optional: without it the 1 mv default is scaled. Row 43a adds the tags `road` and `marsh`. An unknown tag or a percent out of range is SCHEMA_VIOLATION at `world.movement.terrain.<key>`. An empty `movement: {}` or `terrain: {}` is accepted and does nothing.

## Derived stat declarations

[Derived stats](mechanics.md#stats-derived-from-attributes-toolbox-row-2) read the optional `world.derived` in `cartridge.json` (`WorldSettings.derived`, owned by `attribute@1`): up to four tables, `hit_chance`, `damage`, `carry_grams` and `hp_max`, each `{terms: [{attribute, per_point, pivot}, ...], divisor?}` (`DerivedStat`). `attribute` names an attribute of this cartridge; `per_point` and `pivot` are ResourceInts; `divisor` is a positive integer, 1 when absent. `hit_chance` and `damage` need `world.combat`; `carry_grams` needs `world.carry`. The compiler (`lib/loka/content/derived.ex`) refuses an unresolved attribute (UNRESOLVED_REFERENCE at the term's `attribute`), a missing `attribute@1` (UNDECLARED_CAPABILITY at `world.derived`) and a table without its settings (SCHEMA_VIOLATION at the table). `cartridges/derived_sampler` is the sampler. A cartridge without `world.derived` keeps its bytes, hash and behavior.

## Item affect declarations

[Item affects](mechanics.md#item-slots-and-affects-toolbox-row-3) read an item's optional `affects` (`ItemDefinition.affects`, a list of 1 to 16 `ItemAffect {attribute, modifier}`, the shape of an ancestry's modifier). `attribute` names an attribute of this cartridge (source: its short key); `modifier` is a ResourceInt. The item needs a `slot` (`finger` is the thirteenth key). The compiler (`lib/loka/content/derived.ex`) refuses an affect without a slot (SCHEMA_VIOLATION at `affects`), an unresolved attribute (UNRESOLVED_REFERENCE at the affect's `attribute`), a missing `attribute@1` (UNDECLARED_CAPABILITY at `affects`). `cartridges/affects_sampler` is the sampler. A cartridge without affects or finger items keeps its bytes, hash and behavior.

[Unidentified items](mechanics.md#unidentified-items-toolbox-row-27) read an item's optional `identified` (`ItemDefinition.identified`, a DefinitionRef naming a fact of this cartridge, source: its short key). The fact is a `bool` and not per_subject, and the item declares `affects`. The compiler (`lib/loka/content/derived.ex`) refuses an unresolved fact (UNRESOLVED_REFERENCE at `identified`), a fact that is not a `bool` (FACT_TYPE_MISMATCH at `identified`), `identified` without `affects` (SCHEMA_VIOLATION at `identified`); the loader also refuses a per_subject fact there (FACT_SCOPE_UNSUPPORTED at `identified`, the [entity and pair fact](#entity-and-pair-fact-declarations) site walk). `cartridges/identify_sampler` is the sampler. A cartridge without `identified` keeps its bytes, hash and behavior.

Gear budget (balance tool 6b, [study](../rnd/balance-diagnostics-2026-10-11.md) §1 I2; Beads `loka-kgd.107.17`) is two optional declarations the engine ignores at runtime; they stay in the compiled cartridge, and only the [power report](#content-reports) reads them. `world.gear_budget` in `cartridge.json` (`WorldSettings.gear_budget`, owned by `attribute@1`) is `{per_slot, per_level}`, both required: `per_slot` maps SlotKeys (at least one of the 13) to the signed affect total an item in that slot may carry at its intended level 1, each an integer 0..2147483647; `per_level` is what each level above 1 adds, an integer 0..2147483647. An item's optional `intended_level` (`ItemDefinition.intended_level`, an integer 1..2147483647) is the level it is meant for; it needs `affects` and is valid without `world.gear_budget`; nothing checks it against `world.levelling`. The compiler (`lib/loka/content/derived.ex`) refuses `world.gear_budget` without `attribute@1` (UNDECLARED_CAPABILITY at `world.gear_budget`), an empty `per_slot` (SCHEMA_VIOLATION `too_few_items` at `world.gear_budget.per_slot`: the schema subset has no minProperties), `intended_level` without `affects` (SCHEMA_VIOLATION at `intended_level`). A cartridge without either keeps its bytes, hash and behavior.

Equip words (row 6a, Beads `loka-x6t.20`) are an item's optional `equip` (`ItemDefinition.equip`, `{wear, remove, worn, removed}`, all four TextKeys and all four required). `wear` and `remove` are the item's Wear and Remove labels, `worn` and `removed` the lines [equipment@1](mechanics.md#equipment1-kerneltssrcmechanicsequipmentrulets) tells when it is worn or removed. The item needs a `slot`. The compiler (`lib/loka/content/derived.ex`, `lib/loka/content/entities.ex`) refuses `equip` without a slot (SCHEMA_VIOLATION at `equip`), a key outside the text catalog (UNRESOLVED_REFERENCE at `equip.<field>`). A cartridge without `equip` keeps its bytes, hash and behavior.

[Experience and levelling](mechanics.md#experience-and-levelling-toolbox-row-4) read the optional `world.levelling` in `cartridge.json` (owned by `attribute@1`): `{thresholds, points_per_level, kills: [{npc, experience}, ...], level_up, gained}`. `thresholds` are strictly increasing positive ResourceInts; `points_per_level` is at least 1; each `npc` names an NPC of this cartridge (source: its short key) and `experience` is a positive ResourceInt; `level_up` and the optional `gained` (bindings `{amount}`) must exist in the text catalog (UNRESOLVED_REFERENCE at the field). A rule with `on.event: level_reached` needs `world.levelling` (SCHEMA_VIOLATION at `on.event`), its `level` filter is an integer from 2 to the thresholds' count + 1 (SCHEMA_VIOLATION `invalid_value` at `on.level`) and an `experience.grant` step in it is refused (SCHEMA_VIOLATION at the step); a grant reached indirectly, through a `fact_changed` rule, is allowed and bounded by the `reaction_depth` budget. Per level, such a rule narrates what opened and assigns the fact a new ability reads through `level_compare` or `fact_compare`. A reaction step `{op: "experience.grant", amount}` needs `world.levelling`. The compiler (`lib/loka/content/levelling.ex`) refuses thresholds that do not rise (SCHEMA_VIOLATION at the threshold), an unresolved NPC or text (UNRESOLVED_REFERENCE), a grant without `world.levelling` (SCHEMA_VIOLATION at the step), a missing `attribute@1` (UNDECLARED_CAPABILITY at `world.levelling`). `cartridges/levelling_sampler` is the sampler. A cartridge without `world.levelling` keeps its bytes, hash and behavior.

## Tag declarations

[Property tags](mechanics.md#property-tags-and-the-policy-leaf-set-toolbox-row-g1) are an optional `tags` list on an item, barrier or room source file (`ItemDefinition`, `BarrierDefinition`, `RoomDefinition`), each a `Tag` of the engine set; the compiler copies it into the artifact unchanged. A `tags` list and a `has_tag` policy node need `tag@1` in `requires.capabilities` (UNDECLARED_CAPABILITY at the member otherwise); its `item`, `barrier` or `room` takes a short key, expanded like `has_item`'s, and an unresolved one is UNRESOLVED_REFERENCE at that member in the compiler. Precedent sampler: `cartridges/tags_sampler`.

## Drop declarations

[Loot tables](mechanics.md#loot-tables-and-random-drops-toolbox-row-8) read an NPC's optional `drops` (`NpcDefinition.drops`, a list of 1 to 8 `{item, chance}`; requires `world.death`). `item` names an item of this cartridge (source: its short key) whose `location` is `{in: "npc", npc: <this NPC>}`; no item appears twice; `chance` is an integer 1 to 100; the NPC has `hp` with `gain` 0 (a regenerating NPC would revive holding its failed drops and re-roll them) and is not a `spawn_template` (population members carry their plan's `item`). The compiler (`lib/loka/content/death.ex`) refuses an unresolved item (UNRESOLVED_REFERENCE at the entry's `item`), an item this NPC does not hold or a repeated item (SCHEMA_VIOLATION at the entry), drops without `world.death`, without `hp`, with `hp.gain` above 0 or on a spawn template (SCHEMA_VIOLATION at `drops`). `cartridges/loot_sampler` is the sampler. A cartridge without drops keeps its bytes, hash and behavior.

## NPC attribute declarations

[Row G3](mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3) reads an NPC's optional `attributes` (`NpcDefinition.attributes`, a list of 1 to 16 `{attribute, value}`) and an opposed action check's optional `npc` (only beside `attribute`; the schema's `dependentRequired`). `attribute` names an attribute of this cartridge and `npc` an NPC of it (source: short keys, expanded by `lib/loka/content/npc_fields.ex` and `lib/loka/content/resolve.ex`); `value` is a ResourceInt. The compiler (`lib/loka/content/derived.ex`, `lib/loka/content/scripted_actions.ex`) refuses an unresolved attribute or NPC (UNRESOLVED_REFERENCE at the member), an attribute listed twice (SCHEMA_VIOLATION at the repeat's `attribute`), a check `npc` that is a `spawn_template` or does not list the check's attribute (SCHEMA_VIOLATION at `check.npc`). A check with `npc` needs no detail `rating`. Under `world.derived`, an NPC that declares `attributes` also takes the `hit_chance` and `damage` tables on its attack. `cartridges/npc_attr_sampler` is the sampler. A cartridge without these fields keeps its bytes, hash and behavior.

## Damage declarations

[Damage kinds, resistances and critical hits](mechanics.md#damage-kinds-resistances-and-critical-hits-toolbox-row-g2) read an attack profile's optional `kind` (a `DamageKind`) and `crit` (`{chance 1..100, multiplier 2..10}`), on `world.combat.player_attack`, an NPC's `attack` or an item's `weapon.attack`, and an NPC's optional `resistances` (`Resistances`: each member a `DamageKind` or `Tag` name, an integer -100 to 100). The schema closes the names and bounds; the compiler copies the fields unchanged. `cartridges/damage_sampler` is the sampler.

## Ranged weapon declarations

[Ranged first strike](mechanics.md#ranged-first-strike-toolbox-row-17) reads an item's optional `weapon.ranged {ammo}` (`protocol/entity.schema.json` `WeaponProfile`, no other field): `ammo` is a resource DefinitionRef (a short key in source, named like allies) of the body pool each shot spends; an unknown pool is UNRESOLVED_REFERENCE at `weapon.ranged.ammo`. When any item declares `weapon.ranged`, the combat narration must name `shot_hit` and `shot_miss` (optional TextKeys otherwise); a missing one is SCHEMA_VIOLATION at `.cartridge.world.combat.narration.shot_hit` (or `shot_miss`), as for `ally_hit` and `ally_miss`. `cartridges/ranged_sampler` is the sampler.

## Skill growth and rating declarations

[Skill growth and opposed checks](mechanics.md#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5) read a skill's optional `growth` (`SkillDefinition.growth`, 1 to 8 strictly increasing positive integers), a detail's optional `rating` (`InspectableDetail.rating`, an integer) and the action check `{kind: "opposed", key}` with exactly one of `skill` or `attribute` (source: short keys, expanded like `attribute_threshold`'s). The compiler (`lib/loka/content/skills.ex`, `lib/loka/content/scripted_actions.ex`) synthesizes the reserved fact `uses_<key>` for each skill with growth (an authored fact of that key is RESERVED_FACT) and refuse growth not strictly increasing (SCHEMA_VIOLATION at `growth`), an unresolved skill or attribute (UNRESOLVED_REFERENCE at the check member), an opposed check whose target detail has no `rating` (SCHEMA_VIOLATION at `check`). `cartridges/skills_sampler` is the sampler. A cartridge without these fields keeps its bytes, hash and behavior.

## Hidden passage declarations

[Hidden passages](mechanics.md#hidden-passages-and-search-toolbox-row-11) read an exit's optional `hidden_until` (`Connection.hidden_until`, `{fact, equals}`). `fact` names a fact of this cartridge (source: its short key), normally a `player`-scoped bool so discovery belongs to the character; `equals` is a value of its type (FACT_TYPE_MISMATCH otherwise). A hidden face has no `barrier` (BARRIER_MISMATCH at `hidden_until`), so no door verb can name it; its reciprocal face is an ordinary exit or hidden by its own declaration. The search that reveals it is an ordinary [action with outcomes](mechanics.md#scripted_action1-mechanicsscripted_actionrulets49) whose outcome assigns the fact. A patrol route leg with any hidden face to its next room, or an expedition route edge through a hidden face, is OUTCOME_MISMATCH at the route. The compiler refuses each case.

## Time gate declarations

[Time windows](mechanics.md#time-windows-hour-and-moon-gates-toolbox-row-10): a barrier source file may declare `opens_when`, a Policy, and any policy may use the `sky {lunar}` leaf (`calendar@1` in `requires.capabilities`). The compiler (`lib/loka/content/calendar.ex`, policy roots in `lib/loka/content/barriers.ex` `conditions`) checks `opens_when` like every other policy (owners, references, windows) and refuse a `sky` field naming a phase its calendar table does not author, or a table the calendar lacks (SCHEMA_VIOLATION at that field; [row 31](#sky-declarations) adds `weather`, `season` and `tide`). Sampler: `cartridges/time_sampler`.

## Climb declarations

[Rope and climb](mechanics.md#rope-and-climb-toolbox-row-30) reads an exit's optional `climb` (`Connection.climb`, `{item, damage, fell}`). `item` names an item of this cartridge (source: its short key), the aid a climber must hold; `damage` is the fall's HP loss, an integer of at least 1 (a cartridge number); `fell` is a text key (UNRESOLVED_REFERENCE without a catalog entry), the fall's narration. Declare `climb` only on the face that descends; the way back up is an ordinary exit. A patrol route leg with any climb face to its next room is OUTCOME_MISMATCH at the route; an expedition route may cross one (it is the player's own travel). The compiler refuses each case.

## Narration variety declarations

[Narration variety](mechanics.md#narration-variety-and-visit-tiers-toolbox-row-w7): `cartridge.json` may declare `alternates`, a map from a text key to a nonempty list of text keys (`CompiledCartridge.alternates`), and any policy may use the `visited_count {room, at_least}` leaf. Both need `alternates@1` in `requires.capabilities` (UNDECLARED_CAPABILITY at `alternates` or at the leaf's `op`). Every key and every alternate must be in the text catalog (UNRESOLVED_REFERENCE). `room` names a room of this cartridge (source: its short key). The compiler (`lib/loka/content/variety.ex`) refuses each case. A `visited_count` leaf without `knowledge@1` in `requires.capabilities` never holds; the compiler warns (VISITS_UNRECORDED at `cartridge.requires.capabilities`, compiler only, the build succeeds). Sampler: `cartridges/variety_sampler`.

## Sky declarations

[Derived sky](mechanics.md#derived-sky-weather-season-and-tide-toolbox-row-31): `calendar.season` and `calendar.tide` are `CalendarCycle`s checked like `calendar.lunar` (ordered cuts below the period, the first at 0, unique phases, origin + period a safe integer); `calendar.weather` lists 1 to 32 `{phase, weight 1..1000, wet?}` entries with unique phases. A `sky` leaf's `weather`, `season` or `tide` must name a phase its table authors (SCHEMA_VIOLATION at that field otherwise). Any of the three tables needs the calendar units (`units_per_hour`, `hours_per_day`, `subdivisions_per_hour`; SCHEMA_VIOLATION at `calendar` otherwise), since the status line that shows them needs them, as a `sky` leaf does. A room declares `exposed` in its `tags` (`tag@1`). The compiler (`lib/loka/content/calendar.ex`) refuses each case. Sampler: `cartridges/sky_sampler`.

## Pick and force declarations

[Pick and force a barrier](mechanics.md#pick-and-force-a-barrier-toolbox-rows-13-and-g12) adds no field: a barrier source file declares `initial: "closed"` (a keyless `locked` barrier in reach is BARRIER_UNREACHABLE_KEY) and an `opens_when` reading an instance bool fact; the pick or force is an action on a room detail with a `rating` and an `opposed` check, as the [time gate](#time-gate-declarations), [skill growth and rating](#skill-growth-and-rating-declarations) and [tag](#tag-declarations) declarations already check. Sampler: `cartridges/barrier_sampler`.

## Trap declarations

[Traps](mechanics.md#traps-trigger-disarm-and-reset-toolbox-row-12) add no field: two instance bool facts, a status, reactions on `entity_entered_room`, `check_failed {check}` and a reset event, and search and disarm actions on a room detail with a `rating`, as the [status](#status-declarations), reaction, [skill growth and rating](#skill-growth-and-rating-declarations) declarations already check. Sampler: `cartridges/traps_sampler`.

## Puzzle declarations

[Order and dial puzzles](mechanics.md#sequence-and-combination-puzzles-toolbox-row-26) add no field: bounded int instance facts, actions on room details, reactions on `action_completed {action}` with `fact.assign` or `fact.adjust`, and a barrier `opens_when` of `fact_compare`s, as the fact, reaction, [standing](#standing-and-disposition-declarations) and barrier declarations already check. Sampler: `cartridges/puzzles_sampler`.

## Quest offer target

A quest's optional `offer.target` names the fixture or NPC the offer draws on: `{kind: "detail", room, detail}` or `{kind: "npc", npc}`, with `room` and `npc` short refs (`protocol/quest.schema.json`). A reference that does not resolve is `UNRESOLVED_REFERENCE` at `quests/<key>.offer.target` (`.detail` beneath it for a missing fixture). The compiler refuses an offer without a target (`SCHEMA_VIOLATION` `invalid_value` at `quests/<key>.offer.target`), since the Room page draws no loose action ([book-ui.md](book-ui.md#room-page-anatomy)); the loader still accepts one and lists it on World. [Admission](mechanics.md#quest1-mechanicsquestrulets-kerneltssrcmechanicsquestlifecyclets) reads the target; a dialogue choice's `accept` does not.

## Quest deadlines

Toolbox row W24 ([rules](mechanics.md#quest-deadlines-toolbox-row-w24-engine-half)). `deadline` is one object; only `outcome` is required by the schema. The compiler (`lib/loka/content/quests.ex`) accepts two shapes: legacy (S2) with `at`, `fact`, `trust_fact` and `trust_amount` and no `after`; generic with exactly one of `after` (logical units from activation, at least 1) or `at`, and none of the legacy fields. Any other shape is `SCHEMA_VIOLATION` `invalid_value` at the `deadline` member. Compiler: `lib/loka/content/quests.ex`. Sampler: `cartridges/quest_sampler` (find_key).

## Quest stage hints

Toolbox row W23 ([rules](mechanics.md#quest-stage-hints-toolbox-row-w23)). A quest journal may declare `hints {active?, objectives_met?}`, each 1 to 8 `{after, text}` with `after` whole real minutes (1 to 1440) strictly ascending (else `SCHEMA_VIOLATION` `invalid_value` at the stage list) and `text` a catalog key (`UNRESOLVED_REFERENCE`). Hints need `time_policy.profile = real_elapsed` (`INVALID_TIME_POLICY` at the `hints` member). Compiler: `lib/loka/content/quests.ex`.

An action may declare `tip`, a catalog key (`UNRESOLVED_REFERENCE` at `actions/<key>.tip`), shown once ([rules](mechanics.md#quest-stage-hints-toolbox-row-w23)). The compiler adds the player bool fact `seen_tip_<key>` (default false; an authored fact of that name or a write of it is `RESERVED_FACT`), so a tip needs fact@1 (`UNDECLARED_CAPABILITY` at the `tip` member) and an action key of at most 55 characters (compiler `SCHEMA_VIOLATION` `invalid_value` at `actions/<key>.key`; in the loader the fact's key fails the schema). The compiler (`lib/loka/content/scripted_actions.ex`, `position.ex`) checks it.

An action may declare `reason`, a catalog key (`UNRESOLVED_REFERENCE` at `actions/<key>.reason`), the refusal text when its policy fails ([rules](mechanics.md#spell-cast-admission-toolbox-row-29a)). The compiler (`lib/loka/content/scripted_actions.ex`) checks it.

## Exposure declarations

[Exposure](mechanics.md#exposure-cold-hot-damp-and-windy-toolbox-row-w25) adds no definition field: an item declares `warm`, `cool`, `waterproof` or `windproof` in its `tags` ([tag declarations](#tag-declarations)), a reaction's `on` may be `{"event": "clock_hour"}` (no filters; its owner schedule@1 must be required), and a policy may use `wearing {tag}` (owner equipment@1). Sampler: `cartridges/exposure_sampler`.

## Entity variant declarations

[Entity variants](mechanics.md#entity-description-variants-toolbox-row-w6) are optional `TextVariants` lists on an NPC or an item (`name_variants`, `description_variants`; an item's `room_line_variants` are older; an NPC declaring `room_line_variants` is UNKNOWN_FIELD), each 1 to 16 `DescriptionVariant` whose text keys and touch links are checked as their base field's (a room-line variant links its own entity); a `name_variants` entry (`NameVariants`) may add `words`, shaped and checked as the entity's own `words` (each key in the text catalog). A policy may use `status_active {subject: "target", status}` (owner status@1) and `npc_present {npc}` (owner target_resolution@1); `status` and `npc` take short keys, expanded through `Loka.Content.LeafRefs` (an NPC's variants by `lib/loka/content/npc_fields.ex`), and an unresolved one is UNRESOLVED_REFERENCE at that member. Sampler: `cartridges/variants_sampler`.

## Name word declarations

Name words (loka-6qi): an NPC or item may declare `words {bare, article?, plural?}` (`NameWords`): `bare` and the optional `plural` are text keys checked as `name` (UNRESOLVED_REFERENCE at `words.bare` or `words.plural`), and `article` is one of `a`, `an`, `the`. `name` stays the phrase narration binds; `words` exist for presenters that compose a sentence from several names.

## Voice declarations

[Passive skill voices](mechanics.md#passive-skill-voices-toolbox-row-fd2) add one leaf, `skill_compare {skill, at_least}` (owner skill@1; UNDECLARED_CAPABILITY at the leaf's op). `skill` takes a short key through `Loka.Content.LeafRefs`; an unresolved one is UNRESOLVED_REFERENCE at it (`npcs/sage.description_variants[0].when.skill`). The checks are in `lib/loka/content/entities.ex`. Room, detail and NPC `asides` are retired (`loka-x6t.125`): UNKNOWN_FIELD. Sampler: `cartridges/voices_sampler`.

A detail may carry `title` (TextKey; UNRESOLVED_REFERENCE at `rooms/<room>.details.<key>.title`), the page title the Book shows for it. `mix loka.lint` requires it, and a prose link to it, on a detail some action targets (loka-x6t.120).

## Cue declarations

[Sense cues](mechanics.md#sense-cues-sound-smell-and-heat-toolbox-row-g6) add one optional field, `cues` (`Cues`: 1 to 4 `Cue {sense, text, range, when?}`, `protocol/entity.schema.json`), on a room, a room's detail, an item or NPC definition, an item's source `fuel`, a status and an action outcome (`outcomes.success` or `.failure`), and one leaf, `cue_perceived {npc, sense}`. Both are owned by `sense_cue@1` (UNDECLARED_CAPABILITY at the cue, `rooms/forge.cues[0]`, or at the leaf's op). A cue's `text` without a catalog entry is UNRESOLVED_REFERENCE at it (`actions/pick_lock.outcomes.failure.cues[0].text`); its `when` is checked and short references in it expand like any condition (`Loka.Content.Resolve.expand/2` expands every `cues` list), and the leaf's `npc` takes a short key through `Loka.Content.LeafRefs`. Compiler `lib/loka/content/cues.ex`. Sampler: `cartridges/senses_sampler`.

## Need declarations

[Hunger, thirst and dry days](mechanics.md#hunger-thirst-and-dry-days-toolbox-rows-g13-and-w25-dry) add one field: a liquid's optional `cures: [<key>, ...]` (`LiquidDefinition.cures`, at least one declared status), ended by a Drink of it. The compiler (`lib/loka/content/status.ex`) refuses an unresolved name (UNRESOLVED_REFERENCE at the entry). Needs themselves are [status declarations](#status-declarations) on cartridge pools. Sampler: `cartridges/needs_sampler`.

## Dialogue check declarations

[Dialogue skill checks](mechanics.md#dialogue-skill-checks-toolbox-row-14) read a dialogue choice's optional `check` (`DialogueChoice.check`, `Check` in `protocol/step.schema.json`): `{key, kind: "opposed", failure}` with exactly one of `skill` or `attribute` and exactly one of `rating` (an integer) or `npc` (source: short keys, expanded like an action check's). It needs check@1 (`UNDECLARED_CAPABILITY` at the check). The compiler (`lib/loka/content/check_kinds.ex`) refuses an unresolved skill, attribute or `failure` text (`UNRESOLVED_REFERENCE`), both or neither of `rating` and `npc` (`SCHEMA_VIOLATION` `invalid_value` at the check), an `npc` as an action check's (row G3), a key shared with an action's or another choice's check (`DUPLICATE_DEFINITION`), and a checked choice with any field but `label`, `narration`, `steps`, `availability` and `check`, a `skill.acquire` step, or in a dialogue with a quest or riddle (`OUTCOME_MISMATCH` at the check).

## Entity and pair fact declarations

[Entity and pair facts](mechanics.md#entity-and-pair-facts-toolbox-row-w2) add one `FactSpec` field, `per_subject: true` (absent otherwise; `false` is a schema error), on a fact with `scopes: ["instance"]` (entity) or `["player"]` (pair); `fact_compare` gains `subject: "target"`, `npc` and `item`, and a reaction's `fact.assign` gains `npc` and `item`, each `npc` or `item` a short key the compiler expands (`Loka.Content.LeafRefs`, `Loka.Content.Resolve`). A reaction step's unresolved `npc` or `item` is UNRESOLVED_REFERENCE in the compiler. The loader alone (installed stage, as before) reports FACT_SCOPE_UNSUPPORTED at: any reference to a `per_subject` fact other than a `fact_compare`'s, `fact.assign`'s or `fact.adjust`'s `fact` or a reaction's `fact_changed` trigger; a `fact_compare` of one naming no subject; a subject field on any other fact, a second subject field, or an `npc` that is a spawn template; a `subject: "target"` in a reaction, quest, barrier or skill, which has no action target; and such a fact in the steps of an escort, receive or hand_over choice, a riddle answer with a `wrong_limit`, or any choice of a dialogue whose quest has a legacy deadline `fact`. Sampler: `cartridges/scoped_facts_sampler`.

## Group declarations

[The group primitive](mechanics.md#group-primitive-toolbox-row-g8) adds one optional world setting, `world.group {member, stay?, fight?}` (`protocol/cartridge.schema.json` `WorldSettings`, no other field; `member` required; `stay` and `fight` from [hireling orders](mechanics.md#hireling-orders-toolbox-row-22a)): `member` is a fact DefinitionRef (a short key in source) naming a bool fact with `per_subject: true` and scopes exactly `["player"]` (a [pair fact](#entity-and-pair-fact-declarations)). An unknown fact is UNRESOLVED_REFERENCE at `.cartridge.world.group.member`; a fact of another shape is SCHEMA_VIOLATION there. With `world.combat` also declared, the combat narration must name `ally_hit` and `ally_miss`, as for `allies` (SCHEMA_VIOLATION at the missing one). `stay` and `fight` follow the same rules as `member` (a bool pair fact at the player; UNRESOLVED_REFERENCE or SCHEMA_VIOLATION at `.cartridge.world.group.stay` or `.fight`). [Hireling wages](mechanics.md#hireling-wages-toolbox-row-22b) add the optional `wage {resource, amount, every}` (all three required, no other field; `amount` and `every` integers of at least 1): `resource` is a resource DefinitionRef (a short key in source) naming a conserved resource (`gain` 0, no `regen`); an unknown one is UNRESOLVED_REFERENCE at `.cartridge.world.group.wage.resource`, another shape SCHEMA_VIOLATION there. A dialogue choice's `lesson_payment` (a hire fee) needs no `skill.acquire` step. Two or more `skill.acquire` steps, or `lesson_payment` with `payment`, stay SCHEMA_VIOLATION at the choice's `lesson_payment`. The compiler checks these fields; the rules are TypeScript only (no server consumes them, ADR-074). `cartridges/group_sampler` and `cartridges/hireling_sampler` are the samplers.

## Mount declarations

[Mounts](mechanics.md#mounts-toolbox-row-43b) add one optional world setting, `world.mount {riding}` (`protocol/cartridge.schema.json` `WorldSettings`, no other field), and one NPC field, `mount {terrain, cost_percent?}` (`protocol/entity.schema.json` `NpcDefinition`, no other field; `terrain` 1 to 8 unique `Tag`s, `cost_percent` an integer 0 to 1000; SCHEMA_VIOLATION otherwise). `riding` is a fact DefinitionRef (a short key in source) naming a bool [pair fact](#entity-and-pair-fact-declarations) (`per_subject: true`, scopes exactly `["player"]`): an unknown fact is UNRESOLVED_REFERENCE at `.cartridge.world.mount.riding`, a fact of another shape SCHEMA_VIOLATION there. An NPC `mount` without `world.mount`, or on a spawn template, is SCHEMA_VIOLATION `invalid_value` at the NPC's `mount`. Compiler `lib/loka/content/mounts.ex`; sampler `cartridges/mount_sampler`.

## Conditional schedule declarations

[Conditional schedules](mechanics.md#conditional-schedules-toolbox-row-w10): in source, a `daily_schedule` hour may be a list `[case, ..., room]` of 1 to 8 cases `{when, room, goal?}` (`when` a policy, `room` and its leaves' references short keys, `goal` a catalog key) ending in a short room key, the fallback. The compiler (`lib/loka/content/schedules.ex`; expansion in `npc_fields.ex`, conditions and goal texts in `entities.ex`) refuses a fallback that is not last or a case after it (SCHEMA_VIOLATION `invalid_value` at `npcs/<key>.daily_schedule.<hour>`), an unresolved room (UNRESOLVED_REFERENCE at `<hour>[<i>].room`, or `<hour>[<i>]` for the fallback) and goal text or leaf reference; it emits the hour's fallback in `daily_schedule` and builds `schedule_cases` from the checked cases, which source may not author. A case's `when` reads with the player as the actor and the NPC as the target, so actor-relative leaves (`npc_present`, `target_present`, `has_tag {subject: "room"}`, `light_off`) read the player's room and light, usually elsewhere, not the NPC's: `npc_present child` reads "the child is with the player", not "the child is home"; use a fact for the NPC's situation. The compiler refuses a `fact_compare` in a case `when` that names a fact with `player` scope (FACT_SCOPE_UNSUPPORTED at `npcs/<key>.daily_schedule.<hour>[<i>].when…fact`), as a schedule is world state with no player. No other leaf is refused. Sampler: `cartridges/schedule_sampler`.

## Standing and disposition declarations

[Standing and disposition](mechanics.md#standing-and-disposition-toolbox-rows-15-and-g11) add these fields. A reaction step `{op: "fact.adjust", fact, amount, npc?, item?}` (`protocol/reaction.schema.json`) names a bounded int fact (`minimum` and `maximum` declared; else FACT_TYPE_MISMATCH at `steps[<i>].fact`), its `npc` and `item` short keys as a reaction `fact.assign`'s. An NPC's `disposition {hostile?, friendly?, engage?, refuse?}` (`protocol/entity.schema.json`) holds two versioned policies, their references short keys, and two catalog keys (an unknown key is UNRESOLVED_REFERENCE at `npcs/<key>.disposition.refuse`); the compiler (`lib/loka/content/standing.ex`; expansion in `npc_fields.ex`, conditions and the engage text in `entities.ex`) refuses it on a spawn template, an `engage` present unless the NPC has both `hostile` and an `attack` (or absent when it has both), and a `refuse` without `hostile`: SCHEMA_VIOLATION `invalid_value` at `npcs/<key>.disposition`. A shop's `buy_discount` takes exactly one of `skill` or `friendly: true`; `friendly` needs the same NPC's `disposition.friendly` (else RESOURCE_SPEC_INVALID, `lib/loka/content/commerce.ex`). Subject `target` in a disposition condition reads the NPC ([W2](#entity-and-pair-fact-declarations)).

[Arrest](mechanics.md#arrest-and-trial-toolbox-row-35) (row 35) adds `disposition.arrest {to, narration}` (`protocol/entity.schema.json`): `to` a room short key, `narration` a TextKey. It needs `hostile` and no `engage` (else SCHEMA_VIOLATION at the disposition), an unknown room or text is UNRESOLVED_REFERENCE at `disposition.arrest.to` or `.narration`.

Author rule: an NPC with `disposition.hostile` refuses every dialogue while hostile, so give a quest's accept, hand-over, receive and escort to a speaker who cannot turn hostile, or make that betrayal the design. The compiler warns (HOSTILE_QUEST_SPEAKER, severity warning, at `dialogues/<key>.npc`) when such an NPC speaks a dialogue with a choice carrying `accept`, `hand_over`, `receive` or `escort`; the build succeeds and the loader does not check it.

## Rumour declarations

[Rumour by co-presence](mechanics.md#rumour-by-co-presence-toolbox-row-w3) adds one optional reaction trigger filter, `npc` on `entity_entered_room` (a short key the compiler expands, `Loka.Content.Reactions.filters/0`). An unresolved `npc` is UNRESOLVED_REFERENCE at `reactions/<key>.on.npc`, and a spawn template there, which has no instance to enter, is SCHEMA_VIOLATION `invalid_value`. Example (`cartridges/rumour_sampler/reactions/tells_innkeeper.json`): `{"on": {"event": "entity_entered_room", "room": "inn", "npc": "ada"}, "when": {"op": "fact_compare", "fact": "knows_mill", "npc": "ada", "equals": true}, "steps": [{"op": "fact.assign", "fact": "knows_mill", "npc": "innkeeper", "value": true}]}`.

## Lore deduction declarations

[Lore codex and deduction](mechanics.md#lore-codex-and-deduction-toolbox-row-46) adds no field: a deduction is an ordinary action with outcomes whose `policy` is `{op: "all", items}` with at least two `fact_compare` items `equals: true` on declared topics' facts (plus, for once only, a `not` of the granted topic's fact) and whose success `steps` have a `fact.assign` of another declared topic's fact to `true`. Its target should be a plain detail: an action on a readable or perception detail is listed among that detail's actions, not the place's, so the Journal cannot offer its card. GameView `deductions` (the sampler requires it); no loader check is added, since no declaration changes. A badge is a declared topic whose fact `entity_entered_room` reactions assign under `visited_count` (knowledge@1, alternates@1).


## Away recap declarations

The [away recap](mechanics.md#away-recap-toolbox-row-w27) reads the optional `time_policy.recap_after_minutes` in `cartridge.json` (`TimePolicy.recap_after_minutes`, an integer from 1 to 10080, real minutes, the maximum a safety bound). The schema refuses a value out of range or not an integer. `cartridges/recap_sampler` is the sampler. A cartridge without the field keeps its bytes, hash and behavior.

## Speech declarations

[Social verbs](mechanics.md#social-verbs-say-whisper-and-shout-toolbox-row-g9-engine-half) add one dialogue field and one reaction trigger. A dialogue's optional `keyword` (`SpokenKeyword`: 1 to 32 lowercase ASCII letters, `protocol/dialogue.schema.json`) makes a say or whisper of that word open it; talk never offers it. A reaction trigger `{event: "spoken", npc?, word?, loudness?}` (`protocol/reaction.schema.json`; `npc` a short key, `word` a `SpokenKeyword`, `loudness` one of `whisper`, `say`, `shout`) fires once per hearer (without `npc`, two hearers' writes to one shared fact compose in order; [limits](mechanics.md#social-verbs-say-whisper-and-shout-toolbox-row-g9-engine-half)). Both need `speech@1` (UNDECLARED_CAPABILITY at `dialogues/<key>.keyword` or at the trigger's event); a keyword dialogue declaring a `riddle` is OUTCOME_MISMATCH at its `keyword` (the riddle's save proof reads a talk receipt). Compiler `lib/loka/content/keywords.ex` and `lib/loka/content/reactions.ex`. A cartridge may declare `speech: {phrases}` (`protocol/cartridge.schema.json`): 1 or more speech@1 `Word`s (1 to 32 ASCII letters, SCHEMA_VIOLATION at `cartridge.speech.phrases[i]`), shown as say's word chips and projected unchanged as the GameView's `phrases`. Sampler: `cartridges/speech_sampler`.

## Emote declarations

[NPC emotes](mechanics.md#npc-emotes-g9) are a cartridge table owned by `emote@1` (`protocol/capability_registry.json`; the section without it is UNDECLARED_CAPABILITY). `emotes` (`protocol/cartridge.schema.json` `EmoteDefinition`) maps `id@version:emote/key` to `{key, others, to?}`, one file per entry under `emotes/` (the key is the file name). `others` is the TextKey the room sees, its text with `{actor}` ("{actor} cowers in fear."); `to`, when present, has both `others` ("{actor} bows to {target}.") and `you` ("{actor} bows to you."), else SCHEMA_VIOLATION. Every form must be in the text catalog (UNRESOLVED_REFERENCE at it). A [reaction@1](mechanics.md#reaction1-kerneltssrcmechanicsreactionts) step `{op: "emote", emote, npc?, to?: "subject"}` plays one (`protocol/step.schema.json`); `emote` and `npc` are short keys. An unknown `emote` is UNRESOLVED_REFERENCE at it, a `to` on an emote without `to` forms UNRESOLVED_REFERENCE at the step's `to` (`target` the emote's ref), and a spawn-template `npc` is refused as for every step `npc`.

## Use declarations

[Use X on Y](mechanics.md#use-x-on-y-toolbox-row-g4) adds one action target variant and one action step (`protocol/action.schema.json`). An action's `target` may be `{kind: "use", tool}` instead of a detail: `tool` (`UseTool`) names the held tool's properties, `tag` (a `Tag`) and/or `liquid` (a liquid of this cartridge, short reference allowed), at least one. The target item's properties are the action's `policy`, read through `has_tag` and `status_active` with `subject: "target"`. A step `{op: "status.cure", status}` ends that status on the action's target and is allowed only on a use action (SCHEMA_VIOLATION at its `op`: a detail holds no status). An unknown liquid or status is UNRESOLVED_REFERENCE; an opposed check on a use action must name an `npc`, since there is no detail rating (SCHEMA_VIOLATION at the check). The compiler checks these (`lib/loka/content/scripted_actions.ex`); a scene may not start on a use action (OUTCOME_MISMATCH).

## Harvest tool declarations

[Tool-gated harvest](mechanics.md#tool-gated-harvest-toolbox-row-19) adds one optional field to a detail's `harvest` (`protocol/room.schema.json`): `tool: {tag}`, `tag` a `Tag`. The field needs `tag@1`, as item tags do (UNDECLARED_CAPABILITY at `harvest.tool`; `lib/loka/content/room_parts.ex`). Sampler: `cartridges/harvest_sampler`.

## Replenish declarations

[Replenish](mechanics.md#replenish-toolbox-row-19b) adds one top-level section (`protocol/cartridge.schema.json` `ReplenishPlan`): `replenish`, keyed `id@version:replenish/key`, one source file per entry under `replenish/` (`<key>.json`). An entry is `{items, from, to, cap, count, every}`: `items` 1 to 64 distinct item refs (short keys in source); `from` and `to` each an `ItemLocation` whose ref is a short key in source (`in` room, npc or item; `template` refused); `cap` 1 to 64, `count` 1 to 64 and `every` at least 1 (clock units). The compiler (`lib/loka/content/replenish.ex`) refuses a `template` location, a holder with no placed entity (a spawn-template NPC or a template item) or an item holder that is not a container, and an item `to` when any listed item is a container, which may be or hold `to` (SCHEMA_VIOLATION at that `from` or `to`), `from` equal to `to` (SCHEMA_VIOLATION at the entry's `from`), and an item or holder that names no definition (UNRESOLVED_REFERENCE). A harvest detail's item starts in the detail's room, or in any authored holder when an entry lists it with that room as `to` (`lib/loka/content/exchanges.ex`). Sampler: `cartridges/replenish_sampler`.

## Craft declarations

[Craft](mechanics.md#craft-homestead-hs-10) adds one optional action field (`protocol/action.schema.json` `ActionCraft`): `craft {consume?, yield?}`, at least one. `consume {items, quantity, to, reason?}`: `items` 1 to 16 distinct item refs (short keys in source), `quantity` 1 to 16, `to` an `ItemLocation`, `reason` a text key in the catalog. `yield {items, from}`: `items` 1 to 64 distinct item refs, `from` an `ItemLocation`. The compiler checks, as for a [replenish entry](#replenish-declarations): an unresolved item or holder is UNRESOLVED_REFERENCE at the field, a repeated item DUPLICATE_DEFINITION at `items`, a `template` holder, a holder item that is placed nowhere or is not a container SCHEMA_VIOLATION at the holder, an unknown `reason` UNRESOLVED_REFERENCE at `consume.reason`. A craft on a storylet or spell target is SCHEMA_VIOLATION at `craft` (`Loka.Content.Replenish.craft/3`).

## Skill prerequisite declarations

[Skill trees](mechanics.md#skill-trees-homestead-hs-11) add one optional skill field (`protocol/cartridge.schema.json` `SkillDefinition`): `prerequisite`, a Policy evaluated for the learning actor. Its leaves are checked as `qualification`'s (an unknown `skill_compare` skill is UNRESOLVED_REFERENCE at `skills/carving.prerequisite.skill`); a `skill_compare` anywhere in it naming the skill itself is SCHEMA_VIOLATION at `prerequisite` (`Loka.Content.Skills.itself/3`), and so is one in a skill without `hidden` naming a skill with `hidden` (a shown box never waits on a box the Book does not draw). An ancestry's `skill` naming a skill with a `prerequisite` is SCHEMA_VIOLATION at `ancestries.<choice>.skill`, since a birth grant skips learning (the same `prerequisites`; `Loka.Content.Ancestries.learned_only/4`). [Skill tree views](mechanics.md#skill-tree-view-homestead-hs-14) add two more optional fields: `hidden` (`true` only, and only with a `prerequisite`; GameView, NPC lessons and talk choices leave the skill out while its prerequisite fails and it is not acquired; a `skill_compare` naming it in a non-hidden skill's `qualification` or any dialogue `policy`, and a dialogue `name` on a dialogue teaching it, are SCHEMA_VIOLATION at that field) and `profession`, a TextKey naming the Character page section the box is drawn under (an unknown key is UNRESOLVED_REFERENCE at `skills/<key>.profession`).

## Scripted action build step declarations

[Self-build](mechanics.md#built-rooms-s6-self-build) adds one outcome step an action outcome's `steps` may hold (`Step`, `protocol/step.schema.json`): `build {structure, direction}`, `structure` a structure ref (a short key in source) and `direction` a compass or vertical direction. The compiler (`builds` in `lib/loka/content/construction.ex`) refuses, at `actions/<key>.outcomes.<outcome>.steps[i]`: a build step outside the success outcome or on an action whose target is not a detail, a second build step in one outcome, a target room with no `site`, or a cartridge with no `world.construction` (SCHEMA_VIOLATION at `.op`); a catalog without `service.site_taken` or `service.construction_full` (UNRESOLVED_REFERENCE at `.op`); a structure or direction the target room's `site` does not list (SCHEMA_VIOLATION at `.structure` or `.direction`). The listed structure already resolves and owns construction@1.

## Durability declarations

[Durability, crafting quality and repair](mechanics.md#durability-crafting-quality-and-repair-toolbox-row-21) adds two fields. An item's `weapon` may declare `durability {fact, wear}` (`protocol/entity.schema.json` `WeaponProfile`): `fact` is a fact DefinitionRef (a short key in source) naming an int fact with `per_subject: true`, scopes exactly `["instance"]` and a safe integer `minimum` and `maximum`; `wear` is an integer 1 to 2^31-1. A service's `benefit` may be `{op: "repair", fact, amount}` (`protocol/step.schema.json` `Step`): `fact` (a short key in source) must be some item's `weapon.durability.fact`, `amount` an integer 1 to 2^31-1, and the cartridge text must hold the service's refusals `service.unaffordable`, `service.nothing_to_repair` and `service.full_durability`. An unknown fact is UNRESOLVED_REFERENCE; a durability fact of another shape is SCHEMA_VIOLATION at `weapon.durability.fact`, a repair fact no weapon names at `benefit.fact`; a missing refusal text is UNRESOLVED_REFERENCE at the service. The services checks are in `lib/loka/content/services.ex`; the rules are TypeScript only (no server consumes them, ADR-074). `cartridges/durability_sampler` is the sampler.

## Spell declarations

[Spell cast admission](mechanics.md#spell-cast-admission-toolbox-row-29a) adds one action target variant, one command and one policy leaf (`protocol/action.schema.json`, `protocol/command.schema.json`, `protocol/policy.schema.json`). An action's `target` may be `{kind: "spell", word}`: `word` is a `SpokenKeyword` (1 to 32 lowercase ASCII letters) that no other spell of the cartridge has (DUPLICATE_DEFINITION at each one's `target.word`); the player casts it by typing the word (`cast {word}`), never by the action key. Its requirements are the action's own fields: `policy` (a learned `fact_compare`, `level_compare {at_least}`, `stat_compare`, `has_item`), `costs` (mana and reagent pools) and `cooldown`. `level_compare` is owned by attribute@1. A spell target also names `learned` (required since [word bar S2](mechanics.md#spell-cast-admission-toolbox-row-29a)): a bool fact of this cartridge, player scope (UNRESOLVED_REFERENCE, FACT_TYPE_MISMATCH at `target.learned`; a per-subject fact is FACT_SCOPE_UNSUPPORTED). An opposed check on a spell must name an `npc` (SCHEMA_VIOLATION at the check). A room's action contribution that names a spell's key is UNRESOLVED_REFERENCE. The compiler checks these (`lib/loka/content/scripted_actions.ex`, `spells.ex` and `levelling.ex`). Sampler: `cartridges/spells_sampler`. A spell target may add `aimed {scopes}` (`scopes` one or more of `room_occupants`, `room_contents`, `inventory`; any other is SCHEMA_VIOLATION); the spell is then [cast at one target](mechanics.md#spell-cast-admission-toolbox-row-29a) (loka-x6t.109).

[Spell effects](mechanics.md#spell-effects-toolbox-row-29b) add three outcome steps a spell's `steps` may hold (`Step`, `protocol/step.schema.json`): `status.apply {status, npc?}`, `damage {npc?, kind, amount}` (`kind` a `DamageKind`, `amount` 1 or more) and `light.ignite {item?}` (`npc` and `item` required unless the spell is aimed, SCHEMA_VIOLATION at the field) (an item with a fuel source). Each names this cartridge's status, NPC or item (UNRESOLVED_REFERENCE at the field), sits only on a spell action (SCHEMA_VIOLATION at its `op`). Its owner must be declared (UNDECLARED_CAPABILITY at its `op`): status@1 for `status.apply` (by `status_applied`), death@1 for `damage` (by `entity_died`), light@1 for `light.ignite` (by the `ignite` command). The compiler checks these (`lib/loka/content/spells.ex` and `scripted_actions.ex`). Sampler: `cartridges/spell_effects_sampler`.

## Encounter declarations

[Random encounters](mechanics.md#random-encounters-toolbox-row-9) add one optional field to a population plan (`protocol/cartridge.schema.json` `PopulationPlan`): `chance`, an integer 1 to 100. A plan with it is an encounter plan, without it an ecology plan. Every other plan field and check is unchanged. Sampler: `cartridges/encounter_sampler`.

## Access lock declarations

[Access locks](mechanics.md#access-locks-toolbox-row-g7) add three optional fields, each an object of Policy (`protocol/policy.schema.json`) with no other key: a Connection's `locks {traverse}` and a RoomDefinition's `locks {enter}` (`protocol/room.schema.json`), an ItemDefinition's `locks {get?, put?}` with at least one (`protocol/entity.schema.json`). An unknown or misplaced access type, an empty `locks` or a value that is no policy is SCHEMA_VIOLATION (UNKNOWN_FIELD for an unknown key). A `put` lock on an item without `container: true` is SCHEMA_VIOLATION `invalid_value` at its `locks.put` (`items/chest.locks.put`). Each lock root joins the policy roots the compiler checks (`Loka.Content.RoomParts.conditions/1` and `Loka.Content.Entities.conditions/1`), so its references and fact types are checked like any condition's (UNRESOLVED_REFERENCE at the leaf's member, `rooms/hut.locks.enter.fact`), and short references in it expand. A room or exit lock is read with no target, so in the loader `subject: "target"` under it is FACT_SCOPE_UNSUPPORTED at that `subject`, as in the other targetless sites; an item lock may use it (the target is the item). Sampler: `cartridges/access_sampler`.

## Theft declarations

[Theft](mechanics.md#theft-fence-and-witnessed-offense-toolbox-rows-33-and-34) adds three optional declarations. `world.theft {skill, attribute, stolen, noticed, narration {seen, unseen}}` (`protocol/cartridge.schema.json` `WorldSettings`), all required: `skill`, `attribute` and `stolen` name definitions of this cartridge (UNRESOLVED_REFERENCE at the field); `stolen` is a bool, per_subject fact at scope `instance` only (FACT_SCOPE_UNSUPPORTED at `world.theft.stolen`), and an authored write to it is RESERVED_FACT; the narration keys resolve (UNRESOLVED_REFERENCE at `world.theft.narration.seen` or `.unseen`). An NpcDefinition's `locks {get}` (`protocol/entity.schema.json`), whose root joins the policy roots the reference stage checks like an item lock's. A ShopOffer's `stolen` (`true` only): SCHEMA_VIOLATION at the offer's `stolen` on a stock offer; such an offer may name an item that starts held by any NPC, while a clean offer naming an item another NPC holds stays UNRESOLVED_REFERENCE at the shop. A shop with a `stolen` offer needs the text key `shop.not_stolen`, the line its shelf shows when it refuses honest goods (UNRESOLVED_REFERENCE at the shop's `offers`, pass-1 GE3). With `world.theft`, a deposit or withdraw service whose `vault` NPC has no `locks.get` is SCHEMA_VIOLATION `invalid_value` at `services/<key>.benefit.vault`. Without `world.theft`, an NPC's `locks` or an offer's `stolen` is SCHEMA_VIOLATION `invalid_value` at that field. Sampler: `cartridges/theft_sampler`.

## Witness and move declarations

[Witness ledger and reaction moves](mechanics.md#witness-ledger-and-reaction-moves-toolbox-row-fd5-loka-kgd22) add two optional declarations (`protocol/reaction.schema.json`). A `witness` filter on an `item_acquired`, `item_dropped`, `action_completed`, `check_passed`, `check_failed`, `entity_died` or `attack_result` trigger names an NPC of this cartridge (UNRESOLVED_REFERENCE at `on.witness`), never a spawn template (SCHEMA_VIOLATION at `on.witness`); on any other kind it is UNKNOWN_FIELD. The step `npc.move {npc?, room?}` names an NPC and a room of this cartridge when present (UNRESOLVED_REFERENCE at `steps[i].npc` or `steps[i].room`), the NPC never a spawn template (SCHEMA_VIOLATION at `steps[i].npc`); a delayed rule (`after`) may not carry it (SCHEMA_VIOLATION `invalid_value` at the step's `op`). The compiler refuses each. Settle S4-1: `npc.move {plan, room}` names a population plan of this cartridge (UNRESOLVED_REFERENCE at `steps[i].plan`), never with `npc` and never without `room` (SCHEMA_VIOLATION `invalid_value` at `steps[i].plan`).

## Identity declarations

[Recognition and earned titles](mechanics.md#recognition-and-earned-titles-toolbox-rows-w15-and-fd9) add one optional declaration, `world.identity {name, name_variants?}` (`protocol/cartridge.schema.json` `WorldSettings`). `name` and each variant's `description` are text keys (UNRESOLVED_REFERENCE); `name_variants` are W6 `TextVariants`, owned by `description_variant` (UNDECLARED_CAPABILITY), each condition naming declared definitions (UNRESOLVED_REFERENCE); a `fact_compare` with `subject: "target"` there is FACT_SCOPE_UNSUPPORTED; the compiler raises each of these and refuses the rest.

## Ask declarations

[Ask about a topic](mechanics.md#ask-about-a-topic-toolbox-row-fd7) adds one NPC field and one reaction trigger. `NpcDefinition.ask {unknown, answers}` (`protocol/entity.schema.json`): `unknown` and each answer's `text` are text keys (UNRESOLVED_REFERENCE at the field); 1 to 32 answers `{topic, text, when?, grants?}`, whose `topic` and `grants` name topics of this cartridge (UNRESOLVED_REFERENCE at `npcs/<key>.ask.answers[i].topic` or `.grants`) and whose `when` is checked as every policy is. The NPC's `ask` needs `speech@1` and `topic@1` (UNDECLARED_CAPABILITY at `npcs/<key>.ask`). A reaction trigger `{event: "asked", npc?, topic?, answered?}` (`protocol/reaction.schema.json`; `topic` a topic of this cartridge, UNRESOLVED_REFERENCE at `on.topic`) needs `speech@1` like `spoken`. Compiler `lib/loka/content/asks.ex` and `lib/loka/content/reactions.ex`. Sampler: `cartridges/ask_sampler`.

## NPC door declarations

[NPCs use doors](mechanics.md#npcs-use-doors-toolbox-row-w26) add one optional field, `walks` (`true` only), on a schedule case (`protocol/entity.schema.json` `ScheduleCases`) and on a population plan (`protocol/cartridge.schema.json` `PopulationPlan`); a schedule case's `when` becomes optional (absent holds). In source a daily_schedule hour may also be one walking case `{room, walks: true}`, which the compiler splits into the hour's room and a one-case `schedule_cases` entry. A plain hour still names its room by key or full reference (the source validator tries the walking case, then the reference). Sampler: `cartridges/doors_sampler`.

## Trail declarations

[Tracks and trails](mechanics.md#tracks-and-trails-toolbox-row-w13) add three optional declarations. `world.trails {fresh_for, leads}` (`protocol/cartridge.schema.json` `WorldSettings`): `fresh_for` a positive integer of logical seconds; `leads` a TextKey per compass direction, each resolving (UNRESOLVED_REFERENCE at `world.trails.leads.<direction>`), with one for every direction some room's exit uses (UNRESOLVED_REFERENCE at `world.trails.leads`, `target` the direction). A population plan's `trail` and `hunts` (`true` only; `PopulationPlan`), each needing `world.trails` (UNRESOLVED_REFERENCE at the field, `target` `trails`). An action check `{key, kind: "track", plan}` (`protocol/action.schema.json` `ScriptedAction.check`), `plan` the key of a population plan of this cartridge with `trail` (UNRESOLVED_REFERENCE at `check.plan`). Each emits `fact_changed`, so the cartridge needs the `fact` capability (the lock stage). The compiler adds `trail_<P>_exit` and `trail_<P>_at` for each plan `P` with `trail`, and `trail_exit` and `trail_at` when some plan `hunts`; all at scope `instance` and `per_subject`; an authored fact of one of those names, or a write to one, is RESERVED_FACT, and a trailing plan's key over 53 characters is SCHEMA_VIOLATION `invalid_value` at its `key`. Sampler: `cartridges/tracks_sampler`.

## Boss phase declarations

[Boss phases](mechanics.md#boss-phases-toolbox-row-39) add two optional fields on a `resource_compare` leaf (`protocol/policy.schema.json`): `subject` (`"subject"` only) and `at_least_percent` (integer 1 to 100), with exactly one of `at_least` and `at_least_percent`; and one `attack_result` reaction filter, `target` (an NPC of this cartridge, UNRESOLVED_REFERENCE otherwise; `protocol/reaction.schema.json`).

## Delayed reaction declarations

[Delayed reactions](mechanics.md#delayed-reactions-toolbox-row-fd1) add three optional declarations. A reaction rule's `after` (`protocol/reaction.schema.json` `ReactionRule`), a positive integer of logical seconds; a rule with `after` carrying a `barrier.set`, `event.emit`, `item.move` or `population.suppress` step, or a `status.apply` with `co_present` or `tag`, is SCHEMA_VIOLATION `invalid_value` at that step's `op` (reactions/aftershock.steps[0].op). A reaction step `fact.stamp {fact, npc?, item?}` (owned by fact@1, emits fact_changed) and a policy leaf `time_since {fact, npc?, item?, at_least}` (`protocol/policy.schema.json`, owned by fact@1): each fact resolves (UNRESOLVED_REFERENCE at its `fact`) and is an int fact without `maximum` and with `minimum` absent or at most 0 (SCHEMA_VIOLATION `invalid_value` at its `fact`); `npc` and `item` follow `fact_compare`'s per_subject rule (FACT_SCOPE_UNSUPPORTED).

## Storylet declarations

Retired ([storylet deck](mechanics.md#storylet-deck-toolbox-row-fd3)): `ScriptedTarget` has no `storylet` kind, so an action declaring one fails with SCHEMA_VIOLATION at `target.kind`.

## Structure and site declarations

Built rooms S1 (Beads `loka-kgd.109.1`; construction@1) adds three declarations; nothing builds yet. `structures/<key>.json` (`StructureDefinition`, `protocol/cartridge.schema.json`): `name` and `description` text keys, optional `variants` (`DescriptionVariant`) and `tags` as a room's, optional `locks.enter` (a policy) as a room's; a structure and its tags and variants need their owners (UNDECLARED_CAPABILITY), a variant description its catalog entry (UNRESOLVED_REFERENCE). A room's `site` (`protocol/room.schema.json`): `directions`, 1 to 6 compass directions, none an exit of that room (SITE_EXIT_CONFLICT at `rooms/<key>.site.directions[i]`), and `structures`, 1 to 16 structures of this cartridge (UNRESOLVED_REFERENCE at `site.structures[i]`). `world.construction {max_total}`: a positive integer, the cartridge's cap on built rooms. A site and `world.construction` need construction@1 (UNDECLARED_CAPABILITY at `rooms/<key>.site` or `cartridge.world.construction`). Compiler `lib/loka/content/construction.ex`. Sampler: `cartridges/build_sampler` (`test/loka/content_construction_test.exs`, `kernel/ts/test/construction.test.ts`).

Built rooms S2 adds a service benefit `{op: "build", structure, site, direction}` (`protocol/step.schema.json` `Step`; [mechanics](mechanics.md#built-rooms-toolbox-row-s2-foundation)): `structure` and `site` resolve to a structure and a room (UNRESOLVED_REFERENCE), and the site's `site` lists both the structure and the direction (SCHEMA_VIOLATION `invalid_value` at `services/<key>.benefit.structure` or `.benefit.direction`). Compiler `lib/loka/content/services.ex`.

## Narrate declarations

[Settle S3-1](mechanics.md#settle-s3-1-narrate-n1) adds a reaction step `{op: "narrate", text}` (`protocol/reaction.schema.json` `ReactionRule`), owned by reaction@1. `text` is a key of the text catalog (UNRESOLVED_REFERENCE at the step's `text`: reactions/arrival_line.steps[0].text). A rule with `after` may carry it.

## Map position declarations

`layout.json` (optional) is a non-empty array of `MapPosition` rows `{room, x, y, z}` (`protocol/cartridge.schema.json`). It needs knowledge@1 (UNDECLARED_CAPABILITY at the file). Every room of the cartridge appears exactly once, at a unique `(x, y, z)` (SCHEMA_VIOLATION at the file). Each `room` resolves (UNRESOLVED_REFERENCE at `[i].room`). Coordinates are drawing data only: the map draws links from real exits, and positions never change movement, sight or reachability. Compiler `lib/loka/content/layout.ex`.
