defmodule Loka.Framework.Resources.ResourcePool do
  @moduledoc """
  Tracks resource pools (current/max values) for entities.

  Each entity can have multiple resource pools (mana, stamina, energy, etc.).
  This module manages the current and max values, consumption, restoration,
  and regeneration of resources.

  ## Pool Structure

  Pools are stored in ETS per entity:

      %{
        "mana" => %{current: 45, max: 80},
        "stamina" => %{current: 100, max: 100}
      }

  ## Usage

      alias Loka.Framework.Resources.ResourcePool

      # Initialize pools for an entity
      ResourcePool.init(entity_id, stats)

      # Check and consume
      if ResourcePool.has_enough?(entity_id, "mana", 15) do
        ResourcePool.consume(entity_id, "mana", 15)
      end

      # Restore resources
      ResourcePool.restore(entity_id, "mana", 20)

      # Tick regeneration
      ResourcePool.tick_regen(entity_id, context)
  """

  use GenServer
  require Logger

  alias Loka.Content.Resource, as: ContentResource
  alias Loka.Engine.TypedObject
  alias Loka.Framework.Resources.FormulaEvaluator

  @pool_table :loka_resource_pools

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the ResourcePool GenServer.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Initializes resource pools for an entity based on registered resource types.

  Uses the entity's stats to calculate max values from formulas.
  """
  def init_pools(entity_id, stats \\ %{}) do
    GenServer.call(__MODULE__, {:init_pools, entity_id, stats})
  end

  @doc """
  Gets all pools for an entity.

  Returns a map of resource_key => %{current: n, max: m}.
  """
  def get(entity_id) do
    case :ets.lookup(@pool_table, entity_id) do
      [{_id, pools}] -> pools
      [] -> %{}
    end
  rescue
    ArgumentError -> %{}
  end

  @doc """
  Gets the current value of a specific resource.
  """
  def current(entity_id, resource_key) do
    pools = get(entity_id)

    case Map.get(pools, resource_key) do
      %{current: current} -> current
      _ -> 0
    end
  end

  @doc """
  Gets the max value of a specific resource.
  """
  def get_max(entity_id, resource_key) do
    pools = get(entity_id)

    case Map.get(pools, resource_key) do
      %{max: max_val} -> max_val
      _ -> 0
    end
  end

  @doc """
  Checks if an entity has enough of a resource.
  """
  def has_enough?(entity_id, resource_key, amount) do
    current(entity_id, resource_key) >= amount
  end

  @doc """
  Consumes an amount of a resource.

  Returns `{:ok, new_current}` or `{:error, :insufficient}`.
  """
  def consume(entity_id, resource_key, amount) when amount >= 0 do
    GenServer.call(__MODULE__, {:consume, entity_id, resource_key, amount})
  end

  @doc """
  Restores an amount of a resource (capped at max).

  Returns `{:ok, new_current}`.
  """
  def restore(entity_id, resource_key, amount) when amount >= 0 do
    GenServer.call(__MODULE__, {:restore, entity_id, resource_key, amount})
  end

  @doc """
  Sets the current value of a resource directly.
  """
  def set_current(entity_id, resource_key, value) do
    GenServer.call(__MODULE__, {:set_current, entity_id, resource_key, value})
  end

  @doc """
  Recalculates the max value for a resource based on current stats.
  """
  def recalculate_max(entity_id, resource_key, stats) do
    GenServer.call(__MODULE__, {:recalculate_max, entity_id, resource_key, stats})
  end

  @doc """
  Recalculates all max values for an entity.
  """
  def recalculate_all_max(entity_id, stats) do
    GenServer.call(__MODULE__, {:recalculate_all_max, entity_id, stats})
  end

  @doc """
  Ticks regeneration for an entity's resources.

  Context should include `:in_combat` and `:resting` booleans.
  """
  def tick_regen(entity_id, context \\ %{}) do
    GenServer.cast(__MODULE__, {:tick_regen, entity_id, context})
  end

  @doc """
  Ticks regeneration for all entities.
  """
  def tick_all_regen(context \\ %{}) do
    GenServer.cast(__MODULE__, {:tick_all_regen, context})
  end

  @doc """
  Clears all pools for an entity.
  """
  def clear(entity_id) do
    GenServer.cast(__MODULE__, {:clear, entity_id})
  end

  @doc """
  Clears all pools (for testing).
  """
  def clear_all do
    GenServer.call(__MODULE__, :clear_all)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    table =
      :ets.new(@pool_table, [
        :set,
        :public,
        :named_table,
        read_concurrency: true
      ])

    {:ok, %{table: table}}
  end

  @impl true
  def handle_call({:init_pools, entity_id, stats}, _from, state) do
    resources = ContentResource.all()

    pools =
      resources
      |> Enum.map(fn resource ->
        max_value = calculate_max(resource, stats)

        current_value =
          if ContentResource.starts_full(resource) do
            max_value
          else
            ContentResource.min_value(resource)
          end

        {resource.key, %{current: current_value, max: max_value}}
      end)
      |> Map.new()

    :ets.insert(@pool_table, {entity_id, pools})
    {:reply, {:ok, pools}, state}
  end

  @impl true
  def handle_call({:consume, entity_id, resource_key, amount}, _from, state) do
    pools = get(entity_id)

    result =
      case Map.get(pools, resource_key) do
        nil ->
          {:error, :resource_not_found}

        %{current: current} = pool ->
          if current >= amount do
            new_current = current - amount
            new_pool = Map.put(pool, :current, new_current)
            new_pools = Map.put(pools, resource_key, new_pool)
            :ets.insert(@pool_table, {entity_id, new_pools})
            {:ok, new_current}
          else
            {:error, :insufficient}
          end
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:restore, entity_id, resource_key, amount}, _from, state) do
    pools = get(entity_id)

    result =
      case Map.get(pools, resource_key) do
        nil ->
          {:error, :resource_not_found}

        %{current: current, max: max} = pool ->
          new_current = min(current + amount, max)
          new_pool = Map.put(pool, :current, new_current)
          new_pools = Map.put(pools, resource_key, new_pool)
          :ets.insert(@pool_table, {entity_id, new_pools})
          {:ok, new_current}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:set_current, entity_id, resource_key, value}, _from, state) do
    pools = get(entity_id)

    result =
      case Map.get(pools, resource_key) do
        nil ->
          {:error, :resource_not_found}

        %{max: max} = pool ->
          # Get resource min_value
          min_val =
            case ContentResource.get(resource_key) do
              {:ok, resource} -> ContentResource.min_value(resource)
              _ -> 0
            end

          new_current = value |> max(min_val) |> min(max)
          new_pool = Map.put(pool, :current, new_current)
          new_pools = Map.put(pools, resource_key, new_pool)
          :ets.insert(@pool_table, {entity_id, new_pools})
          {:ok, new_current}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:recalculate_max, entity_id, resource_key, stats}, _from, state) do
    pools = get(entity_id)

    result =
      case {Map.get(pools, resource_key), ContentResource.get(resource_key)} do
        {nil, _} ->
          {:error, :pool_not_found}

        {_, {:error, _}} ->
          {:error, :resource_not_found}

        {%{current: current} = pool, {:ok, resource}} ->
          new_max = calculate_max(resource, stats)
          # Adjust current if it exceeds new max
          new_current = min(current, new_max)
          new_pool = %{pool | current: new_current, max: new_max}
          new_pools = Map.put(pools, resource_key, new_pool)
          :ets.insert(@pool_table, {entity_id, new_pools})
          {:ok, new_max}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:recalculate_all_max, entity_id, stats}, _from, state) do
    pools = get(entity_id)

    new_pools =
      Enum.reduce(pools, pools, fn {resource_key, pool}, acc ->
        case ContentResource.get(resource_key) do
          {:ok, resource} ->
            new_max = calculate_max(resource, stats)
            new_current = min(pool.current, new_max)
            new_pool = %{pool | current: new_current, max: new_max}
            Map.put(acc, resource_key, new_pool)

          {:error, _} ->
            acc
        end
      end)

    :ets.insert(@pool_table, {entity_id, new_pools})
    {:reply, {:ok, new_pools}, state}
  end

  @impl true
  def handle_call(:clear_all, _from, state) do
    :ets.delete_all_objects(@pool_table)
    {:reply, :ok, state}
  end

  @impl true
  def handle_cast({:tick_regen, entity_id, context}, state) do
    pools = get(entity_id)

    new_pools =
      Enum.reduce(pools, pools, fn {resource_key, pool}, acc ->
        case ContentResource.get(resource_key) do
          {:ok, resource} ->
            if ContentResource.should_regen?(resource, context) do
              regen_rate = ContentResource.regen_rate(resource)
              new_current = min(pool.current + regen_rate, pool.max)
              new_pool = Map.put(pool, :current, new_current)
              Map.put(acc, resource_key, new_pool)
            else
              acc
            end

          {:error, _} ->
            acc
        end
      end)

    :ets.insert(@pool_table, {entity_id, new_pools})
    {:noreply, state}
  end

  @impl true
  def handle_cast({:tick_all_regen, context}, state) do
    all_entries = :ets.tab2list(@pool_table)

    Enum.each(all_entries, fn {entity_id, pools} ->
      new_pools =
        Enum.reduce(pools, pools, fn {resource_key, pool}, acc ->
          case ContentResource.get(resource_key) do
            {:ok, resource} ->
              if ContentResource.should_regen?(resource, context) do
                regen_rate = ContentResource.regen_rate(resource)
                new_current = min(pool.current + regen_rate, pool.max)
                new_pool = Map.put(pool, :current, new_current)
                Map.put(acc, resource_key, new_pool)
              else
                acc
              end

            {:error, _} ->
              acc
          end
        end)

      :ets.insert(@pool_table, {entity_id, new_pools})
    end)

    {:noreply, state}
  end

  @impl true
  def handle_cast({:clear, entity_id}, state) do
    :ets.delete(@pool_table, entity_id)
    {:noreply, state}
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp calculate_max(%TypedObject{} = resource, stats) do
    formula = ContentResource.max_formula(resource)
    FormulaEvaluator.evaluate!(formula, stats, 100)
  end
end
