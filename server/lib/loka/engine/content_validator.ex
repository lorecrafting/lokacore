defmodule Loka.Engine.ContentValidator do
  @moduledoc """
  Mandatory content validation that runs during application startup.

  This module provides fail-fast validation for game content. If critical
  errors are found, the application will not start. This prevents broken
  content from being discovered at runtime.

  ## Plugin Architecture

  ContentValidator uses a plugin pattern for extensibility. Each validator
  is a module implementing the `Loka.Engine.ContentValidator.Plugin` behaviour.

  ### Default Plugins

  - `PrototypePlugin` - Validates parent references and cycles
  - `QuestPlugin` - Validates objectives, givers, rewards, storylines
  - `DialoguePlugin` - Validates dialogue tree references and actions
  - `WorldPlugin` - Validates exits and room connectivity

  ### Adding Custom Plugins

  1. Create a module implementing `Loka.Engine.ContentValidator.Plugin`
  2. Add it to the config:

      config :loka, :content_validator_plugins, [
        Loka.Engine.ContentValidator.PrototypePlugin,
        Loka.Engine.ContentValidator.QuestPlugin,
        Loka.Engine.ContentValidator.DialoguePlugin,
        Loka.Engine.ContentValidator.WorldPlugin,
        MyApp.MyCustomPlugin
      ]

  ## Configuration

  Validation can be configured in config.exs:

      config :loka, content_validation: :strict  # Default - fail on any error
      config :loka, content_validation: :warn    # Log errors but don't fail
      config :loka, content_validation: :skip    # Skip validation entirely

  Or via environment variable:

      LOKA_CONTENT_VALIDATION=skip mix phx.server

  ## Usage

  This module is started as part of the supervision tree after all
  content registries are loaded. It validates everything and either
  continues or crashes the application.
  """

  use GenServer
  require Logger

  alias Loka.Engine.ContentValidator.PrototypePlugin

  @default_mode :strict

  # Default to PrototypePlugin only - other plugins are configured via :content_validator_plugins
  # This avoids Engine→Framework layer violations by loading Framework plugins from config
  @default_plugins [PrototypePlugin]

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the ContentValidator GenServer.

  This will run validation during init and fail if errors are found
  (unless validation mode is set to :warn or :skip).
  """
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Returns the current validation mode.
  """
  def validation_mode do
    env_mode = System.get_env("LOKA_CONTENT_VALIDATION")

    cond do
      env_mode == "skip" -> :skip
      env_mode == "warn" -> :warn
      env_mode == "strict" -> :strict
      true -> Application.get_env(:loka, :content_validation, @default_mode)
    end
  end

  @doc """
  Returns the list of registered plugins.
  """
  def list_plugins do
    Application.get_env(:loka, :content_validator_plugins, @default_plugins)
  end

  @doc """
  Registers a plugin dynamically at runtime.

  Note: Plugins are typically configured via application config.
  This function is useful for testing or runtime extension.
  """
  def register_plugin(plugin_module) when is_atom(plugin_module) do
    current = list_plugins()

    unless plugin_module in current do
      Application.put_env(:loka, :content_validator_plugins, current ++ [plugin_module])
    end

    :ok
  end

  @doc """
  Manually run validation and return results.

  Returns `{:ok, results}` with validation results, or `{:error, results}`
  if critical errors were found.
  """
  def validate do
    results = run_all_validations()

    if Enum.empty?(results.critical_errors) do
      {:ok, results}
    else
      {:error, results}
    end
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    mode = validation_mode()

    case mode do
      :skip ->
        Logger.info("ContentValidator: Validation skipped (mode: skip)")
        {:ok, %{mode: mode, results: nil, plugins: list_plugins()}}

      _ ->
        Logger.info("ContentValidator: Running mandatory content validation...")
        results = run_all_validations()

        log_results(results)

        cond do
          Enum.empty?(results.critical_errors) ->
            Logger.info("ContentValidator: All validations passed!")
            {:ok, %{mode: mode, results: results, plugins: list_plugins()}}

          mode == :warn ->
            Logger.warning(
              "ContentValidator: #{length(results.critical_errors)} critical errors found (mode: warn, continuing anyway)"
            )

            {:ok, %{mode: mode, results: results, plugins: list_plugins()}}

          mode == :strict ->
            # In strict mode, fail startup with clear error message
            error_summary = format_error_summary(results.critical_errors)

            Logger.error("""

            ╔══════════════════════════════════════════════════════════════════╗
            ║                    CONTENT VALIDATION FAILED                     ║
            ╠══════════════════════════════════════════════════════════════════╣
            ║  The application cannot start due to content errors.             ║
            ║  Fix the errors below or set LOKA_CONTENT_VALIDATION=warn        ║
            ╚══════════════════════════════════════════════════════════════════╝

            #{error_summary}
            """)

            {:stop, {:content_validation_failed, results.critical_errors}}
        end
    end
  end

  @impl true
  def handle_call(:list_plugins, _from, state) do
    {:reply, state.plugins, state}
  end

  @impl true
  def handle_call(:get_results, _from, state) do
    {:reply, state.results, state}
  end

  # =============================================================================
  # Private - Validation Runner
  # =============================================================================

  defp run_all_validations do
    plugins = list_plugins()

    # Run each plugin and collect results
    plugin_results =
      Enum.reduce(plugins, %{}, fn plugin, acc ->
        result = run_plugin(plugin)
        Map.put(acc, plugin.name(), result)
      end)

    # Collect critical errors and warnings from all plugins
    {critical_errors, warnings} =
      Enum.reduce(plugin_results, {[], []}, fn {name, result}, {crit_acc, warn_acc} ->
        critical_with_category = Enum.map(result.critical, fn msg -> {name, msg} end)
        warnings_with_category = Enum.map(result.warnings, fn msg -> {name, msg} end)

        {crit_acc ++ critical_with_category, warn_acc ++ warnings_with_category}
      end)

    Map.merge(plugin_results, %{
      critical_errors: critical_errors,
      warnings: warnings
    })
  end

  defp run_plugin(plugin) do
    if plugin.ready?() do
      plugin.validate()
    else
      %{critical: [], warnings: []}
    end
  rescue
    error ->
      Logger.warning("ContentValidator: Plugin #{plugin.name()} raised: #{inspect(error)}")
      %{critical: [], warnings: []}
  end

  # =============================================================================
  # Private - Logging
  # =============================================================================

  defp log_results(results) do
    error_count = length(results.critical_errors)
    warning_count = length(results.warnings)

    Logger.info(
      "ContentValidator: Checked content - #{error_count} errors, #{warning_count} warnings"
    )
  end

  defp format_error_summary(errors) do
    errors
    |> Enum.group_by(fn {category, _} -> category end)
    |> Enum.map(fn {category, category_errors} ->
      error_lines =
        category_errors
        |> Enum.map(fn {_, msg} -> "    - #{msg}" end)
        |> Enum.join("\n")

      """
      [#{String.upcase(to_string(category))} ERRORS]
      #{error_lines}
      """
    end)
    |> Enum.join("\n")
  end
end
