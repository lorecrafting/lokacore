# Phase 7: Polish

> Full spec: `docs/architecture/unified-object-system-v2.md` Section 17 (Component Accessors) + Section 29 (Behavior Code) + Section 20 (Testing Patterns)
> **Can overlap with Phase 6**

## Task 7.1: Create Component Accessor Modules (23 modules)

Create `lib/loka/components/*.ex`. Each module is ~15 lines of boilerplate providing typed access to a specific component:

```elixir
defmodule Loka.Components.Combatant do
  @component_key "combatant"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)
  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}
  def component_key, do: @component_key

  # Domain-specific accessors:
  def health(entity), do: get_in(entity.components, [@component_key, "health"]) || 0
  def max_health(entity), do: get_in(entity.components, [@component_key, "max_health"]) || 0
  def set_health(entity, val),
    do: put_in(entity.components, [@component_key, "health"], val) |> then(&%{entity | components: &1})
  def alive?(entity), do: health(entity) > 0
  def heal(entity, amount), do: set_health(entity, min(health(entity) + amount, max_health(entity)))
end
```

### Component List (23 modules)

| Module | Key | Domain |
|--------|-----|--------|
| `combatant.ex` | `"combatant"` | health, attack, defense |
| `player.ex` | `"player"` | settings, character_name |
| `stats.ex` | `"stats"` | str, dex, sta, level |
| `quest_progress.ex` | `"quest_progress"` | active, completed, failed |
| `quest_def.ex` | `"quest"` | objectives, rewards, giver |
| `skills.ex` | `"skills"` | learned skill list |
| `resources.ex` | `"resources"` | gold, xp, mana |
| `equipment.ex` | `"equipment"` | slot → entity UUID map |
| `room.ex` | `"room"` | spawns config |
| `coordinates.ex` | `"coordinates"` | x, y, z |
| `exit.ex` | `"exit"` | direction, destination |
| `physical.ex` | `"physical"` | weight, stackable |
| `weapon.ex` | `"weapon"` | damage, type, speed |
| `armor.ex` | `"armor"` | defense, type |
| `container.ex` | `"container"` | capacity, locked |
| `dialogue_tree.ex` | `"dialogue_tree"` | nodes, options |
| `zone_config.ex` | `"zone"` | level_range, theme |
| `skill_def.ex` | `"skill_def"` | cooldown, cost, effects |
| `recipe_def.ex` | `"recipe"` | ingredients, output |
| `emotes.ex` | `"emotes"` | idle, combat, greeting |
| `spawnable.ex` | `"spawnable"` | respawn_time, max_instances |
| `tick.ex` | `"tick"` | interval (single source of truth) |
| `service.ex` | `"service"` | boot_priority for system entities |
| `locks.ex` | `"locks"` | access control rules |

**Decision 34:** Start without a macro. Write all 23 as plain modules. Extract a `use Loka.Component` macro only if the boilerplate proves painful.

### Tests

Create `test/loka/components/*_test.exs` — one per module, `async: true` since these are pure functions operating on structs.

## Task 7.2: Create New Behavior Modules

System entity behaviors that replace V1 framework modules:

### Weather (`lib/loka/behaviors/weather.ex`)
- Replaces `Loka.Framework.World.Weather` (deleted in Phase 6)
- Implements `EntityBehavior` callbacks
- `on_tick`: advance weather, broadcast changes
- Uses volatile state for calculation cache

### DayNight (`lib/loka/behaviors/day_night.ex`)
- Replaces `Loka.Framework.World.DayNight`
- `on_tick`: advance time, emit `:time_change` events

### NpcAmbient (`lib/loka/behaviors/npc_ambient.ex`)
- Replaces `Loka.Framework.World.NpcAmbient.Scheduler`
- `on_tick`: emit random idle emotes from entity's `components["emotes"]["idle"]`

### RoomAmbient (`lib/loka/behaviors/room_ambient.ex`)
- Replaces `Loka.Framework.World.RoomAmbient.Scheduler`
- `on_tick`: emit atmospheric messages to room occupants

### Tests

Create `test/loka/behaviors/*_test.exs` using Pattern F from Section 20:

```elixir
# Pattern F: Behavior unit test
test "weather on_tick advances weather state" do
  entity = create_system_entity("weather", %{
    "weather" => %{"current" => "clear", "transition_timer" => 0}
  })

  {:ok, updated} = Weather.on_tick(entity)
  # Assert weather advanced or stayed the same
end
```

## Task 7.3: StateMachine Engine + Content Testing

### 7.3a: `Loka.Engine.StateMachine` — Shared State Machine Module

A lightweight, reusable state machine for any entity component. No external deps, no macros, just a data structure and transition function.

**Creates:** `lib/loka/engine/state_machine.ex`

