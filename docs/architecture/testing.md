# Testing System

Loka has a **unified testing architecture** with a single source of truth for quest logic:

1. **QuestStrategy** - Pure decision logic shared by all test runners
2. **Bot Testing** - Fast, Elixir-based testing at the framework layer
3. **E2E Testing** - Browser-based testing with Playwright for UI verification

## Testing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    QUEST STRATEGY (Single Source of Truth)   │
│  Loka.Testing.QuestStrategy                                  │
│  - Quest flow logic (find giver → accept → complete)        │
│  - Pathfinding (BFS)                                        │
│  - Dialogue navigation                                      │
│  - Objective handling (talk, go_to, get_item, kill)         │
├─────────────────────────────────────────────────────────────┤
│                              │                               │
│         ┌────────────────────┴────────────────────┐         │
│         ▼                                         ▼         │
│ ┌─────────────────────────┐   ┌─────────────────────────┐   │
│ │ BOT TESTING (Elixir)    │   │ E2E TESTING (Playwright)│   │
│ │ Direct function calls   │   │ HTTP API + UI clicks    │   │
│ │ ~300 lines              │   │ ~250 lines              │   │
│ │ ChannelBot E2E test     │   │ mix e2e                 │   │
│ └─────────────────────────┘   └─────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ STRATEGY API (for Playwright)                               │
│   POST /api/test/strategy/next-action  - Get next action    │
│   GET  /api/test/strategy/quest-order  - Get quest order    │
├─────────────────────────────────────────────────────────────┤
│ SHARED TEST DATA                                            │
│   Loka.Testing.TestData    - World graph, quest definitions │
│   mix loka.export_test_data - Export JSON for Playwright    │
│   test/e2e/data/           - Exported JSON files            │
└─────────────────────────────────────────────────────────────┘
```

## Test Suites Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     mix loka.test                              │
│                  (Master Test Runner)                           │
│                                                                 │
│  Orchestrates all test suites, provides unified reporting       │
└────────────┬──────────────┬──────────────┬──────────────┬───────┘
             │              │              │              │
             ▼              ▼              ▼              ▼
     ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
     │   Unit    │  │ Validate  │  │ Storyline │  │  Balance  │
     │   Tests   │  │           │  │           │  │           │
     ├───────────┤  ├───────────┤  ├───────────┤  ├───────────┤
     │ mix test  │  │ World     │  │ Quest     │  │ Combat    │
     │           │  │ Quest     │  │ Chain     │  │ Simulation│
     │ ExUnit    │  │ Prototype │  │ Playthrough│ │ XP Curve  │
     └───────────┘  └───────────┘  └───────────┘  └───────────┘
```

## Unified Quest Strategy

The `QuestStrategy` module (`lib/loka/testing/quest_strategy.ex`) is the single source
of truth for quest-playing logic. Both bot and E2E tests use the same decision-making:

```elixir
# QuestStrategy returns pure actions, no side effects
context = %{
  storyline_id: "monastery_arc",
  current_room_id: "monastery_gate",
  game_state: game_state,
  nearby_entities: entities,
  room_graph: room_graph
}

{action, new_state} = QuestStrategy.next_action(context)
# => {:navigate, "north"}, {:talk, "novice_pema"}, {:dialogue_choice, 0}, etc.
```

**Benefits:**
- Quest logic bug = one fix, both systems work
- No duplication between Elixir and TypeScript
- Easy to add new test clients (mobile, CLI)

## When to Use Which

| Scenario | Bot Testing | E2E Testing |
|----------|-------------|-------------|
| Quest logic correctness | Yes | - |
| UI clicks trigger correct actions | - | Yes |
| Full quest completable via UI | - | Yes |
| Performance/load testing | Yes | - |
| Visual regression | - | Yes |
| CI speed (fast feedback) | Yes | - |

**Recommendation**: Use bot testing for logic, E2E for UI integration.

---

# Bot Testing System

The bot testing system enables automated testing of game content, quests, and mechanics by simulating player behavior.

## Bot Architecture Options

Loka provides two bot implementations:

| Bot Type | Description | Use Case |
|----------|-------------|----------|
| **ChannelBot** (Recommended) | Executes actions through Phoenix channels | Realistic testing - tests full code path |
| **Bot** (Legacy) | Directly calls framework modules | Fast but doesn't test channel layer |

### ChannelBot (Recommended)

ChannelBot executes actions through the same Phoenix channels that real clients use. This ensures tests exercise:
- GameChannel message handling
- ActionBridge context building
- Actions module execution
- Event serialization and dispatch

```elixir
# Spawn a channel-based bot (recommended)
{:ok, pid} = BotSupervisor.spawn_channel_bot(
  strategy: RandomWalker,
  strategy_opts: [max_steps: 100],
  name: "Test Bot"
)
```

### Hybrid Architecture

ChannelBot uses a hybrid approach:
- **Actions**: Execute via channel push (realistic testing)
- **Inspection**: Direct server state access (for debugging/assertions)

```
┌─────────────────────────────────────────────────────────┐
│                    CHANNEL BOT                          │
├──────────────────────────┬──────────────────────────────┤
│   ACTIONS (Channel)      │   INSPECTION (Direct)        │
│   push("navigate", ...)  │   StateInspector.inspect_*   │
│   push("attack", ...)    │   StateInspector.assert_*    │
└──────────────────────────┴──────────────────────────────┘
```

### Legacy Bot (Deprecated)

> **Deprecated**: Use `spawn_channel_bot/1` instead for realistic testing.

The legacy bot directly calls framework modules, bypassing the channel layer:

```elixir
# Legacy - for backward compatibility only
{:ok, pid} = BotSupervisor.spawn_bot(
  strategy: RandomWalker,
  strategy_opts: [max_steps: 100]
)
```

## Quick Start

### Running Storyline E2E Tests

```bash
# Run ChannelBot E2E storyline test (95% production parity)
mix test test/integration/storyline_channel_test.exs

# With trace output
mix test test/integration/storyline_channel_test.exs --trace
```

### Master Test Runner

Run all tests with a single command:

```bash
mix loka.test              # Full suite
mix loka.test --quick      # Skip slow balance sims
mix loka.test --only unit,validate
mix loka.test --skip balance
mix loka.test --strict     # Fail on warnings
mix loka.test --quiet      # Minimal output
```

**Exit Codes:**
- `0` - All tests passed
- `1` - One or more tests failed

### Validate All Content

```bash
# Validate prototypes, quests, and world connectivity
mix loka.test.validate
```

## Architecture

### ChannelBot (`Loka.Testing.Bot.ChannelBot`)

The recommended bot implementation. ChannelBot runs **synchronously in the test process**
(required for Phoenix.ChannelTest). It:

- **Connects via Phoenix.ChannelTest** - Uses `connect/3`, `subscribe_and_join/4`, `push/2`
- **Executes actions via channel push** - Tests the real GameChannel → ActionBridge → Actions code path
- **Receives events from channel** - Tests serialization and event dispatch
- **Builds state from events** - Like a real client would
- **Works with StateInspector** - For server state assertions (hybrid approach)

**Important**: ChannelBot uses Phoenix.ChannelTest which only works within ExUnit test processes.
It is NOT a GenServer - it's a struct with functions for step-by-step control.

```elixir
# In a test file that uses Loka.ChannelCase
use Loka.ChannelCase

test "bot can navigate and complete quest" do
  # Create test player
  player = create_test_player()

  # Start bot with strategy
  {:ok, bot} = ChannelBot.start(player, strategy: RandomWalker)

  # Run for N ticks (strategy decides actions)
  {:ok, bot} = ChannelBot.run(bot, ticks: 50)

  # Or step through one tick at a time for debugging
  {:ok, bot} = ChannelBot.tick(bot)
  IO.inspect(bot.last_action)

  # Use StateInspector for server-side assertions
  StateInspector.assert_quest_completed(player.id, "first_quest")
  StateInspector.assert_in_room(player.id, "village_square")

  # Get bot summary
  info = ChannelBot.get_info(bot)
  # => %{player_id: 1, room: %{...}, tick_count: 50, metrics: %{...}}

  # Clean up
  :ok = ChannelBot.stop(bot)
end

# Run until condition met (with max ticks as safety)
{:ok, bot} = ChannelBot.run(bot, ticks: 100, until: fn bot ->
  StateInspector.quest_completed?(bot.player.id, "first_quest")
end)
```

