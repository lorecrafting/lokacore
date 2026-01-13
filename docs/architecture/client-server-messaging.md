# Client-Server Messaging: Single Source of Truth

## Principle

**The server is the single source of truth for all player-facing messages.**

When a game event occurs (quest completion, combat result, etc.), the server should generate the complete, properly formatted message. Clients should display server messages directly, not generate their own versions.

## Why This Matters

1. **Consistency** — Players see identical messages whether on web, mobile, or future clients
2. **Localization** — Messages can be translated server-side without updating every client
3. **No Duplication** — Prevents double-messages like "Victory!" appearing twice
4. **Easier Updates** — Change message wording in one place (server), not N clients
5. **Richer Messages** — Server has full context (rewards, quest names, enemy names, etc.)

## Pattern

### Correct: Server Sends Complete Message

```elixir
# Server (dialogue.ex)
events = [
  {:event, "Quest complete — #{quest_title}! #{reward_text}"},
  {:quest_completed, %{quest_id: quest_id, title: quest_title, rewards: rewards}}
]
```

```typescript
// Client (usePhoenix.ts)
channel.on('event', (payload) => {
  addEvent({ text: payload.text, ... });  // Display server's message
});

channel.on('quest_completed', (payload) => {
  // Update state only, NO addEvent() - server already sent the message
});
```

### Wrong: Client Generates Duplicate Message

```typescript
// BAD - Don't do this
channel.on('quest_completed', (payload) => {
  addEvent({ text: `Quest completed: ${payload.title}` });  // DUPLICATE!
});
```

## When Clients CAN Add Messages

Clients should only generate messages when the server intentionally does not:

| Event | Server Sends Text? | Client Action |
|-------|-------------------|---------------|
| `combat_start` | No | Client adds "Combat begins with X!" |
| `combat_end` (victory) | Yes ("Victory! You defeated...") | Client does NOT add message |
| `combat_end` (fled) | Yes ("You fled from...") | Client does NOT add message |
| `combat_end` (defeat) | No (leads to bardo) | Client adds "You were defeated." |
| `quest_accepted` | Yes ("New quest — X") | Client does NOT add message |
| `quest_completed` | Yes ("Quest complete — X!") | Client does NOT add message |

## Event Types

### Structured Events (for state updates)

These events update client state but may or may not need display:

- `combat_start` — Start combat UI, show enemy health
- `combat_end` — Clear combat state
- `quest_accepted` — Add quest to quest log
- `quest_completed` — Remove quest from active, add to completed
- `room_update` — Update room display

### Text Events (for display)

The `event` type is specifically for player-facing messages:

```elixir
{:event, "You found a hidden passage!"}
{:event, "Quest complete — The Lost Sword! +100 XP, +50 gold"}
{:event, "Victory! You defeated the wolf. Gained 25 XP."}
```

## Implementation Checklist

When adding a new game event:

1. **Server**: Create the complete, formatted message as `{:event, "..."}`
2. **Server**: Also send structured event with data (e.g., `{:quest_completed, %{...}}`)
3. **Client**: Listen for `event` to display messages
4. **Client**: Listen for structured event to update state ONLY
5. **Client**: Do NOT call `addEvent()` in structured event handlers

## Audit

### Check for duplicate message generation:

```bash
grep -n "addEvent" mobile/src/hooks/usePhoenix.ts
```

Each `addEvent` should be in either:
- The `event` handler (correct — displaying server message)
- A handler where server intentionally sends no text (documented exception)

### Check for event name mismatches:

```bash
# List server events
grep -rn 'push(socket, "' server/lib/loka_web/channels/ | sed 's/.*push(socket, "\([^"]*\)".*/\1/' | sort | uniq

# List mobile handlers
grep -n "channel.on('" mobile/src/hooks/usePhoenix.ts | sed "s/.*channel.on('\([^']*\)'.*/\1/" | sort | uniq

# Compare them
diff <(grep -rn 'push(socket, "' server/lib/loka_web/channels/ | sed 's/.*push(socket, "\([^"]*\)".*/\1/' | sort | uniq) \
     <(grep -n "channel.on('" mobile/src/hooks/usePhoenix.ts | sed "s/.*channel.on('\([^']*\)'.*/\1/" | sort | uniq)
```

### Event Name Conventions

Server event names should use `snake_case` and follow these patterns:
- `{entity}_update` — State changed (inventory_update, stats_update)
- `{entity}_start` / `{entity}_end` — Lifecycle (combat_start, dialogue_end)
- `{entity}_open` / `{entity}_close` — Modal state (shop_open, container_close)
- `{action}_completed` — Async completion (quest_completed, timer_completed)

## Exceptions

Document any intentional exceptions here:

| Handler | Reason Client Generates Message |
|---------|--------------------------------|
| `combat_start` | Server sends data only; client provides UI feedback |
| `combat_end` (defeat) | Defeat leads to bardo sequence; brief client message before transition |
| `room_update` (atmosphere) | Atmosphere text is room data, not an event message |
