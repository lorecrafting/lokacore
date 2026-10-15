# Second opinion: hs-1 replenish.run root-command join (loka-5m0u)

- Branch `toolbox/hs-1`, exact head `940f43d8`, base `toolbox/batch-homestead-a` `14af9f33`. No PR (batch model). Scope: the fix round 1 `proposal.ts` change (`moverGroups`, `proposal.ts:90`, `:250`) and its use in `replenishStep` (`job.ts:93`). The second opinion is required because the change touches `kernel/ts/src/runtime/proposal.ts` ([WORKFLOW Review count](../WORKFLOW.md)). First review: [2026-10-15-hs-1-review.md](2026-10-15-hs-1-review.md).
- Governing: [Replenish on an event](../system/mechanics.md#replenish-on-an-event-homestead-hs-1) Step bullet ("or in the root command's group for an item the root command moved"); [row 41 Known limits](../system/mechanics.md#decay-toolbox-row-41) (root writes).
- Verdict: **CHANGES REQUIRED** (one blocker).
- Written 2026-10-15 by anthropic/claude-opus-5-5.

## Must be true (written before the diff)

1. A step's write of an item that the root command moved goes into the root's group, whatever other rules ran first in the command.
2. Two different writers of one row in one advance still fault: an `item.move` after a root move still faults, and a stale source still faults.
3. `roots` is a pure function of the root's ops, so reopen re-decides the same proposal and receipt.
4. One advance equals stepped advances. Timed jobs and existing movers are unchanged.
5. No new save row, sampler hash or changed expected answer. Elixir compose accepts the same delta.

Items 2 to 5 hold. Item 1 fails.

- (2) Joining a group only skips the group check. The source check still catches a stale write: `[RUN, RUN]` faults `precondition_failed` (first review). The root-move-then-`item.move` case still faults, as the documented limit says (`mechanics.md:2787`).
- (3) `moverGroups(root.delta.ops)` (`proposal.ts:90`). Reopen re-decides accepted receipts through `step` (`world.ts:125`).
- (4) No root moves an item and also advances time: no recipe emits `entity.transfer`, and the root of a wait has only `time.advance`. So `roots` is empty on every job path.
- (5) The fixture diff only adds cases to `invalid.json` and changes the `loader_floors.json` description. `compose.ex:94` uses the same last-writer rule.

## Findings

1. **Blocker.** `kernel/ts/src/mechanics/containment/job.ts:93` reads `holders.get(item) ?? roots?.get(item) ?? group`. `holders` is keyed by entity, not by row. A `status.apply` on the item records the status row's group under the item's id (`status/shared.ts:286-290`). `replenishStep` then writes the item's containment row in that group, but the root already wrote that row in group 0. Compose faults (`compose.ts:66-72`).
   - Probe: on decay_sampler (floor 1.101), add `toss {items [rag], from market, to midden, cap 1, count 1, every 99999}` and a copy of `litter` (`item_dropped rag`) that applies `replenish.run toss`. Take the rag, then Drop it.
   - If the rule is named `a_toss`, the Drop is accepted and the rag is in the midden. If it is named `z_toss`, the Drop faults `conflicting_write` and nothing commits.
   - The result depends only on the rule's key, and it contradicts the Step bullet.
   - Mutant m1 (below) survives the focused suite.
   - Candidate fix for the developer to confirm: `roots?.get(item) ?? holders.get(item) ?? group`. Any later write of the containment row in another group already faults, so the root's group is the row's last writer. With this order, both probe orders pass and so do replenish, decay and compose (35 of 35).
   - Add the probe as a test. No hs-2 to hs-4 brief has this shape: their status targets are the furrow and the hens, not the moved item.
2. **Question.** `proposal.ts:90`: `roots` is not in the maps that `merge` and `joinEarlier` relabel (`status/job.ts:193`, `proposal_hours.ts:82`). If a future root both moves an item and advances time, a job could merge group 0 away. `roots` would then be stale. No such root exists today.

## Mutants (worktree at 940f43d8, reverted; replenish, decay and compose tests)

| Mutant | Result |
| --- | --- |
| m1 `job.ts:93` roots before holders | **survives** (finding 1) |
| m2 `job.ts:101` `o.writer_group + 1` | sweep test (`replenish.test.ts:310`) fails |
| m3 `proposal.ts:90` `root.delta.ops.slice(1)` | sweep test fails |
| m4 `job.ts:101` filter `!== 'entity.transfer'` | sweep test fails |

Cites rerun: `replenish.test.ts:284` (DUPLICATE_DEFINITION test), `:310` (sweep, fails under m2 to m4) and `decay.test.ts:273` (two runs) are all backed. The baseline is 35 of 35 green.
