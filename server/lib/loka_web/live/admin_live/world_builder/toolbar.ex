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
        <button
          class="toolbar-btn"
          phx-click="validate_quest_chains"
          title="Validate Quest Chains (Ctrl+S)"
        >
          <.icon name="hero-shield-check" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Validate</span>
        </button>
        <button class="toolbar-btn" phx-click="show_commit_modal" title="Git Commit (Ctrl+G)">
          <.icon name="hero-cloud-arrow-up" class="size-4" />
          <span style="font-size: 0.75rem; margin-left: 4px;">Commit</span>
        </button>
      </div>

      <div class="toolbar-section toolbar-right">
        <div class="toolbar-help-dropdown">
          <button class="toolbar-btn" title="Keyboard Shortcuts">
            <.icon name="hero-question-mark-circle" class="size-4" />
          </button>
          <div class="help-dropdown-content">
            <h4>Keyboard Shortcuts</h4>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <span class="shortcut-keys">Ctrl+Z</span>
                <span class="shortcut-desc">Undo</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-keys">Ctrl+Y</span>
                <span class="shortcut-desc">Redo</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-keys">Ctrl+S</span>
                <span class="shortcut-desc">Validate All</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-keys">Ctrl+G</span>
                <span class="shortcut-desc">Git Commit</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-keys">Delete</span>
                <span class="shortcut-desc">Delete Selected</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-keys">Ctrl+D</span>
                <span class="shortcut-desc">Duplicate</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-keys">Ctrl+A</span>
                <span class="shortcut-desc">Select All</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-keys">Escape</span>
                <span class="shortcut-desc">Deselect All</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-keys">1-4</span>
                <span class="shortcut-desc">Toggle Panels</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-keys">`</span>
                <span class="shortcut-desc">Toggle Console</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-keys">N</span>
                <span class="shortcut-desc">New Room</span>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-keys">/</span>
                <span class="shortcut-desc">Focus Search</span>
              </div>
            </div>
          </div>
        </div>
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
