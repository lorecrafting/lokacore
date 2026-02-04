---
paths: ["lib/loka_web/live/admin_live/**", "lib/loka/world_builder/**"]
---

# World Builder UI Context

This context auto-loads when working in World Builder code.

## Architecture Overview

The World Builder follows a three-layer architecture:

```
Layer 3: Specialized Managers (RoomManager, TemplateManager)
    ↑ Only when EntityManager insufficient
Layer 2: EntityManager (Generic CRUD for UI)
    ↑ Use for simple entities
Layer 1: Content Modules (Quest, Dialogue, Script, Zone)
    ↑ Shared with game code
```

## When to Use Each Layer

### Layer 1: Content Modules
Use when game code also needs access:
```elixir
Content.Quest.get("quest_id")
Content.Dialogue.for_entity("npc_key")
```

### Layer 2: EntityManager (Default Choice)
Use for World Builder CRUD operations:
```elixir
# Creating entities
EntityManager.create_entity(:npc, %{name: "Guard", level: 5})
EntityManager.create_entity(:item, %{name: "Sword", item_type: "weapon"})

# Listing entities
EntityManager.list_entities(:npc)
EntityManager.search_entities(:item, "sword")
```

### Layer 3: Specialized Managers
Only create when EntityManager can't handle requirements:
```elixir
# RoomManager - has coordinate/exit complexity
RoomManager.create_room(%{key: "tavern", x: 5, y: 10})
RoomManager.add_exit("tavern", "north", "street")

# TemplateManager - has template instantiation
TemplateManager.save_as_template(entity, "guard_template")
TemplateManager.instantiate("guard_template", overrides)
```

## DO and DON'T

**DO:**
- Use `EntityManager` for NPCs, Items, simple entities
- Use `Content.*` modules for game-wide types
- Create specialized managers only for complex UI needs

**DON'T:**
- Create `NPCManager`, `ItemManager` (use EntityManager)
- Duplicate CRUD logic across managers
- Put UI-specific code in Content modules

## LiveView Patterns

### Streams for Collections
```elixir
# Mount
socket = stream(socket, :entities, EntityManager.list_entities(:npc))

# Template
<div id="entities" phx-update="stream">
  <div :for={{id, entity} <- @streams.entities} id={id}>
    {entity.name}
  </div>
</div>

# Update (must reset stream)
socket = stream(socket, :entities, new_list, reset: true)
```

### Manager Pattern
Complex LiveViews use coordinator + managers:
```elixir
# In LiveView
def handle_event("entity_action", params, socket) do
  EntityManager.handle_event(params, socket)
end

# Manager returns socket
def handle_event(params, socket) do
  # ... logic ...
  {:noreply, socket}
end
```

### Push Events to JS
```elixir
socket = push_event(socket, "highlight_room", %{room_id: room.id})
```

## Phoenix 1.8 Patterns

### Forms
```elixir
# Always use to_form
socket = assign(socket, form: to_form(changeset))

# Template
<.form for={@form} phx-submit="save">
  <.input field={@form[:name]} type="text" />
</.form>
```

### Layouts
```elixir
# Always wrap with Layouts.app
<Layouts.app flash={@flash} current_scope={@current_scope}>
  <!-- content -->
</Layouts.app>
```

## Key Files

| File | Purpose |
|------|---------|
| `world_builder_live.ex` | Main coordinator |
| `entity_manager.ex` | Generic entity CRUD |
| `room_manager.ex` | Room-specific logic |
| `hierarchy_panel.ex` | Tree navigation |
| `console_panel.ex` | Command console |

## Validation

```bash
# Run World Builder tests
mix test test/loka_web/live/admin_live/

# Run all web tests
mix test test/loka_web/
```

## Related Skills

- `.claude/skills/entity-data-structure-differences.md` - EntityManager data structure patterns

## Documentation

- `docs/architecture/world-builder-master-plan.md`
- `docs/architecture/world-builder-api.md`
- `docs/api/channel-contract.md`
