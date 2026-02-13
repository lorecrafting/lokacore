# V2 Unified Entity System — Migration Tasks

> **Design doc**: `docs/architecture/unified-object-system-v2.md` (reference only — too large for context)
> **Phase specs**: `docs/v2-migration/phase-*.md` (focused extracts, fit in context)
> **Branch**: `v2/unified-entity-system`

## How to Use

1. Start each Claude Code session with:
   ```
   We're implementing V2 of Loka's entity system.
   - Master task list: docs/v2-migration/TASKS.md
   - This phase's spec: docs/v2-migration/phase-N-*.md
   - Full V2 design (reference only, 300KB): docs/architecture/unified-object-system-v2.md

   Implement Task N.X. Read the phase spec first, then implement.
   After implementation, run the verify command from TASKS.md.
   Commit with the specified message when green.
   ```
2. Mark tasks `[x]` as you complete them
3. Each task ends with a green test suite and a commit

---

## Phase 0: Preparation
**Spec**: `phase-0-preparation.md`

- [x] **0.1** Archive V1 + create working branch
  - Creates: `archive/v1-final` branch, `v2/unified-entity-system` branch
  - Verify: `git branch | grep v2/unified`
  - Commit: none (branch creation)

- [x] **0.2** Record test baseline
  - Run: `cd server && mix test --trace 2>&1 | tee ../v1-test-baseline.txt`
  - Run: `mix loka.test.validate 2>&1 | tee ../v1-validation-baseline.txt`
  - Verify: baseline files exist with pass counts
  - Commit: none (reference files)

- [x] **0.3** Write `mix loka.convert_yaml` task
  - Creates: `lib/mix/tasks/loka.convert_yaml.ex`
  - Spec: Section 19 transform tables (23 renames + 13 removed bindings)
  - Verify: `mix loka.convert_yaml --dry-run` shows planned changes
  - Commit: `"chore(v2): add one-time YAML conversion task"`

- [x] **0.4** Run YAML conversion + commit results
  - Modifies: ~100 YAML files in `priv/world/`
  - Run: `mix loka.convert_yaml`
  - Verify: `mix loka.test.validate` (content validation still passes)
  - Commit: `"chore(v2): convert YAML to V2 format (one-time migration)"`
  - Then DELETE the conversion task code and commit: `"chore(v2): remove one-time YAML conversion task"`

---

## Phase 1: Foundation
**Spec**: `phase-1-foundation.md` | **Blocks**: everything

- [x] **1.1** Create unified entities migration
  - Creates: `priv/repo/migrations/TIMESTAMP_create_unified_entities.exs`
  - Creates: `lib/loka/engine/schema/entity_tag_schema.ex`
  - Creates: `lib/loka/engine/schema/entity_log_schema.ex`
  - Verify: `mix ecto.migrate && mix ecto.rollback && mix ecto.migrate`
  - Commit: `"feat(v2): create unified entities + entity_tags + entity_log tables"`

- [x] **1.2** Evolve Entity struct
  - Modifies: `lib/loka/engine/entity.ex`
  - Changes: Remove `data`, `attributes`, `contents`, `locks`, `parent_key` fields. Add `version`. Add `Entity.new/1` + `Entity.snapshot/1`
  - Verify: `mix compile --warnings-as-errors`
  - Note: This will break many things temporarily — that's expected. Fix compile errors in 1.3.
  - Commit: `"feat(v2): evolve Entity struct — remove data/attributes/contents/locks, add version"`

- [x] **1.3** Evolve EntitySchema + Entities API
  - Modifies: `lib/loka/engine/schema/entity_schema.ex`
  - Modifies: `lib/loka/engine/entities.ex`
  - Changes: EntitySchema points at new table, removes `data` column. Entities gets `find_one/1`, `find_all/1`, `find/1`, `find_many/1`, `save/1`, `delete/1`, tag operations
  - Verify: `mix compile --warnings-as-errors` (fix remaining breaks from 1.2)
  - Commit: `"feat(v2): evolve EntitySchema + Entities API with unified find"`

- [x] **1.4** Write Entities API tests
  - Creates: `test/loka/engine/entities_v2_test.exs`
  - Tests: CRUD, find_one (UUID, key+type, account_id), find_all (type, location, tags), tag operations, prototype uniqueness, optimistic locking
  - Verify: `mix test test/loka/engine/entities_v2_test.exs`
  - Commit: `"test(v2): add Entities API tests for unified find/save/delete/tags"`

---

## Phase 2: EntitySeeder
**Spec**: `phase-2-seeder.md` | **Depends on**: Phase 1

- [x] **2.1** Create EntitySeeder
  - Creates: `lib/loka/engine/entity_seeder.ex`
  - Modifies: `lib/loka/application.ex` (replace TypedObject.Loader with EntitySeeder)
  - Key logic: Extract inheritance resolution (topological sort + deep merge) from TypedObject.Loader. Phased seeding: non-located → rooms → exits → NPCs/items
  - Creates: `test/loka/engine/entity_seeder_test.exs`
  - Verify: `mix test test/loka/engine/entity_seeder_test.exs`
  - Commit: `"feat(v2): add EntitySeeder with inheritance resolution and phased seeding"`

