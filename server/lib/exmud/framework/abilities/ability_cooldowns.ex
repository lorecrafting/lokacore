defmodule Exmud.Framework.Abilities.AbilityCooldowns do
  @moduledoc """
  Tracks ability cooldowns per entity using ETS.

  Cooldowns are stored in an ETS table and automatically expire based on
  game turns or real time. This module provides a simple interface for
  starting, checking, and clearing cooldowns.

  ## Usage

      alias Exmud.Framework.Abilities.AbilityCooldowns

      # Start a cooldown (3 turns)
      AbilityCooldowns.start_cooldown(entity_id, "fireball", 3)

      # Check remaining cooldown
      AbilityCooldowns.get_cooldown(entity_id, "fireball")
      #=> 2

      # Tick all cooldowns (call at end of turn)
      AbilityCooldowns.tick(entity_id)

      # Reset all cooldowns for entity
      AbilityCooldowns.reset_all(entity_id)
  """

  use GenServer
  require Logger

  @cooldown_table :exmud_ability_cooldowns

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the cooldown tracker GenServer.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Starts a cooldown for an ability on an entity.

  The cooldown is measured in turns (or ticks).
  """
  def start_cooldown(entity_id, ability_key, turns) when turns > 0 do
    GenServer.cast(__MODULE__, {:start_cooldown, entity_id, ability_key, turns})
  end

  def start_cooldown(_entity_id, _ability_key, _turns), do: :ok

  @doc """
  Gets the remaining cooldown turns for an ability.

  Returns 0 if the ability is not on cooldown.
  """
  def get_cooldown(entity_id, ability_key) do
    case :ets.lookup(@cooldown_table, {entity_id, ability_key}) do
      [{_key, remaining}] -> remaining
      [] -> 0
    end
  rescue
    ArgumentError -> 0
  end

  @doc """
  Gets all cooldowns for an entity.

  Returns a map of ability_key => remaining_turns.
  """
  def get_all_cooldowns(entity_id) do
    # Match all entries for this entity
    match_pattern = {{entity_id, :"$1"}, :"$2"}

    :ets.match(@cooldown_table, match_pattern)
    |> Enum.map(fn [ability_key, remaining] -> {ability_key, remaining} end)
    |> Map.new()
  rescue
    ArgumentError -> %{}
  end

  @doc """
  Ticks (decrements) all cooldowns for an entity.

  Call this at the end of each turn. Cooldowns that reach 0 are removed.
  """
  def tick(entity_id) do
    GenServer.cast(__MODULE__, {:tick, entity_id})
  end

  @doc """
  Ticks cooldowns for all entities.

  Useful for global turn processing.
  """
  def tick_all do
    GenServer.cast(__MODULE__, :tick_all)
  end

  @doc """
  Resets a specific ability cooldown for an entity.
  """
  def reset_cooldown(entity_id, ability_key) do
    GenServer.cast(__MODULE__, {:reset_cooldown, entity_id, ability_key})
  end

  @doc """
  Resets all cooldowns for an entity.
  """
  def reset_all(entity_id) do
    GenServer.cast(__MODULE__, {:reset_all, entity_id})
  end

  @doc """
  Clears all cooldowns in the system.

  Mainly used for testing.
  """
  def clear_all do
    GenServer.call(__MODULE__, :clear_all)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    # Create ETS table for cooldown tracking
    # Using public access so we can read without going through GenServer
    table =
      :ets.new(@cooldown_table, [
        :set,
        :public,
        :named_table,
        read_concurrency: true
      ])

    {:ok, %{table: table}}
  end

  @impl true
  def handle_cast({:start_cooldown, entity_id, ability_key, turns}, state) do
    :ets.insert(@cooldown_table, {{entity_id, ability_key}, turns})
    {:noreply, state}
  end

  @impl true
  def handle_cast({:tick, entity_id}, state) do
    # Get all cooldowns for this entity
    cooldowns = get_all_cooldowns(entity_id)

    Enum.each(cooldowns, fn {ability_key, remaining} ->
      new_remaining = remaining - 1

      if new_remaining <= 0 do
        :ets.delete(@cooldown_table, {entity_id, ability_key})
      else
        :ets.insert(@cooldown_table, {{entity_id, ability_key}, new_remaining})
      end
    end)

    {:noreply, state}
  end

  @impl true
  def handle_cast(:tick_all, state) do
    # Get all entries and tick each
    all_entries = :ets.tab2list(@cooldown_table)

    Enum.each(all_entries, fn {{entity_id, ability_key}, remaining} ->
      new_remaining = remaining - 1

      if new_remaining <= 0 do
        :ets.delete(@cooldown_table, {entity_id, ability_key})
      else
        :ets.insert(@cooldown_table, {{entity_id, ability_key}, new_remaining})
      end
    end)

    {:noreply, state}
  end

  @impl true
  def handle_cast({:reset_cooldown, entity_id, ability_key}, state) do
    :ets.delete(@cooldown_table, {entity_id, ability_key})
    {:noreply, state}
  end

  @impl true
  def handle_cast({:reset_all, entity_id}, state) do
    # Delete all entries for this entity
    cooldowns = get_all_cooldowns(entity_id)

    Enum.each(cooldowns, fn {ability_key, _} ->
      :ets.delete(@cooldown_table, {entity_id, ability_key})
    end)

    {:noreply, state}
  end

  @impl true
  def handle_call(:clear_all, _from, state) do
    :ets.delete_all_objects(@cooldown_table)
    {:reply, :ok, state}
  end
end
