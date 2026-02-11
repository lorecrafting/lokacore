defmodule Loka.Engine.Cooldowns do
  @moduledoc """
  ETS-backed cooldown tracking for entities and players.

  Provides a generic cooldown primitive for spells, abilities, shrines,
  crafting stations, or any action that should have a minimum interval.

  Uses monotonic time (immune to wall clock changes).

  ## Usage

      # Set a 60-second cooldown
      Cooldowns.set("player_abc", "heal_spell", 60)

      # Check if ready
      Cooldowns.ready?("player_abc", "heal_spell")  # => false

      # Check remaining time
      Cooldowns.remaining("player_abc", "heal_spell")  # => 45

      # Clear a cooldown
      Cooldowns.clear("player_abc", "heal_spell")
  """

  use GenServer

  require Logger

  @table :loka_cooldowns
  @cleanup_interval :timer.seconds(60)

  # =============================================================================
  # Client API
  # =============================================================================

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Set a cooldown for an entity/player on a specific action.

  ## Parameters

  - `entity_id` - Entity or player ID
  - `key` - Cooldown identifier (e.g., "heal_spell", "shrine_pray")
  - `duration_seconds` - How long the cooldown lasts
  """
  @spec set(String.t(), String.t() | atom(), non_neg_integer()) :: :ok
  def set(entity_id, key, duration_seconds)
      when is_integer(duration_seconds) and duration_seconds > 0 do
    expiry = System.monotonic_time(:second) + duration_seconds
    :ets.insert(@table, {{entity_id, to_string(key)}, expiry})
    :ok
  end

  @doc """
  Check if a cooldown is ready (expired or never set).

  Returns `true` if the action can be performed.
  """
  @spec ready?(String.t(), String.t() | atom()) :: boolean()
  def ready?(entity_id, key) do
    case :ets.lookup(@table, {entity_id, to_string(key)}) do
      [] -> true
      [{_key, expiry}] -> System.monotonic_time(:second) >= expiry
    end
  end

  @doc """
  Get the remaining cooldown time in seconds.

  Returns 0 if the cooldown is ready or was never set.
  """
  @spec remaining(String.t(), String.t() | atom()) :: non_neg_integer()
  def remaining(entity_id, key) do
    case :ets.lookup(@table, {entity_id, to_string(key)}) do
      [] ->
        0

      [{_key, expiry}] ->
        remaining = expiry - System.monotonic_time(:second)
        max(0, remaining)
    end
  end

  @doc """
  Clear a specific cooldown for an entity.
  """
  @spec clear(String.t(), String.t() | atom()) :: :ok
  def clear(entity_id, key) do
    :ets.delete(@table, {entity_id, to_string(key)})
    :ok
  end

  @doc """
  Clear all cooldowns for an entity.
  """
  @spec clear_all(String.t()) :: :ok
  def clear_all(entity_id) do
    :ets.match_delete(@table, {{entity_id, :_}, :_})
    :ok
  end

  @doc """
  List all active cooldowns for an entity.

  Returns a list of maps with cooldown key and remaining time.
  """
  @spec list(String.t()) :: [%{key: String.t(), remaining: non_neg_integer()}]
  def list(entity_id) do
    now = System.monotonic_time(:second)

    :ets.match(@table, {{entity_id, :"$1"}, :"$2"})
    |> Enum.map(fn [key, expiry] ->
      %{key: key, remaining: max(0, expiry - now)}
    end)
    |> Enum.filter(fn %{remaining: r} -> r > 0 end)
  end

  # =============================================================================
  # GenServer Implementation
  # =============================================================================

  @impl true
  def init(_opts) do
    table = :ets.new(@table, [:named_table, :set, :public, read_concurrency: true])
    schedule_cleanup()
    {:ok, %{table: table}}
  end

  @impl true
  def handle_info(:cleanup, state) do
    sweep_expired()
    schedule_cleanup()
    {:noreply, state}
  end

  defp schedule_cleanup do
    Process.send_after(self(), :cleanup, @cleanup_interval)
  end

  # Remove expired entries to prevent unbounded growth
  defp sweep_expired do
    now = System.monotonic_time(:second)

    # Select all entries where expiry < now
    expired =
      :ets.select(@table, [
        {{{:"$1", :"$2"}, :"$3"}, [{:<, :"$3", now}], [{{:"$1", :"$2"}}]}
      ])

    Enum.each(expired, fn {entity_id, key} ->
      :ets.delete(@table, {entity_id, key})
    end)

    if length(expired) > 0 do
      Logger.debug("[Cooldowns] Swept #{length(expired)} expired entries")
    end
  end
end
