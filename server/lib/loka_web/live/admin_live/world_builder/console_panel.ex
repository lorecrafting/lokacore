defmodule LokaWeb.AdminLive.WorldBuilder.ConsolePanel do
  @moduledoc """
  Bottom panel console/output log component.

  Displays:
  - Validation messages
  - System output
  - Error logs
  """
  use Phoenix.Component

  attr :console_messages, :list, default: []
  attr :class, :string, default: ""

  def console_panel(assigns) do
    ~H"""
    <div class={"world-builder-panel world-builder-console #{@class}"}>
      <div class="console-tabs">
        <button class="console-tab active">Output Log</button>
        <button class="console-tab">Messages</button>
        <button class="console-tab" phx-click="clear_console" title="Clear console">Clear</button>
      </div>

      <div class="panel-content" style="padding: 0;">
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
