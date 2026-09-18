# Loka Cartridge & Living World Roadmap

**Status:** proposed official working strategic baseline, 2026-09-17; becomes current on merge.
**Source baseline:** `main` at `0765784dc08b6fc5ba9299771195516541bb572e`.
**Scope:** product and architecture direction for turning Loka into a mobile-first cartridge platform that can grow into a persistent multiplayer MUD.

This document owns product sequencing for the cartridge strategy. It does not by itself authorize a large rewrite. Each architecture change still needs a bounded implementation plan, tests, review, and migration path. Existing product notes remain useful research unless they conflict with an explicit decision here.

### Clean-rebuild decision

The working implementation direction is now a **clean-sheet Loka v3 rebuild**, not an in-place refactor or module-by-module port of Lokacore.

The normative draft architecture packet is [`docs/rewrite-v3/README.md`](../rewrite-v3/README.md). Lokacore remains a reference/evidence corpus for requirements, mechanics, tests, failure modes, and selected content semantics. The new implementation should start from accepted v3 contracts rather than preserve legacy APIs or compatibility layers.

The rewrite packet refines this roadmap in one major respect: offline-capable single-player storypacks are locally authoritative and use a portable deterministic rules kernel, while online private/party/shared play is authoritative under the BEAM runtime. The cartridge/content model is shared so storypack work can graduate into the later MMORPG without becoming throwaway work.

## Strategy in one page

Build **one Loka runtime and one mobile app**. Ship small, self-contained story worlds first as purchasable **cartridges**. Run those cartridges on the same authoritative Elixir/Phoenix simulation that can later host shared areas and a persistent MUD.

The engine should become increasingly expressive: many reusable primitives for movement, schedules, weather, spawning, combat, dialogue, factions, reputation, inventory, world events, timers, and other old-school MUD behaviors. The authoring contract should become more constrained and more machine-readable: one stable way to invoke each primitive, one canonical schema, and deterministic validation around composition.

The central product rule is:

> New stories should normally add content, not application code. New mechanics should become reviewed engine primitives that future stories can reuse.

| Decision | Working direction |
|---|---|
| Runtime | Keep Loka's authoritative Phoenix/OTP engine and React Native client. Do not build a separate single-player engine. |
| Single-player | A cartridge starts an isolated private world instance using the multiplayer runtime. |
| Multiplayer | The same cartridge model may later support party instances or mounting a certified area into the persistent shared world. |
| World richness | Preserve and expand a large primitive/capability library. Simplify composition rules, not the world simulation. |
| Quests | Keep the shared StateMachine and existing Event/EventBus foundation, but redesign quest progress around one canonical typed event → pure reducer → effects path. |
| Scripting | Keep constrained server-side Elixir scripting for first-party/AI-authored content, but do not treat the current same-BEAM `Code.eval_string` runtime as a hard security boundary for untrusted public code. |
| AI authoring | Give builders a generated capability catalog and schema rather than expecting a model to reconcile stale Markdown and engine internals. |
| Authoring surface | Make the canonical Builder API the source of truth. Agents use structured MCP/tool calls, humans may use a thin terminal/CLI over the same operations, and visual UI is primarily for inspection/debugging rather than a second authoring implementation. |
| Testing | Every cartridge/area earns a release certificate from static checks, state exploration, deterministic simulation, bots, chaos/concurrency, restart/replay, and semantic review. |
| Mobile distribution | One App Store / Play Store app. Cartridges are content/data/assets interpreted by already-shipped client/runtime capabilities; server-side scripts never become downloaded mobile executable code. |
| Launch monetization | Default hypothesis: free app + free showcase cartridge, then permanent à-la-carte cartridge unlocks using non-consumable IAP / Play one-time products. Subscription can be evaluated only after a reliable release cadence exists. |
| Factory | AI/factory orchestration is build-time tooling, never a gameplay dependency. Loka must run released content if the factory is unavailable. |

## 1. Product shape: stories first, MUD later, same engine

The earlier product question of isolated interactive stories versus a shared MUD should be treated as sequencing rather than a fork.

### Phase-one experience

A player installs one polished mobile app, browses a small catalog, chooses a story, and enters a private world instance. The world is not a branching ebook. It is a real Loka simulation with rooms, NPCs, inventory, time, weather, schedules, combat, quests, random events, and whatever engine capabilities that cartridge declares.