```elixir
defmodule Loka.Engine.StateMachine do
  @moduledoc """
  Lightweight state machine for entity components.

  Used by: quests, combat, crafting, dialogue, NPC AI, player sessions, entity lifecycle.

  ## Defining a machine

      @quest_machine StateMachine.new(%{
        initial: "available",
        transitions: %{
          "available"            => ["accepted"],
          "accepted"            => ["in_progress", "abandoned"],
          "in_progress"         => ["objectives_complete", "abandoned", "failed"],
          "objectives_complete" => ["turned_in", "abandoned"],
          "abandoned"           => ["accepted"],
          "failed"              => ["accepted"],
        }
      })

  ## Transitioning

      {:ok, "in_progress"} = StateMachine.transition(@quest_machine, "accepted", "in_progress")
      {:error, {:invalid_transition, "accepted", "turned_in"}} =
        StateMachine.transition(@quest_machine, "accepted", "turned_in")

  ## With callbacks (optional)

      @quest_machine StateMachine.new(%{
        initial: "available",
        transitions: %{...},
        on_enter: %{
          "accepted" => :on_quest_accepted,
          "turned_in" => :on_quest_turned_in,
        },
        on_exit: %{
          "in_progress" => :on_leave_in_progress,
        }
      })

      # Callbacks return list of side-effect atoms for the caller to handle
      {:ok, "in_progress", callbacks} = StateMachine.transition_with_callbacks(machine, "accepted", "in_progress")
      # callbacks = [exit: :on_leave_accepted, enter: :on_quest_in_progress]
  """

  @type t :: %__MODULE__{
    initial: String.t(),
    transitions: %{String.t() => [String.t()]},
    on_enter: %{String.t() => atom()},
    on_exit: %{String.t() => atom()},
    states: MapSet.t(String.t())
  }

  defstruct [:initial, :transitions, :on_enter, :on_exit, :states]

  @doc "Create a new state machine definition."
  def new(opts) do
    transitions = opts.transitions
    all_states =
      transitions
      |> Enum.flat_map(fn {from, tos} -> [from | tos] end)
      |> MapSet.new()

    %__MODULE__{
      initial: opts[:initial] || List.first(Map.keys(transitions)),
      transitions: transitions,
      on_enter: opts[:on_enter] || %{},
      on_exit: opts[:on_exit] || %{},
      states: all_states
    }
  end

  @doc "Check if a transition is valid."
  def can_transition?(%__MODULE__{} = machine, from, to) do
    to in Map.get(machine.transitions, from, [])
  end

  @doc "Attempt a transition. Returns {:ok, new_state} or {:error, reason}."
  def transition(%__MODULE__{} = machine, current, target) do
    if can_transition?(machine, current, target) do
      {:ok, target}
    else
      {:error, {:invalid_transition, current, target}}
    end
  end

  @doc "Transition with callback atoms. Returns {:ok, new_state, callbacks} or {:error, reason}."
  def transition_with_callbacks(%__MODULE__{} = machine, current, target) do
    case transition(machine, current, target) do
      {:ok, new_state} ->
        callbacks =
          []
          |> maybe_add(:exit, Map.get(machine.on_exit, current))
          |> maybe_add(:enter, Map.get(machine.on_enter, target))
        {:ok, new_state, callbacks}

      error -> error
    end
  end

  @doc "List all valid transitions from a state."
  def available_transitions(%__MODULE__{} = machine, from) do
    Map.get(machine.transitions, from, [])
  end

  @doc "Check if a state is terminal (no outgoing transitions)."
  def terminal?(%__MODULE__{} = machine, state) do
    available_transitions(machine, state) == []
  end

  @doc "All defined states."
  def states(%__MODULE__{} = machine), do: machine.states

  defp maybe_add(list, _type, nil), do: list
  defp maybe_add(list, type, callback), do: list ++ [{type, callback}]
end
```

**Tests:** `test/loka/engine/state_machine_test.exs`

```elixir
# Tests:
# - Valid transitions succeed
# - Invalid transitions return {:error, {:invalid_transition, from, to}}
# - can_transition?/3
# - available_transitions/2
# - terminal?/2
# - on_enter/on_exit callbacks returned correctly
# - initial state
# - states/1 returns all defined states
```

### 7.3b: State Machine Definitions for 7 Systems

Each system defines its machine as a module attribute. The `StateMachine` struct is pure data — no processes, no GenServer, no side effects.

**Quest Progress** — `lib/loka/components/quest_progress.ex`:
```elixir
@machine StateMachine.new(%{
  initial: "available",
  transitions: %{
    "available"            => ["accepted"],
    "accepted"            => ["in_progress", "abandoned"],
    "in_progress"         => ["objectives_complete", "abandoned", "failed"],
    "objectives_complete" => ["turned_in", "abandoned"],
    "abandoned"           => ["accepted"],
    "failed"              => ["accepted"],
  },
  on_enter: %{
    "accepted" => :start_objective_timers,
    "turned_in" => :apply_rewards,
    "failed" => :cleanup_quest_items,
  }
})
```

