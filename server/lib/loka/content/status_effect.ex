defmodule Loka.Content.StatusEffect do
  @moduledoc """
  Status effect definition - OOC Entity.

  Status effects define buffs, debuffs, and neutral effects
  that can be applied to entities.
  """

  alias Loka.Engine.{Entity, Entities}

  @spec get(String.t()) :: {:ok, Entity.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :status) do
      {:ok, %Entity{type: :status}} = result -> result
      {:ok, _} -> {:error, :not_found}
      error -> error
    end
  end

  @spec get!(String.t()) :: Entity.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, status} -> status
      {:error, :not_found} -> raise "StatusEffect not found: #{key}"
    end
  end

  @spec all() :: [Entity.t()]
  def all do
    Entities.find_all(type: :status, is_prototype: true)
  end

  @spec all_published() :: [Entity.t()]
  def all_published do
    Entities.find_all(type: :status, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  @spec by_type(String.t()) :: [Entity.t()]
  def by_type(type) when is_binary(type) do
    all_published()
    |> Enum.filter(fn status ->
      get_data(status, "type") == type
    end)
  end

  def effect_type(%Entity{type: :status} = status),
    do: get_data(status, "type", "neutral")

  def duration(%Entity{type: :status} = status),
    do: get_data(status, "duration")

  def stackable?(%Entity{type: :status} = status),
    do: get_data(status, "stackable", false)

  def effects(%Entity{type: :status} = status),
    do: get_data(status, "effects", [])

  def max_stacks(%Entity{type: :status} = status),
    do: get_data(status, "max_stacks", 1)

  def exclusive_with(%Entity{type: :status} = status),
    do: get_data(status, "exclusive_with", [])

  def removes_actions(%Entity{type: :status} = status),
    do: get_data(status, "removes_actions", [])

  def grants_actions(%Entity{type: :status} = status),
    do: get_data(status, "grants_actions", [])

  def replaces_all_actions?(%Entity{type: :status} = status),
    do: get_data(status, "replaces_all_actions", false)

  @doc """
  Gets effects for a specific trigger.
  """
  def get_effects_for_trigger(%Entity{type: :status} = status, trigger) do
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
  def get_stat_modifiers(%Entity{type: :status} = status) do
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
  def curable_by_item?(%Entity{type: :status} = status, item_key) do
    cure_items = get_data(status, "cure_items", [])
    item_key in cure_items
  end

  @doc """
  Checks if status can be cured by an ability.
  """
  def curable_by_ability?(%Entity{type: :status} = status, ability_key) do
    cure_abilities = get_data(status, "cure_abilities", [])
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

  defp get_data(%Entity{} = entity, field, default \\ nil) do
    data = entity.components["data"] || %{}
    val = Map.get(data, field)
    if is_nil(val), do: default, else: val
  end
end
