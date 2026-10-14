# Second opinion: toolbox row FD4, NPC-NPC pair facts (loka-kgd.141)

- Branch `toolbox/m12-pairs`, head `caa0e13e` (after fix round 1), base `e78a8629`, kernel_api 1.89. No PR (batch model). Main review: [2026-10-14-m12-pairs-review.md](2026-10-14-m12-pairs-review.md).
- Angle: contract and save only ([WORKFLOW step 4](../WORKFLOW.md), [contracts](../lessons/contracts.md), [storage](../lessons/storage.md)); spec [mechanics.md "NPC-NPC pair facts"](../system/mechanics.md).
- Verdict: **APPROVE WITH NOTES**.
- Written 2026-10-14 by anthropic/claude-opus-5-5 (second-opinion reviewer).

## Must be true

1. `with_id` is part of the target key in both kernels with the same canonical text; old targets without it keep their bytes.
2. A fact is either `npc_pair` or not, so one fact never has both an entity row and a pair row (no aliasing).
3. `fact.assign`, MutationTarget, ScopedFact and `fact_changed` all carry `with_id`, and the mobile save (validated rows, cold reopen, receipt replay) keeps it.
4. `facts_typed` is a single TypeScript rule (`protocol/invariants.json:147-153`, `implemented_in: typescript`); the Elixir half is not applicable.
5. Chapter 1 and other cartridges are unchanged.

## Checks

- 1: met. `elixir bin/contracts.exs --check` exit 0 (`contracts.gen.ts` current). Mutant K2 red in both known answers and differential.
- 2: met. `typedFact` (`fact_typed.ts:28`) ties `with_id` to `npc_pair`, and the loader keeps `npc_pair` to per_subject facts at instance scope only.
- 3: met for the schemas and the save (S1, S2, S3 red). Kernel emission is not pinned (finding 1).
- 4: met. The rule was moved to `kernel/ts/src/mechanics/fact_typed.ts` with no change in behavior, and the pair clause was added.
- 5: met. No `*_hash.json` changed; `test/loka/content_missing_child_test.exs` 11/11 green.
- Loader probe: a dialogue or recipe `fact.assign` cannot name a pair fact. Those schemas have no `with`, and `paired !== hasOwn(with)` (`cartridge_scoped_facts.ts:77`) flags a pair fact without it.
- Realm seams 1/2/5/9 answers agree with `reaction.ts` `assignment` (event subject or `npc`, instance scope, no instancing).

## Mutants (focused: kernel `pair_facts`/`compose`/`validate`, mobile `pair_facts`, `compose_test.exs`/`contracts_test.exs`)

| Mutant | Result |
|---|---|
| S1: MutationTarget loses `with_id` (delta schema) | red: mobile `save_corrupt`, Elixir `unknown_property /with_id` |
| S2: `fact_changed` loses `with_id` (event schema) | red: mobile only |
| S3: `fact.assign` op loses `with_id` | red: mobile and Elixir |
| K1: `factChanged` drops `...partner` (`fact.ts:259`) | **green everywhere** |
| K2: `compose_target.ex` drops `with_id` | red: known answers and differential |
| K3: `facts-save.ts` skips `facts_typed` | green; the check predates this slice (W2), so this is not an FD4 finding |

## Findings

1. **Should-fix**, `kernel/ts/src/mechanics/fact.ts:259`. No test pins `with_id` on the emitted `fact_changed`. The spec puts it in the payload (`mechanics.md` Row key). Scenario: a refactor drops `...partner`, and smith-toward-miller and smith-toward-baker then emit identical events. A listener or receipt reader cannot tell the two rows apart, and the suite stays green (K1). A one-line probe asserting `with_id === miller` on the give step's `fact_changed` passes at the head and goes red under K1. Fix: add that assertion to `kernel/ts/test/pair_facts.test.ts` (first test).
2. **Nit**, `docs/system/mechanics.md:2886` cites `kernel/ts/src/mechanics/fact.ts` for facts_typed. Fix round 1 moved the rule to `fact_typed.ts`.
3. **Nit**, `protocol/invariants.json:152`: the facts_typed statement does not mention the rule "`with_id` exactly when `npc_pair`, two distinct NPCs". Likewise, the `fact_changed` description (`protocol/event.schema.json:346`) mentions only `subject_id`.

## Recheck, fix round 2 (`caa0e13e..02cb0cf9`, record cherry-picks excluded)

Reviewed `02cb0cf981d550e0252a98c3fe5e9c07d99b5498`. Verdict: **CHANGES REQUIRED** (one text line).

- Finding 1 (should-fix): fixed. `kernel/ts/test/pair_facts.test.ts:104` asserts `with_id` = miller on the give step's `fact_changed`. Red control: `...partner` removed at `kernel/ts/src/mechanics/fact.ts:259`, so `pair_facts.test.ts` fails (actual `undefined`, expected miller's id). Restored, green.
- Nit 2: fixed. `docs/system/mechanics.md:2886` cites `fact_typed.ts`.
- Nit 3: `event.schema.json:346` is right: `with_id` is set only from the assign's `with_id` (`fact.ts:254`), and `typedFact` admits that only for `npc_pair` (`fact_typed.ts:28`). `elixir bin/contracts.exs --check` exits 0.
- **New should-fix**, `protocol/invariants.json:152`. The shortened facts_typed statement drops the W13 clause "(a room only for engine trail facts)", which `0d2d4094` added. `fact_typed.ts:55-58` still enforces it. Failure scenario: the registered rule no longer says that a room subject is allowed only for trail facts. A port or reviewer that works from the statement then accepts a room subject on any per_subject fact. The W2 subject kinds were already gone in `0d2d4094`, so this round did not drop them. A version that keeps the clause fits the 200-character limit (196 characters): `Every stored fact is declared, in a scope kind it allows, with its FactSpec type; subject exactly when per_subject (a room only for trail facts); with_id exactly when npc_pair (two distinct NPCs).`
- Hosted CI on the head: `ci` 38625170966 and `book-e2e` 38625170860 were still in progress when this record was written.
