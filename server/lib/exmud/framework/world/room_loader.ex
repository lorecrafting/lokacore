defmodule Exmud.Framework.World.RoomLoader do
  @moduledoc """
  Loads room data from the database and formats it for GameLive display.

  Converts EntitySchema records into the map format expected by the
  "Living Ebook" game client UI.
  """

  alias Exmud.Engine.Entities

  @doc """
  Gets the starting room key from config.
  """
  def starting_room_key do
    Application.get_env(:exmud, :game, [])[:starting_room_key] || "room_oak_tree"
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
  Loads a room and formats it for GameLive display.

  Returns a map with:
  - `:id` - Room entity ID
  - `:title` - Room name
  - `:description` - Room description
  - `:entities` - NPCs in room (formatted for display)
  - `:items` - Items in room (formatted for display)
  - `:exits` - Available exits (formatted for display)

  ## Examples

      iex> load_room_for_display(room_id)
      {:ok, %{id: "uuid", title: "Forest", description: "...", entities: [...], items: [...], exits: [...]}}

      iex> load_room_for_display("nonexistent")
      {:error, :not_found}
  """
  def load_room_for_display(nil), do: {:error, :not_found}

  def load_room_for_display(room_id) when is_binary(room_id) do
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
      entities: [],
      items: [],
      exits: []
    }
  end

  # Private helpers

  defp format_room(room) do
    # Get all entities at this location
    contents = Entities.get_contents(room.id)

    # Separate by type, filtering out despawned NPCs
    npcs =
      contents
      |> Enum.filter(&(&1.type == :npc))
      |> Enum.reject(&is_despawned?/1)
      |> Enum.map(&format_npc/1)

    items = contents |> Enum.filter(&(&1.type == :item)) |> Enum.map(&format_item/1)
    exits = contents |> Enum.filter(&(&1.type == :exit)) |> Enum.map(&format_exit/1)

    %{
      id: room.id,
      title: room.name || "Unknown Room",
      description: room.description || "An empty room.",
      entities: npcs,
      items: items,
      exits: exits
    }
  end

  # Check if an entity is despawned (dead, waiting to respawn)
  defp is_despawned?(entity) do
    components = entity.components || %{}
    Map.get(components, "despawned", false)
  end

  defp format_npc(npc) do
    components = npc.components || %{}

    %{
      id: npc.id,
      name: npc.name || "someone",
      short_desc: components["short_desc"] || "",
      suffix: components["suffix"],
      description: npc.description || components["description"] || "A mysterious figure.",
      components: components
    }
  end

  defp format_item(item) do
    components = item.components || %{}

    %{
      id: item.id,
      name: item.name || "something",
      desc: components["desc"] || components["short_desc"] || "",
      suffix: components["suffix"],
      description: item.description || components["description"] || "An ordinary item.",
      components: components
    }
  end

  defp format_exit(exit_entity) do
    components = exit_entity.components || %{}

    %{
      id: exit_entity.id,
      direction: components["direction"] || "unknown",
      destination: components["destination_name"] || "somewhere",
      destination_id: components["destination_id"]
    }
  end
end
