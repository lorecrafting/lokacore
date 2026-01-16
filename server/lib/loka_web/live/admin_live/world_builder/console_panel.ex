defmodule LokaWeb.AdminLive.WorldBuilder.ConsolePanel do
  @moduledoc """
  Bottom panel console/output log component.

  Displays:
  - Validation messages
  - System output
  - Error logs

  Supports collapse mode (hidden).
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :console_messages, :list, default: []
  attr :collapsed, :boolean, default: false
  attr :class, :string, default: ""

  def console_panel(assigns) do
    ~H"""
    <div class={["world-builder-panel world-builder-console", @collapsed && "panel-collapsed", @class]}>
      <div class="console-tabs">
        <button class="console-tab active">Output Log</button>
        <button class="console-tab">Messages</button>
        <button class="console-tab" phx-click="clear_console" title="Clear console">Clear</button>
        <div style="flex: 1;"></div>
        <button
          class="panel-collapse-btn"
          phx-click="toggle_panel"
          phx-value-panel="console"
          title={if @collapsed, do: "Expand (3)", else: "Collapse (3)"}
        >
          <.icon
            name={if @collapsed, do: "hero-chevron-up", else: "hero-chevron-down"}
            class="size-4"
          />
        </button>
      </div>

      <div class="panel-content" style={if @collapsed, do: "display: none;", else: "padding: 0;"}>
        <div class="console-output">
          <%= if Enum.empty?(@console_messages) do %>
            <div class="console-message">
              <span class="console-timestamp">00:00:00</span>
              <span class="console-text console-info">World Builder ready</span>
            </div>
          <% else %>
            <%= for msg <- @console_messages do %>
              <div class="console-message">
                <span class="console-timestamp">{msg.timestamp}</span>
                <span class={["console-text", "console-#{msg.level}"]}>{msg.text}</span>
              </div>
            <% end %>
          <% end %>
        </div>
      </div>
    </div>
    """
  end
end