A cartridge can be thirty minutes or several hours. It should feel like a compact MUD questline or zone with a beginning and a bounded set of outcomes.

### Expansion path

The same content model then grows through instance modes:

1. **private** — one player, isolated world state;
2. **party** — a small group shares the instance;
3. **shared-area** — a certified cartridge/area is mounted into a persistent realm;
4. **persistent-world** — many areas, shared services, social systems, economy, guilds, events, and long-lived characters.

This sequence lets single-player releases pay for and validate the eventual MUD. A successful cartridge can later become a tested questline or region in the shared game rather than throwaway content.

## 2. Preserve Loka's strong foundation

The current repository already contains most of the substrate this strategy needs:

- Phoenix Channels and an authoritative server;
- React Native / Expo mobile work;
- the entity/component/trait model;
- rooms, exits, NPCs, items, inventory, combat, quests, dialogue, timers, schedules, and world events;
- reusable traits such as patrol, wandering, day/night schedules, shop hours, ambient emitters, nocturnal behavior, and timed spawning;
- content validators and dependency/reachability analysis;
- ChannelBot and storyline integration testing;
- AI-evaluation, balance, and builder infrastructure;
- server-side constrained Elixir scripts.

Do not replace these merely to get a cleaner story format. Repair the boundaries around them.

### Storage evolution

Keep SQLite for the private-cartridge MVP unless measurement shows a real bottleneck. The
cartridge, quest, and capability contracts should not depend on SQLite-specific behavior.
Before persistent shared-realm scale, benchmark write contention, backup/restore, and
operational needs and make an explicit SQLite-versus-PostgreSQL decision from evidence
rather than migrating the database merely because the long-term product is multiplayer.

### What should change first

The repository currently contains contract drift. One prominent example is prototype inheritance: current architecture/README material describes flat self-contained prototypes while the LLM-oriented entity reference still documents `parent:` inheritance. Scripting comments and older design material also retain assumptions from the pre-entity scripts table.

An AI builder should not have to decide which era of the architecture is true.

The first architectural product is therefore not another feature. It is a **canonical machine-readable authoring contract**.

## 3. Capability catalog and cartridge contract

### 3.1 Capability registry

Engine capabilities should be registered with schemas that tooling can inspect, for example:

```json
{
  "key": "patrol",
  "kind": "behavior",
  "version": 2,
  "targets": ["npc"],
  "config": {
    "route": {"type": "room_ref[]", "required": true},
    "interval": {"type": "duration", "default": 300}
  },
  "emits": ["patrol.departed", "patrol.arrived"]
}
```

The registry should cover at least:

- entity components;
- behaviors/traits;
- actions and effects;
- condition predicates;
- event types;
- quest objective operators;
- script bindings;
- client-visible interaction/rendering capabilities.

Markdown documentation should be generated from or checked against this registry. Documentation explains semantics; the schema is authoritative.

An AI builder should be able to query capabilities by meaning, target type, input/output schema, and examples without loading the entire repository into context.

### 3.2 Cartridge manifest

A cartridge is an immutable compiled content release, not an alternate application:

```yaml
id: fox_spirit_of_yunmeng
version: 1.2.0

requires:
  engine_api: ">=1.3 <2.0"
  content_schema: 1
  script_api: 1
  client_features:
    - dialogue_choices_v1
    - minimap_v1

instance_modes:
  - private

entry:
  starting_room: yunmeng_ferry

content:
  world: world/
  quests: quests/
  dialogue: dialogue/
  scripts: scripts/
  assets: assets/
```

The compiled artifact should record a content hash and the exact compatibility contract it was certified against.

### 3.3 State scope must be explicit

Every stateful mechanic needs a declared scope so private content can later survive multiplayer:

- `player`
- `party`
- `instance`
- `realm/world`

Per-player quest progress should be the default. A world boss death, town election, weather system, or shared gate can be explicitly broader.

This prevents one of the classic MUD bugs: content that works with one player but silently assumes global state when twenty players arrive.

### 3.4 Authoring architecture: API-first, terminal-human, MCP-agent

