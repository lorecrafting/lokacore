# 16 — Architecture Decision Register

This register separates accepted direction from provisional choices that still require evidence.

## Status vocabulary

- **Accepted** — part of the rebuild contract unless amended.
- **Provisional** — preferred direction, but implementation must prove it before freeze.
- **Deferred** — intentionally not decided for current milestone.
- **Rejected** — explicitly not part of the v3 foundation.

## ADR-001 — Clean-sheet rebuild

**Status:** Accepted

Loka v3 is a new implementation from v3 contracts.

Lokacore is a reference/evidence corpus only.

No old module/API/process topology/compatibility layer is carried forward merely to accelerate delivery.

A later one-way content importer may translate selected content into v3-native schemas.

## ADR-002 — BEAM/OTP online runtime

**Status:** Accepted

Online authority is Elixir/OTP/Phoenix.

Use BEAM strengths for:

- supervision;
- process isolation;
- world/zone ownership;
- sessions;
- scheduling orchestration;
- backpressure;
- PubSub fanout;
- fault recovery.

Do not use “process per noun” by default.

## ADR-003 — Offline-first single-player storypacks

**Status:** Accepted

A downloaded offline-capable cartridge must be playable without network after acquisition/install.

Offline saves are locally authoritative for that private campaign only.

Offline competitive/economic state is not trusted as MMO authority.

## ADR-004 — Shared portable deterministic rules kernel

**Status:** Provisional

Preferred direction: one portable deterministic kernel shared by offline mobile and online BEAM hosts.

Working language: Rust.

Must pass R1 feasibility spike before freeze.

Fallback: dual Elixir/TypeScript semantics with golden-vector conformance.

## ADR-005 — Mobile binding strategy

**Status:** Provisional

Evaluate at least:

- stable C ABI + platform wrappers;
- TurboModule/JSI generation;
- relevant Rust binding generator ecosystem.

Do not hard-depend on an early-development binding generator before production-readiness evidence.

## ADR-006 — PostgreSQL online, SQLite offline

**Status:** Accepted

Online durable state: PostgreSQL.

Offline local save: SQLite or equivalent local transactional store.

Both implement the same logical command/snapshot correctness semantics; schemas need not match physically.

## ADR-007 — One online authority owner per world domain

**Status:** Accepted

Initial online private/party world: one WorldInstance owner process.

Later shared world: zone/area shard owners.

No dual mutable authority between DB and actor state.

## ADR-008 — Definition/runtime separation

**Status:** Accepted

Immutable cartridge definitions are not runtime entity rows.

Runtime entities reference versioned DefinitionRefs.

Content keys are cartridge-qualified globally and local within cartridge authoring.

## ADR-009 — Command / DomainEvent / Effect / ClientMessage separation

**Status:** Accepted

These concepts have distinct schemas and responsibilities.

“Event” is not a universal bucket.

## ADR-010 — Transactional command receipts

**Status:** Accepted

Retryable state-changing commands use stable IDs.

Online commits atomically cover authoritative state + command receipt + required durable effects/outbox metadata.

Offline authority provides equivalent local commit semantics.

## ADR-011 — Full event sourcing

**Status:** Rejected

Current state/snapshots remain authoritative.

Retain enough traces for diagnostics/replay/certification, not full history replay from genesis.

## ADR-012 — State scopes

**Status:** Accepted

State explicitly belongs to:

- player;
- party;
- instance;
- realm.

No accidental globals.

## ADR-013 — Capability registry

**Status:** Accepted

Components/actions/effects/policies/objective operators/script bindings expose machine-readable versioned contracts.

Generated/checked docs derive from this registry.

## ADR-014 — Cartridge/deployment separation

**Status:** Accepted

Cartridge = reusable story/world semantics.

Deployment = hosting policy/profile/mount/realm integration.

Shared-area promotion creates a separately certified deployment.

## ADR-015 — Campaign composition layer

**Status:** Accepted

Single-player sequels/expansions can compose cartridges through a versioned campaign manifest and explicitly exported/imported continuity state.

No arbitrary predecessor-state access.

## ADR-016 — ActionSet algebra

**Status:** Accepted

Available actions compose through:

- union;
- subtract/remove;
- intersect;
- replace;
- override.

Touch and terminal interfaces use the same action semantics.

## ADR-017 — Quest reducer architecture

**Status:** Accepted

Keep a small StateMachine lifecycle guard.

Quest progress is updated only through canonical domain events -> pure reducer -> typed/idempotent effects.

No dialogue/script direct quest-storage mutation.

## ADR-018 — LokaScript

**Status:** Accepted direction; representation details provisional

Cartridge scripting is an Elixir-like restricted authoring language compiled to portable normalized AST/bytecode and interpreted by the portable rules system.

No released cartridge execution through `Code.eval_string`.

Exact bytecode/AST format is implementation work.

## ADR-019 — Builder API canonical authority

**Status:** Accepted

MCP, terminal, CLI, CI, AI agents, and visual tools are adapters over one typed Builder API.

Workspace/revision context is mandatory for mutation.

## ADR-020 — Visual authoring UI

**Status:** Rejected as primary architecture

Do not build a second rich CRUD authoring application.

