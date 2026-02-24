defmodule Loka.Framework.World.Room do
  @moduledoc """
  Room loading, formatting, and entry events for the game client.

  This module provides:
  - **Room Loading** - Converts EntitySchema records into the map format expected by GameChannel
  - **Room Entry Events** - Atmospheric descriptions when entering special rooms

  ## Room Loading

  Loads room data from the database and formats it for the "Living Ebook" UI:

      {:ok, room} = Room.load_for_display(room_id)
      # => %{id: "uuid", title: "Forest", description: "...", entities: [...], items: [...], exits: [...]}

  ## Room Entry Events

  Special rooms can trigger atmospheric messages when entered:

      # In room prototype - add the room_entry_effect tag
      tags:
        - outdoor
        - sacred
        - room_entry_effect  # Required for entry effect to trigger

  Good candidates for entry effects:
  - First entry into a new area (cave entrance, threshold)
  - Sacred or mysterious locations
  - Boss rooms or dramatic moments

  NOT recommended for entry effects:
  - Common corridors
  - Frequently-visited locations
  """

  require Logger

  alias Loka.Engine.{Entities, Hooks}

  # =============================================================================
  # Room Loading
  # =============================================================================

  @doc """
  Gets the starting room key from config.
  """
  def starting_room_key do
    Application.get_env(:loka, :game, [])[:starting_room_key] || "room_oak_tree"
  end

  @doc """
  Gets the starting room entity.
  Returns `{:ok, room_schema}` or `{:error, :not_found}`.
  """
  def get_starting_room do
    case Entities.get_entity_by_key(starting_room_key()) do
      nil -> {:error, :not_found}
      room -> {:ok, room}
    end
  end

  @doc """
  Gets the starting room ID.
  Returns the room ID or `nil` if not found.
  """
  def get_starting_room_id do
    case get_starting_room() do
      {:ok, room} -> room.id
      {:error, _} -> nil
    end
  end

  @doc """
  Loads a room and formats it for GameChannel display.

  Returns a map with:
  - `:id` - Room entity ID
  - `:title` - Room name
  - `:description` - Room description
  - `:entities` - NPCs in room (formatted for display)
  - `:items` - Items in room (formatted for display)
  - `:exits` - Available exits (formatted for display)

  ## Examples

      iex> load_for_display(room_id)
      {:ok, %{id: "uuid", title: "Forest", description: "...", entities: [...], items: [...], exits: [...]}}

      iex> load_for_display("nonexistent")
      {:error, :not_found}
  """
  def load_for_display(nil), do: {:error, :not_found}

  def load_for_display(room_id) when is_binary(room_id) do
    case Entities.get_entity(room_id) do
      nil -> {:error, :not_found}
      room -> {:ok, format_room(room)}
    end
  end

  @doc """
  Returns an empty "void" room for when no rooms exist in the database.
  """
  def empty_room do
    %{
      id: nil,
      title: "The Void",
      description:
        "There is nothing here. The world has not been created yet. " <>
          "Please seed the database with demo content.",
      tags: [],
      components: %{},
      entities: [],
      items: [],
      exits: []
    }
  end

  # =============================================================================
  # Room Entry Events
  # =============================================================================

  @entry_messages %{
    "sacred" => [
      "You sense a profound stillness here.",
      "The air feels charged with old power.",
      "A reverent hush falls over you."
    ],
    "forest" => [
      "Leaves crunch underfoot.",
      "The canopy filters the light above.",
      "The forest seems to watch your arrival.",
      "Birds fall silent as you enter."
    ],
    "cave" => [
      "The darkness closes in around you.",
      "Your footsteps echo off the stone.",
      "The air grows cool and damp.",
      "You hear water dripping somewhere ahead."
    ],
    "water" => [
      "The sound of water fills the air.",
      "A cool mist touches your face.",
      "You smell the freshness of water nearby."
    ],
    "town" => [
      "The bustle of daily life surrounds you.",
      "Voices and footsteps echo around you.",
      "The scent of cooking food drifts by."
    ],
    "mountain" => [
      "The thin mountain air fills your lungs.",
      "A cold wind buffets you.",
      "The vastness of the peaks stretches before you."
    ],
    "dark" => [
      "Shadows press close around you.",
      "The darkness seems almost alive.",
      "You feel unseen eyes upon you."
    ],
    "haunted" => [
      "A chill runs down your spine.",
      "Something feels wrong here.",
      "The air grows cold."
    ],
    "ancient" => [
      "The weight of ages presses upon this place.",
      "You sense deep history in these stones.",
      "Time seems to move differently here."
    ]
  }

  @entry_effect_delay 800

  @doc """
  Registers room event hooks. Called at application startup.
  """
  def register_hooks do
    Logger.info("Room: Registering room entry hooks...")
    Hooks.register(:at_enter_room, __MODULE__, :on_room_enter, priority: 60)
    :ok
  end

  @doc """
  Hook callback for room entry events.

  Broadcasts an atmospheric message to the player when they enter a special room.
  Only rooms with the `room_entry_effect` tag will trigger an entry message.
  """
  def on_room_enter(player_context, %{room_id: room_id}) do
    case Entities.get_entity(room_id) do
      nil ->
        :ok

      room_entity ->
        tags = room_entity.tags || []

        if "room_entry_effect" in tags do
          if message = get_entry_message(tags) do
            player_id = player_context.player_id

            Task.start(fn ->
              Process.sleep(@entry_effect_delay)
              broadcast_entry_event(player_id, message)
            end)
          end
        end

        :ok
    end
  end

  @doc """
  Gets an entry message based on room tags.
  Returns nil if no appropriate message is found.
  """
  def get_entry_message(tags) when is_list(tags) do
    matching_messages =
      tags
      |> Enum.flat_map(fn tag ->
        Map.get(@entry_messages, tag, [])
      end)

    case matching_messages do
      [] -> nil
      messages -> Enum.random(messages)
    end
  end

  def get_entry_message(_), do: nil

  @doc """
  Gets a time-appropriate entry message.
  """
  def get_time_entry_message do
    # V2: DayNight system removed, always returns nil until reimplemented as behavior
    nil
  end

  @doc """
  Gets a weather-appropriate entry message for outdoor areas.
  """
  def get_weather_entry_message do
    weather = get_current_weather()

    case weather do
      "rain" -> "Rain patters down around you."
      "storm" -> "The storm rages around you."
      "snow" -> "Snowflakes drift down from above."
      "fog" -> "Fog swirls around your feet."
      _ -> nil
    end
  end

  # =============================================================================
  # Private Helpers - Room Formatting
  # =============================================================================

  defp format_room(room) do
    contents = Entities.get_contents(room.id)

    npcs =
      contents
      |> Enum.filter(&(&1.type == :npc))
      |> Enum.reject(&is_despawned?/1)
      |> Enum.map(&format_npc/1)

    items =
      contents
      |> Enum.filter(&(&1.type == :item))
      |> Enum.map(&format_item/1)
      |> group_identical_items()

    exits = contents |> Enum.filter(&(&1.type == :exit)) |> Enum.map(&format_exit/1)

    # Extract gathering node from room components
    gathering_node = format_gathering_node(room.components)

    title = room.short_desc || "Unknown Room"
    title = if draft_entity?(room), do: "[DRAFT] " <> title, else: title

    %{
      id: room.id,
      key: room.key,
      title: title,
      description: room.extra_desc || "An empty room.",
      tags: safe_tags(room.tags),
      components: room.components || %{},
      entities: npcs,
      items: items,
      exits: exits,
      gathering_node: gathering_node
    }
  end

  defp format_gathering_node(nil), do: nil

  defp format_gathering_node(components) when is_map(components) do
    node_data = components["gathering_node"] || components[:gathering_node]

    case node_data do
      nil ->
        nil

      node when is_map(node) ->
        node_type = node["type"] || node[:type]

        %{
          type: node_type,
          name: format_node_name(node_type),
          skill_required: node["skill_required"] || node[:skill_required],
          skill_level: node["skill_level"] || node[:skill_level] || 1,
          yields: node["yields"] || node[:yields] || [],
          gather_message: node["gather_message"] || node[:gather_message],
          exhausted_message: node["exhausted_message"] || node[:exhausted_message]
        }
    end
  end

  defp format_gathering_node(_), do: nil

  defp format_node_name(nil), do: "Resource Node"

  defp format_node_name(type) when is_binary(type) do
    type
    |> String.replace("_", " ")
    |> String.split(" ")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp format_node_name(_), do: "Resource Node"

  defp is_despawned?(entity) do
    components = entity.components || %{}
    Map.get(components, "despawned", false)
  end

  defp draft_entity?(%{metadata: metadata}) when is_map(metadata) do
    Map.get(metadata, "draft") == true
  end

  defp draft_entity?(_), do: false

  defp safe_tags(%Ecto.Association.NotLoaded{}), do: []

  defp safe_tags(tags) when is_list(tags) do
    Enum.map(tags, fn
      %{tag: tag} when is_binary(tag) -> tag
      tag when is_binary(tag) -> tag
      _ -> nil
    end)
    |> Enum.reject(&is_nil/1)
  end

  defp safe_tags(_), do: []

  defp format_npc(npc) do
    components = npc.components || %{}
    name = npc.short_desc || "someone"
    name = if draft_entity?(npc), do: "[DRAFT] " <> name, else: name

    %{
      id: npc.id,
      key: npc.key,
      type: npc.type || :npc,
      name: name,
      long_desc: npc.long_desc || "",
      suffix: components["suffix"],
      description: npc.extra_desc || "A mysterious figure.",
      keywords: npc.keywords || [],
      primary_keyword: npc.primary_keyword || List.first(npc.keywords || []),
      mood: npc.mood,
      components: components,
      tags: npc.tags || []
    }
  end

  defp format_item(item) do
    components = item.components || %{}
    name = item.short_desc || "something"
    name = if draft_entity?(item), do: "[DRAFT] " <> name, else: name

    %{
      id: item.id,
      key: item.key,
      type: item.type || :item,
      name: name,
      long_desc: item.long_desc || "",
      suffix: components["suffix"],
      description: item.extra_desc || "An ordinary item.",
      keywords: item.keywords || [],
      primary_keyword: item.primary_keyword || List.first(item.keywords || []),
      components: components,
      tags: item.tags || []
    }
  end

  # Groups identical items by their prototype key.
  # Returns a list of items with a :count field for stacking display.
  # Format inspired by classic MUDs: "(3) A sword lies here."
  defp group_identical_items(items) do
    items
    |> Enum.group_by(& &1.key)
    |> Enum.flat_map(fn {_key, group} ->
      count = length(group)
      # Take the first item as representative, add count
      first = List.first(group)
      # Store all IDs for potential "get all" functionality
      all_ids = Enum.map(group, & &1.id)
      [Map.merge(first, %{count: count, all_ids: all_ids})]
    end)
  end

  defp format_exit(exit_entity) do
    components = exit_entity.components || %{}
    exit_data = components["exit"] || %{}

    destination_id = exit_data["destination_id"]
    destination_name = get_destination_name(destination_id)

    %{
      id: exit_entity.id,
      direction: exit_data["direction"] || exit_entity.short_desc || "unknown",
      destination: destination_name,
      destination_id: destination_id
    }
  end

  defp get_destination_name(nil), do: "somewhere"

  defp get_destination_name(destination_id) do
    case Entities.get_entity(destination_id) do
      nil -> "somewhere"
      room -> room.short_desc || "somewhere"
    end
  end

  # =============================================================================
  # Private Helpers - Entry Events
  # =============================================================================

  defp broadcast_entry_event(player_id, message) do
    Phoenix.PubSub.broadcast(
      Loka.PubSub,
      "entity:#{player_id}",
      {:room_entry_event, message}
    )
  end

  # V2: Weather and DayNight are now entity behaviors (Phase 7)
  defp get_current_weather, do: "clear"
end

# =============================================================================
# Backwards Compatibility Aliases
# =============================================================================

defmodule Loka.Framework.World.RoomLoader do
  @moduledoc false
  # Backwards compatibility - delegates to Room module

  defdelegate starting_room_key, to: Loka.Framework.World.Room
  defdelegate get_starting_room, to: Loka.Framework.World.Room
  defdelegate get_starting_room_id, to: Loka.Framework.World.Room

  defdelegate load_room_for_display(room_id),
    to: Loka.Framework.World.Room,
    as: :load_for_display

  defdelegate empty_room, to: Loka.Framework.World.Room
end

defmodule Loka.Framework.World.RoomEvents do
  @moduledoc false
  # Backwards compatibility - delegates to Room module

  defdelegate register_hooks, to: Loka.Framework.World.Room
  defdelegate on_room_enter(player_context, params), to: Loka.Framework.World.Room
  defdelegate get_entry_message(tags), to: Loka.Framework.World.Room
  defdelegate get_time_entry_message, to: Loka.Framework.World.Room
  defdelegate get_weather_entry_message, to: Loka.Framework.World.Room
end
