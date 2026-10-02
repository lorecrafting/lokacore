# R6P savefix: device rows on the iPhone 11, 2026-10-02

Result: **every automated row passes on the phone at d37b268 (the savefix head, with #115); 0 Node/Hermes
byte mismatches over 1,669 records; the A01 case gives `save_corrupt`, `replace: false` on expo-sqlite;
the planted and mutant red controls fail.** Same rows, drivers and method as
[the R6P rerun](../2026-10-02-r6p-rerun-iphone11/README.md) (#112); only the differences are written here.
Spec: [pre-release-proof.md](../../spec/pre-release-proof.md) P6; 03 §14; 04 §§14-15; ROADMAP SM2a, S6a.

Facts are labeled **device-reported**, **inspected** or **owner-reported**. Device name, UDID, team,
container ids and paths are withheld; driver output went through `redact`
([dev-common.sh.txt](../2026-10-02-r6p-rerun-iphone11/dev-common.sh.txt)).

## Owner saves

- **Owner-reported:** the owner deleted the Loka app before this run ("I deleted it"), so the saves
  went with it.
- **Device-reported:** `devicectl device info apps --include-all-apps` listed no Loka app, and copying
  `Documents/SQLite/loka-save.db` / `loka-lantern.db` (and `-journal`/`-wal`/`-shm`) failed with
  ContainerLookupErrorDomain -1. No backup exists and none was possible; no byte-identity check applies.
  The final launch therefore shows a new save, not the owner's old one.

## Build facts

- **Inspected:** harness and clean builds from `r6p-savefix` d37b268 (main at #115 merged in, the
  savefix commits and their review records). Release, free personal team, `devicectl device install
  app`. The plain JS bundle of each build was checked for its marker (`'savefix'`, `'savefix-planted'`
  plus `PLANTED red control`, `'savefix-mutant'`; the clean build has none of them, no `p6run-`, and has
  "You are too exhausted." and the savefix log cap).
- **Device-reported:** iOS 26.6.2, Hermes bytecode 98, OSS release 250829098.0.17, Static Hermes,
  Release, GC hades, debugger off. `passcodeRequired: false` before every phase (the `drive-phone-*.log` files).
- Harness change against #112: one block at the end of the `corrupt` phase
  ([dev-harness-vs-rerun.diff](dev-harness-vs-rerun.diff)); Node run unchanged
  ([dev-node-expected.ts.txt](../2026-10-02-r6p-rerun-iphone11/dev-node-expected.ts.txt)). `node p6/node-run.ts 19`
  at d37b268: self-check failures 0. Node bytes: [node-expected.json.gz](node-expected.json.gz).

## Results

| Row | Result | Proof |
|---|---|---|
| 2 timing | pass, reported | [timing-phone.txt](timing-phone.txt) ([run-time/run.txt](run-time/run.txt)): 300 warm decisions, p50 0.71 / p95 1.86 / p99 1.98 ms; end to end p50 6.97 / p99 10.19 ms. |
| 4-11 | pass | [drive-phone-savefix.log](drive-phone-savefix.log), [run-savefix/run.txt](run-savefix/run.txt): `ka` through `hold3b` all `mismatches=0 checks_failed=0` (29 checks pass, 0 fail). |
| 7 mid-commit kill | pass | **Inspected** ([run-savefix/hold1/](run-savefix/hold1/)): 35,360-byte `-journal`, magic `d9d505f920a163d7`; with it `sqlite3` reads revision 9, 9 receipts; the db alone reads revision 10, 9 receipts. |
| 12 SQLITE_CORRUPT | pass | `state_row`, `head`, `receipt` root page damaged: each `save_corrupt`; undamaged copies open. This is `corrupt()` with the narrowed `malformed(?! JSON)` on expo-sqlite. |
| A01 on expo-sqlite | pass | `corrupt CHECK badjson: save_corrupt, replace false PASS`, expo's message `SQLiteErrorException: Error code 1: malformed JSON`; Start over in place then opens. |
| Red: planted | fails as planted | [dev-planted.diff](dev-planted.diff). `carry2 … mismatches=1` at `lantern-carry[7] state` ([run-planted/run.txt](run-planted/run.txt)); `corrupt … checks_failed=2`: `badjson … FAIL {"kind":null,…}` ([run-planted2/run.txt](run-planted2/run.txt)). The first planted run stopped at `corrupt` (TIMEOUT: the harness runs the next undone phase, `leave1`, which held); the app was killed and the run resumed from `leave2` ([drive-phone-planted2.log](drive-phone-planted2.log)). |
| Red: mutant | fails | `dusk … mismatches=6 checks_failed=1`, `rng_state` `[…,1791364731]` ([run-mutant/run.txt](run-mutant/run.txt)). |

The `ERROR: Failed to retrieve …` driver lines are copies of files that do not exist, as in #112.

## Final install

**Inspected:** clean Release of d37b268, installed, launched once, no press:
[clean-launch.png](clean-launch.png) shows the Lantern's Ferry Landing on a new save. The owner's
Lantern save could not be checked (see Owner saves).

Hashes: `SHA256SUMS`, verified in `SHA256SUMS.verify`.
