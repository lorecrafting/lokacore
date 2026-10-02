# Review: R6P gestures (U7 bottom-edge deferral, U8 footer rule)

- PR: #115, branch `r6p-gestures`, commit reviewed `2b1a857`
- Stance: short review (UI styling plus a native config plugin; no mutation testing)
- Verdict: **APPROVE WITH NOTES**

## What must be true (from the owner requests, before reading the diff)

1. U7: the view controller iOS asks for `preferredScreenEdgesDeferringSystemGestures` (the
   window's root VC, or a child it names) returns `.bottom`; the joystick stays where it is.
2. The change lives in a config plugin (mobile lessons: prebuilt `ios/` stays gitignored, never
   hand-patched); prebuild is idempotent and composes with `with-ios-scene` in either order.
3. Nothing that Expo or an installed module hooks into the root VC stops working.
4. U8: exactly one of the two rules near the footer goes, the one above the joystick.

## Checks run

- `expo prebuild -p ios --no-install` on a scratch copy of `2b1a857`: exit 0. `ReactNativeDelegate`
  gains `override func createRootViewController()` returning `BottomEdgeViewController`; the rest
  of `ReactNativeDelegate` (`sourceURL`, `bundleURL`) and `AppDelegate` (scene patch, Linking,
  Universal Links) are unchanged. `swiftc -parse` OK. Info.plist keeps `EXExpoAppSceneDelegate`.
- Root VC: `ExpoAppSceneDelegate.scene(_:willConnectTo:)` calls `factory.startReactNative`;
  `RCTReactNativeFactory.mm:93-95` takes `[_delegate createRootViewController]`, sets the RN root
  view into it and assigns it to `window.rootViewController`. The VC has no children and the app
  uses no RN `Modal`, so its override is the one iOS reads. Holds (1).
- Idempotent: a second prebuild without `--clean` gives a byte-identical `AppDelegate.swift`
  (one class, one override).
- Order: plugins swapped in `app.json` plus `--clean` gives a byte-identical `AppDelegate.swift`.
  The two plugins touch disjoint text (class line / start block vs the extension-point marker).
- Bypassed handlers: the override replaces `ExpoReactNativeFactoryDelegate.createRootViewController`,
  which only consults `ExpoAppDelegateSubscriberRepository.reactDelegateHandlers`.
  `expo-modules-autolinking resolve -p apple` lists `reactDelegateHandlers: []` for every module
  (expo, expo-sqlite, expo-font, expo-crypto, expo-asset, expo-constants, expo-file-system,
  expo-keep-awake, expo-modules-core, ...). `customize(rootView)` (app-delegate subscribers) is not
  overridden and still runs; expo-file-system's `FileSystemBackgroundSessionHandler` is an
  app-delegate subscriber, unaffected. `with-ios-scene.js` registers no handler. Holds (3).
- U8: the remaining rules are the two flanking the joystick (`Footer.tsx:52,61`). Holds (4).

## Findings

- nit, `mobile/app/plugins/with-ios-edge-gestures.js:6` - the bypass is silent. Scenario: a later
  slice adds expo-dev-client or expo-updates, whose `reactDelegateHandlers` supply the root VC;
  their VC is ignored with no build or launch error. The `ponytail:` note records the ceiling;
  enough for now, but whoever adds such a module must read it.
- question (owner, at the P5 tryout), `mobile/app/book/Book.tsx:82` - the removed border is the
  one `Bottom` view, so pages opened from the room (map, character, journal, carrying, settings,
  thing) also lose the rule above Back; there `back` now follows the page text with only 8 pt
  padding and no rule. Not a regression against the request (the owner asked to remove "the one
  above the joystick", and it is the same element), and it fits the book style, but the owner may
  notice it on pages. If the owner wants it back on pages: `borderTopWidth: p.back ? 1 : 0`.

No blocker, no should-fix. CI android, ios and typescript jobs were still pending at review time.
