# R6 P1 intent digests on iOS Hermes (iPhone 11), 2026-09-30

Result: **pass, 0 mismatches** on `digests()` (`kernel/ts/src/known_answers.ts`) over all 8 rows of
`protocol/fixtures/intent_digest.json` (8 per-row PASS lines), in the same launch that re-ran
`run(items world, cases)` (3 cases) and `run(dusk world, dusk_cases)` (1 case), also 0 mismatches.
Raw device output: [p1run.txt](p1run.txt). This completes the batched step left open by
[the earlier run](../2026-09-30-p1-hermes-iphone11/README.md), which did not call `digests()`.
Spec: [pre-release-proof.md](../../archive/spec/pre-release-proof.md) P1, ADR-074 §3; decision
[owner-decision-p1-hermes-batching-2026-09-30](../../archive/decisions/owner-decision-p1-hermes-batching-2026-09-30.md).

Facts, by source:
- **Device-reported (p1run.txt):** run id `p1-1790806547575`; Hermes Release, bytecode version 98,
  OSS release 250829098.0.17, debugger off; `digests rows=8 mismatches=0`, `done mismatches=0`.
- **Inspected:** the run id's timestamp is after the launch (host epoch second 1790806545), so the file
  is this launch's, not the earlier run's; `main.jsbundle` starts with the Hermes bytecode magic
  (`c6 1f bc 03 c1 03 19 1f`) and contains `loka-kernel` and `loka-intent-v1`; source was `origin/main`
  001c4c9 plus the temporary wiring below. Release build, free personal team, automatic signing.
- **Inspected (run conditions):** before install, `devicectl device info lockState` gave
  `passcodeRequired: false`, `unlockedSinceBoot: true`; the launch put the app in the foreground and the
  run completed.
- **Not checked:** no red control was run on the device (no deliberately wrong digest row); the per-row
  PASS/FAIL label in the wiring tests `x.includes(c.intent_digest)` on each mismatch message, which
  holds both the expected and the ACTUAL digest. So a failure can make a different row print FAIL too
  (a target-order bug making row 3 return row 4's digest would print FAIL on row 4 as well), and rows 1
  and 2, which share a digest, would both print FAIL; the `mismatches=` count from `digests()` is
  authoritative. Only the 8 frozen rows were run.

Steps (same as the earlier run; wiring temporary and not committed, kept here as
[dev-metro.config.diff](dev-metro.config.diff), identical to the earlier one, and
[dev-App.tsx.txt](dev-App.tsx.txt), which adds the `digests()` call over `cases`):
1. `git worktree add -b r6-p1-digests-evidence ../lokacore-p1-digests origin/main`; `npm ci` in the root,
   `kernel/ts` and `mobile/app`.
2. Apply the metro diff and replace `mobile/app/App.tsx` with dev-App.tsx.txt. It runs the two `run`
   worlds as before, then `digests(fixture.cases)`, and writes per-case PASS/FAIL, mismatches and the
   run id to `Documents/p1run.txt` (release builds drop `console.log`).
3. `CI=1 EXPO_NO_TELEMETRY=1 npx expo prebuild --platform ios --no-install`; `pod install` in `ios/`.
4. `xcodebuild -workspace Loka.xcworkspace -scheme Loka -configuration Release -destination id=<device>
   -allowProvisioningUpdates DEVELOPMENT_TEAM=<team> CODE_SIGN_STYLE=Automatic build` with
   `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`. (A first attempt with the wrong team id
   failed at signing; no run came from it.)
5. `devicectl device install app`, then `devicectl device process launch --terminate-existing
   com.lorecrafting.loka`; after 10 s `devicectl device copy from --domain-type appDataContainer
   --domain-identifier com.lorecrafting.loka --source Documents/p1run.txt`.

Hashes: `SHA256SUMS`, verified in `SHA256SUMS.verify`. The folder is `-whitespace` through the
`docs/evidence/**` rule in `.gitattributes`. Device identifiers, team and paths are withheld.
