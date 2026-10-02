# R6P P6b: device proof on the iPhone 11, 2026-10-02

Result: **13 of 15 rows pass on the phone. Row 14 is partial. Row 1 is P6a's (merged, #105).
0 Node/Hermes byte mismatches.** Spec: [pre-release-proof.md](../../spec/pre-release-proof.md)
P6 and "Evidence required to finish R6P"; [envelope](../../spec/r1-acceptance-envelope.md) §4
(release build, battery recorded, cold apart from warm) and §5 (decision timing apart from
persistence and projection); ADR-074 §3; 04 §§14-15 (receipts, unknown COMMIT); 03 §14; OFF-07.
Brief: R6P P6 Part B. The carries: ROADMAP R6P row, from
[Gate R6](../../decisions/owner-decision-gate-r6-carries-2026-09-30.md).

Facts are labeled by source: **device-reported**, **inspected**, **owner-reported (paraphrased)**,
**not checked**. Device name, UDID, team, container ids and paths are withheld. Every capture went
through the driver's `redact` (`dev-drive-phone.sh.txt`).

## Build facts (row 3)

- **Inspected:** source `origin/main` a559ffd, which includes P6a's producer. CI on a559ffd: `ci`
  run 37025379766 and `mobile` run 37025380269, both success. At the same SHA, `lantern.test.ts`
  (the frozen Lantern traces) passed locally: 15 pass, 0 fail, Node 24.21.0. Its independence
  carries over to the Node bytes (AGENTS.md "Expected values").
- **Inspected:** Expo 57.0.24, React Native 0.86.3, expo-sqlite 57.0.3, Xcode 27.0. Release
  configuration, free personal team, installed with `devicectl device install app` (no uninstall).
  `main.jsbundle` starts with the Hermes magic `c6 1f bc 03 c1 03 19 1f`.
- **Device-reported (p6run):** Hermes bytecode version 98, OSS release 250829098.0.17, Static
  Hermes, Release, GC hades, debugger off.
- **Device-reported (devicectl):** iPhone 11 (iPhone12,1), iOS 26.6.2 (23G90). The lock state was
  read before every phase: `passcodeRequired: false` each time (`drive-phone-main.log`).
- **Device-reported (libimobiledevice, before the timing phases):** battery 96 %, charging on the
  cable, battery temperature 32.79 °C. **Not checked:** iOS thermal state (no tool here reads it),
  so it is null.
- Cartridge: the Lantern known answer, content hash
  `050cba8c964be222d47454c0a2e833dc592cfc905c8bcd09bb2def34f908b89d`. Conformance profile: null
  (none exists).

## Results

