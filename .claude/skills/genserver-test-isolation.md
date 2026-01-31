# GenServer Test Isolation with Application-Started Processes

## Problem

Tests using `start_supervised!` fail with `{:already_started, pid}` error when the GenServer is already started by `application.ex`.

## Symptoms

```
** (RuntimeError) failed to start child with the spec Loka.WorldBuilder.LLM.ConversationManager.
Reason: bad child specification, got: {:already_started, #PID<0.456.0>}
```

## Root Cause

Named GenServers started in the application supervision tree are already running when tests execute. `start_supervised!` attempts to start a second instance with the same name.

## Solution

Check if the process is already running before attempting to start:

```elixir
setup do
  # GenServer is already started by application.ex
  # Just verify it's running
  case Process.whereis(MyGenServer) do
    nil -> start_supervised!(MyGenServer)
    _pid -> :ok
  end

  :ok
end
```

## When to Apply

Use this pattern when testing GenServers that:
1. Are started in `application.ex` supervision tree
2. Use a named registration (e.g., `name: __MODULE__`)
3. Tests need to interact with the running process

## Alternative: Test-Only Mode

For processes that need isolated state per test, consider:

1. Add a `load_on_start: false` option to the GenServer
2. In `application.ex`, start with `load_on_start: true`
3. In tests, use `start_supervised!({MyGenServer, [load_on_start: false]})`

Example from CraftingRegistry:
```elixir
setup do
  registry =
    case start_supervised({CraftingRegistry, [load_on_start: false]}) do
      {:ok, pid} -> pid
      {:error, {:already_started, pid}} -> pid
    end

  %{registry: registry}
end
```

## Files Affected in Loka

- `test/loka/world_builder/llm/bulk_generator_test.exs`
- `test/loka/world_builder/llm/conversation_manager_test.exs`
- Any test for GenServers listed in `lib/loka/application.ex`

## Related

- Elixir ExUnit `start_supervised!/2` documentation
- GenServer named registration patterns
