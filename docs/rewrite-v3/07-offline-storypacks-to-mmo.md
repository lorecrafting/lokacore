# 07 — Offline Storypacks and the Path to the MMORPG

## 1. Requirement

First-generation single-player cartridges SHOULD be fully playable offline after installation/download.

This changes a major assumption in the earlier roadmap: a private cartridge cannot depend on a cloud-hosted BEAM process for ordinary play.

At the same time, Loka MUST avoid creating a disposable “single-player engine” that is later replaced by the MMORPG.

The solution is to separate:

- **portable deterministic game semantics**;
- **the authority shell that hosts those semantics**.

Offline, the authority shell lives on the device.

Online, authority lives in BEAM/OTP.

For a **portable Story cartridge**, the same compiled cartridge definitions and portable simulation semantics run in both places. Realm-native cartridges may add or depend on server-only capabilities and are not required to execute offline.

## 2. One client, two strict authority modes

Loka uses one mobile application with two session modes.

### Story Mode

Responsibilities:

- cartridge catalog/download;
- permanent story purchases;
- offline local authority;
- local SQLite saves;
- campaigns/sequels/expansions;
- optional cloud backup/account linking;
- portable GameView rendering.

Ordinary Story play MUST NOT require:

- Phoenix world sessions;
- realm chat/presence;
- guild/economy services;
- shard handoff;
- server authority.

### Realm Mode

Responsibilities:

- authenticated online session;
- Phoenix protocol;
- BEAM-authoritative world/party instances;
- persistent online characters;
- chat/presence/social;
- shared zones and later realm systems;
- server-authoritative economy/progression.

Realm Mode MUST NOT:

- create a local authoritative fallback when disconnected;
- treat Story SQLite saves as online world authority;
- derive competitive/persistent Realm value directly from editable local Story state.

### The session boundary

The app selects exactly one gameplay authority for a running session:

```text
                    Loka UI / GameView renderer
                              |
                         GameSession
                         /         \
                        /           \
             LocalStorySession   RemoteRealmSession
               local kernel        Phoenix/BEAM
               local SQLite        server state
```

The shared renderer receives host-neutral `GameView` data and emits typed intents/commands through the active session. It MUST NOT contain separate copies of quest/action/policy semantics.

Switching modes MUST close/commit the current session before another authority is activated. No save/world may be concurrently authoritative locally and remotely.

The local kernel may physically exist in the same binary while Realm Mode is active, but Realm Mode MUST never trust it for authoritative decisions. Local simulation/prediction for Realm is deferred unless separately specified.

### One app, modular code

Do not solve one-app maintenance by creating one giant conditional client.

The mobile codebase SHOULD keep explicit packages/modules for:

- app shell/navigation;
- Story session/SQLite/kernel bridge;
- Realm session/Phoenix transport;
- shared GameView renderer;
- shared UI/design system;
- localization;
- generated schemas/types;
- Story library/commerce;
- Realm social/chrome.

Import-boundary tests SHOULD prevent Realm authority code from mutating Story saves and Story authority code from bypassing the Realm transport.

## 3. Execution profiles


Each cartridge/deployment declares supported profiles.

### `offline_private`

- one local player;
- no network required after entitlement/content acquisition;
- local durable save;
- only portable capabilities;
- local deterministic simulation kernel;
- no authoritative transfer of competitive state to MMO.

### `online_private`

- one player;
- BEAM WorldInstance is authoritative;
- may use server-only capabilities;
- server/cloud save;
- eligible for online-authoritative progression integrations if product policy allows.

### `party`

- several players;
- BEAM WorldInstance authoritative;
- shared party-scoped state.

### `shared_area`

- many players;
- BEAM zone/shard authority;
- explicit player/party/realm scopes;
- multiplayer/economy/abuse certification required.

A cartridge can support more than one profile.

## 4. Portable Simulation Kernel

### Problem

If game rules are implemented once in Elixir for the server and again in TypeScript for offline mobile, every new mechanic creates two implementations and an ongoing semantic-drift risk.

With hundreds of MUD primitives, that is unacceptable as the default architecture.

### Recommended direction

Introduce a small **portable deterministic simulation kernel** shared by offline mobile and BEAM runtime.

Working technology choice for the architecture spike: **Rust**.

Reasons:

