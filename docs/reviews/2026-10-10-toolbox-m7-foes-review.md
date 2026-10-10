# Review: toolbox row 6c, several foes with a pack plan (loka-kgd.66)

- Local branch `toolbox/m7-foes`, head `ea0d9498bf63d00277f9af45781ca6296960bb7d`, base `origin/toolbox/batch-m7` `bd11228f` (7 files). No PR (batch M7 draft later). Kept as a record because it adds a randomized kernel differential and changes the encounter ActionSet ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)); the brief asked for one.
- Governing: [row 6c rules](../system/mechanics.md#several-foes-with-a-pack-plan-toolbox-row-6c), [row 6a rules](../system/mechanics.md#target-choice-in-the-same-room-toolbox-row-6a), [C4 pack contract](../system/mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract), [6a review](2026-10-10-toolbox-m7-targets-review.md) carries, brief in Beads `loka-kgd.66`.
- Hosted CI on the head: ci and book-e2e green (`gh run list --commit`).
- Verdict: **APPROVE WITH NOTES** (two nits).

## Must be true

1. Two goblins of one pack plan both strike the player through the C4 pack round in `targets_sampler` (not one attack per foe per round); no new rule, field or API bump.
2. 6a carry: the round job's definition ref stays valid on a switch because a roster cannot mix definitions.
3. 6a carry: the Attack offer counts only members still here (living, in the encounter room); a single present member gives today's ActionSet; Chapter 1 (no opt-in) unchanged.
4. 6a carry: a randomized differential runs both kernels on the same encounter/pack ops, checks the compose invariants, is seeded, and detects a kernel divergence the literal tests miss.
5. 6a pins still distinguish switch from no switch after the goblins hit.

## Proof

- (1) Probe on the compiled sampler (scratch, not committed): rounds 1-4 player HP 10, 9, 8, 8, 7; `next_opponent_id` alternates a, b, a; in round 3 goblin a dies to the player's blow before its turn; in round 4 b strikes. Both strike, one per round, on one plan. Goblin role: bundle without `member_role` gives `hound`, so `admission` (`behavior.ts:12`) admits them.
- (2) `PopulationPlan.bundle` is one ref, `PopulationBundle.npc` is one ref; `admission` requires `same(member.by, origin.by)`. Note at `mechanics.md:2053` is accurate; `round.ts:75` stays safe for 6c; 6b must re-point the job.
- (3) `actions.ts:166` gated by `target_choice` first; Chapter 1 runs green: TS `e1`, `e1_creatures`, `e1_night_marsh`, `hounds`, `cartridge`, `c4_pack`, `targets` (117/117); Elixir `content_missing_child_test` (Chapter 1 hash pin, 11/11), `content_test`, `cartridge_cross_kernel_test` (26/26).
- (4) `c4_pack_composition_test.exs:56`: 300 cases, `:rand.seed(:exsss, {6,6,6})`, all six invariant ids asserted in Elixir and recomputed by `differential_peer.ts`, outputs compared canonically; 194 ms. Red control rerun: `compose_pack.ts:60` and `:62` ignoring `writer_group` leaves 11 TS literal files green (72/72: `c4_pack*`, `c4_schema_contracts`, `compose`, `encounter_composition`, `hounds`, `population_composition`, `targets`, `combat`, `combat_flee`) and fails the differential on the canonical `theirs == ours` assert (a real divergence, not a peer exit). Literal fixture tests stay the primary oracle, so this differential is not the only comparison.
- Mutants, all killed: `actions.ts:167` raw count (targets 1 fail); `> 1` to `> 0` (2 fail); `eligible` drops `living` (c4_pack 1 fail); `retarget` always undefined (targets 2 fail); rotation `next` frozen (c4_pack 3 fail, targets 1 fail).
- (5) The 6a switch test still reads [4,6] without the switch and [6,4] with it (in the probe and the retarget mutant).
- Pushed-back `/code-review` items: all six accepted. (a) No sampler strike test: the probe shows striking; rotation is pinned in C4. (b) Primary gone and one member left: `resolved` drops Attack, the next round repairs the primary, spec says a single-foe fight keeps today's set. (c) Living half: shared `eligible`, killed by c4_pack. (d) Duplicated peer call, (e) loose floor (`:91`, seeded), (f) flight at 25%: accepted as stated.
- Trial merge onto batch `85d1526b`: code merges clean; only `docs/toolbox.gen.json` conflicts.

## Findings

1. nit, `docs/toolbox.gen.json`: conflicts with batch head `85d1526b` (G6 + main). Regenerate it when you sync the batch; do not hand-merge.
2. nit, Beads `loka-kgd.66` handoff: "would duplicate 10 failing C4 tests". The run does not back this number. When rotation is frozen (`behavior.ts` `next` returns `ids[0]`), 3 of the 10 `c4_pack.test.ts` tests fail. The decision still holds, because 3 kill it. Correct the number in the batch PR body.

Open: Book wording still `loka-x6t.14`; 6b must re-point the round job on a switch.