Loka should not maintain a rich visual CRUD application as the primary way to author worlds. The existing repository is already moving in the preferred direction: the old GUI builder was archived, `/admin/builder` is a terminal-first LiveView, and the World Builder already exposes structured MCP tools.

The next step is to make those surfaces converge on **one canonical Builder API**.

The architectural rule is:

> The terminal should not be the API. The canonical typed Builder API should power the terminal, MCP, future CLI, automation, and tests.

Today the repository has partially overlapping paths:

```text
terminal commands → BuilderCommands.* → managers
MCP/AI tools      → ToolExecutor.*    → managers
```

That duplication can drift. Replace it incrementally with one domain operation layer:

```text
                    Canonical Builder API
                           │
              ┌────────────┼────────────┐
              │            │            │
            MCP          Terminal      CLI/tests
           agents         humans        automation
```

A room creation, quest update, script validation, publish, or simulation action should have one schema, one implementation, one result/error model, and one audit trail regardless of caller.

#### Structured tools are the preferred AI surface

A model should not need to type terminal commands and parse prose responses. It should receive typed inputs and machine-readable results, for example:

```json
{
  "ok": false,
  "code": "QUEST_TARGET_UNREACHABLE",
  "path": "objectives[2].target",
  "target": "abandoned_shrine",
  "diagnostic": {
    "from": "ferry_dock",
    "connected_component": 3
  }
}
```

This makes repair loops cheaper, safer, and easier to test than terminal-text automation.

The current MCP tool layer is a useful starting point, but its schemas should eventually be generated from or checked against the same capability/content contracts described above. Loka should not hard-wire the architecture to one model vendor; Astra, Foundry, Claude, or another orchestrator should all see the same stable Builder API.

#### Keep the terminal as a thin human shell

The current terminal-first `BuilderLive` is small and useful. Keep it for:

- direct inspection;
- quick mutations;
- play/debug commands;
- certification commands;
- trace exploration;
- AI conversation when convenient.

Its parser should translate human commands into canonical Builder API operations rather than owning separate mutation semantics.

A future CLI can do the same.

#### Use visual UI for inspection, not duplicated authoring logic

Visual interfaces are valuable where humans gain real leverage from spatial or temporal presentation. Prefer read-heavy/debugging views such as:

- world/zone maps;
- quest graphs;
- dialogue graphs;
- NPC schedule timelines;
- event/causation traces;
- simulation playback;
- cartridge certification dashboards;
- dependency/reachability views.

Avoid rebuilding large form-based editors for rooms, quests, NPCs, scripts, or components unless later user research proves a specific visual editing workflow is substantially better than API/terminal authoring.

The rule is:

> **Author with typed tools/text. Inspect and debug with visuals.**

#### Author in cartridge workspaces, not directly in production state

The factory should normally mutate a bounded candidate workspace, not the live world:

```text
Astra / human
    ↓
cartridge workspace
    ↓
compile + validate
    ↓
Cartridge Lab
    ↓
simulate + review
    ↓
certify exact hash
    ↓
publish/promote
```

An AI builder must be free to make and repair destructive mistakes inside an isolated draft without affecting production players.

The Builder API should therefore make workspace/revision context explicit on mutations. Publishing is a separate promotion operation with certification policy that content authors cannot bypass.

## 4. Quest engine audit: keep the state machine, redesign the mutation path

### Why the StateMachine exists

`Loka.Engine.StateMachine` is a useful pure primitive. The quest component currently uses it to declare legal lifecycle transitions such as:

`available → accepted → in_progress → objectives_complete → turned_in`

with abandon/failure branches.

That was the right direction. Explicit lifecycle states are easier to validate and test than implicit combinations of booleans.

### Why quests can still break

The state machine only answers whether one lifecycle transition is legal. It does not own all the ways quest state changes.

The current quest subsystem still has multiple cooperating paths:

- hook listeners translate movement, item, combat, and dialogue activity;
- objective handlers decide whether an event matches;
- `Progress.update_progress/2` loops active quests and mutates objective state;
- dialogue and manual actions can cause quest progress;
- timers expire objectives;
- turn-in separately applies rewards and moves active state to completed;
- scripts expose quest-related bindings/effects.

The retained `docs/temp/continuation-prompt-quest-bug.md` captures the kind of failure this permits: a dialogue objective was observed as complete before the intended turn-in interaction, causing the bot to skip the node that contained `complete_quest`.

