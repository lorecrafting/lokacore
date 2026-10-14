# Review: FD1 delayed reactions and the time_since leaf, main review (loka-kgd.138)

- Branch `toolbox/m12-delayed`, exact head `f4c6fa325d9a112053fde28c5b53d151c8d6d596`, base `e78a8629`, kernel_api 1.88. No PR (batch model).
- Governing: Beads `loka-kgd.138` brief, approved design and PM rulings; [Delayed reactions](../system/mechanics.md#delayed-reactions-toolbox-row-fd1) (spec on the branch); [mechanics lessons](../lessons/mechanics.md); [storage lessons](../lessons/storage.md); [reviewer stance](../../.claude/agents/reviewer.md). A save second opinion runs separately; not coordinated.
- Verdict: **CHANGES REQUIRED**.
- Written 2026-10-14 by anthropic/claude-opus-5-5 (main review).

## Must be true

1. A delayed job is never due inside the wait that schedules it, and runs at most once per schedule.
2. At fire time the rule's `when` is read again for the stored actor; nothing reads `world.character`.
3. A delayed job that cannot run completes, so no later advance is wedged (spec Fire bullet, `docs/system/mechanics.md:2881`).
4. A cold reopen with a pending delayed job fires it once, and receipt replay rebuilds the row with its `actor_id`.
5. Both loaders apply the same 1.88 floor and refuse the same event-bound steps under `after`.
6. Chapter 1 hashes do not change.

## Findings

1. **Blocker. Two delayed jobs that write one fact in one advance fault `conflicting_write`, and the fault wedges every later wait.** `kernel/ts/src/runtime/proposal.ts:283-310` gives each due job a fresh writer group and remaps all of its ops (`handoffGroup`). Only status jobs join `p.holders` (`statusGroup`). Ordinary reactions share holders (`proposal.ts:246`), so the same two rules without `after` give `aftershocks` 2. Probes on the raid sampler, with a copy of `aftershock` named `aftershock2`:
   - Both jobs due at 1600, hourly waits to 1700: fault `conflicting_write` on fact `aftershocks`. Both jobs stay pending, so every wait past 1600 faults again.
   - `after` 600 and 700, one wait to 1800: fault. The same history in hourly steps gives 2, so the result also depends on how the wait is chunked.
   The fault comes from compose, outside `runDelayed`, so its fault-completes path (`kernel/ts/src/mechanics/reaction.ts:344-348`) never catches it. This breaks must-be-true 3. I did not check whether the Elixir twin does the same.
2. **Blocker. Hosted CI is red at the exact head** (run 38626260705). `kernel/ts/test/raid.test.ts:320` fails typecheck with TS2352. `lib/loka/content/checks.ex` has 452 lines against an allow of 450 (`bin/check_size.exs`).
3. **Should-fix. The 1.88 floor differs between the kernels.** A rule with `after` and `apply: []` at 1.87: the TS loader refuses it (`KERNEL_API_RANGE_INVALID`), but Elixir compiles it. `lib/loka/content/delayed.ex:70` finds `after` only by scanning the flattened steps, so a rule with no steps is never seen. Fix: check `after` per rule.
4. **Should-fix. The Sampler bullet's clamp claim is not true through the real driver** (`docs/system/mechanics.md:2899`). One wait to 1900 fires `raid` at the wait end (row 37a), so `raided_at` is 1900 and the job is due at 2500, not 1901. Then a wait to 2000 leaves `aftershocks` 0, not 1. The clamp test at `kernel/ts/test/raid.test.ts:279` calls `sequence` directly. Fix: correct the sentence, or pin it with a driver-level case.
5. **Nit.** No `/code-review medium` result is reported (there is no PR, and the Beads notes do not give one).

Note, not a finding: one long wait and hourly steps give different results ([1, 0] at 2100). The cause is 37a's raid firing at the wait end, which existed before FD1, and FD1's fire-time `when` then cancels the job as the spec says. See loka-kgd.151 and loka-kgd.152.

## Checks

- Focus items that hold: the job's actor is `row.actor_id` and `reaction.ts`/`policy.ts` read no `world.character` (must-be-true 2). `mobile/authority/local-story/raid_aftermath.test.ts` passes (must-be-true 4). `cartridge_cross_kernel_test.exs` and `content_raid_test.exs` pass, with 5 tests (must-be-true 6).
- Mutants, each in this detached worktree and reverted:

| Mutant | Tests | Result |
|---|---|---|
| M1: `reaction.ts` clamp `clock + 1` changed to `clock` | `raid.test.ts` | killed |
| M2: fire-time `when` skipped when `fired` | `raid.test.ts` | killed |
| M3: `policy.ts:68` `>=` changed to `>` | `raid.test.ts` | killed |
| M4: replayed reaction row drops `actor_id` (`invariants_encounter.ts`) | `encounter_composition`, `encounter_bleed_jobs` | killed (it survives `raid.test.ts` and the mobile test) |
