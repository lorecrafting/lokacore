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

  attr :undo_state, :map,
    default: %{can_undo: false, can_redo: false, undo_count: 0, redo_count: 0}

  def toolbar(assigns) do
    ~H"""
    <div class={"world-builder-toolbar #{@class}"}>
      <div class="toolbar-section">
        <button
          class={"toolbar-btn #{unless @undo_state.can_undo, do: "disabled"}"}
          phx-click="trigger_undo"
          title={"Undo (Ctrl+Z) - #{@undo_state.undo_count} actions"}
          disabled={not @undo_state.can_undo}
        >
          <.icon name="hero-arrow-uturn-left" class="size-4" />
        </button>
        <button
          class={"toolbar-btn #{unless @undo_state.can_redo, do: "disabled"}"}
          phx-click="trigger_redo"
          title={"Redo (Ctrl+Y) - #{@undo_state.redo_count} actions"}
          disabled={not @undo_state.can_redo}
        >
          <.icon name="hero-arrow-uturn-right" class="size-4" />
        </button>
      </div>
      
    <!-- Primary Creation: Room (main world-building action) -->
      <div class="toolbar-section">
        <button
          class="toolbar-btn toolbar-btn-primary"
          phx-click="create_room"
          title="Create Room (N)"
          style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white;"
        >
          <.icon name="hero-plus" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Room</span>
        </button>
      </div>
      
    <!-- Entity Creation: NPCs and Items (populate rooms) -->
      <div class="toolbar-section">
        <button class="toolbar-btn" phx-click="show_npc_editor" title="Create NPC">
          <.icon name="hero-user" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">NPC</span>
        </button>
        <button class="toolbar-btn" phx-click="show_item_editor" title="Create Item">
          <.icon name="hero-cube-transparent" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Item</span>
        </button>
      </div>

      <div class="toolbar-section">
        <button
          class="toolbar-btn"
          phx-click="validate_quest_chains"
          title="Validate Quest Chains (Ctrl+S)"
        >
          <.icon name="hero-shield-check" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Validate</span>
        </button>
        <button class="toolbar-btn" phx-click="show_quest_flow" title="View Quest Flow">
          <.icon name="hero-arrow-trending-up" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Flow</span>
        </button>
        <button class="toolbar-btn" phx-click="show_commit_modal" title="Git Commit (Ctrl+G)">
          <.icon name="hero-cloud-arrow-up" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Commit</span>
        </button>
      </div>

      <%!-- View options --%>
      <div class="toolbar-section">
        <button
          class={"toolbar-btn #{if @show_zone_colors, do: "active"}"}
          phx-click="toggle_zone_colors"
          title="Toggle Zone Colors (Z)"
        >
          <.icon name="hero-map" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Zones</span>
        </button>
        <button
          class={"toolbar-btn #{if @show_npc_paths, do: "active"}"}
          phx-click="toggle_npc_paths"
          title="Toggle NPC Patrol Paths (P)"
        >
          <.icon name="hero-arrow-path" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Paths</span>
        </button>
      </div>

      <div class="toolbar-section toolbar-right">
        <button
          class="toolbar-btn"
          phx-click="show_keyboard_help"
          title="Keyboard Shortcuts (?)"
        >
          <.icon name="hero-question-mark-circle" class="size-4" />
        </button>
        <button class="toolbar-btn" phx-click="show_settings" title="Settings">
          <.icon name="hero-cog-6-tooth" class="size-4" />
        </button>
      </div>
    </div>
    """
  end
end
