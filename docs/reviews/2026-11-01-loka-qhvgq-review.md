# Review: away catch-up cap, PR #569 (loka-qhvgq, kernel_api 1.144)

- PR [#569](https://github.com/lorecrafting/lokacore/pull/569) `engine/cold-open-prune` at `d8045ee6280bb230ff4849f510b7a167a802a971`.
- Governing: [owner decision](../decisions/owner-decision-away-catch-up-cap-2026-11-01.md), [save.md](../system/save.md), Away cap, [cartridge.md](../system/cartridge.md), W27 in [mechanics.md](../system/mechanics.md).
- Reviewer: independent; authored none of the work.
- **Verdict: CHANGES REQUIRED** (two should-fixes on the pinned contract, a fix round because a schema bound is a logic change; the cap logic itself holds).
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff completed, success. PR is CONFLICTING: only `docs/system-graph.gen.json` (`git merge-tree`).

## Must be true (written before the diff check)

1. Wall-gap credit is at most the cap and at most the real gap; open-play credit stays exact.
2. The skip is recorded atomically (`wall_ms` moved, target raised, same write); a crash recomputes at most one credit.
3. Replay reads receipts only, never a clock.
4. Target never lowers; a backward clock credits 0 and rebases.
5. Debt is never trimmed; repeated returns only top up to the cap.
6. No due job is skipped or stuck: the clock does not jump, jobs stay in logical time.
7. The field is validated at compile; hashes stay unchanged for a cartridge without it, except as the rule explains.
8. `kernel_api` is main+1 at merge; old saves are refused with Start over.
9. The owner's goal (about 3 s, bounded save at any absence) holds on the path measured.

1-6 hold. 7 holds except as below. 8 holds today (main 1.143 at `d7407bb8d`, head 1.144). 9 holds as the decision words it, for one absence on a lightly played save; see the question below.

## Findings

**should-fix** `protocol/manifest.schema.json:270` (`schemas/source/defs.schema.json:4667`, read at `kernel/ts/src/mechanics/calendar.ts:18`): `away_cap_hours` has no maximum. A real `mix loka.compile` of the showcase accepted 100000. At rate 50 a closed month then replays all 1500 logical days, past the PR's own 90-day row (35-38 s cold open, 19 MB), so a typo silently reopens the bug this slice fixes. Credit stays bounded by the real gap, so this is not a time exploit; it is a missing validation. Add a schema maximum (the sibling `recap_after_minutes` has a safety maximum) that keeps one capped absence under the 3 s goal, stated against measured rows: 10 logical days is 1.3 s under load 28, 30 is 4.2 s quiet, so a bound of 30 days or more already misses the goal. The hours are in-game, so the bound holds at any `rate`. Fix now: tightening a pinned contract after cartridges use it costs more.

**should-fix** `protocol/fixtures/invalid.json:22083` (the sibling rows; no `away_cap` row exists): nothing pins the bounds. `recap_after_minutes` has rows for 10081, 0 and 1.5; `away_cap_hours` has none, and `git grep away_cap` finds no negative test anywhere. Scenario: a contract regeneration that drops `minimum: 1` goes unnoticed; a cartridge with cap 0 then passes `??` at `calendar.ts:18`, and every return credits nothing, so the world stops while closed. Add rows for 0, 1.5 and max+1. Compile does refuse 0, 1.5 and 9007199254740993 today (run). A schema-only mutant to `minimum: 0` left `validate.test.ts`, `recap_after.test.ts` and `contracts_test.exs` green, but `contracts.gen.ts` was not regenerated, so the absence of a row, not that run, is the evidence.

**question (owner or PM)** `docs/decisions/owner-decision-away-catch-up-cap-2026-11-01.md:9-11`: the decision conditions dropping pruning on cold open at a month, three months and a year "with the cap alone", under about 3 s "at any absence". Read literally that is met: the rows measure one absence on a near-fresh save (25 receipts). A daily player is not covered; each return credits a full day. My run (node sqlite, load 28): 10 daily returns 245 receipts, 1.3 s; 30 daily returns 732 receipts, 6,496,256 B, 11.6 s (the developer's "4.2 s quiet" is the same save). The PR discloses this as an open question. Does the owner accept it? loka-qhvgq should not close without that ruling or a follow-up bead. Not a merge blocker: the cap is correct either way.

**nit** PR body "`kernel_api` 1.143 (main+1)": head is 1.144.

**nit** `mobile/authority/local-story/away_cap.test.ts:180`: `notEqual(kind, 'error')` allows any other status; the next line's target assertion carries the test.

**question** `mobile/app/App.tsx:171`, `mobile/authority/local-story/elapsed.ts:131`: a hide event before the first tick after a stall takes `pulse('pause')`, crediting `mono - baseline` uncapped and clearing `stalled`. The PR discloses the press and pre-subscribe windows, not this one. Whether it can occur depends on `performance.now` advancing through sleep on the platform; not verified, no browser or device run.

**merge order** #557 head `0440cf678` also claims 1.144. Whichever merges second rebumps and regenerates pins.

## Attack list

- Close and reopen: credit is below the real gap, so closing gains no time. Skipped spans are not played; jobs stay due in logical time. Backward clock credits 0 (`away_cap.test.ts:140`).
- Kill test (`faults.test.ts:484-496`): justified, not fitted. Before COMMIT: the child's pulse is lost, reopen credits the capped day, 64800 + 86400 = 151200; my separate probe got 151200 and 3 receipts. After COMMIT: open-play debt 2592 s x 50 stands, 64800 + 129600 = 194400. The 43.2-minute single pulse is artificial; a real session commits on each tick.
- Determinism: replay reads receipts; the checkpoint records wall and target, not a recomputation. `coldReopen` passes after failed COMMIT and lost ack.
- Hashes: `mobile/app/stories/live/green.sql` differs only in `kernel_api`; the 33 stored views differ only in `recap_after` 90000 to 86400 (30 min x 60 x 50 clamped to one day). Explained. No Elixir rule, so no differential.
- Refusal on a pulse: `statusOfError` to `save_corrupt`; `presenter.ts:143`, and `Fault` (`book/lines.tsx:249`) offers Start over. Read, not rendered.
- Composition: no new mechanic; capability code names no content.

## Tests of the tests

`bin/mutate.sh` singly, focused elapsed, away and fault files (brief forbids the full sweep):

| result | mutant |
|---|---|
| red-narrow | `elapsed.ts` active path always takes `away()` |
| red-narrow | `time.ts` `recap_after` `Math.min` to `Math.max` |
| red-narrow | `session.ts` pulse catch skips `statusOfError` (the integration the unit test at `away_cap.test.ts:202` leaves open) |
| SURVIVED, equivalent, predates PR | `elapsed.ts` `resumed` drops `mode === 'resume'`: `pulse` already sets `resumeNeeded`, `reserve` passes `active` |

Claims rerun: PR numbers rows, closed month and year (25 receipts, 327,680 B, cold open 0.24 and 0.26 s at load 28) and 30 daily returns (732, 6,496,256 B): backed. The developer's own mutant table was not rerun.

## Not checked

No device or browser run; timing is node sqlite, not the web analogue. No wall-clock sleep behaviour. Developer's measurement script not located; numbers reproduced by my own probe.

## Re-check at f8569bb922c40f7ff1a33c0776c8f5db5b270d9a (`kernel_api` 1.145)

Scoped to the findings above, the fix commit `ba78d36e1` and the test fixes in the merge `f8569bb92`. CI at this head: ci, book-e2e, graph-diff completed success.

**Verdict: CHANGES REQUIRED.** One blocker, one test; the fix logic holds.

**Blocker:** `mobile/app/App.tsx:166` and `:173` (and the `c.ticked` line at `:157`) have no test. Two mutants stay green over `chapter.test.ts`, `clock-tick.test.ts`, `away_cap.test.ts`, `recap.test.ts`, `elapsed-resume.test.ts`: forcing `['pause']`, and deleting `c.ticked = performance.now()` from `resume`. The second was not in the developer's report. Failure scenario: either regression returns a hide after a stall to uncapped credit, and the next open replays the whole gap, the bug this PR exists to fix. A green suite is a blocker under the review brief. `hidePulses` and the away-cap test call the helper directly, so neither reaches the wiring. The cost is small: `appHost` already drives the actual App. This scratch test passes at the head, and fails on each mutant (forced pause: `1576800000 !== 86400`):

    const h = appHost();
    h.next(); h.change('background'); h.change('active');
    const start = checkpoint(h.sql).target;
    h.clock.wall += YEAR; h.clock.mono += YEAR;
    h.change('background');
    assert.equal(checkpoint(h.sql).target - start, 86400);

Dispositions:

| finding | state | proof |
|---|---|---|
| no maximum | fixed | 168 in `protocol/manifest.schema.json:274` and `schemas/source/defs.schema.json:4669`; compile accepts 168, refuses 169 |
| no invalid rows | fixed | rows 0, 1.5, 169 with `below_minimum`, `invalid_type`, `above_maximum`; dropping the maximum from both schemas turns `contracts_test.exs` red (9 to 8 of 9) |
| stalled hide | logic fixed, wiring untested | swapped order red (2 tests); dropped `c.stalled` with `>=` red |
| refused pulse | fixed | `recap.test.ts` real route; dropping `CatchUpRefusedError` in `session.ts` red |
| weak `notEqual` | fixed | `away_cap.test.ts` now expects `catching_up` |
| PR body pin | fixed | body and `kernel/ts/src/runtime/world.ts:110` say 1.145 |
| daily returns | open | owner ruling or follow-up bead; not re-examined |

Test values are derived, not fitted. In `elapsed-resume.test.ts` the day is 3600 x 20 = 72000 units, the schedule hours are 6 and 19, and the start is 64800. The boundaries are 68400, 93600, 140400 and so on, so the 16th is 597600. The cap is 168 x 3600 = 604800, so the target is 669600, with 18 boundaries in range; the drain limit mutant `n < 17` turns it red. Remainder 50 is the 1 ms pre-gap capture at rate 50. A 24-hour day fits at most 7 x 2 = 14 boundaries, so the calendar change is forced. `chapter.test.ts` passes the real `hidePulses` to the module stub; no expected value changed.

Timing: `bin/away_timing.ts 168` runs and reports 169 turns, 1,593,856 B, as the PR says; 3.07 s at load 13-16. Consistent with the PR's 1.8-1.9 s at load 6 and 3.39 s under `nice`; a quiet run was not reproduced, so the 3 s bound has little margin.

Not checked: device or browser; whether `performance.now` advances across sleep, on which the hide fix depends; the rest of the merge.
