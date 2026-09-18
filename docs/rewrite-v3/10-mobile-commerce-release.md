# 10 — Mobile, Commerce, and Release

## 1. Two focused React Native clients

Loka v3 ships two product clients from one monorepo:

### Loka Stories

Offline-first cartridge player. It embeds the local authority/kernel bridge, local SQLite save layer, catalog/download/purchase UI, campaigns, and optional cloud backup/account linking.

### Loka Online

Online-only multiplayer/MUD client. It authenticates, joins Phoenix/BEAM-authoritative worlds, renders server GameViews, and provides social/party/realm UI. It has no local authoritative world save.

The clients SHOULD share packages for design system, portable GameView rendering, localization, generated types, and common presentation components, but MUST NOT share a giant authority state machine full of offline/online conditionals.

## 2. Mobile monorepo structure

Recommended:

```text
mobile/
├── apps/
│   ├── stories/        # offline-first product shell
│   └── online/         # multiplayer/MUD product shell
├── packages/
│   ├── ui/             # shared design system/components
│   ├── game-view/      # host-neutral GameView rendering
│   ├── localization/
│   └── generated/      # generated shared types/schemas
├── native/
│   └── stories-kernel/ # portable-kernel bindings used by Stories
└── test/
```

The Online client may share GameView/rendering packages but does not need to embed the portable kernel merely because the BEAM server uses it.

No manually authored duplicate game-rule implementation.

## 3. Online connection lifecycle

```text
authenticate
  ↓
open socket
  ↓
protocol/version handshake
  ↓
select/enter character + online instance
  ↓
receive authoritative snapshot
  ↓
commands + revisioned deltas
  ↓
disconnect/reconnect
  ↓
resume + resync
```

Client MUST tolerate server process restart by reconnecting/resyncing.

## 4. Offline launch lifecycle

```text
select downloaded cartridge/save
  ↓
verify artifact hash/signature + local entitlement proof
  ↓
check kernel/client compatibility
  ↓
load local SQLite snapshot
  ↓
initialize portable kernel
  ↓
reconcile elapsed-time policy/due jobs
  ↓
play with no network
```

Network services must not be touched on the critical path after verification.

## 5. Local state

Mobile persists:

- save slots;
- cartridge release pins;
- local command receipts;
- logical clock/RNG state;
- local scheduled jobs;
- downloaded asset/content manifests;
- auth/entitlement proof where needed;
- preferences.

Online server projections are cache only.

## 6. Stories app: many cartridges

The Loka Stories store binary contains:

- offline presentation shell;
- portable kernel native library/version;
- local authority + SQLite save support;
- supported render/action capabilities;
- catalog/purchase/download UI;
- optional account/cloud-backup adapters.

Cartridges are separately downloadable data/assets/bounded portable rule IR compatible with installed Stories kernel/client features.

Normal story release SHOULD NOT require a new Stories binary.

Loka Online has its own release cadence and only needs updates when multiplayer client/protocol/presentation capabilities change.

## 7. Client/kernel feature negotiation

Cartridge manifest declares:

```yaml
requires:
  kernel_api: ">=1.3 <2.0"
  rule_ir: 1
  content_schema: 1
  client_features:
    - contextual_actions_v1
    - dialogue_choices_v1
```

Offline launch verifies locally.

Online server also verifies client feature compatibility.

A cartridge needing new native kernel/client functionality waits for app update.

## 8. Catalog

Catalog entry includes:

```text
cartridge ID
display title/description
art
current purchasable release
supported languages
estimated playtime
age/content metadata
price/entitlement mapping
required app/kernel version
offline capable?
online modes
download size
availability
```

Catalog metadata is independent of immutable runtime release records.

## 9. Entitlements

Canonical domain entitlement:

```text
cartridge.fox_spirit_of_yunmeng
```

Mapping:

```text
Apple product ID -> canonical entitlement
Google product ID -> canonical entitlement
promo/admin grant -> canonical entitlement
```

Game/catalog rules query canonical entitlement only.

## 10. Purchase lifecycle

