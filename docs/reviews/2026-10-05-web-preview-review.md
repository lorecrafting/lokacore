# Independent review: local Book web preview (PR #194)

- Reviewed commit: `6a878fa28b833494828ddd7851877fe90d228e27`
- Verdict: **CHANGES REQUIRED**

## Requirements

The preview must run the actual App, Book, bundled Missing Child chapter and local Story authority in a browser, with a current-build OPFS save surviving reload and tab reopen. A damaged or mismatched save retains the existing refusal and confirmed Start over path. Browser startup may await SQLite's first open, while synchronous authority decisions remain on one connection. Fast Refresh should show Book edits and retain an open session; changed rules require reload. The proxy must stay local, supply isolation headers, and release its ports. The owner has paused native builds, simulators and native verification, while allowing this separate browser slice.

## Evidence

At the exact reviewed head, `npm ci` and app `tsc --noEmit` passed. In a fresh, isolated headless Chromium profile against the preview process at that same head, the Book opened, accepted Elspeth's search, and showed the committed result after reload and a closed/reopened tab; there were no page errors. The existing process was left running and its browser save was untouched. Both proxy ports listened on loopback, and the page response carried COOP and COEP headers. `git diff --check` passed. The focused `mobile/app` test run had 381 pass, one skip and four fail as below. No native session ran. A separate web worker mutation was not useful while the focused suite was already red; the worker's old one-byte write and the corrected four-byte write are visible at the exact guarded source, and the install guard was exercised by a second install.

## Findings

- **R194-1, should-fix — `mobile/app/chapter.test.ts:250`:** The controlled React Native host for the actual App has no `Platform` export. The new module-level `Platform.OS` read in `mobile/app/App.tsx:68` throws before the four existing chapter/elapsed App tests can exercise their save and wakeup assertions. `mise exec -- npm test` fails 4 of 386 tests at this head. Supply the host's platform value and rerun those behavior checks; this review cannot certify those paths while they are skipped by a setup exception.
- **R194-2, should-fix — `mobile/app/patch-sqlite-web.cjs:12`:** The source guard rejects its own successful patch on a later `npm install` in the same checkout. After `npm ci` passed and patched the worker, an immediate ordinary `npm install --no-audit --no-fund` exited 1 with “Review the SQLite web length write upstream.” This prevents normal dependency updates or repeated install commands until `node_modules` is deleted. Accept exactly the known patched form as an idempotent success while continuing to reject an unknown version/source.

Ponytail Review: **Lean already. Ship.** No unnecessary abstraction or dependency found; the two findings concern correctness and workflow, not excess code.

## Scoped fix review — `abef39cc11b0237d47d36fd85269e49b43f2064d`

Verdict: **APPROVE**. R194-1 is closed: both controlled App hosts supply `Platform.OS = 'ios'`; the restored focused suite passes 385 tests with one skip and no failures, and app typechecking passes. R194-2 is closed: a clean `npm ci` followed by an ordinary `npm install` both succeed. The patch accepts exactly one old or patched occurrence of each guarded worker expression and still rejects unexpected source.

The fix also replaces the captured asynchronous SQLite handle with the current handle or a fresh synchronous open after destructive corrupt-file recovery. Its direct session caller closes/deletes the old handle before reopening. In a separate preview on disposable ports and a fresh Chromium profile, corrupting the test OPFS database produced the damaged-save screen with Start over; confirming it opened a fresh Book. Reverting only the new worker error-message serialization in that disposable install produced “The game cannot go on yet” with no Start over, a red control for the recovery path. The worker catches thrown values as `Error`, and both synchronous deserialization and asynchronous rejection now receive the message string. The shared preview and owner save were untouched. No open findings.

## Separate save opinion (verbatim)

```text
Verdict: REQUEST_CHANGES at 6a878fa28b833494828ddd7851877fe90d228e27.

1. [P2] mobile/app/App.tsx:170 — Reopen a fresh handle after corrupt-file recovery. The web opener permanently returns `opened`. Confirmed Start over for NOTADB/page corruption closes that handle and deletes the file (:51–53); localSession then calls its opener again and receives the closed handle. Recovery leaves no game and removes the Start over option. The Expo worker likewise removes closed database IDs and rejects later operations. Reuse the primed handle while it remains open, then acquire a new handle after removal.

Evidence:
- Real SQLite reproduction: corrupt save → confirmed recovery → `database is not open`, game absent, startOver=false. A fresh-handle control recovers successfully.
- Disposable mutation using the PR’s captured-handle opener makes the existing “elapsed NOTADB and page corruption recover only through explicit working Start over” test fail at its successful-recovery assertion.
- All 54 focused start_over/recovery/session/faults tests pass unchanged; their fresh opener misses this integration regression.
- Separate browser origin: accepted quest narration survives reload and closing/reopening the save. Concurrent second-tab opening safely refuses the OPFS lock without offering Start over; reload after releasing the lock restores saved play.
- Browser corrupt-byte mutation was inconclusive; the finding rests on real SQLite reproduction and the verified Expo handle lifecycle.
- Disposable servers/copy removed; repository unchanged. No native save accessed.

Ponytail: no unnecessary abstraction or dependency identified.
```

## Separate save scoped recheck (verbatim)

```text
Verdict: APPROVE — scoped fix recheck at abef39cc11b0237d47d36fd85269e49b43f2064d.

1. Previous P2 resolved — mobile/app/App.tsx:170 now reuses the primed handle and opens a fresh connection after removal clears db. Real SQLite NOTADB recovery produces a playable game and accepts a subsequent command.

2. No new findings — mobile/app/patch-sqlite-web.cjs:17–18 preserves error messages through synchronous serialization and asynchronous delivery. Direct callers reconstruct Error instances, retaining corruption classification and operational-error handling.

Independent validation:
- 35 focused chapter/start_over/recovery/session tests passed on the exact source head.
- Executed patched WorkerChannel: corruption, NOTADB, lock and I/O messages survive both delivery paths; a 300-byte response survives synchronous delivery.
- Removing the length fix or synchronous error-message fix causes the corresponding assertion to fail.
- Reapplying the patch is idempotent; unexpected source and version are rejected.
- Disposable copy removed. Shared browser save and native saves were untouched.
```
