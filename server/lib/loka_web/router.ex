defmodule LokaWeb.Router do
  use LokaWeb, :router

  import LokaWeb.PlayerAuth

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {LokaWeb.Layouts, :root}
    plug :protect_from_forgery

    plug :put_secure_browser_headers, %{
      "content-security-policy" =>
        "default-src 'self'; " <>
          "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " <>
          "style-src 'self' 'unsafe-inline'; " <>
          "img-src 'self' data: blob:; " <>
          "font-src 'self' data:; " <>
          "connect-src 'self' wss: ws:; " <>
          "frame-ancestors 'none';",
      "x-content-type-options" => "nosniff",
      "x-frame-options" => "DENY",
      "referrer-policy" => "strict-origin-when-cross-origin"
    }

    plug :fetch_current_scope_for_player
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  # Rate limiting for auth endpoints - 5 requests per minute per IP
  pipeline :rate_limit_auth do
    plug LokaWeb.Plugs.RateLimiter,
      max_requests: 5,
      window_ms: 60_000,
      error_message: "Too many authentication attempts. Please wait before trying again."
  end

  # Rate limiting for registration - 3 per hour per IP (stricter)
  pipeline :rate_limit_register do
    plug LokaWeb.Plugs.RateLimiter,
      max_requests: 3,
      window_ms: 3_600_000,
      error_message: "Too many registration attempts. Please try again later."
  end

  pipeline :api_auth do
    plug LokaWeb.Plugs.AuthPipeline
  end

  pipeline :require_admin do
    plug LokaWeb.Plugs.RequireAdmin
  end

  # Rate limiting for admin operations to prevent abuse (30 requests/minute)
  pipeline :rate_limit_admin do
    plug LokaWeb.Plugs.RateLimiter,
      max_requests: 30,
      window_ms: 60_000,
      error_message: "Too many requests. Please slow down."
  end

  pipeline :metrics_auth do
    # Rate limit to prevent brute force token guessing (10 requests/minute)
    plug LokaWeb.Plugs.RateLimiter, max_requests: 10, window_ms: 60_000
    plug LokaWeb.Plugs.MetricsAuth
  end

  # Basic auth for development-only routes (LiveDashboard, etc.)
  pipeline :dev_auth do
    plug :dev_basic_auth
  end

  defp dev_basic_auth(conn, _opts) do
    case System.get_env("DEV_PASSWORD") do
      nil ->
        # No password set, allow access (local dev only)
        conn

      password when is_binary(password) and password != "" ->
        Plug.BasicAuth.basic_auth(conn, username: "dev", password: password)

      _ ->
        conn
    end
  end

  scope "/", LokaWeb do
    pipe_through :browser

    # Redirect root to login
    get "/", PageController, :home
  end

  # Game client auth (Godot deep link flow via magic link → JWT)
  scope "/", LokaWeb do
    pipe_through [:browser, :require_authenticated_player]

    get "/client/auth/callback", ClientAuthController, :callback
  end

  scope "/client", LokaWeb do
    pipe_through [:browser]

    get "/auth/login", ClientAuthController, :login
  end

  # Admin panel (authentication required)
  scope "/admin", LokaWeb do
    pipe_through [:browser, :require_authenticated_player, :require_admin, :rate_limit_admin]

    live "/", AdminLive, :index
    live "/world-builder", AdminLive.WorldBuilderLive, :index
    live "/builder", AdminLive.BuilderLive, :index
  end

  # Prometheus metrics endpoint for monitoring
  # Access: /metrics (requires auth in production via bearer token or IP allowlist)
  scope "/" do
    pipe_through [:api, :metrics_auth]
    get "/metrics", PromEx.Plug, prom_ex_module: Loka.PromEx
  end

  # Health check endpoints for Fly.io and monitoring
  scope "/api", LokaWeb.Api do
    pipe_through :api

    # Liveness probe - basic check that app is running
    get "/health", HealthController, :index

    # Readiness probe - verify dependencies are healthy
    get "/health/ready", HealthController, :ready

    # Detailed metrics - useful for monitoring dashboards
    get "/health/detailed", HealthController, :detailed
  end

  # Mobile debug logging endpoint
  scope "/api/debug", LokaWeb do
    pipe_through :api

    # Receive logs from mobile clients
    post "/logs", DebugLogController, :create

    # Read logs (for LLM debugging)
    get "/logs", DebugLogController, :index

    # Get latest logs formatted for LLM consumption
    get "/logs/latest", DebugLogController, :latest

    # Clear logs
    delete "/logs", DebugLogController, :clear

    # Screenshot capture
    post "/screenshot/request", DebugScreenshotController, :request
    post "/screenshot", DebugScreenshotController, :upload
    get "/screenshot", DebugScreenshotController, :latest
    get "/screenshot/image", DebugScreenshotController, :serve_latest
  end

  # Content validation API for content creators
  scope "/api/validate", LokaWeb.Api do
    pipe_through :api

    post "/quest", ValidateController, :quest
    post "/npc", ValidateController, :npc
    post "/room", ValidateController, :room
    post "/storyline", ValidateController, :storyline
  end

  # Test-only API endpoints for E2E testing (dev/test only)
  if Mix.env() in [:dev, :test] do
    scope "/api/test", LokaWeb.Api do
      pipe_through :api

      post "/create-player", TestController, :create_player
      post "/reset-player", TestController, :reset_player
      get "/player-state", TestController, :player_state
      get "/path", TestController, :find_path
      get "/world-graph", TestController, :world_graph
      get "/npcs", TestController, :npc_locations

      # Quest strategy API - unified decision-making for bots
      post "/strategy/next-action", TestController, :strategy_next_action
      get "/strategy/quest-order", TestController, :strategy_quest_order
    end

    # Browser-based test login (sets proper signed session cookies)
    scope "/test", LokaWeb do
      pipe_through [:browser]

      get "/login", TestSessionController, :login
    end
  end

  # Public API routes with rate limiting
  scope "/api/v1/auth", LokaWeb.Api do
    pipe_through [:api, :rate_limit_register]
    post "/register", AuthController, :register
  end

  scope "/api/v1/auth", LokaWeb.Api do
    pipe_through [:api, :rate_limit_auth]
    post "/login", AuthController, :login
    post "/guest", AuthController, :guest
  end

  # Protected API routes (auth required)
  scope "/api/v1", LokaWeb.Api do
    pipe_through [:api, :api_auth]

    get "/auth/me", AuthController, :me
    post "/auth/refresh", AuthController, :refresh
    put "/auth/name", AuthController, :update_name
  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:loka, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:browser, :dev_auth]

      live_dashboard "/dashboard", metrics: LokaWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end

  ## Authentication routes

  # Login with rate limiting (except logout and token confirmation)
  scope "/", LokaWeb do
    pipe_through [:browser, :rate_limit_auth]

    get "/players/log-in", PlayerSessionController, :new
    post "/players/log-in", PlayerSessionController, :create
  end

  scope "/", LokaWeb do
    pipe_through [:browser]

    get "/players/log-in/:token", PlayerSessionController, :confirm
    delete "/players/log-out", PlayerSessionController, :delete
  end
end
