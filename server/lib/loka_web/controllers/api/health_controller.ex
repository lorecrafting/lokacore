defmodule LokaWeb.Api.HealthController do
  @moduledoc """
  Health check controller for Fly.io and monitoring.

  Provides endpoints for:
  - `/api/health` - Basic liveness check
  - `/api/health/ready` - Readiness check with dependency verification
  - `/api/health/detailed` - Detailed system metrics (admin only in production)
  """
  use LokaWeb, :controller

  alias Loka.Repo

  @doc """
  Basic liveness check.
  Returns 200 if the application is running.
  """
  def index(conn, _params) do
    conn
    |> put_status(:ok)
    |> json(%{
      status: "ok",
      version: Application.spec(:loka, :vsn) |> to_string(),
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end

  @doc """
  Readiness check that verifies critical dependencies.
  Returns 200 only if the app is ready to serve traffic.
  """
  def ready(conn, _params) do
    checks = [
      {"database", check_database()},
      {"pubsub", check_pubsub()}
    ]

    all_healthy = Enum.all?(checks, fn {_name, status} -> status == :ok end)

    status = if all_healthy, do: :ok, else: :service_unavailable

    conn
    |> put_status(status)
    |> json(%{
      status: if(all_healthy, do: "ready", else: "not_ready"),
      checks: Map.new(checks, fn {name, result} -> {name, result == :ok} end),
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end

  @doc """
  Detailed health information including system metrics.
  Useful for debugging and monitoring dashboards.
  """
  def detailed(conn, _params) do
    memory = :erlang.memory()

    conn
    |> put_status(:ok)
    |> json(%{
      status: "ok",
      version: Application.spec(:loka, :vsn) |> to_string(),
      elixir_version: System.version(),
      otp_version: to_string(:erlang.system_info(:otp_release)),
      uptime_seconds: uptime_seconds(),
      memory: %{
        total_mb: Float.round(memory[:total] / 1_000_000, 2),
        processes_mb: Float.round(memory[:processes] / 1_000_000, 2),
        ets_mb: Float.round(memory[:ets] / 1_000_000, 2)
      },
      processes: %{
        count: :erlang.system_info(:process_count),
        limit: :erlang.system_info(:process_limit)
      },
      schedulers: %{
        online: :erlang.system_info(:schedulers_online),
        total: :erlang.system_info(:schedulers)
      },
      checks: %{
        database: check_database() == :ok,
        pubsub: check_pubsub() == :ok
      },
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end

  # Check database connectivity
  defp check_database do
    try do
      Repo.query!("SELECT 1")
      :ok
    rescue
      _ -> :error
    end
  end

  # Check PubSub is running
  defp check_pubsub do
    case Process.whereis(Loka.PubSub) do
      nil -> :error
      _pid -> :ok
    end
  end

  # Calculate uptime in seconds
  defp uptime_seconds do
    {uptime_ms, _} = :erlang.statistics(:wall_clock)
    div(uptime_ms, 1000)
  end
end
