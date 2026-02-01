# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :loka, :scopes,
  player: [
    default: true,
    module: Loka.Accounts.Scope,
    assign_key: :current_scope,
    access_path: [:player, :id],
    schema_key: :player_id,
    schema_type: :id,
    schema_table: :players,
    test_data_fixture: Loka.AccountsFixtures,
    test_setup_helper: :register_and_log_in_player
  ]

config :loka,
  ecto_repos: [Loka.Repo],
  generators: [timestamp_type: :utc_datetime],
  env: config_env()

# Game configuration
config :loka, :game, starting_room_key: "monastery_gate"

# World modules - injected into Engine to maintain layer separation
# Engine uses these via Application.get_env to avoid direct Framework imports
config :loka, :world_time_module, Loka.Framework.World.DayNight
config :loka, :world_weather_module, Loka.Framework.World.Weather
config :loka, :world_event_handler_module, Loka.Framework.Scripting.WorldEventHandler

# Scripting extensions - modules implementing ScriptingExtension behaviour
# These provide game-specific Lua API functions (quest, player, etc.)
config :loka, :scripting_extensions, [
  Loka.Framework.Scripting.GameScriptAPI
]

# Command modules - Framework layer commands registered with Engine.CommandRegistry
# Engine only has LookCommand and HelpCommand built-in
config :loka, :command_modules, [
  Loka.Framework.Commands.NavigateCommand,
  Loka.Framework.Commands.GetCommand,
  Loka.Framework.Commands.SayCommand,
  Loka.Framework.Commands.ShoutCommand,
  Loka.Framework.Commands.YellCommand,
  Loka.Framework.Commands.WhisperCommand,
  Loka.Framework.Commands.TellCommand,
  Loka.Framework.Commands.ReplyCommand,
  Loka.Framework.Commands.RetellCommand,
  Loka.Framework.Commands.MoodCommand,
  Loka.Framework.Commands.PoseCommand,
  Loka.Framework.Commands.ChannelCommand,
  Loka.Framework.Commands.PartyCommand,
  Loka.Framework.Commands.FriendCommand,
  Loka.Framework.Commands.BlockCommand,
  Loka.Framework.Commands.UnblockCommand
]

# ContentValidator plugins - loaded via config to avoid Engine→Framework layer violation
# Engine only has PrototypePlugin built-in, others are Framework layer
config :loka, :content_validator_plugins, [
  Loka.Engine.ContentValidator.PrototypePlugin,
  Loka.Framework.ContentValidator.QuestPlugin,
  Loka.Framework.ContentValidator.DialoguePlugin,
  Loka.Framework.ContentValidator.WorldPlugin
]

# Plugin system - third-party/contrib plugins that extend the engine
# Plugins can add commands, hooks, validators, scripting extensions, prototypes, and balance config
# See Loka.Engine.Plugin for how to create plugins
# Example: config :loka, :plugins, [Loka.Plugins.Guilds]
config :loka, :plugins, []

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

# Configure esbuild (the version is required)
config :esbuild,
  version: "0.25.4",
  loka: [
    args:
      ~w(js/app.js --bundle --target=es2022 --outdir=../priv/static/assets/js --external:/fonts/* --external:/images/* --alias:@=. --loader:.jsx=jsx --loader:.js=jsx),
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
  metadata: [:request_id, :session_id, :player_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# PromEx Prometheus metrics configuration
config :loka, Loka.PromEx,
  disabled: false,
  manual_metrics_start_delay: :no_delay,
  drop_metrics_groups: [],
  grafana: :disabled,
  metrics_server: :disabled

# Posthog analytics - disabled by default, enable via POSTHOG_API_KEY
config :posthog,
  api_url: "https://us.i.posthog.com",
  api_key: nil

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
