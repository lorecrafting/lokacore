defmodule Loka.Admin.GameLog do
  @moduledoc """
  Unified game event log for admin debugging and audit.

  Logs all game events (quest, combat, social, exploration, economy, system)
  for debugging, replay, and analytics. Events are stored per-player in ETS
  and are lost on restart (by design - this is a session debugging tool).

  ## Categories

  - `:quest` - Quest acceptance, progress, completion
  - `:combat` - Combat start, damage, death, respawn
  - `:social` - Chat messages, emotes
  - `:exploration` - Room entry/exit, discoveries
  - `:economy` - Item/gold acquisition, spending
  - `:system` - Connect, disconnect, level up

  ## Usage

      # Log an event
      GameLog.log(:combat, :damage_dealt, %{amount: 15}, player_id: "player_123")

      # Query events
      GameLog.get_events(player_id: "player_123", category: :combat)

      # Get recent events
      GameLog.recent(limit: 50)

      # Debug quest objective
      GameLog.diagnose_objective(player_id, quest_id, objective_id)

  ## Storage

  Events are stored in ETS for fast access. Auto-pruning keeps at most
  1000 events per player.
  """

  use GenServer
  require Logger

  alias Loka.Admin.GameLog.Event

  @table :loka_game_log
  @max_events_per_player 1000
  @prune_threshold 1200

  # =============================================================================
  # Client API
  # =============================================================================

  @doc "Starts the GameLog GenServer."
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Logs a game event.

  ## Parameters

  - `category` - Event category (:quest, :combat, :social, etc.)
  - `event_type` - Specific event type atom
  - `details` - Map with event-specific details

  ## Options

  - `:player_id` - The player who triggered/owns this event
  - `:entity_id` - Target entity (for combat, interaction events)
  - `:room_id` - Location where event occurred
  - `:metadata` - Additional context (quest_id, objective_id, etc.)
  - `:server` - GenServer name (for testing)

  ## Examples

      GameLog.log(:quest, :quest_accepted, %{quest_id: "find_sword"}, player_id: "p1")
      GameLog.log(:combat, :damage_dealt, %{amount: 15}, player_id: "p1", entity_id: "goblin")
  """
  def log(category, event_type, details, opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)

    if Process.whereis(server) do
      GenServer.cast(server, {:log, category, event_type, details, opts})
    else
      Logger.debug("GameLog: [#{category}:#{event_type}] #{inspect(details)}")
    end

    :ok
  end

  @doc """
  Gets events with optional filtering.

  ## Options

  - `:player_id` - Filter by player ID
  - `:entity_id` - Filter by target entity ID
  - `:room_id` - Filter by room ID
  - `:category` - Filter by category
  - `:event_type` - Filter by event type
  - `:since` - Only events after this DateTime
  - `:limit` - Maximum number of events to return

  ## Examples

      GameLog.get_events(player_id: "p1", category: :combat)
      GameLog.get_events(room_id: "tavern", limit: 100)
  """
  def get_events(opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)

    if Process.whereis(server) do
      GenServer.call(server, {:get_events, opts})
    else
      []
    end
  end

  @doc """
  Gets the most recent events.

  ## Options

  - `:limit` - Maximum number of events (default: 50)
  - Plus all options from `get_events/1`
  """
  def recent(opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    get_events(Keyword.put(opts, :limit, limit))
  end

  @doc """
  Diagnoses why a quest objective might not have completed.

  Returns a map with:
  - Events related to this objective
  - Current progress
  - Whether it's completed
  - Possible issues

  ## Example

      GameLog.diagnose_objective("player_1", "find_sword", "kill_goblins")
  """
  def diagnose_objective(player_id, quest_id, objective_id, opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)

    if Process.whereis(server) do
      GenServer.call(server, {:diagnose, player_id, quest_id, objective_id})
    else
      %{events: [], possible_issues: ["GameLog not running"]}
    end
  end

  @doc """
  Clears all events for a player.
  """
  def clear(player_id, opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)

    if Process.whereis(server) do
      GenServer.cast(server, {:clear, player_id})
    end

    :ok
  end

  @doc """
  Clears all events (admin only).
  """
  def clear_all(opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)

    if Process.whereis(server) do
      GenServer.cast(server, :clear_all)
    end

    :ok
  end

  @doc """
  Gets event statistics for admin dashboard.
  """
  def stats(opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)

    if Process.whereis(server) do
      GenServer.call(server, :stats)
    else
      %{total_events: 0, players: 0, by_category: %{}}
    end
  end

  @doc """
  Exports events for a player as JSON-friendly maps.
  """
  def export(player_id, opts \\ []) do
    opts
    |> Keyword.put(:player_id, player_id)
    |> get_events()
    |> Enum.map(&Event.to_map/1)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    table = :ets.new(@table, [:bag, :protected, read_concurrency: true])

    state = %{
      table: table,
      event_counts: %{},
      category_counts: %{}
    }

    Logger.info("#{__MODULE__} started")
    {:ok, state}
  end

  @impl true
  def handle_cast({:log, category, event_type, details, opts}, state) do
    player_id = Keyword.get(opts, :player_id)
    event = Event.new(category, event_type, details, opts)

    # Store by player_id (or "system" for player-less events)
    key = player_id || "system"
    :ets.insert(state.table, {key, event})

    # Update counts
    count = Map.get(state.event_counts, key, 0) + 1
    new_event_counts = Map.put(state.event_counts, key, count)

    cat_count = Map.get(state.category_counts, category, 0) + 1
    new_category_counts = Map.put(state.category_counts, category, cat_count)

    # Prune if needed
    new_state =
      if count > @prune_threshold do
        prune_events(state, key)

        %{
          state
          | event_counts: Map.put(new_event_counts, key, @max_events_per_player),
            category_counts: new_category_counts
        }
      else
        %{state | event_counts: new_event_counts, category_counts: new_category_counts}
      end

    {:noreply, new_state}
  end

  @impl true
  def handle_cast({:clear, player_id}, state) do
    :ets.match_delete(state.table, {player_id, :_})
    new_counts = Map.delete(state.event_counts, player_id)
    {:noreply, %{state | event_counts: new_counts}}
  end

  @impl true
  def handle_cast(:clear_all, state) do
    :ets.delete_all_objects(state.table)
    {:noreply, %{state | event_counts: %{}, category_counts: %{}}}
  end

  @impl true
  def handle_call({:get_events, opts}, _from, state) do
    player_id = Keyword.get(opts, :player_id)

    events =
      if player_id do
        :ets.lookup(state.table, player_id)
        |> Enum.map(fn {_key, event} -> event end)
      else
        # Get all events
        :ets.tab2list(state.table)
        |> Enum.map(fn {_key, event} -> event end)
      end

    filtered =
      events
      |> filter_events(opts)
      |> sort_events()
      |> limit_events(opts)

    {:reply, filtered, state}
  end

  @impl true
  def handle_call({:diagnose, player_id, quest_id, objective_id}, _from, state) do
    events =
      :ets.lookup(state.table, player_id)
      |> Enum.map(fn {_key, event} -> event end)
      |> Enum.filter(fn e ->
        e.category == :quest &&
          get_in(e.metadata, [:quest_id]) == quest_id &&
          get_in(e.metadata, [:objective_id]) == objective_id
      end)
      |> sort_events()

    diagnosis = build_diagnosis(events, quest_id, objective_id)
    {:reply, diagnosis, state}
  end

  @impl true
  def handle_call(:stats, _from, state) do
    total = Enum.sum(Map.values(state.event_counts))
    players = map_size(state.event_counts)

    stats = %{
      total_events: total,
      players: players,
      by_category: state.category_counts,
      events_per_player: state.event_counts
    }

    {:reply, stats, state}
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp filter_events(events, opts) do
    events
    |> filter_by(:entity_id, opts[:entity_id])
    |> filter_by(:room_id, opts[:room_id])
    |> filter_by(:category, opts[:category])
    |> filter_by(:event_type, opts[:event_type])
    |> filter_since(opts[:since])
  end

  defp filter_by(events, _field, nil), do: events

  defp filter_by(events, field, value) do
    Enum.filter(events, fn e -> Map.get(e, field) == value end)
  end

  defp filter_since(events, nil), do: events

  defp filter_since(events, since) do
    Enum.filter(events, fn e ->
      DateTime.compare(e.timestamp, since) in [:gt, :eq]
    end)
  end

  defp sort_events(events) do
    Enum.sort_by(events, & &1.timestamp, {:desc, DateTime})
  end

  defp limit_events(events, opts) do
    case opts[:limit] do
      nil -> events
      limit -> Enum.take(events, limit)
    end
  end

  defp prune_events(state, key) do
    events =
      :ets.lookup(state.table, key)
      |> Enum.map(fn {_key, event} -> event end)
      |> sort_events()
      |> Enum.take(@max_events_per_player)

    :ets.match_delete(state.table, {key, :_})

    Enum.each(events, fn event ->
      :ets.insert(state.table, {key, event})
    end)
  end

  defp build_diagnosis(events, quest_id, objective_id) do
    progress_events =
      Enum.filter(events, fn e -> e.event_type == :objective_progress end)

    latest_progress =
      case progress_events do
        [latest | _] -> Map.get(latest.details, :new_progress, 0)
        [] -> 0
      end

    completed = Enum.any?(events, fn e -> e.event_type == :objective_completed end)

    issues =
      cond do
        completed ->
          ["Objective was completed successfully"]

        Enum.empty?(events) ->
          [
            "No events recorded for this objective",
            "Check if the objective target_id matches the entity being interacted with"
          ]

        true ->
          analyze_objective_issues(events, latest_progress)
      end

    %{
      quest_id: quest_id,
      objective_id: objective_id,
      events: events,
      current_progress: latest_progress,
      completed: completed,
      possible_issues: issues,
      event_count: length(events)
    }
  end

  defp analyze_objective_issues(events, current_progress) do
    issues = []

    latest = List.first(events)

    age =
      if latest do
        DateTime.diff(DateTime.utc_now(), latest.timestamp, :minute)
      else
        0
      end

    issues =
      if age > 60 do
        ["No activity in the last #{age} minutes" | issues]
      else
        issues
      end

    failed_events = Enum.filter(events, fn e -> e.event_type == :objective_failed end)

    issues =
      if length(failed_events) > 0 do
        ["#{length(failed_events)} failed attempt(s) recorded" | issues]
      else
        issues
      end

    issues =
      if current_progress > 0 do
        ["Current progress: #{current_progress}" | issues]
      else
        ["No progress recorded yet" | issues]
      end

    Enum.reverse(issues)
  end
end
