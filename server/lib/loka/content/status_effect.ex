defmodule Loka.Content.StatusEffect do
  @moduledoc """
  Status effect definition - OOC TypedObject.

  Status effects define buffs, debuffs, and neutral effects
  that can be applied to entities.
  """

  alias Loka.Engine.{Entity, Entities, TypedObject}

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :status) do
      {:ok, entity} ->
        case Entity.to_typed_object(entity) do
          {:ok, %TypedObject{type: :status} = status} -> {:ok, status}
          _ -> {:error, :not_found}
        end

      error ->
        error
    end
  end

  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, status} -> status
      {:error, :not_found} -> raise "StatusEffect not found: #{key}"
    end
  end

  @spec all() :: [TypedObject.t()]
  def all do
    Entities.find_all(type: :status, is_prototype: true)
    |> to_typed_objects()
  end

  @spec all_published() :: [TypedObject.t()]
  def all_published do
    Entities.find_all(type: :status, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @spec by_type(String.t()) :: [TypedObject.t()]
  def by_type(type) when is_binary(type) do
    all_published()
    |> Enum.filter(fn status ->
      TypedObject.get_data(status, "type") == type
    end)
  end

  def effect_type(%TypedObject{type: :status} = status),
    do: TypedObject.get_data(status, "type", "neutral")

  def duration(%TypedObject{type: :status} = status),
    do: TypedObject.get_data(status, "duration")

  def stackable?(%TypedObject{type: :status} = status),
    do: TypedObject.get_data(status, "stackable", false)

  def effects(%TypedObject{type: :status} = status),
    do: TypedObject.get_data(status, "effects", [])

  def max_stacks(%TypedObject{type: :status} = status),
    do: TypedObject.get_data(status, "max_stacks", 1)

  def exclusive_with(%TypedObject{type: :status} = status),
    do: TypedObject.get_data(status, "exclusive_with", [])

  def removes_actions(%TypedObject{type: :status} = status),
    do: TypedObject.get_data(status, "removes_actions", [])

  def grants_actions(%TypedObject{type: :status} = status),
    do: TypedObject.get_data(status, "grants_actions", [])

  def replaces_all_actions?(%TypedObject{type: :status} = status),
    do: TypedObject.get_data(status, "replaces_all_actions", false)

  @doc """
  Gets effects for a specific trigger.
  """
  def get_effects_for_trigger(%TypedObject{type: :status} = status, trigger) do
    effects(status)
    |> Enum.filter(fn effect ->
      trigger_val = Map.get(effect, "trigger") || Map.get(effect, :trigger)
      normalize_trigger(trigger_val) == trigger
    end)
  end

  @doc """
  Gets all passive stat modifiers from this status.
  Returns a list of `{stat, modifier}` tuples.
  """
  def get_stat_modifiers(%TypedObject{type: :status} = status) do
    effects(status)
    |> Enum.filter(fn effect ->
      trigger_val = Map.get(effect, "trigger") || Map.get(effect, :trigger)

      action_val =
        Map.get(effect, "effect") || Map.get(effect, :effect) || Map.get(effect, "action") ||
          Map.get(effect, :action)

      normalize_trigger(trigger_val) == :passive and normalize_action(action_val) == :stat_modify
    end)
    |> Enum.map(fn effect ->
      stat = Map.get(effect, "stat") || Map.get(effect, :stat)
      modifier = Map.get(effect, "modifier") || Map.get(effect, :modifier) || 0
      {stat, modifier}
    end)
  end

  @doc """
  Checks if status can be cured by an item.
  """
  def curable_by_item?(%TypedObject{type: :status} = status, item_key) do
    cure_items = TypedObject.get_data(status, "cure_items", [])
    item_key in cure_items
  end

  @doc """
  Checks if status can be cured by an ability.
  """
  def curable_by_ability?(%TypedObject{type: :status} = status, ability_key) do
    cure_abilities = TypedObject.get_data(status, "cure_abilities", [])
    ability_key in cure_abilities
  end

  defp normalize_trigger(val) when is_atom(val), do: val

  defp normalize_trigger(val) when is_binary(val) do
    String.to_existing_atom(val)
  rescue
    ArgumentError -> :unknown
  end

  defp normalize_trigger(_), do: :unknown

  defp normalize_action(val) when is_atom(val), do: val

  defp normalize_action(val) when is_binary(val) do
    String.to_existing_atom(val)
  rescue
    ArgumentError -> :unknown
  end

  defp normalize_action(_), do: :unknown

  defp to_typed_objects(entities) do
    entities
    |> Enum.map(fn entity ->
      case Entity.to_typed_object(entity) do
        {:ok, to} -> to
        _ -> nil
      end
    end)
    |> Enum.reject(&is_nil/1)
  end
end
