# Review: level rush, PR #582

- PR [#582](https://github.com/lorecrafting/lokacore/pull/582) `fix/level-rush` at `c69eba4c7619765d119629f4b0f049f3c1c22c60`.
- Scope: `cues.ts` pending slot, `cueSounds.ts` kill-that-levels hold, kernel `death/lines.ts` `closing`/`levelAt` with `proposal.ts` wiring, `LevelWash.stories.tsx`, spec wording.
- Governing: [book-ui.md Level wash, A level is never dropped](../system/book-ui.md), [level-rush rulings](../design/level-rush-rulings.md), [mechanics.md levelling](../system/mechanics.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- `/code-review medium` reported in the PR body at `ea3599746`; the only later commit is a one-line `book-ui.md` edit. `bin/mutate_diff.sh` not run (brief); targeted mutants below.

## Must be true (written before the diff)

1. A level cue is never dropped or displaced by another S3 while waiting.
2. On a kill that levels, the level's haptic and note lead; the fight-won fanfare follows after `settle.hold`, and is cancelled by a new fight.
3. The level line reads before the line of the `level_reached` rule it answers; a penalty line stays last; `woke` lines stay last.
4. No existing transcript, hash or contract changes; Elixir does not narrate, so the kernels cannot disagree on order.
5. No player prose added.

## Checks that held

- (1)(2) Mobile cues, cues_book, cue_sounds tests and `LevelWash` stories (3/3 under vitest) pass. Mutants killed: pending clause removed; level hold restart removed; levelled close plays `won` at once; `levelled` forced false; hold shortened by 50 ms.
- (3) Cases traced: two levels on one press (`??=` keeps the first answered level, tested); grant/quest level with no kill (same `react` path, two-threshold test); several rules (before the first); death with net loss (penalty last via the `level_up` gate); 64-line cap (`at > kept.length` falls to the end). Kernel mutants killed: `??=` to `=`; drop `- end.length` from the cut; `? at` to `? kept.length`; `levelAt` ignoring whether a rule matched.
- (4) Full kernel suite incl. sim showcase and samplers green; `bin/regen.sh` rewrote nothing. Only `levelling_sampler` has `level_reached` rules and it has no transcripts. `lib/loka/core` composes the levelling delta only.
- (5) No new player-facing text.
- PR claims rerun: "regen rewrote nothing because no transcripted cartridge reacts to level_reached" holds. The `cues.ts:155`/`:145`/`cueSounds.ts:64` cites do not point at the cited code (see nit 2).

## Findings

**nit** `kernel/ts/src/mechanics/death/lines.ts:40` vs `docs/system/book-ui.md:1018` ("else at the end of that step's lines") and the not-built list at `:783`: `levelAt` pins the level line for any matching rule, including one with no narrate or one failing its `when`. Scenario: a `level_reached` rule with only `fact.assign`, then later lines on the same press, puts the level line mid-receipt. Filed in `loka-g5hh.2.11`; the spec should name it as open.

**nit** PR body and the `loka-g5hh.2.11` title cite `cues.ts:155` (chapter), `cues.ts:145` (page turn), `cueSounds.ts:64` (curl); at this head they are `cues.ts:154`, `cues.ts:140`, `cueSounds.ts:11`.

**nit** `docs/system/mechanics.md:2148` (Experience line) still says the gained line is "appended once, before the `level_up` line"; with this change it is no longer appended at the end when a rule answers the level.

Note: the blow-pending kill that levels is proven piecewise (queue test plus direct `playCue`), not by one `cuesOf`-to-fanfare test; the mutants above die, so no finding.

Not checked: device or visual preview.

## Verdict

APPROVE WITH NOTES.
