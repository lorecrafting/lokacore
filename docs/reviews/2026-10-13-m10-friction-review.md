# Review: balance tool 8, refusal and friction report (loka-kgd.107.8)

- Branch `toolbox/m10-friction`, head `dc88896fce50d708d310b2e5f965fd9366c9a30c`, diffed against `b6156e83` (`toolbox/batch-m10`). No PR (batch model). No `kernel_api`, schema, `sim.ts` or `src/` change.
- Governing: [Refusal and friction report](../system/cartridge.md#refusal-and-friction-report-balance-tool-8) (added here), [Measured flows](../system/cartridge.md#measured-flows-balance-tool-2), [study](../rnd/balance-diagnostics-2026-10-11.md) §7 X1, X3 and §13, Beads `loka-kgd.107.8` (brief; PM-accepted departures: `observe` takes a 4th `{command, seed, step}`; acceptance c walks east, west, take, give, scan over 2 seeds; acceptance b over 2 seeds).
- Hosted CI at review time: `ci` and `book-e2e` in progress (`gh run list --commit`; the PM watches it).
- Verdict: **APPROVE WITH NOTES** (no blocker; one should-fix test gap).
- Written 2026-10-13 by the reviewer (Claude Opus 5.5).

## Must be true

1. `flows.ts` changes only by an optional `observe`, called once per stepped candidate after its plain `kernel.step`, refused and accepted; the flows report is unchanged and `checked` still runs only on the accepted one.
2. Every stepped candidate is one command; `per_100` is refused × 100 / commands as a two-decimal string; refusals counted by error code, by the room definition key the player stood in, and by payload type (`perform:<action>` for a cartridge action).
3. Drift runs `gameview_agrees_with_admission` on refused candidates only, on the view before and resolves built as `sim.ts` builds them; `first` holds at most five.
4. X3 from accepted steps: revisits are entries minus one with the start room's first entry counted; a backtrack returns to the room left on the previous room change; a new fact is a new key or a changed value; steps restart at each seed's start or the previous new fact; median null when none.
5. CLI as flows (defaults 16 and 3, exit 2 on bad flag, exit 1 with the diagnostic, canonical JSON); no import cycle (nothing imports `friction.ts`); play files within size limits.

## Proof

- Green at head: `node --test kernel/ts/test/friction.test.ts kernel/ts/test/flows.test.ts` 10/10 (flows tests untouched); `npm run typecheck` (kernel/ts); `node bin/check_ts_size.mjs`; prettier on the four files; `elixir bin/contracts.exs --check`.
- `flows.ts` diff: the `Observe` type, the opts field and its threading `flows` → `run` → `first`; `first` keeps `continue` before `checked`. Nothing else.
- Literals hand-checked from `cartridges/standing_sampler` (square ↔ gate, east/west only; moves pass no time; `gift_apple` on `item_acquired` apple): pace, per hour N refused/E, N refused/W (E skipped), N refused/wait → 6 commands, 3 refused (square 2, gate 1); 4 hours: 24/12/"50.00", square 8, gate 4. Per seed 8 moves, 7 backtracks, square entries 1 + 4, gate 4 → revisits 4/3; 2 seeds 16/14/8/6. Fetch: 5 commands per seed, give at step 4 is the only new fact → 10 commands, count 2, median 4. Drift: SHOWN `move` includes `invalid_state`, east is available in a fresh square → one drift entry.
- Mutants (throwaway worktree, `friction.test.ts`, each restored and checked with `git diff --quiet`):
  - killed: observe after the accepted check (M1); `left` not reset at a new seed (M2); `lastFact` not reset at a new seed (M4); drift check skipped on refusals (M5); `per_100` over accepted commands (M6).
  - survived: M3, see finding 1.
- Real cartridges (default 16 seeds, 3 days): `toolbox_showcase` 4865 commands, 3120 refused ("64.13"; exit_closed, not_found, too_heavy), drift 0, 372 moves, 110 backtracks, 71 new facts (median 9); `ashmere_sampler` 5590/2494 ("44.62"; invalid_state, too_heavy), drift 0. No real-cartridge drift, so no scope trigger. Wall time on a shared box: friction 80 s against flows 52 s (showcase), 22 s against 18 s (ashmere).

## Findings

1. **should-fix** `kernel/ts/test/friction.test.ts:88-93` (code `kernel/ts/play/friction.ts:90`): the "different value" half of the new-fact rule is untested. Mutant M3 (`!Object.hasOwn(was, k)` only, dropping the value comparison) stays green 5/5, because `trust` is not held before the give, so the only new fact is a new key. Scenario: a later edit drops the value comparison; on a cartridge whose facts are already held (a second `fact.adjust` on `trust`, or any fact written at fresh), `new_facts.count` reads 0 and the X3 "steps between new facts" is empty. Fix: one case through `tally().observe` (as test d does) with `before.state.facts` `{trust: 1}` and an accepted `world` whose facts are `{trust: 2}`: count 1, median 1 at step 1; a red control is the M3 mutant.
2. **nit** `kernel/ts/play/friction.ts:20-22`: the non-room fallback in `roomOf` is unreachable in a flows run: every accepted world passes `checked`, whose world invariants include `player_in_one_room` (`kernel/ts/test/sim.ts:41`, "a room of the world"), and flows throws otherwise; a refused candidate's `before` is that accepted world. Scenario: none fails; the fallback would only file a kernel bug under a seed-specific container id instead of crashing. Keep or drop; the commit subject's "keeps the run going" has no case behind it.
3. **nit** `kernel/ts/play/friction.ts:99-103`: `agrees` rebuilds `gameView(before)` and `resolved(before, ...)` for every refused candidate, though all refusals in one step share `before`. Scenario: on `toolbox_showcase` (3120 refusals in 1745 steps) friction takes 80 s where flows takes 52 s. A `WeakMap` keyed on `before` would build them once per step. Optional; the report is correct.
4. **nit** no `/code-review` result is reported in the commits or handback seen by the reviewer (reviewer.md); run it in the fix round.

## Departures

1. `observe(before, p, result, at)` with `at = {command, seed, step}`: accepted (PM). The drift entry needs seed and step, and the delivered `Command` (elapsed payload for a wait) is what the invariant must see.
2. Acceptance c rewritten (give, not take, fires `gift_apple`): accepted (PM); the test comment states why and the M4 mutant kills it.
3. `tally()` exported for the drift test instead of a test-only parameter: accepted; the brief allows "the exported drift function".
4. `agrees` omits `action_key` and `world_context_id`: equivalent to `sim.ts:260-275`, which passes neither an action key nor a context other than the command's.

## Fix round 1 (head `f68c90cb761783f98e6d6466ce8c44a1f8179cfd`)

Scoped to `f68c90c` (`friction.ts`, `friction.test.ts`) and the callers `refusal`, `walk` and `observe`. Green: friction and flows tests 11/11, `npm run typecheck`, `check_ts_size`, prettier.

1. Finding 1 **fixed**: `friction.test.ts:95-112` plants trust 1 to 2 at step 5 and expects count 1, median 5 (gap 5 − 0, hand-checked). M3 rerun is killed by exactly this test.
2. Finding 2 **fixed**: `roomOf` is back to the room's key, with no fallback (`friction.ts:20`).
3. Finding 3 **fixed**, with a new gap: `friction.ts:96-111` caches the view and resolves in a `WeakMap` keyed on the before-world. **should-fix** `kernel/ts/test/friction.test.ts:117-136`: mutant M7 keys the cache on one constant, so the first world's view is reused for every later refusal, and the suite stays green (11/11). The only drift test observes one world. Failure: an edit that keys the cache on the seed or the run checks each refusal against the start room's view. A refused `move west` in gate then finds no west exit in square's view, counts as agreeing, and real drift reads 0, which is the number loka-kgd.107.3 may gate on. Fix: in the drift test, first observe a refusal in square (no drift), then a world in gate refusing `move west` with `invalid_state`. Expect drift 1, room `gate`. M7 then fails it.
4. Finding 4: the PM reports the `/code-review` result; not verified here.

Verdict after round 1: **APPROVE WITH NOTES** (one should-fix, item 3).
