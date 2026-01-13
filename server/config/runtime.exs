import Config

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/loka start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :loka, LokaWeb.Endpoint, server: true
end

# Configure log level (default: info, set LOG_LEVEL=debug for verbose output)
log_level =
  case System.get_env("LOG_LEVEL", "info") do
    "debug" -> :debug
    "info" -> :info
    "warning" -> :warning
    "error" -> :error
    _ -> :info
  end

config :logger, level: log_level

# Enable JSON logging in production for better log aggregation and querying
if config_env() == :prod do
  config :logger, :default_handler,
    formatter: {LoggerJSON.Formatters.Basic, metadata: [:request_id, :session_id, :player_id]}
end

# Basic http config for dev/test - production overrides this below
config :loka, LokaWeb.Endpoint,
  http: [
    ip: {0, 0, 0, 0},
    port: String.to_integer(System.get_env("PORT") || "4000")
  ]

if config_env() == :prod do
  database_path =
    System.get_env("DATABASE_PATH") ||
      raise """
      environment variable DATABASE_PATH is missing.
      For example: /etc/loka/loka.db
      """

  # Ensure the database directory exists before Repo starts
  # This is critical for SQLite on Fly.io where the volume is mounted
  database_dir = Path.dirname(database_path)

  case File.mkdir_p(database_dir) do
    :ok ->
      :ok

    {:error, reason} ->
      IO.puts("Warning: Could not create database directory #{database_dir}: #{inspect(reason)}")
  end

  config :loka, Loka.Repo,
    database: database_path,
    # Default pool_size increased from 5 to 10 for better concurrent query handling
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    # SQLite settings for production
    busy_timeout: 5000,
    # Increase queue timeouts for startup
    queue_target: 5000,
    queue_interval: 10000,
    # WAL mode for better write concurrency
    journal_mode: :wal

  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "example.com"

  config :loka, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  config :loka, LokaWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Bind to all IPv4 interfaces for Fly.io compatibility
      ip: {0, 0, 0, 0},
      port: String.to_integer(System.get_env("PORT") || "8080")
    ],
    secret_key_base: secret_key_base,
    # HSTS: Force HTTPS with 1-year max-age
    force_ssl: [hsts: true, expires: 31_536_000]

  # Guardian JWT secret for mobile auth
  guardian_secret =
    System.get_env("GUARDIAN_SECRET_KEY") ||
      raise """
      environment variable GUARDIAN_SECRET_KEY is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  config :loka, Loka.Auth.Guardian,
    issuer: "loka",
    secret_key: guardian_secret

  # Metrics authentication for production
  config :loka, :metrics_auth,
    enabled: true,
    token: System.get_env("METRICS_AUTH_TOKEN"),
    allowed_ips: ["127.0.0.1", "::1"]

  # ## SSL Support
  #
  # To get SSL working, you will need to add the `https` key
  # to your endpoint configuration:
  #
  #     config :loka, LokaWeb.Endpoint,
  #       https: [
  #         ...,
  #         port: 443,
  #         cipher_suite: :strong,
  #         keyfile: System.get_env("SOME_APP_SSL_KEY_PATH"),
  #         certfile: System.get_env("SOME_APP_SSL_CERT_PATH")
  #       ]
  #
  # The `cipher_suite` is set to `:strong` to support only the
  # latest and more secure SSL ciphers. This means old browsers
  # and clients may not be supported. You can set it to
  # `:compatible` for wider support.
  #
  # `:keyfile` and `:certfile` expect an absolute path to the key
  # and cert in disk or a relative path inside priv, for example
  # "priv/ssl/server.key". For all supported SSL configuration
  # options, see https://hexdocs.pm/plug/Plug.SSL.html#configure/1
  #
  # We also recommend setting `force_ssl` in your config/prod.exs,
  # ensuring no data is ever sent via http, always redirecting to https:
  #
  #     config :loka, LokaWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.

  # Configure Resend mailer
  resend_api_key = System.get_env("RESEND_API_KEY")

  if resend_api_key do
    config :loka, Loka.Mailer,
      adapter: Resend.Swoosh.Adapter,
      api_key: resend_api_key
  end

  # Configure the from email address for outgoing emails
  config :loka, :mailer_from,
    name: System.get_env("MAILER_FROM_NAME") || "Loka",
    email: System.get_env("MAILER_FROM_EMAIL") || "noreply@example.com"

  # Posthog analytics (optional - only enable if API key is set)
  if posthog_key = System.get_env("POSTHOG_API_KEY") do
    config :posthog,
      api_url: System.get_env("POSTHOG_API_URL") || "https://us.i.posthog.com",
      api_key: posthog_key
  end
end
