# Cartridges: source, compiler, artifact, loader

## Source layout

A cartridge source is a directory of JSON files (`lib/loka/content.ex:2`):

| File | Holds |
|---|---|
| `cartridge.json` | the manifest: `api_version`, `id`, `version`, `title`, `requires` (`kernel_api {at_least, below}`, `content_schema`, `rule_ir`, `capabilities {key: version}`, `client_features`), `supported_profiles`, optional `entry` room and `calendar {start}` (`cartridges/lantern_proof/cartridge.json`) |
| `facts.json` | `{"facts": {name: FactSpec}}`; a dotted name maps to a snake_case key, two names mapping to one key is `FACT_NAME_COLLISION` |
| `text.json` | the TextCatalog: key → string |
| `resources.json` | overrides of the default pools' fields, or further ResourceSpecs (`lib/loka/content/resources.ex:2`) |
| `rooms/`, `items/`, `npcs/`, `barriers/`, `recipes/`, `quests/`, `dialogues/`, `reactions/`, `story_points/`, `policies/`, `actions/` | one file per definition, `<key>.json`, the frozen shape without `key` |

A reference is a full DefinitionRef naming this cartridge, or short: the key alone, of the kind
its field takes (`Loka.Content.Checks.expand/2`, `lib/loka/content/checks.ex:72`). Any other
`.json` file is `UNKNOWN_FIELD`. A source with rooms, text or an entry compiles to
`loka-cartridge-v2`; v1 (manifest, facts, policies, actions) is the R4 form.

## Compiler

`mix loka.compile <source dir> <artifact path>` (`lib/mix/tasks/loka.compile.ex:12`) writes
the artifact and prints warnings as JSON lines, or prints every diagnostic and exits 1.
`Loka.Content.compile/2` (`lib/loka/content.ex:38`) runs the stages on the parts earlier
stages accepted, so one bad file hides no other diagnostic; diagnostics are unique and sorted by
path, code, then canonical text (`:73`). The artifact is the canonical encoding of
`{"cartridge": …, "content_hash": sha256(canonical cartridge)}` (`:53`), at most 4 MiB
(`ARTIFACT_TOO_LARGE`, `:67`). Every v2 cartridge gets the pools hp, ma, mv and
`resource@1` and `schedule@1` in its lock, with or without `resources.json`
(`lib/loka/content/resources.ex:53`); the engine defaults are hp 0..20 start 20 gain 5, ma
0..100 start 100 gain 4, mv 0..82 start 82 gain 18 per game hour (`:13`), and
`minimum <= start <= maximum` else `RESOURCE_SPEC_INVALID`.

What the compiler checks (`lib/loka/content/*.ex` moduledocs; codes in
`protocol/cartridge.schema.json` DiagnosticCode):

- every command, policy op, definition kind and event the cartridge uses has its owner in the
  lock (`UNDECLARED_CAPABILITY`); an action's command is never `run_job`;
- every reference resolves to a definition of this cartridge and of its field's kind
  (`UNRESOLVED_REFERENCE`); a fact value matches its FactSpec (`FACT_TYPE_MISMATCH`,
  `FACT_DEFAULT_INVALID`); every text key has a catalog entry;
- a recipe's, quest's or dialogue's key is no registered command's and no other action's,
  recipe's or quest's (`DUPLICATE_DEFINITION`: each is an ActionSet identity); an NPC may speak
  several dialogues; no dialogue role named `actor`; a choice's `accept` names a quest, in a
  dialogue without a `quest`, on a choice without a `hand_over` (`OUTCOME_MISMATCH`); a recipe has a `failure` outcome exactly when it has a
  check (`content_dusk_test.exs`); `time_window` needs `schedule@1` and a non-empty window
  (`EMPTY_TIME_WINDOW`); a schedule needs `behavior@1` and a calendar `calendar@1`;
- items and NPCs start somewhere real with no containment cycle and within capacity
  (`CONTAINMENT_CYCLE`, `CAPACITY_EXCEEDED`); details are reachable (`UNREACHABLE_DETAIL`);
