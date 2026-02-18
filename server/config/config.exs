# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :loka,
  ecto_repos: [Loka.Repo],
  generators: [timestamp_type: :utc_datetime],
  env: config_env()

# Game configuration
config :loka, :game, starting_room_key: "monastery_gate"

# ContentValidator plugins - loaded via config to avoid Engine→Framework layer violation
# Engine only has PrototypePlugin built-in, others are Framework layer
config :loka, :content_validator_plugins, [
  Loka.Engine.ContentValidator.PrototypePlugin,
  Loka.Framework.ContentValidator.QuestPlugin,
  Loka.Framework.ContentValidator.DialoguePlugin,
  Loka.Framework.ContentValidator.WorldPlugin
]

# Session signing salt - used for cookie security
# Dev/Test: Fixed salt (configured here for compile-time access)
# Production: Requires SESSION_SIGNING_SALT env var (see runtime.exs)
config :loka, :session_signing_salt, "dev_session_salt_do_not_use_in_prod"

# Configure the endpoint
config :loka, LokaWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: LokaWeb.ErrorHTML, json: LokaWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Loka.PubSub,
  live_view: [signing_salt: "MOhsyo57"]

# Configure the mailer
#
# By default it uses the "Local" adapter which stores the emails
# locally. You can see the emails in your browser, at "/dev/mailbox".
#
# For production it's recommended to configure a different adapter
# at the `config/runtime.exs`.
config :loka, Loka.Mailer, adapter: Swoosh.Adapters.Local

# Sentry error tracking — DSN configured via SENTRY_DSN env var in runtime.exs
# Disabled by default (no DSN = no-op). Enable in production by setting the secret.
config :sentry,
  dsn: nil,
  environment_name: config_env(),
  enable_source_code_context: true,
  root_source_code_paths: [File.cwd!()],
  tags: %{app: "loka"}

# Configure esbuild (the version is required)
config :esbuild,
  version: "0.25.4",
  loka: [
    args:
      ~w(js/app.js --bundle --target=es2022 --outdir=../priv/static/assets/js --external:/fonts/* --external:/images/* --alias:@=. --splitting --format=esm --chunk-names=chunks/[name]-[hash]),
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => [Path.expand("../deps", __DIR__), Mix.Project.build_path()]}
  ]

# Configure tailwind (the version is required)
config :tailwind,
  version: "4.1.12",
  loka: [
    args: ~w(
      --input=assets/css/app.css
      --output=priv/static/assets/css/app.css
    ),
    cd: Path.expand("..", __DIR__)
  ]

# Configure Elixir's Logger
# session_id and player_id are set by Session.Server and GameLive for correlation
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [
    :request_id,
    :session_id,
    :player_id,
    :error,
    :payload,
    :quest_id,
    :bot_id,
    :missing_quest_ids,
    :reason
  ]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# PromEx Prometheus metrics configuration
config :loka, Loka.PromEx,
  disabled: false,
  manual_metrics_start_delay: :no_delay,
  drop_metrics_groups: [],
  grafana: :disabled,
  metrics_server: :disabled

# Channel rate limiting - prevents WebSocket message spam
config :loka, LokaWeb.Channels.ChannelRateLimiter,
  enabled: true,
  max_messages: 30,
  window_ms: 1000,
  burst_allowance: 10

# Guardian JWT configuration - issuer only, secret_key set per environment
# IMPORTANT: secret_key MUST be set in dev.exs/test.exs or via GUARDIAN_SECRET_KEY env var
#
# Token TTL (time-to-live) configuration:
# - access: Short-lived tokens for API requests (1 hour)
# - refresh: Longer-lived tokens for obtaining new access tokens (7 days)
#
# Tokens expire after TTL and require re-authentication or refresh
config :loka, Loka.Auth.Guardian,
  issuer: "loka",
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
