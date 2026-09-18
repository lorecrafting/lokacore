# 14 — Implementation Plan and Dependency Graph

**Status:** draft sequencing derived from v3 architecture.  
**Rule:** no fresh implementation repository should begin substantive engine work until this packet is accepted and Phase R0 is complete.

This plan intentionally prioritizes a small shippable offline storypack while proving that the same portable rules can later run under BEAM authority.

## R0 — Specification acceptance

### Objective

Turn this packet from draft into an implementation contract.

### Tasks

- complete broad Lokacore archaeology;
- complete Evennia review;
- reconcile offline requirements;
- self-review every spec section for contradictions;
- adversarial architecture review;
- correct findings;
- identify unresolved ADRs;
- explicitly accept/reject working decisions.

### Required outputs

- accepted spec commit hash;
- decision register;
- known deferred questions;
- implementation ticket dependency graph.

### Gate R0

No unresolved contradiction about:

- definition/runtime identity;
- offline execution;
- online authority;
- command/event/effect model;
- persistence transaction semantics;
- scripting boundary;
- mobile Story session/GameView boundary and the fact that Realm transport is intentionally deferred;
- cartridge versioning.

## R1 — Disposable portable-kernel feasibility spike

### Objective

Prove the hardest new architectural decision before investing in the rebuild.

R1 SHOULD live in a disposable spike repository/workspace, not as compatibility code inside Lokacore and not as the foundation of the production v3 repository. Keep only evidence, benchmarks, fixtures, and code worth deliberately re-implementing after the decision.

### Working hypothesis

One Rust deterministic kernel can run behind:

- Elixir/Rustler;
- iOS React Native native binding;
- Android React Native native binding.

### Tiny model

Definitions:

- 2 rooms;
- 1 exit;
- 1 NPC;
- 1 item;
- 1 player;
- 1 flag;
- 1 quest;
- 1 scheduled job;
- 1 RNG check.

Commands:

- inspect;
- move;
- take;
- talk/choose;
- wait/advance time.

### Prove

- canonical serialization;
- exact trace parity;
- snapshot round-trip;
- deterministic RNG;
- same errors;
- build automation on all hosts;
- acceptable FFI overhead/copy behavior at realistic world-state sizes;
- a safe decide → persist → apply-delta protocol;
- deterministic IDs/map ordering/numeric behavior;
- no BEAM scheduler starvation.

### Rejection criteria

Reject shared-Rust approach if:

- iOS/Android build/release maintenance is unreasonably fragile;
- deterministic representation cannot be stabilized;
- binding overhead dominates realistic command latency;
- debugging across host boundaries is materially worse than dual implementation;
- Expo distribution workflow becomes unacceptable.

### Fallback

Pure Elixir online + TypeScript offline implementations with one semantic schema/golden-vector suite.

Fallback requires explicit acceptance of ongoing dual-implementation cost.

### Gate R1

Architecture Decision Record selects portable execution strategy.

## R2 — Fresh repository foundation

### Objective

Create a clean repository with enforced boundaries and CI.

Suggested shape:

```text
apps/loka_core
apps/loka_content
apps/loka_store
apps/loka_platform
apps/loka_runtime
apps/loka_builder
apps/loka_web
kernel/
mobile/app
mobile/features/story
mobile/features/realm
mobile/authority/local-story
mobile/authority/remote-realm
mobile/packages/ui
mobile/packages/game-view
protocol/
cartridges/
docs/
```

### Tasks

- Mix umbrella;
- strict compile/dependency boundaries;
- Rust workspace if accepted;
- one minimal Expo app with strict Story/Realm feature and authority-module boundaries, plus shared UI/GameView packages;
- formatter/lint/security configs;
- one unified CI;
- generated-schema drift check;
- ADR directory;
- AGENTS/task routing docs;
- minimal release/dev tooling.

### Gate R2

Empty-system CI is green on:

- Elixir;
- TypeScript;
- the R1-selected portable execution implementation;
- the R1-selected iOS/Android integration path;
- mobile portability/binding smoke appropriate to that choice.

If R1 rejects Rust/native bindings, R2 MUST NOT keep Rust-specific gates merely because they appeared in the original hypothesis.

## R3 — Contract/schema foundation

### Objective

Make machine-readable contracts exist before features.

### Build

