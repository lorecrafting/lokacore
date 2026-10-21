# Review: pass-1 GE2, item status observed and expired lines, burning bier (loka-y6yg.48)

- Branch `showcase/pass1-itemstatus` (local, merges into batch `showcase/pass1`), exact head `b2cdc4df797d5ea604093d7e4382f5554c3e0d8a`, base `668701defee71ffac3e7b56299739f8d3c7d16b0`. Commits ce5987a49, 80fbda855, b2cdc4df7.
- Governing: [mechanics.md G3 Narration](../system/mechanics.md) (status@1, `narration.observed`, kernel_api 1.110); [cartridge.md status declarations](../system/cartridge.md); [parent record](2026-10-21-npc-status-observed-review.md); [owner decision](../decisions/owner-decision-npc-status-line-2026-10-21.md).
- Record reason: the slice widens the documented 1.110 `observed` semantics (an item now gets a line) and adds an expiry receipt line, at the same floor.
- Written 2026-10-21 by anthropic/claude-opus-5-5.

## Must be true (written before the diff)

1. A first application to an item in the actor's room that the actor sees (light `visible`: lit, not blind) tells `observed` once; dark room, other room and carried items tell nothing.
2. One line per pile, for gaining and for losing the status (brief: "expiry narrates once").
3. Expiry is told only for a seen item whose status declares `observed`; NPC expiry and NPC applied lines are unchanged.
4. Sight is judged for the Realm actor (`admitted()`), not `world.character`.
5. No new floor: the gate is the status declaring `observed` (already 1.110); older-API strips and `loader_floors.json` stay green in both kernels.

Holds: 1, 3, 4, 5. Fails: 2 for expiry (finding 1).

## Verdict

**CHANGES REQUIRED** (finding 1).

## Findings

1. **should-fix**, `kernel/ts/src/mechanics/status/job.ts:71` and `docs/system/mechanics.md:2170` ("each item's expiry is its own job and line"). Scenario: drop the torch in the smithy (bench and kindling burn), wait 400. One receipt has `["narration.burning.expired","narration.burning.expired"]`, so the player reads "The flames die." twice; a burning woodpile of 8 logs gives 8 lines. Fix: dedupe by key where per-job expiry lines merge into one receipt, rewrite the G3 sentence, and pin it with a two-item, one-wait test.
2. **Disposition, not a defect**: the handback says `visible()` ignores blindness for items. `dark()` returns true when blinded (`kernel/ts/src/mechanics/light/shared.ts:86-98`), and a room item then fails the held-ancestry walk. Probe: a `sight: blind` status on the player in the lit crypt gives no expired line; without it, one line. Only carried items stay visible, and the container check excludes those.
3. **nit**, `kernel/ts/src/mechanics/status/job.ts:71`: an item's expiry reuses the player's own `expired` text. Today only burning (third person) reaches items. A future status with `observed` and a second-person expired line would read wrongly on an item.
4. **nit**: `/code-review medium` did not cover 80fbda855..b2cdc4df7; rerun it in the fix round.

## Checks

- Realm: `watched` iterates `admitted(w)` (`job.ts:84-90`); no `world.character`.
- Applied path: `told` dedupe (`shared.ts:298`) is per step. In the smithy probe the spread step added no second `observed` line.
- b2cdc4d: size allow 321 to 323 matches the two added lines (precedent: parent record).
- Floors: the toolbox_showcase cases at 1.58, 1.104 and 1.105 in `protocol/fixtures/loader_floors.json` strip burning `observed`. TS `loader_floors` and Elixir `loader_floors_test.exs` plus `content_showcase_test.exs` are green.
- Elixir twin: `lib/loka/content/status.ex:77` is the loader gate only; there is no runtime narration twin. `bin/contracts.exs --check` is green.
- Focused TS suites are green at head (showcase_magic, showcase_fire, npc_status, status, status_room, status_readers, status_composition, loader_floors, flows, reactions), and so is `check_ts_size.mjs`.
- Mutants (showcase_magic, showcase_fire, npc_status), all red: M1 drop the `observed` gate in `watched` (7b); M2 drop `visible` (7b); M3 drop the same-room check (7b); M4 drop the item-kind check (9b, golem expiry); M5 drop `!told` (9b, pile).
- Quench refusal after the burn ends: pinned by magic 7b (`invalid_state`), which agrees with the handback.
