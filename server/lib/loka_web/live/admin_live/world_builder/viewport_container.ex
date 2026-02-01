defmodule LokaWeb.AdminLive.WorldBuilder.ViewportContainer do
  @moduledoc """
  Center panel 2D canvas viewport component.

  Renders rooms on a 2D canvas with pan/zoom controls.
  Supports Z-level filtering for multi-level worlds.
  Console is embedded as an overlay at the bottom with filtering and export.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :rooms, :list, required: true
  attr :selected_room, :string, default: nil
  attr :zones, :list, default: []
  attr :zone_colors, :map, default: %{}
  attr :show_zone_colors, :boolean, default: true
  attr :npc_paths, :map, default: %{}
  attr :show_npc_paths, :boolean, default: true
  attr :console_messages, :list, default: []
  attr :console_filter, :string, default: ""
  attr :level_filter, :string, default: "all"
  attr :console_collapsed, :boolean, default: false
  attr :console_height, :integer, default: 150
  attr :class, :string, default: ""

  # Path colors matching Canvas2DViewport.js
  @path_colors [
    "#ff6b6b",
    "#4ecdc4",
    "#45b7d1",
    "#96ceb4",
    "#ffeaa7",
    "#dfe6e9",
    "#fd79a8",
    "#a29bfe"
  ]

  def viewport_container(assigns) do
    # Filter messages based on text search and level filter
    filtered_messages =
      filter_messages(
        assigns.console_messages,
        assigns.console_filter || "",
        assigns.level_filter || "all"
      )

    assigns =
      assigns
      |> assign(:filtered_messages, filtered_messages)
      |> assign(:path_colors, @path_colors)

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
          
    <!-- Zone Legend -->
          <%= if @show_zone_colors and map_size(@zone_colors) > 0 do %>
            <div class="zone-legend">
              <div class="zone-legend-title">Zones</div>
              <%= for zone <- @zones do %>
                <div class="zone-legend-item">
                  <span
                    class="zone-legend-color"
                    style={"background-color: #{Map.get(@zone_colors, zone.key, "#888")}"}
                  >
                  </span>
                  <span class="zone-legend-name">{zone.name || zone.key}</span>
                </div>
              <% end %>
            </div>
          <% end %>
          
    <!-- NPC Paths Legend -->
          <%= if @show_npc_paths and map_size(@npc_paths) > 0 do %>
            <div class="npc-paths-legend">
              <div
                class="zone-legend-title"
                style="display: flex; justify-content: space-between; align-items: center;"
              >
                <span>NPC Paths</span>
                <span style="font-size: 10px; color: #666;">{map_size(@npc_paths)}</span>
              </div>
              <% path_colors = @path_colors %>
              <%= for {{npc_key, path_info}, idx} <- Enum.with_index(@npc_paths) do %>
                <% color = Enum.at(path_colors, rem(idx, length(path_colors))) %>
                <div
                  class="npc-path-legend-item"
                  phx-click="highlight_npc_path"
                  phx-value-npc={npc_key}
                  style="display: flex; align-items: center; gap: 6px; padding: 2px 4px; cursor: pointer; border-radius: 3px;"
                  title={"Click to highlight #{path_info[:name] || npc_key}'s patrol route"}
                >
                  <span style={"width: 12px; height: 3px; background: #{color}; border-radius: 2px; display: inline-block;"}>
                  </span>
                  <span style="font-size: 11px; color: #ccc; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {path_info[:name] || npc_key}
                  </span>
                  <%= if patrol = path_info[:patrol] do %>
                    <span style="font-size: 9px; color: #666;">
                      {length(patrol[:route] || [])} rooms
                    </span>
                  <% end %>
                </div>
              <% end %>
            </div>
          <% end %>
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
          <div
            class="console-tabs"
            style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;"
          >
            <span style="font-size: 12px; color: #888; padding-right: 8px;">Console</span>

            <input
              type="text"
              placeholder="Filter..."
              value={@console_filter}
              phx-change="filter_console"
              phx-debounce="100"
              name="filter"
              style="width: 100px; padding: 3px 6px; font-size: 11px; background: #1a1a2e; border: 1px solid #333; border-radius: 3px; color: #ccc;"
            />

            <select
              name="level"
              phx-change="filter_console_level"
              style="padding: 3px 6px; font-size: 11px; background: #1a1a2e; border: 1px solid #333; border-radius: 3px; color: #ccc;"
            >
              <option value="all" selected={@level_filter == "all"}>All</option>
              <option value="info" selected={@level_filter == "info"}>Info</option>
              <option value="warning" selected={@level_filter == "warning"}>Warn</option>
              <option value="error" selected={@level_filter == "error"}>Error</option>
            </select>

            <span style="color: #555; font-size: 10px;">
              {length(@filtered_messages)}/{length(@console_messages)}
            </span>

            <div style="flex: 1;"></div>

            <button
              phx-click="export_console"
              title="Export to file"
              style="background: none; border: none; padding: 2px 4px; cursor: pointer; color: #666;"
            >
              <.icon name="hero-arrow-down-tray" class="size-3" />
            </button>
            <button
              phx-click="clear_console"
              title="Clear console"
              style="background: none; border: none; padding: 2px 4px; cursor: pointer; color: #666;"
            >
              <.icon name="hero-trash" class="size-3" />
            </button>
            <button
              class="panel-collapse-btn"
              phx-click="toggle_panel"
              phx-value-panel="console"
              title={if @console_collapsed, do: "Expand (~)", else: "Collapse (~)"}
              style="background: none; border: none; padding: 2px 4px; cursor: pointer; color: #666;"
            >
              <.icon
                name={if @console_collapsed, do: "hero-chevron-up", else: "hero-chevron-down"}
                class="size-3"
              />
            </button>
          </div>

          <div
            class="panel-content"
            style={if @console_collapsed, do: "display: none;", else: "padding: 0;"}
          >
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

  defp filter_messages(messages, filter, level) do
    messages
    |> Enum.filter(fn msg ->
      level_match = level == "all" || to_string(msg.level) == level

      text_match =
        filter == "" || String.contains?(String.downcase(msg.text), String.downcase(filter))

      level_match && text_match
    end)
  end
end
