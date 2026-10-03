# Review: R6P savefix (Astra R6P-A01..A04)

- PR: #116 (`r6p-savefix`), commit reviewed `4a9486c`
- Reviewer: independent Opus reviewer (full stance: persistence code)
- Verdict: **APPROVE WITH NOTES**
- Device rows: not run yet (phone unreachable). This review covers the code only; the device evidence commit needs its own check.

## Requirements, written before reading the diff

From 03 §14-15, 04 §§14-16, ADR-072, the ROADMAP SM2 row (SM2a) and the S6a/P4a contracts:

1. A01: Start over routes by classification. A damaged value inside an intact SQLite file uses the authority's in-place `newGame`, which keeps pending reports (23 §11). Only real SQLite corruption (NOTADB, a corrupt page) takes the file replace. A NOTADB file never reaches in-place `newGame` (S6a: it throws).
2. A02: a save that loads but that the first screen cannot show is a typed `save_corrupt` at open, shown by the save-error screen. It never throws in `screen()` outside the opening-error handler. Start over repairs it in place.
3. A03: a stored receipt whose response is damaged never replays as a confirmed success. 03 §14 says "altered intent -> idempotency/integrity conflict, no mutation", and the reply uses an existing kind (no protocol change).
4. A04: the retained log is bounded.
5. SM2a stays true: an open that fails for another reason (lock, full disk) offers no Start over. A newer app's save offers none either.
6. No protocol, schema, kernel, cartridge or fixture change.

## Check against the requirements

- 1: met. `reread` (`mobile/authority/local-story/smoke.ts:172-181`) turns only "malformed JSON" into `save_corrupt` with `newGame`. Every other error is rethrown. `corrupt()` (`store.ts:133`) no longer matches "malformed JSON". If the in-place `newGame` then hits a real corrupt page, it throws as `corrupt`, and `startOver` falls through to the file replace (`smoke.ts:278-284`).
- 2: met for missing rows. Not met for valid JSON of the wrong shape (F1).
- 3: met. `authority.ts:176` checks the response against `DecisionResult` and gives `conflict`, with no mutation (the test checks that the receipts are unchanged).
- 4: met. `smoke.ts:208` keeps 200 lines.
- 5: met. The lock test shows `replace:false` and no `newGame`.
- 6: met. The diff touches no protocol, kernel, cartridge or fixture file.

## Tests of the tests (throwaway worktree, since removed)

Baseline: `node --test` for mobile/authority and book: 141 tests, 140 pass, 1 skipped, 0 fail. CI is green on `4a9486c` (bundle, elixir, lint, typescript).

| Mutant | Result |
|---|---|
| `reread` rethrows everything (A01 catch removed) | red: A01 start-over test |
| `corrupt()` back to `/…\|malformed/` | red: A01 test (`replace` true) |
| `reread` cause without `newGame` | red: A01 test |
| `holds('player_in_one_room')` line removed | red: A02 test |
| `!intact` removed from the replay check | red: both A03 tests |
| `intact = false` (every replay a conflict) | red: 30+ tests (accepted, rejected and failed replays, the fault corpus), so real stored responses do validate as `DecisionResult` |
| log cap removed; cap 200 changed to 1000 | red: A04 test, both times |

## Constructed inputs

- A02, missing rows: on a Lantern save at Bram's choice (9 `state_row` rows: choices, containers, jobs, quests, resources), each row was deleted alone, then the save was reopened and pressed once. The body's containers row gives `save_corrupt`. The other 8 open and play. For missing rows, the check covers Astra's crash class.
- A02, wrong shape: each row set to `null`, `{}` or `"x"` instead. See F1.

## Findings

**F1 should-fix: `mobile/authority/local-story/store.ts:119`.** `player_in_one_room` covers only the body's place. A row that parses but has the wrong shape still opens as `open`, and the first `screen()` throws outside the opening-error handler, which is Astra's A02 symptom.
- Reproduction: `UPDATE state_row SET value='null'` on the quest row, or on the active choice row, then reopen. `gameView` throws "Cannot read properties of null (reading 'quest')" or "(reading 'status')".
- `{}` or `"x"` in a resources row throws "undefined is not iterable" or `integer_overflow`. `{}` in a quests row throws `invalid_canonical`.
- These throws all come from the first `screen()`, so no recovery screen is shown.
- Not a blocker: page damage shows up as SQLITE_CORRUPT or a JSON `SyntaxError`, both handled, and no code path writes valid-JSON garbage.
- Disposition (pick one): **either** call `gameView(world)` once at open inside the existing try and map a throw to `save_corrupt`. That is one line, it is not a schema checker, and it subsumes the `holds` line. **Or** carry it to R12 typed detection with one line in the SM2/R6P row.