Use visuals primarily for:

- map;
- graph;
- trace;
- timeline;
- simulation;
- certification inspection.

## ADR-021 — AI runtime dependency

**Status:** Rejected

Released gameplay must not require Astra/Foundry/LLM inference.

AI is build/review tooling unless a future feature explicitly adds bounded optional AI gameplay.

## ADR-022 — Cartridge release artifact

**Status:** Accepted

Published releases are immutable/hash-addressed and exact-hash certified.

Existing saves remain pinned or use explicit tested migrations.

## ADR-023 — First monetization model

**Status:** Provisional product decision

Working Loka Stories launch model:

- one free Stories app;
- one free showcase cartridge;
- permanent à-la-carte cartridge unlocks;
- optional bundles later;
- subscription deferred.

Store policy/pricing details must be reverified at implementation/submission time.

## ADR-024 — Public user-authored scripting/content marketplace

**Status:** Deferred

First-party factory only for initial product.

Public creator systems require separate moderation/security/IP/product specification.

## ADR-025 — Distributed BEAM cluster

**Status:** Deferred

Initial online production may be one BEAM node + PostgreSQL.

Logical addressing/state ownership must not prevent later clustering.

## ADR-026 — Shared MMO area model

**Status:** Accepted direction

Previously released storypacks enter MMO as:

1. adventure portal/private-party instance;
2. geographically embedded instance;
3. selected shared-area promotion after multiplayer recertification.

No requirement that every private story become a globally shared area.

## ADR-027 — Offline entitlement behavior

**Status:** Accepted product principle; mechanism provisional

A legitimately purchased/downloaded permanent cartridge should remain usable offline without periodic always-online DRM.

Exact signed/local proof design depends on store/platform implementation evidence.

## ADR-028 — Database schema granularity

**Status:** Accepted direction

Prefer typed JSONB component/state payloads plus deliberately indexed/promoted columns.

Do not build generic EAV storage by default.

## ADR-029 — Inventory relation

**Status:** Accepted direction

One canonical containment relation represents item ownership/location.

Inventory lists are derived/indexed views, not a second source of truth.

## ADR-030 — Runtime inheritance

**Status:** Rejected

Source templates/mixins may compose authoring data.

Compiler flattens definitions.

Runtime does not chase deep prototype inheritance.

## ADR-031 — Temporal model

**Status:** Accepted

Classify time behavior as:

- derived/on-demand;
- durable scheduled job;
- ephemeral timer;
- world simulation scheduling.

Do not tick everything.

## ADR-032 — First shippable milestone

**Status:** Accepted

The architecture is not considered successful until it ships a polished offline story cartridge.

MMORPG infrastructure must not block that milestone.


## ADR-033 — Keep the portable kernel deliberately narrow

**Status:** Accepted

The portable kernel owns only deterministic mechanics that must be shared by offline and online cartridge execution.

Do not move online-only orchestration, networking, persistence coordination, sessions, shard ownership, admin, or commerce into Rust merely to reduce language count.

BEAM remains the online application/runtime architecture.

## ADR-034 — Cartridge composition uses explicit ports

**Status:** Accepted

Campaigns, expansions, embedded instances, and shared-area mounts compose through versioned exported ports/extension points.

Cartridge internals are private unless exported.

No ad-hoc global-key cross-cartridge coupling.

## ADR-035 — Downloaded rule representation is an App Store release gate

**Status:** Accepted risk treatment; exact representation provisional

The product requires downloadable offline storypacks, but Apple review treatment of downloadable interpreted rule content must be verified against the implementation.

LokaScript/portable rule IR should be as bounded/declarative as practical and expose only capabilities already shipped in the app.

A dedicated store-review position is required before first App Store submission.

## ADR-036 — Prove a real cartridge before generalizing authoring tools

**Status:** Accepted

After compiler/kernel/offline/narrative/living-world/Lab foundations, substantially hand-author the first real cartridge.

Use observed authoring pain to finish the canonical Builder API.

Do not delay the first game for a generalized world-building platform.


## ADR-037 — Separate Stories and Online clients

**Status:** Accepted

Loka ships two focused React Native/Expo app targets from one monorepo:

- **Loka Stories** — offline-first cartridge/campaign product with local authority and local saves;
- **Loka Online** — online-only multiplayer/MUD client with BEAM authority.

They share presentation/schema packages where useful but do not share authority responsibilities.

This is preferred over one giant app with pervasive offline/online conditionals.

## ADR-038 — Builder has explicit story/realm targets

**Status:** Accepted

Builder workspaces declare target:

- `story` — portable/offline capability set and offline certification;
- `realm` — online multiplayer capability set, including server-only systems;
- `promote` — explicit adaptation of an existing story cartridge into an online deployment.

A workspace cannot silently cross target boundaries.

## ADR-039 — Cross-client purchase portability is not promised by default

**Status:** Accepted product boundary; future policy provisional

Owning a cartridge in Loka Stories guarantees Stories access.

Any Loka Online benefit/unlock derived from that purchase must be a separately defined server-side entitlement/product rule based on verified evidence and current platform policy.

Local purchase flags or offline save contents never grant authoritative Online value directly.
