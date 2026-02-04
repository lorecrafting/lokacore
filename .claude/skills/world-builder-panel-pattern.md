# World Builder Panel Pattern

## Trigger
Use when adding new resizable panel columns to the World Builder UI, or when working with Phoenix Channel functions from external modules.

## Key Patterns

### 1. Phoenix Channel assign/push from external modules

When calling Channel socket functions from a module that doesn't `use Phoenix.Channel`:

```elixir
# WRONG - Phoenix.Channel.assign/3 does NOT exist
socket = Phoenix.Channel.assign(socket, :key, value)

# CORRECT - import from Phoenix.Socket and Phoenix.Channel
import Phoenix.Socket, only: [assign: 3]
import Phoenix.Channel, only: [push: 3]

socket = assign(socket, :key, value)
push(socket, "event", %{data: "value"})
```

### 2. Server-computed CSS grid columns (avoids combinatorial explosion)

With N collapsible panels, explicit CSS rules = 2^N combinations. Instead, compute the full `grid-template-columns` server-side:

```elixir
# In LiveView - compute all column widths based on collapsed state
defp panel_sizes_style(panel_sizes, collapsed_panels) do
  h_col = if collapsed_panels.hierarchy, do: "40px", else: "#{panel_sizes.hierarchy}px"
  h_resize = if collapsed_panels.hierarchy, do: "0px", else: "4px"
  # ... repeat for each panel
  "--grid-columns: #{h_col} #{h_resize} 1fr #{i_resize} #{i_col} ...; "
end
```

```css
/* Single CSS rule - no combinatorial collapsed rules needed */
.world-builder-container {
  grid-template-columns: var(--grid-columns, 240px 4px 1fr 4px 260px 4px 320px);
}
```

### 3. Conditionally rendered grid columns

When a panel should be completely hidden (not 40px collapsed), conditionally render both the panel AND its resize handle:

```heex
<%= unless @collapsed_panels.terminal do %>
  <div class="panel-resize-handle" data-resize="terminal"></div>
<% end %>
<%= unless @collapsed_panels.terminal do %>
  <TerminalPanel.terminal_panel token={@token} collapsed={false} />
<% end %>
```

And set the grid columns to `0px 0px` for that panel when collapsed (server-side).

### 4. Secure admin command gating

For commands shared across all clients (admin + regular), use silent rejection:

```elixir
defp execute_builder_command(cmd, params, socket) do
  if socket.assigns.player.is_admin do
    BuilderCommands.execute(cmd, params, socket)
  else
    # IMPORTANT: identical response to unknown command - no info leakage
    push(socket, "output", %{text: "Unknown command. Type 'help' for commands."})
    {:reply, :ok, socket}
  end
end
```

## Files Reference

- Panel component pattern: `lib/loka_web/live/admin_live/world_builder/terminal_panel.ex`
- External channel module: `lib/loka_web/channels/builder_commands.ex`
- Command parser: `lib/loka_web/channels/command_parser.ex`
- Grid layout: `panel_sizes_style/2` in `world_builder_live.ex`
- PanelResize hook: `assets/js/app.js` (search `PanelResize:`)

## Checklist for adding a new panel

1. Create component in `world_builder/` (follow `terminal_panel.ex` or `chat_panel.ex`)
2. Add to `collapsed_panels` map (default true if optional)
3. Add to `panel_sizes` map
4. Update `panel_sizes_style/2` to include new columns
5. Update `toggle_panel` allowed atoms list
6. Update `resize_panel` allowed atoms list
7. Add keyboard shortcut number
8. Add toolbar toggle button
9. Add CSS styles for the panel
10. Update PanelResize hook (mouseDown, mouseMove, mouseUp)
