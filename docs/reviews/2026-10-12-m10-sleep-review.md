# Review: toolbox row W9, sleep (loka-kgd.119)

- Written 2026-10-12 09:44 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).
- Branch `toolbox/m10-sleep`, head `0b109368f0d1625ace4f67b0fa98ebade7f633c4`, diffed against `8ce408ac` (`toolbox/batch-m10`). No PR (batch model). Installed `kernel_api` 1.76.
- Governing: [position@1](../system/mechanics.md#position1-kerneltssrcrulespositionts), [Sleep](../system/mechanics.md#sleep-toolbox-row-w9) (added here), combat@1 encounter mode and rounds, [G11 disposition](../system/mechanics.md#standing-and-disposition-toolbox-rows-15-and-g11), Beads `loka-kgd.119` (brief; PM provisional owner question: Sleep provokes; PM approval: dream as a line-showing `rested` reaction).
- Hosted `ci` and `book-e2e` in progress on the head at review time (`gh run list --commit`); the PM watches them.
- Verdict: **APPROVE WITH NOTES** (no blocker; one should-fix).

## Must be true

1. A sleeper's ActionSet keeps only the position verbs, look, wait and modal answers; every other command it sends is `invalid_state`, through the one admission query shared by the GameView and execution.
2. In an open encounter both filters apply: a sleeper is offered Stand and Look only.
3. Sleep advances no clock.
4. Only an accepted Sleep calls G11 `engage`, in the same proposal and writer group; Rest and Sit do not; one test names the call.
5. Sleep emits no `rested`; Ashmere's position transcript replays unchanged.
6. No new import cycle and no growth of the `permits` cycle (loka-g53x).

## Proof

- Green at head: `node --test` sleep, standing, position, status_readers, water, transcripts (42 pass); `npx tsc --noEmit` in `kernel/ts`; `ast-grep test` (21 pass) and `ast-grep scan` of `position/rule.ts`.
- Cycles: a strongly-connected-components pass over the value imports of `kernel/ts/src` gives the same seven cycles at base and head (the `permits` one still six modules). `position/shared.ts` is in none; `position/rule.ts` is imported only by `runtime/world.ts`, which is in no cycle.
- Writer group: the `engage` ops (`opened`, `kernel/ts/src/mechanics/disposition.ts`) and the position ops (`fact.ts:88`, `resource.ts:98`) all carry group 0, as the amended position@1 sentence says.
- Mutants (sleep, status_readers, position, standing, water tests; files restored and compared):
  - no `engage` on Sleep: 2 fail (provoke, first bite);
  - `engage` on Rest and Sit too: provoke test fails;
  - no sleeper filter: allow-list test fails;
  - sleeper filter placed ahead of the modal/wait clause: position.test fails (Wait while asleep);
  - allow list cut to Stand: 3 fail;
  - `look` dropped from the allow list: **all green** (finding 1).
- Scratch probe (deleted): in the provoked fight the sleeper is offered `["stand"]` only; Flee `invalid_state`; Look `unsupported_capability` (the sampler does not lock `description_variant`).

## Findings

1. **should-fix**, `kernel/ts/src/mechanics/status/permits.ts:24` and the Sleep section's Sampler line in `docs/system/mechanics.md`: the spec says the sampler's sleeper "is offered Stand and Look", but `cartridges/sleep_sampler/cartridge.json` does not lock `description_variant`, so it is offered Stand only and Look is never exercised; dropping `look` from the allow list passes every focused test (the brief's red control "filter drops look" is unmet). Fix: lock `description_variant` in the sampler and in the provoke test assert `verbs(w)` is `['look', 'stand']` and Flee is `invalid_state` (brief acceptance a), or else correct the Sampler sentence and assert Look in another sampler that locks it.

## Departures

1. Allow list in `status/permits.ts`: **accepted**. No new cycle and no growth (above); `VERBS` and `MODAL` are read inside the call, never at load; `actions.ts` stays at 300 lines.
2. `move` kept for sleepers: **accepted**. Dry edges refuse a non-standing actor `invalid_state` (`movement/sequence.ts:134`); entering water needs standing (`water/shared.ts:34`); only leaving water skips it (water.test's captured Up). The allow-list test asserts Move east `invalid_state`. Move is offered to a sitter as before.
3. Lint relaxation for `../disposition.ts`: **accepted**. It names one helper with no `decide`, already imported by `movement/sequence.ts`, `action_recipe/spell.ts`, `dialogue/selection.ts` and `commerce/shared.ts`; other sibling imports stay rejected.
- Dream as a `rested` reaction applying a permanent status (PM-approved): the Dream's entitlement must be a bed service's benefit (`lib/loka/content/dreams.ex:57-70`), so a kill fact cannot gate one; the test covers no dream before the kill and none on a second Rest.
- Untested modal answers and Wait while asleep: no test required. They pass through the existing first disjunct of `permits`, which ignores position; the mutant that gates them behind the sleeper check fails position.test.
