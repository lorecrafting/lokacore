# R6P P6 rerun: device proof on the untimed Lantern, iPhone 11, 2026-10-02

Result: **every rerun row passes on the phone (rows 2, 4-12, 15); 0 Node/Hermes byte mismatches over
1,739 records; the on-device mutant fails the compare.** Rows 1, 13 and 14 stay as
[P6b](../2026-10-02-r6p-iphone11/README.md) recorded them. Why a rerun: #110 (R6P Untime) changed the
Lantern cartridge (no wait, no Bram schedule, MV 100), so its content hash and every Lantern byte
changed. Spec: [pre-release-proof.md](../../archive/spec/pre-release-proof.md) P6 and "Evidence required to
finish R6P"; [envelope](../../archive/spec/r1-acceptance-envelope.md) §4-5; ADR-074 §3; 04 §§14-15; 03 §14;
[owner decision](../../decisions/owner-decision-untimed-lantern-2026-10-02.md).

Facts are labeled by source: **device-reported**, **inspected**, **not checked**. Device name, UDID,
team, container ids and paths are withheld. Every capture went through the driver's `redact`
([dev-common.sh.txt](dev-common.sh.txt)).

## Build facts (row 3)

- **Inspected:** harness and clean builds are from `r6p-rerun` 73927a1 (`origin/main` e0c38a0 plus
  the 0 MV words commit). CI on 73927a1: `ci` run 37055405705 and `mobile-bundle` run 37055405692,
  both success. At that SHA `lantern.test.ts` (the frozen Lantern traces) passed locally: 15 pass,
  0 fail, Node 24.21.0. The Node bytes take their independence from that (AGENTS.md "Expected
  values"). Later commits on the branch change only docs.
- **Inspected:** Expo 57.0.24, React Native 0.86.3, expo-sqlite 57.0.3, Xcode 27.0. Release
  configuration, free personal team, installed with `devicectl device install app` (no uninstall).
  `main.jsbundle` starts with the Hermes magic `c6 1f bc 03 c1 03 19 1f`.
- **Device-reported (p6run):** Hermes bytecode version 98, OSS release 250829098.0.17, Static
  Hermes, Release, GC hades, debugger off.
- **Device-reported (devicectl):** iPhone 11 (iPhone12,1), iOS 26.6.2 (23G90). `passcodeRequired:
  false` before every phase (the `drive-phone-*.log` files).
- **Device-reported (libimobiledevice, before the timing phases,
  [battery-before-timing.txt](battery-before-timing.txt)):** battery 100 %, on the cable, fully
  charged (not charging), battery temperature 33.79 °C. **Not checked:** iOS thermal state (null).
- Cartridge: the Lantern known answer, content hash
  `9b0969438f5ddad877c88506ffe295c5084e3014d607ef0ba24c922ee5db2821`. Conformance profile: null.

## Results

| # | Row | Result | Proof |
|---|---|---|---|
| 1 | Latency producer (Node) | P6a, #105 | Not rerun (no device). |
| 2 | Phone timing | **pass, reported** | [p6run-phone-time.txt](p6run-phone-time.txt), [timing-phone.txt](timing-phone.txt): 300 warm NEW decisions over 6 launches (per launch 6 runs of 10 decisions, carry and leave alternating, the first a warm-up and excluded). Decision: p50 0.71, p95 1.86, p99 1.91 ms (envelope §5 Tiny row 2/5/10, for information). End to end (admission + decision + commit + trace + sink + GameView projection): p50 6.92, p95 9.54, p99 10.05, max 11.30 ms. Apart: game commit p50 1.92 / p99 3.08; sink write p50 1.41 / p99 1.67; projection p50 0.39 / p99 0.59 ms. **Cold** (first open in a fresh process): new save 7.78 / 7.24 / 7.33 ms; restore of carry2's save at revision 10 3.39 / 3.43 / 3.25 ms. Second opens (not cold): restore 4.48 / 2.92 / 3.32, new 6.50 / 6.66 / 6.09 ms. |
| 3 | Build facts | **pass** | Above. |
| 4 | Both paths, save/restore | **pass** | carry and leave through `openStory` on expo-sqlite, killed after step 4 (`carry1`/`leave1` HOLD). Relaunch: revision 5, 5 receipts; steps 5-9 to revision 10, 10 receipts. Every reply and state equals the Node bytes ([p6run-phone-rerun.txt](p6run-phone-rerun.txt)). Red control (planted build): `"clock":21600` → `31600` in the bundled expected `carry2/lantern-carry[7] state` → `carry2 … mismatches=1` at exactly that record, both byte strings shown ([p6run-phone-planted.txt](p6run-phone-planted.txt)). |
| 5 | Node/Hermes bytes + sim sample | **pass** | 0 mismatches over 1,739 records: 1,530 sim records (seeds 1-19; N = 19 is the largest whose `data.ts` stays ≤ 2,000,000 bytes: 1,961,244; N = 20 is 2,014,402) and every Lantern, dusk and known-answer record. All 19 start states match. Red control (on-device mutant, [dev-mutant.diff](dev-mutant.diff), `rotl(s3, 11)` → `12`): `dusk … mismatches=6 checks_failed=1`, `rng_state` `[…,1791364731]` against `[…,3043166013]` ([p6run-phone-mutant.txt](p6run-phone-mutant.txt)). As in P6b, the sim seeds and known answers stay green under the mutant (they draw no RNG); RNG parity rests on dusk and P6b's `rng_steps` replay. |
| 6 | Known answers on Hermes | **pass** | items (3 cases), dusk (1 case): 0 mismatches. The Lantern known answer loads with hash `9b0969438f5ddad877c88506ffe295c5084e3014d607ef0ba24c922ee5db2821` and the fixture's canonical value. |
| 7 | Mid-commit kill | **pass** | `journal_mode` = `delete`. Hold 1 (rows written, COMMIT not issued, killed). The copy taken before the relaunch ([hold1-before-relaunch/](hold1-before-relaunch/)) has a 35,360-byte `-journal` with header magic `d9d505f920a163d7` (hot). **Inspected** with `sqlite3` on a Mac copy: with the journal it rolls back to revision 9, 9 receipts, 0 for the held command, and the journal is deleted; red control: the db file alone reads revision 10 with 9 receipts (half a transaction). Relaunch (`hold1b`): revision 9, no held receipt; the retry commits once (revision 10); a second retry replays. |
| 8 | After COMMIT; narration boundary | **pass** | Hold 2: relaunch shows revision 10 with the held receipt; the retry replays. Hold 3: reopen `narration()` equals the held reply's narration (`proof.carry`). |
| 9 | Before COMMIT | **pass** | The receipt write fails: `rolled_back`; memory bytes, head, receipts and every `state_row` unchanged; no open transaction; the retry commits once. |
| 10 | Lost response | **pass** | `carry` chosen, reply discarded, then a walk away (`move north`, as #110's rewritten adverse cases; `wait` is gone). The resend gives `replay: true`, the lost reply's decision bytes and the Node bytes; revision 11 unchanged. Red control: the same choose with a new invocation id → `rejected invalid_state`. |
| 11 | Failed roll, duplicate | **pass** | Dusk, `schedule.jsonl:1-6`: `pick_lock` outcome `failure`, one `check_failed`, `rng_state` `[619855573, 1505027126, 3194508496, 3043166013]`. Duplicate: `replay: true`, rng and receipts unchanged (5 at revision 4). Red control: a new id advances the rng to `[3357924830, …]`. |
| 12 | SQLITE_CORRUPT on the phone | **pass** | Root page byte 0 → `0xff` on `state_row`, `head`, `receipt`: each `save_corrupt`; red control: each undamaged copy opens. |
| 13 | Airplane-mode resume | P6b | Not rerun (owner-toggled; P6b row stands). |
| 14 | Input responsiveness | P6b, partial | Not rerun; carried to the gate's touch play as P6b records. |
| 15 | Hashes, redaction, failing runs kept | **pass** | `SHA256SUMS` + `SHA256SUMS.verify`; `docs/evidence/**` is `-whitespace`; planted and mutant runs kept. The drivers ([dev-drive-phone.sh.txt](dev-drive-phone.sh.txt), [dev-common.sh.txt](dev-common.sh.txt)) are byte-identical to P6b's, so P6b's driver red controls carry over. |

**Simulator dry run:** not rerun; the Node self-check gates the harness (`node p6/node-run.ts 19`:
self-check failures 0 on every phase).

**Owner saves (inspected, [owner-saves.sha256](owner-saves.sha256)):** copied off before the first
install (no `-journal`/`-wal` existed; `PRAGMA integrity_check` ok on scratch copies). After the
harness, planted and mutant runs, after the clean install, and after its one launch, both are
byte-identical to that copy (and to P6b's hashes). The harness touches only `p6-*` files.

**Final install (inspected):** a clean Release build of 73927a1 (bundle has no harness string and
has "You are too exhausted."). Launched once, no press:
[clean-launch-old-lantern-save.png](clean-launch-old-lantern-save.png) (`devicectl device capture
screenshot`) shows "The save needs a version of the story this app does not have.
(pinned_release_missing)" and a Start over button. The owner's Lantern save is pinned to the old
hash `050cba8c…`; `openStory` only reads it. Start over was not pressed.

## Runbook

As P6b's runbook, with these changes: [dev-harness.ts.txt](dev-harness.ts.txt) checks the new hash
and walks away in `lost`; [dev-App.tsx.txt](dev-App.tsx.txt) uses `BUILD = 'rerun'` (red controls:
`rerun-planted`, `rerun-mutant`; fresh names because the phone keeps P6b's done files).
[dev-node-expected.ts.txt](dev-node-expected.ts.txt), [dev-metro.config.diff](dev-metro.config.diff),
[dev-stats.py.txt](dev-stats.py.txt) and the drivers are unchanged. Node bytes:
[node-expected.json.gz](node-expected.json.gz) (`gzip -dc`). Phases on the phone: `ka` through
`hold3b` ([drive-phone-rerun.log](drive-phone-rerun.log)), then `time1`-`time6`
([drive-phone-time.log](drive-phone-time.log)); planted `ka sim carry1 carry2`, mutant `ka` through
`dusk`. After the mutant build the mutant was reverted; `git diff 73927a1 -- kernel mobile` was empty
before the clean build. The `ERROR: Failed to retrieve …` driver lines are copies of files that do
not exist (as in P6b).

Hashes: `SHA256SUMS`, verified in `SHA256SUMS.verify`.
