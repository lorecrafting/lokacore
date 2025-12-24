defmodule ExmudWeb.Router do
  use ExmudWeb, :router

  import ExmudWeb.PlayerAuth

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {ExmudWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers, %{
      "content-security-policy" =>
        "default-src 'self'; " <>
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " <>
        "style-src 'self' 'unsafe-inline'; " <>
        "img-src 'self' data: blob:; " <>
        "font-src 'self' data:; " <>
        "connect-src 'self' wss: ws:; " <>
        "frame-ancestors 'none';"
    }
    plug :fetch_current_scope_for_player
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  # Rate limiting for auth endpoints - 5 requests per minute per IP
  pipeline :rate_limit_auth do
    plug ExmudWeb.Plugs.RateLimiter,
      max_requests: 5,
      window_ms: 60_000,
      error_message: "Too many authentication attempts. Please wait before trying again."
  end

  # Rate limiting for registration - 3 per hour per IP (stricter)
  pipeline :rate_limit_register do
    plug ExmudWeb.Plugs.RateLimiter,
      max_requests: 3,
      window_ms: 3_600_000,
      error_message: "Too many registration attempts. Please try again later."
  end

  pipeline :api_auth do
    plug ExmudWeb.Plugs.AuthPipeline
  end

  pipeline :require_admin do
    plug ExmudWeb.Plugs.RequireAdmin
  end

  scope "/", ExmudWeb do
    pipe_through :browser

    # Redirect root to game client
    get "/", PageController, :home
  end

  # Game client (requires authentication)
  scope "/", ExmudWeb do
    pipe_through [:browser, :require_authenticated_player]

    live "/game", GameLive, :index
  end

  # Admin panel (requires authentication + admin role)
  scope "/admin", ExmudWeb do
    pipe_through [:browser, :require_authenticated_player, :require_admin]

    live "/", AdminLive, :index
  end

  # Health check endpoints for Fly.io and monitoring
  scope "/api", ExmudWeb.Api do
    pipe_through :api

    # Liveness probe - basic check that app is running
    get "/health", HealthController, :index

    # Readiness probe - verify dependencies are healthy
    get "/health/ready", HealthController, :ready

    # Detailed metrics - useful for monitoring dashboards
    get "/health/detailed", HealthController, :detailed
  end

  # Public API routes with rate limiting
  scope "/api/v1/auth", ExmudWeb.Api do
    pipe_through [:api, :rate_limit_register]
    post "/register", AuthController, :register
  end

  scope "/api/v1/auth", ExmudWeb.Api do
    pipe_through [:api, :rate_limit_auth]
    post "/login", AuthController, :login
  end

  # Protected API routes (auth required)
  scope "/api/v1", ExmudWeb.Api do
    pipe_through [:api, :api_auth]

    get "/auth/me", AuthController, :me
    post "/auth/refresh", AuthController, :refresh
  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:exmud, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: ExmudWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end

  ## Authentication routes

  # Registration with rate limiting
  scope "/", ExmudWeb do
    pipe_through [:browser, :redirect_if_player_is_authenticated, :rate_limit_register]

    get "/players/register", PlayerRegistrationController, :new
    post "/players/register", PlayerRegistrationController, :create
  end

  scope "/", ExmudWeb do
    pipe_through [:browser, :require_authenticated_player]

    get "/players/settings", PlayerSettingsController, :edit
    put "/players/settings", PlayerSettingsController, :update
    get "/players/settings/confirm-email/:token", PlayerSettingsController, :confirm_email
  end

  # Login with rate limiting (except logout and token confirmation)
  scope "/", ExmudWeb do
    pipe_through [:browser, :rate_limit_auth]

    get "/players/log-in", PlayerSessionController, :new
    post "/players/log-in", PlayerSessionController, :create
  end

  scope "/", ExmudWeb do
    pipe_through [:browser]

    get "/players/log-in/:token", PlayerSessionController, :confirm
    delete "/players/log-out", PlayerSessionController, :delete
  end
end
