# Loka v3 Rebuild Specification Packet

**Status:** Draft 0.1 — architecture specification, not implementation authorization  
**Date:** 2026-09-17  
**Source system:** `lorecrafting/lokacore`  
**Strategic parent:** `docs/product/CARTRIDGE-ROADMAP.md`  
**Purpose:** define a clean-room rebuild of Loka as one mobile product with two strictly separated authority modes—offline-first **Story Mode** and BEAM-authoritative **Realm Mode**—while preserving portable cartridge semantics where reuse is valuable and removing transitional Lokacore architecture.

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

Loka v3 is one game platform with one portable rules/content model serving:

1. offline private storypacks in Loka Story Mode;
2. online private/party adventures in Loka Realm Mode;
3. certified shared areas in Loka Realm Mode;
4. eventually, a persistent text-first multiplayer world.

These modes MUST use the same compiled cartridge contracts and portable deterministic rule semantics where the cartridge declares offline support. Single-player is not a disposable engine: the authority host changes from local mobile to BEAM as content moves online.

A released cartridge MUST remain playable without an AI model or authoring factory online.

## 4. Architecture in one diagram

```text
                      COMPILED CARTRIDGE
                              |
                    portable rules/kernel
                      /               \
                     /                 \
       OFFLINE MOBILE                  ONLINE BEAM
   LocalInstanceAuthority             loka_runtime
   local SQLite                     WorldInstance/Shard
         |                                |
 React Native projection        commit/effects/observation
                                          |
                                      PostgreSQL
                                          |
                                      loka_gateway
                                  Phoenix / HTTP / channels

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

The online authority/orchestration layer SHOULD remain idiomatic Elixir/OTP. Rules that must execute both offline and online SHOULD live in the shared portable deterministic kernel; server-only orchestration and capability adapters remain Elixir.

## 6. Working top-level decisions

| Topic | Draft v0.1 decision |
|---|---|
| Online language/runtime | Elixir on BEAM/OTP |
| Portable offline rules | Shared deterministic kernel; Rust is the working choice pending a mandatory cross-platform spike |
| Server UI/API | Phoenix |
| Mobile | One React Native / Expo app with strict Story Mode (local authority) and Realm Mode (remote BEAM authority) session boundaries |
| Online production DB | PostgreSQL from v3 start; offline saves use local SQLite |
| Game authority | offline: local serialized authority; online: BEAM server authoritative |
| Offline private authority | local serialized instance authority + local SQLite |
| Online private concurrency | one authoritative BEAM world-instance owner process |
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
7. [Offline Storypacks and the Path to the MMORPG](07-offline-storypacks-to-mmo.md)
8. [Builder API and AI Factory](08-builder-api-ai-factory.md)
9. [Cartridge Lab and Certification](09-cartridge-lab-certification.md)
10. [Mobile, Commerce, and Release](10-mobile-commerce-release.md)
11. [Security, Observability, and Operations](11-security-observability-operations.md)
12. [Evennia Design Review](12-evennia-lessons.md)
13. [Lokacore Feature Inventory](13-lokacore-feature-inventory.md)
14. [Implementation Plan](14-implementation-plan.md)
15. [Acceptance Scenarios](15-acceptance-scenarios.md)
16. [Architecture Decision Register](16-decision-register.md)
17. [Research Baseline and External References](17-research-baseline.md)
18. [Specification Review Record](18-review-record.md)

## 8. Specification authority map

This packet is intentionally comprehensive, but not every document has the same authority.

### Normative architecture

Implementation MUST conform to:

- `01-core-principles.md`
- `02-beam-runtime-architecture.md`
- `03-domain-state-persistence.md`
- `04-command-event-effect-protocol.md`
- `05-cartridges-content-capabilities.md`
- `06-quests-dialogue-actions-scripting.md`
- `07-offline-storypacks-to-mmo.md`
- `08-builder-api-ai-factory.md`
- `09-cartridge-lab-certification.md`
- `10-mobile-commerce-release.md`
- `11-security-observability-operations.md`
- accepted decisions in `16-decision-register.md`

### Normative gates and sequencing

- `14-implementation-plan.md`
- `15-acceptance-scenarios.md`

These define what evidence is required before later phases may depend on earlier work. Exact ticket decomposition may evolve without changing architecture.

### Informative/reference evidence

- `12-evennia-lessons.md`
- `13-lokacore-feature-inventory.md`
- `17-research-baseline.md`
- `18-review-record.md`
- historical Lokacore documents linked from the product roadmap

These explain why decisions were made but do not override normative contracts.

### Conflict rule

Two normative documents disagreeing is a **specification defect**. Implementation MUST stop at that boundary until the packet is reconciled. Do not invent an implicit precedence rule, pick whichever text is convenient, or treat newer prose as silently overriding an accepted ADR.

Machine-readable schemas/registries become the executable source of truth for their defined contracts once implemented; this packet governs their intended semantics.

## 9. What this packet deliberately does not do

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

## 10. Reference implementation policy

Lokacore MUST be retained during the rebuild as a read-only design corpus/reference implementation.

It is useful for:

- feature archaeology;
- extracting content semantics and examples;
- studying successful tests;
- identifying historical failure modes;
- recovering world-building primitives;
- comparing new behavior against the old reference implementation where useful.

The v3 implementation MUST be a clean-sheet codebase. It MUST NOT copy, import, wrap, preserve compatibility with, or depend on Lokacore modules/APIs merely to accelerate the rebuild. Lokacore is evidence, not a codebase migration target.

A later one-way content importer MAY translate selected old world/content files into v3 source formats, but the imported result must satisfy v3 schemas exactly and must not require legacy runtime compatibility.

## 11. Specification change discipline

Every major implementation slice MUST cite the relevant spec section in its issue/PR.

If implementation proves a contract wrong:

1. produce evidence;
2. amend the spec first;
3. review the amendment;
4. then update code.

This prevents the specification from silently becoming fiction as happened with historical builder and event documentation.
