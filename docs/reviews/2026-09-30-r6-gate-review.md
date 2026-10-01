# Gate R6 review: the R6 milestone and the S6b gate PR

- PR #76 (`r6-s6b-gate`), reviewed head `8dd14bc89e3e2f222ec74f62f0cf82ca210a5c5d` on 2026-09-30.
  The R6 code under review is `main` at `bdc1375` (#75 merged) plus this PR's changes to
  `mobile/app/App.tsx` and two test files. `c963af1..8dd14bc` touches only the evidence README,
  so the phone ran the code under review.
- Depth: full gate review (WORKFLOW "Milestone gate", "Review stance"). Reviewer: a fresh Opus
  agent that authored none of R6 or this PR. Brief: the S6b brief.
- Verdict: **CHANGES REQUIRED**. The R6 code passes. Every check is green, every mutant dies,
  the device run supports start, play, resume, finish (option A) and no corruption, and the
  corrupt-file screen shows `save_corrupt` instead of crashing. What blocks the gate is its
  record:
  - The R6 row's own DEFERRED item (`evaluation.budget_exceeded`) is neither built nor moved
    to another row.
  - The R6 row is not closed, and the carries held only in slice rows have no stage row to land in.
  - "Kill during actions" rests on a headless corpus that runs in a SQLite journal mode the
    phone does not use.
  - The PR rewrites an inspected fact in an older evidence record.

  All the fixes are docs or test-comment edits, plus at most five pragma lines.

## What must be true for Gate R6 to pass (written before reading the diff)

From 14 §R6 (build list and Gate R6), 15 OFF-01..13, 03 §§14–15, 07 §10 `play_time`, ADR-075 §2,
04 §5.4–5.5 and the R6 owner decisions (r6 plan, smoke, one save, S4 scope, S3b scope, gate
finish):

1. Every 14 §R6 build item is built and covered by a test with literal or fixture expected
   values, or is recorded in ROADMAP as deferred with a landing row. The items are:
   LocalInstanceAuthority, serialized queue, local SQLite adapter, receipts, snapshots, save
   slots (one save, as amended), kill/recovery, `play_time`/`real_elapsed`, installed
   cartridge manager, milestone + pending report, binding outside hashes, and the fake sync
   adapter.
2. 03 §§14–15 hold at the authority:
   - receipt recognition happens before validating new gameplay;
   - an altered intent is a conflict;
   - a terminal rejection is receipted without a revision change;
   - one transaction holds the rows, the revision, the RNG and the receipt;
   - memory is adopted only after a confirmed commit;
   - an unknown COMMIT is fenced and reconciled from the store.
3. OFF-01..07 pass, each with evidence. OFF-08, 09 and 13 (`real_elapsed`) and OFF-12 (a
   release-process obligation) are reported DEFERRED, NOT PASSED. OFF-10 and 11 are not
   R6's gate, but OFF-11 was built in S3b.
4. Gate R6 on airplane mode: start a new tiny cartridge, play, kill the app *during actions*,
   resume, finish (option A: a declared end state equal to a headless run), no corruption.
   Device facts are sourced, and a failed run is kept.
5. ADR-075 §2: the phone trace cap and its boundary are tested.
6. 04 §5.4: the `evaluation.budget_exceeded` producer that R5 deferred to R6 is either built
   or re-recorded with a landing row, now that the local authority is a third host with
   genuine ReplayIds.
7. The ROADMAP R6 row is closed, and every carry survives the slice table's archiving. The
   docs tidy pass is done.

## Evidence

- `mise exec -- bin/check_all.sh` at `8dd14bc`, in a throwaway detached worktree: exit 0.
  - Elixir: 207 passed.
  - kernel TypeScript: 215 tests.
  - Simulator: 10,002 sequences and 326,275 steps, with the same outcome set as Gate R5.
  - mobile: 70 tests (69 pass, 1 skipped). The skipped one is the device compare, which runs
    only with `LOKA_DEVICE_DB`.
- Mutants, each reverted. Every one turned the mobile suite red:

  | Mutant | Result |
  |---|---|
  | `full` `>` to `>=` (`trace.ts:72`, S6a N3) | the new 4,998/4,999 boundary test fails |
  | `room` `>` to `>=` (`trace.ts:80`) | 2 fail (the boundary test, and the new-game-at-cap test) |
  | `lastId` returns 0 (`smoke.ts:83`) | 3 fail, including the gate tap script test, so its kill points exercise reopening |
  | skip the receipt lookup (`authority.ts:155`) | 8+ fail (replay, reconcile, SIGKILL-after-COMMIT, milestone once) |
  | commit writes no `state_row` (`store.ts:219`) | 8+ fail (restart, replay, gate cap tests) |

- The device compare is live. I pointed `LOKA_DEVICE_DB` at a copy of the reference save:
  pass. I then changed one `resources` row value in that copy: fail with a diff.
- Journal mode, run as a probe and reverted: all 69 mobile tests also pass with every
  `PRAGMA journal_mode = WAL` removed from the test helpers, that is, in SQLite's default
  rollback journal (see G3).

## Gate check against 14 §R6

| 14 §R6 item | Where | Covered by |
|---|---|---|
| LocalInstanceAuthority; serialized queue | `authority.ts` `openStory`/`invoke` (synchronous on one connection, so serial by construction) | `local_story.test.ts`, `faults.test.ts` corpus |
| local SQLite adapter | `store.ts` (`BEGIN IMMEDIATE`/`COMMIT` owned, changed rows only) | `local_story.test.ts` restart/write-failure tests; `smoke.test.ts` on the phone via the gate compare |
| command receipts | `store.ts` `receipt`, `authority.ts:152-160` | "a retried consumed take replays its receipt; altered intent is a conflict", "a failed attempt and a rejection persist; their retries draw nothing" |
| snapshots | not built as the 03 §18 versioned snapshot. Under ADR-072 the versioned save (`loka-save-vN`: head, rows, pin) is the durable state, and the full checkpoint is export/backup (10 §33, R12) | **not mapped in ROADMAP** (G2) |
| save slots (one save, amended) | `authority.ts` `first`/`newGame` | `saves.test.ts` new-game tests |
| app kill/recovery | S2 fence/reconcile, S6a SIGKILL corpus | `faults.test.ts`; `local_story.test.ts:344`; device kills between taps (G3) |
| play-time / real-elapsed | `play_time`: proven, S6a | `faults.test.ts:294`; `real_elapsed` DEFERRED (owner, S4) |
| installed cartridge manager | S3b, bundled releases | `saves.test.ts:200`, `:221`, `:302` |
| milestone + pending report; binding outside hashes; fake sync | S5 `progress.ts` | `milestones.test.ts` |

OFF scenarios:

| Scenario | Coverage |
|---|---|
| OFF-01, OFF-02 | the device run (run 2) |
| OFF-03, OFF-04 | the SIGKILL corpus and the commit-before-memory tests |
| OFF-05 | receipt replay |
| OFF-06 | real `SQLITE_FULL` |
| OFF-07 | `save_corrupt`: headless, plus NOTADB on the device |
| OFF-08, 09, 12, 13 | DEFERRED in ROADMAP rows `:66`, `:65`, `:69` (but see G2) |

## DEFERRED

| Item | Source | Recorded | Lands |
|---|---|---|---|
| `real_elapsed` reconciliation; OFF-08, 09, 13 | owner S4 decision | ROADMAP S4 row `:66`, S6b `:69` | "until a `real_elapsed` cartridge is planned" (owner's condition; slice row only, G2) |
| OFF-12; GC, migration staging, pre-migration copy, downloads | owner S3b decision | S3b `:65`, S6b `:69` | first content update or downloadable story (slice rows only, G2) |
| NOTADB/corrupt-page repair by file replace; untyped throw on deep or receipt-index corruption | S6a ruling | S6a `:68`, S6b `:69` | "SM2/R12": SM2 has no row (G2) |
| due-job drain | owner S4 decision | Early R7/R8 `:51` | Early R7/R8 schedule slice |
| `evaluation.budget_exceeded` producer + registration | 04 §5.4–5.5, from R5 | R6 stage row `:50` | **R6, which closes without it** (G1) |
| effect outbox (03 §15) | no rule emits effects (`decision.ts:179`) | `ponytail:` at `authority.ts:166` (throws if one appears) | the first effect-emitting rule; not an R6 build item (14 lists it at R14) |

## Findings

### G1 — should-fix: the R6 row's DEFERRED `evaluation.budget_exceeded` is neither built nor moved

`docs/ROADMAP.md:50`; `mobile/authority/local-story/authority.ts:162-165`

The producer is not built:

- The R6 row lands the first `evaluation.budget_exceeded` producer and its registration in R6.
- Nothing produces it. The local authority's fault path traces `unavailable` and returns
  `{kind:'fault', code}`. No observation name is registered (the term appears only in the
  ROADMAP, the reviews and 04).
- The local authority now has genuine ReplayIds (run, command, revision), so 04 §5.4 applies
  to a third host, and the phone has no other diagnostics channel.

Failure scenario: Gate R6 closes. The only record of the obligation sits in a row marked
done, and no row owns it. When the first R6P content exceeds `output_bytes` on the phone, the
player gets a bare `budget_exceeded` fault and the trace gets an `unavailable` entry. Neither
names the limit, and 04 §5.4 requires the limit to be named.

Edit: move the item, still marked DEFERRED, to a named row (R6P, before the compiled Lantern,
is the natural one) with the three hosts named. The alternative is to build it now.

### G2 — should-fix: the R6 row is not closed, and the slice-row carries have nowhere to land

`docs/ROADMAP.md:50`, `:65-70`

- **The row is still open.** It still reads as a plan. Its last sentence is cut off ("the
  rule is dormant only because no R5 content reaches a budget |"), truncated since `1b5fb4f`.
  R5's gate closed its row in the gate PR: "Done; Gate R6 passed (review); deferrals in …".
- **Carries land nowhere once the slice table is archived.** They live only in the
  "Proposed R6 slices" rows: S3b `:65`, S4 `:66`, S6a `:68`, S6b `:69` and SM `:70`.
  Archiving that table, as R3–R5 were, leaves them with no current row.
- **SM2 has no row.** It is named as the landing place for:
  - the S6a carries;
  - the `App.tsx:15` `ponytail:` (the recovery screen);
  - the evidence's safe-area note;
  - the SM row's "SM2 owns the screen for a save that does not open".

  SM2 appears in no stage count and no row.
- **Snapshots are unmapped.** 14 §R6 "snapshots" has no line saying how it is met. The
  03 §18 versioned snapshot was not built. Under ADR-072, the versioned save is the durable
  state and the full checkpoint is export (10 §33, R12).

Failure scenario: a planner reads the archived R6 row as "done" and the R6P/SM2 rows as
complete. The NOTADB repair, the untyped deep-page throw, OFF-12's release obligation and the
snapshot export are then dropped from every plan.

Edit:

- Close the R6 row and fix the truncated sentence.
- Copy the carry list into the rows where each lands: SM2 (add a row, or name it in the R6P
  row), R12, Early R7/R8, and a "when a `real_elapsed` cartridge is planned" line.
- Add one snapshot line: "14 §R6 snapshots: the versioned save is the ADR-072 durable state;
  the full checkpoint export lands with 10 §33 manual export (R12)".

### G3 — should-fix: "kill during actions" rests on a WAL-mode corpus; the phone runs a rollback journal

- Test files and lines:
  - `mobile/authority/local-story/local_story.test.ts:1`, `:60`
  - `recovery.test.ts:2`, `:51`
  - `saves.test.ts:3`, `:73`
  - `milestones.test.ts:2`, `:89`
  - `faults.test.ts:3`, `:36`
- Runbook: `docs/evidence/2026-09-30-gate-r6-iphone11/README.md` §1

Every headless suite sets `PRAGMA journal_mode = WAL` and says it does so "as expo-sqlite opens
it". That claim is false:

- expo-sqlite 57.0.3 on iOS sets no journal mode. `initDb` only adds the update hook
  (`node_modules/expo-sqlite/ios/SQLiteModule.swift:346`), and its podspec sets no WAL
  default (`ExpoSQLite.podspec:38`). The repository sets none either, so the phone runs
  SQLite's default rollback journal.
- This matches the device facts: after each SIGKILL in run 2 the copied folder held only
  `loka-save.db`, with no `-wal` or `-shm` files.

Gate R6's "kill app during actions" is met on the device only between taps (runbook §1: "a
kill during a COMMIT is the S6a corpus's job"). The corpus kills mid-COMMIT in the other
journal mode.

I removed the five pragmas, and all 69 tests pass. So the property holds today in the phone's
mode, but nothing in the repository keeps it.

Failure scenario: a later change relies on WAL behaviour, for example a read-only second
connection reading while a write is open (`faults.test.ts:84`). It stays green in CI, while on
the phone the reader gets `SQLITE_BUSY` or the recovery differs, and no test runs the phone's
mode.

Edit (pick one):

- Drop the five pragmas so the suites run as the phone does, and correct the five header
  comments.
- Or set WAL in production, where the app opens the database.

Either way:

- The evidence README states the mapping: kill during actions = S6a's SIGKILL corpus (phone
  journal mode) plus the device kills between taps.
- Add a storage-lessons line: expo-sqlite on iOS does not enable WAL.

### G4 — should-fix: the docs tidy rewrote an inspected fact in the SM evidence record

`docs/evidence/2026-09-30-sm-iphone11/README.md:15`

The PR changes "`Documents/SQLite/loka-smoke.db` copied from the app container" to
`loka-save.db`. At the SM run (`c3a0bb7`) the app opened `openDatabaseSync('loka-smoke.db')`
(`mobile/app/App.tsx:11` at that commit). The rename to `loka-save.db` came later, in S3a
(`1bca76e`).

Failure scenario: anyone repeating the SM run at its recorded commit looks for a file that did
not exist then. The record now states something nobody inspected.

Edit: revert the line. If a pointer helps, add "(renamed `loka-save.db` in R6 S3a)".

### N1 — nit: SQLITE_CORRUPT was never exercised on the phone, though S6b's acceptance claims it

`docs/ROADMAP.md:69`; evidence "Not checked"

Only NOTADB was run on the device (the garbage file). Source inspection makes the CORRUPT text
low-risk:

- expo passes SQLite's own error message through (`ios/Exceptions.swift:77`,
  `SQLiteModule.swift:341`).
- The vendored `sqlite3.c` contains both strings.

Still, the evidence should list "SQLITE_CORRUPT (`malformed`) on the device" under "Not
checked", with that source fact.

### N2 — nit: the runbook says the build is the "head of `main`", but it was a branch commit

`docs/evidence/2026-09-30-gate-r6-iphone11/README.md` §0 step 1

The build was `c963af1` on `r6-s6b-gate`. I checked that `c963af1..8dd14bc` is evidence-only,
so the result stands. Only the wording is wrong.

### N3 — nit: the deferral list is stated three times

- Evidence README "Deferred, not passed"
- `docs/ROADMAP.md:69`
- `docs/ROADMAP.md:68`

Keep one (ROADMAP, after G2) and link to it from the evidence README.

## Device evidence: does it support the gate claims?

- **Run 1 (kept, failing).** Its disposition holds:
  - Receipts 8 and 9 carry the allocator's next ids (`…008`, `…009`, from `lastId` + 1) and
    fresh decisions. A pending retry reuses its id, so they are not replays, and OFF-05 is
    not touched.
  - They are two distinct actions (north, then south). A double-fired handler would resend
    the same button (`south`), which is rejected at Ferry Landing.
  - On both screens `Go south`/`Go north` is the third button. Repeated taps in one spot
    therefore toggle north and south, which fits two extra owner taps.
  - The end screen at revision 9 equals the one at revision 7. That is why run 2's
    per-step checks were needed.
- **Run 2 (passing).** Each of these is an inspected fact; the compare test passed against
  the phone's save:
  - a fresh install at revision 0;
  - a copy after every kill, at revisions 2, 5, 6 and 7;
  - no sidecar files.

  Together they support start, play, resume, finish (option A) and no corruption, under
  airplane mode (OFF-01: owner-reported).
- **Corrupt check.** It is partly visible, and the inference is sound:
  - Of the texts the screen can show, only `save_corrupt` contains `_corrupt`. The
    alternatives are `pinned_release_missing`, `unsupported_save_format`, and a raw SQLite
    message (`file is not a database`).
  - The process survived two launches.

  This supports OFF-07 on the device for NOTADB.
- **Kill during an action.** It was not done on the device; see G3.

## Checked and fine

- PR diff:
  - The decision record is marked (paraphrased) and linked from the decisions index and the
    S6b row.
  - The gate test's literals (revision 7, 7 receipts, Ferry Landing, nothing carried,
    buttons) are hand-written. Kill-independence is checked against the kill-free run.
  - The N3 boundary test pins both sides of `full`.
- `App.tsx` catch: minimal, with a `ponytail:` naming its limit. A dev fast refresh after a
  failed open does not double-open, because expo-sqlite returns its cached handle per path
  (`SQLiteModule.swift:108`).
- 03 §§14–15 order and fencing: the receipt and write-path mutants above die. The S1–S6a
  reviews' findings were not reopened.
- Emergence: the slice adds no mechanic. The smoke controller names no content.
- Simplicity: the `dump` helper and the env-gated device test reuse the reference instead of
  adding a script. There is nothing to delete.
- Docs tidy (docs changed since #58, outside spec, reviews and decisions):
  - `docs/lessons/mobile.md` and `protocol/README.md`: no duplicated or stale fact.
  - `.claude/agents/*` and WORKFLOW: nothing stale.
  - ROADMAP and the evidence: G2, G4, N3.
