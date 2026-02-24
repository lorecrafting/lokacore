# Unified Object System (V2 Architecture)

> **Status:** V2 core implemented — design reference for remaining migration phases
> **Date:** 2026-02-10
> **Scope:** Complete rearchitecture of Loka's data storage and entity system
> **Design Doc:** `docs/architecture/unified-object-system-v2.md`

## Context for Continuation

This design doc was developed through a deep architectural conversation (Feb 10, 2026).
To continue refining, read this doc fully — it captures all decisions, rationale, and open questions.

**The Problem We're Solving:**
Loka currently has 3 data stores (YAML/ETS registry + SQLite DB + GenServer) that must stay in sync manually. This caused 5+ bugs during builder testing. Rooms exist in all 3 stores simultaneously. The `entity_attributes` EAV table silently loses data on save/load cycles. Players use a completely separate `GameState` table. Content (quests, dialogues) uses a separate `TypedObject` system in ETS.

**The Solution:**
Inspired by Evennia's ObjectDB but adapted for Elixir/BEAM. One table (`entities`), one source of truth (DB), GenServer as live cache. Everything is an entity — rooms, NPCs, items, exits, player characters, quests, dialogues, zones, skills, system scripts. Framework logic moves from hardcoded Elixir to scriptable behavior on entities.

**Key Decisions Made:**
1. Keep "Entity" naming (not "Object") — ECS convention, less migration churn
2. DB is single source of truth, GenServer is live cache, YAML is seed/export format
3. No ETS registry — DB handles all queries, optional ETS read-through cache for hot content
4. Players are entities with player components (`players` table stays for auth only)
5. `data` field eliminated — all game data in `components` JSON
6. `entity_attributes` EAV table eliminated — merged into components
7. Containment via `location_id` (Evennia model) — no separate inventory lists
8. System entities replace hardcoded supervised GenServers (data-driven, builder-creatable)
9. Framework becomes thin dispatch layer — game rules move to scripts on entities
10. Scripts are sandboxed Elixir — LLM-readable/writable, hot-reloadable, per-entity customizable
11. *(stability)* Crash recovery, shutdown ordering, idle timeout — see Decisions 11-13
12. *(stability)* All entity writes go through EntityServer — no direct DB writes while GenServer is running
13. *(stability)* `Entities.find/1` is the only key lookup — type always required, no single-arg convenience
14. *(naming)* `Components.QuestDef` (not `Components.Quest`) — avoids confusion with quest entities
15. *(naming)* `type: :system` for system entities — `type: :script` reserved for standalone script definitions
16. *(naming)* Behavior implementations live in `lib/loka/behaviors/` — separate from engine interface
17. *(scope)* Plugin system deleted — V2 system entities replace all plugin functionality
18. *(scope)* ~25 framework modules deferred — delete now, rebuild as scripts when needed
19. *(infra)* Tags use `entity_tags` join table — avoids `json_each()` full-scan performance cliff
20. *(infra)* EntitySeeder runs as boot Task, not permanent supervised child
21. *(perf)* EntityServer live state in public ETS — reads bypass GenServer mailbox
22. *(perf)* `account_id` indexed column on entities — player login avoids JSON full scan
23. *(perf)* Batch DB operations (`save_batch`, `get_many`) — critical for seeding, shutdown, prototype apply
24. *(safety)* Multi-entity transactions via deterministic GenServer lock ordering — prevents double-consume bugs
25. *(safety)* Graceful shutdown freezes EntityServers before saving — no mid-mutation saves
26. *(safety)* Script auto-disable after 5 consecutive crashes + version history for rollback
27. *(safety)* Script error budget: query limits, memory limits, execution time caps
28. *(ops)* Telemetry events on all core paths — entity lifecycle, script execution, cache, queries
29. *(ops)* System entity boot priority — lower number starts first, default 100
30. *(design)* `on_event/3` arity — separate event_name atom from payload map
31. *(design)* Behavior dispatch as middleware pipeline — handlers can modify payload
32. *(design)* Flat containment only for MVP — no nested containers
33. *(design)* Transient volatile state on EntityServer — not persisted, for runtime working data
34. *(design)* Component accessor macro deferred — start with plain modules
35. *(design)* Entity types are open — new types need no schema migration
36. *(design)* `run_script(key, args)` binding — scripts can call shared script entities
37. *(safety)* `dispatch_event` returns `{:ok, state}`, `{:halted, state}`, or `{:error, state}` — callers interpret halt as denial (before-events) or handled (after-events)
38. *(safety)* `try/catch` (not `try/rescue`) in dispatch — catches exits from dead/slow GenServers, not just exceptions
39. *(safety)* Tag mutations write to DB immediately — not deferred to 60s dirty-check
40. *(design)* Volatile state accessed via process dictionary helpers, NOT callback parameters — keeps callback interface clean
41. *(design)* Rooms idle-timeout after 15-30 min with no entities — not "always live"
42. *(design)* Entity deletion cascade — rooms refuse delete if occupied, orphaned entities detected
43. *(scope)* Hot code reload section removed — server restart handles it, manual `:code.purge` is dangerous
44. *(scope)* Script version history in audit log table, not entity metadata — avoids entity bloat
45. *(ops)* VACUUM is manual/cron only — never via system entity tick (blocks all writes)
46. *(safety)* `allow()` control flow removed — pipeline halts are final, no post-hoc overrides
47. *(safety)* Crash during dispatch returns `{:error, state}` (not `{:ok, state}`) — callers can distinguish crash from success
48. *(safety)* Entity load failure returns `{:error, :invalid_entity}` — prevents crash loops from corrupt data
49. *(safety)* SystemSupervisor has `max_restarts: 5, max_seconds: 60` — prevents infinite crash loops from buggy system entities
50. *(infra)* Event envelope includes `correlation_id` and `caused_by` — traces event chains (attack → damage → death → loot)
51. *(design)* Script bindings expanded: `long_desc/extra_desc` access, `exits()/exit_to()`, `find_by_keyword()`
52. *(simplify)* `locks` merged into `components` — all game-mechanic data in one JSON column, consistent with Decision 3
53. *(simplify)* `parent_key` moved to `metadata["parent_key"]` — not needed at runtime, provenance only
54. *(simplify)* EntityCache deferred to post-MVP — direct DB queries with indexes are fast enough, add cache only if profiling shows need
55. *(simplify)* Scripts flattened to `event_name → code string` — tick interval consolidated in `components["tick"]["interval"]`, single source of truth
56. *(simplify)* One-time V1→V2 YAML conversion — seeder handles V2 format only, no backward-compatible mapping code
57. *(simplify)* Seeder conflict resolution (`edited_by`/`edited_at`) deferred — YAML always wins for MVP
58. *(safety)* Stale `online` tags cleared at boot — prevents stale session state after crash/restart
59. *(design)* `{:halted, state}` (not `{:denied, state}`) — neutral pipeline return, callers interpret as denial or handled
60. *(design)* Script execution model: same-entity mutations synchronous, cross-entity mutations queued
61. *(design)* `Entity.new/1` constructor centralizes defaults + validation; `Entity.snapshot/1` for rollback
62. *(design)* Tag sync rules: entity save path excludes tags, join table writes are immediate, EntityServer init loads tags from join table
63. *(safety)* `Volatile.get/set` raises outside EntityServer process — prevents silent nil bugs from spawned Tasks
64. *(naming)* `get_by_key` → `Entities.find` — type always required, no single-arg convenience, eliminates ambiguity bugs
65. *(naming)* `Components.System` / `"system"` → `Components.Service` / `"service"` — describes boot priority for system entities without name collision with entity type
66. *(design)* `find_entity(key)`, `get_entity()`, `query()` removed from script bindings — scripts use `Entities.find()` directly
67. *(naming)* Event names shortened: `on_looked_at` → `on_look`, `on_used` → `on_use`, `on_entity_entered` → `on_enter`, `on_entity_left` → `on_leave` — builder-friendly, matches YAML script keys
68. *(design)* `send_signal` merged into `emit` — `emit(target, event_name, payload)` for cross-entity events, replaces V1 signals with named event dispatch through full pipeline
69. *(design)* Event payload table expanded to 21 standard events with `self()` context and actor fields
70. *(simplify)* Unified `Entities.find/1` replaces `get`, `get_by_key_and_type`, `query`, `get_contents`, `get_by_tag`, `get_prototype` — one entry point, optimal path picked by query shape. Scripts call `Entities.find` directly — no wrapper layer. Same API at engine, framework, and script levels.
71. *(design)* Framework queries by component (capability), not type (classification) — `find(component: "combatant")` not `find(type: :npc)`
72. *(design)* Type is a content-level concern — fixed enum for MVP, open type system post-MVP consideration
73. *(design)* `on_before_*` pattern documented as extensible — add before-events only when game logic needs to cancel specific actions
74. *(design)* Custom event PubSub translation clarified — `emit(:on_fish_caught)` strips `on_` for transport, re-adds at dispatch
75. *(docs)* Hook-to-event mapping table is non-exhaustive — event names are open, any atom can be dispatched

**Areas Refined (Feb 10, 2026):**
- ~~Detailed migration execution plan~~ → **Section 16** (file-level specifics for all 6 phases)
- ~~Script bindings API completeness~~ → **Section 18** (complete V2 bindings, validated against V1)
- ~~Edge system mapping details~~ → **Section 15** (all ~85 framework modules mapped to V2 fate)
- ~~Component accessor module macro design~~ → **Section 17** (`use Loka.Component` macro + 23 component modules)
- ~~Testing patterns for script-heavy entities~~ → **Section 20** (4 test patterns, simplified infrastructure)
- ~~YAML format changes~~ → **Section 19** (V2 format, one-time conversion from V1)
- ~~`mix loka.export` implementation~~ → **Section 16, Phase 6** (export task spec)

**Areas Added (Feb 10, 2026 — stability review):**
- ~~Crash semantics~~ → **Decisions 11-13** (crash recovery, shutdown ordering, idle timeout)
- ~~Optimistic locking~~ → **Section 1** (version field on entities table)
- ~~Seeder conflict resolution~~ → **Section 8** (explicit rules for YAML vs DB conflicts)
- ~~Operational tooling~~ → **Section 21** (audit log, inspection, script tracing)
- ~~Migration strategy~~ → **Section 22** (rewrite core, evolve web/content layers)
- ~~PubSub race conditions~~ → **Decision 8** (atomic room transitions, standard event envelope, zone fan-out)
- ~~Implementation gaps~~ → **Q11-Q16** (behavior loading, key ambiguity, tick timers, component evolution, event context)

**Areas Refined (Feb 10, 2026 — hardening review):**
- ~~Plugin system removal~~ → **Section 23** (replaced by system entities)
- ~~Framework scope reduction~~ → **Section 24** (~25 modules cut from migration scope)
- ~~Actions/channels assessment~~ → **Section 25** (evolve in place, ~1,500 LOC mechanical changes)
- ~~Tag indexing~~ → **Section 1** (entity_tags join table from day one)
- ~~Naming clarifications~~ → **Decisions 14-16** (QuestDef, type: :system, behaviors directory)
- ~~Optimistic locking hardened~~ → **Decision 1 update** (all writes go through EntityServer)
- ~~get_by_key ambiguity~~ → **Q12 update** (type always required, no single-arg version)
- ~~Migration phase reorder~~ → **Section 11** (Foundation → Seeder → EntityServer)
- ~~on_save callback removed~~ → **Decision 6 update** (saves are infrastructure, not game logic)
- ~~dispatch_event crash rollback~~ → **Decision 11 update** (explicit snapshot pattern)
- ~~Seeder conflict detection~~ → **Section 8 update** (edited_at timestamp)
- ~~Table naming simplified~~ → **Section 16** (drop old tables, create as `entities`)

**Areas Refined (Feb 10, 2026 — senior BEAM review):**
- ~~Player login full scan~~ → **Section 1, Decision 22** (indexed `account_id` column)
- ~~Read path serialization~~ → **Section 3, Decision 21** (public ETS live state table)
- ~~Multi-entity atomicity~~ → **Decision 4 update** (deterministic GenServer lock ordering)
- ~~Shutdown race condition~~ → **Decision 12 update** (freeze step before saving)
- ~~System entity boot order~~ → **Decision 9 update** (priority-based startup)
- ~~Script safety~~ → **Section 26** (error budget, auto-disable, version history, query limits)
- ~~Containment depth~~ → **Decision 4 update** (flat only for MVP, explicit decision)
- ~~Contents cache removed~~ → **Decision 4 update** (eliminated dual-store risk)
- ~~on_event arity~~ → **Decision 6 update** (`on_event/3` with separate event_name and payload)
- ~~Behavior dispatch~~ → **Decision 7 update** (middleware pipeline, handlers modify payload)
- ~~Telemetry~~ → **Section 28** (events on all core paths)
- ~~Entity type extensibility~~ → **Decision 35** (open type system, no migration needed)
- ~~Volatile state~~ → **Section 27** (transient EntityServer working data)
- ~~Component macro~~ → **Decision 34** (deferred, start with plain modules)
- ~~Batch operations~~ → **Section 7 update** (`save_batch`, `get_many`, `get_many_by_keys`)
- ~~Hot code reload~~ → **Section 29** (behavior module reload strategy)
- ~~DB maintenance~~ → **Section 30** (VACUUM, ANALYZE, maintenance task)
- ~~Key uniqueness~~ → **Q12 update** (per-type, NOT global — existing content has cross-type duplicates)
- ~~Script-to-script references~~ → **Section 18 update** (`run_script(key, args)` binding)
- ~~`get_by_key` filtering~~ → **Q12 update** (renamed to `Entities.find/1`, type always required)

