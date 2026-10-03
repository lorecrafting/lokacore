# Mobile lessons

Hard-won lessons for `mobile/` and physical-device runs.

**expo-sqlite and React Native**
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

**Mobile builds (measured 2026-09-24, minimal Expo 57 app, arm64 release)**
- M1 Air: Android clean 78 s with warm download caches (first ever, with NDK download,
  346 s); JS change with a warm Gradle daemon 9 s. iOS `pod install` 23 s, clean
  `xcodebuild` 50 s, JS change 9 s. GitHub CI Android, uncached: Gradle 349 s, job 6 min 15 s.
  Iterate on the M1; CI builds are clean-build proof, not the edit loop.
- `pod install` writes React Native codegen into `ios/build/generated`. Never
  `rm -rf ios/build` or use it as `-derivedDataPath`; rerun `pod install` if it is gone.

**Physical-device runs**
- A slice's automated device rows run on a Release iOS Simulator build ([owner rule](../system/owner-rules.md)).
- Until the first free product gate the only phone is the iPhone 11
  ([owner decision](../archive/decisions/owner-decision-android-descope-2026-09-30.md)). After
  that the owner can connect only one phone at a time: batch all work per phone; ask for a
  swap only when needed.
- A locked screen stops the app's JS. Check the lock state before a run; keep the app in
  the foreground; treat a lock or backgrounding as an invalid run.
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
- iOS 27 crashes at launch (SIGTRAP, `NoSceneLifecycleAdoption`) unless the app adopts the
  UIScene lifecycle. Expo 57 ships the scene delegate but its template does not wire it;
  `mobile/app/plugins/with-ios-scene.js` does, at every prebuild. Never hand-patch `ios/`.
- agent-device: its daemon keeps the environment it first started with; after setting
  `DEVELOPER_DIR`, run `agent-device daemon stop`. `open --relaunch` keeps the save; for a
  fresh start, uninstall and reinstall the app.
- The walk on a fresh Release build (the Lantern, Ferry Landing): `press 'label="Got it"' --settle`
  (the map tip; wait 2 s after `open`, an early press misses), `press "label=\"Offer to fetch Bram's lantern\"" --settle`,
  `press 'label="Map"' --settle`. Bram is a context menu: `press 'label="Bram the ferryman, open"'` opens it,
  `press 'label="Talk to Bram the ferryman"'` shows the choice and Close in it, `press 'label="Done"'` hides it
  (a pending choice shows it again in the next room). Journal, Carrying and Settings are taps on the Character
  page: `press` the status line's button (its label starts "Character, hp ..."; copy it from `snapshot -i`).
  A selector with spaces is one shell argument, quotes inside. The footer map takes a raw
  `gesture pan 207 781 0 -55 5000` (north; 55 px is about 21 map units); take a mid-drag shot with
  `xcrun simctl io <udid> screenshot` while that runs in the background (`agent-device screenshot` waits for the
  pan). `scroll` does not move the book's pages; a raw `swipe 200 600 200 250` does.
- A ScrollView drawn over other content blurs its text on iOS 27 (the system scroll edge effect); the NPC menu
  is a plain View for that reason.
- An `Animated.View` with a `transform` around the footer map's dot displaced the dot after the map tip went and
  the page changed (R6P Polish O-1), even with the transform at identity. The dot is now a `Disc` placed from state.
  Check a footer fix with a fresh install, the tip still showing: tap Map, then Back, and look at the dot.
- `xcrun simctl` cannot tap. A screenshot of a deeper UI state needs a temporary local
  edit that starts the app on that state; such shots are static and prove layout only,
  not navigation or gestures.
- An agent-device `scroll` can start its pan on the footer's map joystick and walk the
  character (R6P Polish note 5). Scroll the page with `gesture pan` from a point in the text.
