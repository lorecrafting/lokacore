defmodule Loka.Content.Zone do
  @moduledoc """
  Zone definition - OOC TypedObject.

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

  alias Loka.Engine.{Entity, Entities, TypedObject}

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
  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :zone) do
      {:ok, entity} -> Entity.to_typed_object(entity)
      error -> error
    end
  end

  @doc """
  Gets a zone by key, raises if not found.
  """
  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, zone} -> zone
      {:error, :not_found} -> raise "Zone not found: #{key}"
    end
  end

  @doc """
  Lists all zone definitions.
  """
  @spec all() :: [TypedObject.t()]
  def all do
    Entities.find_all(type: :zone, is_prototype: true)
    |> to_typed_objects()
  end

  @doc """
  Lists all published zone definitions (excludes drafts).
  """
  @spec all_published() :: [TypedObject.t()]
  def all_published do
    Entities.find_all(type: :zone, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @doc """
  Lists zones with a specific tag.
  """
  @spec list_by_tag(String.t()) :: [TypedObject.t()]
  def list_by_tag(tag) when is_binary(tag) do
    Entities.find_all(type: :zone, tags: [tag], is_prototype: true)
    |> to_typed_objects()
  end

  @doc """
  Lists published zones with a specific tag.
  """
  @spec list_by_tag_published(String.t()) :: [TypedObject.t()]
  def list_by_tag_published(tag) when is_binary(tag) do
    Entities.find_all(type: :zone, tags: [tag], is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @doc """
  Gets the list of room keys in this zone.
  """
  @spec rooms(TypedObject.t()) :: [String.t()]
  def rooms(%TypedObject{type: :zone, data: data}) do
    Map.get(data, "rooms") || Map.get(data, :rooms, [])
  end

  @doc """
  Gets the tag used to find rooms (alternative to explicit room list).
  """
  @spec rooms_with_tag(TypedObject.t()) :: String.t() | nil
  def rooms_with_tag(%TypedObject{type: :zone, data: data}) do
    Map.get(data, "rooms_with_tag") || Map.get(data, :rooms_with_tag)
  end

  @doc """
  Gets zone reset rules.
  """
  @spec resets(TypedObject.t()) :: [map()]
  def resets(%TypedObject{type: :zone, data: data}) do
    Map.get(data, "resets") || Map.get(data, :resets, [])
  end

  @doc """
  Gets zone lifespan in minutes.
  """
  @spec lifespan_minutes(TypedObject.t()) :: non_neg_integer() | nil
  def lifespan_minutes(%TypedObject{type: :zone, data: data}) do
    Map.get(data, "lifespan_minutes") || Map.get(data, :lifespan_minutes)
  end

  @doc """
  Gets the reset mode for this zone.

  - `:empty` - Reset when zone is empty of players
  - `:always` - Reset on timer regardless of players
  - `:manual` - Only reset when explicitly triggered
  """
  @spec reset_mode(TypedObject.t()) :: atom()
  def reset_mode(%TypedObject{type: :zone, data: data}) do
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
  @spec level_range(TypedObject.t()) :: {non_neg_integer(), non_neg_integer()} | nil
  def level_range(%TypedObject{type: :zone, attributes: attrs}) do
    case Map.get(attrs, "level_range") || Map.get(attrs, :level_range) do
      %{"min" => min, "max" => max} -> {min, max}
      %{min: min, max: max} -> {min, max}
      _ -> nil
    end
  end

  @doc """
  Gets entry lock expression.
  """
  @spec entry_lock(TypedObject.t()) :: String.t() | nil
  def entry_lock(%TypedObject{type: :zone, locks: locks}) do
    Map.get(locks, "enter") || Map.get(locks, :enter)
  end

  @doc """
  Checks if zone is an instance (private per-player/party).
  """
  @spec instance?(TypedObject.t()) :: boolean()
  def instance?(%TypedObject{} = zone) do
    TypedObject.has_tag?(zone, "instance")
  end

  @doc """
  Validates a zone definition.
  """
  @spec validate(TypedObject.t()) :: :ok | {:error, [String.t()]}
  def validate(%TypedObject{type: :zone} = zone) do
    errors =
      []
      |> validate_has_rooms(zone)
      |> validate_reset_rules(zone)

    if Enum.empty?(errors), do: :ok, else: {:error, errors}
  end

  def validate(%TypedObject{type: type}) do
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

  defp to_typed_objects(entities) do
    entities
    |> Enum.flat_map(fn entity ->
      case Entity.to_typed_object(entity) do
        {:ok, typed_object} -> [typed_object]
        {:error, _} -> []
      end
    end)
  end
end
