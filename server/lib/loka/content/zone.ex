defmodule Loka.Content.Zone do
  @moduledoc """
  Zone definition - OOC Entity.

  Zones define areas in the game world with:
  - Room membership (explicit list or by tag)
  - Reset rules (mob/item respawning)
  - Lifespan and reset modes
  - Entry requirements

  ## Usage

      # Get zone definition
      {:ok, zone} = Zone.get("dragon_mountain")

      # Get rooms in zone
      rooms = Zone.rooms(zone)

      # Get reset rules
      resets = Zone.resets(zone)

  ## YAML Structure

      key: dragon_mountain
      type: zone
      parent: base_dungeon_zone
      name: "Dragon Mountain"
      tags: [dangerous, boss_zone]
      attributes:
        level_range: {min: 10, max: 15}
      locks:
        enter: "quest_active(dragon_hunt)"
      data:
        lifespan_minutes: 30
        reset_mode: empty
        rooms:
          - mountain_base
          - winding_path
          - dragon_lair
        resets:
          - type: mob
            prototype: mountain_drake
            room: winding_path
            max: 3
  """

  alias Loka.Engine.{Entity, Entities, EntityRegistry, EntityServer, Zone}

  require Logger

  @type reset_rule :: %{
          type: :mob | :item | :container,
          prototype: String.t(),
          room: String.t() | nil,
          max: non_neg_integer(),
          interval_minutes: non_neg_integer() | nil
        }

  @doc """
  Gets a zone by key.
  """
  @spec get(String.t()) :: {:ok, Entity.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    Entities.find_one(key: key, type: :zone)
  end

  @doc """
  Gets a zone by key, raises if not found.
  """
  @spec get!(String.t()) :: Entity.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, zone} -> zone
      {:error, :not_found} -> raise "Zone not found: #{key}"
    end
  end

  @doc """
  Lists all zone definitions.
  """
  @spec all() :: [Entity.t()]
  def all do
    Entities.find_all(type: :zone, is_prototype: true)
  end

  @doc """
  Lists all published zone definitions (excludes drafts).
  """
  @spec all_published() :: [Entity.t()]
  def all_published do
    Entities.find_all(type: :zone, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  @doc """
  Lists zones with a specific tag.
  """
  @spec list_by_tag(String.t()) :: [Entity.t()]
  def list_by_tag(tag) when is_binary(tag) do
    Entities.find_all(type: :zone, tags: [tag], is_prototype: true)
  end

  @doc """
  Lists published zones with a specific tag.
  """
  @spec list_by_tag_published(String.t()) :: [Entity.t()]
  def list_by_tag_published(tag) when is_binary(tag) do
    Entities.find_all(type: :zone, tags: [tag], is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  @doc """
  Gets the list of room keys in this zone.
  """
  @spec rooms(Entity.t()) :: [String.t()]
  def rooms(%Entity{type: :zone} = entity) do
    data = entity.components["data"] || %{}
    Map.get(data, "rooms") || Map.get(data, :rooms, [])
  end

  @doc """
  Gets the tag used to find rooms (alternative to explicit room list).
  """
  @spec rooms_with_tag(Entity.t()) :: String.t() | nil
  def rooms_with_tag(%Entity{type: :zone} = entity) do
    data = entity.components["data"] || %{}
    Map.get(data, "rooms_with_tag") || Map.get(data, :rooms_with_tag)
  end

  @doc """
  Gets zone reset rules.
  """
  @spec resets(Entity.t()) :: [map()]
  def resets(%Entity{type: :zone} = entity) do
    data = entity.components["data"] || %{}
    Map.get(data, "resets") || Map.get(data, :resets, [])
  end

  @doc """
  Gets zone lifespan in minutes.
  """
  @spec lifespan_minutes(Entity.t()) :: non_neg_integer() | nil
  def lifespan_minutes(%Entity{type: :zone} = entity) do
    data = entity.components["data"] || %{}
    Map.get(data, "lifespan_minutes") || Map.get(data, :lifespan_minutes)
  end

  @doc """
  Gets the reset mode for this zone.

  - `:empty` - Reset when zone is empty of players
  - `:always` - Reset on timer regardless of players
  - `:manual` - Only reset when explicitly triggered
  """
  @spec reset_mode(Entity.t()) :: atom()
  def reset_mode(%Entity{type: :zone} = entity) do
    data = entity.components["data"] || %{}
    mode = Map.get(data, "reset_mode") || Map.get(data, :reset_mode, "empty")

    case mode do
      m when is_binary(m) -> String.to_existing_atom(m)
      m when is_atom(m) -> m
    end
  rescue
    _ -> :empty
  end

  @doc """
  Gets level range for the zone.
  """
  @spec level_range(Entity.t()) :: {non_neg_integer(), non_neg_integer()} | nil
  def level_range(%Entity{type: :zone} = entity) do
    attrs = entity.components["attributes"] || %{}

    case Map.get(attrs, "level_range") || Map.get(attrs, :level_range) do
      %{"min" => min, "max" => max} -> {min, max}
      %{min: min, max: max} -> {min, max}
      _ -> nil
    end
  end

  @doc """
  Gets entry lock expression.
  """
  @spec entry_lock(Entity.t()) :: String.t() | nil
  def entry_lock(%Entity{type: :zone} = entity) do
    locks = entity.components["locks"] || %{}
    Map.get(locks, "enter") || Map.get(locks, :enter)
  end

  @doc """
  Checks if zone is an instance (private per-player/party).
  """
  @spec instance?(Entity.t()) :: boolean()
  def instance?(%Entity{} = entity) do
    Entity.has_tag?(entity, "instance")
  end

  @doc """
  Validates a zone definition.
  """
  @spec validate(Entity.t()) :: :ok | {:error, [String.t()]}
  def validate(%Entity{type: :zone} = zone) do
    errors =
      []
      |> validate_has_rooms(zone)
      |> validate_reset_rules(zone)

    if Enum.empty?(errors), do: :ok, else: {:error, errors}
  end

  def validate(%Entity{type: type}) do
    {:error, ["Expected zone type, got: #{type}"]}
  end

  defp validate_has_rooms(errors, zone) do
    has_rooms = !Enum.empty?(rooms(zone))
    has_tag = rooms_with_tag(zone) != nil

    if has_rooms || has_tag do
      errors
    else
      ["zone must have rooms list or rooms_with_tag" | errors]
    end
  end

  defp validate_reset_rules(errors, zone) do
    invalid_resets =
      resets(zone)
      |> Enum.with_index()
      |> Enum.filter(fn {reset, _idx} ->
        prototype = Map.get(reset, "prototype") || Map.get(reset, :prototype)
        prototype == nil
      end)

    if Enum.empty?(invalid_resets) do
      errors
    else
      ["reset rules must have prototype field" | errors]
    end
  end

  # =============================================================================
  # Zone Registry Replacements (room<->zone mapping, player queries)
  # =============================================================================

  @doc """
  Lists all enabled zone definitions.

  Filters zones where the "enabled" data field is true (default).
  """
  @spec enabled() :: [Entity.t()]
  def enabled do
    all()
    |> Enum.filter(fn zone -> get_data(zone, "enabled", true) end)
  end

  @doc """
  Sets the enabled flag on a zone entity.
  """
  @spec set_enabled(String.t(), boolean()) :: :ok | {:error, term()}
  def set_enabled(zone_key, enabled_val) when is_binary(zone_key) and is_boolean(enabled_val) do
    case Entities.find_one(key: zone_key, type: :zone) do
      {:ok, entity} ->
        data = entity.components["data"] || %{}
        updated_data = Map.put(data, "enabled", enabled_val)
        updated_components = Map.put(entity.components, "data", updated_data)

        case Entities.update_entity(entity.id, %{components: updated_components}) do
          {:ok, _} -> :ok
          error -> error
        end

      error ->
        error
    end
  end

  @doc """
  Updates the last_reset_at timestamp on a zone entity.
  """
  @spec update_last_reset(String.t(), DateTime.t()) :: :ok | {:error, term()}
  def update_last_reset(zone_key, timestamp) when is_binary(zone_key) do
    case Entities.find_one(key: zone_key, type: :zone) do
      {:ok, entity} ->
        data = entity.components["data"] || %{}
        updated_data = Map.put(data, "last_reset_at", DateTime.to_iso8601(timestamp))
        updated_components = Map.put(entity.components, "data", updated_data)

        case Entities.update_entity(entity.id, %{components: updated_components}) do
          {:ok, _} -> :ok
          error -> error
        end

      {:error, _} ->
        :ok
    end
  end

  @doc """
  Finds which zone a room belongs to.

  Looks up the room's zone from the zone definitions' room lists.
  Returns `{:ok, zone_key}` or `{:error, :not_found}`.
  """
  @spec zone_for_room(String.t()) :: {:ok, String.t()} | {:error, :not_found}
  def zone_for_room(room_key) when is_binary(room_key) do
    zones = all()

    result =
      Enum.find(zones, fn zone ->
        room_list = rooms(zone)
        tag = rooms_with_tag(zone)

        in_list = room_key in room_list

        in_tag =
          if tag do
            rooms_by_tag(tag) |> Enum.member?(room_key)
          else
            false
          end

        in_list or in_tag
      end)

    case result do
      nil -> {:error, :not_found}
      zone -> {:ok, zone.key}
    end
  end

  @doc """
  Returns all room keys in a zone.
  """
  @spec rooms_in_zone(String.t()) :: [String.t()]
  def rooms_in_zone(zone_key) when is_binary(zone_key) do
    case get(zone_key) do
      {:ok, zone} ->
        room_list = rooms(zone)
        tag = rooms_with_tag(zone)

        tagged_rooms = if tag, do: rooms_by_tag(tag), else: []
        Enum.uniq(room_list ++ tagged_rooms)

      {:error, _} ->
        []
    end
  end

  @doc """
  Returns a list of character entity IDs in the zone.

  Finds all rooms in the zone, then checks each room for character occupants.
  """
  @spec players_in_zone(String.t()) :: [String.t()]
  def players_in_zone(zone_key) when is_binary(zone_key) do
    zone_rooms = rooms_in_zone(zone_key)

    zone_rooms
    |> Enum.flat_map(&get_players_in_room/1)
    |> Enum.uniq()
  end

  @doc """
  Checks if any players are currently in any room of the zone.
  """
  @spec players_in_zone?(String.t()) :: boolean()
  def players_in_zone?(zone_key) when is_binary(zone_key) do
    zone_rooms = rooms_in_zone(zone_key)
    Enum.any?(zone_rooms, &room_has_players?/1)
  end

  @doc """
  No-op rebuild. In V2, zone-room mappings are derived from entity data
  so there is no cache to rebuild.
  """
  @spec rebuild() :: :ok
  def rebuild, do: :ok

  @doc """
  Converts a zone entity to a Zone struct for the reset system.
  """
  @spec to_zone_struct(Entity.t()) :: Zone.t()
  def to_zone_struct(%Entity{type: :zone, key: key} = entity) do
    %Zone{
      key: key,
      name: entity.short_desc,
      rooms: rooms(entity),
      rooms_with_tag: rooms_with_tag(entity),
      lifespan_minutes: lifespan_minutes(entity) || 30,
      reset_mode: reset_mode(entity),
      resets: convert_resets(resets(entity)),
      enabled: get_data(entity, "enabled", true),
      last_reset_at: parse_last_reset_at(entity)
    }
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp get_data(%Entity{} = entity, field, default) do
    data = entity.components["data"] || %{}
    val = Map.get(data, field)
    if is_nil(val), do: default, else: val
  end

  defp rooms_by_tag(tag) do
    try do
      Entities.find_all(type: :room, tags: [tag])
      |> Enum.map(& &1.key)
    rescue
      _ -> []
    end
  end

  defp room_has_players?(room_key) do
    try do
      # Find room entity by key to get its ID for EntityRegistry lookup
      case Entities.find_one(key: room_key, type: :room) do
        {:ok, room} ->
          EntityRegistry.get_room_occupants(room.id)
          |> Enum.any?(fn entity_id ->
            case EntityRegistry.lookup(entity_id) do
              {:ok, pid} ->
                entity = EntityServer.get_entity(pid)
                entity && entity.type == :character

              :not_found ->
                false
            end
          end)

        {:error, _} ->
          false
      end
    rescue
      _ -> false
    end
  end

  defp get_players_in_room(room_key) do
    try do
      case Entities.find_one(key: room_key, type: :room) do
        {:ok, room} ->
          EntityRegistry.get_room_occupants(room.id)
          |> Enum.filter(fn entity_id ->
            case EntityRegistry.lookup(entity_id) do
              {:ok, pid} ->
                entity = EntityServer.get_entity(pid)
                entity && entity.type == :character

              :not_found ->
                false
            end
          end)

        {:error, _} ->
          []
      end
    rescue
      _ -> []
    end
  end

  defp convert_resets(resets) when is_list(resets) do
    Enum.map(resets, fn reset ->
      type_val = Map.get(reset, "type") || Map.get(reset, :type, "mob")

      type =
        cond do
          is_atom(type_val) -> type_val
          is_binary(type_val) -> String.to_atom(type_val)
          true -> :mob
        end

      %{
        type: type,
        prototype: Map.get(reset, "prototype") || Map.get(reset, :prototype),
        room: Map.get(reset, "room") || Map.get(reset, :room),
        rooms: Map.get(reset, "rooms") || Map.get(reset, :rooms),
        max: Map.get(reset, "max") || Map.get(reset, :max, 1),
        equipment: Map.get(reset, "equipment") || Map.get(reset, :equipment),
        inventory: Map.get(reset, "inventory") || Map.get(reset, :inventory),
        contains: Map.get(reset, "contains") || Map.get(reset, :contains),
        direction: Map.get(reset, "direction") || Map.get(reset, :direction),
        state: normalize_door_state(Map.get(reset, "state") || Map.get(reset, :state))
      }
    end)
  end

  defp convert_resets(_), do: []

  defp normalize_door_state(nil), do: nil
  defp normalize_door_state(state) when is_atom(state), do: state

  defp normalize_door_state(state) when is_binary(state) do
    String.to_atom(state)
  end

  defp parse_last_reset_at(%Entity{} = entity) do
    data = entity.components["data"] || %{}

    case Map.get(data, "last_reset_at") do
      nil ->
        nil

      iso_str when is_binary(iso_str) ->
        case DateTime.from_iso8601(iso_str) do
          {:ok, dt, _} -> dt
          _ -> nil
        end

      %DateTime{} = dt ->
        dt

      _ ->
        nil
    end
  end
end
