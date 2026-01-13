defmodule Loka.PromEx do
  @moduledoc """
  PromEx configuration for Loka.

  Exposes Prometheus metrics at `/metrics` endpoint.
  Includes Phoenix, Ecto, LiveView, BEAM, and custom game metrics.

  ## Grafana Cloud Setup

  1. Create a Grafana Cloud account (free tier available)
  2. Get your Prometheus remote_write URL and API key
  3. Set the following environment variables:
     - PROMETHEUS_PUSH_GATEWAY_URL
     - PROMETHEUS_PUSH_GATEWAY_AUTH (base64 encoded user:api_key)

  Alternatively, use the `/metrics` endpoint with a Prometheus scraper.
  """
  use PromEx, otp_app: :loka

  alias PromEx.Plugins

  @impl true
  def plugins do
    [
      # PromEx built-in plugins
      Plugins.Application,
      Plugins.Beam,
      {Plugins.Phoenix, router: LokaWeb.Router, endpoint: LokaWeb.Endpoint},
      {Plugins.Ecto, repos: [Loka.Repo]},
      Plugins.PhoenixLiveView,

      # Custom Loka metrics
      Loka.PromEx.GamePlugin
    ]
  end

  @impl true
  def dashboard_assigns do
    [
      datasource_id: "prometheus",
      default_selected_interval: "30s"
    ]
  end

  @impl true
  def dashboards do
    [
      # PromEx built-in Grafana dashboards
      {:prom_ex, "application.json"},
      {:prom_ex, "beam.json"},
      {:prom_ex, "phoenix.json"},
      {:prom_ex, "ecto.json"},
      {:prom_ex, "phoenix_live_view.json"}
    ]
  end
end
