# Phase 6: Cleanup

> Full spec: `docs/architecture/unified-object-system-v2.md` Section 16 (Steps 6.0-6.4) + Section 37 (Tier 3 delete list) + Section 38 (Builder Commands)
> **Depends on**: Phases 4 + 5 both complete

## Task 6.1: Delete Old Code

### TypedObject System (4 files)
```
DELETE: lib/loka/engine/typed_object.ex
DELETE: lib/loka/engine/typed_object/loader.ex
DELETE: lib/loka/engine/typed_object/registry.ex
DELETE: lib/loka/engine/typed_object/schema.ex
```

### Entity Attributes EAV
```
DELETE: lib/loka/engine/schema/entity_attribute.ex
```

### Plugin System (3 files + directory)
```
DELETE: lib/loka/engine/plugin.ex
DELETE: lib/loka/engine/plugin_loader.ex
DELETE: lib/loka/engine/plugin_supervisor.ex
DELETE: lib/loka/plugins/ (entire directory — guilds plugin)
```

### Old Loaders
```
DELETE: lib/loka/engine/world_loader.ex    (remove spawn_world() call from application.ex)
DELETE: lib/loka/engine/social_loader.ex
```

### Test Support
```
DELETE: test/support/typed_object_sandbox.ex
DELETE: test/support/test_cleanup.ex
```

### Deferred Framework Modules (~25 modules)

These were already listed in Tier 3 of Section 37. Delete them all:
- Quest: `quest.ex`, `definitions.ex`, `chain.ex`
- Storyline: `storyline.ex`
- Skills: `skill.ex`, `binary_skill.ex`
- Resources: `resource.ex`, `resource_ticker.ex`
- Status: `status_effect.ex`
- Combat: `damage_types.ex` (if data moved to components), `damage_message.ex`
- Economy: `economy.ex`, `shop.ex`
- Crafting: `crafting.ex`, `recipe.ex`, `crafting_station.ex`
- Gathering: `gathering.ex`, `gathering_node.ex`
- Inventory: `loot_table.ex`, `container_respawn.ex`
- Progression: `progression.ex`
- World: `weather.ex`, `day_night.ex`, `room_ambient.ex`, `sound_environment.ex`
- Scripting: `world_event_handler.ex`, `config_schema.ex`, `behavior_registry.ex`
- Spark: entire directory

### Application.ex Overhaul

The supervision tree drops from ~52 children to ~22. Remove all registry GenServers, old loaders, plugin system, world systems (now behaviors on system entities).

Keep: Telemetry, PromEx, Repo, Migrator, DNSCluster, PubSub, Session (Registry + Supervisor), Config.Balance, Hooks TaskSupervisor, Hooks, Cooldowns, EntitySeeder, Entity Registry + Supervisor, SystemSupervisor, WorldGraph (LayoutManager), ChannelManager, PartyManager, Timers, Endpoint.

## Task 6.2: Simplify Builder + World Builder

### The Big Simplification

```
Before (V1): Command → write YAML → reload ETS → sync DB → sync attributes
After (V2):  Command → EntityServer.update() → done (auto-saves to DB)
```

### Builder Commands (16 sub-modules in `lib/loka_web/channels/builder_commands/`)

Each sub-module's data access follows the same swap pattern:

```elixir
TypedObject.Loader.get(key)            →  Entities.find_one(key: key, type: type)
RoomManager.create_room(data)          →  Entities.save(Entity.new(%{type: :room, ...}))
RoomManager.update_room(room, changes) →  EntityServer.update(room_id, fn e -> ... end)
Spawner.spawn_entity(key, location_id) →  Spawner.spawn(key, location_id: room_id)
TypedObject.Loader.reload()            →  (not needed)
```

Sub-modules that DON'T change: Help, Formatter, Guides, AI

### World Builder Managers (16 modules in `lib/loka/world_builder/`)

```
tool_executor.ex         # 1,776 LOC — largest module, consider splitting into ~10 domain modules
room_manager.ex          # simplify: remove YAML write + entity sync → just Entities.save
entity_manager.ex        # simplify: remove TypedObject.Loader refs
quest_manager.ex         # swap TypedObject → Entities.find
dialogue_manager.ex      # swap TypedObject → Entities.find
yaml_builder.ex          # evolve: V2 YAML format for export
validation_manager.ex    # swap validation target
respawner.ex             # swap Spawner calls
script_templates.ex      # update to V2 binding syntax
anthropic_client.ex      # unchanged
audit_log.ex             # unchanged
audit_log_entry.ex       # unchanged
llm/observability_logger.ex  # unchanged
mcp/router.ex            # unchanged
mcp/server.ex            # unchanged
mcp/tools.ex             # swap data access
```

### Draft System in V2

Drafts become a tag rather than a filesystem concept:

```elixir
# Create draft
Entities.save(Entity.new(%{type: :room, key: "dark_cave", tags: ["draft"]}))

# Publish (remove draft tag)
Entities.remove_tag(entity_id, "draft")

# List drafts
Entities.find_all(tags: ["draft"])
```

## Task 6.3: Create Export Task

Create `lib/mix/tasks/loka.export.ex`:

```bash
mix loka.export                           # all prototypes
mix loka.export --type quest,dialogue     # specific types
mix loka.export --modified-since 2026-02-10
```

Reads entities from DB, writes YAML files to `priv/world/`. This closes the loop: YAML → DB (seeder) → modify (builder) → YAML (export) → git.

## Task 6.4: Final Schema Verification

```bash
mix loka.validate          # no orphaned refs
mix test                   # full green suite
mix credo                  # no new issues
mix compile --warnings-as-errors  # clean compile
```

Verify:
- Old tables gone (`entity_attributes`, `player_game_states`)
- No orphaned references
- Supervision tree is ~22 children
- All tests pass