The lesson is not "state machines failed." The lesson is that **lifecycle validation was added without giving one subsystem sole ownership of quest interpretation and mutation**.

### Target: Quest Runtime v3

Use one canonical path:

```text
world action
    ↓
canonical typed Loka event
    ↓
QuestRuntime
    ↓
pure QuestReducer
    ↓
new QuestInstance + typed effects
    ↓
authoritative commit
    ↓
effect execution / UI events
```

#### A. Normalize the existing event system rather than create a second bus

Loka already has `Loka.Engine.Event` and `EventBus`, including event IDs, correlation IDs,
causation, source/target, and payload validation. Quest Runtime v3 should extend and
normalize that path where practical instead of inventing a competing `GameEvent` system.

Every quest-relevant occurrence is represented once with the identity needed for replay,
scope, and deterministic tests, for example:

```elixir
%Loka.Engine.Event{
  id: event_id,
  type: :dialogue_node_reached,
  source: player_id,
  target: npc_id,
  payload: %{
    target_key: "elder_maren",
    node: "after_sacrifice",
    instance_id: instance_id,
    logical_time: logical_time
  },
  correlation_id: correlation_id,
  caused_by: parent_event_id
}
```

The exact fields may evolve, but event identity, causation, scope/instance, and a
test-controllable notion of time must be available. Add explicit event types/schemas
rather than smuggling quest meaning through ad-hoc maps.

Adapters at movement, combat, dialogue, inventory, timers, and scripts may **emit events**.
They do not directly update quest progress.

#### B. Explicit quest instances

Persist an explicit instance per scope:

```text
quest_key
quest_definition_version
scope + scope_id
lifecycle_state
objective_states
variables
accepted_at
revision
processed_event/effect identity needed for idempotency
```

An active save is pinned to the quest/cartridge definition it started against. Publishing a new cartridge version must not silently reinterpret an in-progress quest. If an update needs migration, that migration is explicit and tested.

#### C. Pure reducer

`QuestReducer.reduce(definition, instance, event)` should be side-effect free:

```elixir
{:ok, new_instance, effects}
```

or:

```elixir
:no_change
{:error, invariant_violation}
```

It decides:

- whether the event matches;
- objective progress;
- lifecycle advancement;
- failure/expiry;
- branching variables;
- effects that should occur.

This makes property tests, replay, fuzzing, and diagnosis much easier.

#### D. StateMachine remains the lifecycle guard

Do not delete the shared StateMachine. Use it inside the reducer to validate lifecycle transitions.

For richer quests, objective structure should support composable graph operators rather than requiring script code for common logic:

- `all`
- `any`
- `sequence`
- `optional`
- `count`
- `within`
- conditional activation
- explicit branch/outcome nodes

The lifecycle remains small even when the objective graph is rich.

#### E. Effects happen exactly once

Rewards, item grants, timer scheduling, messages, spawn/despawn, and other mutations are typed effects emitted by the reducer. The authoritative effect layer applies them with idempotency keys.

A retry must not duplicate a rare item or reward gold twice.

Script helpers such as `complete_objective` should either disappear from the preferred authoring surface or be implemented as a typed quest signal/event that still passes through the reducer. No script gets a second private path into quest storage.

### Do not require full event sourcing

The objective is **event-replayable quest logic**, not turning the entire game database into an event-sourced system.

Snapshots/current state can remain authoritative. Retain enough normalized event/effect evidence to reproduce failures, test migrations, and produce a compact repro bundle.

## 5. Server-side Elixir scripting remains useful, with a stricter trust boundary

### Current implementation

The existing script runtime is real and useful:

- scripts are content entities (`type: :script`);
- `Loka.Engine.Script.Validator` performs source/AST checks;
- `Sandbox` runs source with approved bindings and a timeout;
- `ActionQueue` collects and rate-limits effects before they are executed;
- scripts can react to hooks/events and compose richer behavior.

This is a strong first-party builder tool.

### Important limitation

The current runtime ultimately calls `Code.eval_string` in a task on the same BEAM. Static checks, restricted bindings, timeouts, and result-size limits reduce risk, but they are **not an OS/process isolation boundary against hostile code**.

Therefore:

- keep it for reviewed first-party and AI-authored content;
- do not offer arbitrary public script execution as a launch feature;
- do not describe same-BEAM execution as sufficient isolation for untrusted creators;
- keep all scripts server-side; cartridges must never deliver executable Elixir to the mobile client.

### Direction for Script API v2

Scripts should become a controlled orchestration escape hatch over typed engine capabilities.

1. Generate script bindings from the same capability registry.
2. Inject clock and RNG capabilities so tests can control time/randomness.
3. Have mutation bindings produce typed commands/events/effects rather than direct DB writes.
4. Remove dynamic atom creation from content-controlled paths.
5. Version the Script API per cartridge.
6. Make effect batches previewable and auditable.
7. Put explicit budgets on queries, effects, spawned entities, timers, output, and execution.
8. Prefer declarative conditions/effects/traits when the engine already has the primitive.
9. When authors repeatedly need the same script pattern, promote it into a tested engine capability.

If Loka later accepts untrusted public builder scripts, add a stronger boundary first: a strict interpreted AST/DSL or a separately isolated worker with OS-level resource and filesystem/network restrictions.

## 6. Cartridge Lab: test worlds as products, not YAML files

Build a dedicated **Cartridge Lab** that can boot any cartridge or candidate multiplayer area into an isolated ephemeral instance.

The Lab should support:

- exact cartridge content hash;
- deterministic RNG seed;
- virtual clock: pause, step, fast-forward hours/days;
- state snapshots and rewind;
- player-state presets;
- quest/event/effect trace;
- entity and scope inspector;
- bot spawning and behavior profiles;
- fault injection;
- exportable reproduction bundle.

A developer should be able to reproduce a bug with:

```text
cartridge hash
engine revision
seed
initial snapshot
ordered player/world events
expected invariant
actual invariant
```

### Certification pipeline

A cartridge or shared area is not release-ready because one happy path works. Certification should layer evidence.

#### Gate C1 — compile and static integrity

- schema validation;
- capability/version compatibility;
- broken references;
- room connectivity and intended one-way paths;
- dialogue reachability;
- quest dependency cycles;
- required entity/component presence;
- asset existence;
- script validation;
- no undeclared capabilities.

#### Gate C2 — quest/model checks

For each quest:

- legal lifecycle transitions;
- double-accept/turn-in rejection;
- objective idempotency;
- prerequisite enforcement;
- abandon/reaccept behavior;
- timer expiry behavior;
- reward exactly-once semantics;
- bounded exploration of objective/dialogue branches;
- no required turn-in path that becomes unreachable under its own completion conditions.

Property-based tests should generate event sequences, not merely call one happy-path function.

#### Gate C3 — deterministic playthroughs

Use the real action/channel path where practical.

Run:

- intended main paths;
- alternate branches/endings;
- completionist path;
- minimal/rushing path;
- combat-heavy and noncombat variants where supported.

Record branch/quest/action coverage and a seed.

#### Gate C4 — accelerated world simulation

Run the world for hours or days with no human input and inspect invariants:

- scheduled NPCs can reach destinations;
- shops actually open/close;
- spawn populations remain bounded;
- timed entities despawn correctly;
- required NPCs do not become permanently unavailable;
- item sources/sinks remain viable;
- world loops do not create runaway events.

#### Gate C5 — adversarial and chaos play

Interleave normal progress with:

- death;
- logout/reconnect;
- repeated taps/duplicate commands;
- abandoned quests;
- dropped/destroyed items;
- leaving dialogue mid-conversation;
- unusual quest ordering;
- hostile NPC death at awkward times;
- time advancement;
- restart during active timers/effects.

Assert no invariant corruption and produce minimal repro traces on failure.

#### Gate C6 — multiplayer race and scope testing

For any cartridge that permits party/shared mode, run multiple players concurrently:

- accept/advance same quest simultaneously;
- kill/loot the same entity;
- open/lock shared objects;
- disconnect/reconnect;
- join/leave parties;
- compete for unique resources;
- trigger world events concurrently.

Assert player-, party-, instance-, and realm-scoped state never leak across the wrong boundary.

#### Gate C7 — restart/replay/upgrade