```text
client begins store purchase
  ↓
platform returns purchase proof
  ↓
server/trusted verifier confirms
  ↓
server records entitlement + provenance
  ↓
server issues locally verifiable offline grant
  ↓
client downloads signed/hash-addressed cartridge
  ↓
offline play available
```

Never trust a client boolean `purchased=true`.

## 11. Offline entitlement policy

Product goal: a permanently purchased/downloaded cartridge remains usable during long disconnected periods.

The implementation SHOULD use a locally verifiable signed grant or robust platform purchase proof.

A refund/revocation that occurs while a device never reconnects cannot be instantly enforced. That is an explicit tradeoff for true offline ownership-like usability.

When the device reconnects, current entitlement/revocation state is reconciled.

Do not build invasive always-online DRM into the offline storypack experience.

## 12. Restore/refunds/revocation

System handles:

- reinstall;
- new device;
- restore purchases;
- refund;
- revoked platform purchase where applicable;
- account merge/support correction.

Entitlement history is auditable.

Product policy must decide what happens to installed saves after revocation; implementation must not silently delete player saves.

## 13. Initial monetization

Working launch hypothesis:

- free app;
- one complete free showcase cartridge;
- permanent à-la-carte cartridges;
- optional bundles after catalog exists;
- no manipulative consumable economy required for initial product;
- subscription deferred until ongoing content cadence justifies it.

## 14. Store executable-code boundary

For the simplest initial review posture:

- cartridge assets/data/bounded portable rule IR are interpreted by capabilities already shipped in the app;
- do not download arbitrary JavaScript/native libraries per cartridge;
- server-only compiled Elixir remains on server;
- kernel changes ship through reviewed app binary.

Store policies must be re-verified immediately before submission.

## 15. Content delivery

Use content-addressed package/asset manifests:

```text
artifact hash
signature
kernel compatibility
manifest
definition/rule-IR blobs
asset hashes
locale files
```

Download can be resumable.

Incomplete/corrupt package never becomes active.

## 16. Local package management

Maintain installed releases needed by saves.

A save references exact hash.

Garbage collection may remove a cartridge release only when:

- no save requires it;
- no active download/reference requires it;
- replacement migration is complete.

User may explicitly delete a save/cartridge subject to normal confirmation.

## 17. Cloud backup

Cloud save is optional convenience.

Upload:

- encrypted/authenticated save snapshot;
- lineage metadata;
- cartridge hash;
- revision.

On divergent branches, keep both.

Do not semantic-merge arbitrary quest/world state.

## 18. Offline versus online characters

Default safety rule:

- offline story saves are local/private;
- MMO character state is online authoritative.

Do not import offline gold/items/stats into MMO.

Later, an online-private cartridge mode may intentionally use the authoritative online character and grant persistent rewards.

## 19. Narrative continuity

Optional account-level “memories” may sync:

- story completed;
- ending choice;
- journal/lore;
- cosmetic badge.

Treat locally asserted memories as non-competitive unless verified by an online-authoritative run.

## 20. Release environments

```text
local
CI/Lab
staging
TestFlight / Play internal
production
```

Cartridge candidate promotion uses same hash across environments.

No rebuilding content differently for production.

## 21. Cartridge rollout

Support:

- hidden/internal;
- invited beta;
- general availability;
- withdrawn;
- deprecated.

Installed offline releases remain available according to entitlement/product policy.

## 22. App binary compatibility

Catalog/server maintains:

```text
minimum supported client version
current recommended version
protocol compatibility matrix
kernel compatibility matrix
client feature flags
```

Hard-block online only when safety/correctness requires it.

Offline existing saves should continue on their compatible installed app/kernel whenever technically possible.

## 23. Mobile CI

Every PR touching kernel bindings/protocol/mobile runs:

- clean install;
- TypeScript;
- lint/format;
- unit tests;
- generated protocol drift;
- native module compile targets;
- portable conformance vectors;
- representative offline save roundtrip;
- Expo config validation.

Pre-release adds real iOS/Android internal-build smoke.

