# Review: toolbox row W22 fire and reaction barrier.set (loka-kgd.100, loka-kgd.96)

- Branch `toolbox/m8-fire`, head `1d97e77e56fabe51d2a6ffe5b07bb394516916e6`, against base `toolbox/batch-m8` `697ae0a2` (42 files). No PR (batch model). Contract slice: `ReactionRule` gains `barrier.set` and `status.apply.tag`, kernel_api 1.56.
- Governing: [Fire](../system/mechanics.md#fire-toolbox-row-w22), [reaction@1](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts), [cartridge floors](../system/cartridge.md), toolbox row W22, PM decisions in Beads `loka-kgd.100`.
- Hosted ci and book-e2e green on the head (`gh run list --commit 1d97e77e…`, reviewer).
- Verdict: **CHANGES REQUIRED** (one blocker, one should-fix, two nits). The code passed every probe; the blocker is missing tests.

## Must be true (written before the diff)

1. `barrier.set`: exactly one of `barrier` or `tag`; `tag` reaches only barriers on exits of the event's room, each once; a barrier already at `to` gets no write.
2. Each move goes through legal steps (locked, closed, open), each one a `barrier.transition` and a `barrier_changed`, and reads the proposal so far.
3. Two reaction writes to one barrier in one advance share a writer group. A reaction write after the root command's own write faults `conflicting_write` and commits nothing.
4. `co_present` with `tag` lands on tagged items lying directly in the event's room, and on no carried items. `immune` holds, once per holder.
5. Both kernels refuse floor 1.55 and `to: locked` on a keyless barrier (named or tagged), with the same codes at matching paths.
6. The spread ends (`spent`). 65 burnables fault `budget_exceeded` and commit nothing.
7. The row pins hold: fire opens an unnamed door, water cures, smoke shows next door. The showcase changes only by the fold's new exit.

## Proof

- Baseline green: the 7 named TS files, `npm run typecheck`, and the 3 Elixir files.
- Probes run in a throwaway test, not committed:
  - A later rule re-closes the door the spread opened in the same advance: accepted (join works).
  - A rule closes the door the player just opened: `conflicting_write` on the barrier (the documented limit).
  - Kindling the player carries does not catch.
  - A door tagged `wooden` but not `burnable` stays shut.
  - TS refuses an unknown `barrier` (UNRESOLVED_REFERENCE at `.apply[1].barrier`).
- Mutants killed:
  - TS: a direct jump from locked to open; `co_present` ignoring `tag`; the loader's tag lockout.
  - Elixir (`--force`): the `tag` floor clause, the tag lockout, the named lockout, the exit walk.
- Claims checked: `created_jobs` is 64 (`composition-profile.json:12`), and the budget test asserts `limit === 'created_jobs'`. `itemsTagged` is at `lookups.ts:28`.

## Findings

1. **blocker**: three narrow mutants stay green on `showcase_fire`, `writer_groups`, `npc_status`, `elements` and `use`. Each one is killed by a short probe.
   - `kernel/ts/src/mechanics/barrier/react.ts:34`, `holders.get(row) ?? group` changed to `group`. Failure: a later rule (in the same advance) that moves the door the spread opened faults the whole wait `conflicting_write`. The brief and `mechanics.md` Fire both claim this join.
   - `kernel/ts/src/mechanics/lookups.ts:35`, the `rooms.includes(containers[id])` filter dropped. Failure: kindling in the player's pack, or in another room, catches fire.
   - `react.ts:55`, the barrier tag filter dropped. Failure: a door that is not `burnable` (iron, or wooden only) opens on the first tick. This breaks the row pin.
   - Fix: three assertions in `showcase_fire.test.ts` on cloned content, as in the probes above.
2. **should-fix**, `kernel/ts/src/content/cartridge_reactions.ts:120`: if `named(s.barrier, …)` is deleted, `showcase_fire`, `validate` and `elements` stay green. The loader then accepts `barrier: gate` (run: `ok`). The Elixir twin has this row (`content_showcase_test.exs`, UNRESOLVED_REFERENCE); the TS "twin" test does not. Fix: add that row to the TS loader test.
3. **nit**, `react.ts:35`: no test covers the per-rule `doors` memo. With `doors.get(row) ??` removed, the suite stays green. It matters only when one rule has two `barrier.set` steps on the same barrier.
4. **nit**: no PR body reports the developer's `/code-review` (batch, no PR). Commit `53dbb434` is titled self-review.

## Not findings

- Elixir and TS path formats differ by design, as for KERNEL_API.
- The `tag` floor of 56 touches only `status.apply` and `barrier.set`: no other apply variant has a `tag` property (schema walk).

## Re-check at 64e5ebc7 (fix commit only)

- Commit `64e5ebc7787be554c7881ab41a4f7c822f784f20` (test-only, `kernel/ts/test/showcase_fire.test.ts`). Hosted ci and book-e2e green on it (`gh run list --commit`, reviewer). `npm run typecheck` exit 0; `showcase_fire` 11/11 on the head.
- Verdict: **APPROVE WITH NOTES**.
- Dispositions, each mutant re-planted alone, run on `showcase_fire.test.ts` only; each fails exactly one test, the new assertion:
  - 1a `react.ts:34` `?? group` dropped: `not ok 11`, `showcase_fire.test.ts:274` (wait `fault`, expected `accepted`). Fixed.
  - 1b `lookups.ts:35` room filter dropped: `not ok 9` (kindling in pack / `the_fold`). Fixed.
  - 1c `react.ts:55` tag filter dropped: `not ok 10` (`wooden` door opens). Fixed.
  - 2 `cartridge_reactions.ts:120` `named(s.barrier…)` deleted: `not ok 7`, `:206` (actual `ok`). Fixed.
  - 3 `react.ts:35` `doors.get(row) ??` dropped: `not ok 11`, `:276` (laterStep `open`). Fixed.
  - 4 `/code-review` items: PM accepted as known limits, `loka-kgd.103`. Closed.
- `zz_reclose` ordering: renaming it to `aa_reclose` turns test 11 red at `:274` (door `open`), with or without mutant 1a. A rename cannot weaken it silently.
- **nit**, `showcase_fire.test.ts:263`: the comment says "a later rule" but not that rule order is key order, so `zz_` is load-bearing. Failure: a rename that sorts before `fire_spreads` gives a red test whose cause is not obvious. One comment line fixes it; no re-check needed.