- compiles to iOS and Android native libraries;
- can be exposed to React Native through a native/TurboModule boundary;
- can be called from Elixir through Rustler;
- strong type system and serialization ecosystem;
- no garbage-collected runtime dependency inside the kernel;
- good fit for pure deterministic state transition code.

Current React Native/Expo supports custom native modules, React Native provides typed TurboModule/JSI native integration, and Rustler provides a mature Elixir/Rust NIF bridge. Rust-to-React-Native binding generators also exist, but at least one prominent current option explicitly describes itself as early-development and not yet recommended for production. Therefore the **kernel language and both host-binding strategies remain provisional until the mandatory spike**. The architecture must not depend on any one third-party Rust-to-React-Native generator.

### What stays Elixir/BEAM-native

Using a portable kernel does NOT turn Loka into a Rust server.

BEAM/OTP still owns the online system:

- world-instance and shard processes;
- supervision;
- sessions;
- networking/Phoenix;
- process registries;
- backpressure;
- scheduling orchestration;
- database transactions;
- outbox/effect workers;
- distributed-world evolution;
- observability integration;
- admin/builder services.

Rust owns only deterministic portable simulation semantics.

This is analogous to using a physics/rules library inside an actor-oriented server.

## 5. Kernel boundary

Input:

```text
compiled cartridge definitions / capability tables
current portable world state
typed command or scheduled portable event
logical time
explicit RNG state
execution budget
```

Output:

```text
accepted/rejected
new portable state or state delta
new RNG state
domain events
portable effects
portable game-view/projection delta or projection hints
trace data
```

The kernel MUST NOT:

- access network;
- access filesystem directly;
- access database;
- know Phoenix;
- know App Store/Play Store;
- use wall clock;
- use process-global RNG;
- create OS threads as gameplay authority;
- make entitlement decisions.

It is a pure deterministic engine boundary.

## 6. Kernel state and commit boundary

The portability spike MUST decide how state crosses the native boundary without violating transactional authority or causing pathological full-world copies.

Preferred semantic protocol:

```text
authority owns committed revision
        |
kernel decide(read-only state handle/view, command, env)
        |
        +--> StateDelta
        +--> DomainEvents
        +--> Effects
        +--> new RNG/logical state
        |
authority transactionally persists delta + receipt
        |
on success: apply committed delta to in-memory kernel state
on failure: discard proposal
```

The kernel MUST NOT irreversibly mutate hidden authoritative state before the host commit succeeds.

If post-commit in-memory apply fails, the authority process/app instance may reconstruct kernel state from the committed durable snapshot/delta.

R1 must benchmark and compare at least:

- stateless serialized state-in/state-out;
- long-lived native state handle + non-mutating decision/delta;
- compact touched-state slices/deltas.

Choose the simplest model that preserves:

- deterministic replay;
- crash recovery;
- snapshot export;
- transaction ordering;
- acceptable FFI copy/latency;
- testability.

Do not freeze a hidden mutable NIF resource design before this evidence.

## 7. Server execution

Online:

```text
Phoenix command
   ↓
BEAM WorldInstance / ZoneShard
   ↓
portable kernel decide(...)
   ↓
DecisionBatch
   ↓
PostgreSQL transaction + command receipt/outbox
   ↓
BEAM adopts committed state
   ↓
client projection / effects
```

The BEAM process serializes authority and provides resilience.

Short bounded kernel calls may use a normal Rustler NIF if proven safe for scheduler latency. Heavy Lab/model-check simulations MUST use a dirty CPU scheduler or isolated worker so they cannot starve BEAM schedulers.

## 8. Offline execution

On device:

```text
touch/text input
   ↓
LocalInstanceAuthority
   ↓
portable kernel decide(...)
   ↓
DecisionBatch
   ↓
local SQLite transaction
   ↓
local state adopted
   ↓
portable GameView → React Native projection
```

`LocalInstanceAuthority` serializes local commands just as `WorldInstance` does online.

It need not emulate OTP. It only must enforce the same command/commit semantics.

## 9. Offline persistence

Use a local transactional database, normally SQLite.

Local save stores:

```text
save slot ID
cartridge ID/version/hash
instance revision
logical clock
RNG state
portable world state/snapshot
quest/scoped state
durable local scheduled jobs
command receipts needed for crash-safe retry
save format version
lineage/ancestor revision for cloud sync
```

A command is locally committed before UI treats it as durable.

A crash cannot leave “item removed from room but not placed in inventory.”

## 10. Offline time

