# Second opinion: hs-9 Built rooms S5, raze and tombstone (loka-otn4; save)

- Branch `toolbox/hs-9`, exact head `b5bb63a9be0e3b3955add37d6dff0f399679848c`, base `0bd63713`. No PR (batch model); the handback reports `/code-review medium` clean on the range.
- Governing: [save.md Built rooms](../system/save.md#built-rooms), [mechanics.md S5](../system/mechanics.md#built-rooms-s5-raze-and-tombstone), [protocol.md](../system/protocol.md), [storage lessons](../lessons/storage.md), [Review stance](../WORKFLOW.md). First review: [2026-10-15-hs-9-review.md](2026-10-15-hs-9-review.md); its rule review is not redone.
- Verdict: **APPROVE WITH NOTES** at b5bb63a9 (no blocker, no should-fix; one nit).
- Written 2026-10-15 by anthropic/claude-opus-5-5.

## Must be true (written before the diff)

1. `built.set` refuses a stale `expected` (null when absent) or an entity that is not a built created row (an earlier `entity.create` counts), in both kernels.
2. The `built` section persists through the generic row writer and the generic `state_row` load.
3. Load is `save_corrupt`, file unchanged, for: a non-`BuiltRow`, `razed_at` after the clock, a row on a non-built entity, a `containers` row into a razed room.
4. Hydrate: a razed room has no exits; the site exit goes only while it leads to the razed room, independent of row order.
5. Replay, failed COMMIT and lost ack: one tombstone, one move, one charge.
6. A raise after a raze survives cold reopen.
7. A corpse in a hut must not block its raze without the spec saying so.

Holds: 1 (`compose_built.ts:10-16`, `compose_built.ex:5-9`, fixture 6 cases), 2 (`rows.ts` `built: 'built'`; `store.ts:121-122`), 3 (`created.ts:44-47,197-213`; load only, `created.ts:47`, and no commit invariant covers it. No in-session write reaches a razed room, though. Every transfer destination is an authored room (schedule, population area, crow corridor, transport, shrine), the actor's current room or holder, or a room reached through an exit, and a razed room has no exits and none leads to it), 4 (`created.ts:167-169,182-191`: `raise` writes no site exit for a razed row and `raze` runs after the derive loop, so row order cannot matter), 5 (mobile `built.test.ts:371-411`; `pick` omits `resources`, but the header's "second charge" still holds: the failed mode asserts the rows are unchanged before the retry (`built.test.ts:357`) and the lost mode asserts `replay` (`:361`)), 6 (`built.test.ts:478`). 7: see N1.

## Test the tests (scratch worktree, focused files, each reverted; tree clean after)

| Mutant | Kernel `built.test.ts` | Mobile real SQLite `built.test.ts` |
| --- | --- | --- |
| M1 drop `razed_at <= clock` (`created.ts:208`) | red (forged tombstone) | green |
| M2 `raise` writes the site exit for a razed row (`created.ts:169`) | red | red (raised where razed stood) |
| M3 drop `built` from `rows.ts` SECTIONS | red | red (3 tests) |
| M4 drop the containers-into-razed check (`created.ts:210`) | red (forged tombstone) | green |
| M5 (reconfirms first review M4) Elixir `expected` check off (`compose_built.ex:6`, `mix test --force`) | `built_test.exs` red `stale-expected-refused` | n/a |

Claims rerun: (a) handback "mobile per-check forged red controls survive (kernel test kills)": M1 and M4 confirm it. `store.ts:126-129` runs `hydrate(..., true)` before `receiptRecovery`, and recovery refuses the same forged files. (b) "stale `expected` is `precondition_failed` in both kernels" (mechanics.md S5): M5 confirms it for Elixir; the first review's M3 confirms it for TS.

Decision, mobile direct check-level test: **not required.** In kgd.108.14 the check had no direct test in any layer. Here `kernel/ts/test/built.test.ts:614-632` drives the same `hydrate(fresh, state, true)` that the load calls. It has one mutation per check and an unforged control at `razed_at == clock`, which also catches a `<` off-by-one. The mobile test pins the end-to-end property (save_corrupt, file bytes unchanged), and its header names the kernel test as the per-check control. One test per break per layer is met.

## Findings

- **N1 nit** `docs/system/mechanics.md:3389`: Known limits does not say that a corpse blocks the raze for good. Corpses are immovable (`created.ts:20-25`), corpse decay does not exist (`mechanics.md:2837`, Beads `loka-kgd.122`), and recovery keeps the empty corpse (`book-ui.md:923`). Scenario: in a death@1 cartridge the owner dies in their own hut and recovers the contents. Every later raze is then `service.occupied`, with nothing that ever clears it. A dead spawned hound cannot reach a hut (`houndValid` keeps hounds in plan rooms, `created.ts:105-120`), and death leaves its corpse in the victim's room (`death/sequence.ts:51`), so the player's own corpse or an escorted NPC's corpse is the case that can happen. Fix: one known-limit line that links `loka-kgd.122`.

Out of save scope: the brief's GameView-schema clause (view tests) is left to the first review. No item loop change beyond the first review's (fee only; contents conserved).