| # | Row | Result | Proof |
|---|---|---|---|
| 1 | Latency producer (Node) | P6a, #105 | Not in this PR. |
| 2 | Phone timing | **pass, reported** | Fix round 1 run (`r1`, [p6run-phone-r1.txt](p6run-phone-r1.txt), [timing-phone-r1.txt](timing-phone-r1.txt)): 300 warm NEW decisions, 6 launches; per launch 6 runs of 10 decisions alternating carry and leave, the first a warm-up and excluded. Decision (the P6a sink rows): p50 0.71, p95 1.86, p99 1.92 ms. The envelope §5 Tiny row (2/5/10) is for information only; the Lantern is Tiny-sized. End to end (admission + decision + commit + trace + sink + GameView projection): p50 6.83, p95 9.50, p99 10.04, max 10.63 ms. Timed apart: game commit p50 1.86 / p99 2.91 ms; sink write p50 1.38 / p99 1.97 ms; projection p50 0.39 / p99 0.84 ms. **Cold**, each the first open in a fresh process (killed and relaunched): a new save (time1-3) 7.36 / 7.73 / 7.62 ms; a restore of the played save carry2 left at revision 10 (time4-6) 3.32 / 3.55 / 3.55 ms. Second opens in the same process (not cold): restore 3.35 / 2.65 / 2.66, new 5.93 / 6.47 / 6.30 ms. The first run's figures ([timing-phone.txt](timing-phone.txt), [p6run-phone-main.txt](p6run-phone-main.txt), 150 decisions) agree; its restore was a second open, not cold (review P6B-1, F-2). |
| 3 | Build facts | **pass** | Above. |
| 4 | Both paths, save/restore | **pass** | carry and leave through `openStory` on expo-sqlite, killed after step 4 (`carry1`/`leave1` HOLD, `devicectl … terminate --kill`). After relaunch: revision 5 and 5 receipts, then steps 5-9 to revision 10 and 10 receipts. Every reply and state equals the Node bytes. Red control (planted): one byte of the bundled expected value of `carry2/lantern-carry[7] state` flipped (`"clock":21600` to `31600`). Result: `carry2 … mismatches=1` at exactly that step, with both byte strings ([p6run-phone-planted.txt](p6run-phone-planted.txt)). |
| 5 | Node/Hermes bytes + sim sample | **pass** | 0 mismatches over 1,530 sim records (seeds 1-19, the largest N whose bundled data stays ≤ 2,000,000 bytes: 1,985,509) and every Lantern record. Each seed's start state bytes match. Red control (on-device mutant, [dev-mutant.diff](dev-mutant.diff), `rotl(s3, 11)` → `12` in `rng.ts`): `dusk … mismatches=6 checks_failed=1`, `rng_state` `[…,1791364731]` against `[…,3043166013]`, with the bytes ([p6run-phone-mutant.txt](p6run-phone-mutant.txt)). **Finding:** the mutant left all 19 sim seeds green. The known answers (`ka`) also stayed green. Neither the sampled sequences nor the known answers draw the RNG, so RNG parity on Hermes rests on the dusk row. |
| 6 | Known answers on Hermes | **pass** | `known_answers.ts run` on items (3 cases) and dusk (1 case): 0 mismatches. The Lantern known answer loads with hash `050cba8c…` and the canonical value of the fixture. |
| 7 | Mid-commit kill | **pass** | `PRAGMA journal_mode` = `delete`. Hold 1: rows written, COMMIT not issued, killed. The copy taken before the relaunch ([hold1-before-relaunch/](hold1-before-relaunch/)) has a 35,360-byte `-journal` whose header magic is `d9d505f920a163d7`, so the journal is hot. Opened read-write with `sqlite3` on the Mac (a copy), it rolls back to revision 9, 9 receipts, 0 for the held command, and the journal is deleted. Red control: the db file alone, without its journal, reads revision 10 with 9 receipts (half a transaction). This proves the kill left an open transaction. Relaunch (`hold1b`): revision 9, no receipt for the held command; the retry commits once (revision 10); a second retry replays. |
| 8 | After COMMIT; narration boundary | **pass** | Hold 2 (after COMMIT, before adopt, killed): relaunch shows revision 10 with the command's receipt; the retry replays (`replay: true`). Hold 3 (after the reply, before display, killed): reopen `narration()` equals the held reply's narration (`proof.carry`). |
| 9 | Before COMMIT | **pass** | The receipt write fails: the authority throws (`rolled_back`). Memory state bytes, head, receipt count and every `state_row` are unchanged, and no transaction is open. The retry commits once. |
| 10 | Lost response | **pass** | `carry` chosen, reply discarded, then `wait until 19:00` (the choice is gone). The resend gives `replay: true`, the same decision bytes as the lost reply and the Node bytes, and revision 11 unchanged. Red control: the same choose with a new invocation id gives `rejected invalid_state`. |
| 11 | Failed roll, duplicate | **pass** | Dusk via `openStory`, seed and commands of `schedule.jsonl:1-6`. `pick_lock`: outcome `failure`, one `check_failed`, `rng_state` `[619855573, 1505027126, 3194508496, 3043166013]` (the transcript's literal; Node reproduces it). Duplicate: `replay: true`, rng unchanged, receipts unchanged (5, at revision 4). Red control: a new invocation id advances the rng to `[3357924830, …]`. |
| 12 | SQLITE_CORRUPT on the phone | **pass** | S6a's recipe, byte 0 of the root page set to `0xff`, on `state_row`, `head` and `receipt` of `p6-corrupt-*.db`. Each gives `openStory` → `save_corrupt`, so expo-sqlite's text matched `corrupt()`. Red control: an undamaged copy of each opens. |
| 13 | Airplane-mode resume | **pass** | **Owner-reported (paraphrased):** the phone was unlocked and already in airplane mode. **Device-reported:** the status bar shows the airplane icon in both screenshots. On the instrumented UI build (the real book UI; its save `p6-ui.db`), after the carry ending and a wait to 07:00, the app was killed over the cable (`devicectl … terminate --kill`) and relaunched with `devicectl … process launch`. **Inspected:** the save copied before the kill and after the relaunch: revision 13, 13 receipts both times. The reopened screen is the same place (Ferry Landing, 07:00) with the last committed narration ("You keep the lantern…"). [row13-before-kill.jpg](owner-rows/row13-before-kill.jpg), [row13-after-relaunch.jpg](owner-rows/row13-after-relaunch.jpg), [row13-saves.txt](owner-rows/row13-saves.txt). The gate's non-developer airplane-mode item (pre-release-proof.md:84) is separate and still the owner's. |
| 14 | Input responsiveness | **partial** | Not met: envelope §5's touch-to-visible-feedback. The measure below starts inside the button handler, so it is supplemental evidence only. **Carry:** true touch-to-visible-feedback is judged at Gate R6P by the owner playing by touch (the gate record notes any felt lag); a measured touch-to-photon (for example external slow-motion video) is carried to the chapter-one device row. agent-device drove the phone by touch (both endings, Start over, the 19:00 wait). [dev-ui.diff](dev-ui.diff), [dev-ui.ts.txt](dev-ui.ts.txt). Session 2 ([p6-ui-session2.txt](owner-rows/p6-ui-session2.txt), 13 presses): press handler start → the first frame after the reply renders: p50 42.7, p95 48.0, max 48.0 ms (gate: p95 ≤ 100 ms); no frame gap over 100 ms. Touch start → that frame: p50 112.5, max 946.3 ms. That measure includes how long agent-device's synthesized touch is held before release (taps ~940 ms, drags ~100 ms), so it is not reported as latency. Session 1 ([p6-ui-session1.txt](owner-rows/p6-ui-session1.txt), 23 presses, touch measure only): one frame gap of 112.1 ms. True touch-to-photon latency: null. A human-touch sample is not taken. |
| 15 | Hashes, redaction, failing runs kept | **pass** | `SHA256SUMS` and `SHA256SUMS.verify`; the folder is `-whitespace`; the planted and mutant runs and the first Simulator run (driver out of step after a failed launch, run on ddfc464) are kept. Fix round 1 (review P6B-2, P6B-3): both drivers count a phase done only from a run that began after the run file's length at launch, matched on that run's `P6RUN` id, so a retained log or done marker never counts; every printed and retained line passes `redact` (home, scratch paths, device, team, uppercase UUIDs such as container and simulator ids, the device's name), shared in [dev-common.sh.txt](dev-common.sh.txt). Red controls on made-up input ([dev-controls.sh.txt](dev-controls.sh.txt), [controls.txt](controls.txt)): an unchanged retained log is not done (the old rule counted it); each identifier kind is redacted. Removing the UUID rule, or reading the whole log instead of the lines after the mark, fails them. Fix round 2 (P6BF-1..3): the phone driver stops when the baseline copy fails for any reason but the file not existing yet; both drivers keep the failing exit status through `redact` (`setopt pipefail`); the raw polling copy lives in a temporary directory removed on every exit, and only its redacted copy is kept. Red controls with a fake `xcrun` ([dev-controls-drivers.sh.txt](dev-controls-drivers.sh.txt), [controls-drivers.txt](controls-drivers.txt)): a failed baseline stops non-zero before any launch; a forced launch failure exits non-zero (phone and sim); an old begin/done pair times out non-zero; no raw file is left after a failure. Removing `pipefail`, ignoring the baseline failure, or keeping the raw file in the output folder each fails them. The fixed driver ran phases `ka` (baseline: file absent) and `sim` (baseline: 5 lines) on the phone, both pass ([p6run-phone-r2.txt](p6run-phone-r2.txt), [drive-phone-r2.log](drive-phone-r2.log)). P6BG-1 (PM ruling, after the round limit): completion is bound to the launch, not to a baseline. Each launch gets a fresh nonce as the launch argument `-p6nonce <n>`; the app reads it with React Native's `Settings` (NSUserDefaults' argument domain) and writes it into its `P6RUN` id (`p6-<ms>-n<nonce>`); the drivers count only that launch's done/HOLD/ERROR line, so the baseline copy and line counting are gone. Red controls: a copy that says missing and then holds an old launch's begin/done pair times out non-zero; a retained log, another launch's lines, or this launch's line for another phase never count; this launch's done line exits 0. Ignoring the nonce fails them ([controls.txt](controls.txt), [controls-drivers.txt](controls-drivers.txt)). P6BH-1: the nonce is drawn afresh for each launch attempt, so a retry after a lost launch response never accepts attempt 1's done/HOLD line; red control (phone and sim): attempt 1 writes its done line but returns no PID, and the retry times out non-zero (reusing one nonce across attempts fails it). End to end: phase `ka` on the phone ([p6run-phone-r3.txt](p6run-phone-r3.txt), [drive-phone-r3.log](drive-phone-r3.log)) and `ka`, `sim` on the Simulator ([drive-sim-r3.log](drive-sim-r3.log)) pass with their nonces. |

**agent-device on the phone (inspected):** in the first run it was tried 3 times. Every time the phone showed "Enter
iPhone Passcode for XCTest — Enable UI Automation", and the runner's snapshot timed out. This is
an owner item; for rows 13/14 (owner awake) it drove the phone. The UX notes' touch walk ran on the Simulator:
[ux-notes.md](ux-notes.md) (18 notes).

**Owner saves (inspected):** the harness touches only `p6-*` files (`open`, `remove`, `read` and
`write` throw on other names), and the UI build's bundle contains no `loka-lantern.db` string. The
full hashes are in [owner-saves.sha256](owner-saves.sha256): the copy before the first install,
and the copies before the fix-round-1 install and after the final reinstall, all equal. The final
install is a clean Release build of a559ffd (this PR changes only docs). It was not launched. The harness's `p6-*`
files stay in the app's Documents; the app never opens them.

## Runbook

The harness ([dev-harness.ts.txt](dev-harness.ts.txt)) is one module. Its two entries are
[dev-App.tsx.txt](dev-App.tsx.txt) (Hermes, expo-sqlite) and
[dev-node-expected.ts.txt](dev-node-expected.ts.txt) (Node, node:sqlite). The Node entry is
TypeScript run by Node's type stripping, not `.mjs` as the brief named it. Ids come from
per-phase counters, the same on both hosts. Each launch runs the next phase not yet in
`Documents/p6-done-<build>.txt` and appends its lines to `Documents/p6run-<build>.txt`.
Faults come from a `Db` wrapper in the harness. No production module changed.

1. `git worktree add` at a559ffd; `npm ci` in the root, `kernel/ts` and `mobile/app`.
2. Copy `dev-harness.ts.txt` to `mobile/app/p6/harness.ts`, `dev-node-expected.ts.txt` to
   `mobile/app/p6/node-run.ts`, and `dev-App.tsx.txt` to `mobile/app/App.tsx`; apply
   `dev-metro.config.diff`.
3. `cd mobile/app && node p6/node-run.ts 19`. It writes `p6/data.ts` (the sim sample and the
   expected bytes, 1,985,509 bytes) and `p6/node-expected.json` (here gzipped:
   [node-expected.json.gz](node-expected.json.gz), `gzip -dc`). Then it replays every phase on Node
   against the bytes: 0 failures.
4. `npx expo prebuild --platform ios --no-install`, `pod install`, then a Release `xcodebuild`
   (free team, automatic signing). Simulator first: `DEV=<sim> dev-drive-sim.sh.txt <build> <out> <phases…>`
   ([p6run-sim-r1.txt](p6run-sim-r1.txt), a dry run and not evidence). Then the phone:
   `devicectl device install app`, and `DEV=<device> dev-drive-phone.sh.txt <build> <out> <phases…>`
   (both source `dev-common.sh.txt` as `common.sh`; the `main` and `r1` runs used earlier drivers that matched on the run id after a line baseline, not on a launch nonce).
   The driver launches each phase and polls the run file (bounded: 40 polls, about 120 s). On HOLD
   it copies `p6-<phase>.db` and `-journal` before the kill, then kills with
   `devicectl device process terminate --kill`. The `ERROR: Failed to retrieve …` lines are the copy of names
   that do not exist: `p6-carry1.db` and `p6-leave1.db` (those saves are `p6-lantern-*.db`, not copied
   before their kills; their reopen checks revision and receipts instead) and the absent `-journal` of holds 2 and 3.
5. Red controls: set `BUILD` to `planted` or `mutant`, rebuild, and run phases
   `ka sim carry1 carry2` (planted) or through `dusk` (mutant). Planted: flip one byte of the
   expected value in `p6/data.ts`. Mutant: apply `dev-mutant.diff`, build, then revert it. After
   the runs, `git diff origin/main -- kernel mobile` was empty.
6. Timing: phases `time1`-`time3`, then [dev-stats.py.txt](dev-stats.py.txt).

Hold 1 sets `PRAGMA cache_size = 1` on its own connection before the held COMMIT. The transaction
then spills its pages into the db file, so the kill leaves a synced (hot) journal and a changed db
file. Without the spill (the first Simulator dry run) the journal header stayed zeroed and the db
file unchanged, which SQLite does not count as hot. **PM default, stated plainly:** this held
transaction stands in for "a kill during COMMIT". A kill inside SQLite's own fsync cannot be aimed.

**Carry (review, row 5): RNG parity, done.** The rows 13/14 build replayed `numeric-vectors.json`
`rng_steps` on Hermes from `initial_rng` (`dev-ui.ts.txt`): 5 of 5 steps PASS, raw and state equal to
the fixture literals, `mismatches=0` ([p6-ui-session1.txt](owner-rows/p6-ui-session1.txt)).

Hashes: `SHA256SUMS`, verified in `SHA256SUMS.verify`.
