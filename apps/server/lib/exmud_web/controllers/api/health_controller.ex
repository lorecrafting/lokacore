defmodule ExmudWeb.Api.HealthController do
  @moduledoc """
  Health check controller for Fly.io and monitoring.
  """
  use ExmudWeb, :controller

  def index(conn, _params) do
    conn
    |> put_status(:ok)
    |> json(%{
      status: "ok",
      version: Application.spec(:exmud, :vsn) |> to_string(),
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end
end
