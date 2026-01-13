defmodule Loka.Framework.Scripting.HookIntegration do
  @moduledoc """
  Integrates Elixir scripts with the engine hook system.

  Registers hooks that call Script.Executor when entity hooks are triggered,
  allowing builder scripts to intercept and modify game behavior.

  ## Supported Hooks

  The following engine hooks trigger script execution:

  - `:at_before_look` - When player looks at entity (can append/replace description)
  - `:at_enter_room` - When entity enters a room
  - `:at_leave_room` - When entity leaves a room
  - `:at_before_say` - When entity speaks (can modify/halt)
  - `:at_before_move` - Before movement (can deny)
  - `:at_before_attack` - Before combat action (can deny)
  - `:at_damage` - When damage is dealt
  - `:at_death` - When entity dies

  ## Script Hook Mapping

  Engine hooks are mapped to script hooks:

  | Engine Hook | Script Hook | Return Handling |
  |-------------|-------------|-----------------|
  | :at_before_look | :on_look | :append/:replace text |
  | :at_enter_room | :on_enter | :deny to block |
  | :at_leave_room | :on_leave | - |
  | :at_before_say | :on_say | :respond for auto-reply |
  | :at_before_move | :on_move | :deny to block |
  | :at_before_attack | :on_attack | :deny to block |
  | :at_damage | :on_damage | - |
  | :at_death | :on_death | - |

  ## Usage

  Called during application startup to register all script hooks:

      HookIntegration.register_hooks()

  Scripts are then automatically executed when hooks trigger.
  """

  require Logger

  alias Loka.Engine.Hooks
  alias Loka.Engine.Script.Executor

  @hook_mapping [
    {:at_before_look, :on_look, :validate},
    {:at_enter_room, :on_enter, :fire_and_forget},
    {:at_leave_room, :on_leave, :fire_and_forget},
    {:at_before_say, :on_say, :validate},
    {:at_before_move, :on_move, :validate},
    {:at_before_attack, :on_attack, :validate},
    {:at_damage, :on_damage, :fire_and_forget},
    {:at_death, :on_death, :fire_and_forget}
  ]

  @doc """
  Registers all script-aware hooks with the engine hook system.

  Should be called during application startup after the Hooks GenServer is running.
  """
  @spec register_hooks() :: :ok
  def register_hooks do
    Logger.info("[HookIntegration] Registering script hooks...")

    Enum.each(@hook_mapping, fn {engine_hook, _script_hook, _mode} ->
      case Hooks.register(engine_hook, __MODULE__, :handle_hook, priority: 50) do
        :ok ->
          Logger.debug("[HookIntegration] Registered #{engine_hook}")

        {:error, reason} ->
          Logger.warning(
            "[HookIntegration] Failed to register #{engine_hook}: #{inspect(reason)}"
          )
      end
    end)

    Logger.info("[HookIntegration] Script hooks registered")
    :ok
  end

  @doc """
  Unregisters all script hooks.

  Useful for testing or dynamically disabling script execution.
  """
  @spec unregister_hooks() :: :ok
  def unregister_hooks do
    Enum.each(@hook_mapping, fn {engine_hook, _script_hook, _mode} ->
      Hooks.unregister(engine_hook, __MODULE__, :handle_hook)
    end)

    :ok
  end

  @doc """
  Hook callback - dispatches to appropriate script handler.
  """
  def handle_hook(entity, context) when is_map(entity) do
    # Determine which hook this is from the callstack/context
    # The hook type is passed in context.hook_type by the caller
    hook_type = Map.get(context, :hook_type)

    case find_script_hook(hook_type) do
      {_engine_hook, script_hook, mode} ->
        run_script_hook(script_hook, entity, context, mode)

      nil ->
        :ok
    end
  end

  def handle_hook(_entity, _context), do: :ok

  # =============================================================================
  # Private Functions
  # =============================================================================

  defp find_script_hook(engine_hook) do
    Enum.find(@hook_mapping, fn {eh, _sh, _mode} -> eh == engine_hook end)
  end

  defp run_script_hook(script_hook, entity, context, mode) do
    case Executor.run_hook(script_hook, entity, context) do
      {:ok, result} ->
        handle_script_result(result, mode)

      :no_script ->
        :ok

      {:error, reason} ->
        Logger.warning("[HookIntegration] Script error for #{script_hook}: #{inspect(reason)}")
        :ok
    end
  end

  # Convert script results to hook return values
  defp handle_script_result(:default, _mode), do: :ok
  defp handle_script_result(:continue, _mode), do: :ok
  defp handle_script_result(:handled, _mode), do: :ok
  defp handle_script_result(:allow, _mode), do: :ok
  defp handle_script_result(:deny, :validate), do: {:halt, :denied_by_script}
  defp handle_script_result({:deny, reason}, :validate), do: {:halt, reason}
  defp handle_script_result(_, _mode), do: :ok
end