**Combat** — `lib/loka/components/combatant.ex`:
```elixir
@machine StateMachine.new(%{
  initial: "idle",
  transitions: %{
    "idle"        => ["engaged"],
    "engaged"     => ["defending", "fleeing", "dead", "idle"],
    "defending"   => ["engaged", "fleeing", "dead", "idle"],
    "fleeing"     => ["idle", "dead"],
    "dead"        => ["respawning"],
    "respawning"  => ["idle"],
  }
})
```

**Crafting** — `lib/loka/components/recipe_def.ex` (or new `crafting_session.ex`):
```elixir
@machine StateMachine.new(%{
  initial: "idle",
  transitions: %{
    "idle"      => ["gathering", "crafting"],
    "gathering" => ["crafting", "idle"],
    "crafting"  => ["complete", "failed"],
    "complete"  => ["idle"],
    "failed"    => ["idle"],
  }
})
```

**NPC AI** — `lib/loka/engine/entity_behavior.ex`:
```elixir
@machine StateMachine.new(%{
  initial: "idle",
  transitions: %{
    "idle"      => ["patrolling", "alert"],
    "patrolling"=> ["alert", "idle"],
    "alert"     => ["pursuing", "idle"],
    "pursuing"  => ["attacking", "returning"],
    "attacking" => ["pursuing", "returning", "idle"],
    "returning" => ["idle", "alert"],
  }
})
```

**Player Session** — `lib/loka/session/server.ex`:
```elixir
@machine StateMachine.new(%{
  initial: "connecting",
  transitions: %{
    "connecting"    => ["authenticated", "disconnected"],
    "authenticated" => ["in_game", "disconnected"],
    "in_game"       => ["in_bardo", "disconnected"],
    "in_bardo"      => ["in_game", "disconnected"],
    "disconnected"  => ["connecting"],
  }
})
```

**Dialogue Session** (transient, not persisted):
```elixir
@machine StateMachine.new(%{
  initial: "idle",
  transitions: %{
    "idle"             => ["active"],
    "active"           => ["awaiting_choice", "ended"],
    "awaiting_choice"  => ["active", "ended"],
    "ended"            => ["idle"],
  }
})
```

**Entity Lifecycle** — `lib/loka/engine/entity_server.ex`:
```elixir
@machine StateMachine.new(%{
  initial: "loading",
  transitions: %{
    "loading"     => ["alive", "error"],
    "alive"       => ["despawning", "error"],
    "despawning"  => ["saved"],
    "saved"       => [],  # terminal
    "error"       => ["loading"],  # retry
  }
})
```

**Note:** Not all 7 need to be wired in immediately. Quest is the priority. The others are defined as module attributes and wired in incrementally as each system is touched.

### 7.3c: Content Testing Strategy (Tiers 1-2)

Implement the first two tiers from `docs/proposals/content-testing-strategy.md`:

**Tier 1 — Strengthen Validators:**
Add 6 new static checks to existing validator modules:
1. `DialogueQuestChainValidator` — dialogue path to `accept_quest` is BFS-reachable
2. `DialogueQuestChainValidator` — turn-in node reachable when `quest_complete` is true
3. `QuestValidator` — `go_to` rooms reachable from giver (BFS)
4. `QuestValidator` — `talk` objectives validate `dialogue_topic` node exists
5. `ReachabilityAnalyzer` — recipe ingredient chains all obtainable
6. `StorylineValidator` — quest order within acts achievable

**Tier 2 — Quest State Machine Tests:**
Auto-generate test cases from quest definitions:
```elixir
# Creates: test/loka/testing/quest/state_machine_test.exs
# For each quest: 10 scenarios (accept, double-accept, abandon, re-accept,
#   prerequisites, timed expire, turn-in incomplete, complete, idempotent progress)
# ~200 generated test cases
```

**Verify:** `mix test test/loka/testing/quest/state_machine_test.exs`
**Commit:** `"feat(v2): quest state machine + dialogue states + content testing tiers 1-2"`

---

## Task 7.4: Final Integration Tests + Docs

### Full Test Suite

```bash
mix test                          # all tests green
mix loka.test --quick             # validators pass
mix loka.test.validate            # content integrity
```

### Documentation Updates

- Update `CLAUDE.md` to reflect V2 architecture
- Update `docs/architecture/` docs
- Update `docs/builder-reference/` for V2 builder patterns
- Remove references to TypedObject, GameState, registries, dual-store sync

### Test Infrastructure Verification

Confirm simplifications from V2:
- No more `TypedObjectSandbox.checkout()` in tests
- No more `TestCleanup` draft file cleanup
- No more `TypedObject.Loader.reload()` in `on_exit`
- Many tests can now be `async: true` (component tests, pure function tests)
- Ecto sandbox handles all test isolation
