defmodule Loka.Engine.ZoneRegistry do
  @moduledoc """
  Registry for mapping rooms to zones.

  Provides queries to find:
  - Which zone a room belongs to
  - Which rooms are in a zone
  - Whether any players are in a zone

  The registry is rebuilt when zones are loaded/reloaded.
  """

  use GenServer
  require Logger

  alias Loka.Engine.{Zone, ZoneLoader, EntityRegistry, TypedObject}
  alias Loka.Content

  @registry_table :loka_zone_registry

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the ZoneRegistry GenServer.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Finds which zone a room belongs to.

  Returns `{:ok, zone_key}` or `{:error, :not_found}`.
  """
  @spec zone_for_room(String.t(), GenServer.server()) :: {:ok, String.t()} | {:error, :not_found}
  def zone_for_room(room_key, server \\ __MODULE__) do
    GenServer.call(server, {:zone_for_room, room_key})
  end

  @doc """
  Returns all room keys in a zone.
  """
  @spec rooms_in_zone(String.t(), GenServer.server()) :: [String.t()]
  def rooms_in_zone(zone_key, server \\ __MODULE__) do
    GenServer.call(server, {:rooms_in_zone, zone_key})
  end

  @doc """
  Checks if any players are currently in any room of the zone.
  """
  @spec players_in_zone?(String.t(), GenServer.server()) :: boolean()
  def players_in_zone?(zone_key, server \\ __MODULE__) do
    GenServer.call(server, {:players_in_zone?, zone_key})
  end

  @doc """
  Returns a list of player IDs in the zone.
  """
  @spec players_in_zone(String.t(), GenServer.server()) :: [String.t()]
  def players_in_zone(zone_key, server \\ __MODULE__) do
    GenServer.call(server, {:players_in_zone, zone_key})
  end

  @doc """
  Rebuilds the room-to-zone mapping from current zone definitions.
  Called after zone reload.
  """
  @spec rebuild(GenServer.server()) :: :ok
  def rebuild(server \\ __MODULE__) do
    GenServer.call(server, :rebuild)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    # Create ETS table for room -> zone mapping
    table = :ets.new(@registry_table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      room_to_zone: %{},
      zone_to_rooms: %{}
    }

    # Build initial mapping
    {:ok, do_rebuild(state)}
  end

  @impl true
  def handle_call({:zone_for_room, room_key}, _from, state) do
    result =
      case Map.get(state.room_to_zone, room_key) do
        nil -> {:error, :not_found}
        zone_key -> {:ok, zone_key}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:rooms_in_zone, zone_key}, _from, state) do
    rooms = Map.get(state.zone_to_rooms, zone_key, [])
    {:reply, rooms, state}
  end

  @impl true
  def handle_call({:players_in_zone?, zone_key}, _from, state) do
    rooms = Map.get(state.zone_to_rooms, zone_key, [])
    has_players = Enum.any?(rooms, &room_has_players?/1)
    {:reply, has_players, state}
  end

  @impl true
  def handle_call({:players_in_zone, zone_key}, _from, state) do
    rooms = Map.get(state.zone_to_rooms, zone_key, [])

    players =
      rooms
      |> Enum.flat_map(&get_players_in_room/1)
      |> Enum.uniq()

    {:reply, players, state}
  end

  @impl true
  def handle_call(:rebuild, _from, state) do
    {:reply, :ok, do_rebuild(state)}
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp do_rebuild(state) do
    # Get zones from both sources
    # 1. ZoneLoader (legacy YAML zones)
    yaml_zones = ZoneLoader.all()

    # 2. Content.Zone (TypedObject zones)
    typed_object_zones = get_content_zones()

    # Merge - Content.Zone takes priority (by key)
    yaml_zone_keys = MapSet.new(Enum.map(yaml_zones, & &1.key))

    content_zones_converted =
      typed_object_zones
      |> Enum.reject(fn to_zone -> to_zone.key in yaml_zone_keys end)

    all_zones = yaml_zones ++ content_zones_converted

    # Build both mappings
    {room_to_zone, zone_to_rooms} = build_mappings(all_zones)

    # Update ETS table
    :ets.delete_all_objects(state.table)

    Enum.each(room_to_zone, fn {room_key, zone_key} ->
      :ets.insert(state.table, {room_key, zone_key})
    end)

    Logger.debug(
      "ZoneRegistry rebuilt: #{map_size(room_to_zone)} rooms in #{length(all_zones)} zones"
    )

    %{state | room_to_zone: room_to_zone, zone_to_rooms: zone_to_rooms}
  end

  # Get zones from Content.Zone (TypedObject system) and convert to Zone structs
  defp get_content_zones do
    try do
      Content.Zone.all()
      |> Enum.map(&typed_object_to_zone/1)
    rescue
      _ -> []
    end
  end

  # Convert TypedObject zone to Zone struct
  defp typed_object_to_zone(%TypedObject{type: :zone, key: key, name: name} = typed_object) do
    %Zone{
      key: key,
      name: name,
      rooms: Content.Zone.rooms(typed_object),
      rooms_with_tag: Content.Zone.rooms_with_tag(typed_object),
      lifespan_minutes: Content.Zone.lifespan_minutes(typed_object) || 30,
      reset_mode: Content.Zone.reset_mode(typed_object),
      resets: convert_resets(Content.Zone.resets(typed_object)),
      enabled: true,
      last_reset_at: nil
    }
  end

  # Convert reset rules from map format to Zone reset format
  defp convert_resets(resets) when is_list(resets) do
    Enum.map(resets, fn reset ->
      type_val = Map.get(reset, "type") || Map.get(reset, :type, "mob")

      type =
        cond do
          is_atom(type_val) -> type_val
          is_binary(type_val) -> String.to_existing_atom(type_val)
          true -> :mob
        end

      %{
        type: type,
        prototype: Map.get(reset, "prototype") || Map.get(reset, :prototype),
        room: Map.get(reset, "room") || Map.get(reset, :room),
        max: Map.get(reset, "max") || Map.get(reset, :max, 1)
      }
    end)
  rescue
    _ -> []
  end

  defp convert_resets(_), do: []

  defp build_mappings(zones) do
    Enum.reduce(zones, {%{}, %{}}, fn zone, {room_to_zone, zone_to_rooms} ->
      # Get all rooms for this zone (direct list + tag-based)
      rooms = get_zone_rooms(zone)

      # Build room -> zone mapping
      new_room_to_zone =
        Enum.reduce(rooms, room_to_zone, fn room_key, acc ->
          Map.put(acc, room_key, zone.key)
        end)

      # Build zone -> rooms mapping
      new_zone_to_rooms = Map.put(zone_to_rooms, zone.key, rooms)

      {new_room_to_zone, new_zone_to_rooms}
    end)
  end

  defp get_zone_rooms(%Zone{rooms: rooms, rooms_with_tag: nil}) do
    rooms
  end

  defp get_zone_rooms(%Zone{rooms: rooms, rooms_with_tag: tag}) do
    # Get rooms by tag from TypedObject.Loader
    # Note: This requires prototypes to be loaded first
    tagged_rooms = get_rooms_by_tag(tag)
    Enum.uniq(rooms ++ tagged_rooms)
  end

  defp get_rooms_by_tag(tag) do
    alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader

    try do
      TypedObjectLoader.list_by_type(:entity, :room)
      |> Enum.filter(fn proto -> tag in proto.tags end)
      |> Enum.map(& &1.key)
    rescue
      _ -> []
    end
  end

  defp room_has_players?(room_key) do
    # Use EntityRegistry to check for player entities in the room
    # get_room_occupants returns list of {entity_id, entity_type} tuples
    try do
      occupants = EntityRegistry.get_room_occupants(room_key)
      Enum.any?(occupants, fn {_id, type} -> type == :character end)
    rescue
      _ -> false
    end
  end

  defp get_players_in_room(room_key) do
    try do
      EntityRegistry.get_room_occupants(room_key)
      |> Enum.filter(fn {_id, type} -> type == :character end)
      |> Enum.map(fn {id, _type} -> id end)
    rescue
      _ -> []
    end
  end
end
