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
      <div
        id="viewport-content"
        class="panel-content flex-1 overflow-auto bg-wb-panel-alt !p-0"
      >
        <.editor_view
          :if={@editing_mode != :map}
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
        <.canvas_view
          :if={@editing_mode == :map}
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
    <div class="flex flex-col w-full h-full">
      <div class="flex items-center gap-2.5 py-1.5 px-2.5 bg-gradient-to-b from-wb-editor-gradient-from to-wb-editor-gradient-to border-b border-wb-border shrink-0">
        <button
          class="flex items-center gap-1 py-1 px-2 bg-transparent border border-wb-border rounded-wb-md text-wb-text cursor-pointer text-xs hover:bg-wb-input hover:border-wb-accent hover:text-wb-accent"
          phx-click={close_event(@editing_mode)}
          title="Back to Map (Esc)"
        >
          <.icon name="hero-arrow-left" class="size-4" />
          <span>Map</span>
        </button>
        <span class="text-[13px] font-medium text-wb-text-bright">{editor_title(@editing_mode)}</span>
        <div class="flex-1"></div>
      </div>
      <div class="flex-1 overflow-hidden flex flex-col">
        <%= case @editing_mode do %>
          <% :script -> %>
            <ScriptEditor.script_editor
              script={@editing_script}
              entities={@entities_for_editor}
              inline={true}
            />
          <% :dialogue -> %>
            <div class="flex flex-col w-full h-full">
              <div class="dialogue-entity-selector flex items-center gap-2 px-3 py-2 border-b border-wb-border shrink-0">
                <label class="text-wb-text-muted text-[0.8rem]">NPC:</label>
                <select
                  phx-change="dialogue_update_entity"
                  name="npc_key"
                  class="flex-1 py-1 px-2 text-[0.8rem] bg-wb-surface border border-wb-border rounded text-wb-text"
                >
                  <option value="">None (standalone)</option>
                  <%= for npc <- @npcs do %>
                    <option value={npc.key} selected={@editing_dialogue_npc == npc.key}>
                      {npc[:name] || npc[:short_desc] || npc.key}
                    </option>
                  <% end %>
                </select>
              </div>
              <div class="flex-1 overflow-hidden">
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
            <div class="p-8 text-wb-text-muted">Unknown editor mode</div>
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
      id="w-full h-full bg-wb-border-dark relative"
      phx-hook="WorldBuilder"
      phx-update="ignore"
      class="w-full h-full bg-wb-border-dark relative"
      aria-label="World map viewport"
    >
      <canvas class="w-full h-full block"></canvas>
    </div>

    <!-- Viewport overlay controls -->
    <div class="absolute top-2 left-2 right-2 flex justify-between pointer-events-none z-10 [&>*]:pointer-events-auto">
      <div class="flex gap-1 bg-[rgba(30,30,30,0.95)] p-1 rounded-wb-sm">
        <button
          class="px-[0.6rem] py-[0.35rem] border-none text-[0.7rem] cursor-pointer rounded-[2px] transition-all duration-100 font-mono bg-wb-accent-hover text-white"
          data-z-level="0"
        >
          Z: 0
        </button>
      </div>

      <div class="flex flex-col gap-1 bg-[rgba(30,30,30,0.95)] p-2 rounded-wb-sm text-[0.7rem] text-wb-text-muted">
        <span>Rooms: {length(@rooms)}</span>
        <span>Selected: {@selected_room || "None"}</span>
      </div>

      <div class="flex gap-3 bg-[rgba(30,30,30,0.95)] px-2 py-[0.35rem] rounded-wb-sm text-[0.65rem] text-wb-text-dim [&>span]:cursor-help [&>span:hover]:text-wb-text-muted">
        <span title="Drag to pan, scroll to zoom">Pan/Zoom</span>
        <span title="Press F to fit all rooms">F: Fit</span>
        <span title="Press R to reset view">R: Reset</span>
      </div>

      <div :if={@show_npc_paths and map_size(@npc_paths) > 0} class="npc-paths-legend">
        <div class="text-[10px] font-semibold text-wb-text-muted uppercase tracking-[0.5px] mb-1.5 pb-1 border-b border-wb-border flex justify-between items-center">
          <span>NPC Paths</span>
          <span class="text-[10px] text-wb-text-muted">{map_size(@npc_paths)}</span>
        </div>
        <% path_colors = @path_colors %>
        <%= for {{npc_key, path_info}, idx} <- Enum.with_index(@npc_paths) do %>
          <% color = Enum.at(path_colors, rem(idx, length(path_colors))) %>
          <div
            class="npc-path-legend-item flex items-center gap-1.5 py-0.5 px-1 cursor-pointer rounded-wb-sm"
            phx-click="highlight_npc_path"
            phx-value-npc={npc_key}
            title={"Click to highlight #{path_info[:name] || npc_key}'s patrol route"}
          >
            <span class="inline-block w-3 h-[3px] rounded-sm" style={"background: #{color}"}></span>
            <span class="text-[11px] text-wb-text flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {path_info[:name] || npc_key}
            </span>
            <span :if={path_info[:patrol]} class="text-[9px] text-wb-text-muted">
              {length(path_info[:patrol][:route] || [])} rooms
            </span>
          </div>
        <% end %>
      </div>
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
      <div class="flex gap-1 px-2 py-1 bg-wb-border-dark border-b border-wb-bg items-center flex-wrap">
        <span class="text-xs text-wb-text-muted pr-2">Console</span>

        <form phx-change="filter_console" class="contents">
          <input
            type="text"
            placeholder="Filter..."
            value={@console_filter}
            phx-debounce="100"
            name="filter"
            class="w-[100px] py-0.5 px-1.5 text-[11px] bg-wb-surface border border-wb-border rounded-wb-sm text-wb-text"
          />
        </form>

        <form phx-change="filter_console_level" class="contents">
          <select
            name="level"
            class="py-0.5 px-1.5 text-[11px] bg-wb-surface border border-wb-border rounded-wb-sm text-wb-text"
          >
            <option value="all" selected={@level_filter == "all"}>All</option>
            <option value="info" selected={@level_filter == "info"}>Info</option>
            <option value="warning" selected={@level_filter == "warning"}>Warn</option>
            <option value="error" selected={@level_filter == "error"}>Error</option>
          </select>
        </form>

        <span class="text-wb-text-faint text-[10px]">
          {length(@filtered_messages)}/{length(@console_messages)}
        </span>

        <div class="flex-1"></div>

        <button
          phx-click="export_console"
          title="Export to file"
          class="bg-transparent border-none py-0.5 px-1 cursor-pointer text-wb-text-muted"
        >
          <.icon name="hero-arrow-down-tray" class="size-3" />
        </button>
        <button
          phx-click="clear_console"
          title="Clear console"
          class="bg-transparent border-none py-0.5 px-1 cursor-pointer text-wb-text-muted"
        >
          <.icon name="hero-trash" class="size-3" />
        </button>
        <button
          class="flex items-center justify-center w-6 h-6 bg-transparent border-none text-wb-text-dim cursor-pointer rounded-wb-sm transition-all duration-150 hover:bg-wb-border hover:text-wb-text py-0.5 px-1"
          phx-click="toggle_panel"
          phx-value-panel="console"
          title={if @console_collapsed, do: "Expand (~)", else: "Collapse (~)"}
        >
          <.icon
            name={if @console_collapsed, do: "hero-chevron-up", else: "hero-chevron-down"}
            class="size-3"
          />
        </button>
      </div>

      <div
        class="panel-content flex-1 overflow-auto bg-wb-panel-alt !p-0"
        style={if @console_collapsed, do: "display: none;"}
      >
        <div
          class="font-mono text-[0.7rem] leading-relaxed p-2"
          id="console-output"
          phx-hook="ConsoleOutput"
        >
          <div
            :if={Enum.empty?(@filtered_messages)}
            class="flex gap-3 py-0.5 border-b border-wb-panel-alt"
          >
            <span class="text-wb-text-faint min-w-14 text-[0.65rem]">--:--:--</span>
            <span :if={@console_filter != "" or @level_filter != "all"} class="flex-1 text-wb-accent">
              No matching messages
            </span>
            <span :if={@console_filter == "" and @level_filter == "all"} class="flex-1 text-wb-accent">
              World Builder ready
            </span>
          </div>
          <%= for msg <- @filtered_messages do %>
            <div class="flex gap-3 py-0.5 border-b border-wb-panel-alt">
              <span class="text-wb-text-faint min-w-14 text-[0.65rem]">
                {format_timestamp(msg.timestamp)}
              </span>
              <span class={["flex-1 text-wb-text", console_level_color(msg.level)]}>
                {msg[:text] || msg[:message]}
              </span>
            </div>
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

  defp console_level_color(:info), do: "!text-wb-accent"
  defp console_level_color(:warning), do: "!text-wb-warning"
  defp console_level_color(:error), do: "!text-wb-error"
  defp console_level_color("info"), do: "!text-wb-accent"
  defp console_level_color("warning"), do: "!text-wb-warning"
  defp console_level_color("error"), do: "!text-wb-error"
  defp console_level_color(_), do: nil
end
