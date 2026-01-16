defmodule LokaWeb.AdminLive.WorldBuilder.Toolbar do
  @moduledoc """
  Top toolbar component for World Builder.

  Provides tool selection and entity creation buttons.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :class, :string, default: ""

  attr :undo_state, :map,
    default: %{can_undo: false, can_redo: false, undo_count: 0, redo_count: 0}

  def toolbar(assigns) do
    ~H"""
    <div class={"world-builder-toolbar #{@class}"}>
      <div class="toolbar-section">
        <button class="toolbar-btn active" title="Select Mode">
          <.icon name="hero-cursor-arrow-rays" class="size-4" />
        </button>
        <button class="toolbar-btn" title="Move Tool">
          <.icon name="hero-arrows-up-down" class="size-4" />
        </button>
        <button class="toolbar-btn" title="Rotate Tool">
          <.icon name="hero-arrow-path" class="size-4" />
        </button>
        <button class="toolbar-btn" title="Scale Tool">
          <.icon name="hero-arrows-pointing-out" class="size-4" />
        </button>
      </div>

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

      <div class="toolbar-section">
        <button class="toolbar-btn" title="Play">
          <.icon name="hero-play" class="size-4" />
        </button>
        <button class="toolbar-btn" title="Pause">
          <.icon name="hero-pause" class="size-4" />
        </button>
        <button class="toolbar-btn" title="Stop">
          <.icon name="hero-stop" class="size-4" />
        </button>
      </div>

      <div class="toolbar-section">
        <button class="toolbar-btn" phx-click="create_room" title="Create Room">
          <.icon name="hero-plus" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Room</span>
        </button>
        <button class="toolbar-btn" phx-click="show_npc_editor" title="Create NPC">
          <.icon name="hero-user" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">NPC</span>
        </button>
        <button class="toolbar-btn" phx-click="show_item_editor" title="Create Item">
          <.icon name="hero-cube-transparent" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Item</span>
        </button>
        <button class="toolbar-btn" phx-click="show_quest_editor" title="Create Quest">
          <.icon name="hero-flag" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Quest</span>
        </button>
        <button class="toolbar-btn" phx-click="show_cutscene_editor" title="Create Cutscene">
          <.icon name="hero-film" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Cutscene</span>
        </button>
      </div>

      <div class="toolbar-section">
        <button class="toolbar-btn" phx-click="validate_quest_chains" title="Validate Quest Chains">
          <.icon name="hero-shield-check" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Validate</span>
        </button>
      </div>

      <div class="toolbar-section toolbar-right">
        <button
          class="toolbar-btn"
          phx-click="show_settings"
          title="Settings"
        >
          <.icon name="hero-cog-6-tooth" class="size-4" />
        </button>
        <span style="font-size: 0.75rem; color: #909090;">Loka World Builder</span>
      </div>
    </div>
    """
  end
end
