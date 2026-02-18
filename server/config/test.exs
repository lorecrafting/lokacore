import Config

# Environment identifier for conditional logic
config :loka, :env, :test

# Only in tests, remove the complexity from the password hashing algorithm
config :bcrypt_elixir, :log_rounds, 1

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :loka, Loka.Repo,
  database: Path.expand("../loka_test.db", __DIR__),
  # Use pool_size 1 to serialize SQLite writes and avoid "Database busy" errors
  # SQLite only allows one writer at a time, so multiple connections cause contention
  pool_size: 1,
  pool: Ecto.Adapters.SQL.Sandbox,
  # SQLite busy_timeout: wait up to 5s for locks
  busy_timeout: 5000,
  # Higher queue targets to prevent timeout errors when many async tests compete
  # for the single SQLite connection
  queue_target: 5000,
  queue_interval: 10_000

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :loka, LokaWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "yaTemvH3Xng8xNubPPFkfsRbvysBQwr330Sr5+M0RicEA6DsiNFHesPU82kJxev2",
  server: false

# In test we don't send emails
config :loka, Loka.Mailer, adapter: Swoosh.Adapters.Test

# Disable swoosh api client as it is only required for production adapters
config :swoosh, :api_client, false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Enable helpful, but potentially expensive runtime checks
config :phoenix_live_view,
  enable_expensive_runtime_checks: true

# Sort query params output of verified routes for robust url comparisons
config :phoenix,
  sort_verified_routes_query_params: true

# Guardian JWT secret for testing only
config :loka, Loka.Auth.Guardian,
  secret_key: "test_only_guardian_secret_key_not_for_production_use"

# Disable Sentry source code scanning in tests — it causes SQLite lock contention
config :sentry, enable_source_code_context: false

# Disable rate limiting in tests
config :loka, :rate_limiter_enabled, false

# Skip content validation in tests — it hits the DB during boot, which can
# exhaust the connection pool during concurrent compilation and cause flaky
# failures. Content validation is covered by `mix loka.test.validate`.
config :loka, content_validation: :skip

# CORS: Allow all origins in tests
config :loka, :cors_origins, :all

# Disable channel rate limiting in tests
config :loka, LokaWeb.Channels.ChannelRateLimiter, enabled: false
