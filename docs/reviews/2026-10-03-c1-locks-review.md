# Review: c1-locks, locked containers (contract-freeze depth)

- PR: [#135](https://github.com/lorecrafting/lokacore/pull/135), branch `c1-locks`
- Commit reviewed: `3d58eff` (CI green)
- Reviewer: fresh Opus `reviewer`, none of the work authored
- Inputs: brief `c1-locks-brief.md` with its PM settlement; plan
  [§3 slice 6](../decisions/owner-decision-chapter-one-plan-2026-10-02.md); spec commit `f816f11` read first
- Verdict: **APPROVE WITH NOTES**

## Requirements written before the diff

1. `take`: held directly → `invalid_state`; custody walks `State.containers` up from the item, and
   every container before the body's room or the body is an item with no barrier or an open one;
   an NPC, a slot holder or a closed/locked lid → `not_present`.
2. `open`/`close`/`lock`/`unlock`: exactly one of `direction`/`target_id`, else `invalid_target`;
   target: no entity `not_found`, not an item `invalid_target`, out of reach `not_present`, no
   barrier `invalid_target`; then the shared `MOVES` and key tail; one `barrier.transition` and
   `barrier_changed`.
3. `has_item` unchanged (a key nested in a held locked chest counts).
4. Loader, both kernels: item reach from the entry; contents in reach only through a barrier that is
   absent, not locked, or locked with its key in reach; never inside an NPC.
   `BARRIER_UNREACHABLE_KEY` at each locked barrier in reach whose key never is (or no `key_item`).
   TS and Elixir reach the same fixpoint.
5. Item barrier: `UNRESOLVED_REFERENCE`; `BARRIER_MISMATCH` when an exit or another item also names
   it; the short ref expands in both kernels.
6. GameView: `state` iff a barrier; `contents` iff no barrier or an open one and it holds an item,
   flattened with `container_id`; verbs listed iff accepted; never in place `actions`; an NPC's
   possessions and a worn item's contents never shown; the invariant extended.
7. No new op, event, refusal or diagnostic code; existing hashes, compiled fixtures and traces
   unchanged; only the four Q2 `invalid.json` edits.
8. No sink, no force.

All eight hold at `3d58eff`, except that requirement 3's spec claim is too strong (F-1).

## Checks done

- **Frozen `invalid.json` edits.** The diff has exactly four `-` hunks. Each one removes only
  `{"path": "/direction", "code": "missing_property"}` from CommandPayload
  `{"type": open|close|lock|unlock, "x": 1}`. This removal is forced by making `direction`
  optional, and no other expectation changed. All other fixture lines are additions (CommandPayload
  `/target_id`, ItemDefinition `/barrier/*`, EntityView `/state`/`/contents/0/*`, ContentView).
  No other fixture in `protocol/fixtures/` is touched except the new `cartridge_locks_hash.json`.
  The `mobile/app` bundle and the traces are untouched. The PR body lists all four cases with
  their old and new errors, and it has the "unchanged" table for #8 (every transcript, the
  Lantern traces, release scope and every `cartridge_*_hash.json`), the sweep (19 mutants, 0
  survivors) and the red controls.
