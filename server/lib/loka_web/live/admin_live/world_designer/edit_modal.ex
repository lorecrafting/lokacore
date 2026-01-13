defmodule LokaWeb.AdminLive.WorldDesigner.EditModal do
  @moduledoc """
  YAML edit modal component for the World Designer.

  Provides an inline YAML editor for rooms, quests, NPCs, and items.
  """
  use Phoenix.Component

  import LokaWeb.CoreComponents, only: [icon: 1]

  # =============================================================================
  # Edit Modal Component
  # =============================================================================

  attr :yaml, :string, required: true
  attr :entity_key, :string, required: true
  attr :entity_type, :atom, required: true
  attr :error, :string, default: nil
  attr :saving, :boolean, default: false
  attr :myself, :any, required: true

  def edit_modal(assigns) do
    ~H"""
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      phx-window-keydown="close_edit_modal"
      phx-key="Escape"
      phx-target={@myself}
    >
      <div
        class="bg-base-100 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        phx-click-away="close_edit_modal"
        phx-target={@myself}
      >
        <%!-- Header --%>
        <div class="flex items-center justify-between p-4 border-b border-base-300">
          <div>
            <h3 class="font-bold text-lg">
              Edit {@entity_type |> to_string() |> String.capitalize()}
            </h3>
            <p class="text-sm opacity-60">{@entity_key}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs opacity-50">
              {get_file_path(@entity_key, @entity_type)}
            </span>
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-circle"
              phx-click="close_edit_modal"
              phx-target={@myself}
            >
              <.icon name="hero-x-mark" class="size-5" />
            </button>
          </div>
        </div>

        <%!-- Body with YAML editor --%>
        <form phx-submit="save_yaml" phx-target={@myself} class="flex-1 flex flex-col min-h-0">
          <div class="p-4 flex-1 min-h-0 overflow-hidden">
            <%= if @error do %>
              <div class="alert alert-error mb-4">
                <.icon name="hero-exclamation-circle" class="size-5" />
                <span>{@error}</span>
              </div>
            <% end %>

            <div class="h-full">
              <label class="label">
                <span class="label-text font-medium">YAML Content</span>
                <span class="label-text-alt opacity-50">Edit directly and save</span>
              </label>
              <textarea
                name="yaml_content"
                class="textarea textarea-bordered w-full font-mono text-sm h-[50vh] resize-none"
                spellcheck="false"
                placeholder="YAML content..."
              >{@yaml}</textarea>
            </div>
          </div>

          <%!-- Footer --%>
          <div class="flex items-center justify-between p-4 border-t border-base-300 bg-base-200">
            <div class="text-xs opacity-50">
              <.icon name="hero-information-circle" class="size-4 inline" />
              Changes will be saved to disk and prototypes reloaded
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                class="btn btn-ghost"
                phx-click="close_edit_modal"
                phx-target={@myself}
              >
                Cancel
              </button>
              <button type="submit" class="btn btn-primary" disabled={@saving}>
                <%= if @saving do %>
                  <span class="loading loading-spinner loading-sm"></span> Saving...
                <% else %>
                  <.icon name="hero-check" class="size-4" /> Save Changes
                <% end %>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
    """
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp get_file_path(key, :room), do: "priv/world/prototypes/rooms/#{key}.yml"
  defp get_file_path(key, :quest), do: "priv/world/quests/#{key}.yml"
  defp get_file_path(key, :npc), do: "priv/world/prototypes/npcs/#{key}.yml"
  defp get_file_path(key, :item), do: "priv/world/prototypes/items/#{key}.yml"
  defp get_file_path(key, _), do: "priv/world/prototypes/#{key}.yml"
end
