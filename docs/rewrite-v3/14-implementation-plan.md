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
- mobile protocol;
- cartridge versioning.

## R1 — Portable-kernel feasibility spike

### Objective

Prove the hardest new architectural decision before investing in the rebuild.

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
- acceptable FFI overhead;
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
apps/loka_runtime
apps/loka_builder
apps/loka_web
kernel/
mobile/
protocol/
cartridges/
docs/
```

### Tasks

- Mix umbrella;
- strict compile/dependency boundaries;
- Rust workspace if accepted;
- mobile Expo app;
- PostgreSQL dev/test container;
- formatter/lint/security configs;
- one unified CI;
- generated-schema drift check;
- ADR directory;
- AGENTS/task routing docs;
- minimal release/dev tooling.

### Gate R2

Empty-system CI is green on:

- Elixir;
- Rust;
- TypeScript;
- iOS binding compile;
- Android binding compile;
- PostgreSQL integration.

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
- Builder API operation registry;
- protocol schema/codegen;
- canonical serialization/hash rules;
- diagnostic/error registry.

### Gate R3

From registries, tooling can generate/check:

- Elixir host types/validators;
- TypeScript protocol types;
- builder/MCP tool definitions;
- docs/help excerpts;
- test fixtures.

No handwritten duplicate command/event catalogs.

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
- idempotent rewards;
- dialogue graph;
- dialogue conditions/actions;
- portable LokaScript normalized AST/bytecode;
- interpreter budgets;
- portable binding registry;
- event-chain bounds.

### Gate R7

Known Lokacore quest-bug class has a regression scenario that cannot reproduce corruption/premature completion.

## R8 — Living-world capability pack

### Objective

Make the world feel like a MUD, not a branching ebook.

### Build initially

- schedule;
- patrol;
- wander;
- ambient emitter;
- shop hours;
- nocturnal/activity windows;
- spawn/despawn policy;
- day/night;
- basic weather;
- on-demand temporal state;
- durable local jobs;
- simple merchant/shop if needed.

### Gate R8

30 simulated days:

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

## R10 — Builder API v1

### Objective

Let humans/agents author without raw repo semantics.

### Build

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
- MCP adapter.

### Gate R10

Astra/another agent can create the tiny test world using only Builder API tools and fix intentionally injected validation failures without shell/Git editing.

## R11 — First real offline cartridge

### Objective

Prove product.

Target scope:

- ~8–15 locations;
- 5–8 NPCs;
- 10–20 items;
- 1–3 connected quests;
- branching outcome;
- schedules;
- environmental change;
- simple skill/check;
- optional simple combat;
- multiple endings/consequences.

### Important

Hand-author substantial portions first. Do not immediately ask the factory to mass-generate.

The first cartridge exists to stress contracts.

### Gate R11

Full `offline_private_story` certification + human mobile smoke.

## R12 — Mobile product shell

Can overlap late R11.

### Build

- production RN navigation;
- catalog shell;
- cartridge install/delete/update;
- save slots;
- generated kernel bindings;
- living-book/touch UI refined from old design;
- accessibility;
- settings;
- offline status.

### Gate R12

Non-developer can install build, enter airplane mode, play/finish free cartridge, resume after app/device restart.

## R13 — Commerce and entitlement

### Build

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

## R14 — BEAM online authority v1

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
- Phoenix typed protocol;
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

Player can choose offline or connected deployment of same cartridge; narrative/rules match.

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
- concurrent command handling;
- join/leave/reconnect;
- loot ownership;
- cooperative dialogue/decision policy.

### Gate R17

Full party certification including race/fault tests.

## R18 — Persistent social shell

### Build selectively

- online profiles;
- friends;
- presence;
- shared hub;
- chat;
- party discovery;
- achievements/history;
- cartridge portal/quest board.

### Gate R18

Offline cartridges remain independent; same packs can launch from shared hub as private/party adventures.

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
R10 builder
 |
R11 first cartridge ── R12 mobile shell
 |                     |
 +───────────────┬─────+
                 R13 commerce
                  |
                 R14 BEAM online
                  |
                 R15 online-private
                  |
                 R16 factory
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

The first major product gate remains R11/R13: **a polished offline purchasable storypack**.

The MMORPG path exists in the architecture so that work compounds, not so it blocks shipping.