### Test Helper: ChannelCase

Use `Loka.ChannelCase` for tests that use ChannelBot:

```elixir
defmodule MyChannelBotTest do
  use Loka.ChannelCase, async: false

  alias Loka.Testing.Bot.ChannelBot
  alias Loka.Testing.Bot.StateInspector
  alias Loka.Testing.Bot.Strategies.RandomWalker

  test "example test" do
    player = create_test_player()  # Helper from ChannelCase

    {:ok, bot} = ChannelBot.start(player, strategy: RandomWalker)
    {:ok, bot} = ChannelBot.run(bot, ticks: 10)

    # Assertions using StateInspector
    assert StateInspector.health_percent(player.id) > 0

    :ok = ChannelBot.stop(bot)
  end
end
```

### StateInspector (`Loka.Testing.Bot.StateInspector`)

Direct access to internal server state for debugging and assertions:

```elixir
alias Loka.Testing.Bot.StateInspector

# Inspection functions
{:ok, game_state} = StateInspector.inspect_game_state(player_id)
{:ok, entity} = StateInspector.inspect_entity(entity_id)
{:ok, room} = StateInspector.inspect_room(room_id)
{:ok, progress} = StateInspector.inspect_quest_progress(player_id, quest_id)

# Assertion helpers (raise on failure with detailed error)
StateInspector.assert_quest_completed(player_id, "first_quest")
StateInspector.assert_has_item(player_id, "sword")
StateInspector.assert_in_room(player_id, "village_square")
StateInspector.assert_health_above(player_id, 50)
StateInspector.assert_flag_set(player_id, "met_hermit")

# Query helpers (return boolean)
StateInspector.quest_completed?(player_id, "first_quest")  # => true/false
StateInspector.has_item?(player_id, "sword")               # => true/false
StateInspector.current_room(player_id)                     # => "village_square"
StateInspector.health_percent(player_id)                   # => 85.5

# State drift detection (client vs server)
case StateInspector.check_state_drift(bot_state, player_id) do
  :ok -> IO.puts("States match!")
  {:drift, differences} -> IO.inspect(differences)
end
```

### Legacy Bot GenServer (`Loka.Testing.Bot`) - Deprecated

> **Deprecated**: Use ChannelBot instead.

The legacy bot directly calls framework modules:

```elixir
# Legacy - for backward compatibility only
{:ok, bot_pid} = BotSupervisor.spawn_bot(
  strategy: RandomWalker,
  strategy_opts: [max_steps: 100],
  name: "Explorer Bot",
  tick_interval_ms: 500
)
```

### Strategy Behaviour

Strategies define how bots make decisions. Implement the `Strategy` behaviour:

```elixir
defmodule MyTestStrategy do
  @behaviour Loka.Testing.Bot.Strategy
  alias Loka.Testing.Bot.{Strategy, Assertions, TestReporter}

  @impl true
  def init(opts) do
    {:ok, %{
      max_steps: Keyword.get(opts, :max_steps, 100),
      step_count: 0,
      assertions: [
        {:quest_completed, "quest_find_leaf"},
        {:has_item, "leaf"}
      ],
      reporter: TestReporter.new("My Test")
    }}
  end

  @impl true
  def decide(context, state) do
    # Check if we're done
    results = Assertions.check_all(state.assertions, context.game_state, context)

    if Assertions.all_passed?(results) do
      {:idle, %{state | phase: :complete}}
    else
      # Pick an action based on context
      action = pick_action(context)
      {action, %{state | step_count: state.step_count + 1}}
    end
  end

  @impl true
  def handle_event(_event, state), do: {:ok, state}
end
```

### Available Actions

Strategies return actions that `BotActions` executes:

| Category | Action | Description |
|----------|--------|-------------|
| **Movement** | `{:move, direction}` | Move in a direction ("north", "south", etc.) |
| **Combat** | `{:attack, entity_id}` | Start combat with an entity |
| | `{:combat_action, :attack \| :defend \| :flee}` | Basic combat action |
| | `{:use_ability, ability_key}` | Use an ability (e.g., "power_strike") |
| **Dialogue** | `{:start_dialogue, npc_id}` | Start talking to an NPC |
| | `{:dialogue_choice, choice_index}` | Select dialogue option (0-indexed) |
| | `{:dialogue_action, action}` | Execute dialogue action directly |
| **Gathering** | `{:gather, node_key}` | Gather from a resource node |
| **Crafting** | `{:craft, recipe_key, tool_id}` | Craft a recipe |
| **Inventory** | `{:interact, entity_id}` | Pick up item or interact |
| | `{:use_item, item_id}` | Use an item |
| | `{:equip, item_id, slot}` | Equip an item |
| | `{:unequip, slot}` | Unequip from slot |
| **Utility** | `:idle` | Do nothing this tick |
| | `{:wait, duration_ms}` | Wait before next action |

### Strategy Helpers

The `Strategy` module provides helper functions for decision-making:

```elixir
# Navigation
Strategy.get_available_exits(room)  # => ["north", "east"]

# Finding entities
Strategy.find_combatants(entities)    # NPCs with combat component
Strategy.find_interactables(entities) # NPCs with dialogue, items
Strategy.find_dialogue_npcs(entities) # NPCs with dialogue_tree
Strategy.filter_by_type(entities, :npc)

# Gathering
Strategy.find_gathering_nodes(room)  # => [{"herb_patch", 3}, ...]

# Inventory
Strategy.has_item?(game_state, "healing_potion")
Strategy.count_items(game_state, "herb")

# Combat
Strategy.get_available_abilities(game_state)
Strategy.ability_ready?(game_state, "power_strike")
Strategy.health_below?(game_state, 30)  # Below 30%?

# Quests
Strategy.get_quest_state(game_state)  # => %{active: [...], completed: [...]}
Strategy.has_active_quest?(game_state, "quest_id")
Strategy.quest_completed?(game_state, "quest_id")
```

## Assertions System

The `Assertions` module validates game state expectations:

```elixir
alias Loka.Testing.Bot.Assertions

# Define assertions
assertions = [
  {:quest_completed, "quest_find_leaf"},
  {:quest_active, "quest_kill_goblin"},
  {:has_item, "leaf"},
  {:has_items, {"herb", 5}},
  {:flag_set, "met_hermit"},
  {:visited_room, "forest_clearing"},
  {:in_room, "village_square"},
  {:level_at_least, 3},
  {:stat_at_least, {:str, 12}},
  {:health_above, 50},
  {:combat_victory, "goblin"}
]

# Check all assertions
results = Assertions.check_all(assertions, game_state, context)

# Query results
Assertions.all_passed?(results)   # All assertions passed?
Assertions.any_failed?(results)   # Any failures?
Assertions.has_pending?(results)  # Still pending?

# Get summary
Assertions.summary(results)
# => %{passed: 5, failed: 1, pending: 2, errors: 0, total: 8, success: false}

# Format for display
Assertions.format_results(results)
```

### Assertion Types

| Type | Args | Description |
|------|------|-------------|
| `:quest_completed` | quest_id | Quest is in completed list |
| `:quest_active` | quest_id | Quest is currently active |
| `:has_item` | item_key | Item is in inventory |
| `:has_items` | `{item_key, count}` | Has N items matching key |
| `:flag_set` | flag_name | Player flag is set |
| `:flag_not_set` | flag_name | Player flag is not set |
| `:visited_room` | room_key | Room has been visited |
| `:in_room` | room_key | Currently in room |
| `:level_at_least` | level | Player level >= value |
| `:stat_at_least` | `{stat, value}` | Stat >= value |
| `:health_above` | percentage | Health above threshold |
| `:combat_victory` | enemy_key | Won combat against enemy |
| `:custom` | `{module, fn, args}` | Custom assertion function |

