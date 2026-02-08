---
description: Start World Builder UI development session
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Task
---

# World Builder UI Session

You are now in **World Builder Mode**, focused on the admin UI in `lib/loka_web/live/admin_live/` and `lib/loka/world_builder/`.

## Session Setup

Before diving in, clarify:
1. **What UI feature** are you implementing or modifying?
2. **Which panel/component** is affected?
3. **What user interaction** should trigger what behavior?

## Architecture Reminder

```
Layer 3: Specialized Managers (only when needed)
    ↑
Layer 2: EntityManager (default for CRUD)
    ↑
Layer 1: Content Modules (shared with game code)
```

**Rule**: Use EntityManager for simple entities. Only create specialized managers when EntityManager can't handle the UI requirements.

## Key Files

| File | Purpose |
|------|---------|
| `world_builder_live.ex` | Main LiveView coordinator |
| `entity_manager.ex` | Generic entity CRUD |
| `room_manager.ex` | Room-specific (exits, coords) |
| `hierarchy_panel.ex` | Tree navigation |
| `console_panel.ex` | Command interface |

## LiveView Patterns

### Streams (Required for Collections)
```elixir
# Setup
socket = stream(socket, :entities, list)

# Template
<div id="entities" phx-update="stream">
  <div :for={{id, e} <- @streams.entities} id={id}>{e.name}</div>
</div>

# Update (must reset)
socket = stream(socket, :entities, new_list, reset: true)
```

### Forms (Phoenix 1.8)
```elixir
# Always use to_form
socket = assign(socket, form: to_form(changeset))

# Never use changeset directly in template
<.form for={@form} phx-submit="save">
  <.input field={@form[:name]} />
</.form>
```

### Push Events to JS
```elixir
socket = push_event(socket, "event_name", %{data: value})
```

## Development Workflow

```
1. Identify component/panel to modify
2. Check existing patterns in similar components
3. Implement using streams + to_form
4. Test in browser at /admin
5. Run mix test test/loka_web/
```

## Quick Commands

```bash
# Start server
mix phx.server

# Run UI tests
mix test test/loka_web/live/admin_live/

# All web tests
mix test test/loka_web/
```

## Key Documentation

| Topic | Location |
|-------|----------|
| World Builder Plan | `docs/architecture/world-builder-master-plan.md` |
| API Reference | `docs/architecture/world-builder-api.md` |
| Channel Contract | `docs/api/channel-contract.md` |
| Phoenix 1.8 | `server/AGENTS.md` |

## Phoenix 1.8 Reminders

- Wrap content with `<Layouts.app flash={@flash} current_scope={@current_scope}>`
- Use `<.icon name="hero-x-mark" />` for icons
- Use `<.input>` component for form inputs
- `<.flash_group>` only in layouts module

## What NOT To Do

- Don't create `NPCManager`, `ItemManager` (use EntityManager)
- Don't use `@changeset` in templates (use `@form`)
- Don't forget to pass `current_scope` to layouts
- Don't skip streams for collections (causes memory issues)

## End of Session

Before finishing:
1. Test in browser at `localhost:4000/admin`
2. Run `mix test test/loka_web/`
3. Use `/save` if you found a useful pattern
4. Commit: `git add . && git commit -m "ui: ..."`
