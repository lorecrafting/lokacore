# Loka Logging Guide

This guide covers the structured logging system used throughout the Loka codebase. It documents conventions, debugging techniques, and guidelines for adding logging when building new features.

## Table of Contents

- [Logging Architecture](#logging-architecture)
- [Module Prefixes](#module-prefixes)
- [Log Levels](#log-levels)
- [Debugging with Logs](#debugging-with-logs)
- [Adding Logging to New Code](#adding-logging-to-new-code)
- [Examples](#examples)

## Logging Architecture

Loka uses Elixir's built-in `Logger` with structured prefixes for easy filtering and debugging. All logs follow this format:

```
[LEVEL] [PREFIX] Message: key=value key2=value2
```

Example:
```
[info] [COMBAT] Victory: player_id=abc123 enemy=Goblin xp=50 gold=10
```

### Why Structured Logging?

1. **Filterability**: `grep "\[COMBAT\]"` shows only combat logs
2. **Debuggability**: Key-value pairs make it easy to trace specific players/entities
3. **Consistency**: Same format across all modules
4. **Searchability**: Find issues by player_id, entity_id, recipe, etc.

## Module Prefixes

Each module uses a unique prefix in square brackets:

### Game Actions (`lib/loka/game/actions/`)

| Prefix | Module | Events Logged |
|--------|--------|---------------|
| `[COMBAT]` | `combat.ex` | Attack initiation, flee attempts, combat ticks, victory, defeat |
| `[SHOP]` | `shop.ex` | Open shop, buy items, sell items |
| `[CONTAINER]` | `container.ex` | Open container, take items, close, respawn scheduling |
| `[GATHERING]` | `gathering.ex` | Gather from nodes, craft actions |

### Framework Modules (`lib/loka/framework/`)

| Prefix | Module | Events Logged |
|--------|--------|---------------|
| `[CRAFTING]` | `crafting/crafting.ex` | Can-craft checks, craft success/failure, ingredient consumption |
| `[DIALOGUE]` | `dialogue/dialogue.ex` | Start conversation, choose option, dialogue flow |
| `[INVENTORY]` | `inventory/inventory.ex` | Add item, remove item, use item |

### Engine Modules (`lib/loka/engine/`)

| Prefix | Module | Events Logged |
|--------|--------|---------------|
| `[ENTITIES]` | `entities.ex` | Create, update, delete entity operations |
| `[LOCKS]` | `locks.ex` | Access control checks (grant/deny) |
| `[SPAWNER]` | `spawner.ex` | Entity spawning, room spawning |

### Channel Layer (`lib/loka_web/channels/`)

| Prefix | Module | Events Logged |
|--------|--------|---------------|
| `[ACTION_BRIDGE]` | `action_bridge.ex` | Action execution, timing, error handling |

## Log Levels

Use the appropriate level based on what you're logging:

### `debug` - Detailed Flow Information

For tracing execution flow during development. **Not visible in production by default.**

```elixir
Logger.debug("[CRAFTING] Checking can_craft: recipe=#{recipe_key}")
Logger.debug("[DIALOGUE] Choice selected: npc_id=#{npc_id} node=#{node_id} choice=#{index}")
```

**Use for:**
- Entry/exit points of functions
- Intermediate state during operations
- Condition checks that might help debugging
- Things you'd want to know when stepping through code

### `info` - Successful Operations

For recording successful completion of meaningful operations.

```elixir
Logger.info("[COMBAT] Victory: player_id=#{player_id} enemy=#{enemy_name} xp=#{xp} gold=#{gold}")
Logger.info("[SHOP] Purchase completed: player_id=#{player_id} item=#{item_key} cost=#{price}")
Logger.info("[ENTITIES] Created: id=#{id} type=#{type} key=#{key}")
```

**Use for:**
- Successful completion of game actions
- State changes worth tracking (items acquired, quests completed)
- Entity lifecycle events (create, delete)

### `warning` - Failures and Denials

For expected but notable failure conditions.

```elixir
Logger.warning("[CRAFTING] Craft aborted: recipe=#{recipe_key} reason=#{inspect(reason)}")
Logger.warning("[INVENTORY] Add failed - item not found: item_id=#{item_id}")
Logger.warning("[LOCKS] Invalid lock: entity=#{key} type=#{type} error=#{reason}")
```

**Use for:**
- Business logic failures (missing items, insufficient gold)
- Access denials
- Invalid requests
- Recoverable errors

### `error` - System Errors

For unexpected errors that indicate bugs or system issues.

```elixir
Logger.error("[SHOP] Buy failed - spawn error: player_id=#{player_id} item=#{item_key} error=#{inspect(error)}")
Logger.error("[CONTAINER] Take failed - spawn error: item_key=#{item_key} error=#{inspect(error)}")
```

**Use for:**
- Database errors
- Spawn/creation failures
- Unexpected nil values
- Any error that shouldn't happen in normal operation

## Debugging with Logs

### Filtering by Module

```bash
# Terminal filtering
fly logs | grep "\[COMBAT\]"
mix phx.server 2>&1 | grep "\[DIALOGUE\]"

# Multiple modules
fly logs | grep -E "\[COMBAT\]|\[INVENTORY\]"
```

### Tracing a Player Session

All logs include `player_id` where relevant:

```bash
# Find all actions by a specific player
fly logs | grep "player_id=abc123"

# Combine with module filter
fly logs | grep "\[COMBAT\]" | grep "player_id=abc123"
```

### Common Debug Scenarios

#### "Player can't craft item"

```bash
# Check crafting logs
fly logs | grep "\[CRAFTING\]" | grep "player_id=PLAYER_ID"
```

Look for:
- `Cannot craft: recipe=X reason={:missing_ingredients, ...}`
- `Cannot craft: recipe=X reason={:skill_required, ...}`

#### "Combat seems broken"

```bash
fly logs | grep "\[COMBAT\]" | grep "player_id=PLAYER_ID"
```

Look for:
- `Attack initiated` - Did combat start?
- `Combat started` - Was enemy valid?
- `Tick continues` - Is damage being dealt?
- `Victory` / `Defeat` - How did it end?

#### "Item disappeared"

```bash
fly logs | grep "\[INVENTORY\]" | grep "player_id=PLAYER_ID"
fly logs | grep "\[ENTITIES\]" | grep "item_id=ITEM_ID"
```

Look for:
- `Item removed` - Was it sold/used/dropped?
- `Deleted` - Was entity destroyed?

#### "Dialogue not working"

```bash
fly logs | grep "\[DIALOGUE\]" | grep "npc_id=NPC_ID"
```

Look for:
- `Start failed - NPC not found`
- `No dialogue tree`
- `Choice selected` / `Conversation started`

### Development Mode: Max Verbosity

In development, set log level to debug in `config/dev.exs`:

```elixir
config :logger, level: :debug
```

Or at runtime:

```elixir
Logger.configure(level: :debug)
```

## Adding Logging to New Code

When building new mechanics, frameworks, or components, follow these guidelines:

### 1. Choose a Unique Prefix

Pick a short, descriptive prefix that identifies your module:

```elixir
# Good prefixes
[AUCTION]   # Auction system
[GUILD]     # Guild management
[MOUNT]     # Mount/riding system
[WEATHER]   # Weather effects

# Avoid
[AH]        # Too cryptic
[AUCTION_HOUSE_SYSTEM]  # Too long
```

### 2. Add `require Logger`

At the top of your module after aliases:

```elixir
defmodule Loka.Framework.Auction do
  @moduledoc "..."

  require Logger  # <-- Add this

  alias Loka.Engine.Entities
  # ...
end
```

### 3. Log Entry Points

Log when entering significant functions:

```elixir
def create_listing(player_id, item_id, price) do
  Logger.debug("[AUCTION] Creating listing: player=#{player_id} item=#{item_id} price=#{price}")
  # ...
end
```

### 4. Log Success Cases

```elixir
def create_listing(player_id, item_id, price) do
  # ... validation and creation ...

  Logger.info("[AUCTION] Listing created: id=#{listing.id} player=#{player_id} item=#{item_id} price=#{price}")
  {:ok, listing}
end
```

### 5. Log Failure Cases

```elixir
def create_listing(player_id, item_id, price) do
  case validate_item(item_id) do
    {:error, :not_found} ->
      Logger.warning("[AUCTION] Listing failed - item not found: player=#{player_id} item=#{item_id}")
      {:error, :item_not_found}

    {:error, :not_tradeable} ->
      Logger.debug("[AUCTION] Listing failed - item not tradeable: player=#{player_id} item=#{item_id}")
      {:error, :not_tradeable}
  end
end
```

### 6. Include Relevant Context

Always include identifiers that help trace the operation:

```elixir
# Good - includes all relevant IDs
Logger.info("[AUCTION] Sale completed: listing=#{listing_id} seller=#{seller_id} buyer=#{buyer_id} price=#{price}")

# Bad - missing context
Logger.info("[AUCTION] Sale completed")
```

### 7. Use `inspect/1` for Complex Values

```elixir
# For maps, lists, or structs
Logger.debug("[AUCTION] Processing filters: #{inspect(filters, limit: 200)}")

# For error tuples
Logger.warning("[AUCTION] Creation failed: reason=#{inspect(reason)}")
```

## Examples

### Complete Module Example

```elixir
defmodule Loka.Framework.Auction do
  @moduledoc """
  Auction house system for player-to-player trading.
  """

  require Logger

  alias Loka.Engine.{Entities, Spawner}
  alias Loka.Framework.{Inventory, Economy}

  @doc """
  Creates a new auction listing.
  """
  def create_listing(player_id, item_id, price, duration \\ :hours_24) do
    Logger.debug("[AUCTION] Creating listing: player=#{player_id} item=#{item_id} price=#{price}")

    with {:ok, item} <- Inventory.get_item(player_id, item_id),
         :ok <- validate_tradeable(item),
         :ok <- validate_price(price),
         {:ok, listing} <- do_create_listing(player_id, item, price, duration) do

      Logger.info("[AUCTION] Listing created: id=#{listing.id} player=#{player_id} item=#{item_id} price=#{price}")
      {:ok, listing}
    else
      {:error, :item_not_found} = error ->
        Logger.warning("[AUCTION] Listing failed - item not found: player=#{player_id} item=#{item_id}")
        error

      {:error, :not_tradeable} = error ->
        Logger.debug("[AUCTION] Listing failed - item not tradeable: player=#{player_id} item=#{item_id}")
        error

      {:error, reason} = error ->
        Logger.warning("[AUCTION] Listing failed: player=#{player_id} reason=#{inspect(reason)}")
        error
    end
  end

  @doc """
  Purchases a listing.
  """
  def buy_listing(buyer_id, listing_id) do
    Logger.debug("[AUCTION] Purchase attempt: buyer=#{buyer_id} listing=#{listing_id}")

    with {:ok, listing} <- get_listing(listing_id),
         :ok <- validate_not_expired(listing),
         :ok <- validate_buyer_funds(buyer_id, listing.price),
         {:ok, transaction} <- execute_purchase(buyer_id, listing) do

      Logger.info(
        "[AUCTION] Purchase completed: listing=#{listing_id} buyer=#{buyer_id} " <>
        "seller=#{listing.seller_id} item=#{listing.item_key} price=#{listing.price}"
      )

      {:ok, transaction}
    else
      {:error, :listing_not_found} ->
        Logger.debug("[AUCTION] Purchase failed - listing not found: listing=#{listing_id}")
        {:error, :listing_not_found}

      {:error, :insufficient_funds} ->
        Logger.debug("[AUCTION] Purchase failed - insufficient funds: buyer=#{buyer_id} listing=#{listing_id}")
        {:error, :insufficient_funds}

      {:error, reason} ->
        Logger.warning("[AUCTION] Purchase failed: buyer=#{buyer_id} listing=#{listing_id} reason=#{inspect(reason)}")
        {:error, reason}
    end
  end
end
```

### Game Action Example

```elixir
defmodule Loka.Game.Actions.Auction do
  @moduledoc """
  Auction-related game actions.
  """

  require Logger

  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Framework.Auction

  def create_listing(ctx, item_id, price) do
    player_id = ctx.player_id

    Logger.debug("[AUCTION_ACTION] Create listing request: player=#{player_id} item=#{item_id}")

    case Auction.create_listing(player_id, item_id, price) do
      {:ok, listing} ->
        Logger.info("[AUCTION_ACTION] Listing created: player=#{player_id} listing=#{listing.id}")

        result = Result.new(
          events: [
            {:event, "You listed #{listing.item_name} for #{price} gold."},
            {:auction_listing_created, %{listing: listing}}
          ]
        )
        {:ok, result}

      {:error, reason} ->
        Logger.debug("[AUCTION_ACTION] Create listing failed: player=#{player_id} reason=#{inspect(reason)}")
        {:error, format_error(reason)}
    end
  end
end
```

## Log Output Configuration

### Development (Console)

Default Elixir Logger format in `config/dev.exs`:

```elixir
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]
```

### Production (JSON)

Structured JSON logging via LoggerJSON in `config/prod.exs`:

```elixir
config :logger, :console,
  format: {LoggerJSON.Formatters.Basic, :format},
  metadata: :all
```

Output:
```json
{
  "time": "2025-01-15T12:00:00.000Z",
  "level": "info",
  "message": "[COMBAT] Victory: player_id=abc123 enemy=Goblin xp=50",
  "metadata": {"request_id": "xyz789"}
}
```

## References

- `lib/loka/game/actions/combat.ex` - Combat logging example
- `lib/loka/framework/crafting/crafting.ex` - Framework logging example
- `lib/loka/engine/entities.ex` - Engine logging example
- [Elixir Logger Documentation](https://hexdocs.pm/logger/Logger.html)
