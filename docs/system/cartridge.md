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

The phone bundles `ashmere_missing_child@0.0.3`, titled **Ashmere — The Missing Child**,
in its own `loka-ashmere-missing-child.db` save under the
[actual chapter cutover](../decisions/owner-decision-actual-chapter-cutover-2026-10-05.md).
This chapter in progress retains ten Ashmere rooms and playable Maud S1 (five rats,
earned key/trust, upstairs storage), combat, shrine return and real-elapsed time.
Maud stands behind the Drowned Lantern bar. The opening label says “The Missing Child
— in progress”; Q1 and the main search are not yet playable. The temporary Lantern
errand, Bram NPC/dialogues, lantern item, story point, scene and `search_plan` are
absent. Real Bram’s final role remains unresolved in the cutover record.

The release retains API1.7, real_elapsed rate50/start64800, HP10, MV100, carrying
ceiling12000, move cost1 and position recovery18/36 per3600 logical seconds from
reviewed sampler source; installed mechanics and validation are unchanged. Its
independent answer is `protocol/fixtures/missing_child_v002_hash.json`, derived
by `test/loka/cartridge_missing_child_hash.py`. Historical sampler/proof sources,
release pins and [sampler evidence](../evidence/c1-sampler/README.md) remain labeled
with their actual release and are not bundled.
The app opens only the chapter file and offers no story picker. Missing pins follow
[explicit Start over](save.md#opening-a-story), without automatic deletion or migration.

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
fields resolve to catalog TextKeys in compiler and loader. The current chapter adds
`ferry_landing.notice` (aliases `notice`, `landing_notice`) and
`drowned_lantern.rumor_board` (aliases `rumor_board`, `board`). Their authored labels
and bodies live in the chapter text catalog; Look keeps a separate observational description.

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

Dialogue `receive` role references must name an item and NPC; it requires a resolving quest
and excludes accept/hand_over. Dialogue `fact.adjust` must name a bounded integer fact, never
a reserved engine fact. Both validators enforce references, types and ownership; source short
fact references expand for this new spelling. Current reward/storage content declares API1.7;
there is no per-feature minimum-version detector for receive, fact.adjust or Put under the
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

Optional manifest `time_policy {profile: "real_elapsed", rate}` declares logical seconds per real second; rate is an integer in `1..9007199254740991`. Absence retains frozen legacy play_time. Opt-in requires `schedule@1` and `requires.kernel_api.at_least >= 1.1` (`KERNEL_API_RANGE_INVALID` at that lower bound otherwise). Installed kernel API is 1.7; old fixture requirement ranges remain unchanged.

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