## 24. Deep links

Later:

```text
loka://cartridge/fox_spirit_of_yunmeng
```

Deep link never bypasses entitlement/version checks.

## 25. Privacy/data minimization

Offline gameplay SHOULD remain local by default.

Telemetry should avoid:

- auth tokens;
- full receipts;
- private chat unnecessarily;
- complete private story traces unless opt-in/needed for support.

Crash reporting can send minimized technical state with user consent/configuration.

## 26. Current technology feasibility note

As of this spec's 2026-09-17 research baseline:

- Expo supports custom native modules for iOS/Android;
- modern React Native uses the New Architecture/JSI-native module model;
- React Native provides Turbo Native Module/codegen mechanisms for native integration and also documents a pure cross-platform C++ module path;
- Rustler provides a mature Rust/BEAM NIF bridge;
- Rust-to-React-Native generator projects exist, but current ecosystem maturity varies and at least one prominent option warns against production use today.

Therefore a shared Rust kernel is feasible enough to justify a spike, but **neither Rust nor a particular React Native binding generator is frozen by this document**. The spike must prove build/release ergonomics, crash/debug behavior, Expo/EAS integration, upgrade burden, and deterministic cross-host parity first.


## 27. Store-review gate for downloadable rule content

Apple's current Guideline 2.5.2 says apps may not download/install/execute code that introduces or changes app features/functionality, while Guideline 4.7 separately permits certain non-binary software categories such as mini games under additional rules.

Therefore the architecture MUST NOT assume that calling a downloaded payload “bytecode” or “script” makes it acceptable.

Before the first App Store submission, run a dedicated review-position spike:

1. characterize cartridge rule content as bounded game data/rules over pre-shipped capabilities;
2. ensure it cannot expose new native APIs or general computation;
3. provide App Review with clear notes/demo content explaining downloadable game levels;
4. determine whether the exact implementation is reviewed under ordinary game-content/IAP expectations, Guideline 4.7, or another current interpretation;
5. if necessary, further restrict/compile LokaScript into a declarative rule graph rather than a general instruction VM.

The product goal—downloadable offline storypacks—remains; the precise portable rule representation must be compatible with current store review policy.


## 28. App/kernel upgrades must not strand offline saves

Automatic app updates create a compatibility obligation that is independent of cartridge updates.

A new app/kernel release MUST NOT make a previously valid installed save unopenable merely because native code was replaced.

The release process therefore tracks a compatibility matrix across:

- save format version;
- cartridge content schema;
- rule-IR version;
- kernel API version;
- client feature set.

Allowed strategies for an older installed save/package:

1. **backward-compatible execution** — new kernel still understands the pinned versions;
2. **explicit deterministic migration** — package/save is migrated locally with rollback-safe backup;
3. **bundled compatibility interpreter** — retain an older rule-IR interpreter path when practical.

The implementation MAY define a supported compatibility window, but it must be long enough for commercial offline ownership expectations and must be visible in release policy.

Before removing old kernel/rule-IR support:

- inventory locally installed/published cartridge requirements;
- provide/certify migrations where needed;
- verify user saves;
- retain recovery backup;
- never silently rewrite a save during app startup without a recoverable migration transaction.

An app update with no network must still open supported offline saves.



## 29. Cross-client account and entitlement boundary

Separate apps make authority simpler but create a deliberate commerce/account question.

Default launch rule SHOULD be:

- a Loka Stories purchase guarantees access in Loka Stories;
- Loka Online access/rewards are governed by online account entitlements and product rules;
- do not promise automatic cross-app purchase portability until current Apple/Google rules, receipt/account linking, and product economics are verified.

If product later grants an Online benefit because a user owns a Stories cartridge, the server may map verified purchase/account evidence into a **separate canonical online entitlement** or non-competitive memory/badge. The mobile clients never directly trust each other's local purchase flags.

An optional Loka account can link Stories purchases/cloud backups to a player identity when online, but Stories ordinary offline play must not require that account after legitimate acquisition/download.
