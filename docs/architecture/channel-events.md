# Channel Events System

> Single source of truth for client-server communication.

## Overview

All events that flow through the Phoenix channel between server and client are defined in one place:

```
server/lib/loka/channel/events.ex  (Source of Truth)
           ↓
    mix loka.gen.channel_types
           ↓
mobile/src/types/channel.generated.ts  (Generated)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        events.ex                                 │
│               (Single Source of Truth)                           │
│                                                                  │
│  Defines:                                                        │
│  - Server → Client events (30 types)                             │
│  - Client → Server events (15 types)                             │
│  - Payload schemas for each event                                │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ↓               ↓               ↓
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Validator     │ │   Generator     │ │   ActionBridge  │
│   (Runtime)     │ │   (Build)       │ │   (Dispatch)    │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ Validates       │ │ Creates TS      │ │ Uses validated  │
│ payloads at     │ │ types from      │ │ push for all    │
│ runtime         │ │ Elixir defs     │ │ events          │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Adding a New Event

### 1. Define in events.ex

```elixir
# server/lib/loka/channel/events.ex

@server_events %{
  # ... existing events ...

  "my_new_event" => %{
    required_field: :string,
    optional_field: {:optional, :integer},
    enum_field: {:enum, ["option1", "option2"]},
    nested: %{
      inner_field: :string
    }
  }
}
```

### 2. Regenerate TypeScript

```bash
cd server
mix loka.gen.channel_types
```

### 3. Use in ActionBridge

The event is automatically validated when you dispatch it:

```elixir
defp dispatch_event({:my_new_event, data}, socket) do
  validated_push(socket, "my_new_event", data)
  socket
end
```

### 4. Handle in Mobile

TypeScript types are automatically available:

```typescript
import { MyNewEventPayload } from '../types/channel.generated';

channel.on('my_new_event', (payload: MyNewEventPayload) => {
  // TypeScript knows the shape
});
```

## Type System

### Basic Types

| Type | Elixir | TypeScript | Runtime Check |
|------|--------|------------|---------------|
| String | `:string` | `string` | `is_binary()` |
| Integer | `:integer` | `number` | `is_integer()` |
| Boolean | `:boolean` | `boolean` | `is_boolean()` |
| Map | `:map` | `Record<string, unknown>` | `is_map()` |
| List | `:list` | `unknown[]` | `is_list()` |

### Compound Types

| Type | Elixir | TypeScript |
|------|--------|------------|
| Optional | `{:optional, :string}` | `string?` |
| Enum | `{:enum, ["a", "b"]}` | `"a" \| "b"` |
| Nested | `%{field: :string}` | `{ field: string }` |

## Validation

### Server-Side (Elixir)

Validation happens automatically in ActionBridge:

```elixir
# In dev/test: raises on invalid payload
# In prod: logs error and sends anyway (for resilience)

defp validated_push(socket, event_name, payload) do
  case Validator.validate_and_log(:server, event_name, payload, context) do
    :ok -> Phoenix.Channel.push(socket, event_name, payload)
    {:error, reason} ->
      Logger.error("Validation failed: #{reason}")
      # Still sends in prod for resilience
  end
end
```

### Client-Side (TypeScript)

Use `safePush` for validated sends:

```typescript
import { safePush } from '../channel/validator';

// Validates before sending
safePush(channel, 'navigate', { direction: 'north' });

// In dev: throws on invalid payload
// In prod: logs and sends anyway
```

## Debugging

### View Validation Errors

Server stores recent validation errors:

```elixir
# In IEx or admin dashboard
Loka.Channel.Validator.get_recent_errors(100)
```

Each error includes:
- Event name and direction
- Error message
- Sanitized payload
- Player ID
- Timestamp

### Check Event Sync

Verify TypeScript matches Elixir:

```bash
# Regenerate and check for changes
cd server
mix loka.gen.channel_types

cd ../mobile
git diff src/types/channel.generated.ts
```

## CI Integration

The CI pipeline should verify types are in sync:

```yaml
# .github/workflows/ci.yml
- name: Check channel types in sync
  run: |
    cd server && mix loka.gen.channel_types
    cd ../mobile
    git diff --exit-code src/types/channel.generated.ts
```

## Files

| File | Purpose |
|------|---------|
| `server/lib/loka/channel/events.ex` | Event definitions (source of truth) |
| `server/lib/loka/channel/validator.ex` | Runtime validation |
| `server/lib/mix/tasks/loka.gen.channel_types.ex` | TypeScript generator |
| `mobile/src/types/channel.generated.ts` | Generated types |
| `mobile/src/channel/validator.ts` | Client-side validation |

## Best Practices

1. **Always edit events.ex** — Never manually edit channel.generated.ts
2. **Run generator after changes** — `mix loka.gen.channel_types`
3. **Use safePush for critical events** — Catches errors in dev
4. **Check validation errors** — Review logs for payload issues
5. **Keep payloads simple** — Flat structures are easier to validate

## See Also

- [Client-Server Messaging](./client-server-messaging.md) — Single source of truth principle
- [Channel Contract](../api/channel-contract.md) — Full protocol documentation
