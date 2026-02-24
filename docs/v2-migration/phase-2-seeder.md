# Phase 2: EntitySeeder

> **Note (Feb 2026):** The inheritance system described in this doc (topological sort, deep merge, parent references) was removed in the flat prototype refactor. All YAML prototypes are now self-contained. The `_base/` directory was deleted. This doc is kept for historical reference.

> Full spec: `docs/architecture/unified-object-system-v2.md` Section 8 (YAML Authoring + Seeder) + Section 16 (Steps 2.1-2.3)
> **Depends on**: Phase 1 (schema + Entities API must exist)

## Task 2.1: Create EntitySeeder

### Design

**File**: `lib/loka/engine/entity_seeder.ex`

The seeder replaces `TypedObject.Loader` as the boot-time content loading system. Key difference: Loader populated ETS; Seeder populates SQLite DB.

### Core Logic to Extract from TypedObject.Loader

The inheritance resolution logic lives in `lib/loka/engine/typed_object/loader.ex`:
- `build_resolution_order/1` — topological sort (lines ~548-581)
- `resolve_all_parents/1` — ordered deep merge (lines ~531-546)
- `resolve_parent/2` — single parent merge
- `TypedObject.merge_parent/2` — deep merge strategy (lines ~449-477)

Extract these into EntitySeeder (or a shared module). The logic is: topological sort all YAML objects by parent chains, then resolve in order (parents first), deep-merging child over parent.

### Phased Seeding Order

```elixir
def seed do
  yamls = load_all_yaml_files()
  resolved = resolve_inheritance(yamls)

  # Phase 1: Non-located entities (no location_id needed)
  seed_by_types(resolved, [:skill, :quest, :dialogue, :zone, :storyline,
                            :recipe, :resource, :status, :script, :system, :social])

  # Phase 2: Rooms (must exist before exits reference them)
  seed_by_types(resolved, [:room])

  # Phase 3: Exits (need room UUIDs for destination_id)
  seed_exits(resolved)

  # Phase 4: NPCs and items (need room UUIDs for location_id)
  seed_by_types(resolved, [:npc, :item])
end
```

### YAML Field Mapping (V2 format after Phase 0 conversion)

After the Phase 0 YAML conversion, files are already in V2 format. The seeder maps V2 YAML fields directly to entity fields:

- `key:` → `entity.key`
- `type:` → `entity.type`
- `parent_key:` → `entity.metadata["parent_key"]`
- `short_desc:` → `entity.short_desc`
- `long_desc:` → `entity.long_desc`
- `extra_desc:` → `entity.extra_desc`
- `keywords:` → `entity.keywords`
- `tags:` → `entity_tags` join table
- `components:` → `entity.components` (JSON)
- `behaviors:` → `entity.behaviors` (JSON array)
- `scripts:` → `entity.scripts` (JSON map)
- `is_prototype:` → defaults to `true` for YAML-loaded entities

### Exit Entity Seeding

V2 YAML rooms may still have inline `exits:` (or they may have been extracted to separate files by the Phase 0 converter). The seeder handles both:

```elixir
defp seed_exits(resolved_rooms) do
  for {room_key, room_data} <- resolved_rooms,
      exit_def <- room_data["exits"] || [] do
    {:ok, source} = Entities.find_one(key: room_key, type: :room)
    {:ok, dest} = Entities.find_one(key: exit_def["destination_key"], type: :room)

    Entities.save(Entity.new(%{
      type: :exit,
      key: "#{room_key}_#{exit_def["direction"]}",
      location_id: source.id,
      is_prototype: false,
      components: %{"exit" => %{
        "direction" => exit_def["direction"],
        "destination_id" => dest.id,
        "destination_key" => exit_def["destination_key"]
      }}
    }))

    # Create reciprocal exit (bidirectional)
    reverse_dir = reverse_direction(exit_def["direction"])
    Entities.save(Entity.new(%{
      type: :exit,
      key: "#{exit_def["destination_key"]}_#{reverse_dir}",
      location_id: dest.id,
      is_prototype: false,
      components: %{"exit" => %{
        "direction" => reverse_dir,
        "destination_id" => source.id,
        "destination_key" => room_key
      }}
    }))
  end
end
```

### Conflict Resolution (MVP)

| Scenario | Rule |
|----------|------|
| New entity (key not in DB) | Insert from YAML |
| Prototype exists in DB | Update from YAML (YAML is authoritative) |
| Instance (non-prototype) | Always skip |
| `--force` flag | Overwrite all |

### Application.ex Integration

Replace `TypedObject.Loader` in the supervision tree with `EntitySeeder` GenServer. The seeder runs `seed/0` on init, then becomes idle (available for `reload_file/1` calls).

### Boot Time Estimate

~286 YAML files → ~500-1400 entities. At ~1ms per insert, first boot: 0.5-1.5 seconds.

### Tests

Create `test/loka/engine/entity_seeder_test.exs`:
- Idempotent seeding (run twice, same result)
- Inheritance resolution (child overrides parent)
- Phased ordering (rooms before exits before NPCs)
- Conflict resolution (prototype update, instance skip)
- Exit bidirectional creation
