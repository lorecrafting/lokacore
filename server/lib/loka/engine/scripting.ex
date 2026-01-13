defmodule Loka.Engine.Scripting do
  @moduledoc """
  Lua scripting integration using Luerl.

  Scripts are executed in a sandboxed environment with:
  - No file system access
  - No network access
  - CPU/memory limits
  - Controlled API exposure

  ## Architecture

  The scripting system uses an extension mechanism to keep the Engine layer
  generic while allowing the Framework layer to define game-specific APIs.

  - **Engine layer** provides: sandbox, core APIs (`game.message`, `game.log`)
  - **Framework layer** provides: game-specific APIs via `ScriptingExtension`

  ## Core API (Built-in)

  - `game.message(target_id, message)` - Send a message to an entity
  - `game.log(message)` - Log a message to the server

  ## Extension APIs

  Game-specific functions are provided by extensions implementing the
  `Loka.Engine.ScriptingExtension` behaviour. See `Loka.Framework.Scripting.GameScriptAPI`
  for the default game extension which provides:

  - `game.quest.is_active(quest_id)` - Check if quest is active
  - `game.quest.is_complete(quest_id)` - Check if quest is completed
  - `game.player.has_item(item_key)` - Check if player has item
  - `game.player.has_flag(flag_name)` - Check if player has flag
  - And more...

  ## Configuration

  Extensions are configured in your application config:

      config :loka, :scripting_extensions, [
        Loka.Framework.Scripting.GameScriptAPI
      ]

  ## Example Script

      -- Custom NPC behavior based on quest state
      if game.quest.is_active("main_sleeping_master") then
        game.message(entity.id, "You're on the right path, traveler.")
      else
        game.message(entity.id, "The monastery needs your help!")
      end

      -- Check player flags for dialogue branching
      if game.player.has_flag("spoke_to_elder") then
        return "elder_greeting_return"
      else
        game.log("First time talking to elder")
        return "elder_greeting_first"
      end
  """

  require Logger

  alias Loka.Engine.{Entity, Event, EventBus}

  # Default timeout for script execution (5 seconds)
  @default_timeout 5_000
  # Maximum size of returned result (prevent memory exhaustion)
  @max_result_size 10_000

  @doc """
  Executes a Lua script in a sandboxed environment.

  ## Parameters

  - `script` - Lua source code to execute
  - `entity` - The entity context (available as `entity.*` in Lua)
  - `context` - Additional context map (available as `context.*` in Lua)
  - `opts` - Execution options

  ## Options

  - `:timeout` - Execution timeout in milliseconds (default: #{@default_timeout})
  - `:extensions` - List of extension modules to load (overrides config)

  ## Returns

  - `{:ok, result}` on success
  - `{:error, :script_timeout}` if execution exceeds timeout
  - `{:error, {:script_error, reason}}` on Lua errors
  - `{:error, {:script_exception, exception}}` on Elixir exceptions
  """
  def execute(script, %Entity{} = entity, context \\ %{}, opts \\ []) when is_binary(script) do
    timeout = Keyword.get(opts, :timeout, @default_timeout)
    start_time = System.monotonic_time()

    task =
      Task.async(fn ->
        do_execute(script, entity, context, opts)
      end)

    result =
      case Task.yield(task, timeout) || Task.shutdown(task, :brutal_kill) do
        {:ok, result} ->
          result

        nil ->
          Logger.warning("[Scripting] Script execution timed out after #{timeout}ms")
          {:error, :script_timeout}
      end

    # Emit telemetry for script execution
    duration = System.monotonic_time() - start_time

    :telemetry.execute(
      [:loka, :script, :execute],
      %{duration: duration},
      %{
        entity_id: entity.id,
        entity_type: entity.type,
        success: match?({:ok, _}, result),
        error_type: error_type(result),
        script_length: byte_size(script)
      }
    )

    result
  end

  defp error_type({:ok, _}), do: nil
  defp error_type({:error, :script_timeout}), do: :timeout
  defp error_type({:error, {:script_error, _}}), do: :script_error
  defp error_type({:error, {:script_exception, _}}), do: :exception
  defp error_type({:error, :result_too_large}), do: :result_too_large
  defp error_type(_), do: :unknown

  defp do_execute(script, %Entity{} = entity, context, opts) do
    extensions = get_extensions(opts)

    lua = init_sandbox()
    lua = inject_entity(lua, entity)
    lua = inject_context(lua, context)
    lua = inject_core_api(lua)
    lua = inject_extensions(lua, extensions)

    case :luerl.do(script, lua) do
      {:ok, result, _new_lua} ->
        # Check result size to prevent memory exhaustion
        case check_result_size(result) do
          :ok -> {:ok, result}
          {:error, _} = err -> err
        end

      {:error, reason, _lua} ->
        {:error, {:script_error, reason}}
    end
  rescue
    e -> {:error, {:script_exception, e}}
  end

  @doc """
  Returns the list of configured scripting extensions.
  """
  def configured_extensions do
    Application.get_env(:loka, :scripting_extensions, [])
  end

  defp get_extensions(opts) do
    Keyword.get(opts, :extensions, configured_extensions())
  end

  defp check_result_size(result) do
    size = estimate_result_size(result)

    if size > @max_result_size do
      Logger.warning("[Scripting] Result size #{size} exceeds limit #{@max_result_size}")
      {:error, :result_too_large}
    else
      :ok
    end
  end

  defp estimate_result_size(value) when is_binary(value), do: byte_size(value)
  defp estimate_result_size(value) when is_number(value), do: 8
  defp estimate_result_size(value) when is_boolean(value), do: 1
  defp estimate_result_size(value) when is_nil(value), do: 0
  defp estimate_result_size(value) when is_atom(value), do: String.length(Atom.to_string(value))

  defp estimate_result_size(value) when is_list(value) do
    Enum.reduce(value, 0, fn item, acc -> acc + estimate_result_size(item) end)
  end

  defp estimate_result_size(value) when is_tuple(value) do
    value
    |> Tuple.to_list()
    |> estimate_result_size()
  end

  defp estimate_result_size(value) when is_map(value) do
    Enum.reduce(value, 0, fn {k, v}, acc ->
      acc + estimate_result_size(k) + estimate_result_size(v)
    end)
  end

  defp estimate_result_size(_), do: 100

  @doc """
  Validates a script for security issues before allowing it to be saved.
  """
  def validate_script(source) when is_binary(source) do
    checks = [
      &check_blocked_patterns/1,
      &check_length/1
    ]

    Enum.reduce_while(checks, :ok, fn check, _acc ->
      case check.(source) do
        :ok -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  # =============================================================================
  # Sandbox Initialization
  # =============================================================================

  defp init_sandbox do
    lua = :luerl.init()

    # Remove dangerous global functions from the Lua environment
    # This provides runtime protection even if pattern checks are bypassed
    dangerous_globals = [
      "dofile",
      "loadfile",
      "load",
      "loadstring",
      "rawget",
      "rawset",
      "rawequal",
      "rawlen",
      "getmetatable",
      "setmetatable",
      "collectgarbage",
      "module",
      "require",
      "newproxy"
    ]

    # Remove dangerous modules entirely
    dangerous_modules = ["os", "io", "debug", "package", "coroutine"]

    lua =
      Enum.reduce(dangerous_globals, lua, fn func, state ->
        {:ok, new_state} = :luerl.set_table_keys([func], nil, state)
        new_state
      end)

    lua =
      Enum.reduce(dangerous_modules, lua, fn mod, state ->
        {:ok, new_state} = :luerl.set_table_keys([mod], nil, state)
        new_state
      end)

    # Remove string.dump (bytecode generation)
    {:ok, lua} = :luerl.set_table_keys(["string", "dump"], nil, lua)
    lua
  end

  # =============================================================================
  # Context Injection
  # =============================================================================

  defp inject_entity(lua, %Entity{} = entity) do
    entity_map = %{
      "id" => entity.id,
      "type" => to_string(entity.type),
      # LegendMUD-style fields
      "short_desc" => entity.short_desc || "",
      "long_desc" => entity.long_desc || "",
      "extra_desc" => entity.extra_desc || "",
      "keywords" => Enum.join(entity.keywords || [], ","),
      "mood" => entity.mood || "",
      # Legacy aliases for backward compatibility
      "name" => entity.short_desc || "",
      "description" => entity.extra_desc || "",
      "location" => entity.location_id || ""
    }

    {:ok, lua} = :luerl.set_table_keys_dec(["entity"], entity_map, lua)
    lua
  end

  defp inject_context(lua, context) when is_map(context) do
    context_map =
      context
      |> Enum.map(fn {k, v} -> {to_string(k), to_lua_value(v)} end)
      |> Map.new()

    {:ok, lua} = :luerl.set_table_keys_dec(["context"], context_map, lua)
    lua
  end

  # =============================================================================
  # Core API (Engine layer - generic functions)
  # =============================================================================

  defp inject_core_api(lua) do
    # Core API functions that are generic to any scripting use case
    api_map = %{
      "message" => &api_message/2,
      "log" => &api_log/2
    }

    {:ok, lua} = :luerl.set_table_keys_dec(["game"], api_map, lua)
    lua
  end

  defp api_message([target_id, message], lua) when is_binary(target_id) and is_binary(message) do
    event =
      Event.new(:message, %{
        target: target_id,
        payload: %{text: message}
      })

    EventBus.emit(event)
    {[], lua}
  end

  defp api_message(_, lua), do: {[], lua}

  defp api_log([message], lua) when is_binary(message) do
    Logger.info("[Lua Script] #{message}")
    {[], lua}
  end

  defp api_log(_, lua), do: {[], lua}

  # =============================================================================
  # Extension Loading
  # =============================================================================

  defp inject_extensions(lua, extensions) do
    Enum.reduce(extensions, lua, fn extension_module, lua_state ->
      inject_extension(lua_state, extension_module)
    end)
  end

  defp inject_extension(lua, extension_module) do
    try do
      namespace = extension_module.api_namespace()
      functions = extension_module.api_functions()

      inject_extension_functions(lua, namespace, functions)
    rescue
      e ->
        Logger.warning(
          "[Scripting] Failed to load extension #{inspect(extension_module)}: #{inspect(e)}"
        )

        lua
    end
  end

  defp inject_extension_functions(lua, namespace, functions) when is_map(functions) do
    Enum.reduce(functions, lua, fn {key, value}, lua_state ->
      path = [namespace, key]

      case value do
        nested when is_map(nested) ->
          # Nested namespace (e.g., game.quest.*)
          # First, ensure the nested namespace table exists
          lua_state = ensure_table_exists(lua_state, path)

          # Then add each function to the nested namespace
          Enum.reduce(nested, lua_state, fn {func_name, func}, inner_lua ->
            {:ok, new_lua} = :luerl.set_table_keys_dec(path ++ [func_name], func, inner_lua)
            new_lua
          end)

        func when is_function(func) ->
          # Direct function at this level
          {:ok, new_lua} = :luerl.set_table_keys_dec(path, func, lua_state)
          new_lua

        _ ->
          lua_state
      end
    end)
  end

  # Ensure a table path exists in the Lua state
  defp ensure_table_exists(lua, path) do
    case :luerl.get_table_keys_dec(path, lua) do
      {nil, _} ->
        # Table doesn't exist, create empty table at this path
        {:ok, new_lua} = :luerl.set_table_keys_dec(path, %{}, lua)
        new_lua

      {_, _} ->
        # Table already exists
        lua
    end
  rescue
    _ ->
      # If there's an error getting the table, try to create it
      case :luerl.set_table_keys_dec(path, %{}, lua) do
        {:ok, new_lua} -> new_lua
        _ -> lua
      end
  end

  # =============================================================================
  # Value Conversion
  # =============================================================================

  defp to_lua_value(v) when is_binary(v), do: v
  defp to_lua_value(v) when is_number(v), do: v
  defp to_lua_value(v) when is_boolean(v), do: v
  defp to_lua_value(v) when is_atom(v), do: to_string(v)

  defp to_lua_value(v) when is_map(v),
    do: Enum.map(v, fn {k, val} -> {to_string(k), to_lua_value(val)} end)

  defp to_lua_value(_), do: nil

  # =============================================================================
  # Security Checks
  # =============================================================================

  # Security checks - block dangerous Lua functions and patterns
  # These patterns prevent sandbox escapes via:
  # - File/OS access (os, io, file, dofile, loadfile, require)
  # - Debug access (debug module gives full introspection)
  # - Package/module loading (require, package)
  # - Raw table access bypassing metatables (rawget, rawset)
  # - Metatable manipulation (getmetatable, setmetatable can escape sandbox)
  # - Code loading (load, loadstring execute arbitrary code)
  # - Global table direct access (_G can bypass restrictions)
  # - Bytecode manipulation (string.dump creates bytecode)
  # - GC manipulation (collectgarbage)
  # - Coroutine abuse (can be used for timing attacks)

  @blocked_patterns [
    # File and OS access
    ~r/os\./,
    ~r/io\./,
    ~r/file\./,
    ~r/require\s*\(/,
    ~r/dofile\s*\(/,
    ~r/loadfile\s*\(/,
    # Debug and package systems
    ~r/debug\./,
    ~r/package\./,
    # Raw table access
    ~r/rawget\s*\(/,
    ~r/rawset\s*\(/,
    ~r/rawequal\s*\(/,
    ~r/rawlen\s*\(/,
    # Metatable manipulation (CRITICAL - sandbox escape vector)
    ~r/getmetatable\s*\(/,
    ~r/setmetatable\s*\(/,
    # Dynamic code loading (CRITICAL - arbitrary code execution)
    ~r/\bload\s*\(/,
    ~r/loadstring\s*\(/,
    # Global table access (can bypass sandbox)
    ~r/_G\b/,
    ~r/_ENV\b/,
    # Bytecode and low-level string ops
    ~r/string\.dump\s*\(/,
    # GC manipulation
    ~r/collectgarbage\s*\(/,
    # Coroutine (potential for abuse)
    ~r/coroutine\./,
    # Module and chunk loading
    ~r/module\s*\(/,
    # String escape attempts (hex/unicode escapes can bypass pattern matching)
    ~r/\\x[0-9a-fA-F]{2}/,
    ~r/\\u\{[0-9a-fA-F]+\}/,
    # Infinite loop constructs (basic detection)
    ~r/while\s+true\s+do\s+end/,
    # Large string construction (memory exhaustion)
    ~r/string\.rep\s*\([^)]*,\s*\d{6,}\s*\)/,
    # Attempt to override globals via assignment
    ~r/\b(os|io|debug|package|coroutine|require)\s*=/
  ]

  defp check_blocked_patterns(source) do
    case Enum.find(@blocked_patterns, &Regex.match?(&1, source)) do
      nil -> :ok
      pattern -> {:error, {:blocked_pattern, pattern}}
    end
  end

  @max_script_length 50_000

  defp check_length(source) do
    if String.length(source) <= @max_script_length do
      :ok
    else
      {:error, {:script_too_long, String.length(source)}}
    end
  end
end