- DefinitionRef schema;
- cartridge manifest schema;
- deployment schema;
- capability registry format;
- command registry;
- domain-event registry;
- effect registry;
- policy AST;
- FactSpec / scoped narrative-state schema;
- consequence-operator registry shape;
- portable GameView schema;
- portable kernel ABI/serialization contract;
- canonical serialization/hash rules;
- diagnostic/error registry.

### Gate R3

From the portable/content registries, tooling can generate/check:

- Elixir portable/domain types and validators;
- TypeScript portable command/GameView/content types used by Story Mode;
- capability/schema docs and help excerpts;
- canonical test fixtures.

No handwritten duplicate portable command/event/GameView catalogs.

R3 intentionally does **not** generate Builder/MCP operations or the Realm network protocol. Those contracts are introduced only when R11 and R14 need them.

Do **not** build the generalized Builder operation registry or the full Realm transport protocol in R3. Builder operation schemas belong to R11; Realm protocol/codegen belongs to R14.

## R4 — Cartridge compiler v1

### Objective

Compile a tiny cartridge into an immutable artifact.

### Build

- source loader;
- schema validation;
- namespaces;
- local reference resolver;
- template/mixin expansion;
- capability validation;
- policy compile;
- asset manifest;
- canonical serialization;
- artifact hash;
- structured diagnostics.

### Gate R4

Compile same source twice → identical artifact hash.

Broken references/cycles/unknown capabilities fail deterministically.

## R5 — Portable world kernel foundation

### Objective

Establish world/state mechanics needed by everything else.

### Implement portable capabilities

- world state;
- definitions → runtime entities;
- containment/location;
- room/exits;
- Search inputs/IDs;
- flags/scoped variables;
- logical clock;
- RNG;
- policies;
- ActionSet algebra;
- inspect/look;
- move;
- take/drop/give;
- simple resources/checks.

### Properties

- one container per item;
- no impossible location cycles;
- deterministic commands;
- unknown capabilities fail;
- ActionSet stable ordering;
- command result bounded.

### Gate R5

Golden vectors pass through kernel and all accepted hosts.

## R6 — Offline authority and save system

### Objective

Make a tiny world fully playable offline.

### Build

- LocalInstanceAuthority;
- serialized command queue;
- local SQLite adapter;
- command receipts;
- snapshots;
- save slots;
- app kill/recovery;
- play-time/real-elapsed reconciliation;
- installed cartridge manager.

### Gate R6

Airplane mode:

- start new tiny cartridge;
- play;
- kill app during actions;
- resume;
- finish;
- no state corruption.

## R7 — Quest, dialogue, and portable scripting

### Objective

Support real narrative cartridges.

### Build

- StateMachine primitive;
- QuestInstance;
- quest graph operators;
- quest reducer;
- quest event indexing;
- typed quest outcome/consequence grammar;
- FactSpec reads/writes with scope validation;
- capability consequence evaluators returning StateDelta/events/effects;
- idempotent rewards/consequences;
- dialogue graph;
- dialogue conditions/actions;
- LokaScript parser/normalized-IR skeleton and interpreter core sufficient to prove containment/determinism;
- only the bindings actually needed by the first cartridge plus a small synthetic safety fixture set;
- interpreter budgets;
- event-chain bounds;
- branch/world-consequence trace output.

### Gate R7

Known Lokacore quest-bug class has a regression scenario that cannot reproduce corruption/premature completion. LokaScript containment/determinism fixtures pass, but a broad general-purpose binding library is **not** required before R10.

## R8 — Living-world capability pack

### Objective

Make the world feel like a MUD, not a branching ebook.

### Build initially

- reactive fact/event rule evaluation;
- NPC role/state profiles;
- schedule;
- patrol;
- wander;
- ambient emitter;
- shop hours;
- nocturnal/activity windows;
- spawn/despawn policy;
- day/night;
- basic weather;
- fact-driven room/ambient variants;
- fact-driven access/topology policies;
- on-demand temporal state;
- durable local jobs;
- simple merchant/shop if needed;
- portable Service/Capacity composition primitives;
- durable local ServiceJob model sufficient to prove queued/timed services.

### Gate R8

30 simulated days:

- service queues/jobs remain bounded and deterministic;
- escrowed inputs/outputs conserve ownership;
- no schedule deadlocks;
- no runaway population;
- bounded jobs;
- required NPCs available per intended design;
- deterministic replay.

## R9 — Cartridge Lab v1

### Objective

Make failures reproducible before content scale.

### Build

