# Second review: corpse decay save and delta contract, PR #593 (loka-kgd.203)

- PR [#593](https://github.com/lorecrafting/lokacore/pull/593) `death/corpses` at `0f4f1ac497fd0bf21cb5674d7d8a400f10832838`.
- Scope: save, delta-contract and reconciliation side ([WORKFLOW review count](../WORKFLOW.md#review-count)): `job.schedule.corpse_id`, the decayed exemption into consumed, decay jobs from the death sequence, re-recorded fixtures and saves. Not Book UI.
- Governing: [mechanics.md death@1 decay](../system/mechanics.md), [cartridge.md Corpse decay declarations](../system/cartridge.md), [owner decision](../decisions/owner-decision-corpses-respawn-2026-11-02.md), [storage lessons](../lessons/storage.md), [contracts lessons](../lessons/contracts.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): graph-diff success; ci and book-e2e queued.
- `/code-review medium` is reported in the PR body. `bin/mutate_diff.sh` not rerun (the author's run timed out at 66 of 72); six narrow mutants below.

## Must be true (written before the diff)

1. A cartridge without decay settings schedules no job and keeps its hash; an old save is refused, not deleted or retargeted.
2. TS and Elixir compose and invariants agree on `corpse_id` binding and the decayed exemption; the schemas carry the field.
3. Every legal elapsed command that runs a decay ends in one state; a retry or replay does not spill twice.
4. Only a death-origin corpse leaving a room can enter consumed without consumption.
5. Each new persisted field gets a forged-row red control (storage.md:20).

## Checks that held

- (1) Only `toolbox_showcase_hash.json` changed among hash fixtures. A save pinned at 1.151 gets `pinned_release_missing` (`authority.ts:100`), so it is refused and not deleted.
- (2) The bindings and `decayed` agree between `compose.ts:277` / `compose_food.ex:28` and `invariants_food.ts:13` / `invariants_food.ex:36`. `delta.schema.json` adds `corpse_id`; `gameview.schema.json` adds `victim`.
- (3) `mobile/.../corpse_decay.test.ts` passes. Dropping the spill turns 3 tests red.
- Mutants: the TS room-source check is red in 5/1; the Elixir compose and invariant room-source checks are red in 1/2 each.
- PR claims rerun: the `compose.ts:276` cite holds (277). The `death/job.ts:105` cite does not: the file has 53 lines.

## Findings

**should-fix** `kernel/ts/src/foundation/compose.ts:279` (and its twins `invariants_food.ts:15`, `compose_food.ex:30`, `invariants_food.ex:38`): `decayed` reads the base state's `created`, not the corpse the same proposal creates.
- Repro: showcase `sapper_cellar` with a killing blow; attack; then one elapsed from 25200 to 45200. The second goblin dies in a round job at 25350, its decay falls due at 40350, and the corpse-to-consumed transfer (op 30) faults `precondition_failed`.
- Control: without `npc_corpse_decay`, the same span is saved.
- The shipped driver hides this today, because `elapsed.ts:67` `boundary` stops at every due job. Any host that sends a wider span loses the whole advance, every time.
- Fix: resolve the origin through the proposal's `entity.create` ops. Add one test of a death and its decay inside one advance.

**should-fix** `mobile/authority/local-story/store.ts:144` `restorable`: nothing validates a decay job row.
- Repro: rewrite the saved row's `corpse_id` to the player body. Reopen gives `open`. Every elapsed that reaches the job's due time then faults, so the clock is stuck for good.
- storage.md:20 asks for a forged-row red control per new field.

**nit** `kernel/ts/src/mechanics/death/job.ts:35`: with `!world.rooms[room]` dropped the tests stay green, so the spec's "a corpse not in a room only completes" is untested.

**nit** `compose.ts:278`: with `op.consumption === undefined` replaced by `true`, every decay test stays green.

**nit** `lib/loka/core/invariants_encounter.ex:263`: it accepts `corpse_id: nil`, which compose refuses (`compose_encounter.ex:267`). The schema forbids nil.

**nit**: the PR body cites `death/job.ts:105`, a line that does not exist.

## Verdict

CHANGES REQUIRED (two should-fix).
