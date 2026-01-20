defmodule LokaWeb.AdminLive.WorldBuilder.ScriptEditor do
  @moduledoc """
  Script editor component for World Builder.

  Provides a Monaco-based code editor for creating and editing scripts with:
  - Elixir syntax highlighting
  - Real-time validation
  - API reference panel
  - Test runner
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :script, :map, default: nil
  attr :entities, :list, default: []
  attr :class, :string, default: ""

  def script_editor(assigns) do
    # Format entities for the dropdown: [{key, name, type}, ...]
    entities_data =
      Enum.map(assigns.entities, fn e ->
        %{key: e.key, name: e[:name] || e[:short_desc] || e.key, type: e[:type] || "entity"}
      end)

    assigns = assign(assigns, :entities_data, entities_data)

    ~H"""
    <div class="modal-overlay" phx-click="close_script_editor">
      <div
        class="modal-content modal-fullscreen"
        phx-click-away="close_script_editor"
        style="width: 95%; max-width: 1400px; height: 90vh;"
      >
        <div class="modal-header">
          <h3>{if @script, do: "Edit Script", else: "Create Script"}</h3>
          <button phx-click="close_script_editor" class="modal-close">&times;</button>
        </div>

        <div
          id="script-editor-root"
          class="script-editor-mount"
          phx-hook="ScriptEditor"
          phx-update="ignore"
          data-script={Jason.encode!(@script)}
          data-entities={Jason.encode!(@entities_data)}
          style="flex: 1; min-height: 0;"
        >
          <!-- React ScriptEditor mounts here -->
        </div>
      </div>
    </div>
    """
  end
end