- stop/restart the server at effect boundaries;
- reload the exact cartridge version;
- replay diagnostic events to reproduce quest state;
- prove rewards/effects are not duplicated;
- test save compatibility or explicit migration to the next cartridge/engine version.

#### Gate C8 — semantic review

After mechanical checks pass, a strong reasoning model reviews the compact world model, traces, and coverage for failures that are legal but wrong:

- witness NPC is scheduled away before the murder scene;
- only quest-giver can identify an item but can be permanently killed;
- branches contradict established knowledge;
- a town feels empty because schedules synchronize;
- a choice is technically reachable but nonsensical;
- a multiplayer objective is scoped incorrectly for its narrative intent.

Use Astra or the strongest appropriate reviewer available for this stage. Provider choice is operational; certification inputs/outputs must remain model-independent.

#### Gate C9 — human mobile smoke

A human verifies on actual mobile builds:

- touch interactions;
- readability;
- pacing;
- purchase/download/restore;
- offline/reconnect behavior where promised;
- audio/assets;
- accessibility;
- save resume.

### Release certificate

Certification emits a machine-readable artifact tied to the exact compiled cartridge hash:

```text
cartridge ID/version/hash
engine/schema/script API versions
test revision
static validator result
quest/model coverage
simulation seeds and duration
chaos/concurrency scenarios
restart/replay result
semantic-review result + unresolved warnings
human smoke signoff
```

Only that exact hash is promotable. Editing content after certification creates a new candidate.

## 7. Multiplayer areas use the same certification machinery

A future MUD area is a cartridge with broader instance/scoping permissions.

Before a new shared area reaches the production realm:

1. certify it privately;
2. run multi-bot load/concurrency tests;
3. mount it in a staging realm with copied/non-production accounts;
4. canary it for invited testers;
5. promote the exact certified content hash;
6. retain a rollback pointer to the previous area version and a migration policy for persistent player/world state.

This is safer than editing the live world in place.

## 8. AI game factory

The factory should build against the contract rather than directly improvising across engine internals.

Suggested roles:

```text
creative brief
    ↓
narrative/world architect
    ↓
world + NPC + quest builders
    ↓
cartridge compiler
    ↓
deterministic validators/simulators
    ↓
semantic reviewer
    ↓
correction loop
    ↓
certified release candidate
```

### AI authoring rules

- Builders query the capability registry instead of loading every engine document.
- Generated content should use existing primitives first.
- Missing capability becomes a **primitive proposal**, not hidden custom runtime code.
- A new primitive needs engine tests and independent review before it enters the catalog.
- AI-generated scripts are reviewed, validated, simulated, and certified like all other content.
- A content author cannot weaken certification policy inside the cartridge.
- Factory/orchestrator failure must not affect released gameplay.

External orchestration tooling may coordinate this pipeline, but Loka should not depend on it at runtime.

## 9. App Store / Play Store release and commerce strategy

Store policies change; re-check them before launch. The following baseline was verified against official Apple/Google documentation on 2026-09-17.

### 9.1 Ship one app, not one app per story

The app is the Loka player/catalog/runtime. Cartridges are entries inside it.

This keeps one client to maintain, avoids repeated binary releases for content-only additions, and fits the product goal that all worlds share one engine and interaction vocabulary.

### 9.2 Keep mobile cartridges declarative

Apple's App Review Guideline 2.5.2 prohibits downloading/installing/executing code that introduces or changes app features/functionality. Apple separately has rules for mini apps/mini games under Guideline 4.7, with additional requirements.

For the simplest initial review posture:

- do not ship downloadable executable Elixir/JavaScript/native code in cartridges;
- execute Loka builder scripts only on the server;
- have the mobile client receive declarative content, assets, state, and supported action/render descriptions;
- require a client update when a cartridge needs a genuinely new client capability.

Official reference: <https://developer.apple.com/app-store/review/guidelines/>

### 9.3 Permanent cartridge purchases

Apple explicitly treats game levels/premium content as in-app-purchase content, and its non-consumable type is purchased once and does not expire. Google Play's non-consumable one-time products similarly support permanent unlocks such as additional game levels.

Default launch hypothesis:

- free app;
- at least one complete free showcase cartridge;
- each premium cartridge maps to a permanent entitlement;
- optional bundles later;
- subscription only if Loka establishes a meaningful ongoing catalog/service cadence.

