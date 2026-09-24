# Mobile lessons

Hard-won lessons for `mobile/` and physical-device runs, moved verbatim from AGENTS.md.

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
- zsh does not word-split `$VAR`: wrap repeated commands in `function name { ...; }`.

**Physical-device runs**
- The owner can connect only one phone at a time. Batch all work per phone; ask for a
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
