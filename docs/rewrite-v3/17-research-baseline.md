# 17 — Research Baseline and External References

**Verified:** 2026-09-18 unless otherwise noted.

This appendix records external facts that influenced architecture decisions. It is not a substitute for rechecking fast-changing platform policies at implementation/release time.

## 1. Evennia

Evennia was reviewed as mature evidence for text-world/MUD architecture and features, not as a dependency.

Primary references:

- Portal/Server separation: <https://www.evennia.com/docs/latest/Components/Portal-And-Server.html>
- Sessions: <https://www.evennia.com/docs/latest/Components/Sessions.html>
- Accounts: <https://www.evennia.com/docs/latest/Components/Accounts.html>
- Command Sets: <https://www.evennia.com/docs/latest/Components/Command-Sets.html>
- CmdSet API: <https://www.evennia.com/docs/latest/api/evennia.commands.cmdset.html>
- Locks: <https://www.evennia.com/docs/latest/Components/Locks.html>
- Tags: <https://www.evennia.com/docs/latest/Components/Tags.html>
- Prototypes: <https://www.evennia.com/docs/latest/Components/Prototypes.html>
- OnDemandHandler: <https://www.evennia.com/docs/latest/Components/OnDemandHandler.html>
- Contrib overview: <https://www.evennia.com/docs/latest/Contribs/Contribs-Overview.html>

Verified useful observations:

- Evennia separates network Portal and game Server processes.
- It explicitly models Client -> Session -> Account -> Object/Character.
- CmdSets compose with union/intersect/replace/remove operations.
- Locks follow a lockdown/fail-closed philosophy.
- Prototypes exist partly to avoid subclass explosion and support builders.
- OnDemandHandler recommends deriving time-driven state when observed instead of continuously ticking dormant objects.
- Current contrib catalog includes systems for barter, crafting, cooldowns, extended rooms, wilderness, grids, RP recognition/languages, reports, mail, and many other MUD patterns.

See [12-evennia-lessons.md](12-evennia-lessons.md) for Loka-specific adaptations.

## 2. Expo / React Native native code

Official Expo:

- Add custom native code: <https://docs.expo.dev/workflow/customizing/>
- Expo Modules overview: <https://docs.expo.dev/modules/overview/>
- Expo Modules get started: <https://docs.expo.dev/modules/get-started/>

Verified:

- Expo development builds can include custom native code.
- Expo Modules support iOS/Android native modules.
- Custom native changes require native rebuilds.
- Expo recommends Expo Modules for most native integrations; lower-level C++ use cases may favor React Native Turbo Modules.

Official React Native:

- Turbo Native Modules: <https://reactnative.dev/docs/turbo-native-modules-introduction>
- Cross-platform C++ native modules: <https://reactnative.dev/docs/the-new-architecture/pure-cxx-modules>

Verified:

- React Native has typed native-module codegen.
- React Native documents sharing platform-agnostic C++ logic between Android/iOS via a pure C++ TurboModule.

These facts support testing a portable native kernel, but do not decide Rust or a specific binding approach.

## 3. Rust / BEAM

Rustler:

- Rustler docs: <https://hexdocs.pm/rustler/readme.html>
- Rustler project: <https://github.com/rusterlium/rustler>
- NIF scheduling docs: <https://docs.rs/rustler/latest/rustler/attr.nif.html>

Verified:

- Rustler provides Rust NIF integration for Erlang/Elixir.
- Current Rustler docs are v0.38.0 at review time.
- Rustler supports dirty CPU/IO scheduling for NIFs expected to run longer than very short normal-scheduler work.
- Rustler catches Rust panics at its NIF boundary and is designed as a safer Rust bridge for BEAM NIFs.

Architectural consequence:

- ordinary kernel decisions must be extremely short if called as normal NIFs;
- heavier certification/search/simulation must use appropriate dirty scheduling or isolated execution.

## 4. Rust / React Native ecosystem

One current project reviewed:

- uniffi-bindgen-react-native: <https://github.com/jhugman/uniffi-bindgen-react-native>
- docs: <https://jhugman.github.io/uniffi-bindgen-react-native/>

Verified:

- it can generate React Native TurboModule/JSI access to Rust and supports Android/iOS;
- its own current documentation warns that the project remains early development and should not yet be used in production.

Architectural consequence:

- it is evidence that the bridge is technically possible;
- it is **not** selected as a production dependency by this packet;
- R1 must compare binding options and maintenance risk.

## 5. Apple App Store

Current official references:

- App Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- IAP configuration overview: <https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases>
- Submit an IAP: <https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase>

Verified:

- App Review Guidelines 3.1.1 includes game levels/premium content among content/features unlocked with IAP.
- Non-consumable IAP is purchased once and does not expire/decrease with use.
- Current App Store Connect guidance says the first IAP of a given type must be submitted with a new app version; after approval, additional IAPs of that type can be submitted without a new app version when conditions are met.

The executable-code/download policy must be rechecked at launch; the current strategy keeps cartridge downloads declarative/portable-data driven rather than arbitrary downloaded app code.

## 6. Google Play

Official references:

- One-time products: <https://developer.android.com/google/play/billing/one-time-products>
- Payments policy: <https://support.google.com/googleplay/android-developer/answer/9858738>
- US policy/billing updates: <https://support.google.com/googleplay/android-developer/answer/15582165>

Verified:

- one-time non-consumable products can grant permanent benefits such as additional game levels;
- Google Play billing/policy treatment of digital content varies by current policy/program/region;
- US Play billing policy changed materially in 2025–2026 and remains subject to program/injunction updates.

Architectural consequence:

- use a canonical Loka entitlement independent of platform SKU;
- keep billing provider/region policy behind adapters;
- reverify current Google policy immediately before implementation/submission instead of hardcoding “Play Billing is always mandatory everywhere.”

## 7. Source freshness rule

These external facts can change faster than the Loka architecture.

Before implementing:

- store billing;
- app review-sensitive download/code behavior;
- React Native native binding;
- Expo native build flow;
- Rustler version/scheduler behavior;

the implementation issue must reverify current official documentation and record the version/date used.

The stable architecture should depend on abstractions, not one moment's vendor policy.