No other findings.

## Answers to the PM's questions

- **A03 `{kind:'conflict'}`:** yes. 03 §14 names an "idempotency/integrity conflict, no mutation" for a receipt that does not match. `conflict` is the existing kind for that, and a new kind would be a protocol change (a scope trigger). Legitimate replays are not affected (see the `intact = false` mutant).
- **Narrowed `corrupt()`:** no misclassification found. SQLite's corruption messages ("database disk image is malformed", "malformed database schema …", "file is not a database") still match. Only SQLite's JSON-function error is excluded. That error is raised only by `narration()` (the only JSON SQL in `mobile/`), and `reread` handles it. If damaged page bytes surface as "malformed JSON", the in-place `newGame` either succeeds, or throws `corrupt` and falls through to the file replace.
- **A02 against other rows:** enough for missing rows (all 9 tried). Not enough for wrong-shape values (F1).
- **Book.tsx deviation:** no display regression found.
  - `RoomPage` takes the title from `view`, not from the log (`pages.tsx:73`), so the cap never hides the heading.
  - `log.splice(0, length-1)` on a place change matches the old `from = length-1` exactly.
  - `refused` lines from before a move are dropped as before.
  - `Book` is keyed on `starts` (`App.tsx:49`), so Start over remounts it either way.

## Open items (not findings against this PR)

- Device rows and red controls, including A01 giving `replace:false` on expo-sqlite. The A01 split depends on SQLite's message text, which the code comment notes is unchecked on the phone.
- 03 §14 lists `result_digest`. Without it, a response with a valid shape but altered content still replays as saved. Adding it is a schema change, so it is a carry, not in scope here.

## Fix round 1 (`9ab820d`, `baaa094`): APPROVE

The check covered only the fix commits, the code each fix touched and that code's direct callers.

- **F1 / A02: closed.** `reread` (`mobile/authority/local-story/smoke.ts:173-190`) builds the first GameView once at open. Any throw becomes `save_corrupt` with the in-place `newGame`. The `holds` line is gone from `store.ts`. Moving the check to `openSmoke` (`authority.ts` and `store.ts` are at the line cap) is accepted: `openSmoke` is the only caller that shows a first screen.
  - Probe on a Lantern save at Bram's choice: each of the 9 `state_row` rows was deleted, or set to `null`, `{}`, `"x"`, `[]` or `0`.
  - Every case either opens and survives `screen()` plus three presses, or gives `save_corrupt` with `replace:false`. No probe reached an uncaught throw.
- **A04 (Sol): closed.** The cap moved from `press` to `screen()` (`smoke.ts:211`), so the lines Book's `refused()` pushes are trimmed on the next render.
- **A03 tamper with a valid shape:** carried to R12 in the ROADMAP R6P row (`result_digest`, a save-schema change). The carry is accepted.
- **Reverts:**
  - Removing the `gameView` try at open: all 3 A02 table cases fail.
  - Moving the cap back into `press`: the joystick "refused drags" test fails.
  - At head, the mobile/authority and book suites are green.
- The A02 table tests no longer check the reports, because `talk()` reaches no story point. `replace:false` still pins the in-place path. No finding.

No new findings.

## Device evidence (`756ca25`): APPROVE

The check covered only the evidence commit: `docs/evidence/2026-10-02-r6p-savefix-iphone11/` and its one ROADMAP link.

- **Node bytes anchored at d37b268: reproduced.**
  - In a worktree at d37b268, with `dev-harness.ts.txt` as `p6/harness.ts` and the rerun's `dev-node-expected.ts.txt` as `p6/node-run.ts`, `node p6/node-run.ts 19` gives "self-check failures=0".
  - Its `node-expected.json` is byte-identical to `node-expected.json.gz` decompressed.
  - `git diff d37b268 756ca25 -- mobile kernel protocol` is empty, so the evidence describes the reviewed code.
