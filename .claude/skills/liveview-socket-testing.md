# LiveView Socket Testing Patterns

## Trigger

Use this skill when:
1. Writing tests that manipulate Phoenix LiveView sockets directly
2. Getting `KeyError: key :__changed__ not found` in socket tests
3. Testing functions that use `Phoenix.Component.assign/3`

## Problem

When creating a socket struct directly for testing:

```elixir
# BAD: Missing required internal keys
socket = %Phoenix.LiveView.Socket{assigns: %{}}
Audit.init_context(socket, player)  # KeyError: :__changed__ not found
```

## Solution

Always include `__changed__` in the assigns map:

```elixir
# GOOD: Properly initialized socket
defp test_socket(assigns \\ %{}) do
  %Phoenix.LiveView.Socket{
    assigns: Map.merge(%{__changed__: %{}}, assigns)
  }
end

# Usage
test "assigns audit_context to socket" do
  socket = test_socket()
  player = %{id: 123}

  socket = Audit.init_context(socket, player)

  assert socket.assigns.audit_context.player_id == 123
end

# With pre-existing assigns
test "returns socket unchanged" do
  socket = test_socket(%{
    audit_context: %{player_id: nil, ip_address: nil, user_agent: nil}
  })

  result = Audit.log(socket, :create, :room, "tavern", nil, %{})
  assert result.assigns.audit_context == socket.assigns.audit_context
end
```

## Task.Supervisor + Ecto Sandbox

When testing async operations (like audit logging via Task.Supervisor):

```elixir
# BAD: Async tasks can't access sandbox connection
Audit.log(socket, :create, :room, key, nil, state)
Process.sleep(100)
AuditLog.by_entity(:room, key) |> Repo.all()  # DBConnection.OwnershipError
```

Solutions:
1. **Use synchronous variant for testing**: `Audit.log_sync/7`
2. **Or set sandbox to shared mode** (impacts test isolation)
3. **Or test async behavior separately** with proper sandbox setup

## Files

- Pattern used in: `test/loka/admin/audit_test.exs`
