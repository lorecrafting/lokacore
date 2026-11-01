# Second opinion: open-time catch-up refusal (loka-k3b5)

PR #541, branch `engine/open-catch-up-failure`, exact commit `eb014312d179eadd8c77a230c0660640dac96538`. CI at that commit: `ci`, `book-e2e`, `graph-diff` success.

**Verdict: CHANGES REQUIRED.** One blocker. No good save was refused in any run.

Governing: [save.md, Opening a story](../system/save.md), [storage lessons](../lessons/storage.md), [first review](2026-10-31-loka-k3b5-review.md) (not repeated).

## What must be true

Items 1-6 written before reading the diff. Item 7 is loka-k3b5's title, added after probing.

1. Every lawful row passes `jobSave`, on every route.
2. `CatchUpRefusedError` arises only from states lawful play cannot produce, never from a transient.
3. A refused step writes nothing; nothing is written before confirm beyond settled steps.
4. Start over keeps the file and trace, cannot run on a changed witness, and never reaches `remove` on this route.
5. A storage failure gets no Start over; a fault keeps its debt.
6. `jobRoute` does not change kernel dispatch.
7. An `invalid` elapsed result (the issue's title) reaches Start over and stops failing on every launch.

Item 7 fails. The others hold.

## Finding

**Blocker. `mobile/authority/local-story/job-save.ts:21`** (via `receipt-save.ts:19`, `store.ts:129`). `same()` runs `encode`, which throws `KernelError('invalid_canonical')` on a non-integer or unsafe number (`canonical.ts:185`). `corrupt(e)` does not match it, so `load` rethrows it. The new check runs ahead of the refusal this PR adds.

Forged pending `order` row in the test file's `saved()` save:

| `due_time` | base `a8b73794d` | head | head without the `jobSave` call |
|---|---|---|---|
| 65000.5 | `elapsed delivery refused: invalid`, `startOver:false` | `invalid_canonical`, `startOver:false` | `save_corrupt`, `startOver:true` |
| 1e300 | opens, time 65300 | `invalid_canonical`, `startOver:false` | opens, time 65300 |

At the head, two launches of the 65000.5 file give the same failure and identical bytes; `startOver()` returns undefined and no game opens. That is the issue's symptom, with the "kernel bug" it names as its trigger: no recovery on any launch. The 1e300 save opened at base and no longer does. Forged only, so no lawful save is affected. The file is kept.

PR body line 6 says an `invalid` delivery becomes `CatchUpRefusedError`. No test backs that for an open. Mutant `elapsed.ts:141` `reply.kind !== 'saved'` to `=== 'conflict'` survives the PR's `open_catch_up` table, which forges only `conflict` for a delivery refusal; `invalid` was not reachable through a forged due time while `jobSave` throws first.

Disposition proof: one FORGED row in `open_catch_up.test.ts` (fractional `due_time`, kind `order`) that asserts `save_corrupt` and `startOver:true`. It should fail at this head and pass after the fix, and should kill the mutant. Rerun the mutant to confirm.

## Rulings (real SQLite, at the head)

- Refused good saves: none. 141 saves from 24 cartridges, 38 reaching 120 days, 36 with a forced time policy: 0 `catchup:`, 0 `unrunnable`. Routes seen pending: bleed, crow, population, round, npc, order, status, replenish, quest, calendar, wage; `raid_aftermath.test.ts` passes for reaction across a cold reopen. Sight and water were not seen pending; `jobSave` cannot refuse them by construction.
- Every `job.schedule` writer read (30 sites): no lawful row routes to `npc` wrongly.
- Populations plus a built hut, showcase, 120 days: drained exactly 10368000 world seconds to 10393200, 13972 job rows, cold reopen with no refusal.
- `kernel_api` bump with debt: `pinned_release_missing`, `startOver:true`, bytes unchanged; pre-existing, documented at `save.md:18-22`, before load.
- Mid-transaction: a hot journal of a forged uncommitted update rolls back, opens and catches up to 65300.
- Start over after a transient (a held `BEGIN IMMEDIATE`): `database is locked`, `startOver:true`, remove 0, bytes and run unchanged; retry plays at 64800 on a new run, remove 0.
- Witness changed after refusal: Start over writes nothing, no game, remove 0.
- Before confirm: three refused launches at different clocks, identical bytes.
- Focus 3: a folded successor is a `status` row, routes `status`, `runnable` is true. `jobSave` cannot refuse it. No finding.
- Expected answers and frozen fixtures: untouched. Nothing to delete.

## Mutants (`bin/mutate.sh`, time-boxed, narrow files; tree clean after)

- Null control: a comment-only edit to `job-save.ts` (`return true; // null`) SURVIVED, as a no-op must.
- Red: `!runnable` to false; hour +3600; `jobSave(world, world)`; `status !== 'pending'` skip dropped; `<=` to `<`; authority guard removed; `jobRoute` water, bleed, quest, crow and sight lines removed; `reaction` removed from `KIND_ROUTES` (red-full).
- Survived: `elapsed.ts:141`, above. No other mutant survived its right test file.

## Rerun claims

- PR body red control: `mobile/app/node_modules/.bin/tsc -p mobile/app` exit 0; with `route === 'newkind'` in `decideAt`, exit 2, TS2367. Backed.
- `store.ts:129` cite: backed. PR body line 6 `invalid`: not backed, above.

Not run: full suites; phone; `deer`, `deer_bleed_recovery`, `story_points` test files in the save probe.

## Re-check at `ef623cfbca510bd4c14465fec4f0c5e7d4887306`

**Verdict: APPROVE.** Scope: `job-save.ts` `changed`, its FORGED rows, the `save.md` line. CI at that commit: `ci`, `book-e2e`, `graph-diff` success.

- Blocker fixed. Fractional `order` is `save_corrupt`, `startOver:true`, and Start over plays at 64800. Mutant `elapsed.ts:141` is now red-narrow; rethrowing from `changed`'s catch is red-narrow; a comment-only null control survives. `open_catch_up`: 19 pass.
- Accepted deviation (PM): `due_time` 1e300 on an `order` row opens, as at base. Eight launches, reloads at the same clock included, wall 20000 to 2e8: time 65300 to 10064300, `look` saved, no refusal, no loop, `integrity_check` ok, row unchanged, one run. Start over from the game plays at 64800.
- A fractional due time beyond the first credit (70000.5) opens until the clock reaches it, then is refused on every launch with Start over and receipts unchanged. `order` at 9007199254740993: three launches open and play.