## Test Reporter

The `TestReporter` collects and formats test results:

```elixir
alias Loka.Testing.Bot.TestReporter

# Create a report
report = TestReporter.new("Monastery Arc Test", %{storyline: "monastery_arc"})

# Record events during bot run
report = report
  |> TestReporter.record_action({:move, "north"}, :ok)
  |> TestReporter.record_room_visit("forest_clearing")
  |> TestReporter.record_quest_complete("quest_find_leaf")
  |> TestReporter.record_item_collected("leaf")
  |> TestReporter.record_combat_victory("goblin")
  |> TestReporter.set_assertions_result(assertions_result)

# Complete the test
report = TestReporter.auto_complete(report)

# Print summary
TestReporter.print_summary(report)

# Get JSON for logging/storage
TestReporter.to_json(report)
```

## Built-in Strategies

### RandomWalker

Explores randomly, optionally fighting enemies:

```elixir
BotSupervisor.spawn_bot(
  strategy: RandomWalker,
  strategy_opts: [
    max_steps: 100,
    fight_enemies: true,
    flee_at_health: 20
  ]
)
```

### StorylineRunner

Follows a storyline by completing quests in order:

```elixir
BotSupervisor.spawn_bot(
  strategy: StorylineRunner,
  strategy_opts: [
    storyline_id: "monastery_arc",
    log_actions: true
  ]
)
```

**Phases:**
1. `init` - Load storyline, get first quest
2. `navigate` - Move toward objective target
3. `interact` - Talk to NPCs, collect items
4. `combat` - Fight hostile enemies
5. `wait` - Wait for async events
6. `complete` - All quests done
7. `failed` - Unrecoverable error

**Results tracked:**
- `quests_completed` - List of completed quest IDs
- `objectives_achieved` - Completed objectives
- `rooms_visited` - All rooms explored
- `npcs_talked_to` - NPCs interacted with
- `items_collected` - Items picked up
- `enemies_defeated` - Mobs killed
- `errors` - Any errors encountered
- `warnings` - Non-fatal issues

---

## Balance Analysis

Monte Carlo simulations for validating game balance.

### Combat Simulator

Simulates thousands of combat encounters to calculate win rates:

```elixir
alias Loka.Testing.Balance.CombatSimulator

# Single matchup
player = %{health: 100, attack: 15, defense: 5, level: 3}
enemy = %{health: 80, attack: 12, defense: 3, level: 2}

results = CombatSimulator.simulate(player, enemy, iterations: 1000)
# => %{
#   win_rate: 0.873,
#   loss_rate: 0.127,
#   avg_turns: 3.2,
#   avg_damage_dealt: 45.6,
#   avg_damage_taken: 18.2,
#   damage_dealt_histogram: %{...}
# }

# Level range analysis
curve = CombatSimulator.simulate_level_range(1, 10, enemy, iterations: 500)
# => [{1, %{win_rate: 0.32}}, {2, %{win_rate: 0.45}}, ...]

# Matchup matrix
enemies = [{"goblin", goblin_stats}, {"orc", orc_stats}]
matrix = CombatSimulator.simulate_matchup_matrix(1..10, enemies)
```

### Progression Simulator

Validates XP curve and leveling time:

```elixir
alias Loka.Testing.Balance.ProgressionSimulator

# Simulate progression to level 10
results = ProgressionSimulator.simulate(target_level: 10, sessions: 100)
# => %{
#   avg_sessions_to_target: 45.2,
#   level_progression: [{1, %{avg_sessions: 0}}, ...],
#   bottlenecks: [{8, "Takes 2.5x longer than level 7"}]
# }

# Analyze XP curve
curve = ProgressionSimulator.analyze_xp_curve(1, 20)
# => %{
#   formula: "100 * level^2",
#   curve_data: [...],
#   issues: ["Level 15 XP requirement jumps 1.8x from previous"]
# }

# Validate curve
case ProgressionSimulator.validate_xp_curve(max_sessions_per_level: 15) do
  :ok -> IO.puts("Curve is balanced")
  {:issues, issues} -> Enum.each(issues, &IO.puts/1)
end
```

