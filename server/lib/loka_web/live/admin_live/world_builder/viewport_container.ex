defmodule LokaWeb.AdminLive.WorldBuilder.ViewportContainer do
  @moduledoc """
  Center panel 2D canvas viewport component.

  Renders rooms on a 2D canvas with pan/zoom controls.
  Supports Z-level filtering for multi-level worlds.
  Console is embedded as an overlay at the bottom.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :rooms, :list, required: true
  attr :selected_room, :string, default: nil
  attr :console_messages, :list, default: []
  attr :console_collapsed, :boolean, default: false
  attr :console_height, :integer, default: 150
  attr :class, :string, default: ""

  def viewport_container(assigns) do
    ~H"""
    <div id="viewport-panel" class={"world-builder-panel world-builder-viewport #{@class}"}>
      <div id="viewport-content" class="panel-content" style="padding: 0;">
        <!-- 2D Canvas viewport - managed by WorldBuilder hook -->
        <div
          id="world-builder-canvas"
          phx-hook="WorldBuilder"
          phx-update="ignore"
          class="world-builder-canvas"
        >
          <canvas style="width: 100%; height: 100%; display: block;"></canvas>
        </div>
        
    <!-- Viewport overlay controls -->
        <div class="viewport-overlay">
          <!-- Z-Level tabs (populated by JS) -->
          <div class="z-level-tabs">
            <button class="z-level-tab active" data-z-level="0">Z: 0</button>
          </div>

          <div class="viewport-info">
            <span>Rooms: {length(@rooms)}</span>
            <span>Selected: {@selected_room || "None"}</span>
          </div>
          
    <!-- Viewport controls help -->
          <div class="viewport-controls-help">
            <span title="Drag to pan, scroll to zoom">Pan/Zoom</span>
            <span title="Press F to fit all rooms">F: Fit</span>
            <span title="Press R to reset view">R: Reset</span>
          </div>
        </div>
        
    <!-- Console overlay at bottom of viewport -->
        <div
          class={["world-builder-console", @console_collapsed && "console-collapsed"]}
          style={"--console-height: #{@console_height}px;"}
        >
          <!-- Console resize handle -->
          <div
            class="console-resize-handle"
            data-resize="console"
            style={if @console_collapsed, do: "display: none;", else: ""}
          >
          </div>
          <div class="console-tabs">
            <button class="console-tab active">Output Log</button>
            <button class="console-tab">Messages</button>
            <button class="console-tab" phx-click="clear_console" title="Clear console">Clear</button>
            <div style="flex: 1;"></div>
            <button
              class="panel-collapse-btn"
              phx-click="toggle_panel"
              phx-value-panel="console"
              title={if @console_collapsed, do: "Expand (~)", else: "Collapse (~)"}
            >
              <.icon
                name={if @console_collapsed, do: "hero-chevron-up", else: "hero-chevron-down"}
                class="size-4"
              />
            </button>
          </div>

          <div
            class="panel-content"
            style={if @console_collapsed, do: "display: none;", else: "padding: 0;"}
          >
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
      </div>
    </div>
    """
  end
end
