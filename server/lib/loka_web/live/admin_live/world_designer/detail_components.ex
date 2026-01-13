defmodule LokaWeb.AdminLive.WorldDesigner.DetailComponents do
  @moduledoc """
  Detail panel components for the World Designer.

  Renders the detail panel showing information about the selected room or quest.
  """
  use Phoenix.Component

  import LokaWeb.CoreComponents, only: [icon: 1]

  # =============================================================================
  # Detail Panel Component
  # =============================================================================

  attr :selected, :any, required: true
  attr :selected_type, :atom, required: true
  attr :data, :map, required: true
  attr :myself, :any, required: true

  def detail_panel(assigns) do
    ~H"""
    <div class="card bg-base-200">
      <div class="card-body p-4">
        <%= if @selected do %>
          <%= case @selected_type do %>
            <% :room -> %>
              <.room_details
                room={find_room(@data.rooms, @selected)}
                quests={@data.quests}
                myself={@myself}
              />
            <% :quest -> %>
              <.quest_details
                quest={find_quest(@data.quests, @selected)}
                rooms={@data.rooms}
                myself={@myself}
              />
            <% _ -> %>
              <.empty_selection />
          <% end %>
        <% else %>
          <.empty_selection />
        <% end %>
      </div>
    </div>
    """
  end

  # =============================================================================
  # Empty Selection Component
  # =============================================================================

  defp empty_selection(assigns) do
    ~H"""
    <div class="text-center text-sm opacity-60 py-8">
      <.icon name="hero-cursor-arrow-rays" class="size-8 mb-2 opacity-40" />
      <p>Select a room or quest to see details</p>
    </div>
    """
  end

  # =============================================================================
  # Room Details Component
  # =============================================================================

  attr :room, :map, required: true
  attr :quests, :list, required: true
  attr :myself, :any, required: true

  defp room_details(assigns) do
    assigns = assign(assigns, :room, assigns.room || %{})

    ~H"""
    <%= if @room != %{} do %>
      <div>
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="font-bold text-lg">{@room.name}</h3>
            <div class="text-xs opacity-60">
              {format_coordinates(@room.coordinates)} | Key: {@room.key}
            </div>
          </div>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            phx-click="open_edit_modal"
            phx-value-key={@room.key}
            phx-value-type="room"
            phx-target={@myself}
          >
            <.icon name="hero-pencil-square" class="size-4" /> Edit YAML
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 class="font-semibold text-sm mb-2">Exits</h4>
            <div class="space-y-1 text-sm">
              <%= if map_size(@room.exits) > 0 do %>
                <div :for={{dir, target} <- @room.exits} class="flex justify-between">
                  <span class="capitalize">{dir}</span>
                  <span class="opacity-60">{target}</span>
                </div>
              <% else %>
                <span class="opacity-50">No exits</span>
              <% end %>
            </div>
          </div>

          <div>
            <h4 class="font-semibold text-sm mb-2">NPCs ({length(@room.npcs)})</h4>
            <div class="space-y-1 text-sm">
              <%= if length(@room.npcs) > 0 do %>
                <div :for={npc <- @room.npcs} class="flex items-center gap-1">
                  <span :if={length(npc.gives_quests) > 0}>🟢</span>
                  <span>{npc.name}</span>
                </div>
              <% else %>
                <span class="opacity-50">No NPCs</span>
              <% end %>
            </div>
          </div>

          <div>
            <h4 class="font-semibold text-sm mb-2">Quest Involvement</h4>
            <div class="space-y-1 text-sm">
              <%= if length(@room.quest_markers) > 0 do %>
                <div :for={marker <- @room.quest_markers} class="flex items-center gap-1">
                  <span>{marker_icon(marker.type)}</span>
                  <span>{marker.quest_id}</span>
                </div>
              <% else %>
                <span class="opacity-50">No quest markers</span>
              <% end %>
            </div>
          </div>
        </div>

        <%= if length(@room.validation_warnings) > 0 do %>
          <div class="mt-4">
            <h4 class="font-semibold text-sm mb-2 text-warning">Warnings</h4>
            <ul class="list-disc list-inside text-sm text-warning">
              <li :for={warning <- @room.validation_warnings}>{warning}</li>
            </ul>
          </div>
        <% end %>
      </div>
    <% else %>
      <p class="opacity-50">Room not found</p>
    <% end %>
    """
  end

  # =============================================================================
  # Quest Details Component
  # =============================================================================

  attr :quest, :map, required: true
  attr :rooms, :list, required: true
  attr :myself, :any, required: true

  defp quest_details(assigns) do
    assigns = assign(assigns, :quest, assigns.quest || %{})

    ~H"""
    <%= if @quest != %{} do %>
      <div>
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="font-bold text-lg">{@quest.name}</h3>
            <div class="text-xs opacity-60">
              Type: {@quest.type} | ID: {@quest.id}
              <%= if @quest.storyline do %>
                | Storyline: {@quest.storyline}
              <% end %>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            phx-click="open_edit_modal"
            phx-value-key={@quest.id}
            phx-value-type="quest"
            phx-target={@myself}
          >
            <.icon name="hero-pencil-square" class="size-4" /> Edit YAML
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 class="font-semibold text-sm mb-2">Flow</h4>
            <div class="text-sm space-y-1">
              <div>
                <span class="opacity-60">Giver:</span>
                <span :if={@quest.giver}>{@quest.giver}</span>
                <span :if={!@quest.giver} class="text-warning">Not set</span>
              </div>
              <div :if={@quest.giver_room}>
                <span class="opacity-60">Location:</span>
                <span>{@quest.giver_room}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 class="font-semibold text-sm mb-2">Objectives ({length(@quest.objectives)})</h4>
            <div class="space-y-1 text-sm max-h-32 overflow-auto">
              <%= if length(@quest.objectives) > 0 do %>
                <div :for={obj <- @quest.objectives} class="flex items-start gap-1">
                  <span class="opacity-60">{obj.type}</span>
                  <span class="truncate" title={obj.description}>{obj.description}</span>
                </div>
              <% else %>
                <span class="text-warning">No objectives</span>
              <% end %>
            </div>
          </div>

          <div>
            <h4 class="font-semibold text-sm mb-2">Rewards</h4>
            <div class="text-sm space-y-1">
              <div :if={@quest.rewards.xp > 0}>XP: {@quest.rewards.xp}</div>
              <div :if={@quest.rewards.gold > 0}>Gold: {@quest.rewards.gold}</div>
              <div :for={item <- @quest.rewards.items}>Item: {item}</div>
              <%= if @quest.rewards.xp == 0 and @quest.rewards.gold == 0 and @quest.rewards.items == [] do %>
                <span class="opacity-50">No rewards</span>
              <% end %>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <h4 class="font-semibold text-sm mb-2">Prerequisites</h4>
            <div class="text-sm">
              <%= if length(@quest.prerequisites) > 0 do %>
                <span :for={prereq <- @quest.prerequisites} class="badge badge-sm mr-1">
                  {prereq}
                </span>
              <% else %>
                <span class="opacity-50">None</span>
              <% end %>
            </div>
          </div>
          <div>
            <h4 class="font-semibold text-sm mb-2">Unlocks</h4>
            <div class="text-sm">
              <%= if length(@quest.unlocks) > 0 do %>
                <span :for={unlock <- @quest.unlocks} class="badge badge-sm badge-primary mr-1">
                  {unlock}
                </span>
              <% else %>
                <span class="opacity-50">Nothing</span>
              <% end %>
            </div>
          </div>
        </div>

        <%= if length(@quest.validation_warnings) > 0 do %>
          <div class="mt-4">
            <h4 class="font-semibold text-sm mb-2 text-warning">Warnings</h4>
            <ul class="list-disc list-inside text-sm text-warning">
              <li :for={warning <- @quest.validation_warnings}>{warning}</li>
            </ul>
          </div>
        <% end %>
      </div>
    <% else %>
      <p class="opacity-50">Quest not found</p>
    <% end %>
    """
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp find_room(rooms, key), do: Enum.find(rooms, &(&1.key == key))
  defp find_quest(quests, id), do: Enum.find(quests, &(&1.id == id))

  defp format_coordinates({x, y, z}), do: "(#{x}, #{y}, #{z})"
  defp format_coordinates(_), do: "(?, ?, ?)"

  defp marker_icon(:giver), do: "🟢"
  defp marker_icon(:objective), do: "📍"
  defp marker_icon(:turn_in), do: "🏠"
  defp marker_icon(_), do: "❓"
end
