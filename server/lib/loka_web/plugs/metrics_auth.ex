defmodule LokaWeb.Plugs.MetricsAuth do
  @moduledoc """
  Plug for authenticating access to the /metrics endpoint.

  Supports two authentication methods:
  1. Bearer token via Authorization header
  2. IP allowlist (for internal networks/localhost)

  ## Configuration

  In `config/runtime.exs`:

      config :loka, :metrics_auth,
        enabled: true,
        token: System.get_env("METRICS_AUTH_TOKEN"),
        allowed_ips: ["127.0.0.1", "::1"]

  If `enabled` is false (default in dev/test), all requests are allowed.
  If `token` is set, requests must include `Authorization: Bearer <token>`.
  IPs in `allowed_ips` bypass token authentication.

  ## Usage

  In your router:

      pipeline :metrics_auth do
        plug LokaWeb.Plugs.MetricsAuth
      end

      scope "/" do
        pipe_through [:api, :metrics_auth]
        get "/metrics", PromEx.Plug, prom_ex_module: Loka.PromEx
      end
  """

  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    config = Application.get_env(:loka, :metrics_auth, [])
    enabled = Keyword.get(config, :enabled, false)

    if enabled do
      check_auth(conn, config)
    else
      conn
    end
  end

  defp check_auth(conn, config) do
    allowed_ips = Keyword.get(config, :allowed_ips, ["127.0.0.1", "::1"])
    expected_token = Keyword.get(config, :token)

    client_ip = get_client_ip(conn)

    cond do
      # Allow if IP is in allowlist
      ip_allowed?(client_ip, allowed_ips) ->
        conn

      # Allow if bearer token matches
      expected_token && valid_bearer_token?(conn, expected_token) ->
        conn

      # Deny access
      true ->
        conn
        |> put_resp_content_type("text/plain")
        |> send_resp(401, "Unauthorized")
        |> halt()
    end
  end

  defp get_client_ip(conn) do
    # On Fly.io, Fly-Client-IP is set by infrastructure and cannot be spoofed by clients.
    # Fall back to X-Forwarded-For (for local dev), then conn.remote_ip.
    fly_ip = get_req_header(conn, "fly-client-ip") |> List.first()
    forwarded = get_req_header(conn, "x-forwarded-for") |> List.first()

    cond do
      fly_ip && fly_ip != "" ->
        fly_ip

      forwarded && forwarded != "" ->
        forwarded |> String.split(",") |> List.first() |> String.trim()

      true ->
        conn.remote_ip |> :inet.ntoa() |> to_string()
    end
  end

  defp ip_allowed?(client_ip, allowed_ips) when is_binary(client_ip) do
    Enum.any?(allowed_ips, fn allowed ->
      client_ip == allowed
    end)
  end

  defp ip_allowed?(_client_ip, _allowed_ips), do: false

  defp valid_bearer_token?(conn, expected_token) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] ->
        Plug.Crypto.secure_compare(String.trim(token), expected_token)

      _ ->
        false
    end
  end
end
