defmodule LokaWeb.AdminLive.WorldBuilder.ConsolePanel do
  @moduledoc """
  Bottom panel console/output log component.

  Displays:
  - Validation messages
  - System output
  - Error logs

  Supports collapse mode (hidden), filtering, and export.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :console_messages, :list, default: []
  attr :console_filter, :string, default: ""
  attr :level_filter, :string, default: "all"
  attr :collapsed, :boolean, default: false
  attr :class, :string, default: ""

  def console_panel(assigns) do
    # Filter messages based on text search and level filter
    filtered_messages =
      filter_messages(
        assigns.console_messages,
        assigns.console_filter || "",
        assigns.level_filter || "all"
      )

    assigns = assign(assigns, :filtered_messages, filtered_messages)

    ~H"""
    <div class={["world-builder-panel world-builder-console", @collapsed && "panel-collapsed", @class]}>
      <div class="console-tabs" style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
        <span style="font-size: 12px; color: #888; padding-right: 8px;">Console</span>

        <input
          type="text"
          placeholder="Filter..."
          value={@console_filter}
          phx-change="filter_console"
          phx-debounce="100"
          name="filter"
          style="width: 120px; padding: 4px 8px; font-size: 11px; background: #1a1a2e; border: 1px solid #333; border-radius: 4px; color: #ccc;"
        />

        <select
          name="level"
          phx-change="filter_console_level"
          style="padding: 4px 8px; font-size: 11px; background: #1a1a2e; border: 1px solid #333; border-radius: 4px; color: #ccc;"
        >
          <option value="all" selected={@level_filter == "all"}>All</option>
          <option value="info" selected={@level_filter == "info"}>Info</option>
          <option value="warning" selected={@level_filter == "warning"}>Warning</option>
          <option value="error" selected={@level_filter == "error"}>Error</option>
        </select>

        <span style="color: #666; font-size: 11px;">
          ({length(@filtered_messages)}/{length(@console_messages)})
        </span>

        <div style="flex: 1;"></div>

        <button
          class="console-btn"
          phx-click="export_console"
          title="Export to file"
          style="background: none; border: none; padding: 4px; cursor: pointer; color: #888;"
        >
          <.icon name="hero-arrow-down-tray" class="size-4" />
        </button>
        <button
          class="console-btn"
          phx-click="clear_console"
          title="Clear console"
          style="background: none; border: none; padding: 4px; cursor: pointer; color: #888;"
        >
          <.icon name="hero-trash" class="size-4" />
        </button>
        <button
          class="panel-collapse-btn"
          phx-click="toggle_panel"
          phx-value-panel="console"
          title={if @collapsed, do: "Expand (3)", else: "Collapse (3)"}
          style="background: none; border: none; padding: 4px; cursor: pointer; color: #888;"
        >
          <.icon
            name={if @collapsed, do: "hero-chevron-up", else: "hero-chevron-down"}
            class="size-4"
          />
        </button>
      </div>

      <div class="panel-content" style={if @collapsed, do: "display: none;", else: "padding: 0;"}>
        <div class="console-output" id="console-output" phx-hook="ConsoleOutput">
          <%= if Enum.empty?(@filtered_messages) do %>
            <div class="console-message">
              <span class="console-timestamp">--:--:--</span>
              <span class="console-text console-info">
                <%= if @console_filter != "" or @level_filter != "all" do %>
                  No matching messages
                <% else %>
                  World Builder ready
                <% end %>
              </span>
            </div>
          <% else %>
            <%= for msg <- @filtered_messages do %>
              <div class="console-message">
                <span class="console-timestamp">{msg.timestamp}</span>
                <span class={["console-level", level_badge_class(msg.level)]}>
                  [{level_label(msg.level)}]
                </span>
                <span class={["console-text", "console-#{msg.level}"]}>{msg.text}</span>
              </div>
            <% end %>
          <% end %>
        </div>
      </div>
    </div>
    """
  end

  defp filter_messages(messages, filter, level) do
    messages
    |> Enum.filter(fn msg ->
      level_match = level == "all" || to_string(msg.level) == level

      text_match =
        filter == "" || String.contains?(String.downcase(msg.text), String.downcase(filter))

      level_match && text_match
    end)
  end

  defp level_badge_class(:info), do: "console-level-info"
  defp level_badge_class(:warning), do: "console-level-warning"
  defp level_badge_class(:error), do: "console-level-error"
  defp level_badge_class(_), do: "console-level-info"

  defp level_label(:info), do: "INFO"
  defp level_label(:warning), do: "WARN"
  defp level_label(:error), do: "ERR"
  defp level_label(_), do: "INFO"
end
