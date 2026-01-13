defmodule Loka.Primitives.Value do
  @moduledoc """
  Pure data structure for simple values with modifiers (gold, XP, stats, etc.).

  This is a primitive - no game logic, just data operations with audit trails.
  Value tracks a base value plus stacking modifiers (flat and percentage).

  ## Structure

      %Value{
        base: 100,
        modifiers: [
          %{id: "buff_str", type: :flat, amount: 10, source: "strength_potion"},
          %{id: "debuff_weak", type: :percent, amount: -0.2, source: "curse"}
        ]
      }

  ## Modifier Types

  - `:flat` - Added/subtracted directly (e.g., +10 strength)
  - `:percent` - Multiplied after flat mods (e.g., +20% = 0.2)

  ## Calculation Order

  1. Start with base value
  2. Add all flat modifiers
  3. Multiply by (1 + sum of percent modifiers)

  ## Usage

      alias Loka.Primitives.Value

      # Create a value
      value = Value.new(100)

      # Add modifiers
      {:ok, value, audit} = Value.add_modifier(value, "buff", :flat, 10, "potion")
      {:ok, value, audit} = Value.add_modifier(value, "boost", :percent, 0.2, "skill")

      # Get computed value
      Value.compute(value)  # => 132  (100 + 10) * 1.2

      # Remove modifier
      {:ok, value, audit} = Value.remove_modifier(value, "buff")
  """

  @type modifier :: %{
          id: String.t(),
          type: :flat | :percent,
          amount: number(),
          source: String.t() | nil
        }

  @type t :: %__MODULE__{
          base: number(),
          modifiers: [modifier()]
        }

  @type audit :: %{
          operation: atom(),
          before: number(),
          after: number(),
          modifier_id: String.t() | nil,
          timestamp: integer()
        }

  defstruct base: 0, modifiers: []

  # =============================================================================
  # Construction
  # =============================================================================

  @doc """
  Creates a new Value.

  ## Examples

      Value.new(100)
      # => %Value{base: 100, modifiers: []}

      Value.new(base: 50, modifiers: [...])
  """
  @spec new(number() | keyword()) :: t()
  def new(base) when is_number(base) do
    %__MODULE__{base: base, modifiers: []}
  end

  def new(opts) when is_list(opts) do
    %__MODULE__{
      base: Keyword.get(opts, :base, 0),
      modifiers: Keyword.get(opts, :modifiers, [])
    }
  end

  @doc """
  Creates a Value from a map (for loading from YAML/database).
  """
  @spec from_map(map()) :: t()
  def from_map(data) when is_map(data) do
    base = get_flexible(data, :base, 0)

    modifiers =
      get_flexible(data, :modifiers, [])
      |> Enum.map(&parse_modifier/1)

    %__MODULE__{base: base, modifiers: modifiers}
  end

  defp parse_modifier(mod) when is_map(mod) do
    %{
      id: get_flexible(mod, :id, "unknown"),
      type: parse_modifier_type(get_flexible(mod, :type, :flat)),
      amount: get_flexible(mod, :amount, 0),
      source: get_flexible(mod, :source, nil)
    }
  end

  defp parse_modifier_type(:flat), do: :flat
  defp parse_modifier_type(:percent), do: :percent
  defp parse_modifier_type("flat"), do: :flat
  defp parse_modifier_type("percent"), do: :percent
  defp parse_modifier_type(_), do: :flat

  # =============================================================================
  # Operations
  # =============================================================================

  @doc """
  Sets the base value.

  ## Examples

      value = Value.new(100)
      {:ok, value, audit} = Value.set_base(value, 150)
      value.base  # => 150
  """
  @spec set_base(t(), number()) :: {:ok, t(), audit()}
  def set_base(%__MODULE__{} = value, new_base) do
    old_computed = compute(value)
    new_value = %{value | base: new_base}
    new_computed = compute(new_value)

    audit = %{
      operation: :set_base,
      before: old_computed,
      after: new_computed,
      modifier_id: nil,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, new_value, audit}
  end

  @doc """
  Adds a modifier to the value.

  ## Examples

      value = Value.new(100)
      {:ok, value, audit} = Value.add_modifier(value, "buff", :flat, 10, "potion")
  """
  @spec add_modifier(t(), String.t(), :flat | :percent, number(), String.t() | nil) ::
          {:ok, t(), audit()}
  def add_modifier(%__MODULE__{} = value, id, type, amount, source \\ nil)
      when type in [:flat, :percent] do
    old_computed = compute(value)

    modifier = %{
      id: id,
      type: type,
      amount: amount,
      source: source
    }

    # Remove existing modifier with same ID first
    filtered = Enum.reject(value.modifiers, &(&1.id == id))
    new_value = %{value | modifiers: filtered ++ [modifier]}
    new_computed = compute(new_value)

    audit = %{
      operation: :add_modifier,
      before: old_computed,
      after: new_computed,
      modifier_id: id,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, new_value, audit}
  end

  @doc """
  Removes a modifier by ID.

  ## Examples

      {:ok, value, audit} = Value.remove_modifier(value, "buff")
  """
  @spec remove_modifier(t(), String.t()) :: {:ok, t(), audit()}
  def remove_modifier(%__MODULE__{} = value, id) do
    old_computed = compute(value)
    filtered = Enum.reject(value.modifiers, &(&1.id == id))
    new_value = %{value | modifiers: filtered}
    new_computed = compute(new_value)

    audit = %{
      operation: :remove_modifier,
      before: old_computed,
      after: new_computed,
      modifier_id: id,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, new_value, audit}
  end

  @doc """
  Removes all modifiers from a specific source.

  ## Examples

      {:ok, value, audit} = Value.remove_modifiers_from(value, "potion")
  """
  @spec remove_modifiers_from(t(), String.t()) :: {:ok, t(), audit()}
  def remove_modifiers_from(%__MODULE__{} = value, source) do
    old_computed = compute(value)
    filtered = Enum.reject(value.modifiers, &(&1.source == source))
    new_value = %{value | modifiers: filtered}
    new_computed = compute(new_value)

    audit = %{
      operation: :remove_modifiers_from,
      before: old_computed,
      after: new_computed,
      modifier_id: source,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, new_value, audit}
  end

  @doc """
  Clears all modifiers.
  """
  @spec clear_modifiers(t()) :: {:ok, t(), audit()}
  def clear_modifiers(%__MODULE__{} = value) do
    old_computed = compute(value)
    new_value = %{value | modifiers: []}
    new_computed = compute(new_value)

    audit = %{
      operation: :clear_modifiers,
      before: old_computed,
      after: new_computed,
      modifier_id: nil,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, new_value, audit}
  end

  # =============================================================================
  # Queries
  # =============================================================================

  @doc """
  Computes the final value after applying all modifiers.

  Calculation: (base + flat_mods) * (1 + percent_mods)
  """
  @spec compute(t()) :: number()
  def compute(%__MODULE__{base: base, modifiers: modifiers}) do
    {flat_sum, percent_sum} =
      Enum.reduce(modifiers, {0, 0}, fn mod, {flat, percent} ->
        case mod.type do
          :flat -> {flat + mod.amount, percent}
          :percent -> {flat, percent + mod.amount}
        end
      end)

    (base + flat_sum) * (1 + percent_sum)
  end

  @doc """
  Returns the raw base value without modifiers.
  """
  @spec base(t()) :: number()
  def base(%__MODULE__{base: base}), do: base

  @doc """
  Returns the sum of all flat modifiers.
  """
  @spec flat_bonus(t()) :: number()
  def flat_bonus(%__MODULE__{modifiers: modifiers}) do
    modifiers
    |> Enum.filter(&(&1.type == :flat))
    |> Enum.map(& &1.amount)
    |> Enum.sum()
  end

  @doc """
  Returns the sum of all percent modifiers.
  """
  @spec percent_bonus(t()) :: number()
  def percent_bonus(%__MODULE__{modifiers: modifiers}) do
    modifiers
    |> Enum.filter(&(&1.type == :percent))
    |> Enum.map(& &1.amount)
    |> Enum.sum()
  end

  @doc """
  Returns true if a modifier with the given ID exists.
  """
  @spec has_modifier?(t(), String.t()) :: boolean()
  def has_modifier?(%__MODULE__{modifiers: modifiers}, id) do
    Enum.any?(modifiers, &(&1.id == id))
  end

  @doc """
  Gets a modifier by ID.
  """
  @spec get_modifier(t(), String.t()) :: modifier() | nil
  def get_modifier(%__MODULE__{modifiers: modifiers}, id) do
    Enum.find(modifiers, &(&1.id == id))
  end

  @doc """
  Returns all modifiers from a specific source.
  """
  @spec modifiers_from(t(), String.t()) :: [modifier()]
  def modifiers_from(%__MODULE__{modifiers: modifiers}, source) do
    Enum.filter(modifiers, &(&1.source == source))
  end

  @doc """
  Converts the value to a map (for serialization).
  """
  @spec to_map(t()) :: map()
  def to_map(%__MODULE__{} = value) do
    %{
      "base" => value.base,
      "computed" => compute(value),
      "modifiers" =>
        Enum.map(value.modifiers, fn mod ->
          %{
            "id" => mod.id,
            "type" => to_string(mod.type),
            "amount" => mod.amount,
            "source" => mod.source
          }
        end)
    }
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp get_flexible(map, key, default) when is_atom(key) do
    Map.get(map, key) || Map.get(map, to_string(key)) || default
  end
end
