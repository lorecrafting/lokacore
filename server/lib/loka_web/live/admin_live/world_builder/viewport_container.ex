defmodule LokaWeb.AdminLive.WorldBuilder.ViewportContainer do
  @moduledoc """
  Center panel that renders either the 2D canvas viewport or an inline editor.

  When `editing_mode` is `:map`, renders the room canvas with pan/zoom and console.
  When `editing_mode` is `:script`, `:dialogue`, `:quest`, or `:cutscene`,
  renders the corresponding editor inline in the viewport area.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  alias LokaWeb.AdminLive.WorldBuilder.{DialogueEditor, ScriptEditor, QuestEditor, CutsceneEditor}

  # Canvas attrs
  attr :rooms, :list, required: true
  attr :selected_room, :string, default: nil
  attr :npc_paths, :map, default: %{}
  attr :show_npc_paths, :boolean, default: true
  attr :console_messages, :list, default: []
  attr :console_filter, :string, default: ""
  attr :level_filter, :string, default: "all"
  attr :console_collapsed, :boolean, default: false
  attr :console_height, :integer, default: 150
  attr :zones, :list, default: []
  attr :zone_colors, :map, default: %{}
  attr :show_zone_colors, :boolean, default: false
  attr :class, :string, default: ""

  # Editor attrs
  attr :editing_mode, :atom, default: :map
  attr :editing_script, :map, default: nil
  attr :editing_dialogue_tree, :map, default: %{}
  attr :editing_dialogue_npc, :string, default: nil
  attr :dialogue_selected_node, :string, default: nil
  attr :dialogue_preview_mode, :boolean, default: false
  attr :dialogue_mock_state, :map, default: %{}
  attr :npcs, :list, default: []
  attr :entities_for_editor, :list, default: []
  attr :quest_data, :map, default: nil
  attr :cutscene_data, :map, default: nil

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
        <%= if @editing_mode != :map do %>
          <.editor_view
            editing_mode={@editing_mode}
            editing_script={@editing_script}
            editing_dialogue_tree={@editing_dialogue_tree}
            editing_dialogue_npc={@editing_dialogue_npc}
            dialogue_selected_node={@dialogue_selected_node}
            dialogue_preview_mode={@dialogue_preview_mode}
            dialogue_mock_state={@dialogue_mock_state}
            npcs={@npcs}
            entities_for_editor={@entities_for_editor}
            quest_data={@quest_data}
            cutscene_data={@cutscene_data}
          />
        <% else %>
          <.canvas_view
            rooms={@rooms}
            selected_room={@selected_room}
            npc_paths={@npc_paths}
            show_npc_paths={@show_npc_paths}
            path_colors={@path_colors}
            filtered_messages={@filtered_messages}
            console_messages={@console_messages}
            console_filter={@console_filter}
            level_filter={@level_filter}
            console_collapsed={@console_collapsed}
            console_height={@console_height}
          />
        <% end %>
      </div>
    </div>
    """
  end

  # ===========================================================================
  # Editor View - replaces canvas when editing
  # ===========================================================================

  attr :editing_mode, :atom, required: true
  attr :editing_script, :map, default: nil
  attr :editing_dialogue_tree, :map, default: %{}
  attr :editing_dialogue_npc, :string, default: nil
  attr :dialogue_selected_node, :string, default: nil
  attr :dialogue_preview_mode, :boolean, default: false
  attr :dialogue_mock_state, :map, default: %{}
  attr :npcs, :list, default: []
  attr :entities_for_editor, :list, default: []
  attr :quest_data, :map, default: nil
  attr :cutscene_data, :map, default: nil

  defp editor_view(assigns) do
    ~H"""
    <div class="viewport-editor">
      <div class="viewport-editor-header">
        <button
          class="btn btn-sm btn-ghost"
          phx-click={close_event(@editing_mode)}
          title="Back to Map (Esc)"
        >
          <.icon name="hero-arrow-left" class="size-4" />
          <span>Map</span>
        </button>
        <span class="viewport-editor-title">{editor_title(@editing_mode)}</span>
        <div style="flex: 1;"></div>
      </div>
      <div class="viewport-editor-body">
        <%= case @editing_mode do %>
          <% :script -> %>
            <ScriptEditor.script_editor
              script={@editing_script}
              entities={@entities_for_editor}
              inline={true}
            />
          <% :dialogue -> %>
            <div class="viewport-dialogue-editor">
              <div
                class="dialogue-entity-selector"
                style="display: flex; align-items: center; gap: 0.5rem; padding: 8px 12px; border-bottom: 1px solid #3d3d3d; flex-shrink: 0;"
              >
                <label style="color: #909090; font-size: 0.8rem;">NPC:</label>
                <select
                  phx-change="dialogue_update_entity"
                  name="npc_key"
                  style="flex: 1; padding: 4px 8px; font-size: 0.8rem; background: #1a1a2e; border: 1px solid #333; border-radius: 4px; color: #ccc;"
                >
                  <option value="">None (standalone)</option>
                  <%= for npc <- @npcs do %>
                    <option value={npc.key} selected={@editing_dialogue_npc == npc.key}>
                      {npc[:name] || npc[:short_desc] || npc.key}
                    </option>
                  <% end %>
                </select>
              </div>
              <div style="flex: 1; overflow: hidden;">
                <DialogueEditor.dialogue_editor
                  dialogue_tree={@editing_dialogue_tree}
                  npc_key={@editing_dialogue_npc}
                  selected_node={@dialogue_selected_node}
                  show_preview={@dialogue_preview_mode}
                  mock_state={@dialogue_mock_state}
                />
              </div>
            </div>
          <% :quest -> %>
            <QuestEditor.quest_editor
              quest_data={@quest_data}
              npcs={@npcs}
            />
          <% :cutscene -> %>
            <CutsceneEditor.cutscene_editor cutscene_data={@cutscene_data} />
          <% _ -> %>
            <div style="padding: 2rem; color: #888;">Unknown editor mode</div>
        <% end %>
      </div>
    </div>
    """
  end

  # ===========================================================================
  # Canvas View - the default map view
  # ===========================================================================

  attr :rooms, :list, required: true
  attr :selected_room, :string, default: nil
  attr :npc_paths, :map, default: %{}
  attr :show_npc_paths, :boolean, default: true
  attr :path_colors, :list, default: []
  attr :filtered_messages, :list, default: []
  attr :console_messages, :list, default: []
  attr :console_filter, :string, default: ""
  attr :level_filter, :string, default: "all"
  attr :console_collapsed, :boolean, default: false
  attr :console_height, :integer, default: 150

  defp canvas_view(assigns) do
    ~H"""
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
      <div class="z-level-tabs">
        <button class="z-level-tab active" data-z-level="0">Z: 0</button>
      </div>

      <div class="viewport-info">
        <span>Rooms: {length(@rooms)}</span>
        <span>Selected: {@selected_room || "None"}</span>
      </div>

      <div class="viewport-controls-help">
        <span title="Drag to pan, scroll to zoom">Pan/Zoom</span>
        <span title="Press F to fit all rooms">F: Fit</span>
        <span title="Press R to reset view">R: Reset</span>
      </div>

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

        <form phx-change="filter_console" style="display: contents;">
          <input
            type="text"
            placeholder="Filter..."
            value={@console_filter}
            phx-debounce="100"
            name="filter"
            style="width: 100px; padding: 3px 6px; font-size: 11px; background: #1a1a2e; border: 1px solid #333; border-radius: 3px; color: #ccc;"
          />
        </form>

        <form phx-change="filter_console_level" style="display: contents;">
          <select
            name="level"
            style="padding: 3px 6px; font-size: 11px; background: #1a1a2e; border: 1px solid #333; border-radius: 3px; color: #ccc;"
          >
            <option value="all" selected={@level_filter == "all"}>All</option>
            <option value="info" selected={@level_filter == "info"}>Info</option>
            <option value="warning" selected={@level_filter == "warning"}>Warn</option>
            <option value="error" selected={@level_filter == "error"}>Error</option>
          </select>
        </form>

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
                <span class="console-timestamp">{format_timestamp(msg.timestamp)}</span>
                <span class={["console-text", "console-#{msg.level}"]}>
                  {msg[:text] || msg[:message]}
                </span>
              </div>
            <% end %>
          <% end %>
        </div>
      </div>
    </div>
    """
  end

  # ===========================================================================
  # Helpers
  # ===========================================================================

  defp editor_title(:script), do: "Script Editor"
  defp editor_title(:dialogue), do: "Dialogue Tree Editor"
  defp editor_title(:quest), do: "Quest Editor"
  defp editor_title(:cutscene), do: "Cutscene Timeline Editor"
  defp editor_title(_), do: "Editor"

  defp close_event(:script), do: "close_script_editor"
  defp close_event(:dialogue), do: "close_dialogue_editor"
  defp close_event(:quest), do: "close_quest_editor"
  defp close_event(:cutscene), do: "close_cutscene_editor"
  defp close_event(_), do: "close_editor"

  defp filter_messages(messages, filter, level) do
    messages
    |> Enum.filter(fn msg ->
      level_match = level == "all" || to_string(msg.level) == level
      text = msg[:text] || msg[:message] || ""

      text_match =
        filter == "" || String.contains?(String.downcase(text), String.downcase(filter))

      level_match && text_match
    end)
  end

  defp format_timestamp(%DateTime{} = dt) do
    dt |> DateTime.to_time() |> Time.to_string() |> String.slice(0, 8)
  end

  defp format_timestamp(ts) when is_binary(ts), do: ts
  defp format_timestamp(_), do: "--:--:--"
end
