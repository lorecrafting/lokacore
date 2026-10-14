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

## Recheck of fix round 1 (scoped)

- Exact head `e2d6e3d49201df14a19e3845a00861c2ea654ac3`, diff `f4c6fa32..e2d6e3d4`; the two review-record commits are excluded. Written 2026-10-14 by anthropic/claude-opus-5-5. The original reviewer was not available.
- Verdict: **CHANGES REQUIRED**.
- Hosted CI on the head: `ci` 38633064062 and `book-e2e` 38633063967 are both success.

| Item | Disposition | Proof |
|---|---|---|
| 1 | **Partly fixed.** Two delayed `fact.assign` jobs now share a group. | Red control: drop the shared ops in `job.ts:170-175`. `raid.test.ts:288` fails. |
| 2 | Fixed | The CI above is green. |
| 3 | Fixed for `after`; see R2 for `time_since` | Mutant: per-rule floor skipped. TS fails at `raid.test.ts:433`. Elixir fails at `content_raid_test.exs:57`. |
| 4 | Fixed | Mutant: clamp `+1` dropped. The driver case fails at `raid.test.ts:313`. |
| 5 | Fixed (commit messages) | Read in `2800d87d`. |
| M4 | Holds | Three mutants were run against the mobile test. The writer strips `actor_id`: the test fails at `raid_aftermath.test.ts:42` (`save_corrupt`). The completion row drops `actor_id`: it fails at `:38`. The replay rebuild drops `actor_id` (`invariants_encounter.ts:170`): this one still survives the mobile test, but the kernel invariant tests kill it, as in round 1. |

### Findings

R1. **Blocker (finding 1 not closed).** Two delayed rules that write one status in one advance still fault and wedge the save. Example: `status.apply` and `status.cure` on `shaken`, both with `after`, both due at 1600. They fault `conflicting_write` on the status target, and both jobs stay `[1600, pending]`. Every later wait then faults again. The same pair without `after` composes (`shaken` active, generation 1). `cartridge_delayed.ts:24-27` allows these steps under `after`. The cause: the reaction branch at `kernel/ts/src/mechanics/status/job.ts:170-175` collects `fact.assign` targets only. Ordinary deliveries use the proposal's holder map (`runtime/proposal.ts:246`) instead. Fix: give delayed jobs the same holders, or key every step's target, and add a status-pair case next to `raid.test.ts:278`.

R2. **Should-fix (open item c, extends finding 3).** Elixir and TS disagree on a `time_since` cartridge at kernel_api 1.0. The cartridge has no reactions, so `v2` is nil. Elixir compiles it, because `compiler.ex:106` passes nil trees and `delayed.ex` skips the leaf scan and the int-fact clock check. TS refuses it with `KERNEL_API_RANGE_INVALID` (`cartridge_delayed.ts:31-34`). A rule with `after` cannot reach this path, because any reaction makes `v2` truthy.

R3. **Nit (open item a).** The docstring at `reaction.ts:329-330` says that a step that faults at fire time completes the job. A thrown `KernelError` (for example a durable fact, `reaction.ts:250`) escapes `runDelayed` and leaves the job pending. This is not a new wedge: the same rule without `after` faults the same way, so it is a loader gap that existed before FD1. Fix the sentence.

Open items judged not a finding:
- (b) The fire-time `when` reads no event. The stand-in cause is a `custom_event` with no subject field (`reaction.ts:341-342`), so `subject()` returns the actor's body (`reaction.ts:197-203`). `policy.ts` reads no cause payload, so the read is deterministic and matches the spec.
- (d) `e1_obligations.ts:403` covers Chapter 1 only, and Chapter 1 declares no `after`.
