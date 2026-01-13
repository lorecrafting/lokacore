# Admin Dashboard Guide

The admin dashboard provides world-building tools and system management for Loka.

## Access

- **URL**: `/admin`
- **Requires**: Authenticated user with `is_admin: true`

## Tabs Overview

### Dashboard Tab
Real-time statistics from the database:
- Total players count
- Total rooms count
- Total entities count
- Total scripts count
- System status

### Players Tab
Player management:
- List all players (email, admin status, created date)
- Toggle admin privileges
- Delete players (with confirmation)

### Rooms Tab
Room CRUD operations:
- List all rooms with location info
- Create new rooms
- Edit room properties (name, description)
- Delete rooms

**Room Form Fields**:
| Field | Description |
|-------|-------------|
| Key | Unique identifier (e.g., "town_square") |
| Name | Display name (e.g., "Town Square") |
| Description | Full room description |

### Entities Tab
Entity management for NPCs, items, and other objects:
- List entities by type
- Create new entities
- Edit entity properties
- Manage tags and components

**JSON Serialization**: Entity components, behaviors, locks, scripts, and metadata are stored as JSON text in the database. When editing these fields through the admin interface or API:
- Map keys become strings when saved and loaded
- You can use atom keys when editing, but they'll be string keys when loaded
- Example: `%{health: 100}` becomes `%{"health" => 100}` after save/load

**Entity Form Fields**:
| Field | Description |
|-------|-------------|
| Type | npc, item, exit, character |
| Key | Unique identifier |
| Name | Display name |
| Description | Full description |
| Location | Parent entity (room) |
| Tags | Comma-separated tags |

### Scripts Tab
Elixir script editor:
- List all scripts
- Create new scripts
- Edit script source code
- Test script execution
- Enable/disable scripts

**Script Form Fields**:
| Field | Description |
|-------|-------------|
| Name | Script identifier |
| Description | What the script does |
| Hook | Event hook (on_enter, on_tick, etc.) |
| Source | Elixir code (sandboxed) |
| Enabled | Whether script runs |

**Available Hooks**:
- `on_enter` - Player enters room
- `on_leave` - Player leaves room
- `on_tick` - World tick (AI, timers)
- `on_use` - Item used
- `on_attack` - Combat initiated
- `on_death` - Entity dies
- `on_greet` - NPC interaction starts

### System Tab
System administration:
- Reload all scripts
- Export world data (JSON download)
- Import world data
- View system information

## Implementation

### Route Protection

The admin routes use a custom plug:

```elixir
# router.ex
pipeline :require_admin do
  plug LokaWeb.Plugs.RequireAdmin
end

scope "/admin", LokaWeb do
  pipe_through [:browser, :require_authenticated_player, :require_admin]
  live "/", AdminLive, :index
end
```

### RequireAdmin Plug

```elixir
defmodule LokaWeb.Plugs.RequireAdmin do
  def call(conn, _opts) do
    if admin?(conn.assigns[:current_scope]) do
      conn
    else
      conn
      |> put_flash(:error, "You must be an admin to access this page.")
      |> redirect(to: "/")
      |> halt()
    end
  end

  defp admin?(%{player: %{is_admin: true}}), do: true
  defp admin?(_), do: false
end
```

### LiveView Structure

The admin dashboard is a single LiveView with tab navigation:

```elixir
defmodule LokaWeb.AdminLive do
  use LokaWeb, :live_view

  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign(socket,
      active_tab: :dashboard,
      # ... initial assigns
    )}
  end

  @impl true
  def handle_event("switch_tab", %{"tab" => tab}, socket) do
    {:noreply, assign(socket, active_tab: String.to_existing_atom(tab))}
  end
end
```

## Database Context Functions

### Accounts Context (Player Management)
```elixir
Accounts.list_players()        # List all players
Accounts.count_players()       # Count players
Accounts.toggle_admin(player)  # Toggle is_admin
Accounts.delete_player(player) # Delete player
```

### Entities Context
```elixir
Entities.list_entities()              # List all entities
Entities.list_entities_by_type(:room) # Filter by type
Entities.get_entity!(id)              # Get by ID
Entities.create_entity(attrs)         # Create new
Entities.update_entity(entity, attrs) # Update
Entities.delete_entity(entity)        # Delete
```

### Scripts Context
```elixir
Scripts.list_scripts()            # List all scripts
Scripts.get_script!(id)           # Get by ID
Scripts.create_script(attrs)      # Create new
Scripts.update_script(script, attrs) # Update
Scripts.delete_script(script)     # Delete
Scripts.test_execute(script_id)   # Test run
```

## Styling

The dashboard uses DaisyUI components:
- `.btn` - Buttons
- `.badge` - Status badges
- `.card` - Content cards
- `.table` - Data tables
- `.tabs` - Tab navigation
- `.form-control` - Form inputs

## File Locations

| File | Purpose |
|------|---------|
| `lib/loka_web/live/admin_live.ex` | Main LiveView |
| `lib/loka_web/plugs/require_admin.ex` | Access control |
| `lib/loka/accounts.ex` | Player management |
| `lib/loka/engine/entities.ex` | Entity CRUD |
| `lib/loka/engine/scripts.ex` | Script CRUD |

## Making a User Admin

Via IEx console:
```elixir
player = Loka.Accounts.get_player_by_email("user@example.com")
Loka.Accounts.set_admin(player, true)
```

Via database:
```sql
UPDATE players SET is_admin = true WHERE email = 'user@example.com';
```

## Related
- [Scripting](../architecture/scripting.md) - Script system details
- [Entity System](../architecture/entity-system.md) - Entity structure
- [Persistence](../architecture/persistence.md) - Database schema
