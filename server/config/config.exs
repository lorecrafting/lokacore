# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :exmud, :scopes,
  player: [
    default: true,
    module: Exmud.Accounts.Scope,
    assign_key: :current_scope,
    access_path: [:player, :id],
    schema_key: :player_id,
    schema_type: :id,
    schema_table: :players,
    test_data_fixture: Exmud.AccountsFixtures,
    test_setup_helper: :register_and_log_in_player
  ]

config :exmud,
  ecto_repos: [Exmud.Repo],
  generators: [timestamp_type: :utc_datetime]

# Game configuration
config :exmud, :game, starting_room_key: "monastery_gate"

# Configure the endpoint
config :exmud, ExmudWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: ExmudWeb.ErrorHTML, json: ExmudWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Exmud.PubSub,
  live_view: [signing_salt: "MOhsyo57"]

# Configure the mailer
#
# By default it uses the "Local" adapter which stores the emails
# locally. You can see the emails in your browser, at "/dev/mailbox".
#
# For production it's recommended to configure a different adapter
# at the `config/runtime.exs`.
config :exmud, Exmud.Mailer, adapter: Swoosh.Adapters.Local

# Configure esbuild (the version is required)
config :esbuild,
  version: "0.25.4",
  exmud: [
    args:
      ~w(js/app.js --bundle --target=es2022 --outdir=../priv/static/assets/js --external:/fonts/* --external:/images/* --alias:@=.),
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => [Path.expand("../deps", __DIR__), Mix.Project.build_path()]}
  ]

# Configure tailwind (the version is required)
config :tailwind,
  version: "4.1.12",
  exmud: [
    args: ~w(
      --input=assets/css/app.css
      --output=priv/static/assets/css/app.css
    ),
    cd: Path.expand("..", __DIR__)
  ]

# Configure Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Guardian JWT configuration - issuer only, secret_key set per environment
# IMPORTANT: secret_key MUST be set in dev.exs/test.exs or via GUARDIAN_SECRET_KEY env var
#
# Token TTL (time-to-live) configuration:
# - access: Short-lived tokens for API requests (1 hour)
# - refresh: Longer-lived tokens for obtaining new access tokens (7 days)
#
# Tokens expire after TTL and require re-authentication or refresh
config :exmud, Exmud.Auth.Guardian,
  issuer: "exmud",
  ttl: {1, :hour},
  token_ttl: %{
    "access" => {1, :hour},
    "refresh" => {7, :days}
  },
  # Verify issuer and expiration claims
  allowed_algos: ["HS512"],
  verify_issuer: true

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
