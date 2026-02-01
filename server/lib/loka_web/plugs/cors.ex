defmodule LokaWeb.Plugs.CORS do
  @moduledoc """
  Environment-aware CORS plug.

  - Development/Test: Allows all origins (*) for local development convenience
  - Production: Restricts to configured origins (PHX_HOST or CORS_ORIGINS env var)

  Configure in production via:
    - CORS_ORIGINS: Comma-separated list of allowed origins (e.g., "https://loka.app,https://www.loka.app")
    - Falls back to PHX_HOST if CORS_ORIGINS not set
  """
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    origin = get_req_header(conn, "origin") |> List.first()
    allowed_origin = get_allowed_origin(origin)

    conn
    |> put_cors_headers(allowed_origin)
    |> handle_preflight()
  end

  defp get_allowed_origin(request_origin) do
    case Application.get_env(:loka, :cors_origins) do
      # Dev/test mode: allow all
      :all ->
        "*"

      # Production: check against allowed list
      allowed_origins when is_list(allowed_origins) ->
        if request_origin in allowed_origins do
          request_origin
        else
          # Return first allowed origin as fallback (won't match, browser will block)
          List.first(allowed_origins) || ""
        end

      # Not configured, default to permissive (dev mode)
      nil ->
        "*"
    end
  end

  defp put_cors_headers(conn, allowed_origin) do
    conn
    |> put_resp_header("access-control-allow-origin", allowed_origin)
    |> put_resp_header("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    |> put_resp_header("access-control-allow-headers", "authorization, content-type")
    |> put_resp_header("access-control-max-age", "86400")
    |> maybe_add_vary_header(allowed_origin)
  end

  # When not using wildcard, add Vary header for proper caching
  defp maybe_add_vary_header(conn, "*"), do: conn
  defp maybe_add_vary_header(conn, _), do: put_resp_header(conn, "vary", "origin")

  defp handle_preflight(%{method: "OPTIONS"} = conn) do
    conn
    |> send_resp(204, "")
    |> halt()
  end

  defp handle_preflight(conn), do: conn
end
