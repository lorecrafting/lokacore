# Exclude integration tests by default - they require full world data
# Run with: mix test --include integration
ExUnit.start(exclude: [:integration])
Ecto.Adapters.SQL.Sandbox.mode(Loka.Repo, :manual)

# Safety net: sweep any leftover draft files before starting the test suite.
# This prevents pollution from previous failed test runs from causing
# cascading failures (draft YAML files get loaded by TypedObject.Loader).
Loka.TestCleanup.sweep_all_draft_directories()

# Safety net: sweep leftover draft files after the entire test suite finishes.
# This catches any test-created files that individual test cleanup missed.
ExUnit.after_suite(fn _results ->
  Loka.TestCleanup.sweep_all_draft_directories()
end)
