# Gate R6 on the iPhone 11: airplane-mode runbook and result, 2026-09-30

Status: **prepared, not yet run.** The Result sections are empty; the PM fills them after the run,
each fact labeled by source: owner-reported (paraphrased) / inspected / not checked, as in the
[smoke run](../2026-09-30-sm-iphone11/README.md). Never write a device name, UDID, team or
container identifier or a home path here; pipe every captured line through `redact` (step 0).

Gate: [14 §R6](../../spec/14-implementation-plan.md#r6--offline-authority-and-save-system) Gate R6,
[OFF-01 to OFF-07](../../spec/15-acceptance-scenarios.md#b-offline-lifecycle). "Finish" is
[option A](../../decisions/owner-decision-gate-r6-finish-2026-09-30.md): a fixed tap script played to
an end state declared in advance, whose save equals a headless run of the same script; finishing a
real story is R6P's gate. The app is the R6 SM smoke screen over the real local authority and
expo-sqlite; its save is `Documents/SQLite/loka-save.db` in the app container.

## 0. Setup

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
DEVICE=<the phone>; BUNDLE_ID=<the app's bundle id>; OUT=<an empty scratch directory>
redact() { sed "s#$HOME#<home>#g; s#$PWD#<repo>#g; s#$DEVICE#<device>#g"; }
```

1. Release (Hermes) build of the head of `main` that includes this runbook, installed with
   `xcrun devicectl device install app` (as the smoke run did). Free personal team; no EAS.
2. The owner deletes the app first (fresh install: no save), then the PM installs it. The phone
   stays unlocked and the app in the foreground (a lock stops the JS; a lock or backgrounding
   makes the run invalid, [mobile lessons](../../lessons/mobile.md)).
3. **Airplane mode on before the first launch**; owner confirms Wi-Fi and cellular are off.
   `devicectl` goes over the cable. Bound every wait (120 s per launch).
4. Launch: `xcrun devicectl device process launch --device $DEVICE --terminate-existing $BUNDLE_ID`
   (prints the pid). Kill: `xcrun devicectl device process terminate --device $DEVICE --pid <pid> --kill`.

## 1. The tap script

The owner taps these buttons in order (labels exactly as the screen shows them). The first screen
is Ferry Landing with buttons `look`, `scan`, `Go north`, `take a leather satchel`.

| Tap | Button | Expect on screen | Saved revision |
|---|---|---|---|
| 1 | take a leather satchel | Ferry Landing, Carrying: a leather satchel | 1 |
| 2 | Go north | Village Green | 2 |
| | **KILL 1** | PM kills the app; owner relaunches. Village Green, satchel carried, log empty, no "pending" line | 2 |
| 3 | Go south | Ferry Landing | 3 |
| 4 | scan | Ferry Landing | 4 |
| 5 | Go north | Village Green | 5 |
| | **KILL 2** | PM kills, owner relaunches. Village Green, satchel carried | 5 |
| 6 | drop a leather satchel | Village Green, Carrying: nothing | 6 |
| | **KILL 3** | PM kills, owner relaunches. Village Green, Carrying nothing, button `take a leather satchel` offered | 6 |
| 7 | Go south | **End state:** Ferry Landing, Carrying: nothing, buttons `look`, `scan`, `Go north` | 7 |

Declared end state: revision 7, 7 receipts, at Ferry Landing, nothing carried (the satchel is left
at the Village Green). The kills fall between taps: a kill during a COMMIT is the S6a corpus's job,
not this run's. The headless reference (`smoke.test.ts`, "the gate tap script ends at its declared
state") plays the same taps, closing and reopening after taps 2, 5 and 6, with these values as
hand-checked literals and checks the end state does not depend on the kills.

Expected results: after every kill the screen matches the row above (OFF-02: resume at the same
state); nothing is lost or repeated; no network was needed (OFF-01).

## 2. Compare the save

After tap 7: the PM kills the app, then copies the folder (so any `-wal` or `-journal` file comes along):

```sh
xcrun devicectl device copy from --device $DEVICE --domain-type appDataContainer \
  --domain-identifier $BUNDLE_ID --source Documents/SQLite --destination "$OUT/SQLite" 2>&1 | redact
ls "$OUT/SQLite"
sqlite3 "$OUT/SQLite/loka-save.db" 'select revision from head; select count(*) from receipt;'
cd mobile/app && LOKA_DEVICE_DB="$OUT/SQLite/loka-save.db" mise exec -- \
  node --test ../authority/local-story/smoke.test.ts 2>&1 | redact | grep -E "phone|^ℹ (pass|fail|skipped)"
```

Expected: `ls` shows `loka-save.db` (record any sibling file names); `7` and `7`; the line
`✔ the save copied from the phone equals the reference`, `fail 0`, `skipped 0`. The test compares the
head row (revision, clock, rng) and every `state_row` row with a fresh run of the same script on
node:sqlite, and prints no path on success; a failure prints a value diff. Receipts are compared by
count only; the trace is derived and not compared.

## 3. Corrupt-file check (S6a carry (c))

Last, because it destroys the save. The PM terminates the app, then replaces the save with garbage
and launches with the console attached:

```sh
yes 'not a database' | head -c 4096 > "$OUT/garbage.db"
xcrun devicectl device copy to --device $DEVICE --domain-type appDataContainer \
  --domain-identifier $BUNDLE_ID --source "$OUT/garbage.db" \
  --destination Documents/SQLite/loka-save.db --remove-existing-content true 2>&1 | redact
xcrun devicectl device process launch --device $DEVICE --console --terminate-existing $BUNDLE_ID \
  --timeout 120 2>&1 | redact | tail -30
```

The owner reports what the screen shows. Intended: the smoke screen shows `save_corrupt`, no crash.
**Expected from the code today (inspected, not run): a crash.** `mobile/app/App.tsx:14` calls
`openSmoke` at module load and `smoke.ts` throws `save not opened: save_corrupt` for any save that
does not open, with no UI to catch it; the screen has no recovery view (SM2 and R12, [roadmap S6a
carries](../../ROADMAP.md#proposed-r6-slices)). That is a finding to report, not to fix here. The
wording check is in the console: a message containing `save_corrupt` means expo-sqlite's error
text matched `corrupt()` in `mobile/authority/local-story/store.ts`; the raw expo-sqlite error
(`file is not a database` or another text) means it did not, which fails the S6b acceptance. If the
console prints nothing, record "not checked".

## Result (PM fills after the run)

Run date, build commit, phone OS: _

- **Owner-reported (paraphrased), tap script and kills:** _
- **Owner-reported (paraphrased), airplane mode and lock state:** _
- **Inspected, copied save:** files in the folder _; `head.revision` _; receipt count _; compare test _
- **Inspected, corrupt check:** console message _; whether it matches `corrupt()` _
- **Owner-reported (paraphrased), corrupt check screen:** _
- **Not checked:** _

## Deferred, not passed (Gate R6)

`real_elapsed` reconciliation; [OFF-08, OFF-09, OFF-13](../../spec/15-acceptance-scenarios.md#b-offline-lifecycle)
(S4); OFF-12 (S3b, a release-process obligation); S3b's carries (GC, migration staging, the
pre-migration copy, downloads); S6a's carries (a file-replace repair for NOTADB or corrupt pages,
to SM2/R12; a corrupt deep page or receipt-index page throws untyped).
