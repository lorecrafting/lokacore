# 09 — Cartridge Lab and Certification

## 1. Objective

The Cartridge Lab is an executable test environment for a compiled cartridge or candidate shared area.

It uses the same portable kernel and, where relevant, the same BEAM runtime contracts as production with controllable infrastructure adapters.

The Lab is a product feature for developers/agents, not merely an ExUnit helper.

## 2. Determinism contract

A deterministic repro identifies:

```text
engine/kernel revision
protocol/schema versions
cartridge ID/version/hash
deployment hash
initial snapshot hash
logical clock
RNG algorithm/state/seed
ordered command stream
fault schedule
expected invariant
observed invariant
```

Running the repro on any conformant host should produce the same portable domain result.

## 3. Virtual clock

Lab provides:

```text
clock.now
clock.pause
clock.step(duration)
clock.advance_to(timestamp)
clock.run_until_idle
```

All game systems use logical time adapters.

No test needs real `sleep` for game time.

## 4. Deterministic RNG

Use explicit RNG state.

A decision consumes RNG and returns new RNG state.

Lab can:

- set seed;
- inspect draw trace;
- replay;
- search multiple seeds.

Randomness source/version is recorded in snapshot/certificate.

## 5. Boot modes

### Pure portable model

Fast kernel/reducer tests without full OTP or mobile shell.

### BEAM runtime instance

Starts actual `WorldInstance` under test supervision.

### Offline host

Runs local authority + SQLite semantics against the portable kernel.

### Integration

Uses PostgreSQL and real store transaction/outbox behavior.

### Protocol/mobile

Exercises Phoenix channel contract and generated fixtures.

### Cross-host conformance

Runs the same golden scenario through kernel host adapters and compares canonical trace hashes.

Certification uses all modes relevant to the deployment profile.

## 6. Snapshot and rewind

Lab commands:

```text
snapshot save <name>
snapshot list
snapshot restore <name>
fork <name>
```

A fork creates an isolated branch of simulation from same state/seed.

Useful for exploring alternate dialogue/quest decisions.

## 7. Trace viewer

Trace groups by correlation:

```text
command move north
  decision accepted revision 18→19
  event entity_left_room
  event entity_entered_room
    quest missing_child objective find_dock progressed
  projection room_view
```

Trace includes state diffs by component, not giant whole-state dumps.

## 8. Static certification gate

Checks:

- syntax/schema;
- manifest;
- capability compatibility;
- portability classification;
- broken references;
- template/mixin cycles;
- graph reachability;
- localization;
- asset hashes;
- scripts;
- policies/actions;
- unknown fields;
- state-scope declarations;
- cartridge namespace;
- client feature requirements;
- deployment profile constraints.

## 9. Quest/dialogue model gate

For each quest/dialogue:

- lifecycle transition validity;
- prerequisite cycles;
- branch reachability;
- terminal outcome reachability;
- duplicate event idempotency;
- reward exactly once;
- turn-in reachability;
- required-NPC survivability or alternate path;
- timeout behavior;
- abandon/retry behavior;
- scope correctness.

Bounded state exploration SHOULD exhaust small graphs.

For larger graphs, use targeted search + property testing.

## 10. Property-based tests

Use StreamData on Elixir host and equivalent portable-kernel property tests to generate:

- valid/invalid command sequences;
- duplicate commands;
- arbitrary logout/reconnect points;
- inventory moves;
- quest event permutations;
- timer advances;
- player interleavings.

Important properties:

```text
currency >= allowed minimum
item has one container
no duplicate unique reward
quest transition legal
no cross-scope state leak
revision monotonic
same command_id executes at most once
snapshot roundtrip equivalent
same portable input -> same canonical output on all hosts
```

## 11. Autonomous world simulation

Run without player:

- hours;
- days;
- weeks of logical time.

Check:

- schedules;
- shops;
- patrol reachability;
- spawn boundedness;
- ecology if enabled;
- time-window accessibility;
- durable jobs;
- ambient event rate;
- memory/state growth.

Prefer derived/on-demand systems where simulation reveals meaningless tick load.

## 12. Bot personas

Bots use the same canonical command contract.

Profiles:

- main-path player;
- completionist;
- impatient/rushing;
- combat-avoidant;
- aggressive;
- thief/hostile;
- random explorer;
- low-resource;
- disconnect-prone;
- malicious duplicate-tapper.

