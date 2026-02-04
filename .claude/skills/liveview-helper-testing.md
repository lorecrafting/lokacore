# LiveView Helper Module Testing

## Trigger
- Writing unit tests for modules that use `Phoenix.Component.assign`
- Error: "assign/3 expects a socket from Phoenix.LiveView"
- Testing Chat, state management, or other LiveView helper modules

## Problem
`Phoenix.Component.assign/3` is strict about what it accepts. Custom structs or plain maps won't work - it requires either:
1. A real `Phoenix.LiveView.Socket` struct
2. A plain assigns map (but then you can't access `socket.assigns`)

Most LiveView helpers access `socket.assigns` directly, so you need option 1.

## Solution

Create a test helper that builds a minimal `Phoenix.LiveView.Socket`:

```elixir
defmodule MyApp.SomeHelperTest do
  use MyAppWeb.ConnCase, async: true

  alias MyApp.SomeHelper

  # Helper to create a test LiveView socket
  defp live_socket(assigns \\ %{}) do
    %Phoenix.LiveView.Socket{
      assigns: Map.merge(%{__changed__: %{}}, assigns),
      endpoint: MyAppWeb.Endpoint,
      view: MyAppWeb.SomeLive,
      router: MyAppWeb.Router
    }
  end

  test "some helper function" do
    socket = live_socket(%{my_assign: "value"})
    result = SomeHelper.do_something(socket, "input")

    assert result.assigns.my_assign == "expected"
  end
end
```

## Key Points

1. **Include `__changed__: %{}`** in assigns - Phoenix.Component uses this for change tracking
2. **Use `ConnCase`** - provides necessary test setup
3. **Access results via `result.assigns.key`** - not `result.key`

## Common Gotcha: Missing Assigns

When adding new attributes to a LiveView component:

```elixir
# In component
attr :new_feature, :string, default: nil

# In render
<MyComponent.comp new_feature={@new_feature} />
```

You MUST also add the assign in mount:

```elixir
# In LiveView mount
|> assign(:new_feature, nil)  # Don't forget this!
```

**Symptom:** `KeyError: key :new_feature not found in: %{...}`

**Fix:** Add the assign to both mount AND the component call.

## Example: Chat Module Tests

```elixir
defmodule Loka.WorldBuilder.ChatTest do
  use LokaWeb.ConnCase, async: true

  alias Loka.WorldBuilder.Chat

  defp live_socket(assigns \\ %{}) do
    %Phoenix.LiveView.Socket{
      assigns: Map.merge(%{__changed__: %{}}, assigns),
      endpoint: LokaWeb.Endpoint,
      view: LokaWeb.AdminLive.WorldBuilderLive,
      router: LokaWeb.Router
    }
  end

  test "queue_message adds to queue" do
    socket = live_socket(%{chat_queued_messages: []})
    result = Chat.queue_message(socket, "Hello")
    assert result.assigns.chat_queued_messages == ["Hello"]
  end
end
```

## References
- `test/loka/world_builder/chat_test.exs` - Full example
- Phoenix.Component.assign source: checks `is_socket/1` guard
