# TypedObject Field Storage Pattern

## Trigger
Use this skill when:
- YAML fields aren't being read/persisted correctly
- Values in UI show defaults instead of YAML values
- TypedObject attributes vs data confusion

## Problem

TypedObject has two storage maps with different sources:
- `attributes` - Explicitly defined under `attributes:` key in YAML
- `data` - Catches all top-level YAML fields NOT in @struct_fields

## @struct_fields (from typed_object.ex)

```elixir
@struct_fields ~w(
  id key type subtype parent_key parent is_prototype prototype_key
  name short_desc description long_desc extra_description extra_desc
  keywords attributes tags locks data metadata location_id contents
  components behaviors emotes scripts
)a
```

**Anything NOT in this list goes to `data` map, not a struct field.**

## Common Pitfall

```yaml
# YAML file
key: my_room
x: 10
y: 20
```

After loading:
- `room.x` → nil (x is not a struct field)
- `room.data["x"]` → 10 (top-level fields go here)
- `room.attributes[:x]` → nil (attributes: section not defined)

## Correct Pattern

**When writing accessor code, check both:**
```elixir
# ✅ CORRECT - check both locations
x = TypedObject.get_attribute(obj, :x) || TypedObject.get_data(obj, :x) || 0
```

**When persisting, use attributes section:**
```yaml
# ✅ CORRECT - explicit attributes section
key: my_room
attributes:
  x: 10
  y: 20
```

## Real Example: Room Coordinates

The room coordinate persistence bug was caused by:
1. YAML files had top-level x/y/z → stored in `data`
2. `enrich_room_for_frontend` only checked `attributes`
3. Fix: Check both `attributes` AND `data` for coordinates

```elixir
# Fixed code in room_manager.ex
defp enrich_room_for_frontend(room) do
  x = TypedObject.get_attribute(room, :x) || TypedObject.get_data(room, :x) || 0
  y = TypedObject.get_attribute(room, :y) || TypedObject.get_data(room, :y) || 0
  z = TypedObject.get_attribute(room, :z) || TypedObject.get_data(room, :z) || 0
  # ...
end
```

## When Persisting to YAML

Always write to `attributes:` section for custom fields:

```elixir
# In build_room_yaml
room_data = %{
  key: key,
  attributes: %{x: x, y: y, z: z}
}
```

## ID Field Nil for YAML-Loaded Entities

TypedObject has an `id` field, but YAML files use `key` as the identifier. After loading from YAML, `entity.id` is nil.

**Problem:**
```elixir
entity = Registry.get("my_npc")
entity.id  # => nil
entity.key # => "my_npc"
```

**Solution: Use key as fallback for id in UI functions:**
```elixir
defp enrich_for_ui(entity) do
  %{
    id: entity.id || entity.key,  # Fallback to key
    key: entity.key,
    # ...
  }
end
```

This pattern is used in:
- `lib/loka/world_builder/entity_manager.ex` - `enrich_for_ui/1`

## Related Files
- `lib/loka/engine/typed_object.ex` - @struct_fields definition, new/1
- `lib/loka/world_builder/room_manager.ex` - Room CRUD with coordinate handling
- `lib/loka/world_builder/entity_manager.ex` - Entity CRUD with id fallback
- `lib/loka/engine/typed_object/loader.ex` - YAML loading