Cartridge declares its time policy.

### `play_time`

Logical world time advances only while game is actively running.

### `real_elapsed`

On resume, wall-clock delta is converted to logical elapsed time, then deterministic scheduled/derived state is reconciled.

### `hybrid`

Specific systems opt into real elapsed time.

No background process is required to simulate every second while the app is closed.

Use on-demand derivation and process due durable jobs on resume.

## 11. Offline scripts

Offline-capable cartridges may use only **portable LokaScript** and portable bindings.

Therefore LokaScript cannot depend on Elixir runtime execution.

Preferred pipeline:

```text
Elixir-like source syntax
  ↓
authoring compiler parses permitted syntax
  ↓
portable normalized AST/bytecode
  ↓
portable kernel interpreter
  ↓
same semantics on mobile + server
```

The authoring compiler MAY use Elixir's parser during build time to convert syntax to the portable representation, but released runtime execution occurs in the portable kernel.

Engine-native compiled Elixir capabilities are automatically server-only unless equivalent portable kernel semantics exist.

## 12. Capability portability classification

Every capability declares:

```text
portable
server_only
client_presentation_only
```

`offline_private` compilation rejects `server_only` gameplay capabilities.

Example:

```text
movement@1           portable
inventory@1          portable
quest@3              portable
schedule@1           portable
combat@2             portable
guild_market@1       server_only
cross_realm_chat@1   server_only
haptics@1            client_presentation_only
```

The first storypacks SHOULD target the portable capability set.

## 13. Conformance suite

The portable kernel creates a critical new invariant:

> The same input state, command, logical time, RNG state, and cartridge hash MUST produce byte-for-byte/canonically equivalent domain results on every supported host.

CI runs golden vectors through:

- Rust core unit tests;
- BEAM/Rustler wrapper;
- iOS binding test target;
- Android binding test target.

Any divergence blocks release.

## 14. Architecture spike gate

Before writing the full engine, implement a tiny vertical spike:

Definitions:

- two rooms;
- one NPC;
- one item;
- one quest;
- one RNG check;
- one scheduled event.

Commands:

- move;
- take;
- talk;
- advance/resume time.

Prove:

1. Rust kernel runs exact scenario;
2. Elixir/Rustler host produces canonical trace hash;
3. at least two viable mobile binding strategies are evaluated (for example direct platform wrappers around a stable C ABI versus TurboModule/JSI generation);
4. iOS React Native host produces same trace hash;
5. Android React Native host produces same trace hash;
6. local SQLite save/reload preserves hash;
7. BEAM/PostgreSQL save/reload preserves hash;
8. 10,000 deterministic command runs show acceptable latency;
9. a deliberately injected mismatch is caught by conformance CI;
10. chosen mobile binding approach has a credible Expo/EAS build, upgrade, crash-debugging, and maintenance story.

If this spike is too operationally costly, fallback is dual Elixir/TypeScript implementations with mandatory golden-vector parity. That is the fallback, not first choice.

## 15. Campaigns, sequels, and single-player expansions

A **cartridge** is the smallest independently versioned/certified world-content unit. A **campaign** is an optional composition layer that lets multiple cartridges/chapters form one continuing offline adventure.

Example:

```text
Campaign: Riverlands Chronicle

Chapter 1
  fox_spirit_of_yunmeng@1.2.0

Chapter 2
  monastery_beneath_the_bell@1.0.0

Expansion
  ghosts_of_the_southern_road@1.1.0
```

The campaign manifest pins exact compatible cartridge releases for a save lineage.

### Campaign state classes

Continuing stories need state that outlives one cartridge without making everything global.

Use explicit classes:

```text
cartridge_local
  flags/entities/quest state meaningful only inside one cartridge

campaign_character
  portable character stats/equipment only when the campaign rules declare them shared

campaign_memory
  narrative facts: who lived, faction choice, ending, promises, discoveries

account_memory
  optional non-competitive profile/lore achievements that may sync later

realm/MMO state
  online authoritative only; never sourced from offline campaign economy
```

A cartridge declares which continuity keys it exports and which it accepts.

Example:

```yaml
continuity:
  exports:
    - memory.saved_ferryman
    - memory.temple_allegiance
  imports:
    - memory.village_ending

  character:
    mode: campaign
    schema: riverlands_character_v1
```

Do not let a sequel read arbitrary internal state from its predecessor.

### Continuity record