Official references:

- Apple IAP overview: <https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases>
- Apple App Review Guidelines 3.1.1: <https://developer.apple.com/app-store/review/guidelines/>
- Google Play Payments policy: <https://support.google.com/googleplay/android-developer/answer/9858738>
- Google Play one-time products: <https://developer.android.com/google/play/billing/one-time-products>

### 9.4 Entitlement service

Do not make Apple/Google product IDs the domain model.

Use a canonical server entitlement:

```text
entitlement: cartridge.fox_spirit_of_yunmeng
  apple_product_id: ...
  google_product_id: ...
```

The server records platform provenance and verified purchase state, handles restore/revocation/refund signals, and decides which cartridge catalog entries a Loka account may enter.

Define cross-platform portability deliberately before launch; do not let accidental receipt handling decide the policy.

### 9.5 Cartridge release without app binary release

A content-only cartridge should be releasable without a new client version when:

- the installed client already supports every declared client feature;
- the server engine supports the cartridge contract;
- its IAP/product metadata is approved/available;
- its exact cartridge hash has a release certificate.

On Apple, the first consumable/non-consumable IAP must be submitted with a new app version; after the first of that type is approved, additional IAPs of that type can be submitted without including a new app version.

Official reference: <https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase>

A new cartridge that requires a new UI/rendering/client mechanic waits for the binary carrying that capability.

### 9.6 Content delivery

Default cross-platform model:

```text
store purchase
    ↓
server verifies / updates entitlement
    ↓
catalog shows unlocked
    ↓
client fetches manifest/assets as needed
    ↓
player enters server-side instance
```

Use normal CDN/object storage for cross-platform assets unless platform-hosted asset packs offer a measured operational benefit. Apple-hosted asset packs are an optional later optimization, not a dependency of the cartridge model.

### 9.7 Review/staging logistics

Maintain distinct environments:

- local Cartridge Lab;
- automated CI certification;
- internal/staging server;
- TestFlight / Play internal testing;
- production catalog.

App review must be able to access required backend services and purchasable content. Release notes should explain non-obvious cartridge/IAP behavior.

Public user-authored cartridges are deferred. They introduce moderation, reporting, blocking, age-rating, IP, and creator-content obligations beyond the first-party catalog.

## 10. Roadmap and gates

Sequence by evidence, not by a fixed calendar.

### L0 — Contract reconciliation

**Goal:** make the builder surface unambiguous before generating more worlds.

Deliver:

- inventory of actual engine capabilities;
- canonical machine-readable schemas;
- capability registry;
- generated/checked builder docs;
- resolve prototype/script/documentation drift;
- cartridge manifest v1;
- explicit player/party/instance/realm scope vocabulary.

**Gate:** an AI builder can discover and create representative entities/behaviors without consulting contradictory legacy references.

### L1 — Quest Runtime v3 + certification kernel

**Goal:** make quest/world state diagnosable and replayable before scaling content.

Deliver:

- canonical quest event schemas/metadata on the existing `Loka.Engine.Event` foundation;
- pure quest reducer;
- typed/idempotent quest effects;
- pinned quest definition versions;
- state machine retained as lifecycle guard;
- deterministic clock/RNG seams;
- core Cartridge Lab;
- static + property + bounded-state quest certification.

**Gate:** migrate one existing problematic questline and prove happy, alternate, duplicate, abandon, timer, restart, and adversarial traces without state corruption.

### L2 — First shippable cartridge

**Goal:** prove the complete player and commerce loop manually before factory scale.

Create one small polished cartridge with enough systems to stress the architecture:

- living NPC schedules;
- exploration;
- dialogue;
- items;
- at least one combat/noncombat challenge;
- branching quest outcome;
- time/world events;
- multiple endings or meaningful consequences.

Run full certification, mobile smoke, purchase, restore, download, save/resume, and update tests.

**Gate:** a real player can install one app, acquire the cartridge, complete it, restore it on a fresh install, and resume safely across server/client restart.

### L3 — Repeatable cartridge factory

**Goal:** make cartridge creation primarily content work.

Deliver:

- machine-readable capability search;
- authoring agents/roles;
- automated compile → certify → review → correct loop;
- primitive-proposal workflow;
- semantic review;
- release-candidate packaging;
- catalog/IAP operational tooling.

