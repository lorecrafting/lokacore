# Phase 5: Content + Actions Migration

> Full spec: `docs/architecture/unified-object-system-v2.md` Section 16 (Steps 5.1-5.5) + Section 37 (Tier 2 Addendum)
> **Depends on**: Phase 3 | **Can run in parallel with Phase 4**

## Task 5.1: Swap Content Module Backends (12 modules)

All files in `lib/loka/content/`:

```
cutscene.ex, dialogue.ex, gathering_node.ex, quest.ex, recipe.ex,
resource.ex, script.ex, skill.ex, status_effect.ex, storyline.ex,
validator.ex, zone.ex
```

### Pattern

Each content module changes its backend from TypedObject.Loader to Entities API:

```elixir
# Before
def get(key), do: TypedObject.Loader.get(key)
def list_all(), do: TypedObject.Loader.list_by_type("quest")

# After (each module knows its type)
def get(key), do: Entities.find_one(key: key, type: :quest)
def list_all(), do: Entities.find_all(type: :quest, is_prototype: true)
```

Each module has a known type:
| Module | Type |
|--------|------|
| `quest.ex` | `:quest` |
| `dialogue.ex` | `:dialogue` |
| `script.ex` | `:script` |
| `skill.ex` | `:skill` |
| `zone.ex` | `:zone` |
| `storyline.ex` | `:storyline` |
| `cutscene.ex` | `:cutscene` (or tag on dialogue) |
| `recipe.ex` | `:recipe` |
| `resource.ex` | `:resource` |
| `status_effect.ex` | `:status` |
| `gathering_node.ex` | `:gathering_node` (or tag on item) |
| `validator.ex` | cross-type validation |

The validator module needs special attention — it currently validates TypedObject shapes. Update to validate entity component shapes instead.

## Task 5.2: Delete Framework Registries

**Strategy: Delete one at a time.** For each registry:
1. Find all callers (grep for module name)
2. Replace calls with `Entities.find_all(type: :X)` or `Entities.find_one(key: k, type: :X)`
3. Delete the registry file
4. Run `mix test`
5. Repeat

### Registries to delete (14 total)

| Registry | Replacement |
|----------|-------------|
| `Quest.QuestRegistry` | `Entities.find_all(type: :quest)` |
| `Quest.ObjectiveRegistry` | Script hooks on quest entities |
| `Quest.ChainRegistry` | `Entities.find_all(type: :storyline)` |
| `Storyline.StorylineRegistry` | `Entities.find_all(type: :storyline)` |
| `Skills.SkillRegistry` | `Entities.find_all(type: :skill)` |
| `Skills.BinarySkillRegistry` | `Entities.find_all(type: :skill, tags: ["binary"])` |
| `Resources.ResourceRegistry` | `Entities.find_all(type: :resource)` |
| `Status.StatusRegistry` | `Entities.find_all(type: :status)` |
| `Crafting.CraftingRegistry` | `Entities.find_all(type: :recipe)` |
| `Gathering.GatheringRegistry` | `Entities.find_all(type: :gathering_node)` |
| `Engine.ZoneLoader` | `Entities.find_all(type: :zone)` |
| `Engine.ZoneRegistry` | `Entities.find_all(type: :zone)` |

Also delete:
- `lib/loka/framework/registry_base.ex` (the macro that powers all registries)

### Application.ex cleanup

Remove all registry GenServers from the supervision tree. This reduces the supervised children count significantly.

## Task 5.3: Update Game Actions Layer (11 modules)

Files in `lib/loka/game/`:

```
actions.ex                    # main dispatcher
actions/bardo.ex              # death/respawn
actions/combat.ex             # combat actions
actions/container.ex          # container interaction
actions/context.ex            # action context struct
actions/dialogue.ex           # dialogue actions
actions/gathering.ex          # gathering actions
actions/shop.ex               # shop actions
actions/social.ex             # social actions
actions/spark.ex              # spark system
actions/result.ex             # result struct (unchanged)
```

### Pattern

These modules reference both GameState and TypedObject:

```elixir
# GameState reads/writes (~25 calls)
PlayerGameState.update_state(gs, %{field: value})
→ EntityServer.update(char_id, fn e -> update_component(e, ...) end)

# TypedObject lookups
TypedObject.Loader.get(quest_key)
→ Entities.find_one(key: quest_key, type: :quest)

# Registry lookups
GatheringRegistry.get(node_key)
→ Entities.find_one(key: node_key, type: :gathering_node)
```

`actions/context.ex` is especially important — it defines the action context struct that other modules use. Update its fields from `game_state` to `character` entity.

`actions/result.ex` is pure data — likely unchanged.

`actions/spark.ex` may be deleted if the Spark feature is cut.

## Task 5.4: Update Mechanics Layer (4 modules need changes)

```
lib/loka/mechanics/stats.ex              # swap GameState stat reads → get_component
lib/loka/mechanics/character_resources.ex # swap GameState → Components.Resources
lib/loka/mechanics/combat_stats.ex       # swap GameState → Components.Combatant + Stats
lib/loka/mechanics/check.ex              # swap stat reads → get_component
```

Unchanged (pure math, no data access):
```
lib/loka/mechanics/cost.ex
lib/loka/mechanics/damage.ex
lib/loka/mechanics/damage_types.ex
lib/loka/mechanics/heal.ex
```

### Pattern

```elixir
# Before
def calculate_max_health(game_state) do
  base = GameState.get_stat(game_state, :sta) * 10
  ...
end

# After
def calculate_max_health(entity) do
  base = get_in(entity.components, ["stats", "sta"]) * 10
  ...
end
```

Function signatures change from `game_state` parameter to `entity` parameter.
