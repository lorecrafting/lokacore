# Cartridges: source, compiler, artifact, loader

## Source layout

A cartridge source is a directory of JSON files (`lib/loka/content.ex:2`). An authored NPC or
item definition is a [blueprint](glossary.md); the cartridge packages it with the rest of the
world's definitions and text:

| File | Holds |
|---|---|
| `cartridge.json` | the manifest: `api_version`, `id`, `version`, `title`, `requires` (`kernel_api {at_least, below}`, `content_schema`, `rule_ir`, `capabilities {key: version}`, `client_features`), `supported_profiles`, optional `entry` room, `calendar {start}` (`cartridges/lantern_proof/cartridge.json`) and `world {movement {cost {resource, amount}}, bands}`: what a move costs and the cartridge's default condition bands; optional `chapters [{title, story_point?, outcome?}]` ([Chapters](mechanics.md#chapters-kerneltssrcviewviewts)) |
| `facts.json` | `{"facts": {name: FactSpec}}`; a dotted name maps to a snake_case key, two names mapping to one key is `FACT_NAME_COLLISION` |
| `text.json` | the TextCatalog: key → string |
| `resources.json` | overrides of the default pools' fields, or further ResourceSpecs, each with optional condition `bands [{at_percent, key, tone}]` (`lib/loka/content/resources.ex:2`) |
| `attributes.json` | `{"attributes": {key: {start}}}`: the cartridge's attributes (AttributeSpec without `key`; an authored `key` is `UNKNOWN_FIELD`), definition `start` supplies the fallback; [D11](mechanics.md#d11-character-choice-selected-contract) saves the selected character's values ([mechanics.md](mechanics.md#attributes1-kerneltssrcmechanicspolicyts60); `lib/loka/content/resources.ex:2`) |
| `map_positions.json` | static drawing metadata for rooms; real room exits remain the graph (`lib/loka/content/map_positions.ex:2`) |
| `rooms/`, `items/`, `npcs/`, `barriers/`, `recipes/`, `quests/`, `dialogues/`, `reactions/`, `story_points/`, `scenes/`, `policies/`, `actions/`, `skills/`, `topics/`, `liquids/`, `populations/`, `population_bundles/`, `services/`, `transports/`, `bleeds/` | one file per definition, `<key>.json`, the frozen shape without `key`; NPC and item files are blueprints |

A reference is a full DefinitionRef naming this cartridge, or short: the key alone, of the kind
its field takes (`Loka.Content.Checks.expand/2`, `lib/loka/content/checks.ex:37`). A `.json`
file outside these recognized root files and definition directories is `UNKNOWN_FIELD`. A
source with rooms, text or an entry compiles to
`loka-cartridge-v2`; v1 (manifest, facts, policies, actions) is the R4 form.

## Current bundled chapter

The shared app bundles `ashmere_missing_child@0.0.42` (v042), titled
**Ashmere — The Missing Child**, requiring kernel API1.37. Its independently derived
content hash is `5d8b0e3a16b209733707a8450cee5a4330965092498cf1d31ab8fdae9a50fc8b`,
with 57 rooms, 10 quests, 54 dialogues, 8 scenes, 38 locked capabilities and 211 initial IDs. The [artifact oracle](../../protocol/fixtures/missing_child_v042_hash.json),
[allocation oracle](../../protocol/fixtures/missing_child_v042_ids.json) and
[independent derivation review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-d10-primary-source-review.md) establish those answers.
D10 is published in [PR #263](https://github.com/lorecrafting/lokacore/pull/263), with
[source review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-d10-primary-source-review.md) and
[save/protocol review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-d10-save-protocol-review.md). A–D source is
installed; E1–E3 acceptance remains open in the [roadmap](../ROADMAP.md), including
chapter review and the browser/UI consistency gate. Native verification and known blur
remain deferred under the [mobile pause](../decisions/owner-decision-web-first-mobile-pause-2026-10-05.md).

The app uses its own `loka-ashmere-missing-child.db` save under the
[actual chapter cutover](../decisions/owner-decision-actual-chapter-cutover-2026-10-05.md).
The chapter retains the village and inn routes and playable Maud S1 (five rats,
earned key/trust, upstairs storage), combat, shrine return and real-elapsed time.
Maud stands behind the Drowned Lantern bar. The opening label says “The Missing Child
— in progress”; Q1, The First Lead, and both Q2 return paths are playable. The temporary Lantern
errand, Bram NPC/dialogues, lantern item, story point, scene and `search_plan` are
absent. Four connected fen rooms form the first south search route: Ferry Landing south to
Reed Path, south to Reed Bank, west to Willow Shade, south to Drowned Oak. Each exit has
its reciprocal; a visible fox-prints detail at Reed Path and tracks at Reed Bank can be
inspected without accepting a quest or waiting for the clock. This inspection grants no Q2 discovery credit and adds no swim/tide gate, item or
population ([FEN-01 decision](../decisions/pm-decision-fen01-south-search-2026-10-05.md)).
FEN-02 extends that route: Reed Bank south ↔ Mire Crossing north, Drowned Oak east ↔
Mire Crossing west, and Mire Crossing south ↔ Fox Hollow north. The plank and firm path
use the ordinary move at every hour, before and after Q1, after shrine return and cold
reopen; no tide, daylight, swimming or equipment gate applies. Visible plank and hollow
details open the installed Book detail pages with noun titles and descriptive inspection
only. These two details grant no Q2 credit; items, populations and exits to
unbuilt rooms remain deferred ([FEN-02 decision](../decisions/pm-decision-fen02-mire-hollow-2026-10-05.md)).
The [real chapter cast decision](../decisions/owner-decision-real-chapter-cast-2026-10-05.md)
keeps Old Bram outside the active cast.

Elspeth, Wren's mother, stands at Ferry Landing at every hour. Her opening conversation
introduces Wren and directs newcomers north through Well Lane to Village Green, or east
from Well Lane to the Drowned Lantern and Maud. Her selectable NPC detail uses the existing
[Book dialogue flow](book-ui.md#npc-dialogue-and-action-details); directions remain in that
detail's history rather than the World log. The informational replies grant no quest, fact or reward, and Leave preserves the north route. This fixed placement supersedes the
archived Elspeth Green/cottage schedule for the current opening
([opening NPC decision](../decisions/owner-decision-opening-elspeth-2026-10-05.md)).

Q1-A follows the [PM first-lead decision](../decisions/pm-decision-q1-a-first-lead-2026-10-05.md).
Elspeth's always-eligible guide includes an explicit accept choice for **The First Lead**;
only acceptance starts Q1. A unique 20g `fox_drawing` lies at Village Green by the elm,
using ordinary item detail with authored identity/description, Take and Leave under
[detail-page order](book-ui.md#detail-page-order). Its `current_state`/`has_item` objective
shows the active journal until held, then the ready text. Taking it before acceptance starts
nothing; acceptance while holding it is ready immediately. Dropping removes readiness,
and retaking restores it. The separate `a_elspeth_report` dialogue sorts before the guide
and is eligible only with Q1 active and the drawing held. Reporting resolves Q1 once,
retains the drawing, and says it could be Wren's, suggesting reeds south of the landing
without proof of his route. The guide remains available before and after report; Maud's
S1 offer and turn-in remain independently usable in every Q1 state. No hour or wait gates
apply. This village clue neither moves nor duplicates Wren's archived boot or tracks.
Its Q2 activation consumer is [the staged first search lead below](#source-layout).

The chapter retains its authored calendar/status, typed bell reaction and scene composition,
real_elapsed rate50/start64800, HP10, MV100, carrying ceiling12000, move cost1 and
position recovery18/36 per3600 logical seconds. The current release and independent
answers are [above](#current-bundled-chapter). Historical sampler/proof sources,
release pins and [sampler evidence](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/c1-sampler/README.md) remain labeled
with their actual release and are not bundled.
The app opens only the chapter file and offers no story picker. Missing pins follow
[explicit Start over](save.md#opening-a-story), without automatic deletion or migration.

Q2-A — the first Missing Child search lead — consumes that report: exact `first_lead/report`
automatically starts `missing_child` in the same receipt. Its current-state objective is the
player fact `fen.tracks_found`, default false. Only **Study tracks** at Reed Bank assigns it,
with Q2 active and the fact false; arrival, examine and Read never grant credit. Study has no
check, cost, duration or cooldown. The journal directs the player to Reed Bank, then toward
Fox Hollow and explicitly says Wren remains unfound. The quest remains **active**; this staged
objective adds no objectives-complete transition, turn-in, rescue or reward. The all-hours
Mire/Hollow route remains unchanged. See [Q2-A adoption](../decisions/pm-decision-q2-a-first-search-2026-10-05.md).

Q2-B places Wren and Vesper at Fox Hollow at every hour, without attack profiles or
light/PER requirements. Descriptive visits before Q2 activation or Study grant no progress.
The first eligible Vesper conversation requires active Q2 and studied tracks; accepting
`meet_wren` binds both living NPCs and assigns player fact `fen.wren_met`. Arrival, Look and
opening Talk do not. The next ordered conversation offers the letter-bank riddle: answer
`lantern`, bank `R N A O L T E N S`. Only its correct choice assigns player fact
`fen.vesper_riddle_answered`. The subsequent conversation offers the message return below, and Wren
has an informational reply. All progress uses the saved, original role identities.
The journal stages are seek tracks → tracks found/Wren unfound → Wren met/riddle pending →
riddle accepted/return decision pending. Q2 remains active through those stages.
[Q2-B adoption](../decisions/pm-decision-q2-b-wren-riddle-2026-10-05.md) records this boundary.

API1.9 `QuestJournal.active_variants` is an optional ordered list of 1–16
`{when: VersionedPolicy, text: TextKey}` entries. For an active quest only, the first holding
policy supplies its journal text; no match uses ordinary active/objectives_met selection.
This reuses policy evaluation and never changes objective truth or lifecycle. Compiler and
loader validate each policy/reference/text and require API1.9 for this field or a dialogue
riddle. Riddle choice references and bank multiplicity are checked before loading.

Reaction authoring accepts exact `on: quest_resolved {quest, outcome}` and
`apply: quest.activate {quest}` only under that trigger. Both quest references expand from
source short keys, resolve to local quest definitions, and require the quest event owner in
the capability lock. These trigger/consequence forms require kernel API at least 1.8.
Existing fact/room triggers retain their semantics.
From API1.12, fact_changed reactions may apply typed `quest.resolve {quest, outcome}`
and `quest.fail {quest, outcome}`. Both require a local quest reference and quest capability;
resolve emits the quest-owned `quest_resolved` event. A scene may start on exact
`quest_resolved {quest, outcome}` instead of a story point, with the same actor/instance
evidence check as reaction delivery. The compiler expands these short quest references.
Toolbox row W1: `on.event` may be any registered event kind, with the optional filters of the
[reaction@1 table](mechanics.md#reaction1-kerneltssrcmechanicsreactionts); no new `kernel_api`
floor. The compiler expands each short definition filter (`item`, `room`, `quest`, `story_point`,
`barrier`, `scene`, `kind`, `victim`) and both kernels refuse one that names no local definition
of its kind. `cartridges/reactions_sampler` is the sampler: dropping the bone in the yard sets
`crow_drawn`, whose room variant shows the crow; dropping the pebble does not.

## Carrying settings and item mass

An authored `world.carry = {max_grams: nonnegative safe integer}` opts a v2 cartridge into
[voluntary carrying admission](mechanics.md#containment1-kerneltssrcmechanicscontainmentrulets).
There is no engine carrying default. `ItemDefinition.mass_grams` is an optional nonnegative
integer at most 2147483647; with carry opted in, every item definition must author it, including
nested items. Explicit zero is valid; omission never means zero under opt-in. Missing mass is
`SCHEMA_VIOLATION` with `data.error = missing_property` at the item's `mass_grams`; schema
validation rejects malformed, negative or out-of-range mass and carry settings. Compiler and
loader enforce the same requirement before any world or save mutation. Without carry, old
content, hashes and carrying behavior retain their existing meaning.

Carry requires `containment@1` and `requires.kernel_api.at_least >= 1.3`; compiler and loader
reject an older minimum, and the existing installed API gate rejects an older implementation. This extension
uses the existing containment capability and source/world settings seams, without a new
capability or format tag.

Room details may embed `readable {label, text}` under the `readable@1` lock; both
fields resolve to catalog TextKeys in compiler and loader. Optional `readable.title` supplies
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
ResourceInt. Compiler and loader require `minimum <= start <= maximum`
(`RESOURCE_SPEC_INVALID`). No bands, regen, key or arbitrary pool map is accepted.
Missing hp preserves legacy behavior. Presence requires resource@1 and an authored
`requires.kernel_api.at_least >= 1.4` (`KERNEL_API_RANGE_INVALID` otherwise); this field was introduced in API 1.4. Generic manifest range validation remains, but
older-development compatibility is not required under the [owner policy](../decisions/owner-decision-forward-development-2026-10-05.md). Runtime definition and
row semantics live in [resource@1](mechanics.md#resource1-kerneltssrcmechanicsresourcets).


A ResourceSpec may opt into `regen {every, by_position}`. `every` is a positive safe integer;
`by_position` requires all four keys `standing`, `sitting`, `resting`, `sleeping`, each a
nonnegative ResourceInt gain per interval (zero allowed). Both compiler and loader enforce
`every <= floor(9007199254740991 / (max_authored_rate + 1))` (`RESOURCE_SPEC_INVALID` at
the pool's `regen`) and require `position@1` (`UNDECLARED_CAPABILITY` at `regen`),
`time_policy.profile=real_elapsed` (`INVALID_TIME_POLICY` at `regen`), and an additive
recovery API lower bound1.2 (`KERNEL_API_RANGE_INVALID` at
`requires.kernel_api.at_least`). `gain` remains required for
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
- a recipe's, quest's or dialogue's key is no registered command's and no other action's,
  recipe's or quest's (`DUPLICATE_DEFINITION`: each is an ActionSet identity); an NPC may speak
  several dialogues; no dialogue role named `actor`; a choice's `accept` names a quest, in a
  dialogue without a `quest`, on a choice without a `hand_over` (`OUTCOME_MISMATCH`); a recipe has a `failure` outcome exactly when it has a
  check (`content_dusk_test.exs`); `time_window` needs `schedule@1` and a non-empty window
  (`EMPTY_TIME_WINDOW`); a schedule needs `behavior@1` and a calendar `calendar@1`;
- `calendar` may author a nonnegative multi-day `start`, positive `units_per_hour` and
  `hours_per_day`, a positive `subdivisions_per_hour` dividing the hour, and ordered solar
  and lunar cuts. The compiler and loader check safe day arithmetic, cut order and bounds,
  schedule keys and time-window endpoints against the authored day. Solar and lunar phases
  are labels, not engine values; the current chapter authors the complete cycle;
- attributes (`attributes.json`, the artifact's `attributes`) need `attributes@1` in the lock, as
  do the policy leaves `stat_compare` and `resource_compare`, whose `attribute` or `resource`
  names an attribute or a pool of this cartridge (the compiler and the loader);
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
  locked with its key in reach (never inside an NPC). The loader rejects only keys that can never
  be reached (its own key inside a locked chest, circular keys); every other case is a runtime
  refusal (barrier@1, containment@1);
- under position@1 the position fact is the engine's: an authored fact named `position`
  (`facts.facts.position`) and a `fact.assign` of it in a recipe outcome, a reaction's `apply` or
  a dialogue choice are `RESERVED_FACT` (at the fact, `recipes/nap.outcomes.success.sequence[0].fact`);
  reading it is allowed;
- scenes: each `on.story_point` resolves and its `on.outcome` names one of that point's
  keys; every narrate text is catalogued (`UNRESOLVED_REFERENCE`, data.target the full
  story-point reference string, outcome key or text key). Steps must be narrate×n
  (n ≥ 1), await_ack, end: the first misplaced `.steps[i].type` is SCHEMA_VIOLATION
  with data.error `not_in_enum`; closed SceneStep schema rejects unknown step types
  as `unknown_variant` before this ordered check. No steps minimum count preempts it.
  Two scenes naming the same story-point/outcome are DUPLICATE_DEFINITION, data `{}`,
  at each colliding scene's `on` in the compiler (`scenes/<key>.on`), and at the first
  collision in DefinitionRefString order in the loader
  (`.cartridge.scenes["<id>@<ver>:scene/<key>"].on`). Under scene@1, an authored
  `scene_<key>` fact (`facts.facts.scene_<key>`) and each recipe, reaction or dialogue
  fact.assign of it are RESERVED_FACT at the same write-site paths as position;
  fact_compare and reaction on.fact reads remain legal. The loader rejects missing or
  noncanonical engine Scene FactSpecs as RESERVED_FACT at their fact map key;
- story points: each outcome's trigger names a dialogue and one of its choices, no two outcomes
  one site, in a dialogue that resolves a quest (`OUTCOME_MISMATCH`;
  `lib/loka/content/dialogues.ex:2`);
- chapters: a non-empty ordered list; chapter 0 has neither `story_point` nor `outcome`
  (`UNKNOWN_FIELD` at that member), and every later chapter has `story_point`
  (`SCHEMA_VIOLATION`, `data.error: missing_property`, at that member); each title has a
  catalog entry, each story point resolves and each selected outcome names one of its keys
  (`UNRESOLVED_REFERENCE`, `data.target` the text key, full reference string or outcome key).
  A counted trigger whose dialogue's quest and choice id are also named by another dialogue
  is ambiguous (`OUTCOME_MISMATCH`, data `{}`, at `cartridge.chapters[i].story_point` in the
  compiler, `.cartridge.chapters[i].story_point` at the loader's reference stage). Only the
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
API1.10 also permits receive without a resolving quest; earlier APIs require that quest.
Optional item `give_allowed: false` also requires API1.10; absence preserves ordinary Give. Dialogue `fact.adjust` must name a bounded integer fact, never
a reserved engine fact. Both validators enforce references, types and ownership; source short
fact references expand for this new spelling. The original M20-B reward/storage release declared API1.7; current bundled content follows the [chapter pin](#current-bundled-chapter).
there is no per-feature minimum-version detector for legacy quest-resolving receive, fact.adjust or Put under the
[pre-production policy](../decisions/owner-decision-forward-development-2026-10-05.md). Generic manifest range/schema validation remains. An unknown dialogue sequence operation
now reports `unknown_variant` (the fact.assign/fact.adjust discriminator), rather than the old
single-operation `const_mismatch`; valid legacy dialogue and hand_over semantics are unchanged.

## Artifact and loader

`loadCartridge(bytes, installed)` (`kernel/ts/src/content/cartridge.ts:48`) returns the decoded
cartridge and its hash, or the first diagnostic of the first failing stage (`:63`): size
(`ARTIFACT_TOO_LARGE`), JSON (`INVALID_JSON`), format (`UNKNOWN_FORMAT`: v1 or v2), the
`CartridgeArtifact` schema (`SCHEMA_VIOLATION`, `UNKNOWN_FIELD`), `CONTENT_HASH_MISMATCH`,
map keys against manifest and definition (`ARTIFACT_DEFINITION_KEY_MISMATCH`, `:135`), the
lock (`:196`: `LOCK_MANIFEST_MISMATCH`, `UNKNOWN_COMMAND`, `UNDECLARED_CAPABILITY`),
references (`kernel/ts/src/content/cartridge_refs.ts:167` and the `cartridge_*.ts` twins of the
compiler's checks), and the installed kernel (`content/cartridge_installed.ts:24`: `CAPABILITY_NOT_INSTALLED`,
`FACT_SCOPE_UNSUPPORTED` (a fact has exactly one scope, `player` or `instance`),
`KERNEL_API_UNSUPPORTED`, `PINNED_VERSION_UNSUPPORTED`, `CLIENT_FEATURE_UNSUPPORTED`).
The reference stage rejects a fact default outside its declared enum values or integer bounds
as `FACT_DEFAULT_INVALID` at `.cartridge.facts[<ref>].value_type.default`, in v1 and v2.
An item's `barrier` is a reference to a barrier (barrier@1 owns the kind; a short key compiles
to its full ref) and is checked as above in both the compiler and the loader. An item's `slot` is a definition part owned by `equipment` (`UNDECLARED_CAPABILITY` when the
lock lacks it), in both the compiler and the loader. Under position@1 the loader, at the
reference stage, rejects the same writes and a position FactSpec missing or other than the
engine's (`RESERVED_FACT`, at `.cartridge.facts["<id>@<version>:fact/position"]`;
`kernel/ts/src/content/cartridge_position.ts`). Compiled artifacts load in TypeScript with identical bytes, hash and lock
(`test/loka/cartridge_cross_kernel_test.exs:169`); the loader corpus is
`protocol/fixtures/cartridge_loader.json`.

A compiled cartridge is a CompiledCartridge ([contracts](../contracts.gen.md#cartridge-artifact-contracts-protocolcartridgeschemajson)):
the manifest, lock and definition maps keyed by DefinitionRefString
(`<id>@<version>:<kind>/<key>`; `content/cartridge.ts:110`).

## Installed capabilities

`INSTALLED` in `kernel/ts/src/runtime/world.ts` declares the current kernel API,
content schema, rule IR and installed capabilities. The [current bundled chapter](#current-bundled-chapter)
records the release/API pin; the generated [feature map](../features.gen.md) records each
capability's implemented subset and locations. `bin/features.exs --check` fails when a rule
module exists without its row. A cartridge locking an uninstalled capability fails
`CAPABILITY_NOT_INSTALLED`.

## Text

`Text` is `{key, bindings}`; a committed narration line may carry `participants`, each name
bound to an EntityId at commit (`kernel/ts/src/mechanics/action_recipe/rule.ts:89`), so redisplay and
replay never resolve a name again. Catalog strings carry the touch links above; the phone's
model strips them to prose until details are tappable (`mobile/app/book/model.ts:25`).

## Development cartridges

`cartridges/ashmere_scene` exercises [modal scenes](mechanics.md#scene1-mechanicsscenerulets):
three narrate lines start on `lantern_resolved/carry`; a fact_changed reaction hears
that the scene ended. Its source uses short story-point and fact references, and has
an independent known answer; existing cartridges remain unchanged.

`cartridges/ashmere_chapters` exercises [Chapters](mechanics.md#chapters-kerneltssrcviewviewts):
opening Landing, Dusk after either lantern story-point outcome, and Reeds after `carry`,
whose trigger choice is `take_it` (the other choice is `leave_it`). This independent source
has its own identity and frozen known answer; all preexisting cartridges remain unchanged.

`cartridges/ashmere_journal` exercises [quest journal selection](mechanics.md#quest1-mechanicsquestrulets-kerneltssrcmechanicsquestlifecyclets):
the Lantern's current possession changes its active text, while the oar's post-activation
acquisition keeps its earned text after drop; terminal states select an outcome text or their
stage's fallback. These are historical development proofs, not a retained-release or save
migration requirement. Current bundled content and forward-development policy are in the
[current chapter](#current-bundled-chapter) and [owner decision](../decisions/owner-decision-forward-development-2026-10-05.md); preserve saved bytes and exact mismatch refusal.

`cartridges/ashmere_{hello,rooms,details,facts,items,bell,dusk,road,gate,errand,ferry,green}`
each exercise one slice; most carry replayable transcripts
(`cartridges/<name>/transcripts/<capability>.jsonl`, replayed by
`kernel/ts/test/transcripts.test.ts`). `cartridges/lantern_proof` is the R6P proof, "The
Ferryman's Lantern": four rooms, Bram, one lantern, one quest with a `current_state`
objective and no offer, two dialogues of Bram's: `bram_offer` while the player has no instance of
the quest (one choice, `accept`, which accepts it) and `bram` while it is active (two choices,
`carry`, `leave` with a hand-over), the fact `search_plan`, a story point with one outcome per choice, start 06:00
(`cartridges/lantern_proof/*`; its stats and gate: [owner rules](owner-rules.md#product-and-scope)). Its known answer remains historical proof; the app bundles the
[current Missing Child chapter](#current-bundled-chapter).

### R9C synthetic interaction cartridge (E2)

`cartridges/r9c_interactions` is `r9c_interactions@0.0.1`, **R9C interactions (synthetic)**,
API1.37: the permanent, unpolished interaction corpus of the
[E2 brief](../briefs/chapter-one/chapter-one-e2-r9c-interactions-brief-2026-10-05.md).
It is not bundled, has its own identity and save, and does not inherit the chapter's hash
or acceptance. Its content hash is `7d74fac7f9429475bdd7481fe7bf6b851acae2d0d6eaf1661892705391d17263`,
with 26 rooms and 127 initial IDs; the [artifact oracle](../../protocol/fixtures/r9c_interactions_hash.json)
and [allocation oracle](../../protocol/fixtures/r9c_interactions_ids.json) come from
`test/loka/cartridge_r9c_interactions_hash.py`. The fixture names stay outside the
simulator's default `cartridge_*hash.json` corpus.

The source is the v042 chapter's own definitions, short references and keys, cut to one
shared topology: Ferry Landing, Well Lane, Village Green, North and East Gate, Watch Post,
Chapel Steps and Nave, Bell Tower, Belfry, Drowned Lantern, Inn Rooms, Chandler, Well Shaft and
Bottom, Boathouse, Fen Isle Landing, Reed Path, Reed Bank, Willow Shade, Drowned Oak, Oak
Branches, Mire Crossing, Fox Hollow, Hound Run and Adder Nest. Reciprocal exits to removed
rooms are dropped; the Pool route, rats, the inn rumor board, Maud's cellar quest, Chandler's debt, the wisp, topics,
D9 village replies and scheduled villagers are absent, so `check@1` and `topics@1` are not
locked. Sedge stands at Fen Isle Landing (the only recovery room), Wick in Chapel Nave, and the
three apples on the Green. Two numbers deliberately differ from the chapter: the outbound
ferry fare is 5 pennies and Maud's room costs 4.

| Family | Entities |
|---|---|
| Identity, custody, trade | apples and fenwort (matching nouns), Peg's shop, satchel and haggle lesson, Vesper's message, Chapel door with Knock and Aldric, readable details, `where` |
| Terminal fork | Q2 stays/rescued (Vesper, Wren, Elspeth), Q3 prior/fox (Aldric, belfry bell), bell scenes and reactions, five Green epilogues, `prologue_completed` |
| Rest, dream, liquid, light | Maud's room, meal and ale, Inn Rooms bed and dream, waterskins and well, torch and lamp oil, dark well rooms |
| Hound, bleed, escort, expedition | `fen_hounds`, `bleeding`, Wick's lesson and bandages, Wren's escort, Night in the Marsh from Hound Run |
| Patrol and deer | Tobin's `watch_rounds`, `oak_deer`, `willow_deer` |
| Crow provenance | four crow plans, `old_coin` at Well Bottom, the Oak Branches nest |
| Skill, water, terminal consumption | Sedge's swim and herbalism, the well water route, both ferry routes, careful Harvest at Willow Shade, Wick's exchange, apples |

A later mechanic change that breaks these answers updates them in the same slice
(owner approval 2026-10-07, paraphrased).

## M1-A elapsed policy

Optional manifest `time_policy {profile: "real_elapsed", rate}` declares logical seconds per real second; rate is an integer in `1..9007199254740991`. Absence retains frozen legacy play_time. Opt-in requires `schedule@1` and `requires.kernel_api.at_least >= 1.1` (`KERNEL_API_RANGE_INVALID` at that lower bound otherwise). The installed API follows the [current bundled chapter](#current-bundled-chapter); current requirement ranges are validated; obsolete development fixtures follow the [forward-development policy](../decisions/owner-decision-forward-development-2026-10-05.md).

Compiler and loader reject actions naming authority-only `elapsed` or `run_job` (`UNKNOWN_COMMAND`), and actions naming Wait when the policy opts into elapsed (`UNKNOWN_COMMAND`); custom action keys cannot alias around this. Elapsed recipes with duration are `INVALID_TIME_POLICY` at the recipe's duration; elapsed rate/profile fields are schema checked. Duration omission is zero, while legacy duration semantics are unchanged. The policy itself requires schedule (`UNDECLARED_CAPABILITY`). This additive optional manifest field keeps artifact tags and old canonical bytes. See [contract decision](../decisions/pm-decision-m1-a-elapsed-contract-2026-10-04.md).

## Corpse templates and shrine settings (M5-B)

`world.death` requires `death@1`, `containment@1`, `position@1`, and kernel API at least
1.5. It names `player_corpse` and `npc_corpse` item templates, the existing `shrine` room,
and `restore {hp, mv}` values within the corresponding declared pools. References accept
source short keys. A corpse template has `location: {in: "template"}` and ordinary item
text/mass and `container: true`; it has no capacity, slot or barrier. Templates are never minted or placed at
birth, cannot hold authored children, and must be the configured corpse templates.
Both compiler and loader validate these constraints and reference kinds.

The sampler's 0.0.8 release binds chapel_nave, HP10/MV100 and two corpse templates.
This is a foundation release: the first live lethal producer remains M6. Older kernels
refuse API1.5 content; older bundled release lists refuse its unknown content pin.

## First encounter authoring (M6-A)

`world.combat` requires combat@1, schedule@1, death@1, valid `world.death`
corpse/shrine settings and kernel API1.6. It owns
`player_attack {chance, damage_min, damage_max}`, positive `interval`,
`sleep_multiplier` and `flee_multiplier`, and `narration` text keys for player_hit,
player_miss, npc_hit, npc_miss, player_died and npc_died. All six resolve in the
cartridge catalog. An NPC's optional `attack` profile explicitly
makes it attackable and supplies its own chance/damage bounds; it requires explicit HP.
Chances are integers 0..100, damage bounds positive and ordered, multipliers positive.
Room `sanctuary: true` forbids admission. All new objects reject unknown fields.

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
The historical0.0.8 fixture retains its original answer; the
[current bundled chapter](#current-bundled-chapter) has its own independent oracle.

## Maud’s Cellar content (M20-B2)

The bundled sampler consumes the [atomic reward and storage
mechanics](mechanics.md#dialogue1-mechanicsdialoguerulets-kerneltssrcmechanicsdialoguesharedts)
under kernel API1.7. Widow Maud is a passive innkeeper in `drowned_lantern`. Her offer
accepts `mauds_cellar` only before any instance exists and gives no item. The quest has
no standalone offer; its current-state objective requires all five separate player
facts `rat_1_killed` through `rat_5_killed`. Eligible lethal combat before acceptance
counts through the existing [death-credit producer](#first-encounter-authoring-m6-a).
Its journal supplies active, objectives-met and terminal fallback texts.

Maud’s bound turn-in resolves the quest and pending choice while transferring the
original `cellar_key` entity from Maud to the player, adding5 to player-scoped
`maud_trust` (default0, bounded−100..100), and assigning instance-scoped
`inn_cellar_cleared` true (defaultfalse). The key weighs100g. These changes commit
atomically through ordinary dialogue, fact and containment mechanics; acceptance and
completion never mint a replacement key. In-game text follows the [delegated copy
rule](owner-rules.md#product-and-scope).

The separate `storage_chest` starts empty in `inn_rooms`, weighs8000g, and holds12
immediate items. Its `storage_chest_lid` starts locked and names `cellar_key`; reward
does not unlock it. Ordinary Unlock, Open, Put, Close and Take govern storage, capacity
and carrying admission. The attic trunk still uses the brass key and contains the
whistle. Cellar access and corpse recovery stay free of key requirements. There is no
money, free room, loot, respawn or new failure/abandon transition.

The independent sampler answer and actual App bundle pin this release. The0.0.10
known answer is retained as history, not added to the bundled release list: an unmatched
pin follows the established [missing-pin refusal](save.md#opening-a-story). Pre-production
releases have no compatibility adapter or migration. Native evidence must identify the
exact release; older fight captures do not prove this reward/storage consumer.
The [M20-B2 evidence](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-05-m20-b2-mauds-cellar/README.md) records the
0.0.10 Release quest/storage walk, independent pin and behavior red controls.

## Q2-C stays return

[The adopted return plan](../decisions/pm-decision-q2-c-stays-2026-10-05.md) completes
the message path; [rescue below](#q2-c-rescue-return) adds its complete alternative. After the accepted
riddle, active Q2 offers carrying Vesper's original message to Elspeth while Wren
stays. The message starts directly with Vesper; it cannot be Taken or Read there.
The branch choice binds living, co-located Vesper/Wren and the original item, requires
player fact `fen.return_branch=unselected` and instance `village.child_status=missing`,
and atomically receives that same item and assigns branch `stays`. Capacity refusal
leaves custody, branch and pending continuation unchanged. Q2 stays active.

The bounded player branch has values unselected/stays/rescue, default unselected. The instance
status has missing/rescued/stays/lost, default missing. Only the Elspeth turn-in writes
status in this release. The message's authored `give_allowed: false` prevents ordinary
Give of it or a container holding it; ordinary Drop/Take, legal Put/Take and corpse
recovery retain the original identity.

The ordered Elspeth turn-in requires active actor-owned Q2, branch stays, status missing,
the original message directly in the actor body and the bound living Elspeth present.
Acceptance hands that item to Elspeth, resolves Q2 outcome stays and assigns status stays
in one proposal. Arrival, nested custody and historical possession never resolve Q2.
The retained branch row binds the original item and participants; terminal binding must
agree with it. Active journal text requests delivery or recovery without claiming direct
custody; the resolved text says Wren stays and his mother received the message. Elspeth's
response and Village Green's description derive from committed status. Lost and dawn
scenes remain deferred. Q1, Maud S1 and the
reciprocal all-hours fen route remain usable.

## Q2-C rescue return

[Rescue adoption](../decisions/pm-decision-q2-c-rescue-2026-10-05.md) adds the complete
alternative to the stays path. After active Q2 and the accepted riddle, Wren's ordered
conversation offers escorting the original Wren to Elspeth. It binds Wren and Vesper,
requires unselected branch/missing status, and atomically assigns player branch rescue
and starts the typed escort. It binds no message item; that original item stays with
Vesper throughout rescue. A stale stays choice cannot overwrite the selected branch.
The player-scoped branch enum becomes unselected/stays/rescue.

Wren follows accepted Move and Flee on the real reciprocal all-hours route. Player death
leaves Wren in the death room and separates the escort; ordinary travel back and an
explicit co-located Wren Rejoin conversation resume the same relation. Return alone
does not resume it. The rescued Elspeth turn-in requires active Q2, rescue branch, missing
status and original living Wren following beside living Elspeth and player. It completes
the relation, resolves Q2 as rescued and assigns status rescued in one proposal. Wren
remains physically beside Elspeth after later player movement. Arrival alone cannot finish.
The journal distinguishes following/separated/completed; Green and Elspeth read committed
rescued/stays truth. Both terminal guides retain directions; Q1 and Maud remain independent.
Bell-first loss and the prior allegiance are specified by the Q3 adoption below.

## Q3-B bell-first prior and lost

[Q3-B adoption](../decisions/pm-decision-q3-bell-prior-lost-2026-10-05.md) adds public
Aldric and the all-hours Chapel Nave → Bell Tower → Belfry path. Aldric offers the
actor-owned bell quest after active Q2 with studied tracks, or either completed Q2
return. Only Ring on the Belfry bell detail with active Q3 and an eligible Q2 writes
the bell and prior allegiance. Its fact-change reaction resolves Q3/prior; another
guarded reaction fails still-active Q2/lost and writes instance child status lost only
when the accepted Wren meeting is absent. Ring after that meeting preserves active Q2
and either return. Rescued and stays remain terminal. The Q3 resolution starts one
three-line bell scene; Ring emits no story point. Lost has honest journal, Elspeth and
Green text. The fox choice is specified separately below; no finale is present yet.

## Q3-F fox and silent bell

[Q3-F adoption](../decisions/pm-decision-q3-fox-silence-2026-10-05.md) governs
the bundled chapter. It adds **Leave the
bell silent** on the same Belfry bell detail. It is offered only to the actor with
active Q3, resolved Q2/rescued or Q2/stays, an unrung bell and unknown allegiance.
The recipe rechecks those conditions when performed. It assigns only the player-scope
allegiance from unknown to fox; it does not ring the bell, change Q2 or write a
story point. Q3's current-state objective accepts prior or fox, while the existing
Ring and the new Silence recipes retain their distinct admission policies. A
fact-change reaction on the fox allegiance resolves Q3/fox once; the resolved
quest event starts one two-line `bell_silenced` modal scene through scene@1.
The final Continue acknowledges and ends it. The scene carries Aldric's cold
response as narration; he remains present and the chapel route remains open.
The first accepted Q3 terminal choice closes both recipes. No lost/fox outcome,
later allegiance switch, dawn scene or export is part of Q3-F.

<a id="a3-green-finale-planned"></a>

## A3 Green finale

[A3 adoption](../decisions/pm-decision-a3-green-finale-2026-10-05.md) selects one
explicit **Begin epilogue** action at Village Green after actor-owned terminal Q2
rescued/stays/lost, terminal Q3 prior/fox, and the corresponding bell scene's final
acknowledgement. The five legal pairs are rescued/prior, rescued/fox, stays/prior,
stays/fox and lost/prior. The Q2 and Q3 receipt-backed terminals, bell fact and
allegiance must agree; lost/fox is refused. Eligibility is derived from those durable
rows and the unseen epilogue scene, without a separate armed flag. Arrival, already
being at Green, display, elapsed settlement and reopen never start it. Ordinary
movement and recovery remain available before Begin; no side quest is required.

The existing Green gains an inspectable, non-readable `market_cross` detail, already
described in its room text. Five exact pair-bound recipes target that detail. Under
the current recipe projection they appear as ordinary World actions while the actor
is at Green; no targetless recipe shape is added. The accepted Begin's
`action_completed` must name that detail as its subject before it can start only its
selected fixed, three-line modal scene. Begin writes no continuity export. The
selected scene identity freezes the pair. Its final shown-line acknowledgement ends
that scene and atomically assigns the following declared player memories and reaches
`prologue_completed` with the listed outcome. Defaults are `unreached`. The dotted
memory names express continuity semantics; the declared source fact keys are
`memory_village_ending`, `memory_fox_fate` and `memory_chapter_1_guild_tilt`.

| Q2 / Q3 | Bell rung | village ending | fox fate | guild tilt | completion outcome |
|---|---|---|---|---|---|
| rescued / prior | true | rescued | stilled | prior | rescued_prior |
| rescued / fox | false | rescued | free | fox | rescued_fox |
| stays / prior | true | stays | stilled | prior | stays_prior |
| stays / fox | false | stays | free | fox | stays_fox |
| lost / prior | true | lost | stilled | prior | lost_prior |

Guild tilt is a categorical continuity preference, not faction points or membership;
fox fate records the selected bell intent, not NPC removal. These memories are local
durable facts in A3; cross-cartridge or account transport awaits a consumer. The
compiler owns a reserved player fact marker for the story point's selected outcome.
Only the story-point reach writes it. Compiler and loader validate the exact scene-end
trigger, references, unique ownership, marker vocabulary and required API capability.
The chapter's source copy is delegated to the content author under the owner's copy
direction. This section adopts semantics and values, not final prose, IDs or hashes.

<a id="selected-s2-authoring-pending-implementation"></a>

## Selected S2 authoring

B2 authors Peg and her one ledger at the chandler, plus the storeroom,
while reusing the existing public Aldric in the Chapel Nave. Peg's offer has no hours
gate. Source declares S2's fixed absolute deadlines through the authored chapter
calendar, 10-penny payout, 20-penny player start, Aldric's explicit 10-penny funding,
the 0..1000 penny resource bound, and the typed fact bounds and outcomes. The
[selected mechanic](mechanics.md#s2-chandlers-debt-selected-contract)
owns timing, identity and atomic consequences. Compiler and loader must validate the
receive-plus-accept choice, bound original participants/item, absolute due time,
resource ownership and exact participating balances. Source may use a narrow typed
expiry declaration; it must not encode the job as a free-form Effect interpreter.
B2 is installed in the [current bundled chapter](#current-bundled-chapter).

## Peg's B3 shelf

The [selected shop mechanic](mechanics.md#pegs-immediate-shop-b3-selected-contract)
uses four separately authored, directly Peg-held items. Each item definition has one
fresh-world instance; these are the whole initial stock. B3 adds no issuance or restock.
The prices, masses and capacity below are chapter values, not engine defaults.

| Item | Buy | Sell | Shell mass | Current use |
|---|---:|---:|---:|---|
| torch | 3p | 1p | 100g | Wear/Remove in the light slot; B4 adds fuel and light. |
| lamp_oil | 2p | 1p | 200g | Held supply; B4 adds refill use. |
| waterskin | 4p | 2p | 500g | Held vessel; B7 adds liquid use. |
| satchel | 5p | 2p | 100g | Portable `container: true`, capacity four direct items. |

Peg starts with an explicit 20-penny balance under B2's 0..1000 chapter resource
bound. The player starts with B2's 20p and Aldric keeps his separate 10p funding.
Shop source declares the four exact eligible item references and both prices; their
fresh-world IDs are derived from the pinned release, not authored in source.
Compiler and loader reject duplicate offers, absent/non-Peg starting items, invalid
prices or missing participating balance declarations. The shop never treats Peg's
S2 ledger or an item later given to her as an offer. B4/B7 may add use metadata to
these definitions in their own releases without changing B3's item identities or
shop rules. The satchel has no lid and its contents count toward the ordinary load.

## C1 Tobin and equipment

**API1.18 source contract.** The [C1 mechanic](mechanics.md#c1-training-and-armed-defense-selected-contract)
adds `skills@1` and the existing `attributes@1` dependency. Skill definitions declare
their label and current VersionedPolicy qualification; the compiler creates their
unique reserved player acquisition facts. Swords and dodge are the only new skills.
The source `skills/<key>.json` supplies `label`, `requirement` and `qualification`;
its key comes from its file. The acquisition fact is the exact player Boolean
`skill_<key>`, default false, reserved to `skills@1`. No writable stat, progression
or skill-percentage field is introduced.

| Chapter parameter | Selected value |
|---|---|
| STR / DEX attribute starts | 10 / 10 |
| swords qualification | `stat_compare`: STR at least 10 |
| dodge qualification | `stat_compare`: DEX at least 10 |
| Each lesson payment | 2 pennies, actor → Tobin |
| Tobin penny start | 0, under the existing penny bounds |
| Lesson duration / cooldown | 0 / 0; ordinary authority elapsed settlement still runs |
| rusty_sword | 500g, `wield`, chance95, fixed damage3; initially Tobin-held |
| iron_sword | 600g, `wield`, chance95, fixed damage4; initially Peg-held, Buy8p/Sell4p |
| wooden_shield | 400g, `off_hand`, block chance25; initially Peg-held, Buy4p/Sell2p |
| Qualified dodge chance | 50 |

Place passive Tobin at reachable `north_gate`, with no attack profile or schedule.
An ordered swords dialogue receives the single rusty sword while teaching; a later
dodge dialogue teaches without item roles. A teacher dialogue's typed acquisition
step identifies the declared skill; its payment binds a live NPC role, penny
resource and positive amount. The original teacher and item identities are bound
by ordinary dialogue/receive, not minted on Choose. Learned-status policies use the
generated typed fact; user content cannot counterfeit an acquired grant.

The iron sword and shield extend [Peg's finite shelf](#pegs-b3-shelf) through its
existing Buy/Sell contract. Preserve the four B3 definitions and their within-save
identities; each new release independently derives its own fresh IDs. Gift swords
are not a shop offer. No renewal/replacement/restock is needed for these optional
consumers. Add item combat eligibility and the two defense narration keys to the
smallest current cartridge shape; chance bounds remain integers0..100 and weapon
damage positive/ordered. Compile and load reject undeclared skills, absent or
non-Boolean generated facts, unresolved qualification refs, wrong equipment slots,
invalid profiles/fees, missing teacher balance, collisions and unknown fields.

Production unarmed/rat profiles, combat interval, recovery, carrying ceiling and
main-story routes stay as currently authored. Training and shop equipment are
optional; every possession-recovery and required story route stays free of a skill,
weapon, shield, hour or next-day stock gate. C2 owns Tobin's reachable watch
post/patrol. C1 and its B4 consumer are installed in the
[current bundled chapter](#current-bundled-chapter).

## B5 herb and bandage stock

The [B5 mechanic](mechanics.md#s9-infirmary-herbs-b5-selected-contract) uses finite
existing authored item instances. Because the current compiler instantiates one
item per definition, declare twelve individually keyed fenwort definitions and
twelve individually keyed bandage definitions, with shared visible family names
and independent exact references. They are real items, not stacks or templates.
Fenwort starts directly in Willow Shade; bandages start directly with Wick.
The patch references only those twelve fenwort definitions; S9 references those
same eligible herbs and twelve reward definitions. Derived release IDs remain
unknown until the new cartridge is built.

| Chapter setting | Selected value |
|---|---:|
| Initial fenwort supply | 12 distinct items |
| Initial Wick reward supply | 12 distinct bandages |
| Herbs per turn-in | 3 |
| Bandages per turn-in | 3 |
| Fenwort mass | 20g each |
| Bandage mass | 10g each |
| S9 Priory increment | +1 |
| Cumulative S9 contribution cap | +3 |
| Initial player-scoped S9 contribution | 0 |

The patch and Wick have no hour gate, respawn, restock or cooldown. Four optional
exchanges are funded in a fresh chapter, and the fourth demonstrates the cap.
All item definitions retain ordinary custody, storage and death behavior. Wick
has no finite carrying/custody capacity that could reject the authored incoming
herbs. Public reciprocal Cloister/Infirmary routes cannot depend on private study
access, a bell choice, key or timed door. The patch is immediately reachable via
the existing Willow Shade route. C5 owns bandage use; D12 owns learned herbalism;
neither is advertised as a selectable unfinished action in B5.

Compiler and loader independently reject duplicate/overlapping eligible and
reward references, wrong kinds or starting holders, absent patch room/Wick,
nonpositive or unequal exchange quantities, insufficient initial stock, invalid
mass, missing bounded contribution declaration, increment outside its cap and
incompatible B2 faction bounds. The exchange quantities are equal for this
consumer, not a generic barter language. Definitions and all tuning belong to
this cartridge; no engine or Book fenwort count/faction literal is permitted.

## B4 well and fuel

B4 introduced `ashmere_missing_child@0.0.21`, API1.19:
[independent payload](../../protocol/fixtures/missing_child_v021_hash.json),
[94-ID answer](../../protocol/fixtures/missing_child_v021_ids.json),
[derivation](../../protocol/fixtures/generate_missing_child_v021.py).
B4 is reviewed; its successor pins are retained as frozen answers.

The [light mechanic](mechanics.md#b4-light-and-darkness-selected-contract)
adds `well_shaft`, reached by Well Lane down and returning up to Well Lane. Both
stairs are public at every hour. Its ordinary description exposes an authored
inspectable `masonry` detail; its separate dark description names only darkness
and the return stair, with no hidden-object links. The detail is optional flavor.
Other installed rooms retain their current visibility; sunlight phases do not
silently darken them. No lantern, cottage, water or enemy is added.

The chapter's source metadata declares the B3 torch as refillable oil wick:
capacity7200 fuel units, initial7200, burn1 fuel unit per logical clock unit,
compatible supply `lamp_oil`. The exact B3 oil bottle starts with7200 units,
capacity7200 and no burn. These give two game hours of torch light per full
charge under B1's3600 units/hour; they are tuning, never engine defaults.
The bottle persists at zero and retains its B3 sell eligibility and shell mass;
prices never depend on charge. Partial refill preserves excess in the same bottle.
The satchel still has no lid; nesting alone excludes its source from illumination.

Compiler and loader validate exact source/supply references, nonnegative safe
integer initial charge within positive bounded capacity, positive source burn rate,
matching fuel units and authored dark text on opted rooms. A supply cannot be lit
or illuminate. Missing fuel rows are not an implicit fresh charge. Metadata belongs
to the exact item definitions; fuel state belongs to their real instances, never to
the player, room or merchant. No generic stacking, destruction, stock or liquid API.

## B7 water and vessels

The [B7 mechanic](mechanics.md#b7-well-and-waterskin-selected-contract)
authors `water` in integer quarter-litre units: **250 grams/unit**, Drink **1 unit**.
Both waterskins have capacity **4 units**, shell mass **500 grams**, and initial
`null/0` contents. A full skin therefore weighs **1500 grams**, with no rounded
fractional quantity. Water has no declared resource benefit in B7.

Keep B3's original `waterskin` offer and add one separately authored
`spare_waterskin`, directly Peg-held, Buy **4p**, Sell **2p**, with the same vessel
metadata. Its distinct name/keywords and exact identity support Book target
selection; these are two finite real item offers, not a stack or restock mode.
This explicitly extends the four-item B3 shelf for B7's real Pour consumer.
All prior offers and starts stay governed by their existing declarations;
release-derived IDs must be re-pinned, not copied from another release.
Two skins cost **8p** from the authored **20p** player start, leaving **12p**;
with Peg's **20p** start her balance becomes **28p**. Filled skins may be sold
and bought back for the same authored prices with their contents intact.

Add one actual `well` detail to Well Lane, accessible at all hours with no
light, quest, bell, combat, tide or room descent requirement. It declares an
inexhaustible source of the `water` reference; only Fill may introduce its units.
The B4 well-shaft plan is independent; preserve its exits if already merged.
No new room or route is counted for B7. The well cannot be carried or targeted
as a Pour receiver, and cannot be drunk from directly in this slice.

Vessel metadata opts only authored initial item instances into B7. A template
cannot be a vessel: no liquid-row creation writer exists for newly instantiated
items. Ordinary non-vessel corpse templates remain unchanged.

Source/compiler/loader validate positive integer opted vessel capacity, exact
initial row, kind references, positive integer drink amount and grams/unit,
source kind/room binding and safe maximum effective mass. Short DefinitionRefs expand through
the existing compiler path. Reject initial contents over capacity, null with
positive quantity, unknown kind, unsafe density product and source declarations
on non-detail entities. Non-opted items and historical frozen artifacts retain
their existing representation; B4's fuel rows are not liquid vessels.
## C2 watch route and trust

[C2](mechanics.md#s3-finite-watch-patrol-c2-selected-contract)
adds four Ashmere rooms with reciprocal, all-hours exits: North Gate east ↔
Watch Post west; Watch Post east ↔ Watch Cell west; Watch Post up ↔ Gate Tower
down; Village Green east ↔ East Gate west. The cell is vacant with an open,
unlocked door: no missing-key producer. Gate Tower uses existing adjacent sight;
no far scan is promised. Watch Post's duty roster and East Gate's flooded-road
sign use installed readable details. The sign explains that the King's Road is
outside this chapter; no dangling exit or higher-chapter room is added.

Move the same original C1 Tobin spawn from North Gate to Watch Post, retaining
his pennies, lesson definitions and exact rusty sword identity. He is a passive
noncombatant with no attack profile, daily schedule or other location writer.
His C1 lessons remain available at his current reachable location, including
between patrol legs; after completion he stays at the terminal checkpoint.
No paid training, skill, trust, equipment, light or hour condition gates S3.

| Chapter parameter | Selected value |
|---|---|
| Cyclic route cursor0..5, initial0 | Watch Post → North Gate → Village Green → East Gate → Village Green → North Gate → Watch Post |
| Distinct checkpoints | North Gate, Village Green, East Gate, Watch Post |
| Required new checkpoint entries per attempt | 4; starting co-presence earns0 |
| Leader movement trigger | One explicit Continue rounds per edge |
| Patrol duration, deadline, cooldown | 0, none, 0; authority elapsed settlement still applies |
| S3 success outcome | `completed` |
| `watch.gate_trusts_player` | Reserved player Boolean, initially false, true only on S3 success |
| S3 other reward | None; C1 owns swords teaching and the rusty gift |

The closing Watch Post is cursor0 again, not a seventh route occurrence. Route
cursor denotes the leader's current occurrence, including the repeated Green/North
Gate positions. On Restart it is retained, not reconstructed
from room alone. Completing four unique post-start entries takes at most six edges
from any cursor; repeated connecting rooms count once. Open all North Gate–chapel
and village/fen/cellar/corpse routes at every hour, without a trust barrier. Watch
Post, Cell and Tower are safe, equipment-free optional destinations, with usable
return exits. No hound producer or survive timer is introduced.

Compiler/loader validate the bounded finite adjacent route, unique nonempty declared
checkpoint subset and achievable checkpoint count, original NPC/quest references,
shared location-writer exclusion, reserved trust ownership and complete room/link/
readable definitions. Reject malformed cursors, duplicate/unknown checkpoint credit,
wrong row identities and ordinary writes to reserved state.
The patrol Start choice owns activation and its final causal join owns resolution:
ordinary quest-linked dialogue and reaction activation/resolution/failure cannot
write a patrol quest independently of its row. World route/count values are
cartridge data, never presenter/engine chapter literals; existing safety budgets
bound all validation/traversal. C2 is installed in the
[current bundled chapter](#current-bundled-chapter); original selection and
proof remain in the [C2 brief](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/briefs/chapter-one/chapter-one-c2-watchmans-rounds-brief-2026-10-05.md).

## B6 marsh route and tuning

B6 is installed in the [current bundled chapter](#current-bundled-chapter).
Its original release derivation remains in the dated
[B6 evidence](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-05-b6-wisp/README.md).


The [S4 mechanic](mechanics.md#s4-all-hours-wisp-b6-selected-contract)
adds exactly three rooms. Mire Crossing east ↔ Marsh Light west is an all-hours
public path on existing firm footing; preserve the already always-passable mire
and all existing exits. Marsh Light south ↔ Old Causeway north and Old Causeway
east ↔ Tide Flats west are public reciprocal dry walking routes. Tide Flats is
its public edge, with no swimming, low-tide charm, fare or water hazard in B6.
C3 now installs the Hound Run connection; see the [current chapter](#current-bundled-chapter) and [C3 population declarations](#c3-hound-population-and-loot).
Return to Aldric through Mire Crossing → Reed Bank → Reed Path → Ferry Landing
→ Well Lane → Village Green → North Gate → Chapel Steps → Chapel Nave.
His B2 public Chapel Nave role stays reachable regardless of S2/Q3 outcomes.

Marsh Light opts into B4 darkness and authors ordinary/dark descriptions. Its
self-luminous Seek marker and discovered wisp have explicit visibility metadata;
other details have no exemption. Old Causeway's carved fox is flavor in B6 and
must not silently grant ward before the riddle;
[D2 held books](#d2-public-priory-and-book-authoring) own the later Ward grant.
[D5's stone](#d5-deep-fen-route-and-details) remains descriptive.
Bind one actual authored wisp, resident at every hour, not a timed population.

| Chapter setting | Selected value |
|---|---:|
| Immutable attribute key/start | `per` / 5 |
| Seek attribute difficulty | 5 |
| Seek duration, costs and cooldown | 0 / none / none |
| S4 answer / ordered bank | `tide` / `TIDE` |
| Wrong answers per sitting | 3 |
| Seek discovery fact | player Boolean `fen_wisp_discovered`, false |
| Answered fact | player Boolean `fen_wisp_answered`, false |
| Ward topic key / knowledge fact | `ward` / player Boolean `topic_ward_known`, false |

Add `attributes@1`, `check@1`, `topics@1` and the actual light dependency to the
chapter lock. The topic definition maps key, localized label and exact knowledge
fact; no separate membership row or nineteen-topic catalog. Source `topic.grant`
references that definition and lowers once through fact ownership. Chapter values
never become engine or presenter defaults. All current fresh characters pass;
D11 must preserve an immediate passing discovery path before changing attributes.

Compiler and loader independently reject unresolved/wrong-kind attribute/topic/
fact/role refs, non-Boolean or non-player topic facts, duplicate knowledge mappings,
invalid threshold integers, nonpositive or non-safe-integer wrong limits, malformed
bank or answer and an unresolved answer choice. Continuation/load validation rejects
missing opted attempt fields.
Short references expand in every new field. Existing bounded answer lengths apply;
new schemas need their actual negative fixtures and planted guard controls.

## C3 hound population and loot

The [population contract](mechanics.md#c3-bounded-living-hounds-selected-contract)
adds one instance-scoped `fen_hounds` plan and one fixed bundle. These are PM-selected
chapter values, not engine/presenter constants or claimed owner preferences.

| Parameter | Selected chapter value |
|---|---|
| Live cap / ordered slot count | 6 / 6 |
| Daytime / nighttime eligible slot targets | 4 / 6 |
| Night window | calendar hours [20,6), wrapping midnight |
| Replacement delay | one authored world day (currently 86400 units) after death |
| Wander interval | one authored world hour (currently 3600 units), aligned from time0 |
| Home / allowed area | Hound Run / Hound Run and Adder Nest only |
| Bundle | one hound and one pelt directly held by that new hound |
| Hound HP minimum / maximum / start / gain | 0 / 8 / 8 / 0 |
| Hound attack chance / fixed damage | 80 / 1 |
| Pelt mass / equipment / sale offer | 250g / none / none |
| Hound corpse | new room-fixed, public NPC corpse template, mass0, ordinary unbounded container |

Add Reed Bank east ↔ Hound Run west and Hound Run east ↔ Adder Nest west,
with gnawed-bones and empty-nest noun details. All exits are free of gates, light,
skill and hour requirements; Adder Nest contains no live adder or harvest node in
C3. No exit points at unbuilt Marsh Light. Other room connections stay deferred
to their owning slices. The existing Reed Bank–Mire–Fox Hollow main story route
remains usable at all hours without entering the population area.

Hound/pelt definitions are bundle templates, not additional authored birth spawns.
The plan binds its exact NPC, item and NPC corpse definitions, home and ordered
allowed rooms, eligible slot targets, time window and periods. Require resolved
correct-kind short references, distinct allowed rooms connected by legal reciprocal
edges, positive safe calendar products/periods, a night window that wraps midnight
(`night_end < night_start`), wander interval <= replacement delay, targets <= cap,
and the exact bounded bundle shape. Hound HP/attack obey existing profile validation; pelt has ordinary
item metadata and no lid, slot, children or capacity; corpse obeys M5 room-container
validation. Unknown fields and malformed origin/job/state declarations refuse at
compile/load; inspect actual slot bounds before traversal or allocation.

No B3 Sell extension is needed to prove real loot: legal Take places the same pelt
in Carrying, and Drop/Put/death preserve it. Rat corpse selection and five finite
S1 credits retain their declared consumer. Additional installed consumers are
[C4 pack response/flight](#c4-pack-response-and-wounded-flight),
[D7 deer](#d7-deer-declarations), [D8 crows](#d8-crows-coin-and-reachable-nest-selected-contract)
and [D9 bell suppression](mechanics.md#d9-village-consequences-and-prior-study-access-selected-contract).
The [current bundled chapter](#current-bundled-chapter) owns release answers;
[C3's publication review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-c3-publication-status-review.md)
retains its original independent source/save proof.

## C4 pack response and wounded flight

[C4](mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract)
opts the existing C3 `fen_hounds` plan into same-plan, admission-time pack assistance
and strict below25% HP flight. These are cartridge declarations, not template-name
checks or engine/presenter world constants. Enemy flight has zero fare, chooses
the first canonical legal direction without RNG, and remains within Hound Run and
Adder Nest. Reuse C3's cap6, HP8 and attack profile; do not add spawns, population
jobs, slots, routes or loot. Exact same-generation slot `last_flight_at` belongs
to the [transition contract](protocol.md#c4-pack-encounter-and-flight-composition).

Compiler/loader validate the plan's pack/flight declarations and correct-kind
refs, integer percentage1..100 with positive HP maximum, declared zero animal
fare, bounded unique connected area and registered committed narration for helper
admission, enemy flight, primary change and final withdrawal. Unknown or malformed
fields refuse. Hounds cannot cross the existing west edge into Reed Bank when
fleeing: it is outside their declared area. No gate can be bypassed and no player
key is spent on an animal's behalf. With no legal area exit the selected hound
retains its ordinary attack opportunity; no retry loop is authored.

Deliberate Attack alone begins hostility, at every hour. The archived aggressive
night rule and provisional unsolicited night initiation are deferred explicitly.
Required Reed Bank/Mire/Fox Hollow routes and actual corpse recovery are safe even
inside the optional hound rooms unless the player elects another Attack. No corpse
immunity flag, temporary safe mode, extra return action or night wait is needed.
C1's taught rusty sword can kill HP8 through successful fixed3 hits (8→5→2→0),
without crossing the strict below25% live flight threshold; misses/defenses retain
their actual resolver semantics. No weapon/loot is required by the main story.
C4 is installed in the [current bundled chapter](#current-bundled-chapter).

## D1 ferry and Isle declarations

Add exactly six chapter rooms: Boathouse, Fen Isle Landing, Isle Hut, Hut Loft,
Herb Garden and Isle Shrine. Ferry Landing west/east connects to Boathouse;
Fen Isle Landing east/west connects to Isle Hut and south/north to Isle Shrine;
Isle Hut east/west connects to Herb Garden and up/down to Hut Loft. The
Boathouse–Fen Isle Landing crossing is declared only as the two boarding-detail
transport endpoints, never as a free compass exit. The Boathouse–Old Mill edge
is opened by [D3](#d3-western-ashmere-declarations). Isle Shrine is descriptive sanctuary/foreshadow;
`chapel_nave` remains the actual death shrine.

The cartridge declares an unattended rope ferry, outbound **2p**, return **0p**,
the exact destination and Mother Sedge as the conserved fare recipient. Sedge is
in Isle Hut at all hours and has an explicit bounded pennies balance to receive
payment. Source definitions own fares, room links, text and balances. D1 adds
`swim` to the C1 skill definitions with a vacuous `all: []` qualification
policy: D1 has no water action or new attribute to qualify. Sedge's direct
free dialogue choice uses `skill.acquire` and does not issue D6 water access
early. D1 defines no underwater admission. [D6's selected admission](mechanics.md#d6-water-depths-and-owned-corpse-recovery-selected-contract)
uses acquired swim plus current load/MV, without an attribute floor;
D6 is installed in the [current bundled chapter](#current-bundled-chapter). The optional
dark Hut Loft retains B4's
known-exit and owned-corpse recovery rules. Garden herbs do not imply D12
herbalism, and no Bram NPC, token, S27 gate or island quest is declared.

The narrow `transports/<key>.json` endpoint declares `room`, keyed `detail`,
`destination`, reciprocal `reverse` transport reference, `recipient`, `currency`,
integer `fare`, `recovery_rooms`, exact `action`, `label` and `narration`. Each
boarding detail declares `transport: {route, title}`. The outbound recovery room
list names the four isle rooms plus Fen Isle Landing; the free return declares
an empty list. These paired routes add no ordinary compass connection.

Compiler and loader reject a missing/nonreciprocal endpoint, unknown destination,
wrong fare/recipient reference, unbounded recipient balance, forged transport
action, or ordinary exit that bypasses the declared ferry. D1 is installed in the [current bundled chapter](#current-bundled-chapter).

## B8 Maud's service declarations

The [selected services](mechanics.md#b8-mauds-immediate-services-selected-contract)
add no rooms. The original Maud remains all-hours in `drowned_lantern`, declares
an explicit **10p** initial balance within the existing **0..1000** pennies
bounds, and offers the following finite chapter values. Values are source-owned,
never kernel/presenter defaults.

| Service | Price | Immediate benefit | Finite source |
|---|---:|---|---|
| Room | 3p | actor `lantern_bed_paid=true`; paid bed detail/Rest at Inn Rooms | once per actor/save lineage |
| Bread meal | 2p | up to +12 MV, capped at current authored maximum | Maud `lantern_meals`, 0..4, start4, gain0; debit1 |
| Ale serving | 1p | up to +4 MV, capped at current authored maximum | exact Maud-held `lantern_ale_cask`; debit1 liquid unit |

Declare `lantern_bed_paid` Boolean/player/default false. Add one actual `bed`
detail at `inn_rooms` with free/paid description variants and a paid ordinary
Rest action. S10 facts/quest/dream remain B9 work. The meal stock is an ordinary
bounded ResourceSpec initialized only for Maud, not a second inventory count.
Add one real provider-held ale vessel with capacity4, initial ale4 and shell
mass500g; declare liquid kind `ale` with drink_amount1 and density250g/unit
(the B7 quarter-litre unit). The serving amount is liquid-kind metadata, as in
the installed B7 contract, not a vessel field.
Empty shell persists as null/0; no Fill source for ale is authored. The cask is
Maud's stock, not a shop offer or actor-issued mug. It stays Maud-held in this
slice. No dead Maud stock resurrection/refill occurs.

Declare the three finite offers as `services/<key>.json` definitions, referenced
by Maud; the typed immediate benefit alternatives are entitlement, meal-stock
recovery and provider-vessel recovery. No free-form operations list is authored.
Compiler and loader check typed service keys/labels/narration, original provider
binding, positive integer quote/benefit/stock debit, resource declarations and
bounds, Boolean fact scope, exact directly provider-held opted ale vessel/kind,
compatible complete serving and short-reference expansion. Reject duplicate
service keys, absent balances, regenerating stock/currency, mismatched stock
owner, non-MV recovery declarations and unbounded/unknown consequences. The
minimal service subset covers only these consumed consequences, not an arbitrary
Effect interpreter. Independently re-pin the integrated bundled release/API and
known answers after the shared-source scheduling predecessors integrate.

B8 is installed in the [current bundled chapter](#current-bundled-chapter);
its source and real SQLite acceptance are recorded in the
[B8 evidence](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-05-b8-maud-services/README.md).

## D2 public Priory and book authoring

[D2](mechanics.md#d2-held-books-and-public-priory-selected-contract) adds
`prior_study`, `spire`, `scriptorium`, `kitchen_garden` to the six existing public
rooms. Every row below is reciprocal and ungated; preserve existing exits.

| Room / outward direction | Neighbor / return direction | Delivery |
|---|---|---|
| North Gate / north | Chapel Steps / south | existing public approach |
| Chapel Steps / north | Chapel Nave / south | existing |
| Chapel Nave / up | Bell Tower / down | A1 |
| Bell Tower / up | Belfry / down | A1 |
| Chapel Nave / north | Cloister / south | B5 |
| Cloister / east | Infirmary / west | B5 |
| Chapel Nave / west | Prior Study / east | D2 |
| Belfry / up | Spire / down | D2 |
| Cloister / west | Scriptorium / east | D2 |
| Scriptorium / west | Kitchen Garden / east | D2 |

Spire's view and Kitchen Garden's herbs are descriptive; no far Scan, rue harvest,
new quest or unfinished action is advertised. Study has no functional quest ledger
or bell key. This implements archived 00a §§2/4/5/8 with current public/no-wait rules.
The selected book instances start directly in Scriptorium with ordinary custody.

| Book key | Title / single page | Declared topic / Boolean fact | Mass |
|---|---|---|---:|
| `ward_of_the_fen` | The Ward of the Fen / `readable.ward_of_the_fen` | `ward` / B6 `topic_ward_known` | 100g |
| `bell_rites` | Bell Rites / `readable.bell_rites` | `bell` / `topic_bell_known`, initially false | 100g |

Both facts are player-scoped; reuse B6's ward definition rather than duplicate its
knowledge mapping. Author localized topic labels and book noun headings. Item
readable metadata references catalog label/text and an optional topic DefinitionRef;
compiler short-ref expansion and loader require a local declared topic mapped to a
unique player Boolean. Reject unresolved/wrong-kind refs, non-Boolean or non-player
facts, duplicate mappings, missing text/label, malformed metadata and missing opted-in
mass. Update actual API/capability requirements with the consumed extension; do not
invent successor version, hash or allocation answers in this plan.

Ash and Hale are distinct original NPCs with distinct descriptions, noun headings,
flavor Talk and shared `novice` keyword. Under [owner content decision 5](../decisions/owner-decision-chapter-one-content-2026-10-02.md), Ash is in
Scriptorium 06:00–12:00 and 20:00–06:00, Cloister 12:00–20:00; Hale is in Kitchen
Garden 06:00–18:00, Cloister 18:00–06:00. Intervals are start-inclusive/end-exclusive.
At 19:00 both are in Cloister; neither waits for a player or grants topics. All
scheduled destinations exist. Initial placement must agree with the selected launch
clock; existing schedule machinery owns departures and saved locations.

## B9 Lantern dream declarations

The [S10 contract](mechanics.md#s10-lantern-rest-and-dream-b9-selected-contract)
adds no rooms, payment or entitlement writer. Reuse the actual B8 `bed` detail
at `inn_rooms` and declared `lantern_bed_paid`. Declare player Boolean
`slept_at_lantern` and `dream_seen`, both default false; the latter is the local
continuity memory `player.dream_seen`. Define quest `a_room_at_the_lantern` with
no manual offer, no repeat/failure reward, objective `dream_seen=true`, and honest
active/resolved journal text. It is optional for the Green ending, while E3's ten
playable quests must still exercise it.

Declare one exact room/entitlement/first-Rest/S10 binding and scene
`dream_of_the_fen`, `presentation_only`, anchored at `inn_rooms`. Source-owned
beats are: 1 opening, 2 fen, 3 fox; after Continue at3, a choice at4 offers exactly
`follow_fox` and `wake`; the selected branch shows its authored final line at5;
Continue at5 acknowledges/end. Both branches assign the same `dream_seen=true`
and resolve S10 as `acknowledged`. Three opening lines, two choices and two final
texts are content values; final prose is delegated, not an engine constant.
Choice resolution must retain its branch after end in its existing durable row.
No reward, additional story point, chapter index advance or ambient sound system
is implied. Resume is a local route over the exact scene checkpoint at the bed;
no new gameplay Start/Resume command is added.

Compiler and loader validate this consumed source subset in both languages:
full/short references, exact anchor/detail membership, Boolean player fact
scopes/defaults, unique trigger and consequence ownership, position/scene/quest
capability dependencies, bounded reachable beat graph, exactly declared choices,
choice source/actor/anchor bindings and final-only memory/quest consequence.
A Rest trigger is identified by its room/detail pair, independently of entitlement,
credit, memory or quest references; different room/detail pairs remain distinct.
Reject unknown targets/branches, repeated/unreachable consequence beats, modal
choice mixing, body/container operations and a dream end declaring a completion
report. Reserve engine cursor/choice ownership as for existing scenes; content
cannot assign their state. Extend A3's terminal consequence only enough to admit
memory assignment plus typed quest resolution without a story-point declaration.
B9 is installed in the [current bundled chapter](#current-bundled-chapter). Its
original predecessor and provisional answers remain dated
[source evidence](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-05-b9-lantern-dream/README.md).

## D4 homes and orchard declarations

**D4 source declarations.** [D4 mechanics](mechanics.md#d4-homes-finite-apples-and-eat-selected-contract)
uses these three public reciprocal additions from archived
[00a §§2/4/5/10/11](../archive/spec/00a-chapter-one-content.md):

| Existing/new room and exit | Reciprocal destination and exit |
|---|---|
| Village Green / west | Smithy / east |
| Smithy / west | Orchard / east |
| North Gate / west | Elspeth Cottage / east |

Forge/anvil/tools, apple trees/beehive and cot/hearth are inspectable details.
The forge is cold; no repair, honey, property, seasonal system or extra quest is
advertised. Cottage adds no lantern: B4's actual torch/oil source remains the
only adopted light supply. Elspeth's Q1/Q2 conversations stay at Ferry Landing.
Gareth follows smithy 08–18, Drowned Lantern 18–22, smithy 22–08; Ada follows
orchard 07–17 and cottage 17–07. At the current 64800 dusk start, initialize
Gareth at Drowned Lantern and Ada at the cottage, then use existing next-hour
schedule jobs. Neither actor controls orchard food or a required story action.

Author `apple_01`, `apple_02`, `apple_03` initially directly in orchard, each
**100g**, noncontainer, nonwearable and edible. These three apples are the only
opted food in this slice; B8 meals remain immediate services. The trees' Harvest label is
**Forage** and binds exactly these three IDs; it transfers one lowest eligible
EntityId as B5 does. Ordinary Take shares their supply. Each apple declares
`edible {resource: mv, amount: 6, label: action.eat,
narration: narration.eat_apple}`: one whole apple gives up to **6 MV** with no
partial fruit. Full MV refuses without consuming. No restock or promised future
nutrition model is required; the finite B8 meal remains a separate optional supply.

Compiler and loader require `food@1` plus API1.27 for edible fields,
local declared MV recovery-pool references, positive safe-integer amount and valid
catalog keys, and reject edible containers, equipment (slot, weapon or block metadata), fuel or liquid vessels.
Expand source short references at the real new field. Edibility belongs to an
immutable item definition; the terminal holder is generated metadata, never
cartridge-authored. The integrated v031/API1.27 answers are independently derived over
published C3/D1 in the [D4 integration evidence](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-06-d4-published-integration/README.md).

Cottage room/cot and Green use missing/rescued/stays/lost descriptions, preserving
Green's installed terminal variants. Missing means the search is unfinished;
rescued acknowledges return to Elspeth at the landing; stays acknowledges the
living child's choice with Vesper and delivered message; lost acknowledges grief.
Cot prose never asserts current bodily presence. Q2/A1 alone own outcome/location:
rescued Wren remains at Ferry Landing, stays Wren remains at Fox Hollow, and lost
neither deletes nor relocates the original Fox Hollow actor. Missing can include
following/separated escort intermediates anywhere on the route. Do not teleport
Wren on cottage arrival or turn an unfinished escort into a returned child.

## D5 Deep Fen route and details

The [D5 contract](mechanics.md#d5-dry-deep-fen-exploration-selected-contract)
selects these additions; preserve all installed Oak/Hollow/Mire/B6 exits.

| Room / outward direction | Neighbor / return direction |
|---|---|
| Drowned Oak / up | Oak Branches / down |
| Oak Branches / up | Oak Crown / down |
| Drowned Oak / south | Black Pool / north |
| Black Pool / east | Fox Hollow / west |
| Black Pool / south | Fishing Shallows / north |
| Fox Hollow / down | Fox Den Deep / up |

New keys are `oak_branches`, `oak_crown`, `black_pool`, `fox_den_deep`,
`fishing_shallows`. Pool and shallows mean the dry bank and reed edge; prose makes
that footing explicit. The shallow den admits natural light at all hours and has
no dark metadata. This deliberately supersedes archived 00a §§2/5/8/11 darkness,
Vesper relocation, duplicate readable message, stone topic, far Scan, crow nest
and next-day water-drift candidates for D5. Wren/Vesper retain their original
instances and installed locations except for existing legal Wren escort travel.

Author one `ward_stone` room detail with aliases `stone`, `ward`, `ward_stone`
(the existing target normalization resolves player words `ward stone` to that
last key), a noun title, description and ordinary readable label/text/title. Its fixed
inscription describes the worn carving without asserting who holds the message,
which return was selected or what Wren has done. Use the installed Fox Hollow
readable detail shape, not an item-readable/topic extension or conditional page.
Other landscape details are descriptive and advertise only projected actions.
Do not add a bottom exit, room placeholder, underwater loot, fishing operation,
crow container, new item, schedule or knowledge mapping. D6 owns bottom rooms,
D8 the real nest and item recovery. Preserve ordinary Drop custody at the actual
current location. D5 is installed in the [current bundled chapter](#current-bundled-chapter).

## D3 Western Ashmere declarations

Selected under the [approved D3 brief](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/briefs/chapter-one/d3-western-ashmere-brief-2026-10-05.md),
with archived [chapter map/cast](../archive/spec/00a-chapter-one-content.md) §§2/4/5/8/11
as the content basis. Boathouse south/north connects to Old Mill while retaining
its east Ferry Landing exit and outbound ferry detail. Old Mill south/north
connects to Empty Cottage, up/down to Mill Loft and down/up to Mill Cellar;
Empty Cottage up/down connects to Cottage Loft. No exit names an unbuilt place.

Mill Loft and Mill Cellar declare ordinary and dark descriptions and consume
[B4 perception and owned-corpse recovery](mechanics.md#b4-light-and-darkness-selected-contract).
Rat holes are descriptive: the five original Lantern Cellar rats remain the
only S1 rats. Owl, loose board and ghost traces are flavor/foreshadow, without
an enemy, hidden route or chapter-two quest. The cottage sign offers no property
purchase. The ledger and sign are standalone readable details with noun titles,
confirmed bodies and no topic, quest, fact, money or loot write.

Original Hob uses ordinary daily scheduling: Old Mill 06:00–18:00, Mill Loft
18:00–06:00. At the chapter's 64800 launch clock he starts in Mill Loft;
his first job is due at 108000, followed by 151200. Both destinations exist.
Flavor dialogue grants nothing and gates no required story action; darkness
and scheduled departure retain existing admission. Movement, readable details,
light perception and schedule jobs keep their existing state writers. No new
command, capability or save shape is selected.

The [final D3 integration proof](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-06-d3-final-integration/README.md)
records the independently pinned successor and checks; the
[provisional proof](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-06-d3-western-ashmere/README.md) is historical.

<a id="d6-bottom-rooms-and-water-tuning-selected-pending-implementation"></a>

## D6 bottom rooms and water tuning (selected contract)

Reciprocal exits:
`well_shaft` down ↔ `well_bottom` up and `black_pool` down ↔ `pool_bottom` up.
Only bottoms have water occupancy. Both are dark under B4 with known Up; ordinary
loot needs B4 light. Well Bottom owns one actual old coin and carved initials;
Pool Bottom owns one actual sunken chest containing one silver ring. No extra
sunken lantern, wet-fuel system, swim lesson, Wren route, fish or tide.

Selected world values: entry maximum 6000g, entry 10 MV, surface 0 MV and submersion
duration 6000 logical seconds, **120 real seconds** at current real-elapsed rate 50.
No periodic drain or regeneration override. The deadline is entry clock plus
duration; do not renew it through actions, movement refusal, posture or reopen.
D1's `swim` declaration remains vacuous `all: []`; no new attribute. The
[adopted item table](../decisions/pm-decision-d6-water-depths-2026-10-06.md#adopted-items-and-remaining-unknowns)
defines mass/capacity; chest capacity uses direct-item count, not grams, and
ordinary container eligibility preserves 100% descendant mass.

D6 is installed in the [current bundled chapter](#current-bundled-chapter). Chapel Nave
remains the death shrine; Isle Shrine is descriptive only.

## D11 ancestry declarations (selected contract)

Source `cartridge.json.ancestries` is a closed choice map with label, description, attribute/modifier and optional skill, faction and dark-sight effects. The compiler expands short refs and the loader validates them independently. The [D11 decision](../decisions/pm-decision-d11-character-choice-2026-10-06.md) retains installed `attributes.json` STR10, DEX10, PER5 and INT10 and adds CON10 and SPI10. These six values are authored content, not an engine default or Legend formula. Each declared ancestry adds exactly +1 to its named attribute, never to pool maxima, carry, old combat answers or other unselected checks. The selected chapter answers are:

| Ancestry | Selected attribute | Actual Chapter 1 effect |
|---|---|---|
| fen-born | PER6 | acquired Swim, `priory.fen_axis` −2 |
| road-born | DEX11 | acquired Haggle; Crown points deferred |
| hill-folk | CON11 | B4 dark-sight; mining deferred |
| fey-touched | SPI11 | `priory.fen_axis` −2; spell word deferred |

All other values retain their starts. The Priory/Fen axis starts at 0 for road-born and hill-folk; its selected −2 value is within the existing −10..10 bound and means Fen favor. Fen and fey share that numeric starting side but have different skill, sight and attribute outcomes. STR/DEX C1, INT/D12, DEX/D12 and PER/B6 consumers keep their authored thresholds; B6's PER5 difficulty remains immediately passable. D6 Swim has no CON floor. CON/SPI have no Chapter 1 stat-check consumer, so their selected values are truthful character data rather than a fabricated threshold. This preserves the [owner's fey content ruling](../decisions/owner-decision-chapter-one-content-2026-10-02.md).

The closed `ancestries` source declaration maps the four keys to these values/effects
with authored labels and descriptions. Compiler and loader reject missing/extra keys,
unknown attributes/skills/faction references, unsupported sight effects, unsafe or
out-of-range values, absent capabilities and effects that cannot apply atomically.
The [D11 command and changed row](mechanics.md#d11-character-choice-selected-contract)
consume this shape; the [current identity](#current-bundled-chapter) owns release answers.

<a id="d9-village-reaction-content-selected-pending-implementation"></a>

## D9 village reaction content (selected contract)

The five valid child/allegiance pairs and the Study rule are defined in
[mechanics](mechanics.md#d9-village-consequences-and-prior-study-access-selected-contract).
Author distinct child responses for Elspeth, five truthful Maud rumor
variants and Green descriptions, prior/fox Aldric and Vesper responses, and
bell-dependent Sedge flavor. Keep Aldric's S2 ledger service in the public Nave. Explicit labelled dialogue bindings keep the ledger handoff and Maud's cellar offer/turn-in independently selectable alongside terminal reaction profiles. Old Bram remains outside the real cast under the [D9 clarification](../decisions/pm-decision-d9-real-cast-2026-10-06.md).
The Study remains the existing reciprocal Nave-west/Study-east edge; no new
door/barrier definition or key is authored. Only its west ingress gets the
conditional fox policy. No new room, NPC, token relationship fact or synthetic
ferryman instance is needed.

The audible area is the existing **25 Ashmere rooms and ten public Priory
rooms**, excluding Fen and isle rooms. Bell Read, immediate narration and cast
responses must not claim audible sound in those excluded rooms. Author the area as explicit chapter
room references with loader validation; a room's ordinary descriptive tags do
not become sound authority. Flood variants affect Reed Path and Mire text only.
The bell's hound suppression duration is **172800 logical seconds**, owned by
the cartridge. Author its population-plan reference and resume bound against
the existing hound plan; no new population cap, catch-up count or creature is
declared. The cue source is a Boolean fact. A suppression declaration requires
API1.35, a Boolean fact-change source and a population plan with the installed pack behavior; compiler and
loader reject an unresolved or non-pack plan rather than admitting a runtime fault. The integrated D9 release follows published D8 v039/API1.34. Its independent
v040/API1.35 hash and209 allocation answers are retained with
[the integration proof](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-06-d9-integration/README.md).

## D12 practical skill declarations

The [D12 mechanic](mechanics.md#d12-practical-skill-consumers-selected-contract) retains the current chapter's immutable attribute starts and adds only `attributes.int.start: 10`. Define `skills/herbalism.json` and `skills/haggle.json` with C1's existing `label`, `requirement`, and VersionedPolicy `qualification`; compiler-generated acquired facts remain reserved to `skills@1`.

| Chapter parameter | Selected value |
|---|---|
| Herbalism qualification | `all`: INT `stat_compare` at least 10 and MV `resource_compare` at least 5 |
| Haggle qualification | `all`: DEX `stat_compare` at least 10 and MV `resource_compare` at least 5 |
| Each new lesson | 2 pennies, actor→original bound teacher; all-hours, no duration/cooldown |
| Herbalism teacher | Sedge in Isle Hut, existing declared penny start |
| Haggle teacher | Peg in Chandler, existing declared penny start |
| Careful yield | 2 existing eligible fenwort IDs from Willow Shade |
| Buy discount | numerator 9 / denominator 10, minimum 1 penny |

Add `dialogues/sedge_herbalism.json` and `dialogues/peg_haggle.json`, each binding the original teacher, with a direct `learn` choice, `skill.acquire`, and existing `lesson_payment`; the dialogue policy offers learning only while its reserved acquired fact is false, never based on qualification. No item gift or extra teacher registry is declared. Their text describes the actual fee/qualification/benefit without promising a ferry or story gate.

The optional closed `harvest.careful` object on Willow Shade's existing `fenwort_patch` is `{skill: "herbalism", count: 2, action: "gather_carefully", narration: "narration.gather_carefully"}` in source. `skill` expands to the declared skill DefinitionRef, `count` is the required eligible-item count, `action` is the declared action key, and `narration` is a TextKey. Retain the existing `harvest.items`, ordinary label/title/narration and all twelve authored herb definitions. Define `actions/gather_carefully.json` with `command: "harvest"`, `target: {kind: "entity", scopes: ["inspectable_details"]}`, `input: ["method"]`, priority 0, declared label/accessibility, and vacuous `all` action policy; the shared method-aware Harvest admission owns skill, patch, stock and carrying eligibility. No other patch opts in. The [wire contract](protocol.md#d12-harvest-method-and-buy-quote-composition) binds only literal `method: "careful"` to this declaration.

The optional closed NPC `shop.buy_discount` object is `{skill: "haggle", numerator: 9, denominator: 10, minimum: 1}` in Peg's existing shop. `skill` expands to the declared skill DefinitionRef; the other fields are positive ResourceInts. It applies to all that shop's declared Buy offers, and never Sell. Existing bases torch3/oil2/waterskin4/satchel5/sword8/shield4/spare-waterskin4 therefore quote2/1/3/4/7/3/3 when usable; unchanged Sell is1/1/2/2/4/2/2. Existing exact items, balances and currency bounds remain in their owning B3/C1/B7 declarations.

Compiler and loader reject unknown fields, unresolved skill/action/narration references, missing skills capability, a careful action with wrong command/target/input, integer count outside 2..number-of-distinct-eligible-items, or nonpositive/out-of-range discount values. Require numerator≤denominator, minimum≤every base Buy price, and safe exact integer multiplication for every authored base×numerator before division/floor; refuse unsafe tuning rather than round or overflow. The new declarations are typed content, not unrestricted price formulas or arbitrary method names. No absent field may silently enable a benefit. Preserve unknown-method refusal and the ordinary method-omitted path.

D12 is installed in the [current bundled chapter](#current-bundled-chapter). Its
[final primary review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-d12-final-primary-review.md) and
[save/protocol opinion](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-d12-final-save-review.md) record the
independent source, pin and recovery proof. Current-behavior conformance guards remain required; obsolete development fixtures follow the
[forward-development policy](../decisions/owner-decision-forward-development-2026-10-05.md). Explicit incompatible-pin refusal preserves saves without an
adapter, migration or deletion.

<a id="d7-deer-planning-declarations"></a>

## D7 deer declarations

The [D7 brief](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/briefs/chapter-one/d7-deer-brief-2026-10-05.md) replaces its provisional nine-room corridor with three one-slot instance plans. The archived three named rooms are the fresh origins; an adjacent refuge is required so each can visibly flee.

| Plan | Initial home | Two-room legal area | Cap/targets | Replacement | Wander | Sight delay |
|---|---|---|---|---|---|---|
| Willow deer | Willow Shade | Willow Shade, Drowned Oak | 1 / 1 day and night | 172800 | 3600 | 300 |
| Oak deer | Drowned Oak | Drowned Oak, Willow Shade | 1 / 1 day and night | 172800 | 3600 | 300 |
| Orchard deer | Orchard | Orchard, Smithy | 1 / 1 day and night | 172800 | 3600 | 300 |

The aggregate fresh and live cap is three. Each plan declares `night_start: 20` and `night_end: 6`, reusing the chapter hound window; equal day/night targets make that window neutral to deer count. Each bundle has one HP1 attackable deer with `attack {chance: 0, damage_min: 1, damage_max: 1}`, one directly held 100g hide and one public fixed-room corpse template. The zero chance satisfies the existing attack-profile schema and C1 strict roll `< chance`, so deer never land a retaliatory hit; the positive damage bounds satisfy schema but are unreachable. The player can still Attack the deer. Existing reciprocal ungated exits provide legal flight and wandering. Smithy is only a refuge, not an additional birth home. No deer can enter a hound area or cross the nine-room route through nonadjacent transfer.

Compiler and loader validate exact correct-kind home/area/bundle references, distinct reciprocal rooms, targets/cap, period bounds, sight delay and narration, plus the deer/hide spawned roles. Any new short reference is expanded by the compiler and rejected when malformed at load. D7 is installed in the [current bundled chapter](#current-bundled-chapter). No shop sale, recipe, eating or skinning behavior is inferred from the hide label.

## C5 bleed and bandage declarations

[C5 mechanics](mechanics.md#c5-hound-bleeding-and-bandage-selected-contract) opts the existing C3 hound attack into one effect definition, `bleeding`, on actual positive surviving player HP loss. The narrow authored fields are hound attack `on_positive_hit: {effect: "bleeding"}`, effect `{duration: 300, tick_every: 100, hp_loss: 1, narration: {applied, refreshed, tick, expired}}` with each narration value a required local TextKey, and each existing bandage item's `bandage: {effect: "bleeding", skill: "bandage", action: "bandage", narration: "narration.bandage"}`. An unrefreshed wound ticks at +100 and +200, then expires without damage at +300. These are content values; the engine encodes no default. This limited loss lets the player treat or Flee while reading time continues, without requiring a Wait.

Add `skills/bandage.json` under the existing C1 skill shape: current qualification is DEX at least **10**, independent of permanent acquisition. Original Wick in the public all-hours Infirmary teaches it through one bound `Talk/Choose` and `skill.acquire`, with **0** lesson payment, duration and cooldown. An already acquired lesson is unavailable and cannot charge/grant again. Keep his B5 herb exchange and other conversation available. The bandage item family is the exact twelve existing B5 identities, each opted into one `bandage` use with authored action label and narration. Do not create replacement stock or a Chancellor sale from the archive.

Compiler and loader validate the closed positive safe-integer duration, interval and loss, interval < duration, local HP pool, supported hound producer/effect reference, required skill/action/text references and bandage-only noncontainer/nonwearable/nonedible opt-in. The bandages' existing 10g mass, custody and supply remain B5's. The D4 consumed holder is reused; only the terminal admission expands to declared bandage items with the exact C5 result. Reject unknown fields, absent effect, invalid skill qualification or a nonhound producer. Source expands short refs at every new DefinitionRef. C5 is installed in the
[current bundled chapter](#current-bundled-chapter).

<a id="d10-map-positions-and-chapel-door-selected-pending-implementation"></a>

## D10 map positions and Chapel door (selected contract)

D10 is installed in the [current bundled chapter](#current-bundled-chapter).

The chapter declares one static position `{x, y, z}` for each current room.
These integer drawing coordinates are content, not an engine inference from compass
directions: the room graph contains ferry links and loops. Compilation and loading
require exact room-key coverage, unique `(x, y, z)` positions and declared room refs;
the rendered links still come only from real exits. Unknown map fields or duplicate
positions fail before play. No coordinate changes movement cost, sight or reachability.

The first chapter physical door is one barrier shared by Chapel Steps north and Chapel
Nave south, starting open with no key. It admits ordinary existing Open/Close behavior
and a declared Knock response on the Steps north face keyed to actual Aldric presence
in the Nave. The public
chapel remains reachable by opening a closed door. This differs from the archive's
keyed Watch Cell candidate: the current Watch Cell is expressly open and optional, so
D10 does not add Tobin-key or jail access machinery. The D9 Study restriction is an
exact-edge predicate, not a barrier or Knock target. Wren's one boot is an actual
recoverable Reed Bank item. Add ordinary `leather_boots` as a recoverable item in
Chandler, with no sale or armor modifier in this slice. Both carry the `boot` keyword
and can be held together for real resolver ambiguity; touch selects an exact item ID.
Neither replaces Q2 drawing or message credit.

## C6 S27 expedition declarations

S27 `a_night_in_the_marsh` starts by an explicit no-cost/no-duration action on Hound Run's existing gnawed-bones detail. Its bounded route is five ordered accepted player entries: Hound Run **west→Reed Bank**, Reed Bank **west→Willow Shade**, Willow Shade **south→Drowned Oak**, Drowned Oak **north→Willow Shade**, Willow Shade **east→Reed Bank**. Add one inspectable Drowned Oak shelter detail with optional Use shelter at cursor3, without Rest, healing or clock advance; the final Reed Bank is a safe return boundary. Ordinary reciprocal exits already exist. The allowed attempt footprint is Hound Run, Adder Nest, Reed Bank, Willow Shade and Drowned Oak; Adder Nest accommodates a legal C4 Flee/deviation but earns no route credit. Any accepted exit to a room outside this set before completion fails the attempt. Other travel inside the footprint leaves the cursor unchanged until the exact next edge is later taken.

The chapter names one original player-scoped quest and one original player Boolean `fen.night_survived`, initially false. Completion sets that fact true and applies **−1** to the existing bounded Priory/Fen axis at most once. It offers a Sedge acknowledgement of surviving the marsh; her D1 swim lesson remains free, independently accessible before S27 and idempotent if already acquired. No duplicate `skill.acquire`, second swim lesson, fee, item or attribute reward is granted by S27. Sedge's recognition is a fact-selected dialogue/text variant at her existing all-hours location, not a new NPC schedule or persistent behavior profile.

At Start, if any current C3 plan-owned live unengaged hound is co-present, select the lowest current EntityId and use C4's already declared roster/encounter/round rules. If none is eligible, Start succeeds without hostility. The route does not wait for replacement or require an attack win, bandage, light, ferry, swim, food, tide or night. The existing safe main-story corridor and every corpse path remain traversable when no S27 attempt is active. All counts, rooms, rewards and narration are authored here or in the quest/dialogue definitions; engine and presenter hold no S27 literals. Compiler and loader reject missing/wrong-kind room edges, unknown route refs, noncontiguous steps, unreachable finish, invalid footprint, unresolved quest/fact/faction/hound/Sedge refs or an attempted generic room-tag shortcut. Bound route length and footprint before traversal. C6 is installed in the [current bundled chapter](#current-bundled-chapter).

<a id="d8-crows-coin-and-reachable-nest-selected-planning-contract"></a>

## D8 crows, coin and reachable nest (selected contract)

D8 is installed in the [current bundled chapter](#current-bundled-chapter). The sole `old_coin` is a 10g room item at dark Well Bottom, with reciprocal Up to Well Shaft; Pool Bottom instead holds the chest/ring. D5's Oak Branches route and all seven reciprocal dry corridor legs remain installed. D8's allowlist names that exact item definition in the compiled chapter.

Declare four C3-style **cap-one two-room plans**: two with Green home and Well Lane as ordinary wander neighbor; one with Drowned Oak home and Willow Shade neighbor; one with Oak Branches home and Drowned Oak neighbor. Thus genesis has two Green, one Oak and one Branches crow. Each plan has day/night target one, no aggression window, **86400 logical second** replacement after actual death and **3600** ordinary wander interval. Existing two-room wander remains two-room; a crow on an evidenced transport or return excursion keeps its living slot while that plan skips its wander. After deposit, fallback or Shoo, a checked return job takes one adjacent corridor leg toward the member's authored home every **150 logical seconds** and finishes there in at most seven legs; ordinary wander resumes on a later boundary. Accepted combat pauses return until the encounter closes with the crow alive. This is a narrow crow corridor/location admission, not an N-room wander redesign. Crows have authored HP **1**, attack chance **0** and damage range **1..1**, so they do not initiate a fight. Their exact plan/bundle/corpse references, runtime generation, HP and room must be validated as for C3; one direct held coin goes to the crow's public corpse on death, without crow loot or player credit. Cap is the sum of the four cap-one plans, never historical dead identities.

The C3 bundle currently requires and mints a directly held pelt. Crow bundles instead require the same NPC/corpse roles with the companion item **absent**; birth creates only the crow and HP. Compiler, loader, genesis, population invariants and save validate this closed optional shape. Do not mint a fake feather, marker or duplicate coin. Two Green plans may share the Green template/bundle; Oak and Branches use home-matched crow templates under the current home validation. No unrelated hound/deer bundle changes are selected.

The one permitted transport corridor is Village Green → Well Lane → Ferry Landing → Reed Path → Reed Bank → Willow Shade → Drowned Oak → Oak Branches, using actual reciprocal exits one leg at a time; no path into underwater rooms. A selected acquisition or transport leg has an authored **150 logical second** delay. The nest is one real portable **250g** item, initially empty in Oak Branches, explicitly `container: true` with **8 direct-item roots** capacity and an authored lid initially open. Its text/barrier use the ordinary item declaration; do not create a detail-only or remote holder. If taken or moved, the original nest identity remains the target, but delivery falls back to the present dry room until it is again open in Oak Branches. The player can reach Branches and Take the delivered original coin by ordinary controls.

Compiler/loader validate resolved item/nest/population/corpse/room refs, a nonempty ordered reciprocal corridor with every declared adjacent edge, positive safe integer delays, each referenced plan's legal slot/home/bundle shape, container eligibility and declared capacity, and the allowlisted item's safe role. They validate this D8 declaration's actual references and relationships, without an engine rule that all cartridges have four cap-one plans, an eight-root nest or one shiny definition. Controlled chapter behavior and simulation assert the selected **4/8/one-coin** answers. D8 does not revise D6's coin source or frozen fixtures. These selected world values belong to this cartridge; no engine defaults or migration are added.

## Status declarations

[Status effects](mechanics.md#status-effects-over-time-toolbox-row-1) read `statuses/<key>.json` (compiled `statuses`, capabilities `status@1` and `death@1` since a fatal hp tick runs the death sequence, `kernel_api` at least **1.38**): `{duration, tick_every, resource, per_tick, label, narration: {applied, tick, expired}}`. `duration` and `tick_every` are positive logical seconds with `tick_every < duration`; `resource` names one pool of this cartridge; `per_tick` is a nonzero signed integer added each tick; `label` and each narration key must exist in the text catalog. A reaction step `{op: "status.apply", status: <key>}` names a declared status. An edible item's optional `cures: [<key>, ...]` names declared statuses it ends. The compiler (`lib/loka/content/status.ex`) and the loader (`kernel/ts/src/content/cartridge_status.ts`) refuse each violation. `cartridges/status_sampler` is the sampler: `poison` (hp −1 every 60 s for 300 s), `blessing` (mv +5 every 600 s for 3600 s), an antidote curing `poison`, and two room-entry reactions.

## Derived stat declarations

[Derived stats](mechanics.md#stats-derived-from-attributes-toolbox-row-2) read the optional `world.derived` in `cartridge.json` (`WorldSettings.derived`, owned by `attributes@1`, `kernel_api` at least **1.39**, **1.40** with `hp_max`): up to four tables, `hit_chance`, `damage`, `carry_grams` and `hp_max`, each `{terms: [{attribute, per_point, pivot}, ...], divisor?}` (`DerivedStat`). `attribute` names an attribute of this cartridge; `per_point` and `pivot` are ResourceInts; `divisor` is a positive integer, 1 when absent. `hit_chance` and `damage` need `world.combat`; `carry_grams` needs `world.carry`. The compiler (`lib/loka/content/derived.ex`) and the loader (`kernel/ts/src/content/cartridge_derived.ts`) refuse an unresolved attribute (UNRESOLVED_REFERENCE at the term's `attribute`), a missing `attributes@1` (UNDECLARED_CAPABILITY at `world.derived`), an older API floor (KERNEL_API_RANGE_INVALID) and a table without its settings (SCHEMA_VIOLATION at the table). `cartridges/derived_sampler` is the sampler. A cartridge without `world.derived` keeps its bytes, hash and behavior.

## Item affect declarations

[Item affects](mechanics.md#item-slots-and-affects-toolbox-row-3) read an item's optional `affects` (`ItemDefinition.affects`, a list of 1 to 16 `ItemAffect {attribute, modifier}`, the shape of an ancestry's modifier; `kernel_api` at least **1.41**). `attribute` names an attribute of this cartridge (source: its short key); `modifier` is a ResourceInt. The item needs a `slot` (`finger` is the thirteenth key). The compiler (`lib/loka/content/derived.ex`) and the loader (`kernel/ts/src/content/cartridge_derived.ts`) refuse an affect without a slot (SCHEMA_VIOLATION at `affects`), an unresolved attribute (UNRESOLVED_REFERENCE at the affect's `attribute`), a missing `attributes@1` (UNDECLARED_CAPABILITY at `affects`) and an older API floor (KERNEL_API_RANGE_INVALID). `cartridges/affects_sampler` is the sampler. A cartridge without affects or finger items keeps its bytes, hash and behavior.

[Experience and levelling](mechanics.md#experience-and-levelling-toolbox-row-4) read the optional `world.levelling` in `cartridge.json` (owned by `attributes@1`, `kernel_api` at least **1.42**): `{thresholds, points_per_level, kills: [{npc, experience}, ...], level_up}`. `thresholds` are strictly increasing positive ResourceInts; `points_per_level` is at least 1; each `npc` names an NPC of this cartridge (source: its short key) and `experience` is a positive ResourceInt; `level_up` must exist in the text catalog. A reaction step `{op: "experience.grant", amount}` needs `world.levelling`. The compiler (`lib/loka/content/levelling.ex`) and the loader (`kernel/ts/src/content/cartridge_levelling.ts`) refuse thresholds that do not rise (SCHEMA_VIOLATION at the threshold), an unresolved NPC or text (UNRESOLVED_REFERENCE), a grant without `world.levelling` (SCHEMA_VIOLATION at the step), a missing `attributes@1` (UNDECLARED_CAPABILITY at `world.levelling`) and an older API floor (KERNEL_API_RANGE_INVALID). `cartridges/levelling_sampler` is the sampler. A cartridge without `world.levelling` keeps its bytes, hash and behavior.

## Tag declarations

[Property tags](mechanics.md#property-tags-and-the-policy-leaf-set-toolbox-row-g1) are an optional `tags` list on an item, barrier or room source file (`ItemDefinition`, `BarrierDefinition`, `RoomDefinition`), each a `Tag` of the engine set; the compiler copies it into the artifact unchanged. A `tags` list and a `has_tag` policy node need `tags@1` in `requires.capabilities` (UNDECLARED_CAPABILITY at the member otherwise); its `item`, `barrier` or `room` takes a short key, expanded like `has_item`'s, and an unresolved one is UNRESOLVED_REFERENCE at that member in the compiler and the loader. Precedent sampler: `cartridges/tags_sampler`.

## Drop declarations

[Loot tables](mechanics.md#loot-tables-and-random-drops-toolbox-row-8) read an NPC's optional `drops` (`NpcDefinition.drops`, a list of 1 to 8 `{item, chance}`; `kernel_api` at least **1.43**, and `world.death`). `item` names an item of this cartridge (source: its short key) whose `location` is `{in: "npc", npc: <this NPC>}`; no item appears twice; `chance` is an integer 1 to 100; the NPC has `hp` with `gain` 0 (a regenerating NPC would revive holding its failed drops and re-roll them) and is not a `spawn_template` (populations keep their `loot_role`). The compiler (`lib/loka/content/death.ex`) and the loader (`kernel/ts/src/content/cartridge_death.ts`) refuse an unresolved item (UNRESOLVED_REFERENCE at the entry's `item`), an item this NPC does not hold or a repeated item (SCHEMA_VIOLATION at the entry), drops without `world.death`, without `hp`, with `hp.gain` above 0 or on a spawn template (SCHEMA_VIOLATION at `drops`) and an older API floor (KERNEL_API_RANGE_INVALID). `cartridges/loot_sampler` is the sampler. A cartridge without drops keeps its bytes, hash and behavior.

## Damage declarations

[Damage kinds, resistances and critical hits](mechanics.md#damage-kinds-resistances-and-critical-hits-toolbox-row-g2) read an attack profile's optional `kind` (a `DamageKind`) and `crit` (`{chance 1..100, multiplier 2..10}`), on `world.combat.player_attack`, an NPC's `attack` or an item's `weapon.attack`, and an NPC's optional `resistances` (`Resistances`: each member a `DamageKind` or `Tag` name, an integer -100 to 100). Any of them needs `kernel_api` at least **1.44**: the compiler (`lib/loka/content/combat.ex`) and the loader (`kernel/ts/src/content/cartridge_combat.ts`) report KERNEL_API_RANGE_INVALID at the manifest's `at_least` otherwise. The schema closes the names and bounds; the compiler copies the fields unchanged. `cartridges/damage_sampler` is the sampler.

## Skill growth and rating declarations

[Skill growth and opposed checks](mechanics.md#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5) read a skill's optional `growth` (`SkillDefinition.growth`, 1 to 8 strictly increasing positive integers), a detail's optional `rating` (`InspectableDetail.rating`, an integer) and the recipe check `{kind: "opposed", key}` with exactly one of `skill` or `attribute` (source: short keys, expanded like `attribute_threshold`'s). Each needs `kernel_api` at least **1.44**. The compiler (`lib/loka/content/skills.ex`, `lib/loka/content/recipes.ex`) and the loader (`kernel/ts/src/content/cartridge_skills.ts`, `kernel/ts/src/content/cartridge_recipes.ts`) synthesize the reserved fact `uses_<key>` for each skill with growth (an authored fact of that key is RESERVED_FACT) and refuse growth not strictly increasing (SCHEMA_VIOLATION at `growth`), an unresolved skill or attribute (UNRESOLVED_REFERENCE at the check member), an opposed check whose target detail has no `rating` (SCHEMA_VIOLATION at `check`) and an older API floor (KERNEL_API_RANGE_INVALID). `cartridges/skills_sampler` is the sampler. A cartridge without these fields keeps its bytes, hash and behavior.

## Hidden passage declarations

[Hidden passages](mechanics.md#hidden-passages-and-search-toolbox-row-11) read an exit's optional `hidden_until` (`Connection.hidden_until`, `{fact, equals}`; `kernel_api` at least **1.45**). `fact` names a fact of this cartridge (source: its short key), normally a `player`-scoped bool so discovery belongs to the character; `equals` is a value of its type (FACT_TYPE_MISMATCH otherwise). A hidden face has no `barrier` (BARRIER_MISMATCH at `hidden_until`), so no door verb can name it; its reciprocal face is an ordinary exit or hidden by its own declaration. The search that reveals it is an ordinary [action recipe](mechanics.md#action_recipe1-mechanicsaction_reciperulets49) whose outcome assigns the fact. A patrol route leg with any hidden face to its next room, or an expedition route edge through a hidden face, is OUTCOME_MISMATCH at the route. Both the compiler and the loader refuse each case.

## Time gate declarations

[Time windows](mechanics.md#time-windows-hour-and-moon-gates-toolbox-row-10): a barrier source file may declare `opens_when`, a VersionedPolicy, and any policy may use the `sky {lunar}` leaf (`calendar@1` in `requires.capabilities`). Both need `kernel_api` at least **1.45** (KERNEL_API_RANGE_INVALID). The compiler (`lib/loka/content/calendar.ex`, policy roots in `lib/loka/content/barriers.ex` `conditions`) and the loader (`kernel/ts/src/content/cartridge_calendar.ts`, roots in `cartridge_refs.ts` `nodes`) check `opens_when` like every other policy (owners, references, windows) and refuse a `sky` field naming a phase its calendar table does not author, or a table the calendar lacks (SCHEMA_VIOLATION at that field; [row 31](#sky-declarations) adds `weather`, `season` and `tide`). Sampler: `cartridges/time_sampler`.

## Climb declarations

[Rope and climb](mechanics.md#rope-and-climb-toolbox-row-30) reads an exit's optional `climb` (`Connection.climb`, `{item, damage, fell}`; `kernel_api` at least **1.45**). `item` names an item of this cartridge (source: its short key), the aid a climber must hold; `damage` is the fall's HP loss, an integer of at least 1 (a cartridge number); `fell` is a text key (UNRESOLVED_REFERENCE without a catalog entry), the fall's narration. The loader also refuses a climb in an artifact without an `hp` pool (RESOURCE_SPEC_INVALID at `climb`); the compiler always emits the default `hp` pool. Declare `climb` only on the face that descends; the way back up is an ordinary exit. A patrol route leg with any climb face to its next room is OUTCOME_MISMATCH at the route; an expedition route may cross one (it is the player's own travel). Both the compiler and the loader refuse each case.

## Narration variety declarations

[Narration variety](mechanics.md#narration-variety-and-visit-tiers-toolbox-row-w7): `cartridge.json` may declare `alternates`, a map from a text key to a nonempty list of text keys (`CompiledCartridge.alternates`), and any policy may use the `visited_count {room, at_least}` leaf. Both need `variety@1` in `requires.capabilities` (UNDECLARED_CAPABILITY at `alternates` or at the leaf's `op`) and `kernel_api` at least **1.45** (KERNEL_API_RANGE_INVALID). Every key and every alternate must be in the text catalog (UNRESOLVED_REFERENCE). `room` names a room of this cartridge (source: its short key). The compiler (`lib/loka/content/variety.ex`) and the loader (`kernel/ts/src/content/cartridge_variety.ts`) refuse each case. A `visited_count` leaf without `knowledge@1` in `requires.capabilities` never holds; the compiler warns (VISITS_UNRECORDED at `cartridge.requires.capabilities`, compiler only, the build succeeds). Sampler: `cartridges/variety_sampler`.

## Sky declarations

[Derived sky](mechanics.md#derived-sky-weather-season-and-tide-toolbox-row-31): `calendar.season` and `calendar.tide` are `CalendarCycle`s checked like `calendar.lunar` (ordered cuts below the period, the first at 0, unique phases, origin + period a safe integer); `calendar.weather` lists 1 to 32 `{phase, weight 1..1000, wet?}` entries with unique phases. A `sky` leaf's `weather`, `season` or `tide` must name a phase its table authors (SCHEMA_VIOLATION at that field otherwise). Any of the three tables needs the calendar units (`units_per_hour`, `hours_per_day`, `subdivisions_per_hour`; SCHEMA_VIOLATION at `calendar` otherwise), since the status line that shows them needs them, and `kernel_api` at least **1.45** (KERNEL_API_RANGE_INVALID), as a `sky` leaf does. A room declares `exposed` in its `tags` (`tags@1`). The compiler (`lib/loka/content/calendar.ex`) and the loader (`kernel/ts/src/content/cartridge_calendar.ts`) refuse each case. Sampler: `cartridges/sky_sampler`.

## Pick and force declarations

[Pick and force a barrier](mechanics.md#pick-and-force-a-barrier-toolbox-rows-13-and-g12) adds no field: a barrier source file declares `initial: "closed"` (a keyless `locked` barrier in reach is BARRIER_UNREACHABLE_KEY) and an `opens_when` reading an instance bool fact; the pick or force is a recipe on a room detail with a `rating` and an `opposed` check, as the [time gate](#time-gate-declarations), [skill growth and rating](#skill-growth-and-rating-declarations) and [tag](#tag-declarations) declarations already check. `kernel_api` at least **1.45** (for `opens_when`). Sampler: `cartridges/barrier_sampler`.

## Quest stage hints

Toolbox row W23 ([rules](mechanics.md#quest-stage-hints-toolbox-row-w23)). A quest journal may declare `hints {active?, objectives_met?}`, each 1 to 8 `{after, text}` with `after` whole real minutes (1 to 1440) strictly ascending (else `SCHEMA_VIOLATION` `invalid_value` at the stage list) and `text` a catalog key (`UNRESOLVED_REFERENCE`). Hints need `time_policy.profile = real_elapsed` (`INVALID_TIME_POLICY` at the `hints` member) and `requires.kernel_api.at_least >= 1.46` (`KERNEL_API_RANGE_INVALID`). Compiler (`lib/loka/content/quests.ex`) and loader (`kernel/ts/src/content/cartridge_quests.ts`) agree.
