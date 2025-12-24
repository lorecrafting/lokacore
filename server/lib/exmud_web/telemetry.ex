defmodule ExmudWeb.Telemetry do
  @moduledoc """
  Telemetry and metrics collection for ExMUD.

  Collects metrics for:
  - Phoenix HTTP and WebSocket performance
  - Database query performance
  - VM memory and process stats
  - Game-specific metrics (players, entities, commands)

  Metrics are available via Phoenix LiveDashboard in development
  and can be exported to external services in production.
  """
  use Supervisor
  import Telemetry.Metrics
  require Logger

  def start_link(arg) do
    Supervisor.start_link(__MODULE__, arg, name: __MODULE__)
  end

  @impl true
  def init(_arg) do
    children = [
      # Telemetry poller will execute the given period measurements
      # every 10_000ms. Learn more here: https://hexdocs.pm/telemetry_metrics
      {:telemetry_poller, measurements: periodic_measurements(), period: 10_000}
      # Add reporters as children of your supervision tree.
      # {Telemetry.Metrics.ConsoleReporter, metrics: metrics()}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end

  def metrics do
    [
      # Phoenix Metrics
      summary("phoenix.endpoint.start.system_time",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.endpoint.stop.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.start.system_time",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.exception.duration",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.stop.duration",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.socket_connected.duration",
        unit: {:native, :millisecond}
      ),
      sum("phoenix.socket_drain.count"),
      summary("phoenix.channel_joined.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.channel_handled_in.duration",
        tags: [:event],
        unit: {:native, :millisecond}
      ),

      # LiveView Metrics
      summary("phoenix.live_view.mount.stop.duration",
        unit: {:native, :millisecond},
        tags: [:view]
      ),
      summary("phoenix.live_view.handle_event.stop.duration",
        unit: {:native, :millisecond},
        tags: [:view, :event]
      ),

      # Database Metrics
      summary("exmud.repo.query.total_time",
        unit: {:native, :millisecond},
        description: "The sum of the other measurements"
      ),
      summary("exmud.repo.query.decode_time",
        unit: {:native, :millisecond},
        description: "The time spent decoding the data received from the database"
      ),
      summary("exmud.repo.query.query_time",
        unit: {:native, :millisecond},
        description: "The time spent executing the query"
      ),
      summary("exmud.repo.query.queue_time",
        unit: {:native, :millisecond},
        description: "The time spent waiting for a database connection"
      ),
      summary("exmud.repo.query.idle_time",
        unit: {:native, :millisecond},
        description:
          "The time the connection spent waiting before being checked out for the query"
      ),

      # VM Metrics
      summary("vm.memory.total", unit: {:byte, :kilobyte}),
      summary("vm.total_run_queue_lengths.total"),
      summary("vm.total_run_queue_lengths.cpu"),
      summary("vm.total_run_queue_lengths.io"),

      # Game-specific Metrics
      last_value("exmud.game.active_players.count",
        description: "Number of currently active players"
      ),
      last_value("exmud.game.active_entities.count",
        description: "Number of active entity processes"
      ),
      last_value("exmud.game.rooms_loaded.count",
        description: "Number of rooms currently loaded in memory"
      ),
      counter("exmud.game.commands.total",
        description: "Total commands executed",
        tags: [:command]
      ),
      counter("exmud.game.combat.started.total",
        description: "Total combat encounters started"
      ),
      counter("exmud.game.login.total",
        description: "Total player logins"
      ),
      counter("exmud.auth.rate_limited.total",
        description: "Total rate-limited requests",
        tags: [:endpoint]
      )
    ]
  end

  defp periodic_measurements do
    [
      # Game metrics - measured every 10 seconds
      {__MODULE__, :measure_game_stats, []}
    ]
  end

  @doc """
  Periodic measurement of game statistics.
  Called by telemetry_poller every 10 seconds.
  """
  def measure_game_stats do
    # Count active players (LiveView processes)
    active_players = count_active_game_sessions()

    # Count active entity processes
    active_entities = count_active_entities()

    # Emit telemetry events
    :telemetry.execute(
      [:exmud, :game, :active_players],
      %{count: active_players},
      %{}
    )

    :telemetry.execute(
      [:exmud, :game, :active_entities],
      %{count: active_entities},
      %{}
    )

    # Log warning if memory usage is high
    memory_mb = :erlang.memory(:total) / 1_000_000

    if memory_mb > 500 do
      Logger.warning("[Telemetry] High memory usage: #{Float.round(memory_mb, 1)} MB")
    end

    :ok
  end

  defp count_active_game_sessions do
    # Count GameLive processes via Registry or PubSub
    try do
      Phoenix.PubSub.node_name(Exmud.PubSub)
      # Approximate by counting processes with game_live in registered name
      Process.list()
      |> Enum.count(fn pid ->
        case Process.info(pid, :dictionary) do
          {:dictionary, dict} ->
            Keyword.get(dict, :"$initial_call") == {ExmudWeb.GameLive, :mount, 3}

          _ ->
            false
        end
      end)
    rescue
      _ -> 0
    end
  end

  defp count_active_entities do
    try do
      # Check if EntitySupervisor exists and count children
      case Process.whereis(Exmud.Engine.EntitySupervisor) do
        nil -> 0
        pid -> DynamicSupervisor.count_children(pid).active
      end
    rescue
      _ -> 0
    end
  end

  # Public API for emitting custom events

  @doc """
  Emit a command execution event.
  """
  def emit_command(command_name) when is_atom(command_name) or is_binary(command_name) do
    :telemetry.execute(
      [:exmud, :game, :commands],
      %{total: 1},
      %{command: command_name}
    )
  end

  @doc """
  Emit a combat started event.
  """
  def emit_combat_started do
    :telemetry.execute(
      [:exmud, :game, :combat, :started],
      %{total: 1},
      %{}
    )
  end

  @doc """
  Emit a login event.
  """
  def emit_login do
    :telemetry.execute(
      [:exmud, :game, :login],
      %{total: 1},
      %{}
    )
  end

  @doc """
  Emit a rate limit event.
  """
  def emit_rate_limited(endpoint) do
    :telemetry.execute(
      [:exmud, :auth, :rate_limited],
      %{total: 1},
      %{endpoint: endpoint}
    )
  end
end
