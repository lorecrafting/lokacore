# Review: away catch-up cap, PR #569 (loka-qhvgq, kernel_api 1.144)

- PR [#569](https://github.com/lorecrafting/lokacore/pull/569) `engine/cold-open-prune` at `d8045ee6280bb230ff4849f510b7a167a802a971`.
- Governing: [owner decision](../decisions/owner-decision-away-catch-up-cap-2026-11-01.md), [save.md](../system/save.md), Away cap, [cartridge.md](../system/cartridge.md), W27 in [mechanics.md](../system/mechanics.md).
- Reviewer: independent; authored none of the work.
- **Verdict: CHANGES REQUIRED** (two should-fixes on the pinned contract; the cap logic itself holds).
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
9. The owner's goal (about 3 s, bounded save at any absence) holds on a realistic path.

1-6 hold. 7 holds except as below. 8 holds today (main 1.143 at `d7407bb8d`, head 1.144). 9 holds for one absence on a lightly played save only.

## Findings

**should-fix** `protocol/manifest.schema.json:270` (`schemas/source/defs.schema.json:4667`, read at `kernel/ts/src/mechanics/calendar.ts:18`): `away_cap_hours` has no maximum. A real `mix loka.compile` of the showcase accepted 100000. At rate 50 a closed month then replays all 1500 logical days, past the PR's own 90-day row (35-38 s cold open, 19 MB), so a typo silently reopens the bug this slice fixes. Credit stays bounded by the real gap, so this is not a time exploit; it is a missing validation. Add a schema maximum (the sibling `recap_after_minutes` has a safety maximum) that keeps one capped absence under the 3 s goal, stated against measured rows: 10 logical days is 1.3 s under load 28, 30 is 4.2 s quiet, so a bound of 30 days or more already misses the goal. The hours are in-game, so the bound holds at any `rate`. Fix now: tightening a pinned contract after cartridges use it costs more.

**should-fix** `protocol/fixtures/invalid.json:22083` (the sibling rows; no `away_cap` row exists): nothing pins the bounds. `recap_after_minutes` has rows for 10081, 0 and 1.5; `away_cap_hours` has none, and `git grep away_cap` finds no negative test anywhere. Scenario: a contract regeneration that drops `minimum: 1` goes unnoticed; a cartridge with cap 0 then passes `??` at `calendar.ts:18`, and every return credits nothing, so the world stops while closed. Add rows for 0, 1.5 and max+1. Compile does refuse 0, 1.5 and 9007199254740993 today (run). A schema-only mutant to `minimum: 0` left `validate.test.ts`, `recap_after.test.ts` and `contracts_test.exs` green, but `contracts.gen.ts` was not regenerated, so the absence of a row, not that run, is the evidence.

**should-fix (owner or PM item, not code)** PR body "Pruning dropped": the owner's direction made dropping pruning conditional on a fast cold open. The capped rows measure a near-fresh save (25 receipts). A daily player credits a full day per return. My run (node sqlite, load 28): 10 daily returns 245 receipts, 1.3 s; 30 daily returns 732 receipts, 6,496,256 B, 11.6 s. The developer's "4.2 s quiet" is the same save. The PR discloses this as an open question; loka-qhvgq must not close on it without an owner ruling or a follow-up bead. Not a merge blocker: the cap is correct either way.

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