**Areas Refined (Feb 10, 2026 — MUD engine + BEAM hardening review):**
- ~~Volatile state callback mismatch~~ → **Decision 6 update, Section 27 update** (process dictionary, not callback params)
- ~~dispatch_event doesn't communicate deny~~ → **Decision 7 update** (returns `{:ok, state}` or `{:halted, state}`)
- ~~EntitySeeder async Task~~ → **Decision 9 update** (synchronous seeding before Endpoint)
- ~~try/rescue misses exits~~ → **Decision 11 update** (`try/catch` catches GenServer timeouts)
- ~~Transaction rollback hand-wavy~~ → **Decision 4 update** (validate-then-apply pattern)
- ~~account_id in migration Step 4.1~~ → **Section 16 update** (removed from player component)
- ~~Room always-live wasteful~~ → **Decision 13 update** (idle timeout 15-30 min)
- ~~Tag mutation staleness~~ → **Section 1, Q1 update** (immediate DB writes for tags)
- ~~get_entity(key_or_id) ambiguous~~ → **Section 18 update** (explicit `get_entity(key, type)`)
- ~~Missing script bindings~~ → **Section 18 update** (dialogue, mood, equip, inventory_full)
- ~~Control flow semantics undefined~~ → **Section 18 update** (`deny()`, `handled()`, `continue()` defined — `allow()` removed per Decision 46)
- ~~Script ordering unclear~~ → **Decision 6 update** (one script per event per entity)
- ~~Respawn mechanics missing~~ → **Section 34** (death → respawn flow)
- ~~Entity deletion cascade~~ → **Section 35** (occupied room protection, orphan detection)
- ~~Module fate header counts wrong~~ → **Section 15 update** (corrected C, D, G headers)
- ~~Tick vs idle timeout~~ → **Decision 13 update** (self-ticks don't reset idle)
- ~~Components directory~~ → **Section 25 update** (`lib/loka/components/`, not `engine/components/`)
- ~~Player.online? layer break~~ → **Section 17 update** (moved to Session helper)
- ~~Script versions bloat entities~~ → **Section 26 update** (versions in audit log, not metadata)
- ~~Hot code reload dangerous~~ → **Section 29** (replaced: restart handles it)
- ~~count() name collision~~ → **Section 18 update** (renamed to `length()` for lists)
- ~~Event name convention~~ → **Decision 8 update** (PubSub plain names, callbacks `on_` prefix)
- ~~VACUUM blocks writes~~ → **Section 30 update** (manual/cron only)
- ~~save_batch skips version check~~ → **Section 7 update** (documented: only safe when frozen)
- ~~Character creation missing~~ → **Section 5 update** (new player → character entity flow)
- ~~Tag query caching~~ → **Section 3 update** (acceptable for MVP, note added)

**Areas Refined (Feb 11, 2026 — senior MUD engine + BEAM hardening review #3):**
- ~~`allow()` pipeline contradiction~~ → **Decision 46** (removed — halts are final)
- ~~dispatch crash swallowed as success~~ → **Decision 47** (returns `{:error, state}`, fail-open for before-events)
- ~~entity_tags PK mismatch~~ → **Section 1 update** (aligned SQL with Ecto migration pattern)
- ~~`transaction()` in API but not MVP~~ → **Section 7 update** (removed from API listing)
- ~~System entity startup before behavior dispatch~~ → **Section 11 update** (moved to Phase 3)
- ~~V1 event correlation dropped~~ → **Section 8 update** (`correlation_id` + `caused_by` on envelope)
- ~~Entity load failure crash loop~~ → **Decision 48** (returns `{:error, :invalid_entity}`)
- ~~SystemSupervisor infinite restart~~ → **Decision 49** (max_restarts: 5, max_seconds: 60)
- ~~Combat get_contents DB perf~~ → **Section 3 update** (ETS priority note for combat)
- ~~WorldGraph/minimap not mapped~~ → **Section 15 update** (added to migration map)
- ~~Config.Balance not mapped~~ → **Section 15 update** (added to migration map)
- ~~Missing description bindings~~ → **Section 18 update** (long_desc, extra_desc read/write)
- ~~Missing exit query bindings~~ → **Section 18 update** (exits(), exit_to())
- ~~Missing keyword search binding~~ → **Section 18 update** (find_by_keyword())
- ~~Volatile state process warning~~ → **Section 27 update** (must not call from spawned Tasks)
- ~~Admin.GameLog/SocialLoader not mapped~~ → **Section 15 update** (explicit deletion)
- ~~find_entity(key) convenience~~ → **Section 18 update** (removed — use `get_entity(key, type)` instead, type always required)
- ~~Macro design too verbose~~ → **Section 17 update** (trimmed to note)
- ~~Rate limit enforcement unclear~~ → **Section 18 update** (bindings module counters)
- ~~Tick must not reset idle~~ → **Decision 13 update** (implementation note)
- ~~Test helper extraction~~ → **Section 20 update** (start_test_entity_server helper)
- ~~Missing system entity test pattern~~ → **Section 20 update** (Pattern E added)
- ~~Supervision tree After list incomplete~~ → **Section 15 update** (added missing entries)
- ~~Builder AI for scripts~~ → **Section 9 update** (brief note)

**Areas Refined (Feb 11, 2026 — senior MUD engine + BEAM simplification review #4):**
- ~~`mood` missing from SQL schema~~ → **Section 1 update** (added to CREATE TABLE)
- ~~`entity_log` missing from migration~~ → **Section 11 update** (added to Phase 1)
- ~~test helper `account_id` in wrong place~~ → **Section 20 update** (moved to top-level field)
- ~~supervision tree count wrong~~ → **Executive Summary update** (~22, not ~17)
- ~~script execution model unspecified~~ → **Section 3 update** (same-entity sync, cross-entity queued)
- ~~tag dual-path sync rules~~ → **Section 1 update** (entity save excludes tags, join table is immediate)
- ~~`{:denied, state}` wrong for after-events~~ → **Decision 7 update** (renamed to `{:halted, state}`)
- ~~stale `online` tags after restart~~ → **Section 5 update** (boot cleanup step)
- ~~`force_save` trigger list incomplete~~ → **Section 3 update** (added XP, gold, equipment, etc.)
- ~~CombatServer interaction unspecified~~ → **Section 15 update** (combat hot-path pattern)
- ~~dialogue cursor location~~ → **Section 27 update** (on player's EntityServer, not NPC's)
- ~~Volatile.get silent nil bug~~ → **Section 27 update** (raises outside EntityServer process)
- ~~exit entity seeding detail missing~~ → **Section 8 update** (V1 room exits → standalone entities)
- ~~`find_entity(key, type)` duplication~~ → **Section 18 update** (removed, use `get_entity(key, type)`)
- ~~`get_by_key/1` error type~~ → **Section 7 update** (removed single-arg version entirely, type always required)
- ~~hook-to-event table incomplete~~ → **Decision 7 update** (noted as non-exhaustive + expanded)
- ~~missing script bindings~~ → **Section 18 update** (create_exit, remove_exit, get_tags, is_player?, prototype_key)
- ~~`handled()`/`deny()` mapping unclear~~ → **Section 18 update** (explicit pipeline mapping)
- ~~missing Pattern F (behavior unit test)~~ → **Section 20 update**
- ~~Phase 5 could be parallelized~~ → **Section 11 update** (noted)
- ~~`locks` separate JSON column~~ → **Decision 52** (merged into components)
- ~~`parent_key` top-level column~~ → **Decision 53** (moved to metadata)
- ~~EntityCache premature~~ → **Decision 54** (deferred to post-MVP)
- ~~scripts nested structure + tick interval dual source~~ → **Decision 55** (flattened, tick in components)
- ~~backward-compatible seeder~~ → **Decision 56** (one-time conversion instead)
- ~~seeder conflict resolution premature~~ → **Decision 57** (YAML wins for MVP)
- ~~`Entity.new/1` constructor~~ → **Section 16 update** (centralized entity creation)
- ~~`Entity.snapshot/1` for rollback~~ → **Decision 11 update** (named concept)
- ~~`save_batch` no safety assertion~~ → **Section 7 update** (raises if GenServers running)

**Areas Refined (Feb 11, 2026 — clean rebuild expansion review #5):**
- ~~Missing modules from Section 15~~ → **Section 15 update** (Social, SoundEnvironment, Broadcast, Actions, Conditions, ContentValidator, Spark, ConfigSchema, Quest sub-modules all mapped)
- ~~"Clean rebuild" not concrete enough~~ → **Section 37** (complete file-level rebuild plan with before/after directory structures)
- ~~No Phase 0 (pre-migration preparation)~~ → **Section 37** (archive branch, YAML conversion, test baseline, dependency audit)
- ~~Builder commands migration not detailed~~ → **Section 38** (16 builder sub-modules: what changes, what stays, mechanical update patterns)
- ~~Web/LiveView layer migration unspecified~~ → **Section 39** (admin dashboard, auth, LiveView components — all evolve in place)
- ~~Post-V2 directory structure missing~~ → **Section 40** (complete directory tree of final codebase)
- ~~No implementation ordering within phases~~ → **Section 37** (dependency graph within each phase, what blocks what)
- ~~Socials/Emotes system unmapped~~ → **Section 15 update** (Decision 76: Social becomes entity type, SocialLoader deleted)
- ~~Test migration strategy incomplete~~ → **Section 41** (full test file mapping: which test files survive, which are rewritten, which are deleted)

**Areas Refined (Feb 11, 2026 — implementation readiness audit #6):**
- ~~`find/1` return type polymorphism~~ → **Section 7 update** (split into `find_one/1` + `find_all/1`, UUID guard on single-arg)
- ~~Cross-entity queue underspecified~~ → **Section 3 update** (ActionQueue reuse, error handling, queue draining)
- ~~Script code transformation missing from YAML conversion~~ → **Section 19 update** (binding transform rules, script code rewriting)
- ~~Dispatch side-effect rollback not addressed~~ → **Decision 11 update** (side-effect ordering guidance)
- ~~PubSub topic rename not called out~~ → **Section 11 update** (explicit topic rename in Phase 3)
- ~~Entity count growth / no GC~~ → **Section 42** (entity lifecycle management: TTL, cleanup, orphan sweep)

**Areas Refined (Feb 11, 2026 — implementation readiness audit #7):**
- ~~Script transform table incomplete (~14 missing renames)~~ → **Section 19 update** (expanded to 23 entries + Removed Bindings sub-table + Unchanged bindings note)
- ~~~25 unmapped V1 modules~~ → **Section 37 update** (Tier 2 Addendum: game actions, mechanics, behaviors, world_builder, engine utilities)
- ~~V1 behaviors fate undecided~~ → **Section 37 update** (explicit decision: rewrite to EntityBehavior interface in Phase 3d)
- ~~Config.Balance wrong path~~ → **Section 37 update** (corrected `lib/loka/framework/config/balance.ex` → `lib/loka/config/balance.ex`)
- ~~K1 section count wrong~~ → **Section 36 update** (Sections 1-42, not 1-41)
- ~~WorldLoader not in Tier 3 delete list~~ → **Section 37 update** (added to Tier 3)
- ~~`send_signal` wrong V1 name in transform table~~ → **Section 19 update** (V1 name is `send_to`, not `send_signal`)
- ~~Phase 3 file list missing SystemSupervisor, volatile.ex, behaviors rewrite~~ → **Section 16 update** (Steps 3.4, 3.5 added)
- ~~Phase 5 file list missing game/actions (11 modules) and mechanics (8 modules)~~ → **Section 16 update** (Steps 5.4, 5.5 added)
- ~~Post-V2 directory structure missing game/ and mechanics/ layers~~ → **Section 40 update** (added both layers + corrected module counts)
- ~~Phase 6 world_builder/ manager modules not referenced~~ → **Section 16 update** (Step 6.2 expanded)

**Remaining Open Areas:**
- Performance benchmarks (DB query speed for tag/component queries at scale — run before Phase 1)
- Actual implementation and iteration

## Executive Summary

Replace Loka's current three-store architecture (YAML/ETS registry + SQLite DB + GenServer) with a unified single-source-of-truth model inspired by Evennia's ObjectDB, adapted for the BEAM runtime.

**One table. One source of truth. Everything is an entity.**

### What Changes

| Before | After |
|--------|-------|
| 3 stores (YAML/ETS, DB, GenServer) with manual sync | 1 store (DB) + GenServer as live cache. All writes through EntityServer. |
| TypedObject for prototypes, Entity for instances | One Entity type for everything |
| Separate GameState table for players | Players are entities with player components |
| ETS TypedObject Registry (3 tables) | Eliminated. DB handles all queries. |
| entity_attributes EAV table | Eliminated. All data in components JSON. |
| Dual-store sync in RoomManager | Gone. One store, no sync needed. |
| Content (quests, dialogues) separate from entities | Same table, different type. |
| Global systems as hardcoded supervised GenServers | System entities (`type: :system`) with behavior modules. |
| Plugin system (9 modules, unused) | Deleted. System entities replace all plugin functionality. |
| Tags as JSON array (full table scan) | `entity_tags` join table (indexed). |
| 5 JSON columns (components, behaviors, locks, scripts, metadata) | 4 JSON columns (locks merged into components). |
| `parent_key` as top-level column | Moved to `metadata["parent_key"]` (provenance only, not used at runtime). |
| ~50 supervised children | ~22 infrastructure + system entities started by tag. |

### What Stays

| Component | Why |
|-----------|-----|
| GenServer per active entity (EntityServer) | BEAM-native concurrency, process isolation |
| Entity struct | Clean in-memory representation |
| Component system | Composition over inheritance, type-safe |
| Spawner pattern | Prototype → instance workflow |
| YAML content files | Authoring format, git-trackable |
| Script sandbox | Safe builder-created behavior |
| PubSub event system | Room/entity/player channels |
| Session Registry | Online player tracking (BEAM-native) |
| `players` auth table | Authentication stays separate |

---

## 1. The Entities Table

One table for ALL game entities: rooms, NPCs, items, exits, player characters, quests, dialogues, zones, skills, recipes, standalone scripts, and anything else.

```sql
CREATE TABLE entities (
  id              TEXT PRIMARY KEY,    -- UUID
  type            TEXT NOT NULL,       -- room, npc, item, exit, character, quest,
                                       -- dialogue, zone, storyline, skill, recipe,
                                       -- resource, status, system, ...
  key             TEXT,                -- semantic key ("village_elder", "intro_quest")
  prototype_key   TEXT,                -- which prototype spawned this instance
  is_prototype    BOOLEAN DEFAULT FALSE,
  version         INTEGER DEFAULT 1,   -- optimistic lock: incremented on every save
  short_desc      TEXT,                -- name / title
  long_desc       TEXT,                -- description
  extra_desc      TEXT,                -- examination text
  keywords        TEXT,                -- JSON array of strings
  primary_keyword TEXT,
  mood            TEXT,                -- affects NPC display and behavior selection (see Section 32)
  location_id     TEXT REFERENCES entities(id), -- NULL for non-located entities
  account_id      TEXT REFERENCES players(id), -- NULL except for character entities (indexed for login)
  components      TEXT,                -- JSON: ALL game-mechanic data (including locks/access control)
  behaviors       TEXT,                -- JSON: behavior module list
  scripts         TEXT,                -- JSON: sandboxed behavior code (event_name → code string)
  metadata        TEXT,                -- JSON: system bookkeeping (including parent_key provenance)
  inserted_at     TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- Tags: separate join table (NOT a JSON column) for indexed queries
-- No composite primary key (Ecto doesn't support them cleanly) — unique index instead
CREATE TABLE entity_tags (
  entity_id       TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  tag             TEXT NOT NULL
);
CREATE UNIQUE INDEX entity_tags_entity_tag_idx ON entity_tags(entity_id, tag);
CREATE INDEX entity_tags_tag_idx ON entity_tags(tag);
CREATE INDEX entity_tags_entity_id_idx ON entity_tags(entity_id);

-- Core indexes
CREATE INDEX entities_type_idx ON entities(type);
CREATE INDEX entities_key_idx ON entities(key);
CREATE INDEX entities_location_id_idx ON entities(location_id);
CREATE INDEX entities_prototype_key_idx ON entities(prototype_key);
CREATE INDEX entities_is_prototype_idx ON entities(is_prototype);

-- Composite index for the most common query: "what's in this room/container of type X?"
CREATE INDEX entities_location_type_idx ON entities(location_id, type);

-- Prototype uniqueness: only one prototype per key+type
CREATE UNIQUE INDEX entities_prototype_unique
  ON entities(key, type) WHERE is_prototype = 1;

-- NOTE: Keys are unique per type, NOT globally unique.
-- Existing content has cross-type duplicates (e.g., "focus" is both a skill and a resource,
-- "wild_berries" is both a gathering node and an item). This is natural in game content.
-- Always use find(key: key, type: type) — type is always required.

-- Player character lookup by account (for login — avoids json_extract full scan)
CREATE INDEX entities_account_id_idx ON entities(account_id);

-- Component queries (SQLite JSON) — NOTE: full table scan, not indexed
-- Usage: WHERE json_extract(components, '$.combatant.health') < 10
-- Use sparingly; prefer indexed columns (type, key, location_id, account_id) for filtering first

-- Audit log for debugging and script version history
CREATE TABLE entity_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id       TEXT NOT NULL,
  action          TEXT NOT NULL,        -- "create", "update", "delete", "force_save", "script_edit"
  changes         TEXT,                 -- JSON: what changed (diff or summary)
  source          TEXT,                 -- "script:torch_flicker", "builder:admin", "seeder", "behavior:Weather"
  inserted_at     TEXT NOT NULL
);
CREATE INDEX entity_log_entity_id_idx ON entity_log(entity_id);
CREATE INDEX entity_log_inserted_at_idx ON entity_log(inserted_at);
```

**Why a join table for tags instead of JSON array?** SQLite's `json_each()` does a full table scan on every tag query. A join table with proper indexes makes tag lookups O(log n) instead of O(n). The `Entities` API abstracts this — callers never see the join table directly. This avoids a known performance cliff as entity count grows.

**Tag mutations are written to the DB immediately** (not deferred to the 60s dirty-check). Tag-based queries (`find(tags: [...])`) hit the `entity_tags` table directly, so stale tags would cause incorrect query results. Since tag mutations are small writes to an indexed join table, the overhead is negligible. The entity's in-memory `tags` list is updated simultaneously.

**Tag sync rules (critical for implementers):**
1. `add_tag/remove_tag` immediately writes to `entity_tags` join table AND updates the in-memory `entity.tags` list
2. The 60s dirty-check entity save MUST NOT also write tags — tags live in `entity_tags`, not the `entities` row
3. `EntitySchema.from_entity/1` excludes `tags` from the entity row (tags are a separate table)
4. On EntityServer init, tags are loaded from the join table into the struct: `entity.tags = Entities.get_tags(entity.id)`
5. The in-memory `entity.tags` list is the authoritative runtime copy; the `entity_tags` table is authoritative at rest

**`parent_key` moved to metadata:** The `parent_key` field (inheritance parent, resolved at seed time) is stored in `metadata["parent_key"]`, not as a top-level column. It's never consulted at runtime — the DB stores fully-merged entities after inheritance resolution. Storing it in metadata keeps it available for provenance/debugging without adding a column that game code, scripts, and builders never need.

### Optimistic Locking

The `version` field prevents lost updates. Every save increments the version and checks the expected value:
```sql
UPDATE entities SET ..., version = version + 1 WHERE id = ? AND version = ?
```
If the version doesn't match (another process saved in between), the save fails and the caller reloads from DB. This costs nothing and prevents an entire class of silent data loss bugs.

**Critical rule: ALL writes to live entities go through the EntityServer.** Admin tools, builder commands, and scripts send messages to the EntityServer — they never write to the DB directly while a GenServer is running. This eliminates version conflicts entirely during normal operation. The EntityServer serializes all mutations, so its saves always succeed.

Version conflicts can only occur during:
- **Seeding** (EntitySeeder writes while no GenServer is running — no conflict possible)
- **Migrations** (one-time data transforms — run with server stopped or EntityServers paused)
- **Export tasks** (read-only — no conflict)

This is simpler and safer than the previous design where admin tools could write directly to DB and race with the EntityServer.

### Eliminated Tables

| Table | Replacement |
|-------|-------------|
| `entity_attributes` | Merged into `components` JSON |
| `player_game_states` | Player data lives in entity components |

### Kept Tables

| Table | Purpose |
|-------|---------|
| `players` | Authentication only (email, password, role) |
| `entities` | Everything else |
| `entity_tags` | Tag indexing (join table for fast tag queries) |
| `entity_log` | Audit log for debugging and script version history |

---

## 2. Entity Types and Their Components

An entity's **type** determines what it represents. Its **components** determine what it can do. The same component can appear on different types.

### Type Catalog

| Type | Located? | GenServer? | Description |
|------|----------|-----------|-------------|
| `room` | No (rooms ARE locations) | Yes (while occupied or recently visited) | Game world locations |
| `npc` | Yes | Yes (always) | Non-player characters |
| `item` | Yes | Sometimes | Items in the world or inventory |
| `exit` | Yes (source room) | Sometimes | Connections between rooms |
| `character` | Yes | Yes (when online) | Player characters |
| `quest` | No | Sometimes | Quest definitions (can be dynamic) |
| `dialogue` | No | Rarely | Dialogue trees |
| `zone` | No | Sometimes | Zone metadata + zone scripts |
| `storyline` | No | No | Storyline/campaign structure |
| `skill` | No | No | Skill definitions |
| `recipe` | No | No | Crafting recipes |
| `resource` | No | No | Resource type definitions |
| `status` | No | No | Status effect definitions |
| `system` | No | Yes (always, auto_start) | Running game systems (weather, economy, festivals) |
| `script` | No | No | Standalone script definitions (not running systems) |

**Naming distinction:** `type: :system` is for entities that run as always-on GenServers with behavior modules (weather system, economy system, event schedulers). `type: :script` is for script *definitions* stored as data that other entities reference. A system entity runs; a script entity is data.

### Component Catalog

Components are the building blocks of game mechanics. Any entity type can have any component — this enables novel combinations.

#### Core Components

| Component | Fields | Used By |
|-----------|--------|---------|
| `combatant` | health, max_health, attack, defense | NPCs, characters |
| `equipment` | slots: {weapon, armor, accessory, ...} | Characters |
| `coordinates` | x, y, z | Rooms |
| `exit` | direction, destination_id, destination_key | Exits |
| `room` | spawns (list of spawn configs) | Rooms |

#### Player-Specific Components

| Component | Fields | Used By |
|-----------|--------|---------|
| `player` | account_id, preferences, settings | Characters |
| `quest_progress` | active, completed, failed | Characters |
| `stats` | strength, intelligence, wisdom, ... | Characters, NPCs |
| `skills` | learned (list of skill keys) | Characters |
| `resources` | gold, mana, stamina, ... | Characters |

#### Content Components

| Component | Fields | Used By |
|-----------|--------|---------|
| `quest` | objectives, rewards, prerequisites | Quests |
| `dialogue_tree` | nodes, options, conditions | Dialogues, NPCs |
| `zone_config` | level_range, theme, weather_type | Zones |
| `skill_def` | cooldown, cost, effects, requirements | Skills |
| `recipe_def` | ingredients, output, station_type | Recipes |
| `emotes` | idle, combat, greeting (message lists) | NPCs |

#### System Components

| Component | Fields | Used By |
|-----------|--------|---------|
| `spawnable` | respawn_time, max_instances | NPCs, items |
| `container` | capacity, locked | Items, rooms |
| `readable` | text, pages | Items |
| `physical` | weight, stackable, quantity | Items |
| `weapon` | damage, damage_type, speed | Items |
| `armor` | defense, armor_type | Items |
| `suffix` | text (appended to room name) | Rooms |

#### The Power of Component Composition

Because any entity can have any component, novel combinations are natural:

```yaml
# A sentient sword that talks
key: sword_of_wisdom
type: item
components:
  weapon: {damage: 25, damage_type: slashing}
  physical: {weight: 3}
  dialogue_tree: {ref: sword_wisdom_dialogue}   # items can talk!
  combatant: {health: 500}                       # items can have HP!

# A quest that modifies the world
key: dragon_siege
type: quest
components:
  quest: {objectives: [...]}
scripts:
  on_complete: |
    # When quest completes, modify the world
    {:ok, room} = Entities.find(key: "castle_gate", type: :room)
    update_component(room, "room", %{description: "The gate lies in ruins."})
    spawn_entity("dragon_corpse", location: "castle_gate")

# A zone with weather behavior
key: meditation_gardens
type: zone
behaviors: [Loka.Framework.Behaviors.WeatherBehavior]
components:
  tick:
    interval: 60
scripts:
  on_tick: |
    if time_of_day() == :night do
      broadcast_to_zone(self(), "The garden lanterns flicker to life.")
    end
```

---

## 3. Data Flow

### Write Path

```
Mutation (game action, builder edit, script)
    │
    ▼
EntityServer GenServer (in-memory)
    │
    ├── Updates process state (instant)
    ├── Marks dirty flag
    │
    ├── [Normal] 60s dirty-check → Entities.save(entity) → DB
    └── [Critical] force_save: true → Entities.save(entity) → DB immediately
```

Critical operations that force-save:
- Player room changes
- Player item pickup/drop
- Player quest completion
- Player XP/level changes
- Player gold/resource gains
- Player skill learning
- Player equipment changes (equip/unequip)
- Player death penalties
- Builder create/edit/delete
- Any operation the developer marks as critical

**Rule of thumb:** Any mutation where a player would be upset to lose progress gets `force_save: true`.

### Read Path

```
Read request
    │
    ├── [Specific live entity] → EntityServer.get(id)
    │       → ETS live state table (bypasses GenServer mailbox)
    │       → Falls back to GenServer.call if not in ETS
    │
    ├── [Specific entity, maybe not live] → EntityRegistry.get_or_start(id)
    │       → starts GenServer if needed → loads from DB → returns state
    │
    ├── [Discovery query] → Entities.find(type: :room, tags: [...])
    │       → DB query → returns list
    │
    ├── [Batch read] → Entities.find_many(ids)
    │       → Single WHERE id IN (?) query
    │
    └── [Frequently-accessed content] → Entities.find(key: "sneak", type: :skill)
            → DB query (indexed on key+type, <100μs)
            → EntityCache added post-MVP if profiling shows hot paths
```

### Script Execution Model

Scripts run inside the EntityServer process during `dispatch_event`. This creates two categories of script actions:

**Same-entity mutations (synchronous):** When a script calls `heal(self(), 20)` or `set_component(self(), ...)`, the mutation is applied immediately to the entity in the EntityServer's state. Subsequent reads in the same script see the updated value. This is safe because the script is already running inside the entity's serialized GenServer context.

**Cross-entity mutations (queued):** When a script calls `heal(other_npc, 20)` or `move_entity(player, room_id)`, the action is queued and executed after the script completes. This is because cross-entity operations require sending messages to other EntityServers, which can't be done synchronously within a dispatch chain (deadlock risk).

```elixir
# Same-entity — synchronous, reads see the update:
heal(self(), 20)
current = get_component(self(), "combatant", "health")  # sees the healed value

# Cross-entity — queued, executed after script returns:
heal(other_npc, 20)
# other_npc's health is NOT yet updated here — the action is pending
```

This distinction is invisible to builders for most scripts (they rarely read back cross-entity state within the same script). But it's critical for implementers to get right.

**Cross-entity queue implementation (critical for implementers):**

The queue mechanism reuses V1's `ActionQueue` pattern. Actions are accumulated in a list during script execution, then drained by the EntityServer after the script returns:

```elixir
# 1. Script execution accumulates actions in sandbox context:
#    context.queued_actions = [{:heal, other_npc_id, 20}, {:move, player_id, room_id}, ...]
#
# 2. After script returns, EntityServer drains the queue:
defp drain_action_queue(state, queued_actions) do
  for action <- queued_actions do
    try do
      execute_cross_entity_action(action)
    catch
      kind, reason ->
        # Log and continue — one failed action doesn't abort the rest
        Logger.warning("[#{state.entity.key}] queued action #{inspect(action)} failed: #{inspect({kind, reason})}")
    end
  end
  state
end

# 3. Each action sends a message to the target EntityServer:
defp execute_cross_entity_action({:heal, target_id, amount}) do
  EntityServer.update(target_id, fn e -> Components.Combatant.heal(e, amount) end)
end
```

**Queue error handling rules:**
- Failed queued actions are logged and skipped (fire-and-forget) — one dead NPC shouldn't abort a multi-target heal
- If the target EntityServer is not running, `EntityRegistry.get_or_start/1` starts it first
- If the target entity no longer exists (deleted between queue and drain), the action is silently dropped
- Rate limits (Section 18) are enforced at queue-add time, not drain time — a script can't queue 1000 heals

### ETS Live State Table (Recommended Optimization — Defer If Needed)

Active EntityServers publish a snapshot of their Entity struct to a public ETS table on every mutation. External code reads from ETS instead of sending `GenServer.call`, eliminating mailbox serialization.

```elixir
# Supervision tree creates the table:
:ets.new(:entity_live_state, [:set, :public, :named_table, read_concurrency: true])

# EntityServer writes on every mutation:
defp publish_state(entity) do
  :ets.insert(:entity_live_state, {entity.id, entity, System.monotonic_time()})
end

# Public read (concurrent, ~µs, no mailbox):
def get_live(id) do
  case :ets.lookup(:entity_live_state, id) do
    [{^id, entity, _ts}] -> {:ok, entity}
    [] -> {:error, :not_started}
  end
end
```

**Why this matters:**
- Room display reads 10+ entities — ETS turns 10 sequential GenServer calls into 10 concurrent ETS lookups
- **Deadlock prevention:** If EntityServer A's event handler reads EntityServer B via GenServer.call, and B simultaneously reads A, deadlock. ETS reads can't deadlock.
- Scripts reading `entities_in_room()` don't block any EntityServer

**Why it's deferrable:** For a single-server MUD with <100 concurrent players, a GenServer handles ~100K msg/sec. The mailbox bottleneck is theoretical at this scale. Start with `GenServer.call` reads in Phase 3; add ETS if profiling shows need. The `EntityServer.get/1` API abstracts the implementation — switching is invisible to callers.

**Rules:**
- Only the owning EntityServer writes to its ETS slot
- Readers get a snapshot (may be 1 mutation behind — acceptable for display)
- Entry deleted on EntityServer termination
- ETS table is NOT the EntityCache (which caches DB query results for content entities without active GenServers)

### Read-Through Cache (Deferred to Post-MVP)

Skills, recipes, statuses, and other read-mostly content are accessed frequently but rarely change. A transparent ETS read-through cache (`EntityCache`) can avoid repeated DB queries — but for MVP, direct DB queries are fast enough:

- SQLite with a `(key, type)` index serves `Entities.find` lookups in <100μs
- For <100 concurrent players and ~1400 entities, there's no measurable benefit
- Deferring the cache eliminates an entire class of invalidation bugs
- The `Entities.find/1` API is identical with or without the cache — adding it later is invisible to callers

```elixir
# MVP: direct DB query (simple, correct, fast enough)
def find(key: key, type: type) do
  case Repo.get_by(EntitySchema, key: key, type: type) do
    nil -> {:error, :not_found}
    schema -> {:ok, to_entity(schema)}
  end
end

# Post-MVP (if profiling shows hot paths): add EntityCache transparently
# Cache keys would be {key, type} tuples (keys are unique per type, not globally)
# Cache invalidated on any write; TTL-based eviction as fallback
```

This replaces the old TypedObject Registry's role for content lookups without reintroducing dual-store sync problems. The "no cache" MVP has the simplest possible mental model: **all data lives in the DB, EntityServer is the live cache for active entities.**

**Tag query caching:** Tag-based queries (`find(tags: [...])`) are NOT cached — they hit the DB every time via the indexed `entity_tags` join table. This is acceptable for MVP because the index makes tag lookups O(log n). If profiling shows hot tag queries (e.g., combat checking `hostile` tags), add a separate `tag → [entity_id]` ETS cache with invalidation on tag mutations. Don't pre-build this.

**Combat hot-path note:** Scripts calling `entities_in_room()` during combat tick hit the DB each time. With 3+ NPCs in combat, that's 3+ DB queries per combat round just for room contents. The SQLite index scan is <1ms per query, which is acceptable for MVP. However, if profiling shows >5ms per combat tick in Phase 3, prioritize the ETS live state table (above) — it lets `entities_in_room()` check ETS first for entities with active GenServers, falling back to DB only for idle entities.

---

## 4. The Entity Lifecycle

### Seeding (Boot)

```
Application.start/2
    │
    ▼
EntitySeeder.seed()
    │
    ├── Phase 1: Parse all YAML files
    │   └── Read all YAML files (each self-contained, no inheritance)
    │
    ├── Phase 2: Seed non-located entities (skills, quests, zones, etc.)
    │   └── For each: INSERT IF NOT EXISTS by key+type
    │
    ├── Phase 3: Seed rooms
    │   └── Rooms get UUIDs assigned, stored in DB
    │
    ├── Phase 4: Seed exits (need room UUIDs for destination_id)
    │   └── Create exit entities linking rooms
    │
    └── Phase 5: Seed NPCs and items (need room UUIDs for location_id)
        └── Spawn instances from prototypes into rooms

    (System entities tagged "auto_start" are started AFTER EntityServer
     evolution is complete — see Phase 3, Step 9 in Section 11)
```

**Seeding is idempotent and synchronous.** Running it twice doesn't duplicate data. Existing entities (matched by key+type for prototypes, or by id for instances) are skipped or updated per the conflict resolution rules (see Section 8). The seeder blocks in `init/1` — the Endpoint starts only after seeding completes (see Decision 9).

**Batch inserts:** The seeder uses `Repo.insert_all` in chunks of 100 for initial seeding (~286 YAML files → ~1400 entities). At ~0.1ms per batch insert, first boot takes ~0.2 seconds instead of ~1.4 seconds with individual inserts.

**Flat prototypes:** All YAML prototypes are self-contained — no inheritance, no `parent:` field. Each file includes all fields it needs. The `_base/` directory and inheritance resolution (topological sort + deep merge) were removed in the Feb 2026 flattening refactor. The DB stores entities exactly as defined in YAML.

**Validation:** Each entity is validated against its component schemas before insertion. Invalid YAML content (wrong types, missing required fields) is skipped with loud warnings. The `--strict` flag makes validation errors fatal. This integrates the ContentValidator functionality into the seeding pipeline.

### Spawning (Creating Instances)

```elixir
# Spawn a goblin from its prototype
{:ok, goblin} = Spawner.spawn("goblin", location_id: room_id)

# What happens:
# 1. Load prototype: Entities.find(key: "goblin", type: :npc, is_prototype: true) → DB query
# 2. Deep-copy: new UUID, is_prototype: false, prototype_key: "goblin"
# 3. Apply overrides: location_id, any custom fields
# 4. Save to DB: Entities.save(new_entity)
# 5. Optionally start GenServer: EntityRegistry.get_or_start(new_id)
```

### Runtime (Active Entities)

```
EntityServer GenServer (one per active entity)
    │
    ├── Holds Entity struct in process state
    ├── Processes messages sequentially (no race conditions)
    ├── Runs behavior modules (on_tick, on_event, etc.)
    ├── Executes sandboxed scripts (on_enter, on_attack, etc.)
    ├── Subscribes to PubSub topics
    ├── 60s dirty-check → save to DB
    ├── Responds to :reload message (re-reads from DB)
    └── Saves on termination
```

### Re-applying Prototypes

When a builder changes a prototype and wants to update existing instances:

```
> edit goblin health 50           # changes the prototype in DB
> apply-prototype goblin          # pushes changes to instances

System:
1. Load prototype from DB
2. Query: SELECT * FROM entities WHERE prototype_key = 'goblin' AND NOT is_prototype
3. For each instance:
   a. Fields in metadata["overrides"] → keep instance value
   b. All other fields → update from prototype
   c. Save to DB
   d. If EntityServer running → send :reload
```

`metadata["overrides"]` tracks which fields were explicitly set on this instance (not inherited). When a builder edits a specific goblin's health, that field is added to overrides. When the prototype is re-applied, overridden fields are preserved.

**For pre-production development:** `respawn-all goblin` is simpler — despawn all instances, spawn fresh from updated prototype. No override tracking needed.

---

## 5. Players as Entities

The `players` table handles authentication only. All game state moves to the entities table.

### Player Entity Structure

```yaml
# Player character entity
id: "uuid-..."
type: character
key: "player_42"            # or character name
short_desc: "Kai"           # character name
location_id: "room-uuid"    # current room (same field as NPCs)
account_id: "players-table-uuid"  # indexed column for fast login lookup
# Inventory: items with location_id = this character's id (no explicit list)
# Query: Entities.find(location_id: character_id, type: :item)
components:
  player:
    # account_id is now a top-level indexed column, not in components
    settings:
      font_size: 14
      color_theme: dark
      auto_loot: true
  combatant:                 # SAME component as NPCs
    health: 100
    max_health: 100
    attack: 15
    defense: 10
  stats:
    strength: 12
    intelligence: 8
    wisdom: 10
    constitution: 14
  equipment:                 # which slot has what (items still located at this character)
    weapon: "sword-uuid"
    armor: "leather-uuid"
  quest_progress:
    active:
      - key: intro_welcome
        objectives: [{type: talk_to, target: village_elder, complete: true}]
    completed: [tutorial_basics, first_combat]
  skills:
    learned: [sneak, bash, meditate]
  resources:
    gold: 150
    experience: 2400
tags: [player, online]
metadata:
  created_at: "2026-02-10T..."
  last_login: "2026-02-10T..."
```

### Player Login Flow

```
1. Auth: verify email/password → get player record from `players` table
2. Find character: Entities.find(account_id: player.id)
       → SELECT * FROM entities WHERE account_id = ? AND type = 'character'
       → Uses indexed `account_id` column (NOT json_extract — avoids full table scan)
3. Start EntityServer: EntityRegistry.get_or_start(character.id)
4. Register session: Session.Registry.register(player.id, session_pid)
5. Join PubSub: subscribe to location:{location_id}, entity:{character_id}
```

**Why `account_id` is an indexed column:** The previous design stored `account_id` inside `components["player"]["account_id"]` and used a `json_extract` query for login. That's a full table scan on every login — O(n) over all entities. With the `account_id` column and index, login is O(log n). This is the single hottest auth query in the system.

### Character Creation Flow (New Player)

```
1. Player registers via auth (creates `players` table row)
2. Character creation UI collects name, background choices
3. Create character entity:
   Entities.create(%{
     type: :character,
     account_id: player.id,
     key: sanitized_character_name,
     short_desc: character_name,
     location_id: starting_room_id,
     components: default_character_components(background_choice)
   })
4. Redirect to game (normal login flow picks up the new character)
```

`default_character_components/1` provides baseline combatant stats, empty quest_progress, starting resources, etc. Background choices can modify starting stats/equipment.

### Player Logout Flow

```
1. EntityServer.force_save(character_id)  # persist immediately
2. Remove "online" tag: Entities.remove_tag(character_id, "online")
3. Session.Registry.deregister(player.id)
4. Unsubscribe PubSub topics
5. EntityServer terminates (saves on terminate/1)
```

### Stale `online` Tag Cleanup (Boot)

After a crash or restart, character entities may still have stale `online` tags in the DB (no active sessions exist). The EntitySeeder clears these during boot:

```elixir
# In EntitySeeder.seed/0, after seeding completes:
Repo.query!("DELETE FROM entity_tags WHERE tag = 'online'")
Logger.info("[EntitySeeder] Cleared stale 'online' tags")
```

This runs before the Endpoint starts, so no player sessions exist yet. Any `has_tag?(entity, "online")` checks after boot are guaranteed accurate.

### What This Unifies

```elixir
# Before: two different systems
GameState.get_players_in_room(room_id)  # players
Entities.find(location_id: room_id)          # NPCs/items

# After: one query
Entities.find(location_id: room_id)     # returns EVERYTHING in the room
```

Combat, movement, room display, targeting — all use one entity system. No "is this a player or NPC?" branching.

---

## 6. Unified System Entities

Developer-written game systems and builder-created global behaviors use the same mechanism: **entities with behaviors and/or scripts.**

### How It Works

A "system entity" is an entity with `type: :system` that has behavior modules and/or inline scripts. Its EntityServer runs the behavior. System entities are always-on (started automatically at boot via `auto_start` tag).

```yaml
# Developer-written system (behavior module)
key: weather_system
type: system
tags: [auto_start]
behaviors: [Loka.Behaviors.Weather]
components:
  system:
    priority: 10
  tick:
    interval: 60

# Builder-created system (inline script)
key: winter_festival
type: system
tags: [auto_start]
components:
  system:
    priority: 50
  tick:
    interval: 300
scripts:
  on_tick: |
    for room <- Entities.find(type: :room, tags: ["zone:village"]) do
      broadcast(room, "Snowflakes drift down from the grey sky.")
    end
  on_activate: |
    broadcast_global("The Winter Festival has begun!")
```

### Behavior Module Interface

Developer-written behavior modules implement callbacks that the EntityServer invokes:

```elixir
defmodule Loka.Behaviors.Weather do
  @behaviour Loka.Engine.EntityBehavior

  @impl true
  def on_tick(entity, _state) do
    # Full Elixir power — no sandbox restrictions
    zones = Entities.find(type: :zone)
    for zone <- zones do
      weather = calculate_weather(zone)
      broadcast_to_zone(zone, weather)
    end
    {:ok, entity}
  end

  @impl true
  def on_event(entity, {:season_change, season}, _state) do
    # React to game events
    {:ok, update_component(entity, "service", %{"current_season" => season})}
  end
end
```

### What This Replaces

| Before | After |
|--------|-------|
| `{Loka.Framework.Weather, []}` in Application supervision tree | Entity `type: :system` with `behaviors: [Weather]`, tagged `auto_start` |
| Custom GenServer with `use GenServer` boilerplate | EntityServer runs the behavior module |
| Hardcoded in application.ex (developer-only) | Data-driven: builder can create/modify system entities |
| ~50 supervised children | ~22 infrastructure + system entities started dynamically by tag |
| Plugin system (`use Loka.Engine.Plugin`) | **Deleted.** System entities replace all plugin functionality |

### Power Levels

| Level | Who | How | Capabilities |
|-------|-----|-----|-------------|
| **Native behavior** | Developer | Elixir module in `behaviors` | Full language, DB access, GenServer calls, external APIs |
| **Sandboxed script** | Builder | Inline code in `scripts` | Safe subset, game API bindings, no system access |
| **Hybrid** | Both | Behavior module + script hooks | Module provides framework, scripts customize |

A developer writes the Weather behavior module (complex meteorology simulation). A builder attaches a script that customizes weather messages for their zone. Both run in the same EntityServer.

---

## 7. Querying Entities

### The Entities API — Unified `find`

Two entry points for reads, split by return type for Dialyzer friendliness and call-site clarity:

```elixir
defmodule Loka.Engine.Entities do
  # ── Single-Result Reads ──
  #
  # find_one/1 — returns {:ok, entity} | {:error, :not_found}
  # Use when you expect exactly one result.
  #
  #   find_one(uuid)                     → {:ok, entity} | {:error, :not_found}
  #   find_one(key: k, type: t)         → {:ok, entity} | {:error, :not_found}
  #   find_one(account_id: id)          → {:ok, entity} | {:error, :not_found}
  #
  def find_one(id) when is_binary(id) do
    # UUID guard: reject non-UUID strings with a clear error
    if Ecto.UUID.cast(id) == :error do
      raise ArgumentError,
        "find_one/1 single-arg expects UUID, got #{inspect(id)}. " <>
        "Use find_one(key: ..., type: ...) for key lookups."
    end
    # ... PK lookup
  end
  def find_one(opts) when is_list(opts) # key+type or account_id lookup

  # ── Multi-Result Reads ──
  #
  # find_all/1 — returns [entity] (list, may be empty)
  # Use when you expect zero or more results.
  #
  #   find_all(type: :npc, ...)          → [entity]
  #   find_all(location_id: id)          → [entity]
  #   find_all(tags: ["hostile"])        → [entity]
  #
  def find_all(opts) when is_list(opts)  # by opts (see below)

  # ── Convenience Sugar ──
  #
  # find/1 dispatches to find_one or find_all based on query shape.
  # Prefer the explicit variants in framework code for clarity.
  #
  def find(id) when is_binary(id), do: find_one(id)
  def find(opts) when is_list(opts) do
    if Keyword.has_key?(opts, :key) or Keyword.has_key?(opts, :account_id) do
      find_one(opts)
    else
      find_all(opts)
    end
  end

  # opts:
  #   key: "sneak", type: :skill       — key+type lookup (indexed, <100μs). TYPE ALWAYS REQUIRED for keys.
  #   type: :npc                        — filter by entity type (indexed)
  #   location_id: room_uuid           — filter by location (indexed)
  #   tags: ["hostile", "boss"]        — uses entity_tags join table (indexed, fast)
  #   is_prototype: true               — prototype lookup (indexed)
  #   prototype_key: "goblin"          — instances of prototype (indexed)
  #   account_id: account_uuid         — player login lookup (indexed)
  #   component: {"combatant.health", {:lt, 10}} — json_extract (FULL SCAN — use with indexed filters)
  #   limit: 50                        — cap results
  #
  # Performance note:
  #   Indexed (fast): type, key, location_id, prototype_key, is_prototype, tags, account_id
  #   Full scan (slow at scale): component (json_extract)
  #   Always filter by indexed columns first, then narrow with JSON queries.
  #
  # Convenience: find detects single-result queries by presence of:
  #   - UUID string argument
  #   - key: + type: (unique per type)
  #   - account_id: (one character per account)

  # ── Batch Reads ──
  def find_many(ids)                    # single WHERE id IN (?) query
  def find_many(keys, type)             # single WHERE key IN (?) AND type = ? query

  # ── Write Operations ──
  def save(entity)                      # insert or update (checks version for optimistic lock)
  def save_batch(entities)              # Repo.insert_all in chunks (seeding, shutdown)
                                        # NOTE: skips optimistic lock check — only safe when
                                        # EntityServers are frozen (shutdown) or not running (seeding)
                                        # RAISES if any entity ID has a running GenServer (safety check)
  def delete(id)                        # remove from DB
  def update(id, changes)               # partial update

  # NOTE: No `transaction(entity_ids, fun)` for MVP.
  # Cross-entity atomicity uses the validate-then-apply pattern (see Decision 4).
  # If true atomic transactions are needed later (PvP trading), build on top of that pattern.
end
```

### Query Examples

```elixir
# What's in this room?
Entities.find(location_id: room_id)

# All hostile NPCs in this room
Entities.find(location_id: room_id, type: :npc, tags: ["hostile"])

# All weapon prototypes
Entities.find(type: :item, is_prototype: true, tags: ["weapon"])

# All legendary items in the game
Entities.find(type: :item, component: {"item.rarity", "legendary"})

# All quests in a storyline
Entities.find(type: :quest, tags: ["storyline:main"])

# All exits from a room
Entities.find(location_id: room_id, type: :exit)

# A specific skill definition (type-scoped)
Entities.find(key: "sneak", type: :skill)

# All system entities that auto-start
Entities.find(tags: ["auto_start"])
```

### Live State vs DB State

```elixir
# DB state (may be up to 60s stale for active entities)
{:ok, npc} = Entities.find(npc_id)

# Live state (real-time, from GenServer)
{:ok, npc} = EntityServer.get(npc_id)

# Combined pattern: find then access
npc_ids = Entities.find(location_id: room_id, type: :npc) |> Enum.map(& &1.id)
live_npcs = Enum.map(npc_ids, &EntityServer.get_or_load/1)
```

For most game operations, the distinction doesn't matter:
- Display (room contents, NPC descriptions): fresh enough from EntityServer
- Discovery (find all rooms in zone, list quests): DB query is fine
- Combat (current HP): always use EntityServer for real-time state

---

## 8. YAML Authoring and Content Seeding

### YAML as Seed Data

YAML files are the authoring format for game content. They are human-readable, git-trackable, and PR-reviewable. At boot, EntitySeeder reads them and populates the DB.

```yaml
# priv/world/prototypes/npcs/village_elder.yml
key: village_elder
type: npc
parent_key: base_friendly_npc
short_desc: "Village Elder"
long_desc: "An elderly woman with kind eyes sits on a worn wooden bench."
extra_desc: |
  Deep wrinkles map decades of wisdom across her face. Her hands,
  though aged, move with quiet purpose.
keywords: [elder, woman, village]
components:
  combatant:
    health: 80
    max_health: 80
  dialogue_tree:
    ref: village_elder_dialogue
  emotes:
    idle:
      - "The Village Elder gazes thoughtfully at the sky."
      - "The Village Elder adjusts her shawl."
tags: [npc, friendly, quest_giver, zone:village]
```

### EntitySeeder

```elixir
defmodule Loka.Engine.EntitySeeder do
  @moduledoc """
  Seeds the entities DB from YAML files on boot. Idempotent.
  All YAML prototypes are self-contained (no inheritance).
  """

  def seed do
    resolved = load_all_yaml_files()

    # Phase 1: Non-located entities (skills, quests, zones, recipes, etc.)
    seed_by_types(resolved, [:skill, :quest, :dialogue, :zone, :storyline,
                              :recipe, :resource, :status, :script, :system])

    # Phase 2: Rooms (need to exist before exits reference them)
    seed_by_types(resolved, [:room])

    # Phase 3: Exits (need room UUIDs for destination_id)
    seed_exits(resolved)

    # Phase 4: NPCs and items (need room UUIDs for location_id)
    seed_by_types(resolved, [:npc, :item])

    # NOTE: System entities are SEEDED here but STARTED later by EntityRegistry
    # after EntityServer behavior dispatch is available (see Section 11, Phase 3, Step 9)
  end

  def reload_file(path) do
    # Re-parse single YAML file
    # Update DB entry
    # Notify running EntityServer if any
  end

  defp seed_entity(data) do
    case Entities.find(key: data.key, type: data.type) do
      nil -> Entities.create(data)           # new: insert
      existing -> maybe_update(existing, data)
    end
  end

  # Exit entities are extracted from V1 room YAML and created as standalone entities
  defp seed_exits(resolved_rooms) do
    for {room_key, room_data} <- resolved_rooms,
        exit_def <- room_data["exits"] || [] do
      # 1. Look up source room UUID (already seeded in Phase 2)
      {:ok, source_room} = Entities.find(key: room_key, type: :room)
      # 2. Look up destination room UUID
      {:ok, dest_room} = Entities.find(key: exit_def["destination_key"], type: :room)
      # 3. Create exit entity (location_id = source room)
      Entities.create(%{
        type: :exit, key: "#{room_key}_#{exit_def["direction"]}",
        location_id: source_room.id,
        components: %{"exit" => %{
          "direction" => exit_def["direction"],
          "destination_id" => dest_room.id,
          "destination_key" => exit_def["destination_key"]
        }}
      })
      # 4. Create reciprocal exit in destination room (bidirectional)
      #    Reverse direction: north↔south, east↔west, up↔down
      reverse_dir = reverse_direction(exit_def["direction"])
      Entities.create(%{
        type: :exit, key: "#{exit_def["destination_key"]}_#{reverse_dir}",
        location_id: dest_room.id,
        components: %{"exit" => %{
          "direction" => reverse_dir,
          "destination_id" => source_room.id,
          "destination_key" => room_key
        }}
      })
    end
  end
end
```

**Exit entity seeding detail:** V1 rooms define exits inline (in YAML `exits:` or `data["exits"]`). The seeder extracts these and creates standalone exit entities. Each exit has `location_id` = source room UUID and `components["exit"]` with direction + destination. **Bidirectional exits are critical** — the seeder creates reciprocal exits automatically. Missing reciprocal exits create orphan rooms (rooms with no way to reach them), which was a documented V1 pitfall.

### Seeder Conflict Resolution (Simplified for MVP)

When the seeder encounters an entity that already exists in the DB, these rules determine who wins:

| Scenario | Rule | Rationale |
|----------|------|-----------|
| New entity (key not in DB) | **Insert from YAML** | First seed |
| Prototype exists in DB | **Update from YAML** | YAML is authoritative for pre-production |
| Instance (non-prototype) | **Always skip** | DB is authoritative for live instances |
| `--force` flag passed | **Overwrite all** | Developer escape hatch (e.g., `mix loka.seed --force`) |

**MVP simplification:** No `edited_by`/`edited_at` tracking. YAML always wins for prototypes. Builders who make prototype changes via terminal should run `mix loka.export` to persist their changes to YAML before committing. This keeps the seeder simple and predictable — one source of truth (YAML files in git).

**Post-MVP:** When multiple builders are editing simultaneously, add `metadata["edited_by"]` and `metadata["edited_at"]` tracking to detect YAML-vs-builder conflicts. The `--force` flag remains the escape hatch.

### Export (DB to YAML)

```bash
# Export all prototypes to YAML for version control
mix loka.export

# Export specific types
mix loka.export --type quest,dialogue

# Export only entities modified since last export
mix loka.export --modified-since 2026-02-10
```

The export task reads entities from DB and writes YAML files in the standard `priv/world/` directory structure. This closes the loop: author in YAML, seed to DB, modify via builder, export back to YAML, commit to git.

---

## 9. Builder Workflow

### Creating Content

```
> create room dark_cave
Created room prototype 'dark_cave' [DRAFT]

> edit dark_cave short_desc "A Dark Cave"
> edit dark_cave long_desc "Moisture drips from jagged stalactites."
> edit dark_cave tags +zone:caverns

> create exit --from village_path --to dark_cave --direction north
Created exit (north) from village_path to dark_cave

> create npc cave_bat --from base_hostile_npc
Created NPC prototype 'cave_bat' based on 'base_hostile_npc'

> edit cave_bat short_desc "A screeching cave bat"
> edit cave_bat health 15 attack 5

> spawn cave_bat --in dark_cave --count 3
Spawned 3 instances of 'cave_bat' in dark_cave

> look
A Dark Cave [DRAFT]
Moisture drips from jagged stalactites.

Three screeching cave bats circle overhead.
Exits: [south] to Village Path

> publish dark_cave
Published room 'dark_cave' (removed DRAFT flag)
```

### Modifying Prototypes

```
> edit cave_bat health 25           # buff all future cave bats
> apply-prototype cave_bat          # update existing instances too
Applied to 3 instances (0 had overrides)

> edit cave_bat --instance abc-123 health 50  # buff just this one
Updated instance abc-123 (health added to overrides)
```

### Creating Game Systems

```
> create script torch_flicker
> edit torch_flicker components.tick.interval 30
> edit torch_flicker scripts.on_tick "
    for room <- Entities.find(type: :room, tags: ["has_torches"]) do
      broadcast(room, pick_random([
        'A torch sputters and crackles.',
        'Shadows dance along the walls.',
        'The torchlight wavers briefly.'
      ]))
    end
  "
> edit torch_flicker tags +system,+auto_start
> activate torch_flicker
Torch flicker system is now running.
```

**AI-assisted script creation:** For complex scripts, the AI builder (`/ai` commands) can generate script code using V2 bindings. Example: `/ai write an on_talk script for the village elder that grants the intro quest if the player hasn't started it`. The AI generates the script, which the builder can review and edit in-terminal.

---

## 10. Testing Strategy

### Before vs After

| Before | After |
|--------|-------|
| TypedObjectSandbox (saves/restores 3 ETS tables) | Ecto Sandbox only (transaction isolation) |
| Tests that create YAML files must clean up | No YAML files in tests |
| Draft cleanup sweeps in test_helper.exs | Standard Ecto rollback |
| Complex setup with multiple stores | Simple: create entities via API |

### Test Patterns

```elixir
defmodule MyTest do
  use Loka.DataCase  # Ecto Sandbox — auto-rollback

  test "NPC takes damage" do
    # Create test entities directly — no YAML, no seeding
    {:ok, room} = Entities.create(%{type: :room, key: "test_room"})
    {:ok, npc} = Entities.create(%{
      type: :npc,
      key: "test_goblin",
      location_id: room.id,
      components: %{"combatant" => %{"health" => 30, "max_health" => 30}}
    })

    # Test game logic
    {:ok, updated} = Combat.apply_damage(npc, 10)
    assert updated.components["combatant"]["health"] == 20
  end
  # Transaction automatically rolled back — no cleanup needed
end
```

---

## 11. Migration Plan

> **Phase order rationale:** Seeder (Phase 2) comes before EntityServer (Phase 3) because you need data in the DB to test the EntityServer loading from it. Foundation builds the schema, Seeder populates it, EntityServer reads from it.

### Phase 1: Foundation (DB schema + Entity evolution)

1. Drop old `entities` + `entity_attributes` tables, create new `entities` + `entity_tags` + `entity_log` tables via Ecto migration (pre-production: no data to preserve)
2. Evolve `Entity` struct (add version, remove data/attributes/contents/locks, add `Entity.new/1` constructor + `Entity.snapshot/1`)
3. Evolve `EntitySchema` (include all fields in from_entity/to_entity, exclude tags from entity row)
4. Evolve `Entities` API module (unified `find/1`, tag operations, write operations)
5. Write tests for Entities API

**Note:** EntityCache is deferred to post-MVP. Direct DB queries with indexes are fast enough for <100 concurrent players. The `Entities.find/1` API is identical with or without the cache — adding it later is invisible to callers.

### Phase 2: EntitySeeder (YAML → DB)

1. Extract inheritance resolution from TypedObject.Loader (topological sort + deep merge)
2. Build EntitySeeder with phased seeding (non-located → rooms → exits → NPCs/items)
3. Add V1→V2 YAML field mapping (quest fields → components, etc.)
4. Add conflict resolution with `edited_at` timestamp detection
5. Write tests for seeding (idempotent, inheritance resolution, conflict rules)

**Note:** System entity startup (tagged `auto_start`) is deferred to the end of Phase 3. Seeding only populates the DB — system entities need behavior dispatch (built in Phase 3) before they can run.

### Phase 3: EntityServer (GenServer evolution)

1. Evolve EntityServer to work with new schema (remove `data` refs, add `version` handling)
2. Add dispatch_event with snapshot rollback pattern
3. Evolve EntityRegistry to load from `entities` table
4. Add force_save option to EntityServer.update/2
5. Add :reload message handler (re-reads entity from DB)
6. Add behavior dispatch chain (reduce_while pattern)
6b. **Rename PubSub topics:** `room:{id}` → `location:{id}`, `player:{id}` → `entity:{id}` across all subscribe/broadcast call sites (EntityServer, game_channel, session, room_helpers, builder commands)
7. Add tick timer setup (Process.send_after based on component interval)
8. Add entity load failure handling (corrupt data → `{:error, :invalid_entity}`, no crash loop)
9. Start system entities tagged `auto_start` under SystemSupervisor (now that behavior dispatch exists)
10. Write tests (can now test against seeded data from Phase 2)

### Phase 4: Player Migration

1. Migrate GameState fields to character entity components
2. Update login/logout flow
3. Update all GameState consumers to use Entities API
4. Data migration: player_game_states → entities rows
5. Remove GameState module and player_game_states table
6. Write tests

### Phase 5: Content + Actions Migration

1. Migrate quest, dialogue, zone, etc. to entities table
2. Update Content.Quest, Content.Dialogue to query entities table
3. Update all content consumers
4. Update Actions modules (~25 PlayerGameState.update_state calls → entity component updates)
5. Update game_channel.ex (~50 GameState refs → Entities API)
6. Write tests

### Phase 6: Cleanup

1. Delete TypedObject struct, Loader, Registry
2. Delete TypedObjectSandbox, TestCleanup
3. Delete Plugin system (plugin.ex, plugin_loader.ex, plugin_supervisor.ex, plugins/ dir)
4. Delete ~25 deferred framework modules (see Section 24)
5. Delete all framework registries (14 modules)
6. Delete RegistryBase macro
7. Simplify RoomManager (remove all dual-store sync)
8. Simplify builder commands (single write path)
9. Update all docs
10. Create `mix loka.export` task

---

## 12. Resolved Design Decisions

### Decision 1: Naming — Keep "Entity"

**Decision: Keep "Entity" throughout the codebase.** Don't rename to "Object."

Rationale:
- "Entity" is standard ECS (Entity-Component-System) terminology — familiar to game devs
- `%Entity{}` reads better in Elixir than `%Object{}` (Elixir is not an OOP language)
- Less renaming = faster migration = fewer bugs

This means: `Entity` struct, `Entities` API module, `EntityServer`, `EntityRegistry`, `EntitySchema`, `EntitySeeder`, `EntityCache`, `EntityBehavior`. Table is `entities`. All evolved from current code.

### Decision 2: Component Access — Typed Accessor Modules

**Decision: Every component gets an accessor module. Game code NEVER accesses the `components` map directly.**

```elixir
defmodule Loka.Components.Combatant do
  @component_key "combatant"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def health(entity), do: get_in(entity.components, [@component_key, "health"])
  def max_health(entity), do: get_in(entity.components, [@component_key, "max_health"])

  def set_health(entity, val) when is_integer(val) and val >= 0 do
    capped = min(val, max_health(entity) || val)
    put_in(entity.components, [@component_key, "health"], capped)
  end

  def alive?(entity), do: health(entity) > 0

  def apply_damage(entity, amount) when is_integer(amount) and amount >= 0 do
    set_health(entity, max(0, health(entity) - amount))
  end
end
```

Rules:
- Game code calls `Combatant.health(npc)`, never `npc.components["combatant"]["health"]`
- Accessor modules validate on write (type checks, range checks, business rules)
- Each module is the single authority on its component's shape
- A `use Loka.Component, key: "combatant"` macro can generate the boilerplate (`get/1`, `has?/1`, `put/2`)
- Builder/admin tools MAY access `components` directly for generic editing (they operate on raw data)

### Decision 3: Eliminate `data` Field — All Game Data in `components`

**Decision: Remove the `data` field from the schema. ALL game-mechanic data lives in `components`.**

The `data` field was a YAML overflow catch-all that created confusion about what goes where. With the unified model:

| Before (`data` field) | After (in `components`) |
|----------------------|------------------------|
| `data["exits"]` | `components["room"]["exits"]` or exit entities (preferred) |
| `data["spawns"]` | `components["room"]["spawns"]` |
| `data["objectives"]` | `components["quest"]["objectives"]` |
| `data["rewards"]` | `components["quest"]["rewards"]` |
| `data["primary_keyword"]` | Stays as top-level field `primary_keyword` |
| Custom builder fields | `components["custom"]["my_field"]` |

The EntitySeeder maps YAML fields to specific components based on the entity's type. Unknown/freeform fields go in `components["custom"]`.

The full schema is defined in **Section 1**. Four JSON fields with clear boundaries:
- **`components`** — game mechanics (the ONLY place for game data, including locks/access control)
- **`behaviors`** — which Elixir modules drive this entity
- **`scripts`** — sandboxed behavior code (builder-written, flat map of event_name → code string)
- **`metadata`** — system bookkeeping (timestamps, draft flag, overrides, parent_key provenance)

Plus **`tags`** stored in the `entity_tags` join table (not a JSON column) for indexed queries.

**Why `locks` merged into `components`:** Decision 3 states "ALL game-mechanic data lives in `components`." Access control rules are game-mechanic data — they determine who can use/enter/open an entity. Keeping them separate contradicted this principle and added a fifth JSON column for no indexing benefit (lock checks are always on already-loaded entities). Now: `components["locks"]["use"] = "key:cave_key"`.

### Decision 4: Cross-Entity Operations — Location-Based Containment

**Decision: Containment is modeled via `location_id`, not via inventory lists. Item transfer = update one field on one entity.**

Inspired by Evennia: an entity's `location_id` determines where it is. A player's inventory = all entities whose `location_id` is the player's ID.

```elixir
# Player A gives sword to Player B
# ONE mutation, ONE entity, no coordination needed:
EntityServer.update(sword_id, fn sword ->
  %{sword | location_id: player_b_id}
end, force_save: true)

# Broadcast so UIs update
PubSub.broadcast("entity:#{player_a_id}", {:item_removed, sword_id})
PubSub.broadcast("entity:#{player_b_id}", {:item_received, sword_id})
```

Listing inventory:
```elixir
# All items carried by this player
Entities.find(location_id: player_id, type: :item)
```

There is no `inventory` component. No list to keep in sync with actual item locations. `location_id` is the single source of truth for "where is this entity?" This eliminates an entire class of dual-store sync bugs.

**No derived contents cache.** The V1 codebase had dual-store sync bugs because caches drifted from DB truth. V2 eliminates this by NOT caching contents in EntityServer state. `find(location_id: entity_id)` always queries the DB (fast on the `location_id` index) or reads from the ETS live state table if available. The DB IS the single truth for "what's inside this entity." A missed PubSub message can't desynchronize what doesn't exist.

**Flat containment only (MVP).** Items can be in rooms or characters. No bags-within-bags, no nested containers. `find(location_id: player_id, type: :item)` returns all items directly contained. If nested containers are needed later, `find_recursive/1` can be added with a depth limit. Don't over-engineer this.

The `container` component still exists for container *rules* (capacity), not the item list. Access control uses the `locks` component:
```yaml
components:
  container: {capacity: 20}               # container rules
  locks: {open: "key:chest_key"}          # access control (merged into components, see Decision 52)
# Actual contents = entities whose location_id = this entity's id
```

**Multi-entity atomicity** (crafting: consume 3 ingredients, create 1 output):

Since ALL writes go through EntityServers, concurrent mutations to the same entity are serialized. But cross-entity operations (give item, craft, trade) need coordinated validation to prevent double-consume bugs.

**Pattern: Validate-then-apply.** Don't attempt true GenServer rollback (GenServer state changes aren't transactional). Instead, separate validation from mutation:

```elixir
def craft(player_id, recipe_key) do
  {:ok, recipe} = Entities.find(key: recipe_key, type: :recipe)
  ingredient_ids = find_ingredient_entity_ids(player_id, recipe)

  # Phase 1: VALIDATE — read-only checks, deterministic ID order (prevents deadlock)
  sorted_ids = Enum.sort([player_id | ingredient_ids])
  validations = for id <- sorted_ids do
    EntityServer.call(id, {:validate_craft, recipe})  # read-only check
  end

  if Enum.all?(validations, &match?({:ok, _}, &1)) do
    # Phase 2: APPLY — mutations are fast and extremely unlikely to fail
    for ingredient_id <- ingredient_ids do
      EntityServer.update(ingredient_id, fn e -> %{e | location_id: nil} end, force_save: true)
    end
    Spawner.spawn(recipe.output_key, location_id: player_id)
  else
    {:error, :craft_validation_failed}
  end
end
```

**Why not true transactions?** GenServer.call doesn't have rollback. If we mutate entity A then entity B fails, A's state is already changed in its process. The validate-then-apply pattern avoids this: validation is read-only (no state to roll back), and the apply phase is a sequence of simple mutations that individually can't fail (unless the process is dead, which is a crash, not a logic error).

**For MVP:** Sequential GenServer.calls in sorted ID order for deadlock prevention. The validate-then-apply split ensures correctness. If a true atomic transaction abstraction is needed later (e.g., PvP trading), build it on top of this pattern with a coordination GenServer.

### Decision 5: Entity References — Keys for Humans, UUIDs for Machines

**Decision: YAML uses keys. Runtime uses UUIDs. The seeder bridges the gap at seed time.**

| Context | Reference Format | Example |
|---------|-----------------|---------|
| YAML files | Keys | `destination_key: "dark_cave"` |
| DB columns | UUIDs | `destination_id: "abc-123-..."` |
| Builder commands | Keys | `create exit --to dark_cave` |
| Game logic | UUIDs | `entity.location_id` |
| Export | Keys | UUID → key resolution |

EntitySeeder resolves key → UUID during seeding:
```elixir
# YAML says: destination_key: "dark_cave"
# Seeder looks up: dark_cave's UUID from DB
# Stores: destination_id: "uuid-..." AND destination_key: "dark_cave"
```

Both `destination_id` (UUID, for fast lookups) and `destination_key` (string, for human reference) are stored in the exit's components. Keys never change once assigned. UUIDs are stable.

### Decision 6: EntityBehavior Contract

**Decision: Behaviors implement optional callbacks. EntityServer dispatches in order: behaviors first, then scripts.**

```elixir
defmodule Loka.Engine.EntityBehavior do
  @doc "Called when EntityServer initializes"
  @callback on_init(entity :: Entity.t()) :: {:ok, Entity.t()} | {:error, term()}

  @doc "Called on periodic tick (interval defined in components)"
  @callback on_tick(entity :: Entity.t()) :: {:ok, Entity.t()}

  @doc "Called when an event is received via PubSub or direct message"
  @callback on_event(entity :: Entity.t(), event_name :: atom(), payload :: map()) ::
    {:ok, Entity.t()} | {:ok, Entity.t(), map()} | {:halt, Entity.t()}
  # Three return forms:
  #   {:ok, entity}            — continue chain, payload unchanged
  #   {:ok, entity, payload}   — continue chain, pass modified payload to next handler
  #   {:halt, entity}          — stop chain, DENY the triggering action (for before_ events)

  @doc "Called when the EntityServer is terminating"
  @callback on_terminate(entity :: Entity.t(), reason :: term()) :: :ok

  @optional_callbacks [on_init: 1, on_tick: 1, on_event: 3, on_terminate: 2]
end
```

**Volatile state is NOT a callback parameter.** Behaviors access volatile state via `EntityServer.Volatile.get/set` helpers (backed by the process dictionary), not through callback arguments. This keeps the callback interface clean — behaviors that don't need volatile state don't pay for it in their signatures. See Section 27 for details.

```elixir
# Behavior accessing volatile state:
def on_tick(entity) do
  waypoint = EntityServer.Volatile.get("patrol_waypoint", 0)
  EntityServer.Volatile.set("patrol_waypoint", waypoint + 1)
  {:ok, entity}
end
```

The EntityServer sets up the volatile context (via process dictionary) before calling any behavior, and tears it down after. Scripts use the same mechanism via `get_state/set_state` bindings. `on_terminate/2` can read volatile state via the same helpers (still in the same process).

**No `on_save` callback.** Saves are infrastructure, not game logic. A buggy `on_save` could block or crash the save path, risking data loss. Any pre-save transformation should happen in the mutation itself (via component accessor validation), not as a hook on the save path.

**`on_event/3` arity (not `/2`).** The event name and payload are separate arguments, making behavior modules more ergonomic to pattern match:
```elixir
def on_event(entity, :on_enter, %{entity: visitor}) do
  # Clear what we're matching on — no nested tuple/map destructuring
end
```

**Payload modification.** Returning `{:ok, entity, modified_payload}` passes the modified payload to the next handler in the chain (middleware pattern). This enables damage reduction, stealth filtering, zone-specific rule transforms, etc. See Decision 7.

**How events map to callbacks:** `on_init`, `on_tick`, and `on_terminate` are dedicated callbacks for lifecycle events. ALL other events (on_talk, on_look, on_before_move, etc.) are dispatched through `on_event/3` with the event name as an atom argument. This keeps the behavior interface small while supporting unlimited event types.

Dispatch order for a hook/event:
1. Behavior modules `on_event/3` (compiled Elixir, in list order)
2. Entity's inline script for this event name (ONE script per event per entity)

**One script per event per entity.** Each entity has at most one script handler per event name, defined in `scripts.<event_name>`. The `run_script(key, args)` binding is a utility callable FROM within a script (to invoke shared script entities), not a separate handler in the pipeline.

A behavior can return `{:halt, entity}` to stop the chain (prevents subsequent behaviors and scripts from running). This lets a developer's behavior module gate/validate before a builder's script runs.

### Decision 7: Hooks → Behavior/Script Dispatch

**Decision: The 22 hook types become event names dispatched through the behavior/script system.**

Current hooks map to events:

| Current Hook | V2 Event Name | `self()` is | Dispatched When |
|-------------|--------------|------------|-----------------|
| `at_entity_creation` | `on_create` | Created entity | Entity first saved to DB |
| `at_entity_destruction` | `on_destroy` | Destroyed entity | Entity deleted |
| `before_move` | `on_before_move` | Moving entity | Entity about to change location (cancellable) |
| `after_move` | `on_after_move` | Moved entity | Entity has changed location |
| `at_enter` | `on_enter` | Room/container | Another entity entered this location |
| `at_leave` | `on_leave` | Room/container | Another entity left this location |
| `at_look` | `on_look` | Looked-at entity | This entity was examined |
| `at_use` | `on_use` | Used entity | This entity was activated |
| `before_attack` | `on_before_attack` | Attacker | Combat: about to attack (cancellable) |
| `after_attack` | `on_after_attack` | Attacker | Combat: attack resolved |
| (new) | `on_hit` | Target | Combat: this entity was hit |
| `at_death` | `on_death` | Dying entity | Entity health reached 0 |
| `at_respawn` | `on_respawn` | Respawning entity | Entity alive again |
| `at_equip` | `on_equip` | Item | Item equipped to a slot |
| `at_unequip` | `on_unequip` | Item | Item removed from slot |
| `at_pickup` | `on_pickup` | Item | Item picked up by entity |
| `at_drop` | `on_drop` | Item | Item placed in room |
| (new) | `on_complete` | Quest entity | Quest objectives all met |
| (new) | `on_apply` | Affected entity | Status effect applied |
| (new) | `on_remove` | Affected entity | Status effect removed |

**This table is non-exhaustive.** The event name system is open — any atom can be dispatched via `dispatch_event`. These are the standard events provided by framework modules. Custom events (e.g., `on_puzzle_solved`, `on_weather_change`) can be dispatched by scripts and behaviors without any framework changes.

These are dispatched by EntityServer as a **middleware pipeline** — each handler can modify both the entity AND the payload before passing to the next.

**`dispatch_event` returns `{:ok, state}`, `{:halted, state}`, or `{:error, state}`** so callers know if a `before_` event was cancelled or crashed:

```elixir
# In EntityServer:
defp dispatch_event(state, event_name, payload) do
  entity = state.entity

  # Build pipeline: behavior modules first, then script runner
  pipeline = entity.behaviors ++ [:script]

  # Run pipeline (reduce_while — each handler can modify entity AND payload)
  {halted?, entity, _payload} =
    Enum.reduce_while(pipeline, {false, entity, payload}, fn handler, {_, acc_entity, acc_payload} ->
      result = case handler do
        :script -> maybe_run_script(acc_entity, event_name, acc_payload)
        mod -> apply_behavior(mod, event_name, acc_entity, acc_payload)
      end

      case result do
        {:ok, updated_entity} ->
          {:cont, {false, updated_entity, acc_payload}}
        {:ok, updated_entity, modified_payload} ->
          {:cont, {false, updated_entity, modified_payload}}  # payload flows forward
        {:halt, updated_entity} ->
          {:halt, {true, updated_entity, acc_payload}}
        :skip ->
          {:cont, {false, acc_entity, acc_payload}}
      end
    end)

  new_state = %{state | entity: entity}

  # Communicate whether the event was denied (halted) — critical for before_ events
  if halted? do
    {:halted, new_state}
  else
    {:ok, new_state}
  end
end
```

**Callers use the deny/error signals for before-events:**
```elixir
# Movement handler:
case dispatch_event_safe(state, :on_before_move, %{direction: dir, destination_id: dest}) do
  {:ok, state} -> proceed_with_move(state, dest)
  {:halted, state} -> send_denial_message(state)  # before-event: halt = deny
  {:error, state} -> proceed_with_move(state, dest)  # fail-open: crash doesn't block gameplay
end
```

`{:halt, entity}` from a behavior means "deny this action." For `on_before_*` events, this cancels the triggering action. For other events (on_tick, on_after_*, etc.), halt simply stops the remaining handlers — the action already happened. **Halts are final — there is no `allow()` override.** Once a handler halts the chain, subsequent handlers never run. If a handler doesn't want to deny, it returns `{:ok, entity}` (continue). To prevent denial, the non-denying handler must be ordered **before** the denying one in the behaviors list.

**Middleware pipeline benefits:** Each handler can modify the payload before the next handler sees it. This enables:
- A "damage reduction" behavior that reduces `payload.damage` before the combat script applies it
- A "stealth" behavior that removes hidden entities from `on_enter` payloads
- A zone-specific behavior that transforms event data for custom rules
- A "logging" behavior that observes and passes through unchanged

### Decision 8: PubSub Topics and Event Bus

**Decision: Two topic patterns. Standard event envelope. Atomic room transitions.**

#### Topic Patterns

| Topic | Purpose | Subscribers |
|-------|---------|-------------|
| `location:{id}` | Events at a location (room broadcasts, room state changes) | Player sessions in the room, room EntityServer, NPC EntityServers in the room |
| `entity:{id}` | Events about a specific entity (damage, inventory changes, quest updates) | That entity's session/UI, parent container's EntityServer, watchers |

#### Standard Event Envelope

All PubSub messages use a consistent shape for reliable pattern matching:

```elixir
%{
  event: :entity_entered,         # atom — the event type
  source_id: player_id,           # UUID — who caused this event
  target_id: room_id,             # UUID — who is affected (optional)
  payload: %{entity: player_entity},  # map — event-specific data
  correlation_id: "uuid-...",     # groups related events (e.g., all from one player action)
  caused_by: "uuid-..."          # parent event UUID that triggered this one (nil for root events)
}
```

This means consumers can pattern-match on `%{event: :entity_entered}` without knowing the full payload shape.

**Event correlation** traces causal chains: attack → damage → death → loot_drop. All events in a chain share the same `correlation_id`. Each event records which event `caused_by` it. This is essential for combat debugging, audit logging, and quest trigger chains. The V1 `Event` struct already has these fields — V2 preserves them on the PubSub envelope. Correlation data is metadata on the message, not on the Entity struct — zero storage cost.

**Event name convention:** PubSub envelope uses **plain names** (`:enter`, `:leave`, `:before_move`). Behavior/script callbacks use **`on_` prefix** (`:on_enter`, `:on_before_move`). The EntityServer translates: when it receives `%{event: :enter}` from PubSub, it dispatches to `on_event(entity, :on_enter, payload)`. This separates external event transport from internal handler naming.

**Custom events follow the same pattern.** When a script calls `emit(:on_fish_caught, payload)`, the EntityServer strips `on_` for PubSub transport (`:fish_caught`) and re-adds it when dispatching to the target's behaviors/scripts. This means PubSub subscribers match on `:fish_caught`, while scripts/behaviors match on `:on_fish_caught`. The `on_` prefix is purely a handler-side convention.

#### Who Broadcasts

| Action | Broadcaster | Topic | Why |
|--------|------------|-------|-----|
| Player enters room | EntityServer (movement handler) | `location:{room_id}` | EntityServer owns movement logic |
| NPC takes damage | Combat module | `entity:{npc_id}` | Combat owns damage resolution |
| Item picked up | EntityServer (item, via location_id change) | `entity:{player_id}` | Player session needs UI update |
| Room description changed | EntityServer (room) | `location:{room_id}` | All sessions in room need refresh |
| Quest updated | Quest.Progress module | `entity:{player_id}` | Player session needs notification |
| Zone-wide message | System entity (weather, events) | Fan-out to all `location:{room_id}` in zone | No zone topic; query rooms, broadcast each |

**Rule:** The module that *causes* the state change is responsible for the broadcast. EntityServer broadcasts for entity-level events. Framework modules broadcast for cross-entity operations.

#### Zone Broadcasts (Fan-Out)

There is no `zone:{id}` topic. Zone-wide messages query rooms in the zone and fan out:

```elixir
def broadcast_to_zone(zone_key, message) do
  rooms = Entities.find(type: :room, tags: ["zone:#{zone_key}"])
  for room <- rooms do
    PubSub.broadcast("location:#{room.id}", %{event: :zone_message, payload: %{text: message}})
  end
end
```

This keeps the topic model simple (2 patterns) at the cost of N broadcasts for zone messages. For a typical zone (10-30 rooms), this is negligible. If a zone has 100+ rooms with players in most of them, consider adding a `zone:{key}` topic as an optimization.

#### Atomic Room Transitions

Room transitions must be atomic to prevent missed messages:

```elixir
def move_entity(entity_id, from_room_id, to_room_id) do
  # 1. Subscribe to new room FIRST (before unsubscribing from old)
  PubSub.subscribe("location:#{to_room_id}")

  # 2. Update entity location
  EntityServer.update(entity_id, fn e -> %{e | location_id: to_room_id} end, force_save: true)

  # 3. Broadcast departure to old room (subscribers still include this entity)
  PubSub.broadcast("location:#{from_room_id}", %{event: :entity_left, source_id: entity_id})

  # 4. Broadcast arrival to new room
  PubSub.broadcast("location:#{to_room_id}", %{event: :entity_entered, source_id: entity_id})

  # 5. Unsubscribe from old room LAST
  PubSub.unsubscribe("location:#{from_room_id}")
end
```

**Subscribe-first, unsubscribe-last** ensures no window where messages are missed. The entity may briefly receive messages from both rooms, but duplicate handling is cheaper than lost messages.

**Known tolerance:** Between step 2 (location updated) and steps 3-5 (broadcasts + unsubscribe), a `find(location_id: from_room_id)` query may not see the moving entity (it's already relocated in DB). This window is microseconds on a single server and is acceptable. For safety, the entire move sequence should execute within a single EntityServer `handle_call/cast` — never as separate messages that can interleave with other operations.

#### Player Session Subscriptions

Player sessions subscribe to:
- `location:{current_room_id}` — managed by movement handler (subscribe-first pattern above)
- `entity:{own_character_id}` — subscribed on login, unsubscribed on logout

### Decision 9: Supervision Tree — Infrastructure vs System Entities

**Decision: Core infrastructure stays supervised. Game systems become system entities.**

**Infrastructure (hardcoded in Application, always running):**
```elixir
children = [
  Loka.Repo,                    # Ecto/SQLite
  {Phoenix.PubSub, name: Loka.PubSub},
  Loka.Engine.EntityRegistry,    # Process registry for EntityServers
  Loka.Engine.EntitySupervisor,  # DynamicSupervisor for regular EntityServers (transient)
  Loka.Engine.SystemSupervisor,  # DynamicSupervisor for system entities (permanent restart)
  # EntityCache deferred to post-MVP — direct DB queries with indexes are fast enough
  Loka.Engine.Cooldowns,         # ETS-backed cooldown tracking
  Loka.Timers,                   # Persistent timer system
  Loka.Session.Registry,         # Online player tracking
  Loka.Engine.EntitySeeder,      # Blocks in init/1 until seeding completes, then idles
  LokaWeb.Endpoint,              # Phoenix web server — starts AFTER seeding
]
```

**EntitySeeder runs synchronously before Endpoint.** The seeder is a GenServer that performs all seeding in `init/1` (blocking), ensuring the DB is fully populated before the Endpoint starts accepting connections. After seeding, it enters an idle state (can be used for `reload_file/1` at runtime). This prevents the race condition where a player connects to an empty world because the async Task hasn't finished. OTP supervisors start children sequentially — the Endpoint won't start until EntitySeeder's `init/1` returns.

**System entity boot ordering:** After seeding, system entities tagged `auto_start` are started in **priority order** — lower number starts first:

```yaml
# In system entity's components:
components:
  service:
    priority: 10    # lower = starts first (default: 100)
  tick:
    interval: 60    # seconds between ticks (single source of truth)
```

This ensures dependencies are met without a full dependency graph solver. Convention:
- **1-9:** Core systems (time, calendar)
- **10-49:** Infrastructure systems (weather, economy — may depend on time)
- **50-99:** Game systems (festivals, events — may depend on weather/economy)
- **100+:** Ambient/cosmetic systems (torch flicker, room messages)

**Deleted from V1:** `PluginSupervisor` and `PluginLoader` — the entire plugin system is replaced by system entities (see Section 23).

**Two supervisors for EntityServers:**
- `EntitySupervisor` — regular entities (NPCs, items, player characters). `restart: :transient` — only restarts on abnormal crash, re-started lazily on next access via `EntityRegistry.get_or_start/1`.
- `SystemSupervisor` — system entities tagged `auto_start` (weather, economy, etc.). `restart: :permanent` — always restarts on crash, ensuring global systems stay alive. **Crash loop protection:** `max_restarts: 5, max_seconds: 60`. If a system entity crashes 5 times in 60 seconds, the supervisor stops restarting it and logs a critical alert. This prevents buggy builder-created system entities from creating infinite crash loops.

**Game systems (data-driven, started by tag after seeding):**

| System | Before | After |
|--------|--------|-------|
| Weather | `{Loka.Framework.Weather, []}` supervised child | Entity `type: :system, behaviors: [Weather], tags: [auto_start]` |
| Economy | `{Loka.Framework.Economy, []}` supervised child | Entity with behavior module |
| World Events | `{Loka.Framework.WorldEvents, []}` supervised child | Entity with behavior module |
| Combat System | `{Loka.Framework.Combat, []}` supervised child | **Stays infrastructure** (core mechanic, not builder-customizable) |
| NPC AI | Per-NPC GenServer logic | NPC entity behaviors (already per-entity) |

Rule of thumb: if a builder should be able to create, modify, or stop it → system entity. If it's core infrastructure that must always run → supervised child.

### Decision 10: SQLite Write Contention

**Decision: WAL mode + BUSY_TIMEOUT handles normal load. Graceful shutdown saves sequentially.**

Normal operation: ~17 writes/sec (1000 entities × 60s cycle). SQLite WAL mode handles this easily.

Mass force-save (server shutdown, world event):
```elixir
# Graceful shutdown: save all dirty entities sequentially
# 1000 saves × ~1ms each = ~1 second total
def terminate(_reason, state) do
  EntityRegistry.save_all_dirty()  # sequential, reliable
  :ok
end
```

If write contention becomes an issue at scale (unlikely for single-server MUD), options:
1. Increase dirty-check interval (120s instead of 60s)
2. Batch writes with `Ecto.Multi` (fewer transactions)
3. Write coordinator that queues and batches saves
4. SQLite BUSY_TIMEOUT (default 5000ms) auto-retries

### Decision 11: Crash Semantics

**Decision: EntityServers are fault-tolerant. Crashes lose at most 60 seconds of unsaved state. System entities auto-restart; regular entities restart lazily.**

| Scenario | Behavior |
|----------|----------|
| Regular EntityServer crashes (NPC, item) | Supervisor does NOT auto-restart. Entity re-loads from DB on next access via `EntityRegistry.get_or_start/1`. Up to 60s of dirty state lost. |
| System EntityServer crashes (weather, economy) | `SystemSupervisor` auto-restarts with `restart: :permanent`. Entity re-loads from DB. System resumes. |
| Player character EntityServer crashes | Same as regular — session detects process death, sends reconnect to client. Character re-loads from DB. Force-save on player actions minimizes data loss. |
| Entity load failure (corrupt DB data) | EntityServer returns `{:stop, {:invalid_entity, reason}}` from `init`. Supervisor does NOT restart (transient). Callers of `get_or_start/1` receive `{:error, :invalid_entity}`. Logged with entity ID + corruption details. |
| Crash during force_save | `try/rescue` around the DB write. Failure is logged with entity ID + error. Retried once on restart. |
| Crash during behavior/script dispatch | EntityServer snapshots entity state before dispatch, wraps in `try/catch`. On crash: restore snapshot, log error. See rollback pattern below. |
| Script crashes 5 times consecutively | Script hook is auto-disabled. Builder notified. `rollback-script <entity> <event>` restores previous version. See Section 26. |
| DB connection lost | EntityServer keeps running with in-memory state. Dirty-check saves will fail and retry. Logged as warnings. Entity stays live. |

**Dispatch rollback pattern (with script auto-disable):**

```elixir
defp dispatch_event_safe(state, event_name, payload) do
  snapshot = Entity.snapshot(state.entity)  # named concept: immutable copy for rollback
  try do
    result = dispatch_event(state, event_name, payload)
    state = handle_script_success(elem(result, 1), event_name)
    :telemetry.execute([:loka, :entity_server, :dispatch], %{duration: ...},
      %{entity_id: state.entity.id, event_name: event_name})
    result
  catch
    kind, reason ->
      # catch, NOT rescue — catches both exceptions (:error) and exits (:exit)
      # This is critical: GenServer.call timeouts raise exits, not exceptions.
      # rescue would miss them, leaving the entity in a partially-mutated state.
      Logger.error("[EntityServer #{state.entity.key}] dispatch #{event_name} " <>
        "crashed: #{inspect({kind, reason})}")
      :telemetry.execute([:loka, :script, :error], %{},
        %{entity_id: state.entity.id, event_name: event_name, error: {kind, reason}})
      state = handle_script_failure(state, event_name)
      {:error, %{state | entity: snapshot}}  # rollback to pre-dispatch state — NOT {:ok, ...}
  end
end
```

**Side-effect ordering in behaviors (critical for implementers):**

The snapshot rollback restores entity struct state, but side effects (PubSub broadcasts, messages to other EntityServers) that occurred before the crash are **NOT rolled back**. If behavior 2 broadcasts "The door opens!" and behavior 3 crashes, players already saw the message but the entity state rolls back.

**Rule for behavior/script authors:** Perform state mutations FIRST, side effects (broadcasts, cross-entity messages) LAST. This minimizes the window where a crash leaves visible but rolled-back effects. The pipeline naturally helps — early behaviors mutate state, later behaviors/scripts broadcast results. But explicitly:

```elixir
# GOOD: mutate first, broadcast after
def on_event(entity, :on_use, %{user: user}) do
  entity = Components.Container.set_opened(entity, true)  # state change first
  broadcast(entity.location_id, "#{user.short_desc} opens the chest.")  # side effect last
  {:ok, entity}
end

# BAD: broadcast before mutation — crash after broadcast leaves stale message
def on_event(entity, :on_use, %{user: user}) do
  broadcast(entity.location_id, "#{user.short_desc} opens the chest.")  # visible immediately
  entity = might_crash_here(entity)  # if this crashes, broadcast already sent
  {:ok, entity}
end
```

**Crash returns `{:error, state}`, NOT `{:ok, state}`.** Callers must distinguish three outcomes:
- `{:ok, state}` — dispatch completed successfully, event allowed
- `{:halted, state}` — a handler halted the chain (for `on_before_*` events: action cancelled; for after-events: chain stopped, action already happened)
- `{:error, state}` — dispatch crashed, entity rolled back to pre-dispatch state

**For `on_before_*` events, crashes fail-open:** the action proceeds (a broken script should not block gameplay). For non-before events, the crash is logged and the entity continues with rolled-back state.

**`Entity.snapshot/1`** is a named concept (not a complex function — Elixir structs are immutable). Naming the snapshot makes the rollback pattern greppable and explicit in code reviews. Every `dispatch_event_safe` begins with a snapshot and restores it on crash.

**Why `catch` not `rescue`:** `rescue` only catches Elixir exceptions (Erlang `:error` kind). If a behavior module does a `GenServer.call` to a dead or slow process, that raises an `:exit` signal — not caught by `rescue`. Using `catch kind, reason` handles both exceptions and exits, ensuring the rollback always triggers.

The snapshot ensures that if behavior 3 of 5 crashes, the mutations from behaviors 1-2 are also rolled back. Without this, a crash would leave the entity in a partially-mutated state. Script auto-disable (see Section 26) prevents a bad script from crashing every tick forever.

**Maximum data loss:** 60 seconds of ambient mutations (NPC health regen, weather state changes). Player-affecting operations use `force_save: true`, so player data loss should be near-zero.

### Decision 12: Graceful Shutdown Ordering

**Decision: Shutdown freezes all EntityServers, then saves player data first, then everything else.**

```
1. Stop accepting new connections (Endpoint shutdown)
2. Notify online players: "Server shutting down..."
3. FREEZE all EntityServers (switch to read-only mode — reject new mutations)
   └── EntityServer receives :drain cast → sets state.frozen = true
   └── handle_call({:update, _}) returns {:error, :shutting_down} while frozen
   └── This prevents mid-mutation saves — entities are in a consistent state
4. Force-save all player character EntityServers (highest priority)
5. Force-save all other dirty EntityServers (NPCs, rooms, system entities)
6. Stop all EntityServers (terminate/1 does final save attempt)
7. Stop infrastructure (EntityRegistry, EntityCache, PubSub, Repo)
```

**Why the freeze step matters:** Without it, players are still performing actions between steps 2-4. You might save an entity mid-combat-turn with partially-applied damage. The freeze ensures every entity is in a consistent state before any saves begin.

This ordering ensures player data is persisted even if later steps fail. Total shutdown time for 1000 entities: ~2-3 seconds (freeze is near-instant, saves dominate).

### Decision 13: Entity Idle Timeout

**Decision: All EntityServers except system entities have idle timeouts. Rooms get a longer timeout.**

| Entity Type | Timeout | Rationale |
|-------------|---------|-----------|
| Room (occupied or recent) | 15-30 minutes after last entity leaves | A MUD with 500+ rooms and <50 players wastes memory keeping all rooms live. The `EntityRegistry.get_or_start/1` pattern handles lazy restart. |
| Room (pure data, no scripts) | No GenServer needed | Served from DB read-through cache. No behaviors = no process needed. |
| System entity (`auto_start`) | None (always live) | Global systems must keep running |
| Player character | None while online; shuts down on logout | Session lifecycle manages this |
| NPC, item, other | 5 minutes idle | Free memory in unvisited zones |

**"Idle" means no external messages received.** Self-generated tick messages do NOT reset the idle timer. An NPC with a 60-second tick interval in an unvisited zone will still time out after 5 minutes of no player interaction. On restart, the tick timer is re-initialized from the entity's component config. This prevents ticking entities from staying alive forever in empty zones.

**Implementation detail:** `handle_info(:tick, state)` and `handle_info(:auto_save, state)` must NOT update `state.last_activity`. Only external messages (`GenServer.call` from other processes, PubSub messages, `:reload`) reset the idle timer. Guard this with a `@no_idle_reset [:tick, :auto_save]` list or equivalent.

On timeout, the EntityServer saves to DB and terminates. Re-started lazily on next access via `EntityRegistry.get_or_start/1`. This keeps memory bounded without affecting correctness.

---

## 13. Scriptable Framework: Rules as Data

### The Principle

The engine provides primitives (entity CRUD, PubSub, timers, cooldowns). Scripts implement game rules. The framework becomes a thin dispatch layer between them.

```
Before:  Engine → Framework (85 hardcoded modules) → Content (YAML data)
After:   Engine → Framework (thin dispatch + bindings) → Scripts (rules as data on entities)
```

### Query Convention by Layer

**Framework code queries by component (capability), not by type (classification):**

| Layer | Queries by | Example | Why |
|-------|-----------|---------|-----|
| Engine | UUID, key+type | `Entities.find(uuid)` | Generic infrastructure |
| Framework | **Component** | `find(component: "combatant")` | Capability-based: "anything that can fight" |
| Builder/Scripts | **Type** | `find(type: :npc, ...)` | Content-level: "all NPCs in this room" |

Framework modules should NOT hardcode `type: :npc`. A Combat module works with anything that has a `"combatant"` component — NPCs, players, summoned creatures. Type is a content classification that belongs in builder scripts.

**Type as content-level concern:** V2 MVP uses a fixed type enum (`:room | :npc | :item | :exit | :character | :quest | :dialogue | :zone | :storyline | :skill | :recipe | :resource | :status | :system | :script`). Adding a new type requires engine changes. Post-MVP, this could evolve to an open type system (like Evennia's typeclasses) where builders define new types without engine changes. For now, the fixed enum is simpler and sufficient.

### Why This Matters

1. **LLMs understand Elixir.** Scripts are sandboxed Elixir — the language LLMs write most fluently. A builder AI can read, write, debug, and iterate on game mechanics.
2. **Hot-reloadable.** Change a script → entity reloads → new behavior is live. No restart.
3. **Per-entity customizable.** Two swords can have different `on_hit` scripts. Two zones can have different combat rules.
4. **Testable as data.** Scripts run in the sandbox with mock entities. Validation catches errors before deployment.
5. **Version-controllable.** Scripts export to YAML, diff in PRs, review like any content.

### What Moves to Scripts

| Subsystem | Compiled Elixir (dispatch) | Scripts (rules) |
|-----------|---------------------------|-----------------|
| **Combat** | Process lifecycle, turn order, targeting | Damage formulas, hit chance, special abilities, death effects |
| **Weather** | (eliminated — becomes system entity) | Weather calculation, atmospheric messages per zone |
| **Status Effects** | (eliminated — becomes entity scripts) | `on_apply`, `on_remove`, `on_tick` per status type |
| **Crafting** | Station interaction flow | Recipe validation, quality rolls, bonus items |
| **Gathering** | (eliminated — becomes entity scripts) | Skill checks, resource yields, rare finds |
| **Shops** | Transaction processing | Price formulas, discounts, dynamic economy |
| **Quest Objectives** | State machine (start→active→complete) | Completion checks per objective type (extensible!) |
| **Loot** | (eliminated — becomes entity scripts) | Drop tables, rare item chance, context-sensitive loot |
| **NPC AI/Ambient** | (eliminated — becomes entity scripts) | Idle behavior, reactions, patrol routes |
| **Room Ambient** | (eliminated — becomes entity scripts) | Atmospheric messages, environmental effects |
| **Skills** | Cooldown enforcement, resource checks | Skill effects, scaling, requirements |
| **Progression** | (eliminated — becomes system entity) | XP formulas, level-up effects, class curves |
| **Day/Night** | Time tracking (infrastructure) | Effects of time changes (NPC schedules, visibility) |
| **Conditions** | (eliminated — becomes script functions) | Custom condition evaluation for quests/dialogues |
| **Zone Reset** | (eliminated — becomes zone entity scripts) | Custom respawn patterns, wave spawning |

### What Stays Compiled Elixir

| Module | Why |
|--------|-----|
| Entity system (CRUD, DB, GenServer) | Core infrastructure — scripts run ON this |
| Script sandbox + bindings | Can't be self-referential |
| Session / auth / security | Security boundary |
| PubSub / event bus | Infrastructure plumbing |
| EntityServer lifecycle | Process management |
| Command parser + builder dispatch | Input handling (security) |
| Lock system (now `components["locks"]`) | Access control (security) |
| Cooldowns, Timers | Infrastructure used BY scripts |

### Script Bindings API (Overview)

> **See Section 18 for the complete, authoritative V2 bindings list.** This is a condensed overview.

The bindings determine what builders can do. Scripts call the same `Entities.find` as engine/framework code — no wrapper layer.

```elixir
# ── Entity Access (same API as engine) ──
self()                                    # current entity
Entities.find(uuid)                       # by UUID
Entities.find(key: "sneak", type: :skill) # by key+type
Entities.find(location_id: room.id, type: :npc, tags: ["hostile"])
entities_in_room()                        # sugar for find(location_id: self().location_id)
get_location(entity)                      # parent entity/room

# ── Component Access ──
get_component(entity, "combatant")        # read component
set_component(entity, "combatant", data)  # write component
has_component?(entity, "weapon")          # check existence

# ── Combat / Health ──
apply_damage(target, amount, type)
heal(target, amount)
kill(target)                               # trigger death + respawn

# ── Status Effects ──
apply_status(target, "poisoned", duration: 30)
remove_status(target, "poisoned")
has_status?(target, "poisoned")

# ── Resources / Economy ──
grant_resource(entity, :gold, 100)
consume_resource(entity, :mana, 15)
has_resource?(entity, :gold, 50)
get_resource(entity, :mana)

# ── Movement ──
move_entity(entity, destination_id)
teleport(entity, room_key)

# ── Spawning ──
spawn_entity(prototype_key, location: room)
despawn(entity)

# ── Communication ──
send_message(target, "text")              # to one entity
broadcast(location, "text")               # to a room
broadcast_to_zone(zone, "text")           # to all rooms in zone
broadcast_global("text")                  # server-wide

# ── Cooldowns / Timers ──
set_cooldown(entity, "ability", seconds)
on_cooldown?(entity, "ability")
set_timer(name, seconds, event_name)      # triggers event later

# ── Randomness ──
random()                                  # 0.0 to 1.0
random(min, max)                          # integer range
pick_random(list)                         # random element
weighted_random(list_with_weights)        # weighted selection

# ── Time ──
time_of_day()                             # :dawn, :morning, etc.
current_season()                          # :spring, :summer, etc.

# ── Quest / Progression ──
complete_objective(player, quest_key, index)
grant_xp(player, amount)
grant_quest(player, quest_key)
has_flag?(player, "flag_name")
set_flag(player, "flag_name", value)

# ── Tags ──
add_tag(entity, "tag")
remove_tag(entity, "tag")
has_tag?(entity, "tag")

# ── Logging ──
log(message)                              # debug output
```

### Example: LLM Builder Creates a Vampiric Sword

```yaml
key: vampiric_blade
type: item
short_desc: "a dark pulsing blade"
long_desc: "A sword of obsidian metal that seems to drink the light around it."
components:
  weapon: {damage: 20, damage_type: dark}
  physical: {weight: 4}
scripts:
  on_hit:
    code: |
      heal_amount = div(event.damage, 4)
      heal(event.attacker, heal_amount)
      drain = min(5, get_resource(event.target, :mana))
      if drain > 0 do
        consume_resource(event.target, :mana, drain)
        grant_resource(event.attacker, :mana, drain)
      end
      send_message(event.attacker, "The blade pulses darkly, restoring your vitality.")
```

### Framework Module Count: Before vs After

```
Before: ~85 framework modules (all compiled Elixir)
After:  ~30 framework modules (dispatch + bindings)
        + scripts on entities (rules as data, LLM-readable/writable)
```

The ~55 deleted modules don't disappear — their logic moves to default scripts on prototype entities. A "base_combat_rules" system entity has the default damage formulas. A builder can override them per zone, per encounter, per item.

---

## Appendix: Architecture Comparison

### Before (V1)

```
Stores: YAML files → ETS Registry → SQLite entities + entity_attributes → GenServer
Sync:   Manual, error-prone, scattered across RoomManager
Truth:  Ambiguous (ETS for prototypes, DB for instances, both for rooms)
Player: Separate GameState table
Content: TypedObject in ETS (read-only... mostly)
Systems: Hardcoded supervised GenServers in Application tree
```

### After (V2)

```
Stores: SQLite entities + entity_tags + entity_log → GenServer (+ ETS live state if needed)
Sync:   None needed (one store)
Truth:  DB, always. All writes go through EntityServer.
Player: Entity with player components
Content: Entity with content components
Systems: type: :system entities with behavior modules, started by auto_start tag
YAML:   Seed/export format, not runtime store
Plugins: Deleted. System entities replace all plugin functionality.
JSON:   4 columns (components, behaviors, scripts, metadata) — locks merged into components
```

### Evennia Mapping

| Evennia Concept | Loka V2 Equivalent |
|----------------|-------------------|
| ObjectDB table | `entities` table |
| Typeclass path | `type` field + `behaviors` list |
| Idmapper cache | EntityServer GenServer (BEAM-native) |
| Attribute (EAV) | `components` JSON (structured) |
| Tag system | `tags` array + DB queries |
| Script typeclass | Entity with `type: :system` + behavior/scripts |
| Prototype dict | Entity with `is_prototype: true` |
| Global Script | System entity `type: :system` tagged `auto_start` |
| db handler (persistent) | `components` (saved to DB) |
| ndb handler (non-persistent) | EntityServer `volatile` map (see Section 27) |
| AccountDB | `players` table (auth only) |
| Character | Entity with `type: :character` + player component |

---

## 14. Open Questions

### Q1: Tag Indexing Strategy — RESOLVED

**Decision: Use `entity_tags` join table from day one.**

The JSON array approach (`json_each()`) does a full table scan on every tag query. This creates a performance cliff as entity count grows. The join table costs ~20 lines of migration code and gives O(log n) tag lookups from the start:
```sql
-- Fast indexed lookup:
SELECT e.* FROM entities e
JOIN entity_tags t ON t.entity_id = e.id
WHERE t.tag = 'hostile'
```
The `Entities` API abstracts the join table — callers work with `entity.tags` as a simple list. Tags are loaded with the entity and kept in the struct. Tag mutations go through `Entities.add_tag/2` and `Entities.remove_tag/2` which update both the join table and the in-memory struct.

**Critical: tag mutations write to the DB immediately** (not deferred to the 60s dirty-check save). See Section 1 for rationale.

### Q2: Cache Eviction Strategy — DEFERRED

**Decision: EntityCache deferred to post-MVP.** Direct DB queries with `(key, type)` index are <100μs — fast enough for <100 concurrent players. When cache is added later, use simple TTL (5 min) with write-through invalidation. Cache size capped at ~10K entries. No Cachex dependency needed.

### Q3: Component Schema Validation

**Question:** Should we validate component shapes at write time? (e.g., "combatant MUST have health and max_health")

**Recommendation: Validate at seed time and builder write time, not at runtime.**

- EntitySeeder validates YAML content against component schemas during seeding
- Builder commands validate before saving
- Runtime mutations through accessor modules are inherently validated (the module enforces types)
- Direct component writes (admin tools) are not validated — admin has full power
- A `mix loka.validate` task checks all DB entities against schemas

This catches errors early without adding overhead to the hot path.

### Q4: Prototype Override Tracking for Re-Apply

**Question:** How does `apply-prototype` know which fields to preserve on instances?

**Recommendation: Path-level tracking in `metadata["overrides"]`.**

When a builder edits a specific instance (not the prototype), the edited field path is recorded:
```elixir
metadata["overrides"] = [
  "short_desc",
  "components.combatant.health",
  "tags"
]
```

`apply-prototype` skips these paths and updates everything else. This is simple, explicit, and debuggable (a builder can inspect an instance's overrides).

For pre-production: `respawn-all <key>` sidesteps this entirely (despawn all, spawn fresh). Override tracking only matters when you need to update live instances without losing customization.

### Q5: How Does the Existing Hooks System Map?

**Question:** The current codebase has ~22 hook types fired by various framework modules. How do they integrate with the new behavior/script dispatch?

**Recommendation: Hooks become events dispatched through EntityServer.**

The framework modules (Combat, Movement, etc.) don't fire hooks directly anymore. Instead, they send events to the affected EntityServer, which dispatches them to behaviors and scripts:

```elixir
# Before (V1): framework module fires hook directly
Hooks.run(entity, :before_move, %{direction: "north"})

# After (V2): framework module sends event to EntityServer
EntityServer.dispatch_event(entity_id, :on_before_move, %{direction: "north"})
# EntityServer internally dispatches to behaviors → scripts
```

This centralizes all event handling in EntityServer, which already has the entity's state and process isolation.

### Q6: How Does Room Display Work Without ETS?

**Question:** Currently room display reads from TypedObject Registry (ETS) for room data. Without ETS, every room display is a DB query + GenServer access. Is this fast enough?

**Recommendation: Room EntityServers start on demand and cache with generous timeout. Display reads from GenServer when live, DB otherwise.**

Room EntityServers start on first access (`EntityRegistry.get_or_start`) and stay alive for 15-30 minutes after the last entity leaves (see Decision 13). Occupied rooms always have a live GenServer — room display reads from in-memory state, which is instant. Empty rooms with no behaviors can be served from the DB read-through cache without a GenServer.

The read path for room display:
1. If room EntityServer is live → read from GenServer (or ETS live state if implemented)
2. If not live → `EntityRegistry.get_or_start(room_id)` → starts GenServer, loads from DB
3. For pure-data rooms (no scripts/behaviors) that are idle → read-through cache serves from DB

This avoids keeping 500+ room GenServers alive when only 50 have players nearby.

### Q7: Should Cooldowns and Timers Become Entities?

**Question:** Cooldowns (ETS-backed) and Timers (DB-backed) are currently infrastructure. Should they become part of the entity system?

**Recommendation: Keep as infrastructure.**

- **Cooldowns** are ephemeral (don't survive restart). They're ETS lookups — fast, simple. Making them entity components would add save/load overhead for data that's intentionally transient.
- **Timers** are persistent but cross-cutting (a timer can affect multiple entities or trigger system events). They're better as infrastructure that sends events TO entities than as entity components.

Both can be accessed from behavior modules and scripts via bindings. They don't need to BE entities.

### Q8: The `mood` and `primary_keyword` Fields

**Question:** These are currently top-level Entity fields but only used by some types. Should they move to components?

**Recommendation: Keep as top-level fields.**

Both are display-related and broadly applicable:
- `primary_keyword` — used for touch/click targeting UI (any interactive entity)
- `mood` — affects description display (NPCs, potentially rooms)

They're lightweight (nullable strings) and don't add meaningful overhead as top-level fields. Moving them to components adds accessor boilerplate for minimal gain.

### Q9: Backward Compatibility During Migration

**Question:** Clean break or gradual migration with compatibility layers?

**Recommendation: Clean break, phased execution.**

We're pre-production. No live players. No backward compatibility needed. Each migration phase:
1. Create new code alongside old
2. Migrate data
3. Switch callers to new API
4. Delete old code
5. Run full test suite

The phases from the migration plan (Section 11) can proceed in order. Each phase produces a working system with passing tests before the next phase starts.

### Q10: What Other Systems Exist on the Edges?

**Question:** What framework subsystems haven't been discussed yet and how do they fit?

**Answer:** Comprehensive mapping provided in Section 15 below.

### Q11: Behavior Module Names in JSON

**Question:** The `behaviors` field stores Elixir module names as JSON strings (e.g., `"Loka.Framework.Behaviors.Weather"`). How are these converted back to atoms when loading from DB?

**Recommendation: Use `Module.safe_concat/1`, not `String.to_existing_atom/1`.**

```elixir
defp resolve_behavior(module_string) when is_binary(module_string) do
  # Module.safe_concat handles the Elixir. prefix and ensures the module exists
  module = Module.safe_concat(String.split(module_string, "."))
  if Code.ensure_loaded?(module), do: {:ok, module}, else: {:error, :module_not_found}
end
```

`String.to_existing_atom/1` fails if the module hasn't been loaded yet (the V1 trap). `Module.safe_concat/1` + `Code.ensure_loaded?/1` safely resolves the module and loads it if needed. If the module doesn't exist (e.g., typo in YAML), log a warning and skip — don't crash the EntityServer.

### Q12: Key Lookups Always Require Type — RESOLVED

**Decision: Keys are unique per type, NOT globally. `find(key: key, type: type)` is the only lookup — no single-arg convenience.**

```elixir
def find(key: key, type: type), do: ...   # the ONLY key-based lookup
# No get_by_key(key) — ambiguity is a bug, not a runtime error to handle
```

**Why NOT globally unique:** Existing content has natural cross-type duplicates:
- `"focus"` exists as both a **skill** and a **resource**
- `"wild_berries"` exists as both a **gathering node** and an **item**

Forcing global uniqueness would require awkward prefixing (`skill_focus`, `resource_focus`) that hurts content readability.

**Why no single-arg convenience:** Ambiguous lookups are always a bug. Rather than returning `{:error, :ambiguous_key}` at runtime, force callers to specify type at compile time. This eliminates an entire class of runtime errors.

**Enforcement:**
- The `entities` table has a unique index: `CREATE UNIQUE INDEX entities_prototype_unique ON entities(key, type) WHERE is_prototype = 1`
- Per-type uniqueness only — two prototypes of the same type cannot share a key
- The seeder logs a warning (not error) for cross-type duplicates, so builders are aware
- The cache uses `{key, type}` tuples internally

**Hard rule:** All key lookups require type. No exceptions.

### Q13: Composite Index for Common Queries

**Question:** `find(location_id: room_id, type: :npc)` queries `WHERE location_id = ? AND type = ?`. Should there be a composite index?

**Recommendation: Yes. Add composite index.**

```sql
CREATE INDEX entities_location_type_idx ON entities(location_id, type);
```

This is the single most common query pattern (room display, inventory listing, exit lookup). The composite index makes it an index-only lookup rather than filtering after index scan. Low cost, high impact.

### Q14: EntityServer Tick Timer Mechanism

**Question:** How does EntityServer set up periodic ticks for behavior modules and scripts?

**Recommendation: `Process.send_after/3` in init, recalculated after each tick.**

```elixir
# In EntityServer.init:
defp schedule_tick(state) do
  interval = get_tick_interval(state.entity)  # from components["tick"]["interval"] or default (60s)
  if interval && interval > 0 do
    ref = Process.send_after(self(), :tick, interval * 1000)
    %{state | tick_ref: ref}
  else
    state
  end
end

# In handle_info(:tick, state):
def handle_info(:tick, state) do
  state = dispatch_event(state, :on_tick, %{})
  state = schedule_tick(state)  # reschedule (picks up interval changes)
  {:noreply, state}
end
```

Rescheduing after each tick (rather than `:timer.send_interval`) allows runtime interval changes and avoids drift accumulation. If a tick takes longer than the interval, the next tick fires immediately after.

### Q15: Component Schema Evolution

**Question:** When a component's shape changes (e.g., `combatant` gains a `speed` field), how do existing entities get the new field?

**Recommendation: Accessor modules provide defaults. No backfill migration needed.**

```elixir
# In Components.Combatant:
def speed(entity), do: get_in(entity.components, ["combatant", "speed"]) || 10  # default: 10
```

Component accessor modules return defaults for missing fields. Old entities without `speed` get the default value. New entities (seeded or spawned) get the field explicitly. No migration needed — the accessor handles it transparently.

For field *removal* or *rename*: write a one-time `mix loka.migrate_components` task that reads all entities and rewrites the component. Run once, done.

### Q16: Script Event Context

**Question:** When an NPC's `on_talk` script fires, how does the script know who the player is?

**Recommendation: All events include the triggering entity in the event payload. Scripts access it via `event()`.**

```elixir
# Event dispatched when player talks to NPC:
EntityServer.dispatch_event(npc_id, :on_talk, %{
  speaker_id: player_id,
  speaker: player_entity  # full entity struct for convenience
})

# In the NPC's on_talk script:
speaker = event().speaker
say("Hello, #{speaker.short_desc}!")
if has_tag?(speaker, "completed:intro_quest") do
  grant_quest(speaker, "advanced_quest")
end
```

Standard event payloads by event type. **`self()` is always the entity whose script/behavior is running.** The "actor" (typically the player) is in the payload.

**Naming convention:** Short, builder-friendly names. `on_<verb>` or `on_<noun>`. YAML script keys use the same names — no separate naming convention. Scripts are always on the affected entity, so "on_look" means "when I am looked at", not "when I look at something."

| Event | `self()` is | Payload Fields | Notes |
|-------|------------|----------------|-------|
| **Lifecycle** | | | |
| `on_create` | Created entity | (empty) | Entity first saved to DB |
| `on_destroy` | Destroyed entity | `reason` | Entity being deleted |
| `on_tick` | Ticking entity | `tick_count` | Number of ticks since entity started |
| **Interaction** | | | |
| `on_talk` | NPC being spoken to | `speaker`, `speaker_id` | Player talks to NPC |
| `on_look` | Entity being examined | `looker`, `looker_id` | Player examines entity |
| `on_use` | Entity being used | `user`, `user_id` | Player uses/activates entity |
| **Movement** | | | |
| `on_before_move` | Entity about to move | `direction`, `destination_id` | Cancellable (before-event) |
| `on_after_move` | Entity that moved | `direction`, `from_id`, `to_id` | Already happened |
| `on_enter` | Room (or container) | `entity`, `entity_id` | Another entity arrived at this location |
| `on_leave` | Room (or container) | `entity`, `entity_id`, `direction` | Another entity left this location |
| **Combat** | | | |
| `on_before_attack` | Attacker | `target`, `weapon` | Cancellable (before-event) |
| `on_after_attack` | Attacker | `target`, `damage`, `weapon`, `hit` | Attack resolved |
| `on_hit` | Target being hit | `attacker`, `damage`, `weapon`, `damage_type` | Modify damage via middleware |
| `on_death` | Dying entity | `killer`, `killer_id`, `damage_type` | Health reached 0 |
| `on_respawn` | Respawning entity | `spawn_location_id` | Entity alive again |
| **Inventory** | | | |
| `on_pickup` | Item being picked up | `picker`, `picker_id` | Item gained new owner |
| `on_drop` | Item being dropped | `dropper`, `dropper_id`, `room_id` | Item placed in room |
| `on_equip` | Item being equipped | `wearer`, `wearer_id`, `slot` | Item put in equipment slot |
| `on_unequip` | Item being unequipped | `wearer`, `wearer_id`, `slot` | Item removed from slot |
| **Quest** | | | |
| `on_complete` | Quest entity | `player`, `player_id` | All objectives met |
| `on_activate` | System/event entity | (context-specific) | System entity activated |
| **Status Effects** | | | |
| `on_apply` | Affected entity | `status`, `source`, `duration` | Status effect applied |
| `on_remove` | Affected entity | `status`, `reason` | Status effect removed |

**This table is the standard set.** The event system is open — any atom can be dispatched via `dispatch_event` or `emit()` from scripts. Custom events (e.g., `on_puzzle_solved`, `on_weather_change`) can be dispatched by scripts and behaviors without framework changes. Custom events should follow the same conventions: short `on_<verb>` name, `self()` = affected entity, actor in payload.

**`on_before_*` pattern:** Currently only movement and attack have cancellable before-events. The pattern is extensible — `on_before_pickup`, `on_before_use`, `on_before_equip` etc. can be added when game logic needs them. Don't pre-build before-events for every action; add them when a script needs to cancel a specific action.

---

## 15. Edge System Migration Map

Every framework subsystem mapped to its V2 fate. The current codebase has **~85 framework modules** organized into 17 subsystem groups, plus **52 engine modules** and **20 content/session/timer modules**.

### Migration Categories

Each module gets one of four fates:

| Fate | Meaning | Count |
|------|---------|-------|
| **Keep** | Stays as compiled Elixir (core infrastructure) | ~30 |
| **Thin** | Stays but reduced to thin dispatch calling scripts | ~15 |
| **Script** | Logic moves to default scripts on prototype entities | ~25 |
| **Delete** | Eliminated by unified model (no replacement needed) | ~15 |

### A. Quest System (18 modules → 8 kept, 5 thinned, 5 scripted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Quest` (facade) | **Thin** | Dispatch layer: validates quest state, delegates logic to scripts |
| `Quest.Definitions` | **Delete** | Quests are entities; definitions are component data |
| `Quest.Progress` | **Keep** | Core state machine (start→active→complete) stays compiled |
| `Quest.Progress.Tracking` | **Thin** | Objective completion checks become scripts per objective type |
| `Quest.Progress.Rewards` | **Script** | Reward formulas move to quest entity scripts (`on_complete`) |
| `Quest.QuestRegistry` | **Delete** | Replaced by `Entities.find(type: :quest)` with cache |
| `Quest.ObjectiveRegistry` | **Delete** | Objective handlers become script hooks on quest entities |
| `Quest.ObjectiveHandler` | **Keep** | Behaviour stays as interface; implementations become scripts |
| `Quest.Handlers.*` (5) | **Script** | Each handler's logic → default script on quest prototype |
| `Quest.Listeners` | **Thin** | Registers EntityServer event dispatchers instead of hooks |
| `Quest.TimerManager` | **Keep** | Timer infrastructure stays (sends events to entity scripts) |
| `Quest.ChainRegistry` | **Delete** | Storyline entities track chain progression |
| `Quest.Chain` | **Script** | Chain logic → script on storyline entity |
| `Quest.Journal` | **Keep** | Journal rendering stays compiled (template logic) |
| `Quest.Validator` | **Keep** | Validation stays compiled (runs at seed time) |
| `Quest.Metrics` | **Keep** | Analytics stays compiled |
| `Quest.Admin` | **Keep** | Admin ops stay compiled (security boundary) |

### B. Combat System (6 modules → 5 kept, 1 scripted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Combat` | **Thin** | Turn order + targeting stays compiled; damage formulas → scripts |
| `Combat.CombatServer` | **Keep** | Per-combat session process stays (process isolation needed) |
| `Combat.CombatSupervisor` | **Keep** | DynamicSupervisor stays |
| `Combat.RespawnManager` | **Keep** | Timer-based respawn stays as infrastructure |
| `Combat.DamageMessage` | **Script** | Message formatting → script (builder-customizable per zone) |
| `Combat.DamageTypes` | **Delete** | Damage types become component data on weapon entities |

**CombatServer ↔ EntityServer interaction pattern:**
- **Reads:** CombatServer reads combatant state from ETS live state table (if available) or `EntityServer.get/1`. CombatServer does NOT hold copies of entity state — reads fresh each tick.
- **Writes:** CombatServer sends mutations via `EntityServer.update/3` (serialized per-entity). This means each damage application is a message to the target's EntityServer.
- **Typical tick:** Read 3-5 combatant states (parallel ETS reads: ~µs), calculate damage (pure CPU), apply damage to each (3-5 sequential EntityServer.update calls: ~0.5ms total). Total: <1ms per combat tick.
- **Deadlock prevention:** CombatServer reads from ETS, not GenServer.call. This prevents the deadlock where CombatServer calls EntityServer A, which calls EntityServer B, which calls CombatServer.

### C. Resource System (5 modules → 2 kept, 1 scripted, 2 deleted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Resources.Resource` | **Delete** | Resource types are entities with `skill_def` components |
| `Resources.ResourceRegistry` | **Delete** | Replaced by `Entities.find(type: :resource)` |
| `Resources.ResourcePool` | **Keep** | ETS-backed pools stay (performance-critical hot path) |
| `Resources.ResourceTicker` | **Script** | Regen tick → system entity script (builder-customizable rates) |
| `Resources.FormulaEvaluator` | **Keep** | Safe formula eval stays compiled (security) |

### D. Skills System (6 modules → 2 thinned, 4 deleted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Skills.Skill` | **Delete** | Skill definitions are entities |
| `Skills.SkillRegistry` | **Delete** | Replaced by `Entities.find(type: :skill)` |
| `Skills.SkillManager` | **Thin** | Point allocation stays; skill effects → scripts |
| `Skills.BinarySkill` | **Delete** | Merged into skill entity model |
| `Skills.BinarySkillRegistry` | **Delete** | Replaced by entity queries |
| `Skills.BinarySkillManager` | **Thin** | Learning logic stays; requirements → scripts |

### E. Inventory System (7 modules → 4 kept, 2 thinned, 1 deleted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Inventory` | **Thin** | CRUD stays; stacking/capacity rules → scripts |
| `Inventory.Container` | **Thin** | Container logic stays; loot table → script |
| `Inventory.ContainerRespawn` | **Script** | Respawn scheduling → system entity script |
| `Inventory.Equipable` | **Keep** | Slot validation stays compiled |
| `Equipment` | **Keep** | Equipment management stays compiled |
| `Inventory.LootTable` | **Script** | Weighted selection → script binding (builder-customizable) |
| `Inventory.Stacking` | **Keep** | Stack math stays compiled |

### F. Economy & Shop (2 modules → 1 kept, 1 scripted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Economy` | **Thin** | Transaction safety stays; pricing → scripts |
| `Economy.Shop` | **Script** | Shop component data + pricing script on NPC entity |

### G. Social Systems (6 modules → 6 kept)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Social.Channel` | **Keep** | Channel struct stays |
| `Social.ChannelManager` | **Keep** | Chat infrastructure stays compiled |
| `Social.Party` | **Keep** | Party struct stays |
| `Social.PartyManager` | **Keep** | Party infrastructure stays compiled |
| `Social.ScopedMessage` | **Keep** | Message primitive stays |
| `Social.MessageRouter` | **Keep** | Routing stays compiled |

### H. Status Effects (3 modules → 1 kept, 1 deleted, 1 scripted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Status.StatusEffect` | **Delete** | Status effect definitions are entities |
| `Status.StatusRegistry` | **Delete** | Replaced by `Entities.find(type: :status)` |
| `Status.StatusManager` | **Keep** | Active effect tracking stays (ETS, performance-critical) |

### I. World Systems (6 modules → 2 kept, 4 scripted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `World.DayNight` | **Script** | System entity with behavior module |
| `World.Weather` | **Script** | System entity with behavior module |
| `World.Calendar` | **Keep** | Pure math, no game state |
| `World.Atmosphere` | **Keep** | Pure display logic |
| `World.RoomAmbient` | **Script** | Ambient messages → script on room entities |
| `World.NpcAmbient` | **Script** | Ambient actions → script on NPC entities |

### J. Crafting & Gathering (7 modules → 2 thinned, 3 deleted, 2 scripted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Crafting` | **Thin** | Transaction flow stays; recipe logic → scripts |
| `Crafting.Recipe` | **Delete** | Recipe definitions are entities |
| `Crafting.CraftingRegistry` | **Delete** | Replaced by entity queries |
| `Crafting.CraftingStation` | **Delete** | Station data in room entity components |
| `Gathering` | **Thin** | Interaction flow stays; yields → scripts |
| `Gathering.GatheringNode` | **Delete** | Node definitions are entities |
| `Gathering.GatheringRegistry` | **Delete** | Replaced by entity queries |

### K. Storyline & Progression (4 modules → 2 kept, 2 deleted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Storyline.Storyline` | **Delete** | Storyline definitions are entities |
| `Storyline.StorylineRegistry` | **Delete** | Replaced by entity queries |
| `Progression` | **Thin** | XP/level math stays; effects → scripts |
| `Player.GameState` | **Delete** | Player state moves to character entity components |

### L. Scripting Integration (2 modules → 1 kept, 1 deleted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Scripting.WorldEventHandler` | **Delete** | EntityServer handles events directly |
| `Scripting.BehaviorRegistry` | **Keep** | Behavior hook registration stays |

### M. RegistryBase Macro (1 module → deleted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `RegistryBase` | **Delete** | No more ETS registries; DB queries replace all |

### N. Content Modules (12 modules → evolved)

All `Content.*` modules (Quest, Dialogue, Script, Zone, Skill, etc.) evolve from wrapping `TypedObject.Loader.get(key)` to wrapping `Entities.find(key: key, type: type)`. Same external API, different backend. Example: `Content.Quest.get("intro")` calls `Entities.find(key: "intro", type: :quest)` internally.

### O. World Graph & Minimap (3 modules → kept)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `WorldGraph` | **Keep** | Pure coordinate math, graph traversal |
| `WorldGraph.LayoutManager` | **Keep** | Coordinate system for room positioning (used by Godot client minimap) |
| `RoomHelpers.minimap_cache` | **Keep** | ETS cache for minimap data sent to Godot client |

### P. Config & Admin (4 modules → 2 kept, 2 deleted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Config.Balance` | **Keep** | Game balance formulas from YAML. Evolves to load from DB or system entity if needed. |
| `Admin.GameLog` | **Delete** | Replaced by `entity_log` table (Section 21) + telemetry |
| `Admin.Audit.TaskSupervisor` | **Delete** | `entity_log` writes are synchronous (small, indexed inserts) |
| `SocialLoader` | **Delete** | Channel configuration moves to static config or system entity |

### Q. Socials/Emotes System (2 modules → evolved to entity type)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Engine.Social` | **Keep** | Struct stays as data type; socials become entities (`type: :social`) |
| `Engine.SocialLoader` | **Delete** | Replaced by EntitySeeder (loads socials from YAML as entities) |

**Decision 76:** Socials (smile, wave, hug) become entities with `type: :social`. The `Social` struct can stay as a convenience type or be replaced by a `Components.Social` accessor. `SocialLoader` (GenServer + ETS) is deleted — socials load from DB via `Entities.find(type: :social)`. The YAML in `priv/world/socials.yml` is converted to individual entity YAML files or kept as a single file with the seeder splitting them.

### R. World Room Modules (3 sub-modules in room.ex → evolved)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `World.Room` | **Thin** | Room display/enrichment stays; data access swaps to Entities API |
| `World.RoomLoader` | **Delete** | Replaced by `EntityServer.get(room_id)` or `Entities.find` |
| `World.RoomEvents` | **Delete** | Events dispatch through EntityServer behavior/script system |

### S. Sound Environment (1 module → scripted)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `World.SoundEnvironment` | **Script** | Zone-based sound configuration moves to zone entity components |

### T. Broadcast Module (1 module → kept)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Framework.Broadcast` | **Keep** | PubSub broadcasting helper stays (infrastructure) |

### U. Actions Layer (2 modules → kept)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Actions.Resolver` | **Keep** | Action dispatch logic stays compiled; swaps GameState → Entities API |
| `Actions.Action` | **Keep** | Action struct/types stay unchanged |

### V. Conditions (1 module → kept)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Conditions.Evaluator` | **Keep** | Quest/dialogue condition evaluation stays compiled (used by scripts) |

### W. Content Validators (3 modules → evolved)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `ContentValidator.QuestPlugin` | **Keep** | Evolves to validate quest entity components at seed time |
| `ContentValidator.DialoguePlugin` | **Keep** | Evolves to validate dialogue entity components at seed time |
| `ContentValidator.WorldPlugin` | **Keep** | Evolves to validate room/zone entity components at seed time |

### X. Scripting Internals (2 additional modules)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Scripting.ConfigSchema` | **Delete** | Behavior config was for plugin-style schemas; replaced by component data |
| `Quest.StateHelper` | **Keep** | Quest state convenience functions — evolves to use entity components |
| `Quest.QuestItemSpawner` | **Keep** | Quest reward item spawning — evolves to use Spawner + Entities API |

### Y. Spark Companion (3 modules → deleted, Section 24 confirmed)

| Module | Fate | V2 Plan |
|--------|------|---------|
| `Spark.Spark` | **Delete** | Post-launch feature, no content, no tests |
| `Spark.SparkState` | **Delete** | Ecto schema for unbuilt feature |
| `Spark.SparkEvent` | **Delete** | Event types for unbuilt feature |

### Registry Elimination Summary

**14 registries deleted** (all replaced by `Entities.find()` + read-through cache):

| Registry | Replacement Query |
|----------|------------------|
| TypedObject.Registry | Eliminated entirely |
| QuestRegistry | `Entities.find(type: :quest, is_prototype: true)` |
| ObjectiveRegistry | Script hooks on quest entities |
| ChainRegistry | Entities with storyline type |
| StorylineRegistry | `Entities.find(type: :storyline)` |
| ResourceRegistry | `Entities.find(type: :resource)` |
| SkillRegistry | `Entities.find(type: :skill)` |
| BinarySkillRegistry | Merged into skill queries |
| StatusRegistry | `Entities.find(type: :status)` |
| CraftingRegistry | `Entities.find(type: :recipe)` |
| GatheringRegistry | `Entities.find(type: :gathering_node)` |
| DamageTypes | Component data on entities |
| ZoneLoader | `Entities.find(type: :zone)` |
| ZoneRegistry | `Entities.find(type: :zone)` |

### Supervision Tree: Before vs After

**Before (50 supervised children):**
```
Telemetry, PromEx, Repo, Migrator, DNS, PubSub,
Session (3), Config (1), Engine (9), Plugins (2),
Social (2), Admin (2), Quest (5), Combat (3),
Crafting (2), Skills (1), Inventory (1), Resources (3),
Timers (1), World (4), Scripting (1), Zone (3),
Validation (1), WorldBuilder (1), Endpoint (1)
```

**After (~21 supervised children):**
```
LokaWeb.Telemetry, PromEx, Repo, Migrator, PubSub,
Registry (PlayerRegistry), Session.Registry, Session.Supervisor,
Config.Balance,
Registry (EntityRegistry.Registry),
EntitySupervisor, SystemSupervisor (max_restarts: 5),
EntityRegistry, WorldGraph.LayoutManager,
Cooldowns, ResourcePool, Timers.Server,
Combat.CombatSupervisor, Combat.RespawnManager,
Social.ChannelManager, Social.PartyManager,
EntitySeeder,                  -- blocks in init until seeding completes, then idles
Endpoint
```

Everything else starts as system entities (tagged `auto_start`) after seeding.

---

## 16. Detailed Migration Execution Plan

File-level specifics for each phase. Each phase produces a green test suite before proceeding.

### Phase 1: Foundation (DB Schema + Entity Evolution)

**Goal:** New `entities` + `entity_tags` tables with unified schema, evolved Entity struct, new Entities API.

**Duration estimate:** This is the largest phase.

#### Step 1.1: Create Migration

```
server/priv/repo/migrations/TIMESTAMP_create_unified_entities.exs
```

Since we're pre-production with no player data to preserve, this migration drops old tables and creates the new schema cleanly. No `entities_v2` rename gymnastics needed.

```elixir
def change do
  # Drop old tables (pre-production: no data to preserve)
  drop_if_exists table(:entity_attributes)
  drop_if_exists table(:player_game_states)
  drop_if_exists table(:entities)

  create table(:entities, primary_key: false) do
    add :id, :binary_id, primary_key: true
    add :type, :string, null: false
    add :key, :string
    add :prototype_key, :string
    add :is_prototype, :boolean, default: false
    add :version, :integer, default: 1
    add :short_desc, :string
    add :long_desc, :string
    add :extra_desc, :text
    add :keywords, :text, default: "[]"       # JSON array
    add :primary_keyword, :string
    add :mood, :string                  # affects NPC display and behavior selection
    add :location_id, references(:entities, type: :binary_id, on_delete: :nilify_all)
    add :account_id, references(:players, type: :binary_id, on_delete: :nilify_all)
    add :components, :text, default: "{}"     # JSON: all game data (including locks)
    add :behaviors, :text, default: "[]"      # JSON: behavior module list
    add :scripts, :text, default: "{}"        # JSON: event_name → code string
    add :metadata, :text, default: "{}"       # JSON: bookkeeping (including parent_key)
    timestamps(type: :utc_datetime)
  end

  # Tags: separate join table for indexed queries
  create table(:entity_tags, primary_key: false) do
    add :entity_id, references(:entities, type: :binary_id, on_delete: :delete_all), null: false
    add :tag, :string, null: false
  end

  create index(:entities, [:type])
  create index(:entities, [:key])
  create index(:entities, [:location_id])
  create index(:entities, [:location_id, :type])  # composite: find(location_id:, type:)
  create index(:entities, [:account_id])           # player login lookup
  create index(:entities, [:prototype_key])
  create index(:entities, [:is_prototype])
  create unique_index(:entities, [:key, :type], where: "is_prototype = 1",
    name: :entities_prototype_unique)
  # NOTE: No global key uniqueness — keys are unique per type only.
  # "focus" can be both a skill and a resource. See Q12.

  create index(:entity_tags, [:tag])
  create index(:entity_tags, [:entity_id])
  create unique_index(:entity_tags, [:entity_id, :tag])
end
```

#### Step 1.2: Evolve Entity Struct

**File:** `lib/loka/engine/entity.ex`

Changes:
- Remove `data` field (replaced by components)
- Remove `attributes` field (merged into components)
- Remove `contents` field (derived from `location_id` queries)
- Add `version` field for optimistic locking
- Add `@type entity_type` to include all types: `:room | :npc | :item | :exit | :character | :quest | :dialogue | :zone | :storyline | :skill | :recipe | :resource | :status | :system | :script`

```elixir
defstruct [
  :id, :type, :key, :prototype_key,
  :short_desc, :long_desc, :extra_desc, :primary_keyword, :mood,
  :location_id,
  :account_id,        # only for character entities (indexed for login)
  is_prototype: false,
  version: 1,
  keywords: [],
  components: %{},    # ALL game data: combatant, locks, tick config, etc.
  behaviors: [],
  tags: [],           # loaded from entity_tags join table, kept in memory as list
  scripts: %{},       # event_name => code string (flat map)
  metadata: %{}       # system bookkeeping, parent_key provenance
]

# Constructor: centralizes defaults and validation
def new(attrs) do
  %Entity{
    id: attrs[:id] || Ecto.UUID.generate(),
    type: attrs[:type] || raise(ArgumentError, "type required"),
    version: 1,
    is_prototype: attrs[:is_prototype] || false,
    components: attrs[:components] || %{},
    tags: attrs[:tags] || [],
    metadata: attrs[:metadata] || %{}
  }
  |> struct!(Map.drop(attrs, [:id, :type, :is_prototype, :components, :tags, :metadata]))
end

# Named snapshot for rollback (Elixir structs are immutable — this documents intent)
def snapshot(entity), do: entity
```

Note: `tags` is stored in the `entity_tags` join table but loaded into the struct as a list on read. The `Entities` API handles the join table transparently — callers work with `entity.tags` as a simple list.

#### Step 1.3: New EntitySchema

**File:** `lib/loka/engine/schema/entity_schema.ex` — evolve existing

Changes:
- Points at `entities` table (old table dropped and recreated)
- Remove `data` column mapping
- Add `from_entity/1` that includes ALL fields (currently excludes attributes)
- Add `to_entity/1` that hydrates Entity struct from schema

#### Step 1.4: EntityCache — DEFERRED to Post-MVP

EntityCache (transparent ETS read-through cache) is deferred. Direct DB queries with indexes are fast enough for MVP. The `Entities.find/1` API is designed so a cache can be added transparently later without changing callers.

#### Step 1.5: Evolve Entities API

**File:** `lib/loka/engine/entities.ex` — evolve existing

Implement the unified API from Section 7:
- `find/1` — unified read entry point (replaces all previous query/get functions)
- `find_many/1`, `find_many/2` — batch reads
- `save/1`, `save_batch/1`, `delete/1`, `update/2` — write operations
- `add_tag/2`, `remove_tag/2`, `get_tags/1` — tag operations (immediate DB writes)

#### Step 1.6: Tests

**New file:** `test/loka/engine/entities_v2_test.exs`
- CRUD operations on new schema
- Query operations (type, location, tags, components)
- Cache hit/miss/invalidation
- Prototype uniqueness constraint

#### Files Modified/Created (Phase 1):
```
CREATE: priv/repo/migrations/TIMESTAMP_create_unified_entities.exs  (entities + entity_tags + entity_log)
MODIFY: lib/loka/engine/entity.ex                                    (add new/1, snapshot/1, remove locks/parent_key)
MODIFY: lib/loka/engine/schema/entity_schema.ex
CREATE: lib/loka/engine/schema/entity_tag_schema.ex
CREATE: lib/loka/engine/schema/entity_log_schema.ex
MODIFY: lib/loka/engine/entities.ex
CREATE: test/loka/engine/entities_v2_test.exs
```

### Phase 2: EntitySeeder (YAML → DB)

**Goal:** YAML → DB seeding with inheritance resolution, replacing TypedObject.Loader. This phase comes before EntityServer because you need data in the DB to test the EntityServer loading from it.

#### Step 2.1: EntitySeeder Module

**New file:** `lib/loka/engine/entity_seeder.ex`

- Extract `resolve_inheritance/1` from TypedObject.Loader (topological sort + deep merge)
- Phased seeding: non-located → rooms → exits → NPCs/items → system entities
- Idempotent: `INSERT IF NOT EXISTS` by key+type for prototypes
- Resolves key → UUID references at seed time
- Conflict resolution rules with `edited_at` detection (see Section 8)
- Writes tags to `entity_tags` join table alongside entity inserts

#### Step 2.2: YAML Parsing Adaptation

EntitySeeder reuses TypedObject's YAML parsing but maps fields to the new schema:
- `data["objectives"]` → `components["quest"]["objectives"]`
- `data["rewards"]` → `components["quest"]["rewards"]`
- `data["exits"]` → creates exit entities
- `data["spawns"]` → `components["room"]["spawns"]`
- Freeform fields → `components["custom"][field]`

#### Step 2.3: Verification

Verify seeded entity counts and log any skipped/conflicted entries. System entities tagged `auto_start` are seeded to DB here but NOT started — they need behavior dispatch from Phase 3.

**Boot time estimate:** ~286 YAML files creating ~500-1400 entities. At ~1ms per insert, first boot takes 0.5-1.5 seconds. Subsequent boots (idempotent skip) are faster.

#### Files Modified/Created (Phase 2):
```
CREATE: lib/loka/engine/entity_seeder.ex
MODIFY: lib/loka/application.ex (replace TypedObject.Loader with EntitySeeder GenServer)
CREATE: test/loka/engine/entity_seeder_test.exs
```

### Phase 3: EntityServer Evolution

**Goal:** EntityServer works with new schema, supports force_save, reload, behavior dispatch, snapshot rollback.

#### Step 3.1: EntityServer Changes

**File:** `lib/loka/engine/entity_server.ex`

- Add `force_save: true` option to `update/2`
- Add `:reload` message handler (re-reads entity from DB)
- Add `dispatch_event/3` with snapshot rollback pattern (try/catch around behavior chain)
- Remove `data` field references
- Add cache invalidation on save
- Add tags loaded from `entity_tags` on init

#### Step 3.2: EntityRegistry Changes

**File:** `lib/loka/engine/entity_registry.ex`

- `get_or_start/1` loads from new `entities` table
- Add `save_all_dirty/0` for graceful shutdown

#### Step 3.3: EntityBehavior Callback Module

**New file:** `lib/loka/engine/entity_behavior.ex`

```elixir
defmodule Loka.Engine.EntityBehavior do
  @callback on_init(entity :: Entity.t()) :: {:ok, Entity.t()}
  @callback on_tick(entity :: Entity.t()) :: {:ok, Entity.t()}
  @callback on_event(entity :: Entity.t(), event_name :: atom(), payload :: map()) ::
    {:ok, Entity.t()} | {:ok, Entity.t(), map()} | {:halt, Entity.t()}
  @callback on_terminate(entity :: Entity.t(), reason :: term()) :: :ok

  @optional_callbacks [on_init: 1, on_tick: 1, on_event: 3, on_terminate: 2]
end
```

**No `on_save` callback** — saves are infrastructure, not game logic (see Decision 6).
**`on_event/3`** — separate event_name and payload for clean pattern matching (see Decision 6 update).
**`on_terminate/2`** — volatile state accessible via `EntityServer.Volatile` helpers (see Section 27).

#### Step 3.4: System Entity Infrastructure

**New files:**

```
CREATE: lib/loka/engine/system_supervisor.ex          (DynamicSupervisor for system entities, max_restarts: 5)
CREATE: lib/loka/engine/entity_server/volatile.ex     (Process dictionary helpers for transient state)
```

#### Step 3.5: Rewrite V1 Behaviors to EntityBehavior Interface

The 8 existing V1 behavior modules in `lib/loka/behaviors/` implement `Loka.Behaviors.Base` callbacks. Rewrite them to implement the new `EntityBehavior` callbacks:

- `init/1` → `on_init/1`
- `act/1` → `on_tick/2`
- `react/2` → `on_event/3`

The `Base` module is deleted (replaced by `EntityBehavior` in engine). Logic is preserved but callback signatures change. See Tier 2 Addendum in Section 37 for the complete list.

#### Files Modified/Created (Phase 3):
```
MODIFY: lib/loka/engine/entity_server.ex
MODIFY: lib/loka/engine/entity_registry.ex
CREATE: lib/loka/engine/entity_behavior.ex
CREATE: lib/loka/engine/system_supervisor.ex
CREATE: lib/loka/engine/entity_server/volatile.ex
REWRITE: lib/loka/behaviors/*.ex (8 modules — V1 Base callbacks → V2 EntityBehavior)
DELETE: lib/loka/behaviors/base.ex (replaced by EntityBehavior)
MODIFY: test/loka/engine/entity_server_test.exs
MODIFY: test/loka/engine/entity_registry_test.exs
CREATE: test/loka/behaviors/*_test.exs (behavior unit tests — Pattern F)
```

### Phase 4: Player Migration

**Goal:** GameState fields → character entity components.

#### Step 4.1: Data Migration

**New file:** `priv/repo/migrations/TIMESTAMP_migrate_players_to_entities.exs`

Reads each `player_game_states` row and creates a character entity:
```elixir
components = %{
  # NOTE: account_id is a top-level indexed column on the entity, NOT in components
  "player" => %{"settings" => gs.settings},
  "combatant" => %{"health" => gs.health["current"], "max_health" => gs.health["max"]},
  "stats" => gs.stats,
  "quest_progress" => gs.quests,
  "resources" => gs.resources,
  "skills" => gs.skills,
  "equipment" => gs.equipment
}
# Entity is created with: account_id: gs.player_id (top-level column)
```

Inventory items: set `location_id` = character entity ID for each item UUID in `gs.inventory`.

#### Step 4.2: Update Login/Logout

**Files:** `lib/loka_web/channels/game_channel.ex`, `lib/loka/session/server.ex`

- Login: `Entities.find(account_id: player.id)` (uses indexed `account_id` column)
- Start EntityServer for character
- Remove all `GameState.get/set` calls

#### Step 4.3: Update All GameState Consumers

Search for all `GameState.` calls and replace with `Entities` API + component accessors.

Major consumers:
- `game_channel.ex` — room display, movement, commands
- `session/server.ex` — state management
- `framework/quest/progress.ex` — quest state
- `framework/inventory.ex` — inventory operations
- `framework/combat.ex` — health/stats
- `framework/progression.ex` — XP/levels

#### Files Modified/Created (Phase 4):
```
CREATE: priv/repo/migrations/TIMESTAMP_migrate_players_to_entities.exs
MODIFY: lib/loka_web/channels/game_channel.ex (~50 GameState refs)
MODIFY: lib/loka/session/server.ex
MODIFY: lib/loka/framework/player/game_state.ex → DELETE
MODIFY: lib/loka/framework/quest/progress.ex
MODIFY: lib/loka/framework/inventory.ex
MODIFY: lib/loka/framework/combat.ex
MODIFY: lib/loka/framework/progression.ex
DELETE: lib/loka/framework/player/game_state.ex
DELETE: priv/repo/migrations/*create_player_game_states*
```

### Phase 5: Content Migration

**Goal:** Quest, dialogue, zone, etc. → entities table.

**Note:** Content migration (updating Content.Quest, Content.Dialogue) and Actions migration (updating PlayerGameState refs) are independent — they can proceed in parallel since content modules don't reference GameState.

#### Step 5.1: EntitySeeder handles content types

EntitySeeder already seeds all types in Phase 3. This phase updates consumers.

#### Step 5.2: Evolve Content Modules

Each `Content.*` module changes its backend:

```elixir
# Before
def get(key), do: TypedObject.Loader.get(key)

# After (each Content module knows its type)
def get(key), do: Entities.find(key: key, type: :quest)  # type-scoped
```

#### Step 5.3: Remove framework registries

Delete 14 registry modules (listed in Section 15). Update all callers to use `Entities.find()`.

#### Step 5.4: Update Game Actions Layer

The 11 modules in `lib/loka/game/` contain ~25 `PlayerGameState.update_state` calls. Each needs the same mechanical swap as `game_channel.ex`. See Tier 2 Addendum in Section 37 for the full list.

#### Step 5.5: Update Mechanics Layer

The 8 modules in `lib/loka/mechanics/` are mostly pure math. Only `stats.ex`, `character_resources.ex`, `combat_stats.ex`, and `check.ex` need `GameState` → `get_component` swaps. The rest (`cost.ex`, `damage.ex`, `damage_types.ex`, `heal.ex`) are unchanged.

#### Files Modified/Created (Phase 5):
```
MODIFY: lib/loka/content/*.ex (12 files — change backend)
MODIFY: lib/loka/game/actions.ex + actions/*.ex (11 files — swap GameState → entity operations)
MODIFY: lib/loka/mechanics/stats.ex              (swap GameState stat reads → get_component)
MODIFY: lib/loka/mechanics/character_resources.ex (swap GameState → Components.Resources)
MODIFY: lib/loka/mechanics/combat_stats.ex       (swap GameState → Components.Combatant + Stats)
MODIFY: lib/loka/mechanics/check.ex              (swap stat reads → get_component)
DELETE: lib/loka/framework/quest/quest_registry.ex
DELETE: lib/loka/framework/quest/objective_registry.ex
DELETE: lib/loka/framework/quest/chain_registry.ex
DELETE: lib/loka/framework/storyline/storyline_registry.ex
DELETE: lib/loka/framework/resources/resource_registry.ex
DELETE: lib/loka/framework/skills/skill_registry.ex
DELETE: lib/loka/framework/skills/binary_skill_registry.ex
DELETE: lib/loka/framework/status/status_registry.ex
DELETE: lib/loka/framework/crafting/crafting_registry.ex
DELETE: lib/loka/framework/gathering/gathering_registry.ex
DELETE: lib/loka/framework/registry_base.ex
DELETE: lib/loka/engine/zone_loader.ex
DELETE: lib/loka/engine/zone_registry.ex
```

### Phase 6: Cleanup

**Goal:** Delete old code, simplify everything, create export task.

#### Step 6.0: One-Time V1 → V2 YAML Conversion

Before Phase 1, run `mix loka.convert_yaml` to convert all YAML files to V2 format. Commit the results. Delete the conversion task. This ensures the EntitySeeder only handles V2 format.

#### Step 6.1: Delete Old Systems

```
DELETE: lib/loka/engine/typed_object.ex
DELETE: lib/loka/engine/typed_object/loader.ex
DELETE: lib/loka/engine/typed_object/registry.ex
DELETE: lib/loka/engine/typed_object/schema.ex
DELETE: lib/loka/engine/schema/entity_attribute.ex
DELETE: lib/loka/engine/plugin.ex
DELETE: lib/loka/engine/plugin_loader.ex
DELETE: lib/loka/engine/plugin_supervisor.ex
DELETE: lib/loka/plugins/ (entire directory)
DELETE: test/support/typed_object_sandbox.ex
DELETE: test/support/test_cleanup.ex (simplify — no more YAML pollution)
```

#### Step 6.2: Simplify RoomManager / Builder / World Builder Infrastructure

Remove ALL dual-store sync code from builder commands. Single write path:
1. Update entity via EntityServer
2. EntityServer auto-saves to DB
3. Done. No YAML sync, no ETS sync, no dual-store.

This also applies to the 16 `world_builder/` manager modules (see Tier 2 Addendum in Section 37). The `tool_executor.ex` (1,776 LOC) is the largest module and benefits from splitting into ~10 domain modules during the V2 rewrite.

#### Step 6.3: Create Export Task

**New file:** `lib/mix/tasks/loka.export.ex`

```elixir
mix loka.export                           # all prototypes
mix loka.export --type quest,dialogue     # specific types
mix loka.export --modified-since 2026-02-10
```

Reads entities from DB, writes YAML files to `priv/world/`.

#### Step 6.4: Verify Clean Schema

Old tables (`entity_attributes`, `player_game_states`) were already dropped in Phase 1 migration. Verify no orphaned references remain. Run `mix loka.validate` to confirm schema integrity.

---

## 17. Component Accessor Macro Design

### The `use Loka.Component` Macro

> **Decision 34: Start without the macro.** Write the first 10 component modules as plain modules with explicit functions. The boilerplate is ~15 lines per module (`get/1`, `has?/1`, `put/2`, `update/3`, `component_key/0`). Plain modules are easier to debug (every function is visible, grep-able, click-through-able), easier to customize (no fighting the macro's assumptions), and don't add compile-time metaprogramming complexity. If the boilerplate proves painful after 10+ modules, extract the macro. You can always add abstraction; removing it is harder.

If boilerplate proves painful after 10+ modules, extract a `use Loka.Component, key: "combatant", schema: [health: [type: :integer, default: 0], ...]` macro that generates `get/1`, `has?/1`, `put/2`, `update/3`, `component_key/0`, and per-field accessors (`health/1`, `set_health/2`). The plain module examples below show the expected API surface.

### Example: Combatant Component

```elixir
defmodule Loka.Components.Combatant do
  @component_key "combatant"

  # Standard boilerplate (same for every component — macro candidate if >10 modules):
  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)
  def put(entity, data) when is_map(data), do: %{entity | components: Map.put(entity.components, @component_key, data)}
  def component_key, do: @component_key

  # Field accessors:
  def health(entity), do: get_in(entity.components, [@component_key, "health"]) || 0
  def max_health(entity), do: get_in(entity.components, [@component_key, "max_health"]) || 0
  def attack(entity), do: get_in(entity.components, [@component_key, "attack"]) || 0
  def defense(entity), do: get_in(entity.components, [@component_key, "defense"]) || 0

  def set_health(entity, val) when is_integer(val) and val >= 0 do
    capped = min(val, max_health(entity) || val)
    comp = Map.get(entity.components, @component_key, %{})
    %{entity | components: Map.put(entity.components, @component_key, Map.put(comp, "health", capped))}
  end

  # Domain logic:

  def alive?(entity), do: health(entity) > 0

  def apply_damage(entity, amount) when is_integer(amount) and amount >= 0 do
    new_hp = max(0, health(entity) - amount)
    set_health(entity, new_hp)
  end

  def heal(entity, amount) when is_integer(amount) and amount >= 0 do
    new_hp = min(health(entity) + amount, max_health(entity))
    set_health(entity, new_hp)
  end

  def health_percent(entity) do
    max_hp = max_health(entity)
    if max_hp > 0, do: health(entity) / max_hp * 100, else: 0
  end
end
```

### Example: Player Component

```elixir
defmodule Loka.Components.Player do
  @component_key "player"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  # account_id is a top-level indexed column on Entity, not in this component
  def settings(entity), do: get_in(entity.components, [@component_key, "settings"]) || %{}
  def character_name(entity), do: get_in(entity.components, [@component_key, "character_name"])

  # NOTE: online? check lives in Session module, not here.
  # Component modules are pure data accessors — they don't call session/infrastructure.
  # Use Loka.Session.Registry.online?(entity.account_id) instead.
end
```

### Example: QuestDef Component

```elixir
defmodule Loka.Components.QuestDef do
  @component_key "quest"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def objectives(entity), do: get_in(entity.components, [@component_key, "objectives"]) || []
  def rewards(entity), do: get_in(entity.components, [@component_key, "rewards"]) || %{}
  def giver(entity), do: get_in(entity.components, [@component_key, "giver"])
  def level_requirement(entity), do: get_in(entity.components, [@component_key, "level_requirement"]) || 1
end
```

### Full Component Module List

| Module | Key | Entity Types | Notes |
|--------|-----|-------------|-------|
| `Components.Combatant` | `"combatant"` | NPCs, characters | Health, damage, defense |
| `Components.Player` | `"player"` | Characters | Account link, settings |
| `Components.Stats` | `"stats"` | Characters, NPCs | str, dex, sta, level, xp |
| `Components.QuestProgress` | `"quest_progress"` | Characters | Active/completed/failed |
| `Components.Skills` | `"skills"` | Characters | Learned skill list |
| `Components.Resources` | `"resources"` | Characters | Gold, XP, mana |
| `Components.Equipment` | `"equipment"` | Characters | Slot → entity UUID map |
| `Components.Room` | `"room"` | Rooms | Spawns config |
| `Components.Coordinates` | `"coordinates"` | Rooms | x, y, z |
| `Components.Exit` | `"exit"` | Exits | Direction, destination |
| `Components.Physical` | `"physical"` | Items | Weight, stackable |
| `Components.Weapon` | `"weapon"` | Items | Damage, type, speed |
| `Components.Armor` | `"armor"` | Items | Defense, type |
| `Components.Container` | `"container"` | Items, rooms | Capacity, locked |
| `Components.QuestDef` | `"quest"` | Quests | Objectives, rewards |
| `Components.DialogueTree` | `"dialogue_tree"` | Dialogues, NPCs | Nodes, options |
| `Components.ZoneConfig` | `"zone_config"` | Zones | Level range, theme |
| `Components.SkillDef` | `"skill_def"` | Skills | Cooldown, cost, effects |
| `Components.RecipeDef` | `"recipe_def"` | Recipes | Ingredients, output |
| `Components.Emotes` | `"emotes"` | NPCs | Idle/combat/greeting |
| `Components.Spawnable` | `"spawnable"` | NPCs, items | Respawn time, max |
| `Components.AmbientMessages` | `"ambient_messages"` | Rooms | Day/night messages |
| `Components.Tick` | `"tick"` | Any ticking entity | Tick interval (single source of truth) |
| `Components.Service` | `"service"` | System entities | Boot priority |
| `Components.Locks` | `"locks"` | Any locked entity | Access control rules (use, enter, open) |

### Rules

1. **Game code calls accessor modules** — never `entity.components["combatant"]["health"]`
2. **Accessor modules validate on write** — type checks, range capping
3. **Builder/admin tools MAY access `components` directly** — they operate on raw data
4. **Each module is the single authority on its component's shape**

---

## 18. Script Bindings API (Complete)

Validated against the current V1 bindings (70+ functions in `bindings.ex`). The V2 bindings align with the unified entity model.

### Changes from V1 to V2

| V1 Binding | V2 Change | Reason |
|-----------|-----------|--------|
| `player` context variable | `self()` = script owner; `event().speaker` / `event().user` = the player who triggered it | Players are entities, accessed from event payload |
| `has_item?(key)` | `has_item?(entity, key)` | Entity-parametric, works for any entity |
| `quest_active?(id)` | `quest_active?(entity, id)` | Entity-parametric |
| `get_stat(name)` | `get_component(entity, "stats", name)` | Generic component access |
| `give_item(key)` | `spawn_entity(key, location: entity)` | Items are entities with `location_id` |
| `remove_item(key)` | `despawn(item)` | Or move to null location |
| No `get_component` | Added | Generic component read |
| No `set_component` | Added | Generic component write |
| `query()`, `get_entity()`, etc. | `Entities.find()` | Same API as engine — one function everywhere |

### Complete V2 Bindings

Scripts call the same `Entities.find` as engine and framework code. No wrapper layer.

```elixir
# ── Self & Context ──
self()                                    # current entity
event()                                   # triggering event (in event handlers)

# ── Entity Queries (same API as engine) ──
Entities.find(uuid)                       # by UUID
Entities.find(key: "sneak", type: :skill) # by key+type (type ALWAYS required for keys)
Entities.find(location_id: id)            # all entities at location
Entities.find(location_id: id, type: :npc, tags: ["hostile"])  # filtered
Entities.find(tags: ["auto_start"])       # by tag
Entities.find(component: {"combatant.health", {:lt, 10}})  # by component (slow)
# Returns {:ok, entity} for single-result queries (UUID, key+type, account_id)
# Returns [entities] for multi-result queries (location_id, tags, type, component)
get_location(entity)                      # parent location entity (sugar for find(entity.location_id))

# ── Room Query Sugar ──
# These are convenience wrappers around Entities.find for the most common pattern:
# "what's in my room?" Scripts can always use Entities.find directly instead.
entities_in_room()                        # Entities.find(location_id: self().location_id)
entities_in_room(type)                    # Entities.find(location_id: self().location_id, type: type)
players_in_room()                         # Entities.find(location_id: self().location_id, type: :character)
exits()                                   # Entities.find(location_id: self().location_id, type: :exit)
exit_to(direction)                        # exits() |> filter by direction component
find_by_keyword(keyword)                  # keyword match against room contents (not a DB query)
find_by_keyword(keyword, type)            # filtered by type

# ── Component Access ──
get_component(entity, component_key)      # read full component map
get_component(entity, component_key, field)  # read specific field
set_component(entity, component_key, data)   # write full component
update_component(entity, component_key, field, value)  # write specific field
has_component?(entity, component_key)     # check existence

# ── Room Mutations ──
create_exit(direction, dest_key)          # create exit entity in current room
remove_exit(direction)                    # remove exit entity from current room

# ── Combat / Health ──
apply_damage(target, amount)              # queue damage action
apply_damage(target, amount, type)        # typed damage
heal(target, amount)                      # queue heal
kill(target)                              # trigger death + respawn
alive?(entity)                            # health > 0

# ── Status Effects ──
apply_status(target, key)                 # apply status effect
apply_status(target, key, duration: n)    # with duration
remove_status(target, key)                # remove status
has_status?(target, key)                  # check status

# ── Resources ──
grant_resource(entity, key, amount)       # add gold, xp, etc.
consume_resource(entity, key, amount)     # subtract
has_resource?(entity, key, amount)        # can afford?
get_resource(entity, key)                 # current value

# ── Movement ──
move_entity(entity, destination_id)       # standard move (fires events)
teleport(entity, room_key)               # instant move (no events)

# ── Spawning ──
spawn_entity(prototype_key)               # spawn at self's location
spawn_entity(prototype_key, location: id) # spawn at specific location
despawn(entity)                           # remove entity

# ── Dialogue ──
start_dialogue(target, dialogue_key)      # initiate dialogue tree with target entity

# ── Entity Properties ──
is_player?(entity)                        # convenience: entity.type == :character && has_component?("player")
prototype_key(entity)                     # which prototype this instance was spawned from (nil for prototypes)
mood(entity)                              # get mood (nil if unset)
set_mood(entity, mood)                    # set mood (affects description display)
short_desc(entity)                        # get display name
set_short_desc(entity, text)              # change display name at runtime
long_desc(entity)                         # get description text
set_long_desc(entity, text)              # change description at runtime
extra_desc(entity)                        # get examination text
set_extra_desc(entity, text)             # change examination text at runtime

# ── Equipment / Inventory ──
equip(entity, item_id, slot)              # equip item to slot
unequip(entity, slot)                     # unequip slot
equipped?(entity, slot)                   # check if slot has item
inventory_full?(entity)                   # check container capacity (uses container component)

# ── Communication ──
say(text)                                 # say in current room
emote(text)                               # emote in current room
message(target, text)                     # private message to entity
broadcast(location, text)                 # to everyone at location
broadcast_to_zone(zone, text)             # to all rooms in zone
broadcast_global(text)                    # server-wide

# ── Tags ──
add_tag(entity, tag)                      # add tag
remove_tag(entity, tag)                   # remove tag
has_tag?(entity, tag)                     # check tag
get_tags(entity)                          # list all tags (needed for tag iteration)

# ── Flags (player-specific) ──
has_flag?(entity, flag)                   # check persistent flag
get_flag(entity, flag)                    # get flag value
set_flag(entity, flag, value)             # set persistent flag

# ── Quest / Progression ──
quest_active?(entity, quest_key)          # check quest state
quest_complete?(entity, quest_key)        # check completion
complete_objective(entity, quest_key, obj_id)  # mark objective done
grant_quest(entity, quest_key)            # start quest
grant_xp(entity, amount)                 # add experience

# ── Cooldowns ──
set_cooldown(key, seconds)                # start cooldown
on_cooldown?(key)                         # check cooldown
cooldown_remaining(key)                   # seconds left

# ── Timers ──
set_timer(name, seconds, event_name)      # trigger event later
cancel_timer(name)                        # cancel scheduled timer

# ── Script References ──
run_script(script_key, args)              # execute a script entity by key with args
# Enables shared script libraries: quest reward scripts, utility functions, etc.
# Script entities (type: :script) store reusable code that other scripts reference.

# ── Events ──
emit(event_name)                          # emit event on self (runs through own behavior/script pipeline)
emit(event_name, payload)                 # with payload
emit(target, event_name, payload)         # emit event on ANOTHER entity (cross-entity, queued)
# Cross-entity emit replaces V1 send_signal — same mechanism, but dispatches a named event
# through the target's full behavior/script pipeline (not a single generic handler).
# Example: system entity emits :on_fish_caught to a player, player's on_fish_caught script runs.

# ── Behavior State (persists across executions) ──
get_state(key)                            # read behavior state
get_state(key, default)                   # with default
set_state(key, value)                     # write behavior state

# ── Randomness ──
random()                                  # 0.0 to 1.0
random(min, max)                          # integer range
pick_random(list)                         # random element
chance?(percent)                          # true N% of the time
roll(dice_string)                         # "2d6+3" format
weighted_random(list_with_weights)        # weighted selection

# ── Time ──
time_of_day()                             # :dawn, :morning, :noon, etc.
current_hour()                            # 0..23
current_season()                          # :spring, :summer, etc.

# ── Room State ──
set_room_attr(key, value)                 # modify room component
lock_exit(direction)                      # lock exit
unlock_exit(direction)                    # unlock exit

# ── String/List Utilities ──
contains?(text, substring)               # string contains
downcase(text)                            # lowercase
upcase(text)                              # uppercase
any?(list, func)                          # any match
all?(list, func)                          # all match
find(list, func)                          # first match
length(list)                              # list length
first(list)                               # first element
last(list)                                # last element

# ── Control Flow ──
# These are special return values from scripts that dispatch_event interprets.
# Scripts end with one of these; if omitted, :continue is the default.
deny()                                    # cancel the triggering action (on_before_* events)
handled()                                 # event was fully handled, skip remaining handlers
continue()                                # continue to next handler (default if no explicit return)
#
# Pipeline mapping (how these translate to dispatch_event returns):
#   deny()     → {:halt, entity} → caller receives {:halted, state}
#   handled()  → {:halt, entity} → caller receives {:halted, state}
#   continue() → {:ok, entity}   → caller receives {:ok, state}
#
# Both deny() and handled() produce {:halt, entity} in the pipeline.
# The caller interprets {:halted, state} based on event type:
#   - For on_before_* events: {:halted, ...} means the action is CANCELLED
#   - For all other events: {:halted, ...} means the chain stopped (action already happened)
#
# deny() is semantically meaningful only in before-events.
# Using deny() in a non-before event has the same effect as handled().
# NOTE: No allow() — halts are final. To prevent denial, order non-denying behaviors first.

# ── Debugging ──
log(message)                              # debug output
```

### Rate Limits (per script execution)

**Enforcement:** Rate limits are enforced in the bindings module. Each binding function increments a counter in the script execution context (a map threaded through the sandbox). When a limit is reached, the binding returns `{:error, :rate_limited}` and the script receives a clear error message.

| Category | Limit | Rationale |
|----------|-------|-----------|
| **Queries** | **10 calls** | Prevent DB hammering |
| **Query results** | **100 entities per query** | Prevent memory exhaustion |
| Spawns | 10 | Prevent entity flooding |
| Despawns | 20 | Allow bulk cleanup |
| Messages | 50 | Prevent chat spam |
| Damage total | 1000 | Prevent one-shot kills on bosses |
| Teleports | 5 | Prevent movement spam |
| Room changes | 10 | Prevent room state thrashing |
| Status effects | 20 | Prevent effect stacking abuse |
| Timers | 5 | Prevent timer flooding |
| Cross-entity emits | 10 | Prevent event storms |
| Room creates | 3 | Prevent dynamic room spam |
| **Entity modifications** | **50** | Prevent mass state corruption |
| **Execution time** | **100ms soft / 1s hard** | Warn at soft, kill at hard |

---

## 19. YAML Format Changes

### Design Principle

YAML format changes are **minimal**. The EntitySeeder handles mapping V1 YAML fields to V2 component-based storage. Existing YAML content works with minor adaptations.

### V1 → V2 Field Mapping

#### Entity YAML (rooms, NPCs, items, exits)

**Minimal changes.** Most fields map directly:

```yaml
# V1 (current)                          # V2 (unchanged or trivial rename)
key: village_elder                       key: village_elder
type: npc                                type: npc
parent: base_friendly_npc               parent_key: base_friendly_npc  # "parent" accepted as alias
short_desc: "Village Elder"              short_desc: "Village Elder"
long_desc: "An elderly woman..."         long_desc: "An elderly woman..."
extra_desc: |                            extra_desc: |
  Deep wrinkles...                         Deep wrinkles...
keywords: [elder, woman]                 keywords: [elder, woman]
components:                              components:
  combatant:                               combatant:
    health: 80                               health: 80
tags: [npc, friendly]                    tags: [npc, friendly]
scripts:                                 scripts:
  on_look: elder_greeting                  on_look: elder_greeting
```

**What changes:**
- `parent:` / `parent_key:` in YAML → stored as `metadata["parent_key"]` in DB (not a top-level column)
- Top-level `exits:` on rooms → seeder creates exit entities
- Top-level `spawns:` on rooms → moved to `components.room.spawns`

#### Quest YAML

**Moderate changes.** Top-level quest fields move under `components.quest`:

```yaml
# V1 (current)
id: main_sleeping_master              # was "id", now "key"
name: "The Sleeping Master"
description: |
  Lama Tenzin...
giver: abbot_jampa
type: main
objectives:
  - id: talk_abbot
    type: talk
    target_id: abbot_jampa
    description: "Speak with Abbot Jampa"
rewards:
  xp: 100
  items: [cave_entrance_key]

# V2 (adapted)
key: main_sleeping_master
type: quest
short_desc: "The Sleeping Master"
long_desc: |
  Lama Tenzin...
tags: [quest, main, act:1]
components:
  quest:
    giver: abbot_jampa
    level_requirement: 1
    objectives:
      - id: talk_abbot
        type: talk
        target_id: abbot_jampa
        description: "Speak with Abbot Jampa"
    rewards:
      xp: 100
      items: [cave_entrance_key]
    unlocks: [main_three_trials]
  journal:
    entries:
      accepted: "The Abbot has asked me..."
      completed: "Novice Pema wishes to join me."
```

**EntitySeeder mapping for quests:**
```elixir
# V1 top-level fields → V2 components
%{
  "name" => short_desc,
  "description" => long_desc,
  "giver" => components["quest"]["giver"],
  "objectives" => components["quest"]["objectives"],
  "rewards" => components["quest"]["rewards"],
  "type" => tags (e.g., "main" → tag "main"),
  "act" => tags (e.g., 1 → tag "act:1"),
  "journal_entries" => components["journal"]["entries"],
  "unlocks" => components["quest"]["unlocks"],
  "level_requirement" => components["quest"]["level_requirement"]
}
```

#### Dialogue YAML

Dialogue trees move under `components.dialogue_tree`:

```yaml
# V2
key: village_elder_dialogue
type: dialogue
short_desc: "Village Elder Dialogue"
components:
  dialogue_tree:
    start_node: greeting
    nodes:
      greeting:
        text: "Welcome, traveler."
        options:
          - text: "Tell me about the village"
            next: village_info
          - text: "Farewell"
            action: end
```

#### Skill YAML

```yaml
# V2 — scripts are flat: event_name → code string
key: sneak
type: skill
short_desc: "Sneak"
long_desc: "Move silently through shadows."
tags: [skill, utility, binary]
components:
  skill_def:
    category: utility
    cost: 1
    requirements:
      level: 3
    effects:
      stealth_bonus: 10
scripts:
  on_use: |
    if on_cooldown?("sneak") then
      message(self(), "You're not ready to sneak again yet.")
      deny()
    else
      set_cooldown("sneak", 30)
      apply_status(self(), "sneaking", duration: 60)
      message(self(), "You blend into the shadows.")
    end
```

#### System Entity YAML

```yaml
# V2 — tick interval in components, scripts are flat code strings
key: torch_flicker
type: system
short_desc: "Torch Flicker System"
tags: [auto_start]
components:
  tick:
    interval: 30
scripts:
  on_tick: |
    for room <- Entities.find(type: :room, tags: ["has_torches"]) do
      broadcast(room, pick_random([
        "A torch sputters and crackles.",
        "Shadows dance along the walls.",
        "The torchlight wavers briefly."
      ]))
    end
```

### One-Time V1 → V2 YAML Conversion

Instead of a backward-compatible seeder that handles two formats forever, run a **one-time conversion task** that transforms all YAML files to V2 format:

```bash
mix loka.convert_yaml    # converts all YAML files in priv/world/ to V2 format
```

The conversion task:
1. Reads each YAML file
2. Maps V1 fields to V2 structure (quest fields → components, exits → separate entities, etc.)
3. **Transforms inline script code** — rewrites V1 binding calls to V2 API (see below)
4. Writes the converted file back to the same path
5. Outputs a summary of changes (including scripts that couldn't be auto-converted)

After running, commit the converted files. The task itself can then be deleted — it's a one-time migration, not production code.

#### Script Code Transformation Rules

V1 and V2 have different script binding signatures. The conversion task must transform inline script code blocks in YAML files. These are mechanical text replacements applied to every `scripts:` code block:

| V1 Binding | V2 Replacement | Notes |
|-----------|---------------|-------|
| `entity` context var | `self()` | Script owner entity |
| `player` / `player()` | `event().speaker` or `event().user` | Context-dependent — `on_talk` uses `speaker`, `on_use` uses `user` |
| `room()` | `get_location(self())` | Room is now an entity lookup, not a context variable |
| `has_item?(key)` | `has_item?(event().speaker, key)` | Now entity-parametric |
| `quest_active?(id)` | `quest_active?(event().speaker, id)` | Now entity-parametric |
| `quest_complete?(id)` | `quest_complete?(event().speaker, id)` | Now entity-parametric |
| `get_stat(name)` | `get_component(self(), "stats", name)` | Generic component access |
| `give_item(key)` | `spawn_entity(key, location: event().speaker)` | Items are entities with location_id |
| `remove_item(key)` | `despawn(find_by_keyword(key, :item))` | Find then remove |
| `start_quest(id)` | `grant_quest(event().speaker, id)` | Renamed + entity-parametric |
| `spawn_at(key, location)` | `spawn_entity(key, location: location)` | Unified spawn API |
| `spawn_npc(key)` | `spawn_entity(key, location: self().location_id)` | Unified spawn API |
| `spawn_item(key)` | `spawn_entity(key, location: self().location_id)` | Unified spawn API |
| `damage(target, amount)` | `apply_damage(target, amount)` | Renamed for clarity |
| `apply_effect(target, key)` | `apply_status(target, key)` | Renamed: "effect" → "status" |
| `remove_effect(target, key)` | `remove_status(target, key)` | Renamed: "effect" → "status" |
| `announce_room(text)` | `broadcast(get_location(self()), text)` | Now uses explicit location |
| `after(seconds, event_name)` | `set_timer(name, seconds, event_name)` | Renamed + requires timer name |
| `pick(list)` | `pick_random(list)` | Renamed for clarity |
| `send_to(target, name, payload)` | `emit(target, name, payload)` | Renamed (Decision 68). V1 name was `send_to`, not `send_signal` |
| `count(list)` | `length(list)` | Renamed to avoid Enum collision |
| `get_behavior_state(key)` | `get_state(key)` | Shortened name |
| `set_behavior_state(key, value)` | `set_state(key, value)` | Shortened name |

#### Removed V1 Bindings

These V1 bindings have no direct V2 equivalent. The conversion task should flag scripts using these for manual review and log suggestions:

| V1 Binding | V2 Replacement | Notes |
|-----------|---------------|-------|
| `context` | `event()` | V1 `context` returned the raw event context; V2 `event()` is the structured event envelope. Scripts using `context.custom_field` need manual rewrite to `event().payload["custom_field"]` |
| `config` | `get_component(self(), "behavior_config")` | V1 injected behavior YAML config as `config`; V2 stores config in a component. Scripts using `config["key"]` → `get_component(self(), "behavior_config", "key")` |
| `quest_objective_done?(quest, obj)` | `get_component(entity, "quest_progress")` check | No convenience wrapper. Check `quest_progress.active[quest_key].objectives[obj_id]` manually |
| `get_skill(name)` | `get_component(self(), "skills", name)` | Subsumed by generic component access |
| `get_attribute(name)` | `get_component(self(), "stats", name)` | Subsumed by generic component access |
| `entity_present?(key)` | `Entities.find(location_id: self().location_id, key: key)` | Derivable from `Entities.find` — no convenience wrapper needed |
| `find_entities_by_tag(tag)` | `Entities.find(tags: [tag])` | Direct API usage — no wrapper needed (Decision 66) |
| `current_weather()` | System entity query | Weather is a system entity in V2. Use `Entities.find(key: "weather", type: :system)` + `get_component(weather, "weather", "current")` |
| `is_outdoor?()` | `get_component(get_location(self()), "room", "outdoor")` | Room property check via component |
| `is_dark?()` | Derive from `time_of_day()` + room `"outdoor"` property | No single function — combine time + room data |
| `create_room(opts)` | Removed from script API | Admin-only operation via builder commands. Scripts should not create rooms at runtime |
| `default()` | `continue()` | Same semantics — `continue()` is the V2 name |
| `allow()` | Removed (Decision 46) | Halts are final in V2. To prevent denial, order non-denying behaviors first |

**Unchanged bindings (~32):** All V1 bindings not in the tables above carry forward to V2 with the **same name and signature**. These include: `say`, `emote`, `message`, `has_flag?`, `get_flag`, `set_flag`, `complete_objective`, `despawn`, `move_entity`, `teleport`, `heal`, `set_room_attr`, `lock_exit`, `unlock_exit`, `set_cooldown`, `on_cooldown?`, `cooldown_remaining`, `emit`, `entities_in_room`, `players_in_room`, `time_of_day`, `current_hour`, `chance?`, `roll`, `random`, `contains?`, `downcase`, `upcase`, `any?`, `all?`, `find` (list), `first`, `last`, `log`, `deny`, `handled`, `continue`. The conversion task does NOT need to modify these — they work as-is in V2.

**Note on `find_entity/1`:** V1's `find_entity(criteria)` is replaced by `Entities.find(criteria)` in V2. This is a namespace change, not a removal — the conversion task should rewrite `find_entity(...)` calls to `Entities.find(...)`.

**YAML files using removed bindings:** Before running the conversion, grep all script blocks for these patterns to estimate manual fixup scope. Expected: `context` and `config` are the most common; `current_weather`/`is_outdoor?`/`is_dark?` appear only in weather/atmosphere scripts.

**Auto-conversion limitations:** Some V1 patterns can't be mechanically converted:
- Scripts that use `player` in complex expressions (e.g., `player.components["custom"]["x"]`) need manual review
- Scripts that rely on V1-specific context variables not present in V2
- Scripts calling functions that were removed (module-specific helpers)

The conversion task logs every script file and whether it was auto-converted or needs manual review. Target: >90% auto-converted, <10% manual fixup.

**Benefits over backward-compatible seeder:**
- Seeder handles ONE format (simpler, fewer bugs, faster boot)
- YAML files in git are always V2 (no ambiguity for contributors)
- The mapping logic doesn't live in production code
- `mix loka.export` outputs the same format the seeder reads

---

## 20. Testing Patterns for V2

### What Changes

| V1 Pattern | V2 Pattern | Why |
|-----------|-----------|-----|
| TypedObjectSandbox.checkout() | Not needed | No ETS registry to sandbox |
| TestCleanup.cleanup_*_files() | Not needed | No YAML files created in tests |
| Loader.reload() in on_exit | Not needed | No YAML loader to reload |
| Three-layer isolation | Single-layer (Ecto sandbox) | One store = one cleanup |
| entity_fixture → DB + ETS | entity_fixture → DB only | Unified store |

### V2 Test Support Modules

#### DataCase (evolved)

```elixir
defmodule Loka.DataCase do
  use ExUnit.CaseTemplate

  using do
    quote do
      alias Loka.Repo
      import Ecto
      import Ecto.Changeset
      import Ecto.Query
      import Loka.DataCase
    end
  end

  setup tags do
    pid = Ecto.Adapters.SQL.Sandbox.start_owner!(Loka.Repo, shared: not tags[:async])
    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(pid) end)

    # Allow infrastructure processes
    for name <- [Loka.Engine.EntityCache, Loka.Timers.Server] do
      if pid = Process.whereis(name) do
        Ecto.Adapters.SQL.Sandbox.allow(Loka.Repo, self(), pid)
      end
    end

    :ok
  end
end
```

**Removed:** TypedObjectSandbox.checkout(), no LayoutManager allow.

#### Entity Test Helpers

```elixir
defmodule Loka.EntityHelpers do
  @moduledoc "Test helpers for creating entities with components."
  alias Loka.Engine.Entities

  def create_room(attrs \\ %{}) do
    Entities.save(%Loka.Engine.Entity{
      id: Ecto.UUID.generate(),
      type: :room,
      key: "test_room_#{System.unique_integer([:positive])}",
      short_desc: "Test Room",
      is_prototype: false,
      components: %{}
    } |> struct!(attrs))
  end

  def create_npc(room_id, attrs \\ %{}) do
    Entities.save(%Loka.Engine.Entity{
      id: Ecto.UUID.generate(),
      type: :npc,
      key: "test_npc_#{System.unique_integer([:positive])}",
      short_desc: "Test NPC",
      location_id: room_id,
      is_prototype: false,
      components: %{
        "combatant" => %{"health" => 100, "max_health" => 100, "attack" => 10, "defense" => 5}
      }
    } |> struct!(attrs))
  end

  def create_character(room_id, player_id, attrs \\ %{}) do
    Entities.save(%Loka.Engine.Entity{
      id: Ecto.UUID.generate(),
      type: :character,
      key: "test_char_#{System.unique_integer([:positive])}",
      short_desc: "Test Character",
      location_id: room_id,
      account_id: player_id,      # top-level indexed column, NOT in components
      is_prototype: false,
      components: %{
        "player" => %{"settings" => %{}},
        "combatant" => %{"health" => 100, "max_health" => 100},
        "stats" => %{"str" => 10, "dex" => 10, "sta" => 10, "level" => 1},
        "quest_progress" => %{"active" => %{}, "completed" => [], "failed" => []},
        "resources" => %{"gold" => 0, "xp" => 0}
      }
    } |> struct!(attrs))
  end

  def create_quest_prototype(attrs \\ %{}) do
    Entities.save(%Loka.Engine.Entity{
      id: Ecto.UUID.generate(),
      type: :quest,
      key: "test_quest_#{System.unique_integer([:positive])}",
      short_desc: "Test Quest",
      is_prototype: true,
      components: %{
        "quest" => %{
          "objectives" => [%{"id" => "obj1", "type" => "talk", "target_id" => "npc1"}],
          "rewards" => %{"xp" => 50}
        }
      }
    } |> struct!(attrs))
  end
end
```

### Test Patterns

#### Pattern A: Component Logic Test

```elixir
defmodule Loka.Components.CombatantTest do
  use Loka.DataCase, async: true  # Can be async — no shared state!

  alias Loka.Components.Combatant
  import Loka.EntityHelpers

  test "apply_damage reduces health" do
    {:ok, room} = create_room()
    {:ok, npc} = create_npc(room.id, components: %{
      "combatant" => %{"health" => 50, "max_health" => 100, "attack" => 10, "defense" => 5}
    })

    updated = Combatant.apply_damage(npc, 20)
    assert Combatant.health(updated) == 30
    assert Combatant.alive?(updated)
  end

  test "heal caps at max_health" do
    entity = %Entity{components: %{
      "combatant" => %{"health" => 80, "max_health" => 100}
    }}

    updated = Combatant.heal(entity, 50)
    assert Combatant.health(updated) == 100
  end
end
```

**Key insight:** Component tests can be `async: true` because they operate on in-memory structs. Only tests that save to DB need sandbox isolation.

#### Pattern B: Script Test

```elixir
defmodule Loka.Engine.Script.V2Test do
  use Loka.DataCase, async: false

  alias Loka.Engine.Script.{Sandbox, ActionQueue}
  import Loka.EntityHelpers

  setup do
    {:ok, room} = create_room()
    {:ok, npc} = create_npc(room.id)
    ActionQueue.init()
    on_exit(fn -> ActionQueue.clear() end)
    {:ok, room: room, npc: npc}
  end

  test "script can query entities at location", %{room: room, npc: npc} do
    source = """
    entities = entities_in_room()
    count(entities)
    """

    entity_map = %{id: npc.id, location_id: room.id, type: :npc}
    {:ok, result, _actions} = Sandbox.execute(source, entity_map, %{})
    assert result >= 1
  end

  test "script can modify components via bindings", %{npc: npc} do
    source = """
    heal(self(), 20)
    :handled
    """

    entity_map = %{id: npc.id, components: npc.components}
    {:ok, :handled, actions} = Sandbox.execute(source, entity_map, %{})
    assert {:heal, %{amount: 20}} in actions
  end
end
```

#### Pattern C: EntityServer Integration Test

```elixir
defmodule Loka.Engine.EntityServerV2Test do
  use Loka.DataCase, async: false

  import Loka.EntityHelpers

  setup do
    {:ok, room} = create_room()
    {:ok, npc} = create_npc(room.id, components: %{
      "combatant" => %{"health" => 100, "max_health" => 100}
    })

    # Start isolated EntityServer
    test_id = System.unique_integer([:positive])
    registry_name = :"test_registry_#{test_id}"
    supervisor_name = :"test_supervisor_#{test_id}"

    {:ok, _} = Registry.start_link(keys: :unique, name: registry_name)
    {:ok, _} = DynamicSupervisor.start_link(strategy: :one_for_one, name: supervisor_name)

    {:ok, _pid} = Loka.Engine.EntityRegistry.get_or_start(npc.id,
      registry: registry_name, supervisor: supervisor_name)

    on_exit(fn ->
      # EntityServer saves on terminate
      if pid = Registry.lookup(registry_name, npc.id) |> List.first() do
        GenServer.stop(elem(pid, 0))
      end
    end)

    {:ok, npc: npc, room: room}
  end

  test "dispatch_event runs behavior then script", %{npc: npc} do
    EntityServer.dispatch_event(npc.id, :on_look, %{looker: "player-123"})
    # Verify behavior ran (check state change or event emission)
    {:ok, updated} = EntityServer.get(npc.id)
    # assertions...
  end
end
```

#### Pattern D: Seeder Test

```elixir
defmodule Loka.Engine.EntitySeederTest do
  use Loka.DataCase, async: false

  alias Loka.Engine.{EntitySeeder, Entities}

  test "seeding is idempotent" do
    yaml_data = [
      %{key: "test_skill", type: :skill, short_desc: "Test", components: %{
        "skill_def" => %{"cost" => 1}
      }}
    ]

    # Seed once
    EntitySeeder.seed_entities(yaml_data)
    {:ok, skill1} = Entities.find(key: "test_skill", type: :skill)

    # Seed again — should not duplicate
    EntitySeeder.seed_entities(yaml_data)
    {:ok, skill2} = Entities.find(key: "test_skill", type: :skill)

    assert skill1.id == skill2.id
  end

  test "inheritance resolution merges parent fields" do
    yaml_data = [
      %{key: "base_hostile", type: :npc, is_prototype: true,
        components: %{"combatant" => %{"attack" => 10, "defense" => 5}}},
      %{key: "goblin", type: :npc, is_prototype: true,
        metadata: %{"parent_key" => "base_hostile"},
        components: %{"combatant" => %{"health" => 30}}}
    ]

    EntitySeeder.seed_entities(yaml_data)
    {:ok, goblin} = Entities.find(key: "goblin", type: :npc)

    # Merged from parent
    assert goblin.components["combatant"]["attack"] == 10
    assert goblin.components["combatant"]["defense"] == 5
    # Own value
    assert goblin.components["combatant"]["health"] == 30
  end
end
```

### V2 Test Infrastructure Summary

| Module | Purpose | Changes from V1 |
|--------|---------|----------------|
| `DataCase` | Ecto sandbox isolation | Remove TypedObjectSandbox, simplify allows |
| `EntityHelpers` | Create test entities | New module, replaces YAML-based fixtures |
| `ChannelCase` | Phoenix Channel tests | Unchanged |
| `ConnCase` | HTTP endpoint tests | Unchanged |
| `EngineFixtures` | Entity fixture factory | Evolve to use new schema |
| ~~TypedObjectSandbox~~ | ~~ETS registry isolation~~ | **Deleted** |
| ~~TestCleanup~~ | ~~YAML file cleanup~~ | **Deleted** |

### What Gets Simpler

1. **No three-layer isolation** — just Ecto sandbox
2. **No YAML file pollution** — tests create entities via API, rolled back by sandbox
3. **No registry reload** — no ETS registry to reload
4. **More async tests** — component tests on structs can be fully async
5. **No test_helper.exs sweeps** — no draft files to sweep
6. **No TestCleanup prefixes** — no files to track

### What Gets Harder

1. **Script integration tests** need careful EntityServer lifecycle management
2. **Seeder tests** must verify idempotency without polluting other tests
3. **Behavior tests** need to set up EntityServer + behavior dispatch chain
4. **Cache tests** need to verify invalidation (but cache is transparent, so most tests don't care)

### Test Helper: `start_test_entity_server/1`

Pattern C (EntityServer Integration Test) has 15 lines of Registry/Supervisor setup boilerplate per test. Extract this into a helper:

```elixir
defmodule Loka.EntityHelpers do
  # ... existing helpers ...

  def start_test_entity_server(entity) do
    test_id = System.unique_integer([:positive])
    registry_name = :"test_registry_#{test_id}"
    supervisor_name = :"test_supervisor_#{test_id}"

    {:ok, _} = Registry.start_link(keys: :unique, name: registry_name)
    {:ok, _} = DynamicSupervisor.start_link(strategy: :one_for_one, name: supervisor_name)
    {:ok, pid} = Loka.Engine.EntityRegistry.get_or_start(entity.id,
      registry: registry_name, supervisor: supervisor_name)

    cleanup_fn = fn ->
      if Process.alive?(pid), do: GenServer.stop(pid)
    end

    {:ok, pid, cleanup_fn}
  end
end
```

#### Pattern E: System Entity Behavior Test

Tests a system entity with a behavior module. Seeds entities, starts the system entity's EntityServer, fires a tick, and asserts on world-level effects (broadcast messages, entity state changes). Always `async: false` since it interacts with the world.

```elixir
defmodule Loka.Behaviors.WeatherTest do
  use Loka.DataCase, async: false

  import Loka.EntityHelpers

  setup do
    {:ok, zone} = create_zone(%{key: "test_zone"})
    {:ok, room} = create_room(%{tags: ["zone:test_zone"]})
    {:ok, system} = Entities.save(%Entity{
      id: Ecto.UUID.generate(), type: :system, key: "test_weather",
      behaviors: [Loka.Behaviors.Weather],
      components: %{"service" => %{"priority" => 10}, "tick" => %{"interval" => 60}},
      tags: ["auto_start"]
    })

    {:ok, pid, cleanup} = start_test_entity_server(system)
    on_exit(cleanup)
    {:ok, system: system, room: room, pid: pid}
  end

  test "weather tick broadcasts to zone rooms", %{system: system, room: room} do
    # Subscribe to room broadcasts
    Phoenix.PubSub.subscribe(Loka.PubSub, "location:#{room.id}")

    # Trigger a tick
    send(Process.whereis(system.id) || self(), :tick)

    # Assert weather broadcast received
    assert_receive %{event: :zone_message, payload: %{text: _}}, 1000
  end
end
```

#### Pattern F: Direct Behavior Module Unit Test

Tests a behavior module's `on_event/3` directly without EntityServer overhead. This is the lightest-weight test and should be the most common for behavior logic:

```elixir
defmodule Loka.Behaviors.WeatherUnitTest do
  use ExUnit.Case, async: true  # No DB needed — pure function test

  alias Loka.Behaviors.Weather
  alias Loka.Engine.Entity

  test "on_tick updates weather state in component" do
    entity = %Entity{
      type: :system,
      components: %{
        "service" => %{},
        "tick" => %{"interval" => 60},
        "weather" => %{"current" => "clear"}
      }
    }

    {:ok, updated} = Weather.on_tick(entity)
    assert updated.components["weather"]["current"] != nil
  end

  test "on_event ignores unknown events" do
    entity = %Entity{type: :system, components: %{}}
    assert {:ok, ^entity} = Weather.on_event(entity, :unknown_event, %{})
  end
end
```

**Key insight:** Behavior modules are pure functions (`entity in → entity out`). They can be tested without DB, without GenServer, without PubSub. Only integration tests (Pattern C/E) need the full EntityServer setup.

---

## 21. Operational Tooling

### Entity Audit Log

The `entity_log` table (created in Phase 1 migration alongside `entities` and `entity_tags` — see Section 1 for schema) provides an append-only audit log for debugging production issues ("what happened to this entity?").

This is cheap (SQLite handles append-only writes effortlessly) and invaluable for debugging. Truncate/archive periodically (see Section 30). Optional: only log for entities tagged `audit` to keep it targeted.

### Debug Inspection

```bash
# Show DB state + live GenServer state diff
mix loka.inspect village_elder

# List entities by type
mix loka.inspect --type room --limit 5

# Find orphaned entities (invalid location_id)
mix loka.inspect --orphaned

# Show entities with unsaved dirty changes
mix loka.inspect --dirty
```

### Script Execution Tracing

Tag any entity with `trace` to enable verbose logging of all event dispatch:

```
> edit village_elder tags +trace
```

When `trace` is set, EntityServer logs:
- Every event dispatched (name, payload)
- Which behavior modules ran and their return values
- Script source executed and result
- Any queued actions

```elixir
# In EntityServer dispatch:
if "trace" in entity.tags do
  Logger.warning("[TRACE #{entity.key}] #{event_name}: #{inspect(payload)}")
end
```

This lets builders and developers debug any entity's behavior without code changes.

### Database Recovery

SQLite databases can corrupt (power loss, disk full). Recovery path:
- **Litestream** provides continuous SQLite replication to S3 (already configured for deployment)
- On corruption, restore from latest Litestream backup
- Recovery time: ~30 seconds
- Maximum data loss: last few seconds of writes (Litestream replicates in near-real-time)

---

## 22. Migration Strategy: Evolve vs Rewrite

### Recommendation: Clean Rewrite of Core, Preserve Web/Content Layers

Given that Loka is pre-production with no live players, the most efficient path is:

**Rewrite (clean-room):**
- `lib/loka/engine/` — Entity struct, EntitySchema, Entities API, EntityServer, EntityRegistry, EntityCache, EntitySeeder, EntityBehavior, Spawner
- `lib/loka/components/` — all component accessor modules (new directory)
- Framework registries (deleted, replaced by Entities.find)
- GameState module (deleted, replaced by character entity components)

**Evolve (modify in place):**
- `lib/loka_web/` — channels, LiveView, controllers (update to use new API)
- `lib/loka/framework/` — thin dispatch modules that survive (Combat, Quest.Progress, Inventory, etc.)
- `lib/loka/content/` — swap backend from TypedObject.Loader to Entities.find
- `lib/loka/session/` — update to work with character entities
- `priv/world/` — YAML files stay, seeder handles format mapping
- Tests — rewrite to use Ecto sandbox patterns (simpler)

**Delete entirely:**
- TypedObject system (struct, loader, registry, schema)
- TypedObjectSandbox, TestCleanup
- entity_attributes schema + player_game_states table (dropped in Phase 1 migration)
- GameState module
- All framework registries (14 modules)
- RegistryBase macro
- Plugin system (plugin.ex, plugin_loader.ex, plugin_supervisor.ex, plugins/ dir)
- ~25 deferred framework modules (see Section 24)
- ~30 additional framework modules whose logic moves to scripts

This hybrid approach gives you a clean DB foundation (ground-up schema) without losing the web layer, content files, or framework modules that survive. Each migration phase can be validated independently with a green test suite before proceeding.

The DB schema is a **clean ground-up rewrite** — old tables are dropped entirely in Phase 1 since we're pre-production with no player data to preserve. No migration of existing data, no `entities_v2` rename gymnastics. Just drop and create fresh.

---

## 23. Plugin System Removal

### What It Was

The V1 plugin system (`Loka.Engine.Plugin` behaviour + `PluginLoader` + `PluginSupervisor`) provided:
- Hook registration via `hooks/0` callback
- Child process supervision via `children/0`
- Additional YAML prototype loading via `prototype_paths/0`
- Content validation via `validators/0`
- Scripting extensions via `scripting_extensions/0`
- Balance config merging via `balance_config_path/0`

### Why It's Deleted

1. **Zero plugins are enabled.** Config has `config :loka, :plugins, []`. The only plugin (Guilds) was scaffolding with no real game logic.
2. **V2 system entities replace every plugin feature:**

| Plugin Feature | V2 Replacement |
|----------------|---------------|
| `hooks()` — register lifecycle hooks | Entity behaviors + scripts (`on_event`) |
| `children()` — supervised GenServers | System entities tagged `auto_start` |
| `prototype_paths()` — load extra YAML | EntitySeeder `extra_seed_paths` config |
| `validators()` — content validation | Component accessor modules validate on write |
| `scripting_extensions()` — script bindings | Behavior modules have full Elixir access |
| `balance_config_path()` — balance config | System entity components hold config data |

3. **PluginLoader depends on TypedObject.Loader** (which is being deleted).
4. **9 modules, ~800 LOC** that would need migration work to keep alive.

### What to Delete

```
DELETE: lib/loka/engine/plugin.ex
DELETE: lib/loka/engine/plugin_loader.ex
DELETE: lib/loka/engine/plugin_supervisor.ex
DELETE: lib/loka/plugins/ (entire directory — guilds plugin + all sub-modules)
REMOVE: PluginSupervisor and PluginLoader from application.ex supervision tree
REMOVE: config :loka, :plugins, [] from config.exs
```

### If You Need Plugin-Like Extensibility Later

System entities ARE the plugin system:
- **Third-party content pack:** A set of YAML files in an extra seed path
- **Custom game system:** A system entity with a behavior module
- **Extra YAML directories:** `config :loka, :extra_seed_paths, ["priv/mods/my_mod/"]`

No framework needed — just entities, behaviors, and config.

---

## 24. Framework Scope Reduction

### Principle

Since we're pre-production, framework subsystems that have no real content or aren't needed for MVP should be **deleted outright**, not migrated. Rebuild them as V2 scripts/behaviors when the game actually needs them. This reduces migration scope by ~25 modules and ~8K LOC.

### Cut Now (Delete, Don't Migrate)

| Subsystem | Modules | LOC | Rationale |
|-----------|---------|-----|-----------|
| **Spark (Companion)** | 3 | ~862 | Post-launch feature. Zero tests. No content. |
| **Crafting** | 4 | ~1,200 | No crafting content exists. Rebuild as scripts. |
| **Gathering** | 3 | ~800 | No gathering content exists. Rebuild as scripts. |
| **Economy/Shop** | 2 | ~800 | Shops can be scripts from day one. |
| **Status Effects** | 3 | ~900 | Rebuild as simpler component-based system. |
| **World (Weather, DayNight, Ambient)** | 6 | ~3,000 | Perfect system entity script candidates. |
| **Storyline** | 2 | ~418 | Quest chains = tag queries + quest component data. |
| **Progression** | 1 | ~300 | XP/level formula is trivial. Inline into component. |
| **Total** | **~24** | **~8,280** | |

### Keep (Core Gameplay, Actively Used)

| Subsystem | Modules | Why Keep |
|-----------|---------|----------|
| **Quest system** | 18 | Core narrative loop, deeply integrated |
| **Combat** | 6 | Core gameplay, complex process lifecycle |
| **Inventory/Equipment** | 7 | Core player experience |
| **Skills** | 6 | Player progression |
| **Resources (ResourcePool)** | 5 | Hot-path ETS performance |
| **Social (Channels/Party)** | 6 | Chat infrastructure |
| **Dialogue** | 3 | NPC interaction core |
| **Conditions** | 1 | Quest/dialogue prerequisite checks |

### Rebuild Path

When the game needs crafting, weather, etc., they become:
1. **System entity** (`type: :system`) with a behavior module and/or scripts
2. **YAML definitions** seeded as entity prototypes (recipes, resources, etc.)
3. **Component accessors** for any new component types

This is simpler, more flexible, and naturally integrated with V2 from the start.

---

## 25. Actions/Channels Layer Assessment

### Verdict: Evolve In Place

The actions/channels layer has a **solid architecture** that doesn't need restructuring. The changes are mechanical: swap data access calls when the underlying entity system changes.

### What Doesn't Change

| Component | Status | Why |
|-----------|--------|-----|
| **CommandParser** | No changes | Pure text parsing, no data layer calls |
| **Session.Server** | No changes | Ephemeral connection state only |
| **ActionBridge pattern** | No changes | Context building + dispatch + result application stays |
| **PubSub event dispatch** | No changes | Transport layer, data-agnostic |
| **Result struct pattern** | No changes | `{state_changes, events}` is clean |

### What Changes (Mechanical Updates)

| Component | Change | Scope |
|-----------|--------|-------|
| **PlayerGameState refs** | `PlayerGameState.update_state(gs, changes)` → `EntityServer.update(char_id, fn e -> ... end)` | ~25 call sites across 9 action modules |
| **game_channel.ex join** | `PlayerGameState.get_or_create_state(player.id)` → `Entities.find(type: :character, ...)` | ~5 call sites |
| **RoomHelpers** | `RoomLoader.load_room_for_display(id)` → `EntityServer.get(room_id)` + enrich | ~3 functions |
| **Spawner calls** | API stays the same, internal implementation changes | ~10 call sites (transparent) |
| **Framework module sigs** | `game_state` parameter → `player_entity` parameter | ~50 call sites |

### Migration Timing

These changes happen in **Phase 4** (Player Migration) and **Phase 5** (Content + Actions Migration). They can be done module-by-module with tests passing after each module.

**Estimated scope:** ~1,500 LOC of mechanical changes across the layer. No architectural redesign needed.

### Directory Structure

```
lib/loka/behaviors/          # NEW: behavior module implementations (game layer)
  weather.ex
  npc_ambient.ex
  room_ambient.ex
  ...

lib/loka/components/         # NEW: component accessor modules (game layer)
  combatant.ex
  player.ex
  quest_def.ex
  quest_progress.ex
  ...
```

Components live under `lib/loka/components/` (game layer, parallel to `lib/loka/behaviors/`) because they contain domain logic (`Combatant.apply_damage`, `Combatant.alive?`), not just data access. The engine provides the infrastructure for components; the component definitions themselves are game-layer. This also yields cleaner module names: `Loka.Components.Combatant` rather than `Loka.Engine.Components.Combatant`. Behavior implementations live in `lib/loka/behaviors/`, separate from the engine interface definition (`lib/loka/engine/entity_behavior.ex`).

---

## 26. Script Safety: Error Budget, Auto-Disable, and Version History

### Error Budget

Beyond rate limits (Section 18), scripts have hard resource limits:

| Metric | Limit | Action |
|--------|-------|--------|
| Execution time | 100ms soft / 1s hard | Warn at soft, kill at hard |
| Memory per execution | 10MB | Kill |
| DB queries per execution | 10 | Reject further queries |
| Query results per query | 100 entities | Truncate |
| Entity modifications per execution | 50 | Reject further mutations |
| Consecutive failures (same hook) | 5 | Auto-disable script hook |
| Failures per hour (same entity) | 20 | Auto-disable all scripts + alert builder |

### Auto-Disable on Repeated Failure

If a builder deploys a bad `on_tick` script, it crashes every tick. Without protection, this fills logs and wastes CPU forever. EntityServer tracks consecutive failures per script hook:

```elixir
# In EntityServer state:
%{
  script_failures: %{on_tick: 0, on_talk: 0, ...},  # consecutive failure count per hook
  disabled_scripts: MapSet.new()                      # hooks currently disabled
}

# After a script crash:
defp handle_script_failure(state, event_name) do
  failures = Map.update(state.script_failures, event_name, 1, &(&1 + 1))

  if failures[event_name] >= 5 do
    Logger.error("[#{state.entity.key}] Script #{event_name} disabled after 5 consecutive crashes")
    # Notify builder terminal if online
    broadcast_builder_alert(state.entity, event_name, "auto-disabled after 5 crashes")
    %{state | script_failures: failures,
              disabled_scripts: MapSet.put(state.disabled_scripts, event_name)}
  else
    %{state | script_failures: failures}
  end
end

# On successful execution, reset the counter:
defp handle_script_success(state, event_name) do
  %{state | script_failures: Map.put(state.script_failures, event_name, 0)}
end
```

### Script Version History

Script versions are stored in the **audit log table** (Section 21), NOT in entity metadata. Storing 5 versions of every script hook in `metadata["script_versions"]` would bloat entity save size by kilobytes per entity. The audit log is purpose-built for historical data.

On script edit, the previous script code is written to `entity_log`:
```elixir
# When a builder edits a script:
EntityLog.insert(%{
  entity_id: entity.id,
  action: "script_edit",
  changes: Jason.encode!(%{hook: "on_tick", previous_code: old_code}),
  source: "builder:#{builder_name}",
  inserted_at: DateTime.utc_now()
})
```

Builder command to restore a previous version:
```
> rollback-script village_elder on_tick
Found 3 previous versions in audit log.
Restored on_tick to version from 2026-02-10T14:00:00Z
```

The `rollback-script` command queries `entity_log` for recent `script_edit` entries for that entity+hook and restores the most recent previous code. Audit log retention (7 days by default, Section 30) determines how far back rollbacks can go.

---

## 27. Transient Volatile State

### The Problem

Many game systems need volatile runtime data that should NOT be persisted:
- NPC's current combat target
- Player's dialogue tree cursor (which dialogue node they're on — stored on the **player's** EntityServer, not the NPC's, so multiple players can talk to the same NPC simultaneously with independent dialogue states)
- Entity's accumulated tick count since startup
- Behavior-specific working data (weather system's calculation cache)
- Patrol waypoint index

### Design

EntityServer maintains a `volatile` map in its GenServer state. This is **not** part of the Entity struct, **not** saved to DB, and **lost on crash/restart** (by design):

```elixir
# EntityServer state:
%{
  entity: %Entity{...},        # persistent — saved to DB
  volatile: %{                  # transient — never saved, lost on restart
    "combat_target" => "npc-uuid-123",
    "patrol_waypoint" => 3,
    "dialogue_cursor" => "greeting",
    "accumulated_damage" => 150
  },
  ...
}
```

### Access

**Volatile state is accessed via `EntityServer.Volatile` helpers, NOT callback parameters.** The EntityServer sets up the volatile map in the process dictionary before calling any behavior or script, and reads it back after. This keeps the `EntityBehavior` callback interface clean — callbacks don't need volatile parameters.

```elixir
# In a behavior module (volatile accessed via helpers, not parameters):
def on_tick(entity) do
  waypoint = EntityServer.Volatile.get("patrol_waypoint", 0)
  next_waypoint = rem(waypoint + 1, length(patrol_route(entity)))
  EntityServer.Volatile.set("patrol_waypoint", next_waypoint)
  {:ok, entity}
end

# In a script (same mechanism, different names):
waypoint = get_state("patrol_waypoint", 0)
set_state("patrol_waypoint", waypoint + 1)
```

**How it works internally:**
```elixir
# EntityServer before calling behavior:
Process.put(:entity_volatile, state.volatile)

# After behavior returns:
updated_volatile = Process.get(:entity_volatile)
%{state | volatile: updated_volatile}
```

This is the BEAM-idiomatic way to pass context through call stacks without polluting every function signature. The process dictionary is scoped to the EntityServer process, so there's no cross-process contamination.

**Warning:** Volatile state helpers (`EntityServer.Volatile.get/set` and script `get_state/set_state`) MUST only be called from within the EntityServer process. Behavior modules that spawn Tasks or use `Task.async` must pass volatile data explicitly to the spawned process — the process dictionary is NOT inherited by spawned processes.

**Defensive guard:** `Volatile.get/set` raises when called outside an EntityServer process, preventing silent nil bugs:

```elixir
def get(key, default \\ nil) do
  case Process.get(:entity_volatile) do
    nil -> raise "Volatile.get/2 called outside EntityServer process — " <>
                 "did you call it from a spawned Task?"
    vol -> Map.get(vol, key, default)
  end
end
```

This catches the bug immediately instead of silently returning `nil` from the wrong process dictionary.

### Rules

- Volatile state is initialized to `%{}` on EntityServer start (even after crash recovery)
- `on_init` behavior callback can populate initial volatile state via `EntityServer.Volatile.set/2`
- `on_terminate` behavior callback can read volatile state via `EntityServer.Volatile.get/2` for cleanup
- Volatile state is NOT included in `EntityServer.get/1` responses (callers see Entity struct only)
- Max volatile state size: 100KB (prevents memory leaks from runaway scripts)

### Evennia Mapping

This is the V2 equivalent of Evennia's `ndb` (non-database) handler — runtime working data that's explicitly ephemeral.

---

## 28. Telemetry Integration

### Events

Every core operation emits `:telemetry` events for observability:

```elixir
# Entity lifecycle
[:loka, :entity_server, :start]           # metadata: %{entity_id, type, key}
[:loka, :entity_server, :stop]            # metadata: %{entity_id, type, reason}
[:loka, :entity_server, :save]            # measurements: %{duration: µs}
[:loka, :entity_server, :save_error]      # metadata: %{entity_id, error}

# Event dispatch
[:loka, :entity_server, :dispatch]        # measurements: %{duration: µs}
                                          # metadata: %{entity_id, event_name, behavior_count}

# Script execution
[:loka, :script, :execute]                # measurements: %{duration: µs, action_count: n}
                                          # metadata: %{entity_id, event_name}
[:loka, :script, :error]                  # metadata: %{entity_id, event_name, error}
[:loka, :script, :auto_disabled]          # metadata: %{entity_id, event_name, failure_count}

# Cache
[:loka, :entity_cache, :hit]              # metadata: %{key, type}
[:loka, :entity_cache, :miss]             # metadata: %{key, type}

# Queries
[:loka, :entities, :query]                # measurements: %{duration: µs, result_count: n}
                                          # metadata: %{query_opts}

# Seeding
[:loka, :entity_seeder, :complete]        # measurements: %{duration: ms, entity_count: n}
                                          # metadata: %{skipped: n, updated: n, inserted: n}

# Transactions
[:loka, :entities, :transaction]          # measurements: %{duration: µs, entity_count: n}
```

### Metrics Dashboard

Standard Telemetry.Metrics reporters (e.g., PromEx for Prometheus) can expose:
- Entity counts by type (gauge)
- EntityServer message queue depth (gauge, sampled)
- Cache hit/miss rates (counter)
- Script execution time p50/p95/p99 (summary)
- Save success/failure rates (counter)
- DB query latency (histogram)
- Active EntityServer count (gauge)

### Integration

V1 already has telemetry in EntityServer (`entity_server_start`, `entity_server_stop`, `entity_server_save`). V2 expands coverage to all core paths. The existing PromEx integration carries forward.

---

## 29. Behavior Code Updates

### Strategy: Server Restart

**Behavior code updates require a server restart.** For a single-server Fly.io deployment, this takes ~3 seconds and the EntityServer crash recovery handles it cleanly:

1. Deploy new release to Fly.io
2. Graceful shutdown saves all entity state (freeze → save → stop, see Decision 12)
3. New release starts, EntitySeeder re-seeds from YAML
4. EntityServers start fresh with new behavior module code
5. Volatile state resets (by design — it's ephemeral)

**Why NOT hot code reload:** Manual `:code.purge/1` and `:code.load_file/1` are dangerous in production:
- `:code.purge/1` kills any process still executing old code immediately
- `:code.load_file/1` loads from the filesystem, not the release — in a Mix release, modules are embedded in the release archive
- Managing three-version code loading across dozens of EntityServers is fragile

**Why restart is sufficient:** A ~3 second restart is imperceptible for a pre-production MUD. The graceful shutdown guarantees no data loss. EntityServers reload from DB on startup, picking up new behavior modules automatically. No `code_change/3` callback is needed because EntityServer state shape is stable.

**Scripts are already hot-reloadable.** Script code is data stored in entity `scripts` fields — editing a script via the builder takes effect immediately when the EntityServer reloads the entity. No restart needed for script changes.

---

## 30. Database Maintenance

### SQLite Maintenance Tasks

SQLite needs periodic maintenance for optimal performance as entities are created/destroyed:

```elixir
defmodule Mix.Tasks.Loka.Db.Maintain do
  use Mix.Task

  def run(_args) do
    Mix.Task.run("app.start")

    # Update query planner statistics
    Loka.Repo.query!("ANALYZE")

    # Optimize based on recent query patterns
    Loka.Repo.query!("PRAGMA optimize")

    # Check for fragmentation
    %{rows: [[page_count]]} = Loka.Repo.query!("PRAGMA page_count")
    %{rows: [[freelist_count]]} = Loka.Repo.query!("PRAGMA freelist_count")
    fragmentation = freelist_count / max(page_count, 1) * 100

    if fragmentation > 20 do
      IO.puts("Fragmentation: #{Float.round(fragmentation, 1)}% — running VACUUM")
      Loka.Repo.query!("VACUUM")
    else
      IO.puts("Fragmentation: #{Float.round(fragmentation, 1)}% — no VACUUM needed")
    end

    # Audit log truncation (keep last 7 days)
    Loka.Repo.query!(
      "DELETE FROM entity_log WHERE inserted_at < datetime('now', '-7 days')"
    )
  end
end
```

### Maintenance is Manual Only

**Do NOT run VACUUM via a system entity tick.** `VACUUM` rewrites the entire database file, blocking ALL writes for seconds. Running it during live gameplay would freeze every EntityServer save. Instead:

- Run `mix loka.db.maintain` during scheduled maintenance windows or as a cron job
- Fly.io deployment restarts are a natural maintenance window (`VACUUM` can run during boot, before Endpoint starts)
- `ANALYZE` and `PRAGMA optimize` are lightweight and can run anytime (e.g., daily cron)
- Audit log truncation is also lightweight and safe for cron

### Litestream Integration

Litestream provides continuous SQLite replication to S3 (already configured for deployment):
- On corruption: restore from latest Litestream backup (~30 seconds)
- Maximum data loss: last few seconds of writes (near-real-time replication)
- `VACUUM` should be scheduled when Litestream is caught up (avoid large WAL during vacuum)

---

## 31. Entity Type Extensibility

### Decision 35: Entity Types Are Open

Adding a new entity type requires NO schema migration — `type` is a TEXT column. New types are added by:

1. Add the atom to `@entity_types` in `Entity` module (compile-time validation)
2. Optionally create component accessor modules for type-specific components
3. Optionally create a behavior module for type-specific logic
4. Add YAML files under `priv/world/<type_plural>/`
5. Update EntitySeeder to handle the new type in the appropriate seeding phase

**Example: Adding a `mount` type:**

```yaml
# priv/world/prototypes/mounts/monastery_yak.yml
key: monastery_yak
type: mount
short_desc: "a sturdy mountain yak"
components:
  mount:
    speed_bonus: 1.5
    stamina: 100
    rideable_by: [character]
  combatant:
    health: 200
    max_health: 200
tags: [mount, zone:monastery]
```

The mount reuses existing components (`combatant`) and adds a new `mount` component. A `Components.Mount` accessor module provides typed access. The EntitySeeder seeds mounts in the NPC/item phase (they're located entities).

### Guidelines for New Types

| Question | Guidance |
|----------|----------|
| Does it need a GenServer? | If it has behavior/scripts or receives events, yes. If it's pure data (like skills, recipes), no. |
| Located or non-located? | If it exists "in the world" (rooms, containers, inventories), it has a `location_id`. If it's a definition/template, it doesn't. |
| Prototype or instance? | If builders create templates that spawn copies, support both. If it's always unique (like zones), prototype-only. |

---

## 32. Mood Field Role

### Decision

The `mood` field is a nullable string on the Entity struct that affects **NPC display and behavior selection**.

**Display:** When rendering an NPC's long_desc, the mood is prepended if set:
```
"The Village Elder looks anxious."     # mood = "anxious"
"The Village Elder looks cheerful."    # mood = "cheerful"
(no prefix)                            # mood = nil
```

**Behavior gating:** Scripts and behaviors can check mood to select dialogue branches or ambient emotes:
```elixir
# In NPC's on_talk script:
if mood(self()) == "anxious" do
  say("I don't have time to chat right now...")
  deny()
else
  start_dialogue(event().speaker, "village_elder_dialogue")
end
```

**Who sets mood:**
- Scripts (e.g., quest events change NPC mood)
- Status effects (poisoned → "suffering")
- Time of day (sleepy at night)
- Builder commands (`edit village_elder mood anxious`)

**Not for rooms.** Room atmosphere is handled by ambient messages and zone weather, not a mood field.

---

## 33. Refinement Priority Matrix

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| **P0** | Indexed `account_id` column (login) | Breaks at scale | Trivial (add column) |
| **P0** | ETS live state for reads (defer if needed) | Combat performance + deadlock prevention | Moderate |
| **P0** | Freeze step in shutdown | Data integrity | Small |
| **P0** | Per-type key uniqueness (not global) | Content flexibility | Trivial (correct index) |
| **P0** | Entity load failure handling | Prevents crash loops from corrupt data | Small |
| **P0** | Event correlation on PubSub envelope | Combat debugging, audit logging | Trivial |
| **P1** | Multi-entity transactions | Crafting/trade correctness | Moderate |
| **P1** | System entity boot priority | Startup dependency ordering | Trivial (priority field) |
| **P1** | Batch DB operations | Boot time, prototype apply, shutdown | Moderate |
| **P1** | Telemetry events on all core paths | Operability | Moderate |
| **P1** | Script query limits + enforcement | Resource exhaustion prevention | Small |
| **P1** | `on_event/3` arity (not `/2`) | API ergonomics | Trivial |
| **P1** | SystemSupervisor crash loop protection | Prevents buggy system entities from infinite restart | Trivial |
| **P2** | Script auto-disable + version history | Builder safety | Moderate |
| **P2** | Middleware pipeline for behavior dispatch | Event flexibility | Moderate |
| **P2** | Transient volatile state | NPC AI, combat, working data | Small |
| **P2** | `run_script(key, args)` binding | Script reuse | Small |
| **P2** | Extended script bindings (desc, exits, keywords) | Builder capability | Small |
| **P2** | ~~Hot code reload for behaviors~~ | ~~Deployment~~ | ~~Removed — restart handles it~~ |
| **P0** | Stale `online` tag boot cleanup | Session accuracy after restart | Trivial |
| **P0** | Tag sync rules (entity save excludes tags) | Prevents duplicate tag writes | Small |
| **P0** | Script execution model (sync vs queued) | Correct script behavior | Small |
| **P1** | `Entity.new/1` constructor + `Entity.snapshot/1` | Code consistency, rollback clarity | Trivial |
| **P1** | `Volatile.get` guard outside EntityServer | Prevents silent nil bugs | Trivial |
| **P1** | `force_save` expanded trigger list | Player data safety | Trivial |
| **P1** | CombatServer ↔ EntityServer interaction pattern | Combat hot-path correctness | Small |
| **P2** | `Entities.find/1` — type always required, no single-arg convenience | Key lookup safety | Trivial |
| **P2** | Dynamic exit bindings (`create_exit`, `remove_exit`) | Builder capability | Small |
| **P3** | Defer component macro | Simplicity (less to build) | Zero effort |
| **P3** | Entity type extensibility docs | Clarity for future | Trivial |
| **P3** | DB maintenance task | Long-term health | Small |
| **P3** | Mood field role clarification | Documentation | Trivial |
| **Deferred** | EntityCache (read-through cache) | Performance optimization | Moderate — add when profiling shows need |
| **Deferred** | Seeder conflict resolution (`edited_by`/`edited_at`) | Multi-builder support | Moderate — add when multiple builders |

---

## 34. Respawn Mechanics

### Death and Respawn Flow

When an NPC dies (health reaches 0), the following sequence occurs:

```
1. Combat module detects health <= 0
2. EntityServer dispatches :on_death event
   └── Scripts/behaviors can create loot drops, play death messages
3. NPC EntityServer marks entity as dead:
   └── set_component(entity, "combatant", %{"health" => 0, "dead" => true})
   └── EntityServer enters "dead" state — rejects most events except :respawn
4. Loot generation:
   └── on_death script creates item entities with location_id = room (dropped loot)
5. RespawnManager.schedule(entity_id, respawn_seconds)
   └── Uses Timers system — survives server restart
   └── respawn_seconds from spawnable.respawn_time component
6. Timer fires → RespawnManager sends :respawn event to EntityServer
7. EntityServer handles :respawn:
   └── Reset from prototype: health, mood, volatile state
   └── Teleport back to original spawn location (from spawnable.spawn_location or prototype)
   └── Dispatch :on_respawn event (scripts can reinitialize volatile state)
   └── Entity is alive again
```

**Key design choices:**
- Dead NPCs keep their EntityServer alive (in "dead" state) rather than despawning. This preserves instance-specific data (overrides, quest state) across death/respawn cycles.
- The `spawnable` component drives respawn: `respawn_time` (seconds), `max_instances` (spawn cap), `spawn_location` (room key to respawn in).
- Respawn timers use the persistent `Timers` system, so respawns happen even after server restart.
- For pre-production: `respawn-all <prototype_key>` builder command despawns all dead instances and spawns fresh from prototype (simpler than individual respawn).

### Player Character Death

Player death is handled differently:
1. Health reaches 0 → :on_death event
2. Script determines penalty (XP loss, item drop, etc.)
3. Player is teleported to a safe room (respawn point / last checkpoint)
4. Health reset to a percentage of max
5. Session sends "You have died." + respawn message to client

No timer-based respawn for players — they respawn immediately.

---

## 35. Entity Deletion Cascade

### The Problem

The `location_id` foreign key uses `ON DELETE NILIFY_ALL`. If a room is deleted, all entities inside it get `location_id: nil` — orphaned in limbo with no location. This is dangerous for game consistency.

### Deletion Protocol

| Entity Type | Deletion Rules |
|-------------|---------------|
| Room | **Refuses deletion if occupied.** Builder must `despawn-all --in <room>` or move entities first. `delete room <key> --force` skips the check (admin escape hatch). |
| NPC/Item instance | Safe to delete. EntityServer terminates, entity removed from DB. Loot/drops at its location are left in place. |
| NPC/Item prototype | **Refuses deletion if live instances exist.** `despawn-all <key>` first, then delete prototype. |
| System entity | **Cannot delete while running.** `deactivate <key>` stops the EntityServer first. |
| Player character | **Never deleted via builder.** Admin-only operation with confirmation. |
| Exit | Safe to delete. The connecting rooms remain; players just can't traverse that direction anymore. |
| Content (quest, dialogue, skill) | Safe to delete. Active quest_progress entries on players become orphaned but don't crash — the quest is simply absent. Warn the builder. |

### Orphan Detection

```bash
# Find entities with invalid location_id (location was deleted or null unexpectedly)
mix loka.inspect --orphaned

# Outputs:
# [WARN] 3 entities have NULL location_id but should be located:
#   - goblin_123 (npc) — location_id: nil
#   - iron_sword_456 (item) — location_id: nil
#   - cave_bat_789 (npc) — location_id: nil
# Run `mix loka.inspect --orphaned --fix` to move them to the void room.
```

The `--fix` flag moves orphaned entities to a configurable "void" room where builders can inspect and relocate them. This is a safety net, not a normal operation.

---

## 42. Entity Lifecycle Management (Cleanup and GC)

### The Problem

With "everything is an entity," entity count grows unboundedly. Each dropped item, each spawned NPC instance, each created exit is a DB row. Without cleanup, the entities table grows indefinitely:

- 10 goblins dying/hour × 3 dropped items each = 30 item entities/hour
- Over a month in one popular zone: ~21,600 unclaimed item entities
- Exit entities: ~600 for a 100-room world (2 per bidirectional connection)
- Spawned NPC instances that were killed but not despawned

### Entity TTL (Time-to-Live)

Dropped items and loot have a configurable TTL after which they are automatically despawned:

```yaml
# In item prototype components:
components:
  physical: {weight: 2}
  ttl:
    seconds: 600        # 10 minutes — despawn if not picked up
    start_on: drop      # TTL starts when item is dropped (on_drop event)
```

**Implementation:** When an item is dropped (location_id changes to a room), the EntityServer sets a timer via `Process.send_after(self(), :ttl_expire, ttl_seconds * 1000)`. On `:ttl_expire`, the entity is despawned. If the item is picked up before expiry, the timer is cancelled. Items without a `ttl` component persist indefinitely (quest items, placed items).

### Periodic Orphan Sweep

A lightweight cleanup task runs periodically (daily or on boot):

```elixir
defmodule Loka.Engine.EntityCleanup do
  @doc "Remove orphaned non-prototype entities that shouldn't exist."
  def sweep do
    # 1. Orphaned items/NPCs with NULL location (not prototypes, not characters)
    orphaned = Repo.all(
      from e in EntitySchema,
      where: is_nil(e.location_id) and e.type in ["npc", "item"] and e.is_prototype == false
    )
    for entity <- orphaned, do: Entities.delete(entity.id)
    Logger.info("[EntityCleanup] Removed #{length(orphaned)} orphaned entities")

    # 2. Dead NPC instances older than respawn_time × 3 (stuck in dead state)
    # These indicate a respawn timer that failed — despawn and let the room re-spawn them
    stuck_dead = Repo.all(
      from e in EntitySchema,
      where: e.type == "npc" and e.is_prototype == false and
             fragment("json_extract(components, '$.combatant.dead') = true") and
             e.updated_at < ago(1, "hour")
    )
    for entity <- stuck_dead, do: Entities.delete(entity.id)
    Logger.info("[EntityCleanup] Removed #{length(stuck_dead)} stuck-dead NPCs")
  end
end
```

### Entity Count Telemetry

Monitor entity growth to catch runaway spawning:

```elixir
# Emitted by EntityCleanup.sweep and on boot:
:telemetry.execute([:loka, :entities, :count], %{
  total: total_count,
  by_type: %{room: n, npc: n, item: n, exit: n, ...},
  orphaned: orphaned_count
})
```

Alert if total entity count exceeds a threshold (e.g., 10,000 for a 500-room world). This catches spawner bugs that create thousands of instances.

---

## 36. Consistency Rules (Sandpaper Checklist)

> **Purpose:** Run this checklist after every implementation pass, code review, or doc edit. These are the exact conventions and decisions that drift most easily. Each rule is a grep-able assertion — if you find a violation, fix it.

### A. Entities API

| Rule | Grep/Check | Rationale |
|------|-----------|-----------|
| **A1.** All entity reads go through `Entities.find_one/1` or `Entities.find_all/1` | No `Entities.get(`, `Entities.query(`, `get_by_key(`, `get_by_tag(`, `get_contents(`, `get_prototype(`, `get_character_for_account(` | Section 7: two entry points, split by return type |
| **A2.** Key lookups ALWAYS use keyword args | `Entities.find_one(key: k, type: t)` — never positional | Decision 64: type always required, keyword syntax |
| **A3.** Key lookups ALWAYS include type | No `find_one(key: k)` without `type:` | Q12: keys are unique per type, not globally |
| **A4.** UUID lookups use `find_one/1` single-arg | `Entities.find_one(uuid_string)` — raises on non-UUID strings | Section 7: UUID format validated |
| **A5.** `account_id` lookups use `find_one` | `Entities.find_one(account_id: id)` — not a separate function | Section 7 |
| **A6.** Return types are explicit | `find_one/1` → `{:ok, entity} \| {:error, :not_found}`; `find_all/1` → `[entity]`. `find/1` sugar dispatches to the correct one. Prefer explicit variants in framework code. | Section 7: Dialyzer-friendly |
| **A7.** `find_many/1` for batch UUID reads | Not `Enum.map(ids, &Entities.find_one/1)` (N+1 queries) | Section 7 |
| **A8.** No direct DB queries outside Entities module | All `Repo.get`, `Repo.get_by`, `Ecto.Query` for entities go through the `Entities` API | Single query path enables future caching |

### B. Scripts and Bindings

| Rule | Grep/Check | Rationale |
|------|-----------|-----------|
| **B1.** Scripts call `Entities.find` directly | No `query()`, `get_entity()`, `find_entity()`, `count_entities()`, `find_entities_by_tag()` | Decision 66: wrapper layer removed |
| **B2.** Room sugar kept: `entities_in_room()`, `players_in_room()`, `exits()`, `exit_to()`, `find_by_keyword()` | These are the ONLY convenience wrappers | Section 18 |
| **B3.** Cross-entity events use `emit(target, event_name, payload)` | No `send_signal` | Decision 68 |
| **B4.** `deny()`, `handled()`, `continue()` are the only control flow returns | No `allow()` | Decision 46 |
| **B5.** Scripts are flat: `event_name → code string` | No nested `on_tick: { interval: ..., code: ... }` — tick interval lives in `components["tick"]["interval"]` | Decision 55 |

### C. Event Names

| Rule | Grep/Check | Rationale |
|------|-----------|-----------|
| **C1.** Short event names | `on_look` not `on_looked_at`, `on_use` not `on_used`, `on_enter` not `on_entity_entered`, `on_leave` not `on_entity_left` | Decision 67 |
| **C2.** `on_` prefix on callbacks/scripts | Behavior `on_event(entity, :on_enter, payload)`, script key `on_enter:` | Decision 8 |
| **C3.** Plain names on PubSub envelope | `%{event: :enter}` not `%{event: :on_enter}` — EntityServer translates | Decision 8, 74 |
| **C4.** Custom events follow same pattern | `emit(:on_fish_caught)` → strips `on_` for PubSub (`:fish_caught`) → re-adds at dispatch | Decision 74 |

### D. Components

| Rule | Grep/Check | Rationale |
|------|-----------|-----------|
| **D1.** System entity boot priority component is `"service"` | No `"system" =>` in component context, no `Components.System` | Decision 65: renamed to avoid collision with entity type |
| **D2.** Game code uses accessor modules | `Combatant.health(npc)` not `npc.components["combatant"]["health"]` | Decision 2 |
| **D3.** Locks are in components | `components["locks"]` not a separate `locks` JSON column | Decision 52 |
| **D4.** `parent_key` is in metadata | `metadata["parent_key"]` not a top-level column | Decision 53 |
| **D5.** Component keys are strings | `"combatant"` not `:combatant` in JSON maps | JSON storage convention |
| **D6.** Tick interval in components only | `components["tick"]["interval"]` — no interval in scripts structure | Decision 55 |

### E. Entity Struct and Schema

| Rule | Grep/Check | Rationale |
|------|-----------|-----------|
| **E1.** No `data` field | Removed entirely — all game data in `components` | Decision 3 |
| **E2.** No `attributes` field | Merged into `components` | Section 1 |
| **E3.** No `contents` field | Derived from `find(location_id: entity_id)` — no cache | Decision 4 |
| **E4.** `account_id` is a top-level indexed column | Not inside `components["player"]` | Decision 22 |
| **E5.** Tags stored in `entity_tags` join table | Not a JSON column on entities | Decision 19 |
| **E6.** Entity save MUST NOT write tags | Tags go through `add_tag/remove_tag` → join table. Dirty-check save excludes tags. | Section 1: tag sync rules |
| **E7.** 4 JSON columns only | `components`, `behaviors`, `scripts`, `metadata` — no `locks` column | Decision 52 |

### F. EntityServer and Lifecycle

| Rule | Grep/Check | Rationale |
|------|-----------|-----------|
| **F1.** ALL writes to live entities go through EntityServer | No direct DB writes while GenServer is running | Section 1: critical rule |
| **F2.** `dispatch_event` returns three-tuple | `{:ok, state}`, `{:halted, state}`, `{:error, state}` | Decision 37, 47 |
| **F3.** `try/catch` not `try/rescue` in dispatch | Catches both exceptions and exits (GenServer timeouts) | Decision 38 |
| **F4.** `Entity.snapshot/1` before dispatch | Named rollback pattern — restore on crash | Decision 11, 61 |
| **F5.** Crash returns `{:error, state}` not `{:ok, state}` | Callers must distinguish crash from success | Decision 47 |
| **F6.** Before-event crashes fail-open | Action proceeds — broken scripts don't block gameplay | Decision 11 |
| **F7.** Tag mutations write to DB immediately | Not deferred to 60s dirty-check | Decision 39 |
| **F8.** Tick/auto-save do NOT reset idle timer | Only external messages reset `last_activity` | Decision 13 |
| **F9.** Volatile state via process dictionary | `EntityServer.Volatile.get/set`, NOT callback parameters | Decision 40 |
| **F10.** Volatile.get/set raises outside EntityServer | Prevents silent nil from wrong process | Decision 63 |

### G. YAML and Seeding

| Rule | Grep/Check | Rationale |
|------|-----------|-----------|
| **G1.** YAML is V2 format only | No backward-compatible V1 mapping in seeder — one-time conversion was done | Decision 56 |
| **G2.** YAML always wins for prototypes | No `edited_by`/`edited_at` conflict tracking for MVP | Decision 57 |
| **G3.** Exits are standalone entities | Not inline on room YAML — seeder creates exit entities from V1 `exits:` | Section 8 |
| **G4.** Bidirectional exits auto-created | Seeder creates reciprocal exit for every exit definition | Section 8: orphan room prevention |
| **G5.** `parent_key:` in YAML → `metadata["parent_key"]` in DB | Resolved at seed time, not consulted at runtime | Decision 53 |

### H. Supervision and Boot

| Rule | Grep/Check | Rationale |
|------|-----------|-----------|
| **H1.** ~22 supervised children | Not ~17 or ~50 — count the actual Application.start list | Executive Summary |
| **H2.** EntitySeeder blocks in init | Endpoint starts AFTER seeding completes | Decision 9 |
| **H3.** System entities start after Phase 3 | Seeded in Phase 2, started when behavior dispatch exists | Section 11 |
| **H4.** SystemSupervisor has crash loop protection | `max_restarts: 5, max_seconds: 60` | Decision 49 |
| **H5.** EntitySupervisor is `:transient` restart | Regular entities restart lazily via `get_or_start/1` | Decision 11 |
| **H6.** Stale `online` tags cleared at boot | `DELETE FROM entity_tags WHERE tag = 'online'` in seeder | Section 5 |

### I. Naming Conventions

| Rule | Grep/Check | Rationale |
|------|-----------|-----------|
| **I1.** `Components.QuestDef` not `Components.Quest` | Avoids confusion with quest entities | Decision 14 |
| **I2.** `type: :system` for system entities | `type: :script` reserved for standalone script definitions | Decision 15 |
| **I3.** Behaviors in `lib/loka/behaviors/` | Separate from engine interface (`lib/loka/engine/entity_behavior.ex`) | Decision 16 |
| **I4.** Components in `lib/loka/components/` | Not `engine/components/` — they contain domain logic | Section 25 |
| **I5.** `EntityBehavior` callback: `on_event/3` | Separate `event_name` atom from `payload` map — not `on_event/2` with tuple | Decision 30 |

### J. Cross-Cutting Patterns

| Rule | Grep/Check | Rationale |
|------|-----------|-----------|
| **J1.** Containment via `location_id` only | No inventory lists, no contents cache, no dual-store | Decision 4 |
| **J2.** Flat containment for MVP | No bags-within-bags, no nested containers | Decision 32 |
| **J3.** Framework queries by component, not type | `find(component: "combatant")` not `find(type: :npc)` in framework code | Decision 71 |
| **J4.** Type is a content-level concern | Builder scripts use type; framework uses component | Decision 72 |
| **J5.** No EntityCache for MVP | Direct DB queries with indexes — add cache only if profiling shows need | Decision 54 |
| **J6.** No `on_save` callback | Saves are infrastructure, not game logic | Decision 6 |
| **J7.** One script per event per entity | `run_script(key, args)` calls shared scripts, but each entity has at most one handler per event name | Decision 6 |
| **J8.** Halts are final — no `allow()` override | Once a handler halts, subsequent handlers never run | Decision 46 |
| **J9.** Same-entity mutations synchronous, cross-entity queued | Scripts mutating self see updates immediately; cross-entity mutations execute after script returns | Section 3 |
| **J10.** `force_save: true` for player-affecting operations | Room changes, items, quests, XP, gold, equipment, death penalties | Section 3 |

### K. Documentation Consistency

| Rule | Grep/Check | Rationale |
|------|-----------|-----------|
| **K1.** Section cross-references match actual section numbers | Sections 1-42. Verify after any structural edit. | This doc reorganizes frequently |
| **K2.** Code examples use `Entities.find/1` keyword syntax | No positional args, no old function names | This section exists because of drift |
| **K3.** Event names in all tables match Decision 67 | Hook-to-event table (Section 12), payload table (Q16), inline examples | Short names everywhere |
| **K4.** Changelog (Decisions 1-75) doesn't conflict with section content | New decisions may supersede old ones — verify | Changelog is append-only |
| **K5.** Supervision tree count matches in Executive Summary, Section 6 table, and Section 15 After list | All should say ~22 | Three places state this number |

### How to Use This Checklist

1. **After each implementation phase:** Run through sections A-J for the code you wrote
2. **After each doc edit:** Run section K to verify no cross-reference or terminology drift
3. **Before PR review:** Grep for the "bad" patterns in column 2 — any hit is a bug
4. **Periodically (every 2-3 sessions):** Full pass through all sections, especially J (cross-cutting) which touches multiple files

**Automated checks to build (Phase 6):**
```elixir
# mix loka.lint.v2 — verify V2 conventions in codebase
# - No Entities.get/Entities.query calls
# - No positional Entities.find(key, type) calls
# - No data field access on Entity structs
# - No components["system"] (should be "service")
# - No send_signal calls
# - No on_looked_at/on_used/on_entity_entered/on_entity_left event names
# - No direct Repo queries for entity data outside Entities module
# - All entity saves go through EntityServer (no Entities.save while GenServer running)
```

---

## 37. Clean Rebuild Plan — Complete File-Level Specification

> **Purpose:** This section expands the "clean rewrite of core, preserve web/content layers" strategy into an exhaustive file-by-file plan. Every module in the current V1 codebase is accounted for. Nothing is left ambiguous.

### Phase 0: Pre-Migration Preparation

Before writing any V2 code, complete these preparation steps:

#### Step 0.1: Archive V1

```bash
git checkout main
git checkout -b archive/v1-final
git push origin archive/v1-final
# This branch is the fallback. Never delete it.
```

#### Step 0.2: Create V2 Working Branch

```bash
git checkout main
git checkout -b v2/unified-entity-system
```

#### Step 0.3: Run Full V1 Test Suite and Record Baseline

```bash
cd server
mix test --trace 2>&1 | tee ../v1-test-baseline.txt
mix loka.test.validate 2>&1 | tee ../v1-validation-baseline.txt
echo "Tests: $(grep -c 'test ' ../v1-test-baseline.txt) | Failures: $(grep -c 'failure' ../v1-test-baseline.txt)"
```

Record the exact test count and pass rate. Every V2 phase must restore a green suite before proceeding.

#### Step 0.4: One-Time V1 → V2 YAML Conversion

```bash
# Run the conversion task (built as first task in Phase 0)
mix loka.convert_yaml
git add priv/world/
git commit -m "chore: convert YAML to V2 format (one-time migration)"
```

The conversion task (see Section 19 for format details):
1. Moves quest top-level fields under `components.quest`
2. Moves dialogue trees under `components.dialogue_tree`
3. Renames `parent:` to `parent_key:` consistently
4. Moves room `exits:` to separate exit YAML files (or marks them for seeder extraction)
5. Moves room `spawns:` to `components.room.spawns`
6. Adds explicit `type:` fields to any YAML files missing them
7. Ensures all `scripts:` fields use flat `event_name: code_string` format
8. **Applies script code transformations** — 23 mechanical renames per Section 19 transform table
9. **Flags scripts using removed bindings** — 13 removed V1 bindings logged for manual review (see Section 19 Removed Bindings table)

After conversion, delete the conversion task code — it's a one-time tool.

#### Step 0.5: Dependency Audit

Verify these dependencies are still needed in V2:

| Dependency | V1 Usage | V2 Status |
|-----------|----------|-----------|
| `ecto_sqlite3` | DB access | **Keep** — still the DB layer |
| `jason` | JSON encode/decode for components | **Keep** — critical for JSON columns |
| `yaml_elixir` | YAML parsing for content | **Keep** — seeder reads YAML |
| `guardian` | JWT auth | **Keep** — auth layer unchanged |
| `phoenix_pubsub` | Event bus | **Keep** — PubSub unchanged |
| `req` | HTTP client (anthropic AI) | **Keep** — builder AI unchanged |
| `phoenix_live_view` | Admin dashboard | **Keep** — web layer unchanged |

No new dependencies needed for V2 core. The migration is pure architecture — same stack, new data model.

### The Three Rebuild Tiers

Every module in the codebase falls into exactly one tier:

#### Tier 1: Ground-Up Rewrite (New Code)

These modules are written from scratch. V1 code may be referenced for logic but is not evolved in place.

```
CREATE: lib/loka/engine/entity.ex                    (new Entity struct: no data/attributes/contents/locks fields)
CREATE: lib/loka/engine/schema/entity_schema.ex       (new Ecto schema for unified entities table)
CREATE: lib/loka/engine/schema/entity_tag_schema.ex   (new: entity_tags join table schema)
CREATE: lib/loka/engine/schema/entity_log_schema.ex   (new: audit log schema)
CREATE: lib/loka/engine/entities.ex                   (new: unified find/1 API, tag operations, batch ops)
CREATE: lib/loka/engine/entity_server.ex              (new: dispatch_event, snapshot rollback, force_save, volatile state)
CREATE: lib/loka/engine/entity_registry.ex            (new: get_or_start with DB loading, save_all_dirty)
CREATE: lib/loka/engine/entity_supervisor.ex          (new: DynamicSupervisor for regular entities, :transient)
CREATE: lib/loka/engine/system_supervisor.ex          (new: DynamicSupervisor for system entities, max_restarts: 5)
CREATE: lib/loka/engine/entity_seeder.ex              (new: YAML→DB with inheritance resolution, phased seeding)
CREATE: lib/loka/engine/entity_behavior.ex            (new: @behaviour with on_init/on_tick/on_event/on_terminate)
CREATE: lib/loka/engine/entity_server/volatile.ex     (new: process dictionary helpers for transient state)
CREATE: lib/loka/engine/spawner.ex                    (rewrite: spawn from DB prototypes, not TypedObject registry)
CREATE: lib/loka/components/*.ex                      (23 new component accessor modules — see Section 17)
CREATE: lib/loka/behaviors/*.ex                       (new: Weather, NpcAmbient, RoomAmbient, etc.)
CREATE: lib/mix/tasks/loka.export.ex                  (new: DB → YAML export task)
CREATE: lib/mix/tasks/loka.convert_yaml.ex            (one-time: V1→V2 YAML format conversion, deleted after use)
CREATE: lib/mix/tasks/loka.db.maintain.ex             (new: VACUUM, ANALYZE, audit log truncation)
CREATE: lib/mix/tasks/loka.inspect.ex                 (new: entity inspection, orphan detection)
CREATE: priv/repo/migrations/TIMESTAMP_create_unified_entities.exs
CREATE: priv/repo/migrations/TIMESTAMP_migrate_players_to_entities.exs
```

#### Tier 2: Evolve In Place (Modify Existing)

These modules keep their structure but swap their data access layer. Changes are mechanical — replace `TypedObject.Loader.get(key)` with `Entities.find(key: k, type: t)`, replace `GameState.get_field(gs, :health)` with `Combatant.health(entity)`, etc.

```
MODIFY: lib/loka/application.ex                       (new supervision tree: ~22 children, not ~50)
MODIFY: lib/loka/engine/event.ex                      (add correlation_id, caused_by to envelope)
MODIFY: lib/loka/engine/event_bus.ex                  (unchanged — PubSub wrapper stays)
MODIFY: lib/loka/engine/hooks.ex                      (thin: dispatch to EntityServer instead of direct callbacks)
MODIFY: lib/loka/engine/cooldowns.ex                  (unchanged — ETS infrastructure stays)
MODIFY: lib/loka/engine/constants/*.ex                (update WorldPaths if YAML directory structure changes)
MODIFY: lib/loka/engine/script/sandbox.ex             (update bindings to V2 API)
MODIFY: lib/loka/engine/script/bindings.ex            (rewrite: V2 bindings per Section 18)
MODIFY: lib/loka/engine/script/action_queue.ex        (update action types for V2 entity operations)
MODIFY: lib/loka/engine/script/validator.ex            (unchanged — security validation stays)
MODIFY: lib/loka/engine/script/scripts.ex             (update to load scripts from entity.scripts field)
MODIFY: lib/loka/engine/script/script_runner.ex       (update execution context for V2)
MODIFY: lib/loka/content/*.ex                         (12 modules: swap TypedObject.Loader → Entities.find)
MODIFY: lib/loka/framework/quest/progress.ex          (swap GameState → entity component operations)
MODIFY: lib/loka/framework/quest/progress/tracking.ex (swap GameState → entity component operations)
MODIFY: lib/loka/framework/quest/progress/rewards.ex  (swap GameState → Spawner + entity operations)
MODIFY: lib/loka/framework/quest/listeners.ex         (register with EntityServer events, not hooks)
MODIFY: lib/loka/framework/quest/journal.ex           (swap quest data access → entity components)
MODIFY: lib/loka/framework/quest/validator.ex         (validate entity component shape, not TypedObject)
MODIFY: lib/loka/framework/quest/metrics.ex           (unchanged — analytics stays)
MODIFY: lib/loka/framework/quest/admin.ex             (swap data access → Entities API)
MODIFY: lib/loka/framework/quest/timer_manager.ex     (swap quest data access; keep ETS timer tracking)
MODIFY: lib/loka/framework/quest/handlers/*.ex        (5 handlers: swap context from GameState → entity)
MODIFY: lib/loka/framework/quest/state_helper.ex      (swap GameState → entity component access)
MODIFY: lib/loka/framework/quest/quest_item_spawner.ex (swap Spawner calls for V2 API)
MODIFY: lib/loka/framework/combat/combat.ex           (swap entity access → EntityServer.get + Components)
MODIFY: lib/loka/framework/combat/combat_server.ex    (read from ETS live state, write via EntityServer.update)
MODIFY: lib/loka/framework/combat/combat_supervisor.ex (unchanged — DynamicSupervisor stays)
MODIFY: lib/loka/framework/combat/respawn_manager.ex  (swap entity access → Entities API + Spawner)
MODIFY: lib/loka/framework/inventory/inventory.ex     (swap GameState inventory → location_id queries)
MODIFY: lib/loka/framework/inventory/equipable.ex     (swap slot validation → Components.Equipment)
MODIFY: lib/loka/framework/inventory/equipment.ex     (swap GameState → entity component operations)
MODIFY: lib/loka/framework/inventory/stacking.ex      (unchanged — pure math)
MODIFY: lib/loka/framework/inventory/container.ex     (swap data access → Components.Container + Entities.find)
MODIFY: lib/loka/framework/skills/skill_manager.ex    (swap SkillRegistry → Entities.find(type: :skill))
MODIFY: lib/loka/framework/skills/binary_skill_manager.ex (swap registry → Entities.find)
MODIFY: lib/loka/framework/resources/resource_pool.ex (unchanged — ETS infrastructure stays)
MODIFY: lib/loka/framework/resources/formula_evaluator.ex (unchanged — safe formula eval)
MODIFY: lib/loka/framework/social/channel.ex          (unchanged — chat struct)
MODIFY: lib/loka/framework/social/channel_manager.ex  (unchanged — chat infrastructure)
MODIFY: lib/loka/framework/social/party.ex            (unchanged — party struct)
MODIFY: lib/loka/framework/social/party_manager.ex    (unchanged — party infrastructure)
MODIFY: lib/loka/framework/social/scoped_message.ex   (unchanged — message primitive)
MODIFY: lib/loka/framework/social/message_router.ex   (unchanged — routing)
MODIFY: lib/loka/framework/dialogue/dialogue.ex       (swap TypedObject → Entities.find for dialogue data)
MODIFY: lib/loka/framework/conditions/evaluator.ex    (swap data access → entity components)
MODIFY: lib/loka/framework/broadcast/broadcast.ex     (unchanged — PubSub helper)
MODIFY: lib/loka/framework/world/calendar.ex          (unchanged — pure math)
MODIFY: lib/loka/framework/world/atmosphere.ex        (unchanged — pure display logic)
MODIFY: lib/loka/framework/world/room.ex              (swap RoomLoader → EntityServer.get; delete RoomEvents)
MODIFY: lib/loka/framework/actions/resolver.ex        (swap GameState → entity operations)
MODIFY: lib/loka/framework/actions/action.ex          (unchanged — action types)
MODIFY: lib/loka/framework/content_validator/*.ex     (3 plugins: validate entity components, not TypedObjects)
MODIFY: lib/loka/config/balance.ex                     (unchanged — loads from YAML; may evolve to system entity later)
MODIFY: lib/loka/framework/world_graph/world_graph.ex (unchanged — pure coordinate math)
MODIFY: lib/loka/framework/world_graph/layout_manager.ex (unchanged — coordinate system)
MODIFY: lib/loka/session/*.ex                         (swap GameState refs → entity operations)
MODIFY: lib/loka/timers/*.ex                          (unchanged — persistent timer infrastructure)
MODIFY: lib/loka_web/channels/game_channel.ex         (~50 GameState refs → Entities API, ~15 TypedObject refs)
MODIFY: lib/loka_web/channels/room_helpers.ex         (swap RoomLoader → EntityServer.get + enrich)
MODIFY: lib/loka_web/channels/command_parser.ex       (unchanged — pure text parsing)
MODIFY: lib/loka_web/channels/builder_commands.ex     (dispatch unchanged; sub-modules update data access)
MODIFY: lib/loka_web/channels/builder_commands/*.ex   (16 sub-modules: swap YAML/dual-store → Entities API)
MODIFY: lib/loka_web/channels/game_channel/action_bridge.ex (swap GameState → entity context)
MODIFY: lib/loka_web/channels/game_channel/serializers.ex (unchanged — transport serialization)
MODIFY: lib/loka_web/live/admin_live/*.ex             (swap data sources → Entities API for dashboard stats)
```

#### Tier 2 Addendum: Previously Unmapped Modules

The following V1 modules were not in the original Tier 2 list. They are all Tier 2 (evolve in place) unless noted. Non-blocking for Phases 0-3 — address in Phases 4-6.

**Game Actions Layer** (`lib/loka/game/` — 11 modules, Phase 5):

These modules contain the game action implementations dispatched from `game_channel.ex`. They reference `GameState`, `PlayerGameState.update_state`, and various framework modules. Each needs the same mechanical `GameState → entity component` swaps as `game_channel.ex` (~25 `PlayerGameState.update_state` calls across the layer).

```
MODIFY: lib/loka/game/actions.ex                      (main dispatcher — swap GameState context → entity operations)
MODIFY: lib/loka/game/actions/bardo.ex                (death/respawn — swap GameState → Components.Combatant + Spawner)
MODIFY: lib/loka/game/actions/combat.ex               (combat actions — swap GameState → entity + CombatServer)
MODIFY: lib/loka/game/actions/container.ex            (container interact — swap GameState → Components.Container + Entities.find)
MODIFY: lib/loka/game/actions/context.ex              (action context struct — swap GameState fields → entity fields)
MODIFY: lib/loka/game/actions/dialogue.ex             (dialogue actions — swap TypedObject → Entities.find for dialogue data)
MODIFY: lib/loka/game/actions/gathering.ex            (gathering actions — swap registry → Entities.find for nodes)
MODIFY: lib/loka/game/actions/shop.ex                 (shop actions — swap Economy/Shop → entity scripts)
MODIFY: lib/loka/game/actions/social.ex               (social actions — swap SocialLoader → Entities.find(type: :social))
MODIFY: lib/loka/game/actions/spark.ex                (spark system — may be deleted if Spark is cut; otherwise swap data access)
MODIFY: lib/loka/game/actions/result.ex               (action result struct — unchanged, pure data)
```

**Mechanics Layer** (`lib/loka/mechanics/` — 8 modules, Phase 5):

Pure game math modules. Most are unchanged — they take numeric inputs and return numeric outputs. Only modules that read from `GameState` or registries need updates.

```
MODIFY: lib/loka/mechanics/stats.ex                   (stat calculations — swap GameState stat reads → get_component)
MODIFY: lib/loka/mechanics/character_resources.ex     (resource math — swap GameState → Components.Resources)
MODIFY: lib/loka/mechanics/combat_stats.ex            (combat formulas — swap GameState → Components.Combatant + Stats)
MODIFY: lib/loka/mechanics/check.ex                   (skill checks — swap stat reads → get_component)
MODIFY: lib/loka/mechanics/cost.ex                    (unchanged — pure cost validation math)
MODIFY: lib/loka/mechanics/damage.ex                  (unchanged — pure damage formula)
MODIFY: lib/loka/mechanics/damage_types.ex            (unchanged — damage type definitions, may move to component data later)
MODIFY: lib/loka/mechanics/heal.ex                    (unchanged — pure heal formula)
```

**V1 Behaviors** (`lib/loka/behaviors/` — 8 modules, Phase 3d):

**Decision: Rewrite to V2 EntityBehavior interface.** These modules implement `Loka.Behaviors.Base` callbacks (`init/1`, `act/1`, `react/2`). In V2, they must implement the new `Loka.Engine.EntityBehavior` callbacks (`on_init/1`, `on_tick/2`, `on_event/3`, `on_terminate/2`). The logic is preserved but the callback signatures change. Rewrite during Phase 3d (system entity boot) when the EntityBehavior interface is available.

```
REWRITE: lib/loka/behaviors/base.ex                   (V1 behaviour → DELETE, replaced by EntityBehavior in engine)
REWRITE: lib/loka/behaviors/aggressive.ex             (V1 → V2 EntityBehavior: init→on_init, act→on_tick, react→on_event)
REWRITE: lib/loka/behaviors/guard.ex                  (same pattern as aggressive)
REWRITE: lib/loka/behaviors/janitor.ex                (same pattern — item cleanup behavior)
REWRITE: lib/loka/behaviors/patrol.ex                 (same pattern — waypoint patrol)
REWRITE: lib/loka/behaviors/runner.ex                 (same pattern — flee behavior)
REWRITE: lib/loka/behaviors/scavenger.ex              (same pattern — item pickup)
REWRITE: lib/loka/behaviors/wander.ex                 (same pattern — random movement)
```

**World Builder Infrastructure** (`lib/loka/world_builder/` — 16 modules, Phase 6):

The builder_commands/ sub-modules (Section 38) dispatch to these manager modules. In V2, these managers simplify significantly because they no longer maintain YAML + DB dual-store sync — they just call `Entities` API.

```
MODIFY: lib/loka/world_builder/tool_executor.ex       (1,776 LOC — largest module. Swap YAML/dual-store → Entities API. Consider splitting into ~10 domain modules during rewrite)
MODIFY: lib/loka/world_builder/room_manager.ex        (simplify: remove YAML write + entity sync — just Entities.save)
MODIFY: lib/loka/world_builder/entity_manager.ex      (simplify: remove TypedObject.Loader refs → Entities API)
MODIFY: lib/loka/world_builder/quest_manager.ex       (swap TypedObject → Entities.find for quest CRUD)
MODIFY: lib/loka/world_builder/dialogue_manager.ex    (swap TypedObject → Entities.find for dialogue CRUD)
MODIFY: lib/loka/world_builder/yaml_builder.ex        (evolve: V2 YAML format generation for export, not runtime)
MODIFY: lib/loka/world_builder/validation_manager.ex  (swap TypedObject validation → entity component validation)
MODIFY: lib/loka/world_builder/respawner.ex           (swap Spawner calls → V2 Spawner API)
MODIFY: lib/loka/world_builder/script_templates.ex    (update templates to emit V2 script binding syntax)
MODIFY: lib/loka/world_builder/anthropic_client.ex    (unchanged — HTTP client for builder AI)
MODIFY: lib/loka/world_builder/audit_log.ex           (unchanged — builder audit logging)
MODIFY: lib/loka/world_builder/audit_log_entry.ex     (unchanged — audit log schema)
MODIFY: lib/loka/world_builder/llm/observability_logger.ex (unchanged — AI observability)
MODIFY: lib/loka/world_builder/mcp/router.ex          (unchanged — MCP routing, dev-only)
MODIFY: lib/loka/world_builder/mcp/server.ex          (unchanged — MCP server, dev-only)
MODIFY: lib/loka/world_builder/mcp/tools.ex           (swap data access → Entities API for MCP tool implementations)
```

**Engine Utilities** (scattered, Phases 4-6):

```
MODIFY: lib/loka/engine/zone.ex                       (swap ZoneRegistry → Entities.find(type: :zone). Keep zone struct/logic)
MODIFY: lib/loka/engine/zone_reset.ex                 (swap zone data access → entity operations for zone respawning)
MODIFY: lib/loka/engine/directions.ex                 (unchanged — pure direction constants and helpers)
MODIFY: lib/loka/engine/locks.ex                      (unchanged — lock checking logic; locks now in components per Decision 52)
MODIFY: lib/loka/engine/social_substitution.ex        (unchanged — pure text substitution)
MODIFY: lib/loka/engine/scripts.ex                    (update to load scripts from entity.scripts field instead of TypedObject)
MODIFY: lib/loka/engine/script/executor.ex            (update execution context for V2 entity model)
```

#### Tier 3: Delete Entirely

These modules are eliminated by the unified model. No replacement needed — their functionality is absorbed by entities, components, behaviors, or scripts.

```
DELETE: lib/loka/engine/typed_object.ex                (replaced by Entity struct)
DELETE: lib/loka/engine/typed_object/loader.ex         (replaced by EntitySeeder)
DELETE: lib/loka/engine/typed_object/registry.ex       (replaced by Entities.find)
DELETE: lib/loka/engine/typed_object/schema.ex         (replaced by EntitySchema)
DELETE: lib/loka/engine/schema/entity_attribute.ex     (merged into components JSON)
DELETE: lib/loka/engine/plugin.ex                      (replaced by system entities)
DELETE: lib/loka/engine/plugin_loader.ex               (replaced by EntitySeeder auto_start)
DELETE: lib/loka/engine/plugin_supervisor.ex            (replaced by SystemSupervisor)
DELETE: lib/loka/engine/social_loader.ex               (replaced by EntitySeeder)
DELETE: lib/loka/engine/world_loader.ex                (replaced by EntitySeeder — remove WorldLoader.spawn_world() call from application.ex)
DELETE: lib/loka/engine/zone_loader.ex                 (replaced by Entities.find(type: :zone))
DELETE: lib/loka/engine/zone_registry.ex               (replaced by Entities.find(type: :zone))
DELETE: lib/loka/plugins/ (entire directory)
DELETE: lib/loka/framework/player/game_state.ex        (replaced by character entity components)
DELETE: lib/loka/framework/quest/quest_registry.ex     (replaced by Entities.find(type: :quest))
DELETE: lib/loka/framework/quest/objective_registry.ex (replaced by script hooks on quest entities)
DELETE: lib/loka/framework/quest/chain_registry.ex     (replaced by Entities.find(type: :storyline))
DELETE: lib/loka/framework/quest/chain.ex              (replaced by storyline entity components)
DELETE: lib/loka/framework/quest/definitions.ex        (quest definitions are entities)
DELETE: lib/loka/framework/quest/quest.ex              (facade module — quest is now an entity type)
DELETE: lib/loka/framework/storyline/storyline.ex      (replaced by storyline entities)
DELETE: lib/loka/framework/storyline/storyline_registry.ex (replaced by Entities.find(type: :storyline))
DELETE: lib/loka/framework/skills/skill.ex             (skill definitions are entities)
DELETE: lib/loka/framework/skills/skill_registry.ex    (replaced by Entities.find(type: :skill))
DELETE: lib/loka/framework/skills/binary_skill.ex      (merged into skill entity model)
DELETE: lib/loka/framework/skills/binary_skill_registry.ex (replaced by Entities.find)
DELETE: lib/loka/framework/resources/resource.ex       (resource definitions are entities)
DELETE: lib/loka/framework/resources/resource_registry.ex (replaced by Entities.find(type: :resource))
DELETE: lib/loka/framework/resources/resource_ticker.ex (replaced by system entity script)
DELETE: lib/loka/framework/status/status_effect.ex     (status definitions are entities)
DELETE: lib/loka/framework/status/status_registry.ex   (replaced by Entities.find(type: :status))
DELETE: lib/loka/framework/combat/damage_types.ex      (damage types in weapon component data)
DELETE: lib/loka/framework/combat/damage_message.ex    (moved to script — builder-customizable)
DELETE: lib/loka/framework/economy/economy.ex          (replaced by script on NPC entities)
DELETE: lib/loka/framework/economy/shop.ex             (replaced by script on NPC entities)
DELETE: lib/loka/framework/crafting/crafting.ex         (rebuild as scripts when needed)
DELETE: lib/loka/framework/crafting/recipe.ex           (recipe definitions are entities)
DELETE: lib/loka/framework/crafting/crafting_registry.ex (replaced by Entities.find(type: :recipe))
DELETE: lib/loka/framework/crafting/crafting_station.ex (station data in room entity components)
DELETE: lib/loka/framework/gathering/gathering.ex      (rebuild as scripts when needed)
DELETE: lib/loka/framework/gathering/gathering_node.ex (node definitions are entities)
DELETE: lib/loka/framework/gathering/gathering_registry.ex (replaced by Entities.find)
DELETE: lib/loka/framework/inventory/loot_table.ex     (moved to script — builder-customizable)
DELETE: lib/loka/framework/inventory/container_respawn.ex (moved to system entity script)
DELETE: lib/loka/framework/progression/progression.ex  (XP/level formula → inline in Components.Stats or script)
DELETE: lib/loka/framework/world/weather.ex            (moved to system entity + behavior)
DELETE: lib/loka/framework/world/day_night.ex          (moved to system entity + behavior)
DELETE: lib/loka/framework/world/room_ambient.ex       (moved to room entity scripts)
DELETE: lib/loka/framework/world/sound_environment.ex  (zone entity components)
DELETE: lib/loka/framework/scripting/world_event_handler.ex (replaced by EntityServer event dispatch)
DELETE: lib/loka/framework/scripting/config_schema.ex  (replaced by component data)
DELETE: lib/loka/framework/scripting/behavior_registry.ex (behaviors stored in entity.behaviors field)
DELETE: lib/loka/framework/registry_base.ex            (no more ETS registries)
DELETE: lib/loka/framework/spark/ (entire directory)   (post-launch feature, no content, no tests)
DELETE: test/support/typed_object_sandbox.ex           (no ETS registry to sandbox)
DELETE: test/support/test_cleanup.ex                   (no YAML files created in tests)
```

### Phase Dependency Graph

```
Phase 0 (Preparation)
    │
    ▼
Phase 1 (Foundation) ─── entity.ex, entity_schema.ex, entities.ex, migration
    │
    ├── Blocker for ALL subsequent phases (nothing works without the new schema)
    │
    ▼
Phase 2 (Seeder) ─── entity_seeder.ex, YAML parsing, inheritance resolution
    │
    ├── Blocker for Phase 3 (EntityServer needs data in DB to load)
    │
    ▼
Phase 3 (EntityServer) ─── entity_server.ex, entity_registry.ex, entity_behavior.ex
    │
    ├── Phase 3a: EntityServer core (load, save, force_save, reload, version)
    ├── Phase 3b: Behavior dispatch (dispatch_event, snapshot rollback, middleware)
    ├── Phase 3c: Tick system (Process.send_after, idle timeout)
    ├── Phase 3d: System entities (SystemSupervisor, auto_start boot)
    │
    ├── Phases 4 and 5 can now proceed (they need working EntityServer)
    │
    ▼
Phase 4 (Player Migration) ──┬── Phase 5 (Content + Actions Migration)
    │                         │
    ├── Can run in PARALLEL    ├── Content modules don't reference GameState
    │   with Phase 5           │   GameState doesn't reference content modules
    │                         │
    ▼                         ▼
Phase 6 (Cleanup) ─── delete old code, simplify builder, create export task
    │
    ▼
Phase 7 (Polish) ─── component accessor modules, behavior modules, new tests
```

**Critical path:** Phases 0→1→2→3 are strictly sequential. Phases 4 and 5 can overlap. Phase 6 requires both 4 and 5 complete. Phase 7 can overlap with Phase 6.

### Phase-Internal Ordering (What Blocks What)

#### Within Phase 1:
1. Migration SQL (creates tables) — blocks everything
2. EntityTagSchema (needs entity_tags table) — blocks Entities API
3. EntityLogSchema (needs entity_log table) — independent
4. Entity struct evolution (no DB dependency) — can parallel with #1
5. EntitySchema (needs Entity struct + migration) — blocks Entities API
6. Entities API (needs EntitySchema + EntityTagSchema) — blocks tests
7. Tests (needs everything above)

#### Within Phase 3:
1. EntityBehavior callback module (no deps) — can start immediately
2. Volatile state module (no deps) — can start immediately
3. EntityServer core (needs Entity struct from Phase 1) — blocks everything below
4. EntityRegistry (needs EntityServer) — blocks system entity boot
5. Behavior dispatch in EntityServer (needs EntityBehavior) — blocks system entities
6. Tick system (needs EntityServer core) — can parallel with behavior dispatch
7. SystemSupervisor (needs EntityRegistry) — blocks system entity boot
8. System entity auto_start boot (needs everything above)

---

## 38. Builder Commands Migration Detail

The MUD terminal builder (`/admin/builder`) has 16 sub-modules under `LokaWeb.Channels.BuilderCommands`. These are the primary authoring interface and deserve explicit migration planning.

### What Doesn't Change

| Module | Why |
|--------|-----|
| `Help` | Pure text output — no data layer calls |
| `Formatter` | Pure text formatting — no data layer calls |
| `Guides` | Reads from filesystem — no entity system calls |
| `AI` | AI integration — data access is indirect via other commands |
| `Map` | Uses WorldGraph (kept) — minor room data access swap |
| `Navigation` | Teleport + room lookup — swap to EntityServer.get / Entities.find |

### What Changes (Mechanical Data Access Swap)

Each builder sub-module's changes follow the same pattern:

```elixir
# Before (V1): YAML + ETS + DB dual-store
TypedObject.Loader.get(key)                    →  Entities.find(key: key, type: type)
RoomManager.create_room(data)                  →  Entities.save(Entity.new(%{type: :room, ...}))
RoomManager.update_room(room, changes)         →  EntityServer.update(room_id, fn e -> ... end)
Spawner.spawn_entity(key, location_id)         →  Spawner.spawn(key, location_id: room_id)
TypedObject.Loader.reload()                    →  (not needed — DB is always current)
```

| Module | Changes | Scope |
|--------|---------|-------|
| **Rooms** | Room CRUD: `RoomManager` → `Entities.save` + `EntityServer.update`. Exit CRUD: create/delete exit entities instead of inline exits. No more dual-store sync. | ~200 LOC |
| **Entities** | NPC/Item CRUD: swap TypedObject + Spawner calls to unified Entities API | ~150 LOC |
| **Content** | Quest/dialogue CRUD: swap TypedObject → Entities.find/save | ~100 LOC |
| **Zones** | Zone CRUD: swap ZoneRegistry/ZoneLoader → Entities.find(type: :zone) | ~80 LOC |
| **Storylines** | Storyline CRUD: swap StorylineRegistry → Entities.find(type: :storyline) | ~60 LOC |
| **Cutscenes** | Cutscene CRUD: swap TypedObject → Entities.find | ~50 LOC |
| **Scripts** | Script CRUD: swap Content.Script → Entities.find(type: :script) | ~80 LOC |
| **Testing** | Spawn/purge/give: swap Spawner + GameState → Entities API | ~100 LOC |
| **Publishing** | Publish/unpublish: swap YAML file ops → entity metadata updates | ~120 LOC |
| **Inspection** | Info/list/find: swap TypedObject → Entities.find queries | ~80 LOC |
| **World** | Reload: swap TypedObject.Loader.reload → EntitySeeder.reload_file | ~40 LOC |
| **Helpers** | Teleport/normalize: swap room lookup → Entities.find | ~30 LOC |

**Total: ~1,090 LOC of mechanical changes across 12 sub-modules.**

### The Big Simplification

The current builder commands have the most complex code paths in the entire codebase because they must sync YAML files, ETS registry, AND SQLite DB. V2 eliminates all of that:

```
Before (V1): Builder command → write YAML → reload ETS → sync DB entity → sync DB attributes
After (V2):  Builder command → EntityServer.update() → done (auto-saves to DB in 60s or force_save)
```

The `Publishing` module becomes trivially simple: instead of moving YAML files between `drafts/` and published directories, publishing just updates `metadata["draft"]` on the entity. Unpublishing sets it back.

### Draft System in V2

Drafts become a metadata flag rather than a filesystem concept:

```elixir
# Create draft
Entities.save(Entity.new(%{type: :room, key: "dark_cave", metadata: %{"draft" => true}}))

# Publish
EntityServer.update(entity_id, fn e ->
  %{e | metadata: Map.put(e.metadata, "draft", false)}
end)

# List drafts
Entities.find(type: :room, component: {"metadata.draft", true})
# Or better: use a tag
Entities.find(tags: ["draft"])
```

Using a `"draft"` tag is cleaner than a metadata field because tags are indexed. Builder commands like `list drafts` become `Entities.find(tags: ["draft"])` — one query, indexed, fast.

---

## 39. Web/LiveView Layer Migration

The web layer (LiveView admin dashboard, auth controllers, API endpoints) changes minimally. It's all in Tier 2 (evolve in place).

### What Doesn't Change At All

| Component | Path | Why |
|-----------|------|-----|
| Auth controllers | `lib/loka_web/controllers/` | No entity system calls |
| Auth plugs | `lib/loka_web/plugs/` | Session/JWT — no game data |
| Router | `lib/loka_web/router.ex` | Route definitions unchanged |
| Endpoint | `lib/loka_web/endpoint.ex` | HTTP config unchanged |
| UserSocket | `lib/loka_web/channels/user_socket.ex` | JWT auth unchanged |
| VersionCompatibility | `lib/loka_web/channels/version_compatibility.ex` | Client version checking |
| ChannelRateLimiter | `lib/loka_web/channels/channel_rate_limiter.ex` | Rate limiting |
| Assets (CSS/JS) | `assets/` | Frontend unchanged |
| Templates | `lib/loka_web/components/` | UI components unchanged |
| API controllers | `lib/loka_web/controllers/api/` | Auth API only |

### What Changes (Mechanical Swaps)

#### Admin Dashboard LiveView

The admin dashboard (`lib/loka_web/live/admin_live/`) displays game statistics and player information. Changes:

```elixir
# Before
player_count = length(Session.Registry.online_players())
entity_count = Entities.count()  # V1: from old entities table
room_count = TypedObject.Loader.count_by_type("room")

# After
player_count = length(Session.Registry.online_players())  # unchanged
entity_count = Entities.find(type: :npc) |> length()     # or Repo.aggregate
room_count = Entities.find(type: :room) |> length()       # from unified table
```

The admin dashboard has ~5 LiveView modules. Changes are small — swapping data source calls.

#### GameChannel

`game_channel.ex` is the largest single file (~1,500 LOC) and the primary consumer of the game data layer. It has ~50 `GameState` references and ~15 `TypedObject` references. All are mechanical swaps:

```elixir
# Pattern 1: GameState reads
# Before
health = PlayerGameState.get_field(socket.assigns.game_state, :health)
# After
health = Components.Combatant.health(socket.assigns.character)

# Pattern 2: GameState writes
# Before
{:ok, gs} = PlayerGameState.update_state(gs, %{health: new_health})
# After
EntityServer.update(char_id, fn e -> Components.Combatant.set_health(e, new_health) end)

# Pattern 3: Room loading
# Before
room = RoomHelpers.load_room_for_display(room_id)
# After
{:ok, room} = EntityServer.get(room_id)  # or Entities.find(room_id)

# Pattern 4: TypedObject lookups
# Before
{:ok, quest} = TypedObject.Loader.get("intro_welcome")
# After
{:ok, quest} = Entities.find(key: "intro_welcome", type: :quest)
```

#### Channel `join/3` Flow

The most important single function to migrate:

```elixir
# Before (V1)
def join("game:" <> player_id, _params, socket) do
  player = socket.assigns.player
  game_state = PlayerGameState.get_or_create_state(player.id)
  room = RoomHelpers.load_room_for_display(game_state.current_room_id)
  # ... setup socket assigns with game_state, room, etc.
end

# After (V2)
def join("game:" <> player_id, _params, socket) do
  player = socket.assigns.player
  {:ok, character} = Entities.find(account_id: player.id)  # indexed lookup
  {:ok, _pid} = EntityRegistry.get_or_start(character.id)  # start GenServer
  {:ok, room} = EntityServer.get(character.location_id)     # live room state
  Entities.add_tag(character.id, "online")                  # mark online
  # ... setup socket assigns with character, room, etc.
end
```

---

## 40. Post-V2 Directory Structure

What the codebase looks like when all phases are complete.

```
server/
├── lib/
│   ├── loka/
│   │   ├── engine/                          # Core engine (~20 modules)
│   │   │   ├── entity.ex                    # Entity struct + Entity.new/1 + Entity.snapshot/1
│   │   │   ├── entities.ex                  # Unified find/1 API, tag ops, write ops
│   │   │   ├── entity_server.ex             # GenServer per entity: dispatch, save, reload, volatile
│   │   │   ├── entity_server/
│   │   │   │   └── volatile.ex              # Process dictionary helpers for transient state
│   │   │   ├── entity_registry.ex           # get_or_start, save_all_dirty
│   │   │   ├── entity_supervisor.ex         # DynamicSupervisor for regular entities
│   │   │   ├── system_supervisor.ex         # DynamicSupervisor for system entities (max_restarts: 5)
│   │   │   ├── entity_seeder.ex             # YAML→DB seeding with inheritance resolution
│   │   │   ├── entity_behavior.ex           # @behaviour callback definitions
│   │   │   ├── spawner.ex                   # Prototype→instance spawning from DB
│   │   │   ├── event.ex                     # Event struct (with correlation_id, caused_by)
│   │   │   ├── event_bus.ex                 # PubSub wrapper
│   │   │   ├── hooks.ex                     # Thin dispatch → EntityServer events
│   │   │   ├── cooldowns.ex                 # ETS-backed cooldowns (infrastructure)
│   │   │   ├── social.ex                    # Social/emote struct (kept as data type)
│   │   │   ├── schema/
│   │   │   │   ├── entity_schema.ex         # Ecto schema for entities table
│   │   │   │   ├── entity_tag_schema.ex     # Ecto schema for entity_tags join table
│   │   │   │   ├── entity_log_schema.ex     # Ecto schema for entity_log audit table
│   │   │   │   └── player.ex               # Auth-only player schema (unchanged)
│   │   │   ├── constants/
│   │   │   │   └── world_paths.ex           # YAML directory paths
│   │   │   └── script/                      # Sandboxed scripting engine
│   │   │       ├── sandbox.ex               # Script execution environment
│   │   │       ├── bindings.ex              # V2 bindings (Section 18)
│   │   │       ├── action_queue.ex          # Queued action execution
│   │   │       ├── validator.ex             # Static security analysis
│   │   │       ├── scripts.ex               # Script loading from entity.scripts
│   │   │       └── script_runner.ex         # Execution orchestration
│   │   │
│   │   ├── components/                      # Component accessor modules (~23 modules)
│   │   │   ├── combatant.ex                 # health, attack, defense, damage, heal
│   │   │   ├── player.ex                    # settings, character_name
│   │   │   ├── stats.ex                     # str, dex, sta, level, xp
│   │   │   ├── quest_progress.ex            # active, completed, failed
│   │   │   ├── quest_def.ex                 # objectives, rewards, giver
│   │   │   ├── skills.ex                    # learned skill list
│   │   │   ├── resources.ex                 # gold, xp, mana
│   │   │   ├── equipment.ex                 # slot → entity UUID map
│   │   │   ├── room.ex                      # spawns config
│   │   │   ├── coordinates.ex               # x, y, z
│   │   │   ├── exit.ex                      # direction, destination
│   │   │   ├── physical.ex                  # weight, stackable
│   │   │   ├── weapon.ex                    # damage, type, speed
│   │   │   ├── armor.ex                     # defense, type
│   │   │   ├── container.ex                 # capacity, locked
│   │   │   ├── dialogue_tree.ex             # nodes, options
│   │   │   ├── zone_config.ex               # level_range, theme
│   │   │   ├── skill_def.ex                 # cooldown, cost, effects
│   │   │   ├── recipe_def.ex                # ingredients, output
│   │   │   ├── emotes.ex                    # idle, combat, greeting
│   │   │   ├── spawnable.ex                 # respawn_time, max_instances
│   │   │   ├── tick.ex                      # interval (single source of truth)
│   │   │   ├── service.ex                   # boot priority for system entities
│   │   │   └── locks.ex                     # access control rules
│   │   │
│   │   ├── behaviors/                       # Behavior implementations (~5-10 modules)
│   │   │   ├── weather.ex                   # Weather system entity behavior
│   │   │   ├── day_night.ex                 # Day/night cycle behavior
│   │   │   ├── npc_ambient.ex               # NPC idle emotes, reactions
│   │   │   └── room_ambient.ex              # Room atmospheric messages
│   │   │
│   │   ├── content/                         # Content access modules (~12 modules, evolved)
│   │   │   ├── quest.ex                     # Quest entity access wrapper
│   │   │   ├── dialogue.ex                  # Dialogue entity access wrapper
│   │   │   ├── script.ex                    # Script entity access wrapper
│   │   │   ├── zone.ex                      # Zone entity access wrapper
│   │   │   ├── skill.ex                     # Skill entity access wrapper
│   │   │   └── ...
│   │   │
│   │   ├── framework/                       # Thin dispatch + kept infrastructure (~40 modules)
│   │   │   ├── quest/                       # Quest system (8 kept + 5 thinned)
│   │   │   │   ├── progress.ex              # Core state machine
│   │   │   │   ├── progress/
│   │   │   │   │   ├── tracking.ex          # Objective completion
│   │   │   │   │   └── rewards.ex           # Reward dispatch
│   │   │   │   ├── listeners.ex             # EntityServer event registration
│   │   │   │   ├── journal.ex               # Journal rendering
│   │   │   │   ├── validator.ex             # Content validation
│   │   │   │   ├── metrics.ex               # Analytics
│   │   │   │   ├── admin.ex                 # Admin ops
│   │   │   │   ├── timer_manager.ex         # Timer tracking
│   │   │   │   ├── objective_handler.ex     # Handler behaviour
│   │   │   │   ├── handlers/                # 5 objective handlers
│   │   │   │   ├── state_helper.ex          # Quest state convenience
│   │   │   │   └── quest_item_spawner.ex    # Quest reward spawning
│   │   │   ├── combat/                      # Combat system (5 kept)
│   │   │   │   ├── combat.ex                # Turn order + targeting
│   │   │   │   ├── combat_server.ex         # Per-combat GenServer
│   │   │   │   ├── combat_supervisor.ex     # DynamicSupervisor
│   │   │   │   └── respawn_manager.ex       # Respawn timers
│   │   │   ├── inventory/                   # Inventory (4 kept)
│   │   │   │   ├── inventory.ex             # CRUD operations
│   │   │   │   ├── equipable.ex             # Slot validation
│   │   │   │   ├── equipment.ex             # Equipment management
│   │   │   │   └── stacking.ex              # Stack math
│   │   │   ├── skills/                      # Skills (2 thinned)
│   │   │   │   ├── skill_manager.ex         # Point allocation
│   │   │   │   └── binary_skill_manager.ex  # Learning logic
│   │   │   ├── resources/                   # Resources (2 kept)
│   │   │   │   ├── resource_pool.ex         # ETS-backed pools
│   │   │   │   └── formula_evaluator.ex     # Safe formula eval
│   │   │   ├── social/                      # Social (6 kept, unchanged)
│   │   │   │   ├── channel.ex
│   │   │   │   ├── channel_manager.ex
│   │   │   │   ├── party.ex
│   │   │   │   ├── party_manager.ex
│   │   │   │   ├── scoped_message.ex
│   │   │   │   └── message_router.ex
│   │   │   ├── status/                      # Status (1 kept)
│   │   │   │   └── status_manager.ex        # Active effect tracking
│   │   │   ├── dialogue/
│   │   │   │   └── dialogue.ex              # NPC dialogue interaction
│   │   │   ├── conditions/
│   │   │   │   └── evaluator.ex             # Condition evaluation
│   │   │   ├── broadcast/
│   │   │   │   └── broadcast.ex             # PubSub helper
│   │   │   ├── world/
│   │   │   │   ├── room.ex                  # Room display (thinned)
│   │   │   │   ├── calendar.ex              # Pure time math
│   │   │   │   └── atmosphere.ex            # Pure display logic
│   │   │   ├── world_graph/
│   │   │   │   ├── world_graph.ex           # Coordinate math
│   │   │   │   └── layout_manager.ex        # Room positioning
│   │   │   ├── actions/
│   │   │   │   ├── resolver.ex              # Action dispatch
│   │   │   │   └── action.ex                # Action types
│   │   │   ├── config/
│   │   │   │   └── balance.ex               # Game balance formulas
│   │   │   └── content_validator/
│   │   │       ├── quest_plugin.ex           # Quest validation
│   │   │       ├── dialogue_plugin.ex        # Dialogue validation
│   │   │       └── world_plugin.ex           # World validation
│   │   │
│   │   ├── game/                            # Game actions layer (11 modules, evolved)
│   │   │   ├── actions.ex                   # Main dispatcher
│   │   │   └── actions/                     # 10 action modules (combat, dialogue, shop, etc.)
│   │   │
│   │   ├── mechanics/                       # Game math (8 modules, mostly unchanged)
│   │   │   ├── stats.ex                     # Stat calculations (evolved)
│   │   │   ├── combat_stats.ex              # Combat formulas (evolved)
│   │   │   ├── character_resources.ex       # Resource math (evolved)
│   │   │   ├── check.ex                     # Skill checks (evolved)
│   │   │   ├── cost.ex                      # Cost validation (unchanged)
│   │   │   ├── damage.ex                    # Damage formula (unchanged)
│   │   │   ├── damage_types.ex              # Damage types (unchanged)
│   │   │   └── heal.ex                      # Heal formula (unchanged)
│   │   │
│   │   ├── session/                         # Session layer (unchanged)
│   │   └── timers/                          # Persistent timers (unchanged)
│   │
│   └── loka_web/                            # Web layer (evolved in place)
│       ├── channels/
│       │   ├── game_channel.ex              # Main game channel (evolved)
│       │   ├── game_channel/
│       │   │   ├── action_bridge.ex         # Action dispatch (evolved)
│       │   │   └── serializers.ex           # Transport serialization (unchanged)
│       │   ├── room_helpers.ex              # Room display helpers (evolved)
│       │   ├── command_parser.ex            # Text parsing (unchanged)
│       │   ├── builder_commands.ex          # Dispatch (unchanged)
│       │   └── builder_commands/            # 16 sub-modules (evolved)
│       └── live/                            # LiveView admin (evolved)
│
├── priv/
│   ├── world/                               # YAML content (V2 format after conversion)
│   │   ├── prototypes/                      # NPC, item, room prototypes
│   │   ├── quests/                          # Quest definitions
│   │   ├── dialogues/                       # Dialogue trees
│   │   ├── zones/                           # Zone metadata
│   │   ├── storylines/                      # Storyline chains
│   │   ├── skills/                          # Skill definitions
│   │   ├── scripts/                         # Script entities
│   │   ├── systems/                         # System entity definitions (weather, etc.)
│   │   └── socials.yml                      # Social/emote definitions
│   └── repo/
│       └── migrations/
│           ├── *_create_players.exs          # Auth table (kept)
│           ├── *_create_unified_entities.exs # New: entities + entity_tags + entity_log
│           └── *_migrate_players_to_entities.exs # New: GameState → character entities
│
└── test/
    ├── support/
    │   ├── data_case.ex                     # Simplified: Ecto sandbox only
    │   ├── entity_helpers.ex                # New: create_room, create_npc, create_character, etc.
    │   └── engine_fixtures.ex               # Evolved: entity fixture factory
    └── ...                                  # Tests rewritten to use Ecto sandbox patterns
```

### Module Count: Before vs After

| Layer | V1 Modules | V2 Modules | Change |
|-------|-----------|-----------|--------|
| **Engine** | ~52 | ~20 | -32 (unified model eliminates stores) |
| **Components** | 0 | ~23 | +23 (new layer for typed component access) |
| **Behaviors** | 8 | ~12 | +4 (V1 rewrites + new system behaviors) |
| **Content** | ~12 | ~12 | 0 (evolved, same API, different backend) |
| **Framework** | ~85 | ~40 | -45 (registries deleted, logic → scripts) |
| **Game Actions** | ~11 | ~11 | 0 (evolved — GameState → entity operations) |
| **Mechanics** | ~8 | ~8 | 0 (mostly unchanged — pure math) |
| **Session** | ~5 | ~5 | 0 (unchanged) |
| **Timers** | ~3 | ~3 | 0 (unchanged) |
| **Web** | ~80 | ~80 | 0 (evolved in place, same structure) |
| **Total** | ~264 | ~214 | **-50 modules** |

The reduction comes entirely from eliminating redundant registries, stores, and definition modules that are absorbed by the unified entity table. The +27 new modules (components + new behaviors) are smaller and simpler than the ~77 they replace. The game actions and mechanics layers are counted separately for visibility — they were previously omitted from the V1 count.

---

## 41. Test Migration Strategy

### V1 Test Inventory and V2 Fate

| Test Category | V1 Files | V2 Fate |
|--------------|---------|---------|
| **Engine core** (entity, entities, entity_server, entity_registry) | ~12 | **Rewrite** — new schema, new API |
| **TypedObject** (loader, registry, schema) | ~5 | **Delete** — no TypedObject in V2 |
| **Script** (sandbox, bindings, action_queue, validator) | ~8 | **Evolve** — update bindings, same patterns |
| **Framework registries** (quest, skill, status, etc.) | ~14 | **Delete** — no registries in V2 |
| **Framework logic** (combat, inventory, quest progress) | ~25 | **Evolve** — swap data access, same logic tests |
| **Content modules** | ~8 | **Evolve** — swap backend, same API tests |
| **Channel/integration** (game_channel, builder, ChannelBot) | ~15 | **Evolve** — swap setup, same behavior tests |
| **LiveView/web** | ~10 | **Evolve** — minimal changes |
| **Content validation** (YAML, balance) | ~12 | **Evolve** — validate entities not TypedObjects |
| **Player/GameState** | ~5 | **Delete** — replaced by character entity tests |
| **Support modules** | ~3 | **Evolve** — simplify (no TypedObjectSandbox) |
| **New V2 tests** | 0 | **Create** — EntitySeeder, components, behaviors |
| **Total** | ~117 test files | ~95 test files after migration |

### New Test Files to Create

```
CREATE: test/loka/engine/entities_v2_test.exs           (unified find/1 API, tag ops, batch ops)
CREATE: test/loka/engine/entity_seeder_test.exs          (idempotent seeding, inheritance, conflicts)
CREATE: test/loka/engine/entity_server_v2_test.exs       (dispatch_event, snapshot rollback, force_save)
CREATE: test/loka/engine/entity_behavior_test.exs        (behavior callback dispatch, middleware pipeline)
CREATE: test/loka/engine/entity_server/volatile_test.exs (volatile state get/set, process guard)
CREATE: test/loka/components/*_test.exs                  (one per component module — can be async: true)
CREATE: test/loka/behaviors/*_test.exs                   (behavior unit tests — Pattern F)
CREATE: test/support/entity_helpers.ex                   (create_room, create_npc, create_character, etc.)
```

### Test Infrastructure Simplification

| V1 Complexity | V2 Simplification |
|--------------|-------------------|
| `TypedObjectSandbox.checkout()` in every test touching content | **Deleted.** Ecto sandbox handles everything. |
| `TestCleanup.cleanup_draft_files()` | **Deleted.** No YAML files in tests. |
| `on_exit(fn -> TypedObject.Loader.reload() end)` | **Deleted.** No loader to reload. |
| Pre/post-suite draft directory sweeps in `test_helper.exs` | **Deleted.** No draft files. |
| `Ecto.Adapters.SQL.Sandbox.allow(Repo, self(), SomeRegistry)` for 14 registries | **Deleted.** No ETS registries. |
| Tests creating YAML files under `priv/world/drafts/` | **Deleted.** Tests create entities via API. |
| `async: false` on most tests (shared ETS state) | **Many can become `async: true`** — component tests are pure functions |

### Migration Order for Tests

1. **Phase 1:** Write new Entities API tests first (they validate the foundation)
2. **Phase 2:** Write EntitySeeder tests (they validate data loading)
3. **Phase 3:** Write EntityServer tests (they validate runtime behavior)
4. **Phase 4:** Evolve GameState-dependent tests → character entity tests
5. **Phase 5:** Evolve TypedObject-dependent tests → Entities.find tests
6. **Phase 6:** Delete all TypedObject, Registry, and GameState tests
7. **Phase 7:** Write component and behavior unit tests (can parallel with Phase 6)
