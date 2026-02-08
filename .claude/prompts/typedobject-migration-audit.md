# TypedObject Migration: Post-Migration Audit & Stabilization

## Context

Loka is an Elixir MUD engine. We completed a migration from the legacy `PrototypeLoader` + `Prototype` struct system to the unified `TypedObject.Loader` + `TypedObject` struct system. The migration touched ~50+ modules across engine, framework, testing, and web layers. This audit ensures the migration is 100% stable with no regressions, all tests passing, and documentation updated.

## Architecture

- **Old system (REMOVED)**: `Loka.Engine.PrototypeLoader` (GenServer + ETS) loaded YAML files into `Loka.Engine.Prototype` structs. Fields: `.key`, `.type` (atom like :npc, :room, :item), `.parent`, `.name`, `.short_desc`, `.long_desc`, `.extra_desc`, `.primary_keyword`, `.components`, `.data`
- **Current system**: `Loka.Engine.TypedObject.Loader` (GenServer + ETS) loads YAML files into `Loka.Engine.TypedObject` structs. Fields: `.key`, `.type` (atom like :entity, :quest, :dialogue, :script, :zone), `.subtype` (atom like :npc, :room, :item), `.parent_key`, `.name`, `.description` (was long_desc), `.extra_description` (was extra_desc), `.components`, `.data`

## Field Mapping Reference (Prototype -> TypedObject)

| Old Prototype field | New TypedObject field | Notes |
|--------------------|-----------------------|-------|
| .type | .subtype | :npc, :room, :item, :exit |
| (implicit) | .type | :entity, :quest, :dialogue, :script, :zone |
| .parent | .parent_key | |
| .long_desc | .description | |
| .extra_desc | .extra_description | |
| .short_desc | .name (usually) | Check case-by-case |
| .primary_keyword | .data["primary_keyword"] | Moved into data map |
| .components | .components | Same structure |
| .data | .data | Same structure, YAML keys are STRINGS not atoms |

## Audit Instructions

Execute all 5 phases below. Do NOT skip any phase. Report findings as you go.

### Phase 1: Verify Complete Removal of Legacy Code

Confirm zero remaining references to the old system anywhere in the codebase.

```bash
cd server

# 1. No PrototypeLoader references in production or test code
grep -r "PrototypeLoader" lib/ test/ --include="*.ex" --include="*.exs"

# 2. No Prototype struct references (excluding TypedObject)
grep -r "Prototype\." lib/ test/ --include="*.ex" --include="*.exs" | grep -v TypedObject | grep -v "#" | grep -v "PrototypePlugin"

# 3. No old field access patterns
grep -r "proto\.type\b" lib/ --include="*.ex"          # should be .subtype
grep -r "proto\.parent\b" lib/ --include="*.ex"        # should be .parent_key
grep -r "\.long_desc\b" lib/ --include="*.ex"          # should be .description
grep -r "\.short_desc\b" lib/ --include="*.ex"         # should be .name
grep -r "\.extra_desc\b" lib/ --include="*.ex"         # should be .extra_description
grep -r "\.primary_keyword\b" lib/ --include="*.ex"    # should be .data["primary_keyword"]

# 4. Confirm files are deleted
ls lib/loka/engine/prototype_loader.ex 2>&1  # should not exist
ls lib/loka/engine/prototype.ex 2>&1         # should not exist

# 5. Confirm not in Application.ex supervised children
grep -n "PrototypeLoader" lib/loka.ex
```

If ANY references remain, fix them before proceeding.

### Phase 2: Test Suite - Full Pass

Run the complete test suite and ensure ALL tests pass.

```bash
# 1. Compile clean with no warnings
mix compile --warnings-as-errors

# 2. Run full test suite (parallel)
mix test

# 3. If failures, run individually to distinguish real failures from flaky ones
mix test --failed

# 4. Run sequentially to check for isolation issues
mix test --max-cases 1

# 5. Content validation
mix loka.test.validate --quick
```

**Known patterns to check for:**
- Test setup blocks must use `TypedObject.Loader` not `PrototypeLoader`
- Test data registration must create `TypedObject` structs not `Prototype` structs
- Tests spawning production prototypes need `TypedObjectLoader.reload()` in setup
- Economy tests: verify `base_price` resolves correctly from TypedObject `.data["base_price"]`
- RoomManager tests: verify room creation/fetch cycle works end-to-end
- ContainerRespawn tests: verify container prototypes load correctly

**Acceptable validation errors (pre-existing, not migration-related):**
- `orphan_room` errors in World Connectivity (bidirectional exit issues)
- `unobtainable_item` errors in Content Reachability (items without obtain paths)
- `unreachable_quest_giver: *: no_spawn_location` errors (NPCs without zone placement)

**NOT acceptable:**
- Any `missing_type` errors for non-base prototypes
- Any `invalid_parent` errors
- Any new errors that didn't exist before the migration
- Any test failures that pass on main branch

### Phase 3: Runtime Verification

Start the server and verify core systems work.

```bash
mix phx.server
```

