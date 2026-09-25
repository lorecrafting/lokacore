# protocol/

The frozen contracts both kernels validate against (spec 04 §12, 14 §R3). The contracts in
each file, with fields and examples: [contracts.gen.md](../docs/contracts.gen.md)
(generated). Before changing anything here, read the [contract lessons](../docs/lessons/contracts.md).

Every schema's contracts carry `examples` that must validate, and failing values with
hand-written errors in `fixtures/invalid.json`; both kernels run both. The fixtures column
lists only what a file adds to that.

| File | Covers | Spec | Fixtures |
|---|---|---|---|
| **Identity and scope** | | | |
| `identity.schema.json` | definition and runtime ids, each its own type; CommandId | 03 §2, §3, §6; 05 §4 | `command_id.json` |
| `scope.schema.json` | StateScope, AudiencePolicy | 03 §6 | |
| `relation.schema.json` | typed relations, entity provenance | 21 §4; 03 §3, §11; 05 §25 | |
| `text.schema.json` | localized text ids and bindings | 04 §15; 05 §18; 06 §43 | |
| **Rules and state change** | | | |
| `command.schema.json` | the portable Command registry | 04 §1, §3, §21; 14 §R3A | |
| `action.schema.json` | action definitions, invocation, targets | 04 §1, §2, §18, §19; 06 §20; 21 §7 | |
| `policy.schema.json` | the policy AST | 06 §21; 21 §3.2, §4; 14 §R3A | |
| `fact.schema.json` | FactSpec, scoped facts | 03 §7, §13; 21 §3.9, §4 | |
| `delta.schema.json` | StateDelta ops, targets, preconditions | 04 §1, §5.1, §5.3; 14 §R3A | `composition.json` |
| `decision.schema.json` | DecisionResult | 04 §5, §5.0, §5.2 | `composition.json` |
| `event.schema.json` | DomainEvent, proposed versus committed | 04 §1, §5.1, §8, §11; 14 §R3A | `composition.json` |
| `effect.schema.json`, `effect_registry.json` | effects and their registry | 04 §1, §10, §11; 03 §16 | |
| `error.schema.json`, `error_registry.json` | GameError and the one error registry | 04 §7 | |
| `gameview.schema.json` | the GameView envelope and freshness | 04 §14-§16; 00 §4.10 | |
| **Content and capabilities** | | | |
| `capability.schema.json`, `capability_registry.json` | capability versions, the lock, residency | 05 §3, §6, §11; 09 §21 | `capability_lock_hash.json` |
| `residency.json` | 05 §6 rows that are not capabilities | 05 §6 | each row names its own |
| `manifest.schema.json` | cartridge, deployment, campaign manifests | 05 §3, §20, §22; 07 §15; 01 A5 | |
| `feature.schema.json`, `feature_registry.json` | R3B feature envelopes | 14 §R3B | |
| **Host, platform, verification** | | | |
| `account.schema.json` | account/run binding, milestone reports, admission | 23 §2-§7, §11; 03 §25-§27 | |
| `invariant.schema.json`, `invariants.json` | registered invariants, checked by id | [roadmap](../docs/ROADMAP.md) | `composition.json` |

`fixtures/subset.schema.json` is a test-only probe for subset keywords no contract uses yet.
Registries are checked in `test/loka/core/registries_test.exs`.
