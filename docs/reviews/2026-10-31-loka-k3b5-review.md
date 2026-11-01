# Review: open-time catch-up refusal offers Start over (loka-k3b5, PR #541)

PR #541, commit `9d2ed1dcac712006d76ee4ab23b4a967ebe0399e`, merge-base `a3f0d3b39`. Governing: [save.md](../system/save.md) refusal table and elapsed recovery paragraph, [storage lessons](../lessons/storage.md), `br show loka-k3b5`. CI at the head (`gh run list --commit`): `ci`, `book-e2e`, `graph-diff` all success.

## Must be true (written before the diff)

1. A deterministic refused catch-up at open returns the recovery route, not a throw; the failure loop ends.
2. A refusal leaves the refused step's bytes unchanged; `remove` never runs.
3. Start over works, the new run plays, the trace survives.
4. A valid catch-up is unchanged (65300).
5. A lock, full disk or read error never offers Start over; a fault keeps game and debt.
6. A kernel-caused failure does not read as damage, or the wording says why it cannot.

## Findings

**Blocker. `mobile/authority/local-story/elapsed.ts:70`, `open_catch_up.test.ts:56`.** Mutant `<=` to `<` survives `open_catch_up` and all of local-story. It changes behaviour: a job forged with `due_time` equal to the clock (64800) gives `save_corrupt` at the head; under the mutant the game opens at 64800 with the bytes changed. The test forges `due_time` 1, so the boundary is unpinned. Fix: forge 64800 in that row; the probe shows that kills the mutant.

**Should-fix (follow-up issue before closing loka-k3b5). `kernel/ts/src/runtime/world.ts:213`, load's job validation.** The same failure loop remains for a job row of a known kind and forged body: kinds `quest, bleed, room, rule, tick, replenish` and an unknown kind, due 64900, throw `TypeError ... schedule_cases`; no Start over, bytes intact, every launch. The issue is fixed for refused elapsed results, not for this class. Do not widen the catch at `authority.ts:119`: it would call a kernel bug on a good save damage. Fix load to refuse the job row, a separate slice.

**Question (owner wording). `mobile/app/book/presenter.ts:70`, `lines.tsx:273`.** A kernel fault at open used to throw with no Start over. It now opens the Book at "Time stopped: evaluator_error", keyboard off, with Start over the one control, behind the confirm dialog (`App.tsx:105`). A kernel bug on a good save, which an app update would clear, can thus lead a player to destroy it. The control and raw code already exist at play time, so not this PR's defect; does the owner want words here?

**Nit. `open_catch_up.test.ts`.** `save.md:262` claims "steps settled before it stay committed"; no test pins it. Probed: steps 64900, 65300, conflict on the second: launch one commits step one then refuses; launch two is byte-identical; Start over plays at 64800.

**Nit. `delivery.ts:71`.** `effect outbox not built` is a further deterministic plain throw at open; disclosed in the PR, unchanged.

## Rulings (real SQLite, at the head)

- Transients: lock before BEGIN and for the whole open, `disk I/O error` at receipt lookup, failed COMMIT, lost ack, full disk: all plain errors, `startOver` false, `remove` never ran. Requirement 5 holds through the save error screen.
- Clocks: wall 1e12 to MAX_SAFE opens at 712800, 16 receipts per launch; clock -1 or 1.5 is `invalid elapsed clock evidence`, no Start over.
- Kernel fault at open: game opens at 64800, debt kept, status `evaluator_error`, trace one row per launch (2, 3, 4), so bytes change by the trace only. No heartbeat retry (`App.tsx:146`).
- `stale_view` (`elapsed.ts:141`): keep. `expected_run_id` is the row just read; a forged checkpoint of another run is refused by load first; a replaced run comes through `checkRun`. Effectively unreachable at open.
- Wording, `save.md:23`: holds, no edit required. Already-due cannot come from a lawful save (`compose_job.ts:24`); conflict needs a forged receipt. Kernel version: same `kernel_api` with a new `kernel_version` caught up to 65300; a contract bump is refused at the pin (`authority.ts:96`) as `pinned_release_missing`. The residual route is a contract change without a `kernel_api` bump plus an old rejected receipt at the same step: the #514 class, closed by loka-daha's rule.
- Rejected decision: not playable. Ancestry bundle, forged debt: opens with status fault `invalid_state`, every action returns that fault, stable across launches. Recovery is the Book's Start over. Accept.
- `ElapsedRecoveryError` at the open pulse: another run's header gives `save run replaced`, no Start over; the next launch reopens, not a loop. A malformed run id reaches `replace` through the `corrupt()` message match: needs a concurrent writer, pre-existing.
- Disputed self-review: `elapsed.ts:64` subclass kept, retyping would change `statusOfError`. `authority.ts:119` guard kept. `authority.ts:124` not using `refuse` is fine, `words.ts:44` handles the absent message.
- Multi-step: earlier settled steps staying committed is correct, they are valid progress.

## Test the tests

`bin/mutate_diff.sh origin/main`, `MUTATE_MINUTES=15`, twice: all 7 rows BASELINE-RED, 0 run; local-story itself is green (489 tests, 0 fail), so the reach into other packages failed in this worktree, not a PR defect. Replaced by hand mutants through `bin/mutate.sh`: guard removed, return to throw, `s.behind` removed, already-due throw removed, fault return removed, delivery refusal to plain Error: all red-narrow. `<=` to `<`: survived (blocker above).

PR claims rerun: implementation back at the merge-base gives 4 red, the full-disk test green, as the body's control states (it counted 3 of 4 before the fifth test). Guard removed is red on the full-disk test, as listed. Tests use literal expected values, real files, no mocks; no frozen fixtures touched. Nothing to delete. `/code-review` reported in the body.

Not run: the fault display in a browser (read from code, status confirmed at the session).

Verdict: CHANGES REQUIRED