### Balance Analysis Mix Task

```bash
mix loka.test.balance              # Full analysis (1000 iterations)
mix loka.test.balance --quick      # Fast run (100 iterations)
mix loka.test.balance --output report.md
mix loka.test.balance --format json
```

**Analyzes:**
- Combat win rates at various level matchups
- Average fight duration
- XP progression curve
- Level bottlenecks
- Stat scaling

---

## Content Validation

The validation system ensures game content is internally consistent and free of broken references. Run validators with:

```bash
mix loka.test.validate          # All validators
mix loka.test.validate --strict # Fail on warnings too
```

### Validators

| Validator | Flag | What It Checks |
|-----------|------|----------------|
| **World Connectivity** | `--only world` | Orphan rooms, broken exits, missing return paths |
| **Quest (Prototypes)** | `--only quest` | Kill/talk targets exist, have correct components |
| **Quest (YAML)** | `--only yaml_quest` | Objectives, prerequisites, givers, rewards |
| **Prototype Definitions** | `--only prototype` | Required fields, valid parents, known components |
| **Dialogue Trees** | `--only dialogue` | Broken `next` refs, invalid actions, orphan nodes |
| **Content Reachability** | `--only reachability` | Unobtainable items, unreachable NPCs/quest givers |
| **Cutscene Definitions** | `--only cutscene` | Speaker NPCs exist, valid sequence/effect types |
| **Ability Definitions** | `--only ability` | Valid effect types, teacher NPCs exist |
| **Crafting Recipes** | `--only crafting` | Ingredient/output items exist, tools exist |
| **Storyline Structure** | `--only storyline` | Quest references valid, act dependencies valid |
| **UI/Data Consistency** | `--only ui` | Dialogue format, shop validity, quest_giver tags |

### World Connectivity Validator

Performs BFS from the starting room to ensure all rooms are connected:

```bash
mix loka.test.validate --only world
```

**Errors:**
- `orphan_room` - Room not reachable from starting room
- `broken_exit` - Exit destination doesn't exist

**Warnings:**
- `missing_return_exit` - One-way exit (no return path)

```elixir
alias Loka.Testing.Content.WorldValidator

{:ok, results} = WorldValidator.validate()
# => %{
#   rooms_checked: 42,
#   rooms_reachable: 40,
#   errors: [
#     {:orphan_room, "hidden_cave"},
#     {:broken_exit, "town_square", "north", "missing_room"}
#   ],
#   warnings: [
#     {:missing_return_exit, "forest", "east", "clearing"}
#   ]
# }

# Check if valid
if WorldValidator.valid?() do
  IO.puts("World is valid!")
end

# Human-readable report
report = WorldValidator.format_report(results)
IO.puts(report)
```

### Quest Validators

Two validators check quests from different angles:

1. **Prototype-based** - Checks prototypes with `quest` component
2. **YAML-based** - Checks quests loaded from `priv/world/quests/`

**Errors:**
- `missing_kill_target` / `missing_talk_target` - Target NPC doesn't exist
- `target_not_combatant` / `target_no_dialogue` - Target lacks required component
- `missing_quest_giver` - Giver NPC doesn't exist
- `circular_prerequisite` - Quest prerequisites form a cycle
- `missing_dialogue_topic` - Referenced dialogue node doesn't exist

**Warnings:**
- `orphaned_quest` - Quest not assigned to any storyline
- `giver_no_accept_action` - Giver dialogue has no `accept_quest` action for this quest
- `reward_item_not_found` - Reward item prototype doesn't exist

### Dialogue Validator

Validates dialogue tree integrity for all NPCs:

```bash
mix loka.test.validate --only dialogue
```

**Errors:**
- `broken_next` - Choice's `next` references non-existent node
- `invalid_action` - Unknown dialogue action type
- `missing_quest` - `accept_quest`/`complete_quest` references non-existent quest
- `missing_item` - `give_item`/`take_item` references non-existent item
- `invalid_condition` - Unknown condition type in `show_if`

