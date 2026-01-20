defmodule Loka.Engine.Script.Executor do
  @moduledoc """
  Orchestrates script execution for hooks.

  The Executor is the main entry point for running scripts attached to entities.
  It handles:

  - Looking up scripts by entity and hook
  - Running scripts in the sandbox
  - Executing queued actions
  - Handling script return values

  ## Hook Execution Flow

  1. Entity triggers a hook (e.g., `on_look`, `on_enter`)
  2. Executor looks up attached script(s)
  3. Script runs in sandbox with entity/context bindings
  4. Script returns a result (`:default`, `:deny`, `{:append, text}`, etc.)
  5. Queued actions are executed
  6. Result is returned to the hook system

  ## Script Sources

  Scripts can come from:

  1. **Database** - Scripts stored in the `scripts` table
  2. **YAML Prototype** - Scripts referenced in entity's `builder_scripts` field
  3. **Convention** - Script key `{entity_key}_{hook}` (e.g., `novice_pema_on_look`)

  ## Return Values

  Scripts return values that affect the triggering system:

  - `:default` - Use default behavior
  - `:handled` - Script handled it, stop processing
  - `:continue` - Continue normal processing
  - `:deny` - Block the action
  - `{:deny, reason}` - Block with message
  - `{:append, text}` - Add text to description
  - `{:prepend, text}` - Add text before description
  - `{:replace, text}` - Replace description entirely
  - `{:respond, text}` - Auto-respond (for on_say)
  - `{:redirect, room_id}` - Redirect to different room
  """

  require Logger

  alias Loka.Engine.Script.{Sandbox, ActionQueue}
  alias Loka.Engine.Scripts
  alias Loka.Content.Script, as: ContentScript

  @type hook :: atom()
  @type script_result ::
          :default
          | :handled
          | :continue
          | :deny
          | :allow
          | {:deny, String.t()}
          | {:append, String.t()}
          | {:prepend, String.t()}
          | {:replace, String.t()}
          | {:respond, String.t()}
          | {:redirect, String.t()}

  @doc """
  Run a hook script for an entity.

  Looks up the script attached to the entity for the given hook,
  executes it, and returns the result.

  ## Parameters

  - `hook` - The hook type (`:on_look`, `:on_enter`, etc.)
  - `entity` - The entity with the script
  - `context` - Event context (player, args, etc.)
  - `opts` - Execution options

  ## Returns

  - `{:ok, result}` - Script ran successfully, returns normalized result
  - `:no_script` - No script attached for this hook
  - `{:error, reason}` - Script failed
  """
  @spec run_hook(hook(), map(), map(), keyword()) ::
          {:ok, script_result()} | :no_script | {:error, term()}
  def run_hook(hook, entity, context \\ %{}, opts \\ []) do
    case get_script(entity, hook) do
      nil ->
        :no_script

      script ->
        run_script(script, entity, context, opts)
    end
  end

  @doc """
  Run a script by key.

  Looks up the script by key and executes it.
  """
  @spec run_by_key(String.t(), map(), map(), keyword()) ::
          {:ok, script_result()} | {:error, term()}
  def run_by_key(script_key, entity, context \\ %{}, opts \\ []) do
    case get_script_by_key(script_key) do
      nil ->
        {:error, :script_not_found}

      script ->
        run_script(script, entity, context, opts)
    end
  end

  @doc """
  Run multiple hook scripts for an entity.

  Some hooks may have multiple scripts attached. This runs all of them
  and returns the combined result.
  """
  @spec run_hooks(hook(), map(), map(), keyword()) :: {:ok, script_result()} | :no_script
  def run_hooks(hook, entity, context \\ %{}, opts \\ []) do
    scripts = get_scripts(entity, hook)

    if Enum.empty?(scripts) do
      :no_script
    else
      # Run scripts in order, stop on :deny or :handled
      run_scripts_until_handled(scripts, entity, context, opts)
    end
  end

  @doc """
  Execute a script source directly (for testing/admin).
  """
  @spec execute_source(String.t(), map(), map(), keyword()) ::
          {:ok, term(), [ActionQueue.action()]} | {:error, term()}
  def execute_source(source, entity, context \\ %{}, opts \\ []) do
    Sandbox.execute(source, entity, context, opts)
  end

  @doc """
  Test a script without executing actions.
  """
  @spec test_script(String.t(), map(), map()) ::
          {:ok, term(), [ActionQueue.action()]} | {:error, term()}
  def test_script(source, entity \\ %{}, context \\ %{}) do
    Sandbox.execute(source, entity, Map.put(context, :test_mode, true))
  end

  # =============================================================================
  # Private Functions
  # =============================================================================

  # Get script for an entity and hook
  defp get_script(entity, hook) do
    hook_string = to_string(hook)

    # Check entity's builder_scripts field first
    case get_in_entity(entity, [:builder_scripts, hook_string]) ||
           get_in_entity(entity, [:scripts, hook_string]) do
      nil ->
        # Try convention: {entity_key}_{hook}
        entity_key = Map.get(entity, :key)

        if entity_key do
          get_script_by_key("#{entity_key}_#{hook_string}")
        else
          nil
        end

      script_key when is_binary(script_key) ->
        get_script_by_key(script_key)

      _other ->
        nil
    end
  end

  # Get script by key from database or TypedObject
  defp get_script_by_key(key) do
    # Try TypedObject (Content.Script) first
    case ContentScript.get(key) do
      {:ok, script} ->
        %{
          key: script.key,
          source: ContentScript.source(script),
          hook: ContentScript.hook(script),
          timeout_ms: ContentScript.timeout_ms(script)
        }

      {:error, _} ->
        # Fall back to database
        case Scripts.get_script_by_name(key) do
          nil ->
            nil

          db_script ->
            %{
              key: db_script.name,
              source: db_script.source,
              hook: db_script.hook,
              timeout_ms: 5_000
            }
        end
    end
  end

  # Get all scripts for a hook
  defp get_scripts(entity, hook) do
    # For now, just return the single script if it exists
    case get_script(entity, hook) do
      nil -> []
      script -> [script]
    end
  end

  # Run a single script
  defp run_script(script, entity, context, opts) do
    source = Map.get(script, :source)
    timeout = Map.get(script, :timeout_ms, 5_000)

    opts = Keyword.put_new(opts, :timeout, timeout)

    case Sandbox.execute(source, entity, context, opts) do
      {:ok, result, actions} ->
        # Execute queued actions unless in test mode
        unless Map.get(context, :test_mode, false) do
          ActionQueue.execute_all(actions, context)
        end

        {:ok, normalize_result(result)}

      {:error, :timeout} ->
        Logger.warning("[Executor] Script timeout: #{Map.get(script, :key)}")
        {:ok, :continue}

      {:error, :validation_failed} ->
        Logger.error("[Executor] Script validation failed: #{Map.get(script, :key)}")
        {:error, :validation_failed}

      {:error, reason} ->
        Logger.error("[Executor] Script error: #{inspect(reason)}")
        {:ok, :continue}
    end
  end

  # Run multiple scripts until one returns :handled or :deny
  defp run_scripts_until_handled([], _entity, _context, _opts), do: {:ok, :continue}

  defp run_scripts_until_handled([script | rest], entity, context, opts) do
    case run_script(script, entity, context, opts) do
      {:ok, :handled} -> {:ok, :handled}
      {:ok, :deny} -> {:ok, :deny}
      {:ok, {:deny, _} = result} -> {:ok, result}
      {:ok, _} -> run_scripts_until_handled(rest, entity, context, opts)
      {:error, _} -> run_scripts_until_handled(rest, entity, context, opts)
    end
  end

  # Normalize script return value to a standard result type
  defp normalize_result(:default), do: :default
  defp normalize_result(:handled), do: :handled
  defp normalize_result(:continue), do: :continue
  defp normalize_result(:deny), do: :deny
  defp normalize_result(:allow), do: :allow
  defp normalize_result({:deny, reason}) when is_binary(reason), do: {:deny, reason}
  defp normalize_result({:append, text}) when is_binary(text), do: {:append, text}
  defp normalize_result({:prepend, text}) when is_binary(text), do: {:prepend, text}
  defp normalize_result({:replace, text}) when is_binary(text), do: {:replace, text}
  defp normalize_result({:respond, text}) when is_binary(text), do: {:respond, text}
  defp normalize_result({:redirect, room_id}) when is_binary(room_id), do: {:redirect, room_id}
  defp normalize_result(nil), do: :default
  defp normalize_result(true), do: :allow
  defp normalize_result(false), do: :deny

  defp normalize_result(other) do
    Logger.debug("[Executor] Unknown result type: #{inspect(other)}, treating as :continue")
    :continue
  end

  # Helper to safely access nested entity fields
  defp get_in_entity(entity, keys) when is_map(entity) do
    Enum.reduce_while(keys, entity, fn key, acc ->
      case acc do
        %{} = map ->
          # Try both atom and string versions of the key
          atom_key = if is_binary(key), do: String.to_existing_atom(key), else: key
          string_key = if is_atom(key), do: Atom.to_string(key), else: key

          value = Map.get(map, key) || Map.get(map, atom_key) || Map.get(map, string_key)
          if value, do: {:cont, value}, else: {:halt, nil}

        _ ->
          {:halt, nil}
      end
    end)
  rescue
    ArgumentError -> nil
  end

  defp get_in_entity(_, _), do: nil

  # =============================================================================
  # Event Trigger Support
  # =============================================================================

  @doc """
  Get event triggers defined in a script.

  Scripts can define event triggers in their data:

  ```yaml
  data:
    events: [dawn, dusk]  # Short form
    # OR
    trigger:
      type: event
      events: [time:dawn, time:dusk]  # Full form
  ```

  Returns list of event atoms like [:dawn, :dusk]
  """
  @spec get_script_events(String.t()) :: [atom()]
  def get_script_events(script_key) do
    case ContentScript.get(script_key) do
      {:ok, script} ->
        parse_script_events(script)

      {:error, _} ->
        []
    end
  end

  defp parse_script_events(script) do
    data = Map.get(script, :data, %{})

    # Check for events field (short form)
    events = Map.get(data, :events) || Map.get(data, "events") || []

    # Check for trigger.events (full form)
    trigger_events =
      case Map.get(data, :trigger) || Map.get(data, "trigger") do
        %{} = trigger ->
          events_list = Map.get(trigger, :events) || Map.get(trigger, "events") || []
          events_list

        _ ->
          []
      end

    # Combine and normalize to atoms
    (events ++ trigger_events)
    |> Enum.uniq()
    |> Enum.map(&normalize_event_name/1)
  end

  defp normalize_event_name(event) when is_atom(event), do: event
  defp normalize_event_name("time:" <> name), do: String.to_atom(name)
  defp normalize_event_name("weather:" <> name), do: String.to_atom(name)
  defp normalize_event_name(name) when is_binary(name), do: String.to_atom(name)

  @doc """
  Register an entity's behavior script for world event subscriptions.

  Call this when attaching a behavior to an entity. If the behavior script
  has event triggers, this will subscribe the entity to those events via
  WorldEventHandler.

  ## Parameters

  - `entity_id` - ID of the entity
  - `behavior_key` - Script key of the behavior
  - `config` - Config to pass when the event fires

  ## Returns

  List of events the entity was subscribed to
  """
  @spec register_behavior_events(String.t(), String.t(), map()) :: [atom()]
  def register_behavior_events(entity_id, behavior_key, config \\ %{}) do
    alias Loka.Framework.Scripting.WorldEventHandler

    events = get_script_events(behavior_key)

    Enum.each(events, fn event ->
      WorldEventHandler.subscribe(entity_id, event, behavior_key, config)
    end)

    events
  end

  @doc """
  Unregister all world event subscriptions for an entity.

  Call this when an entity despawns or is removed.
  """
  @spec unregister_behavior_events(String.t()) :: :ok
  def unregister_behavior_events(entity_id) do
    alias Loka.Framework.Scripting.WorldEventHandler

    WorldEventHandler.unsubscribe_all(entity_id)
  end
end
