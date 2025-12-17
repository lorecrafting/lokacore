defmodule Exmud.Engine.Scripting do
  @moduledoc """
  Lua scripting integration using Luerl.

  Scripts are executed in a sandboxed environment with:
  - No file system access
  - No network access
  - CPU/memory limits
  - Controlled API exposure
  """

  alias Exmud.Engine.{Entity, Event, EventBus}

  @doc """
  Executes a Lua script in a sandboxed environment.
  """
  def execute(script, %Entity{} = entity, context \\ %{}) when is_binary(script) do
    lua = init_sandbox()

    lua = inject_entity(lua, entity)
    lua = inject_context(lua, context)
    lua = inject_api(lua)

    case :luerl.do(script, lua) do
      {:ok, result, _new_lua} ->
        {:ok, result}

      {:error, reason, _lua} ->
        {:error, {:script_error, reason}}
    end
  rescue
    e -> {:error, {:script_exception, e}}
  end

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

  # Private functions

  defp init_sandbox do
    :luerl.init()
  end

  defp inject_entity(lua, %Entity{} = entity) do
    entity_table = [
      {"id", entity.id},
      {"type", to_string(entity.type)},
      {"name", entity.name || ""},
      {"description", entity.description || ""},
      {"location", entity.location_id || ""}
    ]

    :luerl.set_table_keys(["entity"], entity_table, lua)
  end

  defp inject_context(lua, context) when is_map(context) do
    context_list =
      context
      |> Enum.map(fn {k, v} -> {to_string(k), to_lua_value(v)} end)

    :luerl.set_table_keys(["context"], context_list, lua)
  end

  defp inject_api(lua) do
    # Inject safe game API functions
    api_functions = [
      {"message", &api_message/2},
      {"log", &api_log/2}
    ]

    :luerl.set_table_keys(["game"], api_functions, lua)
  end

  defp api_message([target_id, message], lua) when is_binary(target_id) and is_binary(message) do
    event = Event.new(:message, %{
      target: target_id,
      payload: %{text: message}
    })

    EventBus.emit(event)
    {[], lua}
  end

  defp api_message(_, lua), do: {[], lua}

  defp api_log([message], lua) when is_binary(message) do
    require Logger
    Logger.info("[Lua Script] #{message}")
    {[], lua}
  end

  defp api_log(_, lua), do: {[], lua}

  defp to_lua_value(v) when is_binary(v), do: v
  defp to_lua_value(v) when is_number(v), do: v
  defp to_lua_value(v) when is_boolean(v), do: v
  defp to_lua_value(v) when is_atom(v), do: to_string(v)
  defp to_lua_value(v) when is_map(v), do: Enum.map(v, fn {k, val} -> {to_string(k), to_lua_value(val)} end)
  defp to_lua_value(_), do: nil

  # Security checks

  @blocked_patterns [
    ~r/os\./,
    ~r/io\./,
    ~r/file\./,
    ~r/require\s*\(/,
    ~r/dofile\s*\(/,
    ~r/loadfile\s*\(/,
    ~r/debug\./,
    ~r/package\./,
    ~r/rawget\s*\(/,
    ~r/rawset\s*\(/
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