- **Q5 `cartridge.schema.json`.** Description-only: the DiagnosticCode text gains the item cases
  of `UNRESOLVED_REFERENCE`, `BARRIER_MISMATCH` and `BARRIER_UNREACHABLE_KEY`. `protocol/README.md`
  (not in the brief's list) changes only the index row of `entity.schema.json`, adding the item
  barrier and `cartridge_locks_hash.json`. It is a doc pointer, not a contract change, so it is not
  a finding.
- **Fault anchors (`mobile/authority/local-story/faults.test.ts`).** Expected literals changed.
  Details seed 293 → 1716, and its answer changed from `wait until 3600` → clock 3600 to
  `wait until 1` → clock 1, `wait until 1` again → `invalid_state`. Dusk seed 88 → 240. The new
  answers come from the spec, not from the code: wait-until-N sets the clock to N when N is later
  than now; otherwise the result is `invalid_state`. The PM ruled the remap OK (c1-equipment
  precedent).
- **Sim bound 4→5 (`kernel/ts/test/sim.test.ts:192`): justified.** I reran the planted bug ("drop
  puts the item inside itself") at generator 8. The first failing seed is 3, shrunk to 5: `move
  north`, `move east`, `move east`, `take`, `drop`. That is `lantern_proof`. From
  `cartridges/lantern_proof`, the entry `landing`'s west exit is `old_gate` (keyed), and the only
  item, `lantern`, lies in `shelter`, reached by landing→green→reed_bank→shelter: 3 moves. So 5 is
  that cartridge's minimum, not a slack in the shrinker. Other seeds still shrink to 2-4 (seeds
  7, 9, 12: 2; seed 10: 4).
- **Code mutants, run on the full suite in a throwaway detached worktree: 10 of 10 red.**
  - `reach` checks only the direct container: the chapter walk fails.
  - An NPC is treated as transparent: the chapter walk fails.
  - `reach` treats a closed lid as open: the chapter walk and the GameView test fail.
  - `barrier.ts` `itemBarrier` skips `reach`: the shapes test fails.
  - TS `lockout` puts a locked chest's contents in reach (the own-key case): the loader test fails.
  - Elixir `starts_in?` drops the `passable?` check (the own-key and cycle cases):
    `content_locks_test` fails.
  - Elixir `sites` drops items (the cycle is unreported): `content_locks_test` fails.
  - Container verbs are listed without `usable`: the walk, the GameView test and sim
    `gameview_agrees_with_admission` fail.
  - `open` is listed on a locked chest (a listed verb that step refuses): the same three fail.
  - `inside` shows the contents of a closed box: the walk, the GameView test and sim
    (`not_present`) fail.
- **Schema mutants: 2 of 2 red.** Dropping `container_id` from ContentView `required` fails
  `contracts_test` (invalid fixtures). Dropping its `additionalProperties: false` is refused by the
  schema-subset compile.
- **TS/Elixir agreement.** The cycle, own-key, keyless and keyed cases and the exit-behind-chest
  case have twin literal answers in `locks.test.ts` and `content_locks_test.exs`. The cross-kernel
  compile includes `ashmere_locks`. Neither loader puts NPC holdings in reach. Both compare expanded
  refs (the Elixir `exits` reciprocal check already relies on that).
- **Baseline:** the TS suite passes and `mix test` passes (237).

## Findings

**F-1 (should-fix)** `docs/system/mechanics.md:48` and `kernel/ts/src/rules/barrier.ts:11`
both say "never a lockout". That is false for content the loader accepts.
Scenario (run on `3d58eff`, artifact changed so that `brass_key` starts inside the trunk and
`trunk_lid` starts `closed`): the loader accepts it, because its own key in a closed chest is
valid content. Then `up`, `take trunk` → `taken`, `lock trunk` → `locked` (the key counts through
`has_item`), `drop trunk` → `dropped`, `unlock trunk` → `not_owned`, `open trunk` →
`exit_locked`, `take brass_key` → `not_present`. The trunk stays locked for good. The limit
itself is acceptable: no content in the plan has a lockable chest that holds its own key, and
`put` is LATER. Fix: replace "never a lockout" in both places with the real limit (dropping a
chest locked on its own key strands it), and add a carry with a trigger to the ROADMAP C1 row
(for example "the first content with a lockable container that can hold its own key").

No other findings. I checked these points and accept them:

- the `reach`/`opened` placement in `lookups.ts`;
- the `[open, take]` listing;
- the extra ROADMAP clause (target resolution overflow) for nit #25;
- the barrier-only container-verb filter;
- the fault seed and anchor remap (generator 8);
- nested containers listing their verbs (PM ruling 2).

No over-engineering found. There is no mechanic-to-mechanic naming beyond barrier@1 and
containment@1, which the spec requires.

## Audit SHAs (Gate C1 custody/reachability)

At `3d58eff`: `kernel/ts/src/lookups.ts` (holds `reach`/`opened`), `kernel/ts/src/rules/containment.ts`,
`kernel/ts/src/rules/barrier.ts`, `kernel/ts/src/cartridge_barriers.ts`, `lib/loka/content/barriers.ex`.

## Codex Sol review

Codex Sol review: appended by the PM.
