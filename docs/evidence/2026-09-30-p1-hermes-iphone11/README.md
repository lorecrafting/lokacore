# R6 P1 adapter known answers on iOS Hermes (iPhone 11), 2026-09-30

Result: **pass, 0 mismatches** on `run(items world, cases)` (3 cases, 11 steps) and
`run(dusk world, dusk_cases)` (1 case, 1 step). Raw device output: [p1run.txt](p1run.txt).
Spec: [pre-release-proof.md](../../spec/pre-release-proof.md) P1, ADR-074 §3; decision
[owner-decision-p1-hermes-batching-2026-09-30](../../decisions/owner-decision-p1-hermes-batching-2026-09-30.md).

Facts, by source:
- **Device-reported (p1run.txt):** run id `p1-1790804037351`; Hermes Release, bytecode version 98,
  OSS release 250829098.0.17, "Static Hermes": true, debugger off.
- **Inspected:** `main.jsbundle` in the built app starts with the Hermes bytecode magic
  (`c6 1f bc 03 c1 03 19 1f`) and contains `loka-kernel`; source was `origin/main` 7d56480 plus the
  temporary wiring below. iOS 26.6.2 (23G90), iPhone 11; Xcode 27.0; Node 24.21.0.
- **Not checked:** lock state was read with `devicectl device info lockState` before the run
  (`passcodeRequired: false`, `unlockedSinceBoot: true`); the launch put the app in the foreground
  and the JS run completed, so the run was not interrupted. No red control was run on the device.

Steps (temporary wiring, not committed; the two files are kept here as [dev-metro.config.diff](dev-metro.config.diff)
and [dev-App.tsx.txt](dev-App.tsx.txt)):
1. `git worktree add -b r6-p1-hermes-evidence ../lokacore-p1-hermes origin/main`; `npm ci` in the
   root, `kernel/ts` and `mobile/app`.
2. Apply the metro diff (adds `kernel/ts/test` and `protocol/fixtures` to `watchFolders`) and replace
   `mobile/app/App.tsx` with dev-App.tsx.txt. It loads each cartridge fixture as
   `{"cartridge":canonical,"content_hash":sha256}`, builds `newWorld(cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f', seed)`
   with seed `[1,2,3,4]` (items) and numeric-vectors.json `rng_steps[3].state` (dusk), runs each case
   alone with `run` from `kernel/ts/src/known_answers.ts`, and writes per-case PASS/FAIL, the
   mismatches and a run id to `Documents/p1run.txt`. (Release builds drop `console.log` from
   `devicectl --console`, so the file is the channel.)
3. `CI=1 EXPO_NO_TELEMETRY=1 npx expo prebuild --platform ios --no-install`; `pod install` in `ios/`.
4. `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -workspace Loka.xcworkspace
   -scheme Loka -configuration Release -destination id=<device> -allowProvisioningUpdates
   DEVELOPMENT_TEAM=<team> CODE_SIGN_STYLE=Automatic build` (free personal team).
5. `xcrun devicectl device install app --device <device> Loka.app`, then
   `devicectl device process launch --device <device> --terminate-existing com.lorecrafting.loka`.
6. After 8 s: `devicectl device copy from --device <device> --domain-type appDataContainer
   --domain-identifier com.lorecrafting.loka --source Documents/p1run.txt`.

An earlier launch with `--console` printed nothing from JS (release strips `console.log`); that
launch is not the recorded run.

Hashes: `SHA256SUMS`, verified in `SHA256SUMS.verify`. The folder is `-whitespace` in `.gitattributes`.
Device identifiers, team and paths are withheld.
