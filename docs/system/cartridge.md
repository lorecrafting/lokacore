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
| `attributes.json` | `{"attributes": {key: {start}}}`: the cartridge's attributes (AttributeSpec without `key`; an authored `key` is `UNKNOWN_FIELD`), each actor's value its `start` ([mechanics.md](mechanics.md#attributes1); `lib/loka/content/resources.ex:2`) |
| `rooms/`, `items/`, `npcs/`, `barriers/`, `recipes/`, `quests/`, `dialogues/`, `reactions/`, `story_points/`, `scenes/`, `policies/`, `actions/` | one file per definition, `<key>.json`, the frozen shape without `key`; NPC and item files are blueprints |

A reference is a full DefinitionRef naming this cartridge, or short: the key alone, of the kind
its field takes (`Loka.Content.Checks.expand/2`, `lib/loka/content/checks.ex:37`). Any other
`.json` file is `UNKNOWN_FIELD`. A source with rooms, text or an entry compiles to
`loka-cartridge-v2`; v1 (manifest, facts, policies, actions) is the R4 form.

The phone bundles `ashmere_missing_child@0.0.15`, titled **Ashmere — The Missing Child**,
in its own `loka-ashmere-missing-child.db` save under the
[actual chapter cutover](../decisions/owner-decision-actual-chapter-cutover-2026-10-05.md).
This chapter in progress retains ten village and inn rooms and playable Maud S1 (five rats,
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

The release declares API1.13 for the authored calendar and confirmed status projection, including API1.12's typed bell reaction and scene composition. It retains real_elapsed rate50/start64800, HP10, MV100, carrying
ceiling12000, move cost1 and position recovery18/36 per3600 logical seconds from
reviewed sampler source. Its
independent answer is `protocol/fixtures/missing_child_v015_hash.json`, derived
by `test/loka/cartridge_missing_child_v015_hash.py`. Historical sampler/proof sources,
release pins and [sampler evidence](../evidence/c1-sampler/README.md) remain labeled
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
`requires.kernel_api.at_least >= 1.4` (`KERNEL_API_RANGE_INVALID` otherwise); installed
API 1.4 loads this addition and older APIs reject its requirement. Runtime definition and
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
fact references expand for this new spelling. Current reward/storage content declares API1.7;
there is no per-feature minimum-version detector for legacy quest-resolving receive, fact.adjust or Put under the
[pre-production policy](../decisions/owner-decision-preproduction-compatibility-2026-10-04.md). Generic manifest range/schema validation remains. An unknown dialogue sequence operation
now reports `unknown_variant` (the fact.assign/fact.adjust discriminator), rather than the old
single-operation `const_mismatch`; valid legacy dialogue and hand_over semantics are unchanged.

## Artifact and loader

`loadCartridge(bytes, installed)` (`kernel/ts/src/content/cartridge.ts:48`) returns the decoded
cartridge and its hash, or the first diagnostic of the first failing stage (`:62`): size
(`ARTIFACT_TOO_LARGE`), JSON (`INVALID_JSON`), format (`UNKNOWN_FORMAT`: v1 or v2), the
`CartridgeArtifact` schema (`SCHEMA_VIOLATION`, `UNKNOWN_FIELD`), `CONTENT_HASH_MISMATCH`,
map keys against manifest and definition (`ARTIFACT_DEFINITION_KEY_MISMATCH`, `:110`), the
lock (`:160`: `LOCK_MANIFEST_MISMATCH`, `UNKNOWN_COMMAND`, `UNDECLARED_CAPABILITY`),
references (`kernel/ts/src/content/cartridge_refs.ts:156` and the `cartridge_*.ts` twins of the
compiler's checks), and the installed kernel (`content/cartridge.ts:229`: `CAPABILITY_NOT_INSTALLED`,
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
(`test/loka/cartridge_cross_kernel_test.exs:113`); the loader corpus is
`protocol/fixtures/cartridge_loader.json`.

A compiled cartridge is a CompiledCartridge ([contracts](../contracts.gen.md#cartridge-artifact-contracts-protocolcartridgeschemajson)):
the manifest, lock and definition maps keyed by DefinitionRefString
(`<id>@<version>:<kind>/<key>`; `content/cartridge.ts:110`).

## Installed capabilities

`INSTALLED` (`kernel/ts/src/runtime/world.ts:67`): `kernel_api` 1.5, `content_schema` 1, `rule_ir`
1, no client features, and these capabilities at version 1: with a rule module `movement`,
`barrier`, `containment`, `description_variant`, `action_recipe`, `schedule`, `quest`,
`dialogue`, `equipment`, `position`, `scene` (`:35`); without a command, so without a rule, `fact`, `policy`,
`inspectable_detail`, `check`, `resource`, `behavior`, `calendar`, `reaction`, `narration`,
`target_resolution`, `attributes`, `death` (`:52`). The [feature map](../features.gen.md) is the authority for what
each one implements and where; `bin/features.exs --check` fails when a rule module exists
without its row. The registered capabilities it marks `not yet` may be named by a
cartridge, but one that locks them fails `CAPABILITY_NOT_INSTALLED`.

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
stage's fallback. `lantern_proof` stays byte-identical to preserve phone saves pinned to its
release. Adding journal keys there requires retaining the old pinned Lantern release, a save
migration outside this slice; c1-sampler supplies journal keys for the phone first.

`cartridges/ashmere_{hello,rooms,details,facts,items,bell,dusk,road,gate,errand,ferry,green}`
each exercise one slice; most carry replayable transcripts
(`cartridges/<name>/transcripts/<capability>.jsonl`, replayed by
`kernel/ts/test/transcripts.test.ts`). `cartridges/lantern_proof` is the R6P proof, "The
Ferryman's Lantern": four rooms, Bram, one lantern, one quest with a `current_state`
objective and no offer, two dialogues of Bram's: `bram_offer` while the player has no instance of
the quest (one choice, `accept`, which accepts it) and `bram` while it is active (two choices,
`carry`, `leave` with a hand-over), the fact `search_plan`, a story point with one outcome per choice, start 06:00
(`cartridges/lantern_proof/*`; its stats and gate: [owner rules](owner-rules.md#product-and-scope)). The phone bundles its known answer
(`mobile/app/App.tsx`).

## M1-A elapsed policy

Optional manifest `time_policy {profile: "real_elapsed", rate}` declares logical seconds per real second; rate is an integer in `1..9007199254740991`. Absence retains frozen legacy play_time. Opt-in requires `schedule@1` and `requires.kernel_api.at_least >= 1.1` (`KERNEL_API_RANGE_INVALID` at that lower bound otherwise). Installed kernel API is 1.9; old fixture requirement ranges remain unchanged.

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
The previous0.0.8 pin is retained; changed content gets new version and independent KAT.

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
The [M20-B2 evidence](../evidence/2026-10-05-m20-b2-mauds-cellar/README.md) records the
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

## A3 Green finale (planned)

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

## Selected S2 authoring (pending implementation)

The B2 release will author Peg and her one ledger at the chandler, plus the storeroom,
while reusing the existing public Aldric in the Chapel Nave. Peg's offer has no hours
gate. Source declares S2's fixed absolute deadlines through the authored chapter
calendar, 10-penny payout, 20-penny player start, Aldric's explicit 10-penny funding,
the 0..1000 penny resource bound, and the typed fact bounds and outcomes. The
[selected mechanic](mechanics.md#s2-chandlers-debt-selected-contract-pending-implementation)
owns timing, identity and atomic consequences. Compiler and loader must validate the
receive-plus-accept choice, bound original participants/item, absolute due time,
resource ownership and exact participating balances. Source may use a narrow typed
expiry declaration; it must not encode the job as a free-form Effect interpreter.
This section describes the selected next release, not content already installed.

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
weapon, shield, hour or next-day stock gate. C2 later owns Tobin's reachable watch
post/patrol. C1 source is carried by the current [B4 successor](#b4-well-and-fuel), which owns
the current chapter payload and identity pin. Source and checks remain local until
independent review.

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

**Selected, pending implementation.** The [B7 mechanic](mechanics.md#b7-well-and-waterskin-selected-contract)
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

**Local source implemented; independent review pending.** [C2](mechanics.md#s3-finite-watch-patrol-c2-selected-contract)
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
bound all validation/traversal. The local 0.0.24/API1.22 candidate and independently derived hash/IDs are pinned
in the [C2 brief](../briefs/chapter-one/chapter-one-c2-watchmans-rounds-brief-2026-10-05.md).
Publication and independent source approval remain pending.

## B6 marsh route and tuning

The current local source release is `ashmere_missing_child@0.0.23`, API1.21,
with [independent payload](../../protocol/fixtures/missing_child_v023_hash.json),
[103 initial IDs](../../protocol/fixtures/missing_child_v023_ids.json) and
[derivation from reviewed B7 v022](../../protocol/fixtures/generate_missing_child_v023.py).
Its SHA-256 is `e7333f694e6ec2c9f02a39944d994d4452f26fffc5534ff217346504471e4c71`.
Independent B6 source and save/protocol reviews remain pending.


The [S4 mechanic](mechanics.md#s4-all-hours-wisp-b6-selected-contract)
adds exactly three rooms. Mire Crossing east ↔ Marsh Light west is an all-hours
public path on existing firm footing; preserve the already always-passable mire
and all existing exits. Marsh Light south ↔ Old Causeway north and Old Causeway
east ↔ Tide Flats west are public reciprocal dry walking routes. Tide Flats is
its public edge, with no swimming, low-tide charm, fare or water hazard in B6.
The future Hound Run connection waits for C3; no dangling exit is emitted.
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

**Selected, pending implementation.** The [population contract](mechanics.md#c3-bounded-living-hounds-selected-contract)
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
edges, positive safe calendar products/periods, wander interval <= replacement
delay, targets <= cap, and the exact bounded bundle shape. Hound HP/attack obey
existing profile validation; pelt has ordinary
item metadata and no lid, slot, children or capacity; corpse obeys M5 room-container
validation. Unknown fields and malformed origin/job/state declarations refuse at
compile/load; inspect actual slot bounds before traversal or allocation.

No B3 Sell extension is needed to prove real loot: legal Take places the same pelt
in Carrying, and Drop/Put/death preserve it. Rat corpse selection and five finite
S1 credits retain their declared consumer. Future deer/crows, bell disable and C4
must amend their actual additional contracts. Successor release/API/hash/fresh IDs
remain null until the reviewed integrated predecessor is known.

## C4 pack response and wounded flight

**Selected, pending implementation.** [C4](mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract)
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
C4 successor release/API/hash/fresh IDs remain null until integrated C1/C3 source
and intervening shared release edits are reviewed and independently re-pinned.

## D1 ferry and Isle declarations

Add exactly six chapter rooms: Boathouse, Fen Isle Landing, Isle Hut, Hut Loft,
Herb Garden and Isle Shrine. Ferry Landing west/east connects to Boathouse;
Fen Isle Landing east/west connects to Isle Hut and south/north to Isle Shrine;
Isle Hut east/west connects to Herb Garden and up/down to Hut Loft. The
Boathouse–Fen Isle Landing crossing is declared only as the two boarding-detail
transport endpoints, never as a free compass exit. Do not expose the future
Boathouse–Old Mill edge. Isle Shrine is descriptive sanctuary/foreshadow;
`chapel_nave` remains the actual death shrine.

The cartridge declares an unattended rope ferry, outbound **2p**, return **0p**,
the exact destination and Mother Sedge as the conserved fare recipient. Sedge is
in Isle Hut at all hours and has an explicit bounded pennies balance to receive
payment. Source definitions own fares, room links, text and balances. D1 adds
`swim` to the C1 skill definitions with a vacuous `all: []` qualification
policy: D1 has no water action or new attribute to qualify. Sedge's direct
free dialogue choice uses `skill.acquire` and does not issue D6 water access
early. D6 must re-pin its provisional CON threshold against the installed
attribute vocabulary before implementing underwater admission. The optional
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
action, or ordinary exit that bypasses the declared ferry. The final bundled
release/API/hash/ID answers must be independently derived after the actual
source predecessor lands; D1 planning assigns no successor values.

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

The local B8 candidate is `ashmere_missing_child@0.0.25`, API1.23, with
[independent hash](../../protocol/fixtures/missing_child_v025_hash.json) and
[111 allocated IDs](../../protocol/fixtures/missing_child_v025_ids.json), derived
and rechecked against published C2/main predecessor `cb7fbc1c`. Source and
scoped correction reviews approve the implementation; the
[final evidence](../evidence/2026-10-05-b8-maud-services/README.md) records the
full gate and independent pin recheck. B8 publication remains pending.

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
B9 integrates the published D5/D2 predecessor. Independent current release/API/hash/
allocated-ID answers and the retained provisional fixtures are recorded in the
[source evidence](../evidence/2026-10-05-b9-lantern-dream/README.md).

## D4 homes and orchard declarations

**Selected plan; source pending.** [D4 mechanics](mechanics.md#d4-homes-finite-apples-and-eat-selected-contract)
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

Compiler and loader require `food@1` plus the successor API for edible fields,
local declared recovery-pool references, positive safe-integer amount and valid
catalog keys, and reject edible containers, equipment, fuel or liquid vessels.
Expand source short references at the real new field. Edibility belongs to an
immutable item definition; the terminal holder is generated metadata, never
cartridge-authored. Successor release/API/hash/IDs remain null until source exists.

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
current location. Release/hash/IDs advance independently when source exists;
this plan assigns no successor pin or API increment.