Agent-driven exploratory bots MAY supplement deterministic strategies, but deterministic bots are required for repeatable certification.

## 13. Multiplayer race testing

For party/shared content:

- same item picked simultaneously;
- same mob killed by two parties;
- shared door changed concurrently;
- same shop stock bought simultaneously;
- quest with different intended scopes;
- player crosses shard during event;
- party membership changes mid-quest;
- disconnect while trade/loot transfer occurs.

Use controlled interleaving schedules.

## 14. Crash/chaos testing

Inject crashes at boundaries:

```text
before decision
after decision before transaction
during transaction
after commit before in-memory adoption
after commit before client reply
before effect dispatch
during effect dispatch
after effect but before acknowledgement
```

Expected:

- durable state is either old or committed, never partial;
- command retry dedupes;
- outbox retries idempotently;
- instance restarts/reloads;
- client can resync.

Offline host gets analogous tests around local SQLite commit and app termination.

## 15. Offline lifecycle testing

Test:

- airplane mode launch after prior download;
- app killed during command;
- app killed during save migration;
- low-storage write failure;
- corrupted asset/package;
- device clock moves backward/forward;
- long absence with many due jobs;
- old cartridge release retained for pinned save;
- two device save branches diverge;
- reconnect/cloud-backup conflict.

No internet-dependent assumption may accidentally enter an `offline_private` certificate.

## 16. Script fuzzing

Generate script inputs/state for each binding.

Check:

- interpreter cannot escape allowed portable AST;
- step budget;
- query/effect budgets;
- deterministic result;
- unknown binding failure;
- effect schema validation;
- event-chain depth protection;
- host conformance.

Security tests include known AST escape attempts.

## 17. Performance certification

Cartridge manifest may declare expected envelope.

Measure:

- compile time;
- mobile boot time;
- memory per offline instance;
- BEAM memory per online instance;
- command p50/p95/p99;
- world owner mailbox;
- kernel decision latency;
- FFI boundary latency;
- DB transaction time;
- snapshot size/time;
- simulation throughput;
- effect backlog.

Performance warnings do not always block, but hard resource ceilings may.

## 18. Semantic review

After deterministic gates:

Reviewer inspects:

- contradictions;
- nonsensical schedules;
- knowledge leaks;
- dead-feeling spaces;
- impossible narrative causality;
- repeated prose;
- consequences not reflected;
- misleading choice labels;
- inaccessible endings;
- multiplayer narrative mismatches;
- private-to-shared deployment mismatches.

Every semantic finding cites definitions/traces.

## 19. Human smoke

Required for commercial release:

- physical iOS/Android device;
- onboarding;
- purchase/restore sandbox;
- cartridge download;
- offline launch;
- airplane-mode completion sample;
- start/resume;
- touch targets;
- accessibility basics;
- dialogue readability;
- save/reconnect/cloud backup if offered;
- completion/end state.

## 20. Certification profiles

```text
offline_private_story
online_private_story
party_story
shared_area
portable_capability_pack
server_capability_pack
mobile_release
```

Each profile selects mandatory gates.

## 21. Release certificate

Machine-readable example:

```json
{
  "cartridge_hash": "...",
  "deployment_hash": "...",
  "kernel_revision": "...",
  "engine_revision": "...",
  "profile": "offline_private_story",
  "gates": {
    "static": "pass",
    "host_conformance": "pass",
    "quest_model": "pass",
    "simulation": "pass",
    "offline_lifecycle": "pass",
    "semantic": "pass",
    "human_mobile": "pass"
  },
  "coverage": {...},
  "seeds": [...],
  "warnings": [...]
}
```

Only exact artifact/deployment hash is promotable.

## 22. Regression corpus

Every production bug SHOULD become:

- minimal snapshot;
- command/event sequence;
- seed;
- invariant assertion.

The corpus runs forever in certification.

This makes the product progressively harder to break.

## 23. Shared-area promotion certification

A storypack being promoted from private adventure to shared area gets a new deployment certification, not a waiver based on its private certificate.

Additional checks:

- player-vs-player concurrency;
- spawn/respawn;
- resource competition;
- shared NPC death/liveness;
- griefability;
- economic faucets/sinks;
- unique item semantics;
- world rollback;
- shard handoff;
- realm event interactions;
- load.

The private cartridge certificate remains evidence for underlying story logic.
