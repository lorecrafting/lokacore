defmodule Loka.Framework.Scripting.BehaviorRegistry do
  @moduledoc """
  Registers entity behaviors on spawn.

  When an entity spawns with behaviors defined in its prototype, this module:
  1. Iterates through the behaviors list
  2. Loads each behavior script's definition
  3. Registers appropriate triggers (timers, world events, etc.)

  ## Behavior Format

  Behaviors can be defined in two formats:

  ### New Format (recommended)
  ```yaml
  behaviors:
    - script: patrol
      config:
        route: [gate, market, temple]
        interval: 300
    - script: day_night_schedule
      config:
        wake_at: dawn
        sleep_at: dusk
  ```

  ### Legacy Format (module atoms)
  ```yaml
  behaviors:
    - Loka.Behaviors.Patrol
  ```

  ## Trigger Types

  Behaviors can have different trigger types:
  - `event`: Subscribes to world events (dawn, dusk, etc.)
  - `timer`: Schedules periodic execution
  - `hook`: Runs on entity hooks (on_enter, on_look, etc.) - handled by hook system
  """

  require Logger

  alias Loka.Engine.Script.Executor
  alias Loka.Engine.Hooks
  alias Loka.Content.Script, as: ContentScript
  alias Loka.Framework.Scripting.ConfigSchema
  alias Loka.Timers.Server, as: Timers

  @doc """
  Registers hooks for behavior registration on entity creation.
  Called from application startup.
  """
  def register_hooks do
    Hooks.register(:at_entity_creation, __MODULE__, :on_entity_created, priority: 50)
    Logger.debug("[BehaviorRegistry] Registered :at_entity_creation hook")
    :ok
  end

  @doc """
  Hook callback when an entity is created.
  Iterates through behaviors and registers them with appropriate systems.
  """
  def on_entity_created(entity, _context) do
    behaviors = get_behaviors(entity)

    if Enum.any?(behaviors) do
      Logger.debug(
        "[BehaviorRegistry] Registering #{length(behaviors)} behaviors for #{entity.id}"
      )

      Enum.each(behaviors, fn behavior ->
        register_behavior(entity, behavior)
      end)
    end

    :ok
  end

  @doc """
  Registers a single behavior for an entity.
  Determines the trigger type and registers with the appropriate system.
  Validates config against the script's schema if defined.
  """
  def register_behavior(entity, behavior) do
    case normalize_behavior(behavior) do
      {:ok, script_key, config} ->
        # Validate and apply defaults from config schema
        case validate_behavior_config(script_key, config) do
          {:ok, validated_config} ->
            # Register event triggers (dawn, dusk, etc.)
            events = Executor.register_behavior_events(entity.id, script_key, validated_config)

            if Enum.any?(events) do
              Logger.debug(
                "[BehaviorRegistry] Registered #{script_key} for events: #{inspect(events)}"
              )
            end

            # Check for timer triggers in config or script
            maybe_register_timer(entity, script_key, validated_config)

            :ok

          {:error, errors} ->
            Logger.warning(
              "[BehaviorRegistry] Config validation failed for #{script_key}: #{inspect(errors)}"
            )

            :ok
        end

      :skip ->
        :ok
    end
  end

  @doc """
  Validates behavior config against the script's config_schema.
  Returns {:ok, validated_config} with defaults applied, or {:error, errors}.
  """
  def validate_behavior_config(script_key, config) do
    case ContentScript.get(script_key) do
      {:ok, script} ->
        schema = ContentScript.config_schema(script)

        if schema do
          ConfigSchema.validate(config, schema)
        else
          # No schema defined, pass through
          {:ok, config}
        end

      {:error, :not_found} ->
        # Script not found (may be legacy or not loaded yet)
        # Pass through without validation
        {:ok, config}
    end
  end

  @doc """
  Unregisters all behaviors for an entity.
  Call this when an entity despawns.
  """
  def unregister_behaviors(entity_id) do
    # Unregister from world events
    Executor.unregister_behavior_events(entity_id)

    # Cancel any scheduled timers (may fail if timer doesn't exist)
    try do
      Timers.cancel_script_timer(entity_id)
    rescue
      _ -> :ok
    catch
      :exit, _ -> :ok
    end

    :ok
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  # Get behaviors from entity, handling both struct fields and data map
  defp get_behaviors(entity) do
    cond do
      is_list(entity.behaviors) and Enum.any?(entity.behaviors) ->
        entity.behaviors

      is_map(entity.components) and is_list(Map.get(entity.components, :behaviors)) ->
        Map.get(entity.components, :behaviors)

      is_map(entity.components) and is_list(Map.get(entity.components, "behaviors")) ->
        Map.get(entity.components, "behaviors")

      true ->
        []
    end
  end

  # Normalize behavior to {:ok, script_key, config} or :skip or {:error, reason}
  defp normalize_behavior(%{script: script} = behavior) when is_binary(script) do
    config = Map.get(behavior, :config, %{})
    {:ok, script, config}
  end

  defp normalize_behavior(%{"script" => script} = behavior) when is_binary(script) do
    config = Map.get(behavior, "config", %{})
    {:ok, script, normalize_config(config)}
  end

  # Legacy format: module atom
  defp normalize_behavior(module) when is_atom(module) and not is_nil(module) do
    # Convert module like Loka.Behaviors.Patrol to script key "patrol"
    script_key =
      module
      |> to_string()
      |> String.replace(~r/^(Elixir\.)?Loka\.Behaviors\./, "")
      |> Macro.underscore()

    {:ok, script_key, %{}}
  end

  # Legacy format: module string
  defp normalize_behavior(module_str) when is_binary(module_str) do
    script_key =
      module_str
      |> String.replace(~r/^(Elixir\.)?Loka\.Behaviors\./, "")
      |> Macro.underscore()

    {:ok, script_key, %{}}
  end

  defp normalize_behavior(_), do: :skip

  # Normalize config keys to atoms
  defp normalize_config(config) when is_map(config) do
    Map.new(config, fn
      {k, v} when is_binary(k) ->
        atom_key =
          try do
            String.to_existing_atom(k)
          rescue
            ArgumentError -> k
          end

        {atom_key, v}

      {k, v} ->
        {k, v}
    end)
  end

  defp normalize_config(config), do: config

  # Check if behavior has timer triggers and schedule them
  defp maybe_register_timer(entity, script_key, config) do
    # Check for interval in config
    interval = Map.get(config, :interval) || Map.get(config, "interval")

    if interval && is_integer(interval) && interval > 0 do
      # Convert seconds to milliseconds
      interval_ms = interval * 1000

      # Schedule the timer (may fail in test environment)
      timer_id = "behavior:#{entity.id}:#{script_key}"

      try do
        Timers.schedule_script(timer_id, interval_ms, entity.id, %{
          script_key: script_key,
          config: config,
          recurring: true
        })

        Logger.debug("[BehaviorRegistry] Scheduled timer for #{script_key} every #{interval}s")
      rescue
        e ->
          Logger.warning(
            "[BehaviorRegistry] Failed to schedule timer for #{script_key}: #{inspect(e)}"
          )
      catch
        :exit, reason ->
          Logger.warning(
            "[BehaviorRegistry] Timer scheduling exited for #{script_key}: #{inspect(reason)}"
          )
      end
    end
  end
end
