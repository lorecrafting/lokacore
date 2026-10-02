# Review: iOS 27 simulator UIScene adoption (PR #91)

PR #91 at `dbbf122`. Config/native-scaffolding slice; proportionate review (no mutation of
kernel code; the plugin was exercised directly). Verdict: **APPROVE WITH NOTES**.

## Must be true (derived before the diff)
- A prebuild from committed config yields an Info.plist scene manifest naming a delegate class
  that exists at runtime, and an AppDelegate that delegate accepts: holds. `EXExpoAppSceneDelegate`
  (`@objc` name in `node_modules/expo/ios/AppDelegates/ExpoAppSceneDelegate.swift`) requires an
  `ExpoAppDelegate` conforming to `ExpoReactNativeFactoryProvider` with `reactNativeFactory` set in
  `didFinishLaunching`; the generated AppDelegate does exactly that.
- React Native starts exactly once: holds. The template's `#if os(iOS) || os(tvOS)` window +
  `startReactNative` block is removed; only the scene delegate starts RN.
- openURL, universal links, continueUserActivity still reach RN Linking: holds. The scene
  delegate forwards URL contexts and user activities (warm and cold start) through
  `SceneEventForwarder` into the AppDelegate overrides, deduped against `RCTLinkingManager`;
  cold-start URLs are rebuilt into launch options for `Linking.getInitialURL()`. The app sets no
  URL scheme yet, so this path is latent.
- Drift fails loudly, re-runs are idempotent: holds (below).
- Release builds: holds. The `ios` CI job runs prebuild with the plugin, then a Release
  simulator `xcodebuild` (green at the head). Nothing in the patch is `#if DEBUG`-dependent.
- Android unaffected: only `withAppDelegate`/`withInfoPlist` (iOS mods); `android` CI green.
- No new dependency, no SDK upgrade (`package*.json` untouched); no UDIDs or local paths in the
  committed docs: holds.

## Checks run (throwaway detached worktree, removed)
- `expo prebuild --clean --no-install` at the head: AppDelegate gains the conformance, loses the
  start block; Info.plist has the manifest. A second non-clean prebuild leaves AppDelegate identical.
- Red config: plugin removed from app.json, clean iOS prebuild: no `UIApplicationSceneManifest`
  and the template's own start block (the crashing configuration). App not run; the PR's
  simulator red/green run stands as evidence.
- Plugin driven directly on the pristine template: patched output has no `startReactNative`;
  patch(patch(x)) == patch(x); window block changed -> throws; CRLF line endings -> throws.
  `final class AppDelegate: ExpoAppDelegate {` still matches the substring and patches
  correctly (harmless).

## Findings
1. **nit**, `mobile/app/plugins/with-ios-scene.js:13`: the idempotency guard keys on the
   conformance alone. Scenario: a future template (or a hand edit) that already declares
   `ExpoReactNativeFactoryProvider` but keeps its own window + `startReactNative` block returns
   unchanged with no error, and RN starts twice. Guard on `PROVIDER && !WINDOW.test(src)` so that
   state throws. Low likelihood; the header comment already says to drop the plugin once the
   template wires the delegate.

Checked, no finding: `mobile.yml` path filter (`plugins/**` added), decision record and index
line, lessons edit (replaces the "never commit that patch" line; the agent-device daemon line
changes a future action), plugin size (42 lines, no abstraction to cut; no app.json key or
upstream template does this in Expo 57, per the PR's ladder).

## Codex Sol first review (gpt-6.1-sol, head dbbf122), appended verbatim by PM

REQUEST CHANGES

```text
IOS-1 | should-fix | mobile/app/plugins/with-ios-scene.js:13
Input: the template already declares ExpoReactNativeFactoryProvider but retains its window/startReactNative block, as in a partial migration. Reproduced in memory: the early return accepts it unchanged. The emitted scene manifest then causes startup from both didFinishLaunchingWithOptions and scene(_:willConnectTo:options:), creating two RN roots. Verify that legacy startup is absent before treating conformance as proof of a completed patch; otherwise transform or reject.

IOS-2 | should-fix | mobile/app/plugins/with-ios-scene.js:10
Input: template drift moves reactNativeFactory = factory inside the anchored iOS conditional. Reproduced against the bundled Expo 57.0.24 template: prebuild accepts the input and silently deletes that assignment with the entire block. The generated Swift retains a nil factory, so EXExpoAppSceneDelegate hits its fatalError at launch. Match the expected startup block precisely and reject unexpected contents instead of deleting arbitrary code through #endif.
```
## Fix round 1 re-check (Claude reviewer, scoped to `8c20ecf`)
Plugin driven directly on the pristine Expo 57.0.24 template AppDelegate (generated without the plugin).
- N1 / IOS-1 fixed, `with-ios-scene.js:20-21`: early return only when the conformance is present
  and the start block absent. Planted half-patched file (conformance added, block kept) throws.
- IOS-2 fixed, `with-ios-scene.js:9-17`: the start block is an exact literal; no wildcard deletion
  remains. Planted `reactNativeFactory = factory` moved inside the block throws; block removed
  without the conformance throws; class line changed throws.
- Output on the template is byte-identical to the `dbbf122` output; patch(patch(x)) == patch(x).
- Direct caller (`withAppDelegate` callback, export shape) unchanged.

Verdict: APPROVE.
