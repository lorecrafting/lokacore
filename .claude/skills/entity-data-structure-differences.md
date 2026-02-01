# Entity Data Structure Differences

## Trigger
Use this skill when:
- Accessing NPC behaviors or patrol paths in World Builder code
- EntityManager data seems to be missing expected fields
- Pattern matching on entity structures fails unexpectedly

## Problem
EntityManager and TypedObject return entities with different structures. Code written for one may fail silently on the other.

## Key Differences

### TypedObject Struct
```elixir
%TypedObject{
  key: "monastery_guard",
  name: "Monastery Guard",
  data: %{
    "behaviors" => [
      %{"script" => "patrol", "config" => %{"route" => [...]}}
    ]
  },
  attributes: %{...}
}
```

### EntityManager Entity Map
```elixir
%{
  key: "monastery_guard",
  name: "Monastery Guard",
  data: %{primary_keyword: "monk", mood: "alert"},
  attributes: %{
    "behavior_config" => %{
      "patrol" => %{
        "path" => ["monastery_gate", "main_courtyard", ...],
        "loop" => true
      }
    }
  }
}
```

## Critical Differences

| Field | TypedObject | EntityManager |
|-------|-------------|---------------|
| Behaviors | `data["behaviors"]` | NOT included |
| Patrol Path | `data["behaviors"][n]["config"]["route"]` | `attributes["behavior_config"]["patrol"]["path"]` |
| Type | Struct with `__struct__` | Plain map |

## Solution Pattern

When accessing entity data in World Builder, handle both:

```elixir
# Handle TypedObject struct
def extract_data(%TypedObject{} = obj) do
  # Access via struct fields
  get_in(obj.data, ["behaviors"])
end

# Handle entity map from EntityManager
def extract_data(%{key: key} = entity) when is_map(entity) do
  # Access via map keys
  get_in(entity, [:attributes, "behavior_config"])
end
```

## YAML vs Runtime Note

The YAML `behaviors:` field IS loaded by TypedObject.Loader but is NOT included in EntityManager's output. If you need behaviors data:
- Load from TypedObject.Loader directly, OR
- Use `attributes.behavior_config` which IS preserved

## Example: NPCPathExtractor

```elixir
# Check attributes.behavior_config.patrol for entity maps
defp extract_patrol_from_entity_map(entity) do
  behavior_config =
    get_in(entity, [:attributes, "behavior_config"]) ||
    get_in(entity, [:attributes, :behavior_config])

  case behavior_config do
    %{"patrol" => patrol_config} -> extract_patrol_config(patrol_config)
    %{patrol: patrol_config} -> extract_patrol_config(patrol_config)
    _ -> nil
  end
end

# Path key can be "path" or "route" depending on source
defp extract_patrol_config(patrol_config) when is_map(patrol_config) do
  route =
    Map.get(patrol_config, "path") ||
    Map.get(patrol_config, :path) ||
    Map.get(patrol_config, "route") ||
    Map.get(patrol_config, :route, [])
  # ...
end
```

## Debugging Tips

```elixir
# Debug entity structure
mix run -e '
alias Loka.WorldBuilder.EntityManager
entity = EntityManager.list_entities(:npc) |> Enum.find(& &1.key == "monastery_guard")
IO.puts("Keys: #{inspect(Map.keys(entity))}")
IO.puts("Attributes: #{inspect(entity[:attributes])}")
'
```

## Related Files
- `lib/loka/world_builder/entity_manager.ex` - Returns entity maps
- `lib/loka/engine/typed_object.ex` - TypedObject struct definition
- `lib/loka/world_builder/npc_path_extractor.ex` - Example handling both
