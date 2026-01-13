defmodule Loka.Primitives.ResourcePool do
  @moduledoc """
  Pure data structure for resource pools (health, mana, stamina, etc.).

  This is a primitive - no game logic, just data operations with audit trails.
  ResourcePool tracks current/max values and provides operations for modification.

  ## Structure

      %ResourcePool{
        current: 45,
        max: 100,
        min: 0
      }

  ## Usage

      alias Loka.Primitives.ResourcePool

      # Create a pool
      pool = ResourcePool.new(100)
      pool = ResourcePool.new(current: 50, max: 100)

      # Operations return {:ok, pool, audit} or {:error, reason}
      {:ok, pool, audit} = ResourcePool.consume(pool, 20)
      {:ok, pool, audit} = ResourcePool.restore(pool, 10)
      {:ok, pool, audit} = ResourcePool.set(pool, 75)

      # Check capacity
      ResourcePool.has_enough?(pool, 30)  # => true
      ResourcePool.percentage(pool)        # => 0.45
      ResourcePool.is_full?(pool)          # => false
      ResourcePool.is_empty?(pool)         # => false
  """

  @type t :: %__MODULE__{
          current: number(),
          max: number(),
          min: number()
        }

  @type audit :: %{
          operation: atom(),
          before: number(),
          after: number(),
          amount: number(),
          clamped: boolean(),
          timestamp: integer()
        }

  defstruct current: 0, max: 100, min: 0

  # =============================================================================
  # Construction
  # =============================================================================

  @doc """
  Creates a new ResourcePool.

  ## Examples

      ResourcePool.new(100)
      # => %ResourcePool{current: 100, max: 100, min: 0}

      ResourcePool.new(current: 50, max: 100)
      # => %ResourcePool{current: 50, max: 100, min: 0}

      ResourcePool.new(current: 50, max: 100, min: -10)
      # => %ResourcePool{current: 50, max: 100, min: -10}
  """
  @spec new(number() | keyword()) :: t()
  def new(max) when is_number(max) do
    %__MODULE__{current: max, max: max, min: 0}
  end

  def new(opts) when is_list(opts) do
    max = Keyword.get(opts, :max, 100)
    min = Keyword.get(opts, :min, 0)
    current = Keyword.get(opts, :current, max)

    %__MODULE__{
      current: clamp(current, min, max),
      max: max,
      min: min
    }
  end

  @doc """
  Creates a ResourcePool from a map (for loading from YAML/database).

  Handles both atom and string keys.
  """
  @spec from_map(map()) :: t()
  def from_map(data) when is_map(data) do
    max = get_flexible(data, :max, 100)
    min = get_flexible(data, :min, 0)
    current = get_flexible(data, :current, max)

    %__MODULE__{
      current: clamp(current, min, max),
      max: max,
      min: min
    }
  end

  # =============================================================================
  # Operations
  # =============================================================================

  @doc """
  Consumes an amount from the pool.

  Returns {:ok, new_pool, audit} or {:error, :insufficient}.

  ## Examples

      pool = ResourcePool.new(50)
      {:ok, pool, audit} = ResourcePool.consume(pool, 20)
      pool.current  # => 30

      {:error, :insufficient} = ResourcePool.consume(pool, 100)
  """
  @spec consume(t(), number()) :: {:ok, t(), audit()} | {:error, :insufficient}
  def consume(%__MODULE__{} = pool, amount) when amount >= 0 do
    if pool.current >= amount do
      new_current = pool.current - amount
      clamped_current = clamp(new_current, pool.min, pool.max)
      new_pool = %{pool | current: clamped_current}

      audit = %{
        operation: :consume,
        before: pool.current,
        after: clamped_current,
        amount: amount,
        clamped: new_current != clamped_current,
        timestamp: System.system_time(:millisecond)
      }

      {:ok, new_pool, audit}
    else
      {:error, :insufficient}
    end
  end

  @doc """
  Force-consumes an amount, allowing the pool to go to minimum (or below if min is negative).

  Useful for damage that should always apply even if it would "kill".

  ## Examples

      pool = ResourcePool.new(current: 10, max: 100)
      {:ok, pool, audit} = ResourcePool.force_consume(pool, 50)
      pool.current  # => 0 (clamped to min)
  """
  @spec force_consume(t(), number()) :: {:ok, t(), audit()}
  def force_consume(%__MODULE__{} = pool, amount) when amount >= 0 do
    new_current = pool.current - amount
    clamped_current = clamp(new_current, pool.min, pool.max)
    new_pool = %{pool | current: clamped_current}

    audit = %{
      operation: :force_consume,
      before: pool.current,
      after: clamped_current,
      amount: amount,
      clamped: new_current != clamped_current,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, new_pool, audit}
  end

  @doc """
  Restores an amount to the pool (capped at max).

  ## Examples

      pool = ResourcePool.new(current: 50, max: 100)
      {:ok, pool, audit} = ResourcePool.restore(pool, 30)
      pool.current  # => 80

      {:ok, pool, audit} = ResourcePool.restore(pool, 50)
      pool.current  # => 100 (capped at max)
  """
  @spec restore(t(), number()) :: {:ok, t(), audit()}
  def restore(%__MODULE__{} = pool, amount) when amount >= 0 do
    new_current = pool.current + amount
    clamped_current = clamp(new_current, pool.min, pool.max)
    new_pool = %{pool | current: clamped_current}

    audit = %{
      operation: :restore,
      before: pool.current,
      after: clamped_current,
      amount: amount,
      clamped: new_current != clamped_current,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, new_pool, audit}
  end

  @doc """
  Sets the current value directly (clamped to min/max).

  ## Examples

      pool = ResourcePool.new(100)
      {:ok, pool, audit} = ResourcePool.set(pool, 75)
      pool.current  # => 75
  """
  @spec set(t(), number()) :: {:ok, t(), audit()}
  def set(%__MODULE__{} = pool, value) do
    clamped_value = clamp(value, pool.min, pool.max)
    new_pool = %{pool | current: clamped_value}

    audit = %{
      operation: :set,
      before: pool.current,
      after: clamped_value,
      amount: abs(value - pool.current),
      clamped: value != clamped_value,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, new_pool, audit}
  end

  @doc """
  Updates the maximum value. Adjusts current if it exceeds new max.

  ## Examples

      pool = ResourcePool.new(current: 80, max: 100)
      {:ok, pool, audit} = ResourcePool.set_max(pool, 60)
      pool.max      # => 60
      pool.current  # => 60 (clamped)
  """
  @spec set_max(t(), number()) :: {:ok, t(), audit()}
  def set_max(%__MODULE__{} = pool, new_max) when new_max >= pool.min do
    new_current = clamp(pool.current, pool.min, new_max)
    new_pool = %{pool | max: new_max, current: new_current}

    audit = %{
      operation: :set_max,
      before: pool.max,
      after: new_max,
      amount: abs(new_max - pool.max),
      clamped: pool.current != new_current,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, new_pool, audit}
  end

  @doc """
  Fills the pool to maximum.
  """
  @spec fill(t()) :: {:ok, t(), audit()}
  def fill(%__MODULE__{} = pool) do
    set(pool, pool.max)
  end

  @doc """
  Empties the pool to minimum.
  """
  @spec empty(t()) :: {:ok, t(), audit()}
  def empty(%__MODULE__{} = pool) do
    set(pool, pool.min)
  end

  # =============================================================================
  # Queries
  # =============================================================================

  @doc """
  Checks if the pool has at least the specified amount.
  """
  @spec has_enough?(t(), number()) :: boolean()
  def has_enough?(%__MODULE__{current: current}, amount) do
    current >= amount
  end

  @doc """
  Returns the current value as a percentage of max (0.0 to 1.0).
  """
  @spec percentage(t()) :: float()
  def percentage(%__MODULE__{current: current, max: max}) when max > 0 do
    current / max
  end

  def percentage(%__MODULE__{}), do: 0.0

  @doc """
  Returns true if current equals max.
  """
  @spec is_full?(t()) :: boolean()
  def is_full?(%__MODULE__{current: current, max: max}) do
    current >= max
  end

  @doc """
  Returns true if current equals min.
  """
  @spec is_empty?(t()) :: boolean()
  def is_empty?(%__MODULE__{current: current, min: min}) do
    current <= min
  end

  @doc """
  Returns the amount needed to fill the pool.
  """
  @spec deficit(t()) :: number()
  def deficit(%__MODULE__{current: current, max: max}) do
    max(0, max - current)
  end

  @doc """
  Returns the amount available above minimum.
  """
  @spec available(t()) :: number()
  def available(%__MODULE__{current: current, min: min}) do
    max(0, current - min)
  end

  @doc """
  Converts the pool to a map (for serialization).
  """
  @spec to_map(t()) :: map()
  def to_map(%__MODULE__{} = pool) do
    %{
      "current" => pool.current,
      "max" => pool.max,
      "min" => pool.min
    }
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp clamp(value, min, max) do
    value
    |> max(min)
    |> min(max)
  end

  defp get_flexible(map, key, default) when is_atom(key) do
    Map.get(map, key) || Map.get(map, to_string(key)) || default
  end
end
