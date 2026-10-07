# protocol/

The current contracts both kernels validate against (spec 04 §12, 14 §R3). The contracts in
each file, with fields and examples: [contracts.gen.md](../docs/contracts.gen.md)
(generated). Before changing anything here, read the [contract lessons](../docs/lessons/contracts.md).

Every schema's contracts carry `examples` that must validate, and failing values with
hand-written errors in `fixtures/invalid.json`; both kernels run both. The fixtures column
lists only what a file adds to that.

| File | Covers | Spec | Fixtures |
|---|---|---|---|
| **Identity and scope** | | | |
| `identity.schema.json` | definition and runtime ids, each its own type; CommandId | 03 §2, §3, §6; 05 §4 | `command_id.json`, `job_command_id.json`, `elapsed_command_id.json` |
| `scope.schema.json` | StateScope, AudiencePolicy | 03 §6 | |
| `relation.schema.json` | typed relations, entity provenance | 21 §4; 03 §3, §11; 05 §25 | |
| `text.schema.json` | localized text ids and bindings; the default-locale text catalog | 04 §15; 05 §18; 06 §43 | |
| **Rules and state change** | | | |
| `command.schema.json` | the portable Command registry | 04 §1, §3, §21; 14 §R3A | |
| `action.schema.json` | action definitions, invocation, targets; ActionSet contributions and action recipes | 04 §1, §2, §18, §19; 06 §19, §20; 21 §7; 05 §28 | `cartridge_bell_hash.json` |
| `policy.schema.json` | the policy AST | 06 §21; 21 §3.2, §4; 14 §R3A | |
| `fact.schema.json` | FactSpec, scoped facts | 03 §7, §13; 21 §3.9, §4 | |
| `resource.schema.json` | ResourceSpec: bounded integer resources, the default HP/MA/MV pools, legacy hourly and opted position recovery | 21 §4; 00 §4 | `composition.json`, `cartridge_road_hash.json`, `resource_recovery.json` |
| `service.schema.json` | Immediate paid room entitlement, finite meal and provider-owned liquid serving; projected exact keyed quote | [B8 composition](../docs/system/protocol.md#b8-immediate-service-composition) | `service_contracts.json`, `missing_child_v025_hash.json` |
| [`liquid.schema.json`](liquid.schema.json) | finite liquid contents and authored mass/serving metadata | [B7 composition](../docs/system/protocol.md#b7-liquid-composition) | `liquid_contracts.json`, `liquid_template.json` |
| [`transport.schema.json`](transport.schema.json) | paired ferry boarding endpoints, conserved fare and actor-owned corpse recovery | [D1 mechanics](../docs/system/protocol.md#d1-ferry-transport-composition) | `transport_contracts.json` |
| [`water.schema.json`](water.schema.json) | bounded underwater occupancy contracts | [D6 mechanics](../docs/system/protocol.md#d6-water-movement-and-corpse-selection) | `water_contracts.json`, `water_composition.json` |
| `delta.schema.json` | StateDelta ops, targets, preconditions | 04 §1, §5.1, §5.3; 14 §R3A | `composition.json`, `resource_recovery.json` |
| `decision.schema.json` | DecisionResult | 04 §5, §5.0, §5.2 | `composition.json` |
| `event.schema.json` | DomainEvent, proposed versus committed | 04 §1, §5.1, §8, §11; 14 §R3A | `composition.json` |
| `effect.schema.json`, `effect_registry.json` | effects and their registry | 04 §1, §10, §11; 03 §16 | |
| `error.schema.json`, `error_registry.json` | GameError and the one error registry | 04 §7 | |
| `gameview.schema.json` | the GameView envelope and freshness | 04 §14-§16; 00 §4.10 | |
| **Content and capabilities** | | | |
| `capability.schema.json`, `capability_registry.json` | capability versions, the lock, residency, owned commands, definitions, events and policy ops | 05 §3, §6, §11; 09 §21 | `capability_lock_hash.json` |
| `residency.json` | 05 §6 rows that are not capabilities | 05 §6 | each row names its own |
| `room.schema.json` | rooms and their exits (Connection), owned by movement; details and description variants, owned by inspectable_detail and description_variant; barriers (BarrierDefinition, BarrierState), owned by barrier | 21 §5, §6; 05 §17, §25; 00 §4.10; 00a §2, §12 | `cartridge_rooms_hash.json`, `cartridge_details_hash.json`, `cartridge_facts_hash.json`, `cartridge_gate_hash.json` |
| `entity.schema.json` | items and NPCs (ItemDefinition, NpcDefinition, ItemLocation), owned by containment; an NPC's daily_schedule, owned by behavior; an item's slot (SlotKey), owned by equipment; an item's explicit container eligibility, capacity and barrier (a receptacle's lid, barrier@1); ItemReadable held-item text and declared topic | 21 §5, §8, §10; 03 §23; 06 §13; 00 §4.4; 00a §5, §12 | `cartridge_items_hash.json`, `cartridge_ferry_hash.json`, `cartridge_wear_hash.json`, `cartridge_locks_hash.json`, `missing_child_v026_hash.json` |
| `quest.schema.json` | quests (QuestDefinition and its QuestObjective evidence policy), owned by quest; the lifecycle state is policy.schema.json QuestState | 06 §1-§5, §43; 04 §5.2 | `cartridge_errand_hash.json` |
| `dialogue.schema.json` | dialogues (DialogueDefinition: speaker, talk policy, prompt, bound roles, choices with fact.assign consequences and an optional hand-over, the quest a choice resolves), owned by dialogue | 06 §17, §18, §33, §43; 04 §5.3 | `cartridge_ferry_hash.json` |
| `scene.schema.json` | modal narration and anchored `presentation_only` Rest dream; bound Continue, choice/branch and checked final consequences | 06 §33–§37; 21 §3.6; [mechanics](../docs/system/mechanics.md#scene1-mechanicsscenerulets) | `cartridge_scene_hash.json` |
| `reaction.schema.json` | reaction rules (ReactionRule: trigger, when, fact.assign and restricted quest.activate consequences), owned by reaction | 21 §3.4, §11; 06 §14; 04 §5.2-§5.4 | `cartridge_green_hash.json` |
| `manifest.schema.json` | cartridge, deployment, campaign manifests | 05 §3, §20, §22; 07 §15; 01 A5 | |
| `cartridge.schema.json` | compiled cartridge (v1, and v2 with rooms, entry and text; its Calendar, owned by calendar), artifact file and byte cap, diagnostics | 05 §8, §11, §18, §20; 08 §6; 14 §R4, §R5; 21 §4 | `cartridge_hash.json` (v1), `cartridge_rooms_hash.json` (v2), `cartridge_ferry_hash.json` (calendar), `cartridge_lantern_hash.json` (the pre-release proof cartridge), `cartridge_loader.json` (loader corpus, TypeScript) |
| `feature.schema.json`, `feature_registry.json` | R3B feature envelopes | 14 §R3B | |
| **Host, platform, verification** | | | |
| `account.schema.json` | account/run binding, story point reports, admission | 23 §2-§7, §11; 03 §25-§27 | |
| `observation.schema.json`, `event_registry.json` | the observation record envelope, stores, correlation ids, game-trace entry, and the registered event names | 11 §11-§15; 08 §6; 09 §2, §7; [ADR-075](../docs/archive/decisions/adr-075-observability-proposal.md) | `delta_digest.json`, `input_digest.json` |
| (no schema) | the invocation-intent digest a receipt stores (`residency.json` receipts; TypeScript only) | 03 §14 | `intent_digest.json` |
| `invariant.schema.json`, `invariants.json` | registered invariants, checked by id | [roadmap](../docs/ROADMAP.md) | `composition.json` |

`fixtures/subset.schema.json` is a test-only probe for subset keywords no contract uses yet.
Registries are checked in `test/loka/core/registries_test.exs`.

Current receptacle fixtures are named `containers_*hash.json`; their independently
derived additions are in `test/loka/cartridge_containers_hash.py`. Original artifacts and
`historical_transcripts/` retain preproduction bytes; the current loader refuses
unmarked receptacles. Current feature transcripts remain replayable. The bundled
chapter's release, API, content hash, room count and allocation oracle live in
[the current chapter identity](../docs/system/cartridge.md#current-bundled-chapter).

`fixtures/escort.json` pins the API1.11 relation, transition, target, dialogue effect
and policy supplement, including both portable composers and independent preconditions
([escort mechanics](../docs/system/mechanics.md#escort1)).
