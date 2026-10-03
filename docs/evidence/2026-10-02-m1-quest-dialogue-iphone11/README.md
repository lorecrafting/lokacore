# M1 Quest from dialogue: device rows on the iPhone 11, 2026-10-02

Result: **every automated row passes on the phone at ea3cd6b (#120 head); 0 Node/Hermes byte
mismatches over 1,587 records; the planted and mutant red controls fail; the clean build shows
Bram's offer as a dialogue choice.** Same rows, drivers and method as
[the R6P rerun](../2026-10-02-r6p-rerun-iphone11/README.md) (#112) and
[the savefix run](../2026-10-02-r6p-savefix-iphone11/README.md); only the differences are written here.
Why a rerun: M1 changes the Lantern cartridge (hash `806508c7…`) and moves the quest's accept from a
place action to a talk plus a choose, so every Lantern byte changed.
Spec: [pre-release-proof.md](../../archive/spec/pre-release-proof.md) P6; [mechanics](../../system/mechanics.md);
[owner decision](../../decisions/owner-decision-quest-from-dialogue-2026-10-02.md).

Facts are labeled **device-reported**, **inspected** or **owner-reported**. Device name, UDID, team,
container ids and paths are withheld; driver output went through `redact`
([dev-common.sh.txt](../2026-10-02-r6p-rerun-iphone11/dev-common.sh.txt)).

## Build facts

- **Inspected:** harness, planted, mutant and clean builds are from `m1-quest-dialogue` ea3cd6b
  (code at 01d9adf; ea3cd6b changes only `docs/ROADMAP.md`). CI on ea3cd6b: `ci` 37089244535 and
  `mobile-bundle` 37089244541, both success. Xcode 27.0, Release, free personal team, each build in
  its own derived-data folder, installed with `devicectl device install app`.
- **Inspected (Node anchor):** at ea3cd6b with the harness applied, `git diff ea3cd6b -- kernel protocol
  docs/spec` empty; `lantern.test.ts` + `lantern_proof.test.ts` 19 pass, 0 fail (Node 24.21.0);
  `node p6/node-run.ts 18`: `N=18 data.ts bytes=1999793 self-check failures=0`, and `data.ts` sha256
  `2a7619ff…` equals the earlier copy. Node bytes: [node-expected.json.gz](node-expected.json.gz)
  (`gzip -dc`; sha256 of the plain file `ad63f530…`).
- **Inspected:** each harness bundle starts with the Hermes magic and has `p6run-`; the planted bundle has
  `clock\":31600` (the harness bundle has none). The clean bundle has no `p6run-` and no
  `injected write failure`, and has "Offer to fetch Bram", `bram_offer` and "You are too exhausted.".
- **Device-reported:** iPhone12,1, iOS 26.6.2 (23G90); Hermes bytecode 98, OSS release 250829098.0.17,
  Static Hermes, Release, GC hades, debugger off. `passcodeRequired: false` before every phase (the
  `drive-phone-*.log` files). Battery before timing 100 %, on the cable, not charging, 31.79 °C
  ([battery-before-timing.txt](battery-before-timing.txt)). **Not checked:** iOS thermal state (null).

## Harness changes (all shifts by one)

[dev-harness-vs-savefix.diff](dev-harness-vs-savefix.diff) against
[the savefix harness](../2026-10-02-r6p-savefix-iphone11/dev-harness.ts.txt): the hash check is
`806508c7…`; `talk` uses the talk Bram's GameView offers (`bram_offer` before the quest, `bram` after) and
the place action `activate` is gone; the kill is between steps 5 and 6 (was 4 and 5); revisions 5/10/9
become 6/11/10; `badjson` uses `localSession` (the presenter split renamed `playSmoke`). Each Lantern trace
is 11 steps, so a timing run has 11 decisions (was 10). The sim sample is 18 seeds (was 19): N = 18 is the
largest whose `data.ts` stays ≤ 2,000,000 bytes (1,999,793). [dev-App.tsx.txt](dev-App.tsx.txt): `BUILD = 'm1'`
(red controls `m1-planted`, `m1-mutant`). Unchanged and linked, not copied:
[node runner](../2026-10-02-r6p-rerun-iphone11/dev-node-expected.ts.txt),
[metro diff](../2026-10-02-r6p-rerun-iphone11/dev-metro.config.diff),
[drive-phone](../2026-10-02-r6p-rerun-iphone11/dev-drive-phone.sh.txt) and common (byte-identical, checked
with `cmp`), [stats](../2026-10-02-r6p-rerun-iphone11/dev-stats.py.txt),
[mutant](../2026-10-02-r6p-rerun-iphone11/dev-mutant.diff).

## Results

| # | Row | Result | Proof |
|---|---|---|---|
| 2 | Phone timing | **pass, reported** | [timing-phone.txt](timing-phone.txt) ([run-time/run.txt](run-time/run.txt)): 330 warm decisions over 6 launches (5 counted runs of 11 per launch). Decision p50 0.64 / p95 1.78 / p99 1.81 ms; end to end p50 6.84 / p95 9.73 / p99 10.57, max 11.06 ms; commit p50 1.90 / p99 3.11; sink p50 1.41 / p99 1.79; projection p50 0.37 / p99 0.89 ms. Cold new 7.80 / 7.37 / 7.35; cold restore of carry2's save at revision 11 4.02 / 4.42 / 3.62 ms. |
| 4 | Both paths, save/restore | **pass** | carry and leave killed between steps 5 and 6 (`carry1`/`leave1` HOLD); relaunch `{"n":6,"r":6}`, steps 6-10 to `{"n":11,"r":11}` ([run-m1/run.txt](run-m1/run.txt)). |
| 5 | Node/Hermes bytes + sim | **pass** | `ka` through `hold3b` all `mismatches=0 checks_failed=0` ([drive-phone-m1.log](drive-phone-m1.log)); 58 checks pass, 0 fail; 1,436 sim records (seeds 1-18), all 18 start states match. |
| 6 | Known answers on Hermes | **pass** | items, dusk: no mismatch; the Lantern loads with hash `806508c7d82223575e74873b7e60ffd61705e675cf0989d0f864e916de6b9e84` and the fixture's canonical value. |
| 7 | Mid-commit kill | **pass** | **Inspected** ([run-m1/hold1/](run-m1/hold1/), hashed before any open): 35,360-byte `-journal`, magic `d9d505f920a163d7`; on scratch copies `sqlite3` reads revision 10, 10 receipts with the journal (rolled back), revision 11, 10 receipts from the db alone. Relaunch `{"held":0,"n":10,"r":10}`; retry commits once, then replays. |
| 8 | After COMMIT; narration | **pass** | Hold 2: `{"held":1,"n":11,"r":11}`, retry replays. Hold 3: reopen narration equals the held reply's (`proof.carry`). |
| 9 | Before COMMIT | **pass** | `rolled_back`; memory and storage (`{"n":10,"r":10}`) unchanged; no open transaction; retry commits once. |
| 10 | Lost response | **pass** | resend replays the lost decision, revision 12 unchanged; a new id → `rejected invalid_state`. |
| 11 | Failed roll, duplicate | **pass** | `failure`, one `check_failed`, `rng_state` `[619855573,1505027126,3194508496,3043166013]`; duplicate replays; new id advances to `[3357924830,…]`. |
| 12 | SQLITE_CORRUPT; A01 | **pass** | `state_row`, `head`, `receipt` damaged: each `save_corrupt`, undamaged copies open. `badjson`: `save_corrupt`, `replace: false` (expo `malformed JSON`); Start over in place opens. |
| 15 | Hashes, redaction, failing runs kept | **pass** | `SHA256SUMS` + `SHA256SUMS.verify`; planted and mutant runs kept. |
| Red | planted | **fails as planted** | [dev-planted.diff](dev-planted.diff): `carry2 … mismatches=1`, `MISMATCH lantern-carry[7] state` only ([run-planted/run.txt](run-planted/run.txt), [drive-phone-planted.log](drive-phone-planted.log)). |
| Red | on-device mutant | **fails** | `rotl(s3, 11)` → `12`, Node bytes not regenerated: `dusk … mismatches=6 checks_failed=1`, `rng_state literal FAIL "[…,1791364731]"`; ka, sim, carry, leave, lost stay green (they draw no RNG) ([run-mutant/run.txt](run-mutant/run.txt)). Reverted; `git diff ea3cd6b -- kernel mobile` empty before the clean build. |

Rows 1, 3 (above), 13 and 14 stand as recorded in #112. The `ERROR: Failed to retrieve …` driver lines
are copies of files that do not exist, as in #112.

## Owner saves

**Owner-reported:** no saves to protect; the app was reinstalled clean. **Inspected:** the container
still held the savefix run's `p6-*` files and a `loka-lantern.db`; the harness reuses only `p6-*` names.
Before the clean install the app was uninstalled (`devicectl device uninstall app`), which removed them.

## Final install

**Inspected:** clean Release of ea3cd6b on a new container, driven with agent-device 0.21.20 on the phone
(its XCTest runner, signed with the free team as `com.lorecrafting.agentdevice.runner`, is now installed on
the phone): Got it, Bram the ferryman, Talk. [clean-talk-bram.png](clean-talk-bram.png) (`devicectl device
capture screenshot`) and [clean-talk-bram-snapshot.txt](clean-talk-bram-snapshot.txt) show Bram's prompt
and the choice "Offer to fetch Bram's lantern" with Close; the room page has no place action (Scan only).
The choice was not pressed.

**Inspected:** a first clean install, opened the same way, already showed "> Talk to Bram the ferryman" and
"> Offer to fetch Bram's lantern" in its history about a minute after launch (pressed on the phone, not by
this run). It was uninstalled and reinstalled before the walk above.

Hashes: `SHA256SUMS`, verified in `SHA256SUMS.verify`.
