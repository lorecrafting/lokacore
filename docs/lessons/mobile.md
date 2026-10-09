# Mobile lessons

Hard-won lessons for `mobile/` and physical-device runs.

The [mobile pause](../decisions/owner-decision-web-first-mobile-pause-2026-10-05.md)
currently forbids Android/iOS development, builds and verification, including Debug
and Release Simulator sessions. Native procedures below apply only after the owner
resumes that work; retained results prove their recorded releases. The Node game
simulator remains an engine check, and isolated browser preview can exercise the
shared client. Neither closes deferred native proof or the known UI blur carry.

**expo-sqlite and React Native**
- `expo-sqlite` 57.0.3 on web: first-open WASM/OPFS initialization can outlast a synchronous
  worker request, so open asynchronously before the existing synchronous authority calls.
  Its worker also writes a sync result's byte length through `Uint8Array.set(Uint32Array)`,
  truncating responses over 255 bytes, and serializes Error objects without their messages,
  hiding SQLite corruption from Start over; it also allocated a 1 MB SharedArrayBuffer per sync
  call, exhausting Chrome's array-buffer memory within 30 s of play (the patch reuses one per
  worker). `mobile/app/patch-sqlite-web.cjs` guards and fixes that installed web file; remove
  the workaround only after browser action/reopen and
  corrupt-save recovery proofs on an updated SDK. The local page needs COOP/COEP headers
  for SharedArrayBuffer.
- expo-sqlite 57.0.3 on Android: opening the same database file twice gives both JS
  handles one native database, and garbage collection of either closes it. Symptom:
  `NativeDatabase.execSync` rejected, `NullPointerException`. Open each database once
  per process.
- expo-sqlite's transaction helpers (`withTransactionSync`,
  `withExclusiveTransactionAsync`) issue COMMIT themselves. To own the COMMIT point
  (fault injection, unknown-commit handling) run `BEGIN IMMEDIATE` / `COMMIT` /
  `ROLLBACK` yourself with `execSync` on one connection.
- The React Native Gradle plugin (`configureDevServerLocation`) writes the build
  machine's IPv4 address into every variant's `resources.arsc`, release included. Pass
  `-PreactNativeDevServerIp=localhost`. APKs then differ only in AGP's encrypted
  dependency-info signing block; the JS bundle, Hermes bytecode and source map are
  byte-identical across builds.
- Record the AGP version with the root `./gradlew buildEnvironment`, not
  `:app:buildEnvironment` (AGP sits on the root buildscript classpath).

<a id="performance"></a>
**Performance (R1, Pixel 3a, Hermes)**
- Copying a 190 KB state per step took 216 ms; structural sharing took under 1 ms.
- Per-action SQLite commits of only changed rows (about 190 bytes) took 6 to 11 ms p99 on the
  Pixel 3a; 1 to 3 ms on an M1 even for whole-state writes.
- A full canonical checkpoint of a 730 KB state took about 490 ms (not split into
  write/read/parse/encode); measure it split.

**Mobile builds**
- Iterate on the M1; CI builds are clean-build proof, not the edit loop. Measured 2026-09-24
  (Expo 57, arm64 release): Android clean 78 s (346 s first, with NDK), JS change 9 s; iOS
  `pod install` 23 s, clean `xcodebuild` 50 s, JS change 9 s; CI Android uncached job 6 min 15 s.
- `pod install` writes React Native codegen into `ios/build/generated`. Never
  `rm -rf ios/build` or use it as `-derivedDataPath`; rerun `pod install` if it is gone.

**Physical-device runs**
- After native work resumes, a slice's automated device rows follow the then-current
  [owner rule](../system/owner-rules.md). During the pause, those rows remain deferred.
- Until the first free product gate the only phone is the iPhone 11
  ([owner decision](../archive/decisions/owner-decision-android-descope-2026-09-30.md)). After
  that the owner can connect only one phone at a time: batch all work per phone; ask for a
  swap only when needed.
- A locked screen stops the app's JS. Check the lock state before a run; keep the app in
  the foreground; treat a lock or backgrounding as an invalid foreground performance run. A deliberate
  lifecycle test instead records the inactive interval and verifies saved absence on resume.
- Every wait on a device needs a timeout (for example 120 s per launch, a 10 minute
  progress watchdog). An unbounded `until grep …` loop hung for minutes once.
- The Android logcat ring buffer keeps lines from earlier runs; a stale progress marker
  once looked like a finished run. Match on the current process id or a run id.
- iOS: `xcode-select` may point at the Command Line Tools; set
  `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` (no sudo). Signing uses the
  owner's free personal team (automatic signing); nothing paid, no EAS.
- iOS symbolication with `atos`: look up the return address minus 1, or it names the
  wrong function.

**iOS simulator**
- Xcode 27 exposes Simulator windows through DeviceHub (`com.apple.dt.Devices`); a missing
  standalone Simulator.app is not evidence that the Simulator runtime is missing. Use
  DeviceHub for the GUI and the installed Xcode developer directory for simctl.
- iOS 27 crashes at launch (SIGTRAP, `NoSceneLifecycleAdoption`) unless the app adopts the
  UIScene lifecycle. Expo 57 ships the scene delegate but its template does not wire it;
  `mobile/app/plugins/with-ios-scene.js` does, at every prebuild. Never hand-patch `ios/`.
- agent-device: its daemon keeps the environment it first started with; after setting
  `DEVELOPER_DIR`, run `agent-device daemon stop`. `open --relaunch` keeps the save.
  Fresh-install tests use a disposable isolated app/profile and save, after native work
  resumes. Never uninstall the owner's app or clear, replace or re-pin its save.
  For a bundle-change test, retain a byte witness of the disposable prior-release
  save and verify explicit pin mismatch refusal leaves its complete bytes unchanged.
  A fresh test run or confirmed Start over belongs only to the isolated test profile. The
  [forward-development rule](../decisions/owner-decision-forward-development-2026-10-05.md)
  permits current pins to advance while preserving that explicit refusal.
- The retained M1-B2 Release walk follows [Book navigation](../system/book-ui.md) and
  [M1-B2 native evidence](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-04-m1-b2-lifecycle/README.md), including status
  Contents, full NPC details, Conversation/Leave after departure, and saved continuation
  recovery. Copy exact current labels from `snapshot -i`; selectors with spaces are one
  shell argument, with their quotes inside. Keep map gestures below the scrolling page;
  use a page-text `gesture pan` for the reading scroll.
- A ScrollView drawn over other content blurs its text on iOS 27 (the system scroll edge effect); the NPC menu
  is a plain View for that reason.
- An `Animated.View` with a `transform` around the footer map's dot displaced the dot after the map tip went and
  the page changed (R6P Polish O-1), even with the transform at identity. The dot is now a `Disc` placed from state.
  After native work resumes, check a footer fix with a fresh install in the isolated
  test profile, the tip still showing: tap Map, then Back, and look at the dot.
- `xcrun simctl` cannot tap. A screenshot of a deeper UI state needs a temporary local
  edit that starts the app on that state; such shots are static and prove layout only,
  not navigation or gestures.
- An agent-device `scroll` can start its pan on the footer's map joystick and walk the
  character (R6P Polish note 5). Scroll the page with `gesture pan` from a point in the text.