**Gate:** produce at least two materially different cartridges without cartridge-specific engine patches except explicitly approved new reusable primitives.

Track the percentage of each cartridge diff that is content/assets versus runtime code.

### L4 — Persistent identity and social shell

**Goal:** connect isolated stories without yet taking on full MMO world coupling.

Possible additions:

- persistent profile/character choices;
- achievements/history;
- friends;
- shared lobby/town;
- party formation;
- cross-cartridge unlocks where designed.

**Gate:** isolated cartridges remain deterministic/recoverable while shared identity cannot leak or corrupt cartridge-local state.

### L5 — Shared areas and modern MUD

**Goal:** mount certified content into a persistent multiplayer world.

Add only after multiplayer certification is mature:

- shared area state;
- guilds/factions;
- economy;
- persistent world events;
- live operations;
- area canaries/rollback;
- cross-area migrations;
- stronger load and abuse testing.

**Gate:** a certified area survives concurrency, restarts, upgrades, and rollback with persistent player/world state intact.

## 11. Metrics that matter

Avoid measuring factory success by raw generated word count or number of YAML files.

Track:

- **content-only ratio:** percentage of a new cartridge diff that is content/assets;
- **uncertified escape rate:** production bugs that certification should have caught;
- **quest invariant failures per simulated run**;
- **branch/state coverage** for quests/dialogue;
- **reproducibility:** percentage of failures that export a deterministic repro;
- **certification runtime and human review time**;
- **primitive reuse:** how often new content uses existing capabilities versus requiring engine work;
- **script reliance:** common script patterns that should become primitives;
- **state migration success** across cartridge/runtime versions;
- **purchase/restore reliability**;
- **completion/abandon points** and player-reported confusion after release.

The strategic factory metric is:

> Can the next good game be made mostly by composing tested capabilities and content, without making the runtime harder to reason about?

## 12. Immediate implementation order

After this roadmap is accepted, prefer small architecture tickets rather than one "Loka v3 rewrite":

1. reconcile current authoring contracts, generate a capability inventory, and define the canonical Builder API beneath MCP/terminal adapters;
2. write the Cartridge Manifest v1, workspace/revision model, and state-scope contract;
3. design the canonical `Loka.Engine.Event` → Quest Runtime v3 interfaces against current quest bugs before changing implementation;
4. build a reducer spike for one existing quest and compare it with current behavior;
5. add deterministic clock/RNG seams and a minimal Cartridge Lab trace/replay path;
6. convert the existing content-testing proposal into executable certification gates;
7. harden Script API boundaries around typed capabilities/effects;
8. build one handcrafted shippable cartridge;
9. add store entitlement/catalog plumbing;
10. automate authoring only after the first cartridge proves the contract.

Do not begin with a giant content generation run. First make one small world impossible to break in ordinary and adversarial ways, then make the factory reproduce that quality.

## Related current material

This roadmap consolidates rather than deletes earlier thinking:

- [`open-product-questions.md`](open-product-questions.md) — earlier isolated-story/shared-world options;
- [`world-platform.md`](world-platform.md) — broader platform vision;
- [`../proposals/content-testing-strategy.md`](../proposals/content-testing-strategy.md) — useful precursor to cartridge certification;
- [`../architecture/unified-object-system-v2.md`](../architecture/unified-object-system-v2.md) — current entity architecture;
- [`../architecture/elixir-scripts-design.md`](../architecture/elixir-scripts-design.md) — scripting design history;
- [`../builder-reference/README.md`](../builder-reference/README.md) — current builder references;
- [`../../server/lib/loka/engine/state_machine.ex`](../../server/lib/loka/engine/state_machine.ex) — shared lifecycle primitive;
- [`../../server/lib/loka/framework/quest/progress.ex`](../../server/lib/loka/framework/quest/progress.ex) — current quest progress path;
- [`../../server/lib/loka/engine/script/sandbox.ex`](../../server/lib/loka/engine/script/sandbox.ex) — current constrained Elixir runtime.

Older documents remain historical/design context. When they disagree with this document on product sequencing, the cartridge-first sequence here is the current working direction. Implementation truth still lives in current code and generated/canonical contracts once those are introduced.
