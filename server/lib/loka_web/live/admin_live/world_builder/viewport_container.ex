defmodule LokaWeb.AdminLive.WorldBuilder.ViewportContainer do
  @moduledoc """
  Center panel 3D viewport component.

  Wraps React Three Fiber canvas with viewport controls.
  Console is embedded as an overlay at the bottom.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :rooms, :list, required: true
  attr :selected_room, :string, default: nil
  attr :console_messages, :list, default: []
  attr :console_collapsed, :boolean, default: false
  attr :camera_view, :string, default: "perspective"
  attr :class, :string, default: ""

  def viewport_container(assigns) do
    ~H"""
    <div class={"world-builder-panel world-builder-viewport #{@class}"}>
      <div class="panel-content" style="padding: 0;">
        <!-- React Three Fiber mounts here via hook -->
        <div
          id="world-builder-canvas"
          phx-hook="WorldBuilder"
          phx-update="ignore"
          class="world-builder-canvas"
          data-rooms={Jason.encode!(@rooms)}
        >
        </div>
        
    <!-- Viewport overlay controls -->
        <div class="viewport-overlay">
          <div class="viewport-mode-buttons">
            <button
              class={["viewport-mode-btn", @camera_view == "perspective" && "active"]}
              phx-click="set_camera_view"
              phx-value-view="perspective"
            >
              Perspective
            </button>
            <button
              class={["viewport-mode-btn", @camera_view == "top" && "active"]}
              phx-click="set_camera_view"
              phx-value-view="top"
            >
              Top
            </button>
            <button
              class={["viewport-mode-btn", @camera_view == "front" && "active"]}
              phx-click="set_camera_view"
              phx-value-view="front"
            >
              Front
            </button>
            <button
              class={["viewport-mode-btn", @camera_view == "side" && "active"]}
              phx-click="set_camera_view"
              phx-value-view="side"
            >
              Side
            </button>
          </div>

          <div class="viewport-info">
            <span>Rooms: {length(@rooms)}</span>
            <span>Selected: {@selected_room || "None"}</span>
          </div>
        </div>
        
    <!-- Console overlay at bottom of viewport -->
        <div class={["world-builder-console", @console_collapsed && "console-collapsed"]}>
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
