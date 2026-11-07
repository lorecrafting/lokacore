# Second opinion: away catch-up cap, PR #569 (loka-qhvgq, kernel_api 1.144)

- PR [#569](https://github.com/lorecrafting/lokacore/pull/569) `engine/cold-open-prune` at `d8045ee6280bb230ff4849f510b7a167a802a971`.
- Governing: [owner decision](../decisions/owner-decision-away-catch-up-cap-2026-11-01.md), [durable elapsed sessions](../system/save.md#durable-elapsed-sessions), [storage lessons](../lessons/storage.md), [owner rules](../system/owner-rules.md), `book-ui.md` Away recap.
- Reviewer: independent; authored none of the work. View formed without reading the first record.
- **Verdict: APPROVE WITH NOTES.**
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff completed, success. `gh pr view` reports CONFLICTING against main.

## Must be true

1. One absence credits at most the cap (default one in-game day, per cartridge), durably and once across a crash; open play stays exact.
2. The schema addition is optional and additive, Elixir and TypeScript read it alike, generated files match, `kernel_api` is main+1 at merge.
3. A pre-cap save is refused by the pin with Start over and unchanged bytes; every row accepted commands can write reopens.
4. A capped absence shows the right clock and one reachable recap; a refusal after open still reaches Start over.
5. `owner-rules.md` only gains a line; the decision record is marked paraphrased.
6. Each fixture change is explained by the bump or the clamp.

All six hold at this head, with 2 subject to the sync below.

## Findings

**should-fix (merge state)** `docs/system-graph.gen.json`: `git merge-tree` with main conflicts here; `contracts.gen.ts` auto-merges. The PR cannot merge as it stands. Regenerate after the sync. Main is still 1.143, so 1.144 stays main+1 unless another bump lands first.

**nit** `mobile/authority/local-story/away_cap.test.ts`: the refused-on-pulse case calls `statusOfError` on a constructed error, and nothing in `mobile/app` reads `status.reason`. If the pulse route stopped reaching the Book's fault, this test stays green. `open_catch_up.test.ts` FORGED uses no recap bundle. Scratch proof that the route works today is below.

**nit** PR body `App.tsx:155` cites `function resume`; the pause it describes is in `transition` (about line 171). The `booked` gate at line 156 guards resume only, so the cite names the neighbour of the gap, not the gap. `elapsed.ts:120` is within normal drift; `authority.ts:123` is exact.

**question** `ClockDriver.state()` (`elapsed.ts`) answers `catching_up`, not the error, on a second subscribe after a refused pulse (seen in scratch). The presenter keeps `s.fault`, so `Fault` and Start over still show, and the effect at `updates.ts:86` re-runs only on a new game or presenter. No failing scenario found.

Disclosed in the PR and accepted here: press before the tick after sleep is uncapped, pause or press before subscribe, no `maximum`, ceil rounding at a non-dividing rate with debt, the cumulative-play open question for the owner.

## Disposition proof

- Scratch test (not committed), recap bundle, forged already-due job: open succeeds; `pulse('resume')` emits `error/save_corrupt`; bytes unchanged; Start over plays at 64800. A press before the pulse throws `CatchUpRefusedError`, caught at `presenter.ts:185` into `s.fault`, shown beside Start over (`Book.tsx:268`).
- Pin `1.143` on a real save: `game()` undefined, `pinned_release_missing`, bytes unchanged, Start over plays.
- No new `readElapsed` rule. Capture rows are natural with target at or above head; remainder stays below 1000 and credit stays at or below the cap at a non-dividing rate (by reading; `away_cap.test.ts` reopens them).
- Elixir: `elixir bin/contracts.exs --check` exit 0. A copy of the showcase with `away_cap_hours: 6` compiles and carries it in `manifest.time_policy`; `0`, `"x"` and `1.5` are refused at `cartridge.json:63`.
- Fixtures: 40 files, 33 views `recap_after` 90000 to 86400 (30 min x 60 x 50 clamped), 7 live saves pin only.
- `owner-rules.md` gains one index line, undated like its neighbour. The record is marked paraphrased.
- Eight targeted mutants against `away_cap`, `clock-tick`, `recap_after`, `recap`, `showcase_recap`, `elapsed-resume`; all killed: clamp removed, owed not subtracted, negative room, no deferral at open, `||=` to `=`, floor to ceil, default cap plus an hour, resume reads the monotonic clock.
- PR claims rerun: `away_cap` 10 pass, 0 fail; `c.stalled ||=` mutant fails "a stall during a drain resumes when the drain ends".
- Changed expected values in `faults`, `permanent_tick`, `elapsed-resume`, `showcase_social`, `recap` read as caused by the owner rule, each with a reason.

## Not checked

Cold-open timing table, the Book in a browser or on a device, full `bin/mutate_diff.sh` (excluded by the brief).