Test manually or via IEx:
1. World spawns correctly (rooms, NPCs, items appear)
2. NPCs have correct names, descriptions, and behaviors
3. Items are obtainable and have correct properties
4. Quests can be started and progressed
5. Economy transactions work (buy/sell with correct pricing)
6. World Builder UI loads and can create/edit entities
7. Content validation from World Builder works (Ctrl+S)

### Phase 4: Cross-Module Field Access Audit

For each of these critical subsystems, read the source and verify all TypedObject field access is correct:

| Module | File | What to check |
|--------|------|---------------|
| Spawner | `lib/loka/engine/spawner.ex` | .subtype, .parent_key, .components access |
| Spawner Templates | `lib/loka/engine/spawner/templates.ex` | Field mapping in template creation |
| WorldLoader | `lib/loka/engine/world_loader.ex` | Room/NPC/item spawning from TypedObject |
| ZoneLoader | `lib/loka/engine/zone_loader.ex` | Zone data access |
| ZoneRegistry | `lib/loka/engine/zone_registry.ex` | Zone lookup and registration |
| Economy | `lib/loka/framework/economy/economy.ex` | base_price from .data |
| Shop Actions | `lib/loka/game/actions/shop.ex` | Price lookup from TypedObject |
| Stacking | `lib/loka/framework/inventory/stacking.ex` | Stack info from prototype data |
| Quest Progress | `lib/loka/framework/quest/progress.ex` | Quest data access |
| Quest Validator | `lib/loka/framework/quest/validator.ex` | Quest field validation |
| Content Validator | `lib/loka/content/validator.ex` | TypedObject.Registry usage |
| Prototype Plugin | `lib/loka/engine/content_validator/prototype_plugin.ex` | Validation against TypedObject |
| PrototypeLinter | `lib/loka/testing/content/prototype_linter.ex` | .subtype, .parent_key, .description |
| ReachabilityAnalyzer | `lib/loka/testing/content/reachability_analyzer.ex` | Prototype field access |
| WorldValidator | `lib/loka/testing/content/world_validator.ex` | Room/exit data access |
| DialogueValidator | `lib/loka/testing/content/dialogue_validator.ex` | NPC/dialogue data |
| CutsceneValidator | `lib/loka/testing/content/cutscene_validator.ex` | Speaker/cutscene data |
| CraftingValidator | `lib/loka/testing/content/crafting_validator.ex` | Recipe/item data |
| StorylineValidator | `lib/loka/testing/content/storyline_validator.ex` | Quest/storyline data |
| UIValidator | `lib/loka/testing/content/ui_validator.ex` | UI consistency checks |
| DialogueQuestChainValidator | `lib/loka/testing/content/dialogue_quest_chain_validator.ex` | Chain validation |
| QuestTester | `lib/loka/testing/quest/quest_tester.ex` | Quest simulation |
| TestData | `lib/loka/testing/test_data.ex` | Test prototype creation |
| EntityManager | `lib/loka/world_builder/entity_manager.ex` | World Builder entity ops |
| BatchOperations | `lib/loka/world_builder/batch_operations.ex` | Batch entity ops |
| AnthropicClient | `lib/loka/world_builder/anthropic_client.ex` | AI tool definitions |
| HierarchyPanel | `lib/loka_web/live/admin_live/world_builder/hierarchy_panel.ex` | Entity listing |
| InspectorPanel | `lib/loka_web/live/admin_live/world_builder/inspector_panel.ex` | Entity display |
| ChatPanel | `lib/loka_web/live/admin_live/world_builder/chat_panel.ex` | AI chat context |

### Phase 5: Documentation Update

Update all documentation to reflect the completed migration:

1. **CLAUDE.md** - Remove any references to "dual systems" or PrototypeLoader
2. **`.claude/memory/MEMORY.md`** - Update "Dual systems" note, mark migration complete
3. **`.claude/memory/typedobject-migration.md`** - Mark all tasks complete, add completion date
4. **`docs/architecture/`** - Update any architecture docs referencing Prototype/PrototypeLoader
5. **`server/lib/loka/engine/content_validator/README.md`** - Verify references TypedObject
6. **Builder reference docs** in `docs/builder-reference/` - Update prototype documentation

## Critical Rules

- YAML keys are STRINGS, never atoms: use `data["key"]` not `data.key`
- TypedObject.type is `:entity` for all game objects (rooms, NPCs, items, exits)
- TypedObject.subtype is `:npc`, `:room`, `:item`, `:exit` (what Prototype.type used to be)
- Base prototypes (`base_npc`, `base_room`, etc.) have `nil` subtype by design - this is correct
- Always test with `mix test` (parallel) not just individual test files
- Test flakiness often indicates test isolation issues with TypedObject.Loader state

## Success Criteria

The audit is complete when ALL of the following are true:
- [ ] Zero references to PrototypeLoader or Prototype struct in codebase
- [ ] `mix compile --warnings-as-errors` passes clean
- [ ] `mix test` passes with 0 failures (flaky tests fixed)
- [ ] `mix loka.test.validate --quick` has no NEW errors vs baseline
- [ ] Server starts and core gameplay works
- [ ] All documentation updated
- [ ] Migration task chain (#374-#377) all marked complete