On cartridge completion/checkpoint, the portable kernel can emit a typed continuity record:

```text
campaign ID
source cartridge/release/hash
campaign save lineage
exported narrative memories
portable campaign-character snapshot if allowed
schema versions
```

The next cartridge validates/imports only declared fields.

This makes sequels deterministic and migration-friendly.

### Standalone compatibility

A sequel/expansion SHOULD define one of:

- `requires_prior`;
- `prior_optional_with_defaults`;
- `standalone`.

If prior state is optional, the content explicitly defines default continuity rather than guessing.

### Expansion installation

An expansion may:

1. add a new independent chapter;
2. add optional content to a campaign map;
3. add side-adventure portals;
4. extend a previous cartridge through an explicit composite deployment.

It MUST NOT mutate an already certified cartridge artifact in place.

A campaign save pins the exact release set it was using. Installing an expansion changes the campaign composition through a versioned campaign/deployment manifest and migration if needed.

### Character continuity versus MMO continuity

Offline campaign-character state is trusted only within that local campaign lineage.

If the future MMO includes the same hero/story continuity, use explicit translation such as:

- narrative memories;
- cosmetic badges;
- unlocked dialogue variants;
- account lore.

Do not automatically import offline levels, gold, items, or power into realm authority.

Online-private versions of the campaign may later use an online-authoritative character and therefore can participate in MMO progression under explicit product rules.

### Why this helps the MMORPG

A campaign becomes a curated set of reusable adventure modules.

Later the MMO can expose:

- Chapter 1 as a private quest-board adventure;
- Chapter 2 as a party dungeon;
- the expansion road as an instanced region;
- selected geography as a shared promoted zone.

Campaign ordering/continuity is product metadata; cartridge content remains reusable.

## 16. Cartridge versus deployment

Separate reusable story/content from how it is hosted.

### Cartridge

Contains:

- world definitions;
- NPCs/items;
- quest/dialogue;
- portable scripts;
- narrative;
- assets.

### Deployment

Defines how a cartridge is instantiated in a product context.

Example:

```yaml
deployment: offline
cartridge: fox_spirit_of_yunmeng@1.2.0
mode: offline_private
persistence: local
entry: rooms/ferry_dock
```

A shared-world deployment may say:

```yaml
deployment: yunmeng_realm
cartridge: fox_spirit_of_yunmeng@1.2.0
mode: shared_area
realm: main
mount:
  parent_zone: southern_riverlands
  entry_connection: ferry_road
policies:
  npc_death: respawn
  economy: realm
```

Deployment is separately hashed and certified.

## 17. Three ways a single-player cartridge enters the MMO

This is the central reconciliation mechanism.

### A. Adventure portal — preferred first reuse

A player in the MMO launches the original cartridge as a private or party adventure.

```text
Shared Town
   |
Quest Board / Boat / Portal
   |
new private/party WorldInstance
   |
exact certified cartridge
```

The story does not need to become globally shared.

Advantages:

- zero narrative rewrite;
- no shared-NPC races;
- exact quest assumptions preserved;
- co-op can be added via party mode;
- same cartridge continues to earn value after MMO launch.

### B. Instanced region embedded in geography

The cartridge's entrance exists physically in the MMO map, but crossing the boundary creates a private/party instance.

Example: everyone sees the ruined monastery entrance, but each party explores its own story state inside.

This gives geographical cohesion without sacrificing narrative correctness.

### C. Shared-area promotion

Only some content should become truly shared.

Create a shared deployment overlay and recertify for:

- concurrent players;
- shared NPC life/death;
- spawn/respawn;
- shared doors/resources;
- economy;
- griefing;
- unique items;
- quest scope;
- world event semantics;
- shard transfers.

This is adaptation, not an automatic flag flip.

## 18. Quest design for future reuse

Default story quest scope SHOULD be `player`.

That allows the same shared NPC to participate in different players' quest progress.

Quest authors must not assume that changing the shared NPC object itself is the only way to represent personal story state.

For personal consequences, use:

- player-scoped state;
- private phasing/projection where supported;
- instanced sub-area;
- party scope.

Use realm scope only for intentional world events.

## 19. Shared NPC versus personal narrative

An NPC definition can be reused across modes, but deployment policy decides runtime multiplicity.

Offline:

```text
one ferryman inside local world
```

Private online:

```text
one ferryman per instance
```

Shared MMO:

```text
one shared ferryman per zone shard
```

Player-specific dialogue/quest knowledge lives in player-scoped state rather than mutating the shared ferryman into contradictory global states.

## 20. Death and permanence

A story may allow the ferryman to die permanently.

That does not mean the shared-world deployment must.

Deployment/capability policy can choose:

- permanent in private instance;
- respawn in shared area;
- invulnerable/shared service NPC;
- private quest duplicate;
- phased replacement.

Any semantic change requires multiplayer semantic review.

## 21. Economy boundary

Offline saves are user-controlled and therefore untrusted for competitive MMO value.

Offline-earned:

- gold;
- equipment;
- stats;
- crafting materials;
- rare drops

MUST NOT be imported as authoritative MMO economy state.

This is a security boundary, not an accusation against players.

## 22. What may transfer from offline

Optional low-stakes synchronization may include:

- completion marker;
- endings seen;
- lore/journal unlocks;
- accessibility/preferences;
- cosmetic “memory” badges;
- narrative choices used only for flavor.

Because offline saves can be modified, anything transferred MUST be treated as non-competitive/untrusted unless independently verified.

## 23. Online-authoritative cartridge mode

Later, a player may choose to run the same cartridge in `online_private` mode.

Because BEAM is authoritative, such a run MAY integrate with MMO progression/rewards if product design wants it.

This gives a clean distinction:

```text
Offline Story Mode
  play anywhere
  local save
  no valuable MMO-state import

Connected Adventure Mode
  same story/content
  server-authoritative
  may interact with persistent account/MMO systems
```

Do not require Connected Adventure Mode for launch.

## 24. Cloud save for offline storypacks

Cloud backup is optional convenience, not runtime authority.

When online:

```text
local save branch
   ↓
upload encrypted/authenticated snapshot metadata
   ↓
cloud backup
```

If two devices diverge from a common ancestor, DO NOT attempt arbitrary semantic merge.

Preserve both branches and let the player choose, or use an explicit cartridge-specific merge only if defined/tested.

## 25. Offline entitlement

After a paid cartridge is legitimately acquired and downloaded, ordinary offline play SHOULD not require periodic connectivity.

Store a locally verifiable signed entitlement grant or equivalent platform-backed durable purchase proof.

Server revocation/refund state takes effect when the device next reconnects according to product policy.

Exact Apple/Google implementation must be re-verified at commerce implementation time.

## 26. Cartridge update while offline

A save is pinned to exact cartridge release/hash.

If a new release is downloaded:

- existing save may continue with old installed artifact;
- or user may run an explicit tested migration;
- old artifact can be reclaimed only after no local save needs it.

Never silently load a v1.2 save with v1.3 definitions.

## 27. Offline download/package integrity

Downloaded cartridge package is signed/hashed.

Client verifies:

- catalog identity;
- artifact hash;
- engine/kernel compatibility;
- client feature compatibility;
- entitlement where required.

Corrupt/partial download never becomes playable state.

## 28. Local privacy

Offline gameplay SHOULD stay local unless user/account sync features require upload.

Do not upload full private play traces by default solely because the Lab uses rich traces in development.

Telemetry policy can be opt-in/configurable and privacy-minimized.

## 29. Why this still uses BEAM's strengths

Offline mode cannot use BEAM because the mobile app should not embed an entire Erlang VM merely to play a story.

Online architecture remains intentionally BEAM-native.

The split is:

```text
PORTABLE PURE RULES
       |
  +----+-------------------+
  |                        |
mobile local authority     BEAM online authority
SQLite                     OTP + PostgreSQL
                           supervisors
                           processes
                           Phoenix
                           PubSub
                           shards
                           durable workers
```

BEAM is used exactly where its concurrency/fault-tolerance model creates leverage.

The portable kernel exists because the product explicitly requires disconnected execution.

## 30. Product progression

Recommended evolution:

### Stage 1

Offline private storypacks.

### Stage 2

Optional account/catalog/cloud backup.

### Stage 3

Online private versions of same packs.

### Stage 4

Party/co-op instances.

### Stage 5

Shared social hub/world.

### Stage 6

Storypacks accessible as MMO adventures/instanced regions.

### Stage 7

Selected cartridges promoted to certified shared areas.

### Stage 8

Persistent modern text MMORPG where the cartridge pipeline continuously supplies new adventures and regions.

At no stage is the original cartridge investment discarded.
