# Review: a status-skipped combat turn names its cause (loka-x6t.30, PR #447 row 3)

- Branch `toolbox/batch-polish-engine-1`, range `bba2e26af..edbbb2d00ebec98a94dff03b5fc89685ad8b002b` (4 commits, row 3 only).
- Governing: [SR4 Combat turns and Known limits](../system/mechanics.md#command-blocks-and-resistances-on-a-status-toolbox-rows-sr4-and-sr5), [Status declarations](../system/cartridge.md#status-declarations), [book-ui.md Combat interaction](../system/book-ui.md), [CHECKS.md Size](../CHECKS.md), [Review stance](../WORKFLOW.md#review-stance); owner ruling 2026-10-22 (paraphrased): the player reads "Aldous is too stunned to do anything." or "You are too stunned...", and the line comes from the status that caused the skip.
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.
- Verdict: **CHANGES REQUIRED** (one should-fix, a repository rule).

## Must be true (written before reading the diff)

1. A body whose active statuses bar `attack` gets one round line on each skipped turn. The line is the barring status's authored `narration.skipped`, else `combat.skipped` with the status label. This holds for the player, a foe and an ally, in lone and pack rounds.
2. A landed blow, a flight before the bar and an unfit ally get no line. The round schedule, state and events do not change: no new DomainEvent and no save impact.
3. Both loaders refuse `skipped` below kernel_api 1.115 (KERNEL_API_RANGE_INVALID) and a key that is not in the text catalog.
4. The Book shows "<Name> is too <label> to do anything." / "You are too <label> to do anything." in the Combat log, and an authored line whole.
5. No change to the frozen or hash fixtures.

## Findings

1. **Should-fix**, `kernel/ts/src/mechanics/status/shared.ts:4`. The `size: allow` goes from 323 to 329. [CHECKS.md](../CHECKS.md) Size says that for a source file "an existing one is never raised", and that a file at its limit "splits instead of growing". `check_ts_size.mjs` cannot catch a raise, so the reviewer enforces the rule. The developer's reason (barring sits beside `statusAllows`) does not hold against that rule. The failure: every later reader added to this file gets the same precedent. Fix: move `barring`, `statusAllows` and `moves` (callers: `permits.ts:9`, `round_flow.ts:20`, `equipment/rule.ts:18`, `round_attack.ts`) into a new `status/bars.ts`, or get shared.ts back to 323 or fewer lines, and restore the 323 allowance.
2. **Nit**, `kernel/ts/test/status_readers.test.ts:138`. The brief asked for a red control on "a fleeing fearful pack member adds no line" and on a `skipped` key missing from the text catalog. Neither test exists. The behaviour is covered by generic code (`round_flow.ts` tries flight before `attack`; `status.ex:126` and `cartridge_status.ts:116` check every narration value). The `invalid.json` case tests the key pattern only, not the catalog.
3. **Nit**, `kernel/ts/src/mechanics/combat/round.ts:96`. The skip note comes after the event lines. Failure: when the player is stunned, the log reads "the troll clubs you", then "You are too stunned...", although the player's turn came first. This matches the existing status-applied and pack notes, so it is accepted as a known order.

4. **Nit**, PR #447 body, row 3. The brief asks for a screenshot of the Combat page with the line, and the body has none. The wording is judged from `words.ts:156` and `book/combat.test.ts` only.

Disputed self-review items (accepted, no finding): `words.ts:156` has no fallback for a missing binding because `round_attack.ts:104` is the only producer and always binds `status`. The grep finds no other `bindings.status` in kernel/ts/src. The `narration.ts:130` route relies on that same fact. An unseen NPC reads "They are..." through `nameOf`.

## Checks run

- 1, 2 and 4: focused runs pass: `status_readers`, `loader_floors`, `validate` (kernel) and `book/combat`, `narration_routing` (mobile). Elixir `loader_floors_test.exs` passes 4/4.
- Mutants, all red, tree clean afterwards: player line given an actor (`round_attack.ts`, status_readers fails); TS floor 1.115 changed to 1.110 (`cartridge_status.ts`, loader_floors fails); status-binding route removed (`narration.ts`, narration_routing fails); Elixir floor `[1,115]` changed to `[1,110]` (`status.ex`, 3/4).
- 5: the diff has no file under `cartridges/`, conformance or test fixtures. `invalid.json` and `loader_floors.json` each add one case at the end.
- PR claims rerun: "kernel_api 1.115 in both loaders" holds (`world.ts:108`, `status.ex:77`, `cartridge_status.ts:52`). "No new DomainEvent" holds: `skipped()` pushes only to `r.notes`.
- The PR body reports `/code-review`. CI on the head was still running when this review was written.