---

## Phase 3: EntityServer
**Spec**: `phase-3-entity-server.md` | **Depends on**: Phase 2

- [x] **3.1** Evolve EntityServer core
  - Modifies: `lib/loka/engine/entity_server.ex`
  - Changes: Add `dispatch_event/3` with snapshot rollback, `force_save` option, `:reload` handler, remove `data` field refs, load tags from entity_tags on init
  - Verify: `mix test test/loka/engine/entity_server_test.exs`
  - Commit: `"feat(v2): evolve EntityServer — dispatch_event, force_save, reload, snapshot rollback"`

- [x] **3.2** Create EntityBehavior + SystemSupervisor + volatile.ex
  - Creates: `lib/loka/engine/entity_behavior.ex`
  - Creates: `lib/loka/engine/system_supervisor.ex`
  - Creates: `lib/loka/engine/entity_server/volatile.ex`
  - Verify: `mix compile --warnings-as-errors`
  - Commit: `"feat(v2): add EntityBehavior callbacks, SystemSupervisor, Volatile state helpers"`

- [x] **3.3** Rewrite V1 behaviors to EntityBehavior interface
  - Rewrites: `lib/loka/behaviors/aggressive.ex`, `guard.ex`, `janitor.ex`, `patrol.ex`, `runner.ex`, `scavenger.ex`, `wander.ex` (7 modules)
  - Deletes: `lib/loka/behaviors/base.ex` (replaced by EntityBehavior)
  - Changes: `init/1` → `on_init/1`, `act/1` → `on_tick/2`, `react/2` → `on_event/3`
  - Creates: `test/loka/behaviors/*_test.exs`
  - Verify: `mix test test/loka/behaviors/`
  - Commit: `"feat(v2): rewrite 7 V1 behaviors to EntityBehavior interface, delete Base"`

- [x] **3.4** PubSub topic rename + tick system + system entity boot
  - Modifies: EntityServer, EntityRegistry, game_channel, session, room_helpers, builder commands (~10 files)
  - Changes: `room:{id}` → `location:{id}`, `player:{id}` → `entity:{id}`. Add tick timer via `Process.send_after`. System entities tagged `auto_start` started under SystemSupervisor
  - Verify: `mix test` (full suite — PubSub rename touches many files)
  - Commit: `"feat(v2): rename PubSub topics, add tick system, boot system entities"`

---

## Phase 4: Player Migration
**Spec**: `phase-4-player.md` | **Depends on**: Phase 3 | **Can parallel with Phase 5**

- [x] **4.0** Migrate players table to UUID primary keys
  - Creates: `priv/repo/migrations/TIMESTAMP_migrate_players_to_uuid.exs`
  - Changes: Recreate `players` + `players_tokens` tables with `binary_id` PKs (pre-production, no data to preserve). Update `account_id` FK in entities to `binary_id`.
  - Modifies: `lib/loka/accounts/player.ex`, `lib/loka/accounts/player_token.ex`
  - Verify: `mix ecto.migrate && mix ecto.rollback && mix ecto.migrate`
  - Commit: `"feat(v2): migrate players table to UUID primary keys"`

- [x] **4.1** Player data migration + login/logout update
  - Creates: `priv/repo/migrations/TIMESTAMP_migrate_players_to_entities.exs`
  - Modifies: `lib/loka_web/channels/game_channel.ex` (join/3 flow)
  - Modifies: `lib/loka/session/server.ex`
  - Verify: `mix test test/loka_web/channels/game_channel_test.exs`
  - Commit: `"feat(v2): migrate player data to character entities, update login flow"`