- virtual clock;
- seed/RNG controls;
- snapshots/forks;
- branch outcome fork/compare;
- quest world-impact/consequence graph;
- trace viewer data;
- static validator gates;
- property tests;
- deterministic bots;
- autonomous simulation;
- fault injection for local authority;
- cross-host conformance runner;
- repro bundle export.

### Gate R9

Every seeded injected failure generates a one-command/fixture reproducible report.

## R10 — First real offline cartridge

**Sequencing rule:** prove authoring requirements with a real cartridge before completing the generalized Builder API. Minimal scripts/CLI helpers are allowed, but do not let tooling delay product proof.

### Objective

Prove product.

Target scope:

- ~8–15 locations;
- 5–8 NPCs;
- 10–20 items;
- 1–3 connected quests;
- branching outcome with typed durable world consequences;
- at least one quest-gated area/access change;
- at least one NPC role/schedule/dialogue reaction to quest outcome;
- at least one ambient/environmental reaction to shared fact state;
- schedules;
- environmental change;
- simple skill/check;
- optional simple combat;
- multiple endings/consequences.

### Important

Hand-author substantial portions first. Do not immediately ask the factory to mass-generate.

The first cartridge exists to stress contracts. It MUST prove that quests and living-world systems interact through typed facts/consequences rather than cartridge-specific mutation scripts.

### Gate R10

Full `offline_private_story` certification plus a **developer-harness physical-device smoke** using the minimal Expo/native integration established by R1/R2/R6. Polished non-developer product-shell acceptance belongs to R12.

The cartridge should be authored primarily through source files/compiler/Lab at this stage. Record every repetitive or error-prone authoring operation as evidence for the Builder API rather than prematurely generalizing it.

## R11 — Builder API v1 and script-surface generalization

### Objective

Let humans/agents author without raw repo semantics.

### Build

- Builder API operation registry/schema generation;
- workspace/revision;
- capability search/describe;
- content CRUD;
- reference graph;
- compile/validate;
- Lab control;
- batch/dry-run;
- semantic rename;
- audit receipts;
- terminal adapter;
- MCP adapter;
- expand LokaScript bindings/recipes only from concrete R10 authoring needs and accepted reusable capability gaps.

### Gate R11

Astra/another agent can recreate or extend representative first-cartridge content using only Builder API tools and fix intentionally injected validation failures without shell/Git editing.

## R12 — Loka app: production Story Mode

Can overlap late R10.

### Build

- production app navigation with Story Mode as the shipped gameplay mode;
- shared UI/GameView package extraction only where demonstrated useful;
- catalog shell;
- cartridge install/delete/update;
- save slots;
- generated kernel bindings;
- living-book/touch UI refined from old design;
- accessibility;
- settings;
- offline status.

### Gate R12

Non-developer can install the polished build, enter airplane mode, play/finish the free cartridge, resume after app/device restart, and use production cartridge/save UX without developer tooling.

## R13 — Commerce and entitlement

### Build

- introduce PostgreSQL dev/test/runtime infrastructure needed by platform services;
- `loka_platform` account/catalog/entitlement application service boundary;
- catalog service;
- canonical entitlement;
- Apple/Google product mapping;
- purchase verification;
- signed offline entitlement grant;
- restore;
- download integrity;
- refund/reconnect reconciliation.

### Gate R13

Store sandbox tests on iOS/Android:

- purchase;
- download;
- airplane mode;
- reinstall/restore;
- second device;
- refund/reconnect policy.

## R14 — BEAM online authority + Realm Mode skeleton

### Objective

Run the same cartridge rules online under OTP.

### Build

- Session→Account→Character;
- InstanceRegistry/Supervisor;
- WorldInstance;
- kernel adapter;
- PostgreSQL store;
- transactional command commit;
- command receipts;
- effect outbox;
- snapshots;
- machine-readable Realm transport protocol + Elixir/TypeScript codegen and compatibility fixtures;
- Phoenix typed protocol adapter;
- Realm Mode route/session driver inside the existing Loka app using that protocol;
- reconnect/resync;
- observability.

### Gate R14

Same cartridge golden playthrough matches offline domain trace where host-specific effects are excluded.

Chaos tests around every commit boundary pass.

## R15 — Online-private deployment

### Objective

Offer same story as cloud-authoritative run.

### Build

- deployment selection;
- online saves;
- persistent account links;
- online cartridge catalog launch;
- optional online-authoritative achievements.

### Gate R15

Within the same Loka app, the player can choose local Story execution or a connected Realm/private deployment of the same portable cartridge where offered; narrative/rules match.

