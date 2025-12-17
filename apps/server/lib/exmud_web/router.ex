defmodule ExmudWeb.Router do
  use ExmudWeb, :router

  import ExmudWeb.PlayerAuth

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {ExmudWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug :fetch_current_scope_for_player
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :api_auth do
    plug ExmudWeb.Plugs.AuthPipeline
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
  # TODO: Add admin role check when roles are implemented
  scope "/admin", ExmudWeb do
    pipe_through [:browser, :require_authenticated_player]

    live "/", AdminLive, :index
  end

  # Health check endpoint for Fly.io
  scope "/api", ExmudWeb.Api do
    pipe_through :api

    get "/health", HealthController, :index
  end

  # Public API routes (no auth required)
  scope "/api/v1", ExmudWeb.Api do
    pipe_through :api

    post "/auth/register", AuthController, :register
    post "/auth/login", AuthController, :login
  end

  # Protected API routes (auth required)
  scope "/api/v1", ExmudWeb.Api do
    pipe_through [:api, :api_auth]

    get "/auth/me", AuthController, :me
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

  scope "/", ExmudWeb do
    pipe_through [:browser, :redirect_if_player_is_authenticated]

    get "/players/register", PlayerRegistrationController, :new
    post "/players/register", PlayerRegistrationController, :create
  end

  scope "/", ExmudWeb do
    pipe_through [:browser, :require_authenticated_player]

    get "/players/settings", PlayerSettingsController, :edit
    put "/players/settings", PlayerSettingsController, :update
    get "/players/settings/confirm-email/:token", PlayerSettingsController, :confirm_email
  end

  scope "/", ExmudWeb do
    pipe_through [:browser]

    get "/players/log-in", PlayerSessionController, :new
    get "/players/log-in/:token", PlayerSessionController, :confirm
    post "/players/log-in", PlayerSessionController, :create
    delete "/players/log-out", PlayerSessionController, :delete
  end
end