**Warnings:**
- `orphan_node` - Dialogue node not reachable from any `start` node
- `empty_text` - Node has no text (and isn't a redirect node)

**Valid Action Types:**
```
accept_quest, complete_quest, give_item, take_item,
set_flag, clear_flag, give_xp, give_gold, teleport,
start_combat, heal, teach_ability, learn_skill, open_shop
```

**Valid Condition Types:**
```
quest_active, quest_completed, quest_not_active, quest_not_completed,
has_item, has_flag, flag_set, flag_not_set, level_at_least,
has_gold, completed_quest
```

### Reachability Analyzer

Finds content that exists but can never be encountered:

```bash
mix loka.test.validate --only reachability
```

**Errors:**
- `unobtainable_item` - Item has no source (quest, shop, drop, craft, world, or dialogue)
- `unreachable_npc` - NPC spawns only in unreachable rooms
- `unreachable_quest_giver` - Quest giver is inaccessible
- `unreachable_gathering_node` - Gathering node in orphaned room

**Warnings:**
- `item_only_from_quest` - Item only obtainable from one quest
- `item_only_from_craft` - Item only obtainable via crafting
- `item_only_from_drop` - Item only obtainable as NPC drop
- `npc_in_single_room` - NPC appears in only one room

### Running Specific Validators

```bash
# Single validator
mix loka.test.validate --only dialogue

# Multiple validators
mix loka.test.validate --only dialogue,reachability

# Skip validators
mix loka.test.validate --skip prototype

# Strict mode (warnings = failures)
mix loka.test.validate --strict

# Quiet mode (minimal output)
mix loka.test.validate --quiet
```

---

## Bot Spectator Mode

Watch bots play through the game in real-time via the web interface.

### Accessing the Spectator

Navigate to `/admin/bot` (requires admin role).

### Features

1. **Strategy Selection**
   - **Storyline Runner**: Plays through a complete storyline
   - **Random Walker**: Explores the world randomly

2. **Configuration**
   - Select storyline to run
   - Adjust tick speed (100ms - 3000ms between actions)

3. **Real-time Display**
   - Current room and actions
   - Quest progress (for StorylineRunner)
   - Errors and warnings
   - Action log with timestamps

4. **Controls**
   - Start/Stop bot
   - Pause/Resume execution
   - Clear action log

### Use Cases

- **Quest Validation**: Watch a bot attempt to complete a storyline
- **Content Discovery**: Find broken quest paths, missing NPCs
- **Balance Testing**: See how long quests take to complete
- **Demo Mode**: Show the game playing itself

---

## E2E Testing with Playwright

Browser-based end-to-end tests verify that the UI correctly interacts with the game.

### Quick Start

```bash
# Install dependencies
npm install
npx playwright install

# Export test data
mix loka.export_test_data

# Run tests (server must be running)
mix e2e
```

### Directory Structure

```
test/e2e/
├── data/                   # Exported JSON (world graph, quests)
├── fixtures/               # Playwright fixtures
│   ├── auth.ts             # Authentication helpers
│   └── game.ts             # GamePage class
├── support/                # Support modules
│   ├── selectors.ts        # Centralized UI selectors
│   ├── data-loader.ts      # Load exported JSON
│   └── storyline-runner.ts # Automated quest walkthrough
└── specs/                  # Test specifications
    ├── auth/               # Auth tests
    ├── game/               # Game feature tests
    └── storylines/         # Full storyline tests
```

### Key Components

**GamePage Fixture** (`fixtures/game.ts`)

High-level methods for game interactions:

```typescript
const game = new GamePage(page);

await game.navigate('north');           // Move direction
await game.talkToNpc('Abbot Jampa');    // Start dialogue
await game.acceptQuest();               // Accept quest
await game.pickUpItem('sword');         // Pick up item
await game.attackEnemy('goblin');       // Attack enemy
await game.expectQuestActive('quest1'); // Assert quest state
```

**StorylineRunner** (`support/storyline-runner.ts`)

Automated quest walkthrough (Playwright equivalent of bot StorylineRunner):

```typescript
const runner = new StorylineRunner(page, game, 'monastery_arc', { verbose: true });
runner.setCurrentRoom('monastery_gate');
await runner.runStoryline();  // Complete all quests
```

### Running Tests

```bash
mix e2e                      # All tests
mix e2e --ui                 # Interactive UI
mix e2e --headed             # Visible browser
mix e2e --grep="navigation"  # Filter tests
```

### Writing Tests

```typescript
import { test, expect } from '@playwright/test';
import { GamePage } from '../../fixtures/game';

test('can navigate and talk to NPC', async ({ page }) => {
  const game = new GamePage(page);
  await game.goto();

  await game.navigate('north');
  await game.talkToNpc('Abbot Jampa');
  await game.expectInDialogue();
});
```

---

## CI Integration

### Recommended CI Pipeline

```yaml
# .github/workflows/test.yml
jobs:
  test:
    steps:
      - name: Unit Tests
        run: mix test

      - name: Content Validation
        run: mix loka.test.validate --strict

      - name: Storyline E2E
        run: mix test test/integration/storyline_channel_test.exs

      - name: Balance Check
        run: mix loka.test.balance --quick
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

cd server

echo "Checking formatting..."
mix format --check-formatted || exit 1

echo "Running quick validation..."
mix loka.test.validate --quiet || exit 1

exit 0
```

---

## Module Reference

| Module | Purpose |
|--------|---------|
| `Loka.Testing.Bot.ChannelBot` | Channel-based bot using Phoenix.ChannelTest (recommended) |
| `Loka.Testing.Bot.StateInspector` | Direct state access for debugging/assertions |
| `Loka.Testing.Bot.BotSupervisor` | DynamicSupervisor for bots |
| `Loka.ChannelCase` | Test case helper for ChannelBot tests |
| `Loka.Testing.Bot.Strategy` | Strategy behaviour + helpers |
| `Loka.Testing.Bot.Assertions` | Test assertions |
| `Loka.Testing.Bot.TestReporter` | Result collection/formatting |
| `Loka.Testing.Bot.Strategies.RandomWalker` | Random exploration |
| `Loka.Testing.Bot.Strategies.StorylineRunner` | Storyline completion |
| `Loka.Testing.Bot` | Legacy bot GenServer (deprecated) |
| `Loka.Testing.Bot.BotActions` | Legacy action execution (deprecated) |
| `Loka.Testing.QuestStrategy` | Single source of truth for quest logic |
| `Loka.Testing.TestData` | Shared test data (world graph, quests) |
| `Loka.Testing.Balance.CombatSimulator` | Monte Carlo combat |
| `Loka.Testing.Balance.ProgressionSimulator` | XP curve analysis |
| `Loka.Testing.Balance.ReportGenerator` | Report output |
| `Loka.Testing.Content.WorldValidator` | Room connectivity |
| `Loka.Testing.Content.QuestValidator` | Quest completability |
| `Loka.Testing.Content.DialogueValidator` | Dialogue tree integrity |
| `Loka.Testing.Content.ReachabilityAnalyzer` | Content accessibility |
| `Loka.Testing.Content.PrototypeLinter` | YAML validation |
| `Mix.Tasks.Loka.Test.Storyline` | Storyline test task |
| `Mix.Tasks.Loka.Test.Validate` | Content validation task |
| `Mix.Tasks.Loka.Test.Balance` | Balance analysis task |

## Best Practices

1. **Run `mix loka.test` before pushing** - Catches content issues early
2. **Use `--quick` during development** - Full balance runs take time
3. **Add storyline tests for new quests** - Ensures they're completable
4. **Check validator output in CI** - Prevents broken content from merging
5. **Use `--strict` in CI** - Treat warnings as errors in production
6. **Define assertions for validation** - Make expected outcomes explicit
7. **Track progress with TestReporter** - Record significant events for debugging

## Related

- [Entity System](./entity-system.md) - Entity structure bots interact with
- [Prototypes](./prototypes.md) - YAML content validated by linter
- [Commands](./commands.md) - Command pipeline bots exercise
- [Storylines](./storylines.md) - Storyline system for storyline validation
