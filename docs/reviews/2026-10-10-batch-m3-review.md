# Batch review: mechanics toolbox M3, G1 tags, loot, W1, skills, damage (loka-kgd, PR #351)

- Draft PR #351, branch `toolbox/batch-m3`, head `c72ddb6f70e107371071cbd923d88821d00f3051`, base `origin/main` `4e5acb53` (110 files). One Fable review on the batch head; the five item reviews are in this directory and are not repeated. Protocol schema and `kernel_api` change, so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [mechanics.md](../system/mechanics.md) rows G1, 8, G2, 5/G5 and the reaction@1 table; [cartridge.md](../system/cartridge.md) tag, drop, damage and skill declarations; PM floor rulings in Beads `loka-kgd` (loot 1.43; skills and G2 1.44; tags by `tags@1`; W1 no floor).
- Hosted CI on the head: ci and book-e2e, both success.
- Verdict: **APPROVE WITH NOTES** (two nits, no blocker, no should-fix).

## Must be true (cross-item)

1. A reaction can observe but never write the reserved `uses_<key>`, in both compilers.
2. A crit kill of a dropper with reactions listening is replay-deterministic; drop rolls follow the attack draws; NPC-subject events apply no status.
3. Floors agree across both kernels and the samplers.
4. No policy leaf or leaf reference field outside the G1 tables; `skill_compare` absent.
5. Chapter 1 and the corpus compile byte-identical at base and head, both kernels; generated contracts current.
6. Docs and toolbox row statuses match the code.

## Proof

- (1) `skills_sampler` + reaction `on check_failed` with `fact.assign uses_pick`: Elixir RESERVED_FACT at `reactions/wr.apply[0].fact`; TS loader RESERVED_FACT at `.apply[0].fact`. A reaction `on fact_changed uses_pick` compiles and loads in both.
- (2) Probe cartridge (damage sampler, wight HP 10 with `drops` fang 50 / ash 100, reactions on `entity_died {victim, room}`, `attack_result {hit}`, `fact_changed` cascade, `item_acquired {item}`): seed `[9,10,11,12]` gives roll 0, a silver crit 10, HP 0, fang kept by the dead wight, ash in the corpse, all three facts set; two runs give identical state and decision bytes. Seed `[1,1,1,1]`: HP 5, no death, `hit_seen` only.
- (3) `world.ts:103` 1.44; `cartridge_death.ts:68` and `death.ex:36` 1.43; `cartridge_combat.ts:43`, `combat.ex:44`, `cartridge_skills.ts:81`, `skills.ex:100` 1.44; samplers: loot 1.43, damage and skills 1.44, reactions 1.42, tags 1.0 with `tags@1`. The base loader refuses all five new samplers (UNKNOWN_FIELD `tags`/`drops`, unknown_variant `on.event`/`check.kind`), as the PR body claims.
- (4) `policy.schema.json` ops add only `has_tag`; `LEAF_REFS` and `LeafRefs` agree and `has_tag` is owned by `tags` alone (`capability_registry.json:562`). W1 filters, `growth`, `rating` and `drops` are not leaves.
- (5) 26 base cartridges compiled with base and head Elixir: identical bytes; base artifacts re-encoded by the base and head TS loaders: identical. `elixir bin/contracts.exs --check` exit 0. `invalid.json`: 60 rows added, 2 removed, both now-legal shapes (`item_dropped` trigger, room `tags`).
- (6) The reaction@1 table lists all 22 registered event kinds and `on.event` admits exactly them; subject fields match `reaction.ts` SUBJECT; the 16 schema filters match FILTERS; row statuses G1, G2, 5, G5, 8, W1 read done #351.
- Mutants (focused files): loot `roll >= chance` to `>` caught (`loot.test.ts`); `victim` filter ignored caught (`reactions_sampler.test.ts`); crit `<` to `<=` caught (`damage.test.ts`). Survived: `fact.ts:81` `uses_` ownership clause dropped (`skill_growth.test.ts`, `reactions.test.ts` green); see nit 1.

## Findings

1. nit, `kernel/ts/src/mechanics/fact.ts:81`: the runtime `uses_<key>` ownership guard has no test. Unreachable through loader-accepted content (both compilers refuse the write, above), so defense in depth only; a one-line case beside the `skill_` guard's test would pin it.
2. nit, `kernel/ts/src/mechanics/reaction.ts:77`: `FILTERS[f]!` throws a TypeError, not a KernelError, for a schema filter with no entry. All 16 match today; a parity assertion like `tags.test.ts`'s LEAF_REFS check would keep it so when W-rows add filters.

## Disposition

Mergeable as is; the nits can ride a later slice.