- **Rows: each proves its claim.**
  - `run-savefix/run.txt`: `ka` through `hold3b`, all `mismatches=0 checks_failed=0`.
  - The records add up to 4+1530+13+13+25+14+20+40+5+3+2 = 1,669, as the README says.
  - Row 12: the damaged `state_row`, `head` and `receipt` copies each give `save_corrupt`, and each undamaged copy opens.
  - Row 7, checked again with `sqlite3`: the journal's magic is `d9d505f920a163d7`. With the journal the save reads revision 9 with 9 receipts. The db alone reads revision 10 with 9 receipts.
- **A01 on expo-sqlite (my open item): closed.**
  - `badjson: save_corrupt, replace false PASS`. Expo's message is "FunctionCallException: Calling the 'finalizeSync' function has failed … SQLiteErrorException: Error code 1: malformed JSON", so both regexes match as intended on the phone.
  - "start over in place opens PASS".
- **Red controls: really red.**
  - Planted: `carry2 mismatches=1`, and `badjson … FAIL {"kind":null,…}` with A01 reverted. That result is no Start over at all, which is the pre-fix behaviour.
  - Mutant: `dusk mismatches=6 checks_failed=1`, `rng_state literal FAIL`.
  - The planted run's timeout and its resume from `leave2` are recorded.
- **Hashes:** `shasum -a 256 -c SHA256SUMS` passes for all 21 files, and the list matches the folder exactly.
- **Redaction:** no host paths, UDID, ECID or team id found. The UUIDs present are the cartridge's entity ids and the run's random ids.
- **Owner saves:** the skip is recorded honestly.
  - The deletion is labeled owner-reported.
  - The missing app and the failed container copy are labeled device-reported.
  - The record states that no backup and no byte-identity check was possible, and that the final launch shows a new save (`clean-launch.png`: Ferry Landing, a fresh game).

No findings.

## Codex Sol first review (gpt-6.1-sol, head 4a9486c), appended verbatim by the PM

CHANGES REQUESTED

```text
Exact scenarios verified: A01 closed (pending report preserved); A02 missing-body case closed; A03 null-response case closed; A04 Talk/Close bounded to 202 lines after 1,000 cycles.

R6P-A02 | blocker | mobile/authority/local-story/store.ts:119 @4a9486c
Partial closure. Fetch the lantern, Talk to Bram, then UPDATE state_row SET value='null' WHERE section='choices'. Reopening returns a game with failed() undefined; its first screen() throws “Cannot read properties of null (reading 'status')”. player_in_one_room passes. The save-error screen is still bypassed for damaged rows used by projection.

R6P-A03 | blocker | mobile/authority/local-story/authority.ts:176 @4a9486c
Partial closure. Commit Scan at revision 1, change only its stored response.outcome from 'scanned' to 'looked', reopen, and retry the original invocation. DecisionResult validation passes; the reply is saved/replay:true/revision:1 with outcome 'looked'. Shape validation leaves the original-outcome integrity failure open.
Returning conflict for an invalid response safely refuses replay without reexecution. Neither 03 §14 nor 04 §15 mandates a different corruption-error kind; schema-valid damage must also fail closed to preserve §14’s guarantee.

R6P-A04 | should-fix | mobile/app/book/Book.tsx:57 @4a9486c
Partial closure. Repeatedly drag toward the locked west exit without issuing another action. Footer calls refused(), which appends directly and bypasses smoke.ts:208’s cap. Reproduced: 1,000 gestures retain 1,000 lines, all joined/rendered on redraw. The room-change cut works.

Classification check: narrowing corrupt() preserves matching for NOTADB and SQLite structural “malformed” errors; malformed receipt JSON now receives the report-preserving reset. No newly introduced classification regression found.

Validation: real SQLite in-memory probes; Book/Footer callbacks with native UI stubs; typecheck and 14 existing book tests passed. File-backed tests were not rerun in the read-only checkout.
```

PM ruling on Sol A03 (schema-valid tamper): CARRIED to R12 (03 §14 result_digest, a save-schema change), per the ROADMAP R6P row.

## Codex Sol fix re-check (gpt-6.1-sol, head baaa094), verbatim

APPROVE

No findings.