## R16 — Repeatable AI factory

Only now automate content production heavily.

### Build

- architect/builder/reviewer roles;
- context retrieval;
- semantic review;
- automated correction;
- primitive proposal;
- release-candidate packaging.

### Gate R16

Two materially different cartridges produced mostly as content changes without unreviewed engine patches.

## R17 — Party/co-op instances

### Build

- party model;
- party-scoped quest state;
- party membership/progress/reward policy modes;
- party AudiencePolicy overlays;
- concurrent command handling;
- join/leave/reconnect;
- loot ownership;
- cooperative dialogue/decision policy.

### Gate R17

Full party certification including race/fault tests.

## R18 — Realm Mode persistent social shell

### Build selectively

- shared-zone player/party overlay projection;
- lazy materialization/cleanup of phased quest actors;
- shared NPC with player-specific dialogue/relationship projections;
- Realm Service/Capacity primitives and durable ServiceJobs;
- online profiles;
- friends;
- presence;
- shared hub;
- chat;
- party discovery;
- achievements/history;
- cartridge portal/quest board.

### Gate R18

Offline cartridges remain independent; same packs can launch from shared hub as private/party adventures. Personal overlays do not leak to unrelated players, and a shared service contention test proves one scarce slot cannot be double-allocated.

## R19 — Instanced story regions in world geography

### Build

- physical entrance/mount points;
- handoff from realm to private/party WorldInstance;
- return state;
- party admission;
- instance lifecycle.

### Gate R19

MMO player walks from shared town into a previously released storypack without rewriting cartridge content.

## R20 — Shared zone/shard architecture

### Objective

Enable truly shared regions.

### Build

- RealmCoordinator;
- ZoneShard;
- owner registry;
- shard state;
- cross-shard handoff protocol;
- shared durable jobs;
- realm services;
- load/backpressure.

### Gate R20

Synthetic concurrency/load + crash/handoff certification.

## R21 — Shared-area promotion

Select one prior cartridge whose fiction suits a shared area.

### Build

- shared deployment overlay;
- respawn policies;
- economy policy;
- personal/shared quest scope;
- phased/instanced exceptions;
- griefing constraints.

### Gate R21

Full `shared_area` certificate.

This proves cartridge investment can graduate into the MMORPG.

## R22 — Persistent text MMORPG expansion

Only after R20/R21 evidence.

Possible capability packs:

- guilds;
- realm economy;
- crafting markets;
- housing;
- factions;
- world events;
- channels/mail;
- mentorship;
- player governance;
- live operations.

Each remains independently specified/certified.

# Dependency graph

```text
R0 spec
 |
R1 portability spike
 |
R2 repo foundation
 |
R3 schemas/contracts
 |
R4 compiler
 |
R5 kernel
 |
R6 offline host
 |
R7 narrative
 |
R8 living world
 |
R9 lab
 |
R10 first cartridge
 |\
 | R11 builder
 |
 R12 mobile shell
 |
R13 commerce
                  |
                 R14 BEAM online
                  |
                 R15 online-private
                  |
                 R16 factory  (also requires R11 Builder API)
                  |
                 R17 party
                  |
                 R18 shared hub
                  |
                 R19 instanced story regions
                  |
                 R20 shards
                  |
                 R21 shared promotion
                  |
                 R22 MMORPG expansion
```

Some implementation can overlap, but gates define what may depend on what.

# Issue sizing rule

Implementation issues SHOULD be small enough that:

- one primary contract changes;
- acceptance tests are explicit;
- independent review can understand the diff;
- rollback is clear.

Avoid tickets like “build quest engine.”

Prefer:

- define QuestInstance schema;
- implement `all` objective reducer;
- add duplicate-domain-event idempotency;
- implement quest reward idempotency receipt;
- add quest trace projection.

# Agent workflow

For every implementation ticket:

```text
read relevant spec
  ↓
write implementation plan
  ↓
implementation agent
  ↓
tests/evidence
  ↓
self-review
  ↓
correction
  ↓
independent/adversarial review
  ↓
correction
  ↓
merge readiness
```

Models should not silently amend architecture during implementation.

# Shipping rule

The rebuild has failed if it spends a year building a universal engine without shipping a cartridge.

The first major product gate spans R10 + R12 + R13: **a polished offline purchasable storypack in the production Loka app**.

The MMORPG path exists in the architecture so that work compounds, not so it blocks shipping.
