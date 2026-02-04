defmodule LokaWeb.AdminLive.WorldBuilder.Toolbar do
  @moduledoc """
  Top toolbar component for World Builder.

  Provides tool selection and entity creation buttons.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :class, :string, default: ""
  attr :show_zone_colors, :boolean, default: true
  attr :show_npc_paths, :boolean, default: true
  attr :terminal_active, :boolean, default: false

  attr :undo_state, :map,
    default: %{can_undo: false, can_redo: false, undo_count: 0, redo_count: 0}

  def toolbar(assigns) do
    ~H"""
    <div class={"flex items-center gap-[0.35rem] px-3 py-[0.4rem] bg-gradient-to-b from-wb-toolbar to-wb-surface border-b border-wb-toolbar-border min-h-10 relative z-20 shadow-wb-sm #{@class}"}>
      <div class={toolbar_section()}>
        <button
          class={toolbar_btn()}
          phx-click="trigger_undo"
          title={"Undo (Ctrl+Z) - #{@undo_state.undo_count} actions"}
          aria-label="Undo"
          disabled={not @undo_state.can_undo}
        >
          <.icon name="hero-arrow-uturn-left" class="size-4" />
        </button>
        <button
          class={toolbar_btn()}
          phx-click="trigger_redo"
          title={"Redo (Ctrl+Y) - #{@undo_state.redo_count} actions"}
          aria-label="Redo"
          disabled={not @undo_state.can_redo}
        >
          <.icon name="hero-arrow-uturn-right" class="size-4" />
        </button>
      </div>

      <%!-- Primary Creation: Room (main world-building action) --%>
      <div class={toolbar_section()}>
        <button
          class={toolbar_btn(active: true)}
          phx-click="create_room"
          title="Create Room (N)"
        >
          <.icon name="hero-plus" class="size-4" />
          <span class="text-wb-xs ml-1">Room</span>
        </button>
      </div>

      <%!-- Entity Creation: NPCs and Items (populate rooms) --%>
      <div class={toolbar_section()}>
        <button class={toolbar_btn()} phx-click="show_npc_editor" title="Create NPC">
          <.icon name="hero-user" class="size-4" />
          <span class="text-wb-xs ml-1">NPC</span>
        </button>
        <button class={toolbar_btn()} phx-click="show_item_editor" title="Create Item">
          <.icon name="hero-cube-transparent" class="size-4" />
          <span class="text-wb-xs ml-1">Item</span>
        </button>
      </div>

      <div class={toolbar_section()}>
        <button
          class={toolbar_btn()}
          phx-click="validate_quest_chains"
          title="Validate Quest Chains (Ctrl+S)"
        >
          <.icon name="hero-shield-check" class="size-4" />
          <span class="text-wb-xs ml-1">Validate</span>
        </button>
        <button class={toolbar_btn()} phx-click="show_quest_flow" title="View Quest Flow">
          <.icon name="hero-arrow-trending-up" class="size-4" />
          <span class="text-wb-xs ml-1">Flow</span>
        </button>
        <button class={toolbar_btn()} phx-click="show_commit_modal" title="Git Commit (Ctrl+G)">
          <.icon name="hero-cloud-arrow-up" class="size-4" />
          <span class="text-wb-xs ml-1">Commit</span>
        </button>
      </div>

      <%!-- View options --%>
      <div class={toolbar_section()}>
        <button
          class={toolbar_btn(active: @show_zone_colors)}
          phx-click="toggle_zone_colors"
          title="Toggle Zone Colors (Z)"
        >
          <.icon name="hero-map" class="size-4" />
          <span class="text-wb-xs ml-1">Zones</span>
        </button>
        <button
          class={toolbar_btn(active: @show_npc_paths)}
          phx-click="toggle_npc_paths"
          title="Toggle NPC Patrol Paths (P)"
        >
          <.icon name="hero-arrow-path" class="size-4" />
          <span class="text-wb-xs ml-1">Paths</span>
        </button>
      </div>

      <div class={["ml-auto flex items-center gap-2", toolbar_section_base()]}>
        <button
          class={toolbar_btn(active: @terminal_active)}
          phx-click="toggle_panel"
          phx-value-panel="terminal"
          title="Terminal (5)"
        >
          <.icon name="hero-command-line" class="size-4" />
          <span class="text-wb-xs ml-1">Terminal</span>
        </button>
        <button
          class={toolbar_btn()}
          phx-click="show_keyboard_help"
          title="Keyboard Shortcuts (?)"
          aria-label="Keyboard Shortcuts"
        >
          <.icon name="hero-question-mark-circle" class="size-4" />
        </button>
        <button class={toolbar_btn()} phx-click="show_settings" title="Settings" aria-label="Settings">
          <.icon name="hero-cog-6-tooth" class="size-4" />
        </button>
      </div>
    </div>
    """
  end

  defp toolbar_section_base,
    do: "flex items-center gap-[0.35rem] px-2.5"

  defp toolbar_section,
    do: "#{toolbar_section_base()} border-r border-wb-border mr-[0.15rem]"

  @toolbar_btn_base "flex items-center justify-center gap-[0.35rem] min-w-8 h-8 px-2.5 border cursor-pointer rounded-wb-md transition-all duration-150 whitespace-nowrap text-wb-sm font-medium"
  @toolbar_btn_default "#{@toolbar_btn_base} bg-transparent border-transparent text-wb-text-muted hover:bg-wb-hover hover:text-wb-text-bright hover:border-wb-border disabled:opacity-35 disabled:cursor-not-allowed"
  @toolbar_btn_active "#{@toolbar_btn_base} bg-gradient-to-br from-[#1a56a0] to-[#0e7ad8] text-white border-[#2878c8] shadow-[0_1px_4px_rgba(14,122,216,0.3)]"

  defp toolbar_btn(opts \\ []) do
    if Keyword.get(opts, :active, false), do: @toolbar_btn_active, else: @toolbar_btn_default
  end
end
