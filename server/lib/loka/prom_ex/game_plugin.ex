defmodule Loka.PromEx.GamePlugin do
  @moduledoc """
  Custom PromEx plugin for Loka game-specific metrics.

  Exposes:
  - Active players count
  - Active entity processes
  - Rooms loaded
  - Commands executed (by type)
  - Combat encounters
  - Player logins
  - Rate limited requests
  """
  use PromEx.Plugin
  require Logger

  @impl true
  def polling_metrics(opts) do
    poll_rate = Keyword.get(opts, :poll_rate, 10_000)

    Polling.build(
      :loka_game_polling,
      poll_rate,
      {__MODULE__, :execute_polling, []},
      [
        last_value(
          [:loka, :game, :active_players, :count],
          event_name: [:loka, :game, :active_players],
          description: "Number of currently connected players",
          measurement: :count
        ),
        last_value(
          [:loka, :game, :active_entities, :count],
          event_name: [:loka, :game, :active_entities],
          description: "Number of active entity GenServer processes",
          measurement: :count
        ),
        last_value(
          [:loka, :game, :rooms_loaded, :count],
          event_name: [:loka, :game, :rooms_loaded],
          description: "Number of room entities currently loaded",
          measurement: :count
        ),
        last_value(
          [:loka, :game, :memory, :mb],
          event_name: [:loka, :game, :memory],
          description: "Total VM memory usage in MB",
          measurement: :mb
        )
      ]
    )
  end

  @impl true
  def event_metrics(_opts) do
    Event.build(
      :loka_game_events,
      [
        counter(
          [:loka, :game, :commands, :total],
          event_name: [:loka, :game, :commands],
          description: "Total commands executed",
          measurement: :total,
          tags: [:command]
        ),
        counter(
          [:loka, :game, :combat, :started, :total],
          event_name: [:loka, :game, :combat, :started],
          description: "Total combat encounters started",
          measurement: :total
        ),
        counter(
          [:loka, :game, :login, :total],
          event_name: [:loka, :game, :login],
          description: "Total player logins",
          measurement: :total
        ),
        counter(
          [:loka, :auth, :rate_limited, :total],
          event_name: [:loka, :auth, :rate_limited],
          description: "Total rate-limited requests",
          measurement: :total,
          tags: [:endpoint]
        )
      ]
    )
  end

  @doc false
  def execute_polling do
    active_players = count_active_game_sessions()
    active_entities = count_active_entities()
    memory_mb = :erlang.memory(:total) / 1_000_000

    :telemetry.execute([:loka, :game, :active_players], %{count: active_players}, %{})
    :telemetry.execute([:loka, :game, :active_entities], %{count: active_entities}, %{})
    :telemetry.execute([:loka, :game, :memory], %{mb: memory_mb}, %{})

    # Log warning if memory is high
    if memory_mb > 500 do
      Logger.warning("[PromEx] High memory usage: #{Float.round(memory_mb, 1)} MB")
    end
  end

  defp count_active_game_sessions do
    # Count active GameChannel connections
    # Returns 0 for now - accurate counting requires tracking in GameChannel
    0
  end

  defp count_active_entities do
    try do
      case Process.whereis(Loka.Engine.EntitySupervisor) do
        nil -> 0
        pid -> DynamicSupervisor.count_children(pid).active
      end
    rescue
      _ -> 0
    end
  end
end