- [ ] **4.2** Update GameState consumers (batch 1: core framework)
  - Modifies: quest/progress.ex, quest/progress/*.ex, quest/state_helper.ex, inventory/*.ex, combat/*.ex
  - Pattern: `GameState.get_field(gs, :health)` → `Components.Combatant.health(entity)`
  - Verify: `mix test test/loka/framework/`
  - Commit: `"feat(v2): swap GameState → entity components in quest, inventory, combat"`

- [ ] **4.3** Update GameState consumers (batch 2: channel + remaining)
  - Modifies: game_channel.ex (~50 refs), action_bridge.ex, room_helpers.ex, session/*.ex
  - Deletes: `lib/loka/framework/player/game_state.ex`
  - Verify: `mix test` (full suite)
  - Commit: `"feat(v2): complete GameState removal — channel, session, delete module"`

---

## Phase 5: Content + Actions Migration
**Spec**: `phase-5-content-actions.md` | **Depends on**: Phase 3 | **Can parallel with Phase 4**

- [x] **5.1** Swap content module backends (12 modules)
  - Modifies: All `lib/loka/content/*.ex` — `TypedObject.Loader.get(key)` → `Entities.find_one(key: key, type: :quest)`
  - Verify: `mix test test/loka/content/`
  - Commit: `"feat(v2): swap content module backends from TypedObject to Entities API"`

- [x] **5.2** Delete framework registries (do one at a time)
  - Deletes: 14 registry modules (quest_registry, skill_registry, etc.)
  - Deletes: `lib/loka/framework/registry_base.ex`
  - Deletes: `lib/loka/engine/zone_loader.ex`, `zone_registry.ex`
  - Modifies: All callers → `Entities.find(type: :quest)` etc.
  - Verify: `mix test` (full suite after each registry deletion)
  - Commit: `"feat(v2): delete 14 framework registries + RegistryBase, use Entities.find"`

- [ ] **5.3** Update game actions layer (11 modules)
  - Modifies: `lib/loka/game/actions.ex` + `actions/*.ex`
  - Pattern: ~25 `PlayerGameState.update_state` calls → entity component updates
  - Verify: `mix test test/loka/game/`
  - Commit: `"feat(v2): swap GameState → entity components in game actions layer"`

- [ ] **5.4** Update mechanics layer (4 modules)
  - Modifies: `lib/loka/mechanics/stats.ex`, `character_resources.ex`, `combat_stats.ex`, `check.ex`
  - Verify: `mix test test/loka/mechanics/`
  - Commit: `"feat(v2): swap GameState → entity components in mechanics layer"`

---

## Phase 6: Cleanup
**Spec**: `phase-6-cleanup.md` | **Depends on**: Phases 4 + 5

- [ ] **6.1** Delete old code
  - Deletes: TypedObject (4 files), entity_attribute.ex, Plugin system (3 files + plugins/ dir), WorldLoader, SocialLoader
  - Deletes: `test/support/typed_object_sandbox.ex`, `test/support/test_cleanup.ex`
  - Modifies: `lib/loka/application.ex` (remove ~28 old supervised children)
  - Verify: `mix test` (full suite)
  - Commit: `"chore(v2): delete TypedObject, Plugin system, old loaders, test support"`

- [ ] **6.2** Simplify builder + world_builder managers
  - Modifies: 16 `builder_commands/*.ex` sub-modules
  - Modifies: 16 `world_builder/*.ex` manager modules
  - Changes: Remove all dual-store sync. Single write path: EntityServer.update → done
  - Verify: `mix test test/loka_web/channels/builder_commands/`
  - Commit: `"feat(v2): simplify builder commands — single write path, no dual-store sync"`

- [ ] **6.3** Create export task
  - Creates: `lib/mix/tasks/loka.export.ex`
  - Verify: `mix loka.export --type room | head -20` (outputs YAML)
  - Commit: `"feat(v2): add mix loka.export task (DB → YAML)"`

- [ ] **6.4** Final schema verification
  - Run: `mix loka.validate` (no orphaned refs)
  - Run: `mix test` (full green suite)
  - Run: `mix credo` (no new issues)
  - Commit: `"chore(v2): verify clean schema — no orphaned references"`

---

## Phase 7: Polish
**Spec**: `phase-7-polish.md` | **Can overlap with Phase 6**

- [ ] **7.1** Create component accessor modules (23 modules)
  - Creates: `lib/loka/components/*.ex` (combatant, player, stats, quest_progress, etc.)
  - Each ~15 lines: `get/1`, `has?/1`, `put/2`, `update/3`, `component_key/0`
  - Creates: `test/loka/components/*_test.exs` (async: true)
  - Verify: `mix test test/loka/components/`
  - Commit: `"feat(v2): add 23 component accessor modules"`

- [ ] **7.2** Create new behavior modules
  - Creates: `lib/loka/behaviors/weather.ex`, `day_night.ex`, `npc_ambient.ex`, `room_ambient.ex`
  - Creates: `test/loka/behaviors/*_test.exs`
  - Verify: `mix test test/loka/behaviors/`
  - Commit: `"feat(v2): add Weather, DayNight, NpcAmbient, RoomAmbient behavior modules"`

- [ ] **7.3** Final integration tests + docs update
  - Verify: `mix test` (full green suite)
  - Verify: `mix loka.test --quick` (all validators pass)
  - Update: CLAUDE.md, relevant docs in docs/
  - Commit: `"docs(v2): update CLAUDE.md and architecture docs for V2 entity system"`

---

## Progress Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 0: Preparation | 0.1-0.4 | **Complete** |
| 1: Foundation | 1.1-1.4 | **Complete** |
| 2: Seeder | 2.1 | **Complete** |
| 3: EntityServer | 3.1-3.4 | **Complete** |
| 4: Player | 4.1-4.3 | 4.0-4.1 complete |
| 5: Content+Actions | 5.1-5.4 | 5.1 complete |
| 6: Cleanup | 6.1-6.4 | Not started |
| 7: Polish | 7.1-7.3 | Not started |
| **Total** | **22 tasks** | |

## Critical Path

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 ──→ Phase 6 → Phase 7
                                        → Phase 5 ──↗
```

Phases 4 and 5 can overlap. Phase 6 needs both complete. Phase 7 can overlap with Phase 6.
