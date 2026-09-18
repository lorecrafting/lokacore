# Loka v3 Rebuild Specification Packet

**Status:** Draft 0.1 — architecture specification, not implementation authorization  
**Date:** 2026-09-17  
**Source system:** `lorecrafting/lokacore`  
**Strategic parent:** `docs/product/CARTRIDGE-ROADMAP.md`  
**Purpose:** define a clean-room, BEAM-native rebuild of Loka that preserves the useful product/mechanical ideas in Lokacore while removing transitional architecture and making AI-assisted development safe, testable, and bounded.

## 1. Why this packet exists

Lokacore has accumulated several generations of otherwise reasonable architecture:

- V1 and V2 entity APIs coexist;
- persistence can be mutated through both database APIs and active EntityServer state;
- Engine and Framework boundaries document known dependency violations and disable outbound enforcement;
- Content and Framework form a dependency cycle;
- gameplay uses both structured `Loka.Engine.Event` values and separate tuple events returned by `Loka.Game.Actions.Result`;
- terminal-builder and MCP-builder paths overlap but do not share one canonical operation layer;
- builder documentation contains historical contracts that disagree with current code;
- the React Native client and Phoenix channel protocol have drifted;
- first-party scripting is useful but the current same-BEAM `Code.eval_string` sandbox is not a strong hostile-code boundary.

Repairing these individually is possible. A clean rebuild is attractive because the product direction is also changing: Loka is now intended to launch as a cartridge platform and grow into a persistent modern MUD.

The rebuild MUST therefore be **specification-first**. The implementation model, whether Astra, Foundry, another coding agent, or a human developer, should implement explicit contracts rather than infer architecture from historical code.

## 2. Normative language

This packet uses:

- **MUST / MUST NOT** — architectural invariant; violating it requires an explicit spec amendment.
- **SHOULD / SHOULD NOT** — strong default; exceptions require documented evidence.
- **MAY** — permitted variation.

When code and this packet disagree in the future, accepted amendments and tests determine the contract. Markdown alone must not become a second unverified source of truth for machine-readable schemas.

## 3. Product invariant

Loka v3 is one authoritative game platform serving:

1. private single-player cartridge instances;
2. small-party cartridge instances;
3. certified shared areas;
4. eventually, a persistent text-first multiplayer world.

These modes MUST use the same game rules and content contracts. Single-player is not a separate engine.

A released cartridge MUST remain playable without an AI model or authoring factory online.

## 4. Architecture in one diagram

```text
                            CLIENTS
            React Native / terminal / future web
                              |
                       typed protocol
                              |
                       loka_gateway
                 Phoenix auth / channels / HTTP
                              |
                       typed commands
                              |
                       loka_runtime
        sessions -> instance/shard authority -> scheduler
                              |
                 decide -> commit -> effects
                         /           \
                  loka_core       loka_store
             pure domain rules     PostgreSQL
                  content refs      outbox/traces
                         \
                          loka_content
             cartridge compiler / capability registry

AUTHORING PLANE
Astra / Foundry / human terminal / CI
             |
        loka_builder
 workspace -> Builder API -> compiler -> Cartridge Lab -> certificate
```

The transport, authoring, runtime, domain, and persistence planes MUST remain separable.

## 5. BEAM-native design rule

The rebuild MUST use the strengths of Elixir/OTP intentionally:

- supervision for restart and fault containment;
- processes for independently concurrent **owners/services**, not automatically for every noun;
- message passing across ownership boundaries;
- DynamicSupervisor/Registry for dynamic world instances and sessions;
- Phoenix PubSub for fan-out notification, not as the authoritative mutation mechanism;
- explicit process state for hot working sets;
- crash/restart recovery from durable state;
- telemetry attached to command/event/effect causation.

The rebuild MUST NOT turn every room, item, quest, or NPC into a GenServer merely because the BEAM makes processes cheap.

The deterministic game decision layer SHOULD remain ordinary pure Elixir data/functions wherever possible.

## 6. Working top-level decisions

| Topic | Draft v0.1 decision |
|---|---|
| Language/runtime | Elixir on BEAM/OTP |
| Server UI/API | Phoenix |
| Mobile | React Native / Expo |
| Production DB | PostgreSQL from v3 start |
| Game authority | server authoritative |
| Private cartridge concurrency | one authoritative world-instance owner process |
| Shared-world concurrency | zone/area shard owners under a realm coordinator |
| Content | source YAML/JSON-like data -> compiled immutable cartridge |
| Runtime identity | cartridge-qualified definition refs + UUID runtime instance IDs |
| State correctness | single mutation authority + transactional persistence/outbox |
| Game decisions | pure/replayable functions with injected clock and RNG |
| Scripting | declarative capabilities first; restricted Elixir-syntax LokaScript interpreter as escape hatch |
| Builder | canonical typed Builder API; MCP/terminal/CLI are adapters |
| Mobile protocol | one machine-readable external schema with generated TypeScript/Elixir validation |
| Release | exact certified cartridge hash |
| AI | author/reviewer/tool client, never runtime authority |

## 7. Packet index

Read in this order:

1. [Core Principles and Non-Goals](01-core-principles.md)
2. [BEAM Runtime Architecture](02-beam-runtime-architecture.md)
3. [Domain State and Persistence](03-domain-state-persistence.md)
4. [Commands, Events, Effects, and Protocol](04-command-event-effect-protocol.md)
5. [Cartridges, Content, and Capabilities](05-cartridges-content-capabilities.md)
6. [Quests, Dialogue, Actions, and Scripting](06-quests-dialogue-actions-scripting.md)
7. [Builder API and AI Factory](07-builder-api-ai-factory.md)
8. [Cartridge Lab and Certification](08-cartridge-lab-certification.md)
9. [Mobile, Commerce, and Release](09-mobile-commerce-release.md)
10. [Security, Observability, and Operations](10-security-observability-operations.md)
11. [Evennia Design Review](11-evennia-lessons.md)
12. [Lokacore Feature Inventory](12-lokacore-feature-inventory.md)
13. [Implementation Plan](13-implementation-plan.md)
14. [Acceptance Scenarios](14-acceptance-scenarios.md)

## 8. What this packet deliberately does not do

It does not:

- preserve Lokacore module names for compatibility;
- require an in-place migration of the current application;
- require full event sourcing;
- promise arbitrary public/user scripting;
- design a general-purpose game engine for every genre;
- require distributed BEAM clustering for the first cartridge release;
- make AI inference part of moment-to-moment game rules;
- require every future feature to be anticipated now.

The clean implementation SHOULD begin in a fresh repository only after this packet receives self-review, adversarial review, corrections, and explicit acceptance.

## 9. Reference implementation policy

Lokacore MUST be retained during the rebuild as a read-only design corpus/reference implementation.

It is useful for:

- feature archaeology;
- porting content;
- studying successful tests;
- identifying historical failure modes;
- recovering world-building primitives;
- comparing behavior during migration.

The v3 implementation SHOULD NOT import old modules as dependencies. Any importer should translate old content into v3 source formats at a one-way boundary.

## 10. Specification change discipline

Every major implementation slice MUST cite the relevant spec section in its issue/PR.

If implementation proves a contract wrong:

1. produce evidence;
2. amend the spec first;
3. review the amendment;
4. then update code.

This prevents the specification from silently becoming fiction as happened with historical builder and event documentation.
