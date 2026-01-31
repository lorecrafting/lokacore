# Exclude integration tests by default - they require full world data
# Run with: mix test --include integration
ExUnit.start(exclude: [:integration])
Ecto.Adapters.SQL.Sandbox.mode(Loka.Repo, :manual)