- barriers: each exit's barrier and its reciprocal face name the same one (`BARRIER_MISMATCH`);
  no locked barrier's key is out of reach (`BARRIER_UNREACHABLE_KEY`;
  `lib/loka/content/barriers.ex:2`);
- story points: each outcome's trigger names a dialogue and one of its choices, no two outcomes
  one site, in a dialogue that resolves a quest (`OUTCOME_MISMATCH`;
  `lib/loka/content/dialogues.ex:2`);
- touch links in catalog strings: `[words]` links the thing whose text it is, and `[words]` followed by
  `(key)` a detail, item or NPC; an unresolved target is an error; a room description or room line without
  a link to its visible details or entity is a `TOUCH_LINK_MISSING` warning
  (`lib/loka/content/links.ex:2`).

Each development cartridge compiles to its independent known answer
(`protocol/fixtures/cartridge_<name>_hash.json`, derived by `test/loka/cartridge_lantern_hash.py`
for the Lantern; `test/loka/content_*_test.exs`).

## Artifact and loader

`loadCartridge(bytes, installed)` (`kernel/ts/src/cartridge.ts:47`) returns the decoded
cartridge and its hash, or the first diagnostic of the first failing stage (`:62`): size
(`ARTIFACT_TOO_LARGE`), JSON (`INVALID_JSON`), format (`UNKNOWN_FORMAT`: v1 or v2), the
`CartridgeArtifact` schema (`SCHEMA_VIOLATION`, `UNKNOWN_FIELD`), `CONTENT_HASH_MISMATCH`,
map keys against manifest and definition (`ARTIFACT_DEFINITION_KEY_MISMATCH`, `:108`), the
lock (`:156`: `LOCK_MANIFEST_MISMATCH`, `UNKNOWN_COMMAND`, `UNDECLARED_CAPABILITY`),
references (`kernel/ts/src/cartridge_refs.ts:152` and the `cartridge_*.ts` twins of the
compiler's checks), and the installed kernel (`cartridge.ts:224`: `CAPABILITY_NOT_INSTALLED`,
`FACT_SCOPE_UNSUPPORTED` (a fact has exactly one scope, `player` or `instance`),
`KERNEL_API_UNSUPPORTED`, `PINNED_VERSION_UNSUPPORTED`, `CLIENT_FEATURE_UNSUPPORTED`).
Compiled artifacts load in TypeScript with identical bytes, hash and lock
(`test/loka/cartridge_cross_kernel_test.exs:113`); the loader corpus is
`protocol/fixtures/cartridge_loader.json`.

A compiled cartridge is a CompiledCartridge ([contracts](../contracts.gen.md#cartridge-artifact-contracts-protocolcartridgeschemajson)):
the manifest, lock and definition maps keyed by DefinitionRefString
(`<id>@<version>:<kind>/<key>`; `cartridge.ts:110`).

## Installed capabilities

`INSTALLED` (`kernel/ts/src/world.ts:60`): `kernel_api` 1.0, `content_schema` 1, `rule_ir`
1, no client features, and these capabilities at version 1: with a rule module `movement`,
`barrier`, `containment`, `description_variant`, `action_recipe`, `schedule`, `quest`,
`dialogue` (`:32`); without a command, so without a rule, `fact`, `policy`,
`inspectable_detail`, `check`, `resource`, `behavior`, `calendar`, `reaction`, `narration`,
`target_resolution` (`:46`). The [feature map](../features.gen.md) is the authority for what
each one implements and where; `bin/features.exs --check` fails when a rule module exists
without its row. The 19 registered capabilities it marks `not yet` may be named by a
cartridge, but one that locks them fails `CAPABILITY_NOT_INSTALLED`.

## Text

`Text` is `{key, bindings}`; a committed narration line may carry `participants`, each name
bound to an EntityId at commit (`kernel/ts/src/rules/action_recipe.ts:89`), so redisplay and
replay never resolve a name again. Catalog strings carry the touch links above; the phone's
model strips them to prose until details are tappable (`mobile/app/book/model.ts:25`).

## Development cartridges

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
