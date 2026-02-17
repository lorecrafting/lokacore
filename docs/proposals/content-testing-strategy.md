# Proposal: Comprehensive Content Testing Strategy

**Date:** 2026-02-15
**Status:** Draft
**Author:** Raymond Luong

## Problem

Loka has two testing layers with a gap between them:

1. **Static validators** (`mix loka.test.validate`) — verify data integrity (references exist, types valid, no orphans)
2. **E2E storyline bot** (`storyline_channel_test.exs`) — one bot walks the entire monastery arc via ChannelBot

The gap: validators prove content is *well-formed*, the E2E bot proves the main path is *completable*, but nothing tests **failure paths, edge cases, branching, concurrency, or balance** systematically.

## Current State

| Layer | What It Tests | Coverage | Parity |
|-------|--------------|----------|--------|
| Content Validators (10 modules) | References, reachability, dialogue graphs, quest chains | Static only | N/A |
| QuestTester (deprecated) | Quest state transitions | Happy path | 40% (direct calls) |
| ChannelBot E2E | Full storyline walkthrough | 1 storyline, 1 path | 95% (real channel) |
| Unit tests | Individual quest/dialogue functions | Per-function | 100% |

### Key Gaps

1. **No failure path testing** — What happens when a player drops a quest item? Dies mid-quest? Abandons and re-accepts?
2. **No branch coverage** — Dialogue trees have conditional nodes. Only the "accept quest" path is tested.
3. **No concurrent player testing** — Two players doing the same quest simultaneously.
4. **No chaos/fuzz testing** — Random actions during quests to find state corruption.
5. **No balance validation** — Reward rates, XP curves, gold economy are untested.
6. **No timer testing** — Timed objectives and offline progression untested via E2E.

## Proposed Strategy: 5 Tiers

### Tier 1: Strengthen Static Validators (Low effort, high value)

**Goal:** Catch content bugs at build time, before any process starts.

**New validations to add:**

| Validator | New Check | Why |
|-----------|-----------|-----|
| DialogueQuestChain | Every dialogue path to `accept_quest` is reachable from start | Current check only verifies action *exists*, not that it's *reachable* via valid choices |
| DialogueQuestChain | Turn-in dialogue node is reachable when `quest_complete` condition is true | Ensures players can actually turn in completed quests |
| QuestValidator | `go_to` objective rooms are reachable from quest giver room (BFS) | Catches quests sending players to disconnected rooms |
| QuestValidator | `talk` objectives with `dialogue_topic` verify that node exists in NPC's dialogue tree | Catches topic/node ID mismatches |
| ReachabilityAnalyzer | Recipe ingredient chains — all ingredients obtainable | Catches unobtainable crafting recipes |
| StorylineValidator | Quest order within acts is achievable (giver locations reachable in sequence) | Catches act ordering issues |

**Implementation:** Add methods to existing validator modules, wire into `mix loka.test.validate`.

**Estimated effort:** 2-3 days.

---

### Tier 2: Quest State Machine Tests (Medium effort, high value)

**Goal:** Verify every quest handles all state transitions correctly, including error paths.

**Approach:** Property-based testing on the quest state machine. For each quest definition, generate test cases that exercise:

```
For each quest Q:
  1. Accept Q                          → assert active
  2. Accept Q again                    → assert {:error, :already_active}
  3. Complete all objectives, turn in  → assert completed, rewards applied
  4. Turn in incomplete                → assert {:error, :quest_not_complete}
  5. Abandon Q                         → assert removed from active
  6. Re-accept after abandon           → assert active, objectives reset
  7. Accept without prerequisites      → assert {:error, :missing_prerequisites}
  8. Complete with timed objective      → assert timer started
  9. Let timer expire                  → assert objective expired
  10. Objective progress after complete → assert no-op (idempotent)
```

**Implementation:** New module `Loka.Testing.Quest.StateMachineTest` that generates ExUnit test cases from quest YAML definitions. Uses `Content.Quest.list_all()` to discover quests, generates the 10 scenarios above for each.

```elixir
# Generates ~10 tests per quest, ~20 quests = ~200 test cases
defmodule Loka.Testing.Quest.StateMachineTest do
  use Loka.DataCase, async: false

  for quest <- Content.Quest.list_all() do
    describe "#{quest.key}" do
      test "accept → complete → turn_in" do ...
      test "double accept rejected" do ...
      test "abandon resets state" do ...
      test "prerequisites enforced" do ...
    end
  end
end
```

**Estimated effort:** 3-4 days.

---

### Tier 3: Dialogue Branch Coverage (Medium effort, medium value)

**Goal:** Every reachable dialogue path is walked. Every choice is selected at least once.

**Approach:** Graph traversal bot that exhaustively explores dialogue trees.

For each NPC with a dialogue tree:
1. BFS all reachable nodes from every valid start node (considering `show_if` conditions)
2. For each reachable choice, create a test case that navigates to it
3. Verify: no crashes, actions execute without error, quest state changes are valid

**Implementation:** New module `Loka.Testing.Content.DialogueCoverageTest`.

```elixir
# For each NPC dialogue tree:
#   1. Enumerate all start nodes (per quest state combinations)
#   2. BFS all paths through choices
#   3. For each path, simulate via Dialogue.start/select_choice
#   4. Assert no errors, verify side effects

defmodule Loka.Testing.Content.DialogueCoverageTest do
  for {npc_key, tree} <- all_dialogue_trees() do
    for path <- enumerate_paths(tree) do
      test "#{npc_key}: #{path_description(path)}" do
        # Walk the path, assert no errors
      end
    end
  end
end
```

**Key detail:** Dialogue choices are filtered by quest state, items held, time of day. We need to test with multiple "player state snapshots":
- Fresh player (no quests)
- Player with quest active
- Player with quest complete (ready to turn in)
- Player with quest already turned in

**Estimated effort:** 4-5 days.

---

### Tier 4: Chaos Bot (Higher effort, high value for regression)

**Goal:** Random player actions during quests to find state corruption, crashes, and edge cases.

**Approach:** ChannelBot with a `ChaoticStrategy` that randomly interleaves valid actions with disruptive ones.

**Action pool:**
```
Normal:        move, talk, look, get, drop, attack, use, equip
Disruptive:    abandon_quest, logout/reconnect, die, move_to_random_room
               drop_quest_item, start_dialogue_then_move, spam_same_action
```

**Implementation:**

```elixir
defmodule Loka.Testing.Bot.ChaoticStrategy do
  @disruptive_actions [
    :abandon_active_quest,
    :drop_random_item,
    :move_random_direction,
    :rapid_dialogue_exit,
    :double_click_entity,
  ]

  def decide(bot_state) do
    if :rand.uniform() < 0.2 do
      Enum.random(@disruptive_actions)
    else
      QuestStrategy.decide(bot_state)
    end
  end
end
```

**Success criteria:** Bot runs 1000 ticks without:
- Uncaught exceptions
- Quest state corruption (active quest with impossible objective state)
- Entity server crashes
- Channel disconnection

**Test structure:**
```elixir
test "chaos bot survives 1000 ticks on monastery_arc" do
  {:ok, bot} = ChannelBot.start(player, strategy: ChaoticStrategy)
  {:ok, bot} = ChannelBot.run(bot, ticks: 1000)
  assert bot.errors == []
  assert bot.crashes == []
end
```

**Estimated effort:** 5-7 days.

---

### Tier 5: Economy & Balance Simulation (Higher effort, long-term value)

**Goal:** Monte Carlo simulation of many players completing content to validate economy balance.

**Approach:** Run N simulated player-runs through content, collect statistics, assert invariants.

**Metrics to track:**
```
Per quest:
  - Average completion time (ticks)
  - Success rate
  - Gold awarded
  - XP awarded
  - Items awarded

Aggregate:
  - Gold earned per hour (across all quests)
  - XP curve (level vs time)
  - Item rarity distribution
  - Bottleneck quests (high failure rate)
```

**Invariants to assert:**
```
- No quest awards more gold than X per minute of expected play time
- XP curve follows target progression (level 1→5 in ~2 hours)
- No item is unobtainable (every item has at least one source)
- No quest has >10% abandon rate in simulation
```

**Implementation:** Mix task `mix loka.test.balance` that runs simulations and outputs a report.

```elixir
defmodule Mix.Tasks.Loka.Test.Balance do
  def run(_args) do
    results = for _i <- 1..100 do
      {:ok, bot} = ChannelBot.start(fresh_player(), strategy: QuestStrategy)
      {:ok, bot} = ChannelBot.run(bot, ticks: 5000)
      collect_metrics(bot)
    end

    report = aggregate(results)
    assert_invariants(report)
    print_report(report)
  end
end
```

**Estimated effort:** 7-10 days (includes metric collection infrastructure).

---

## Implementation Priority

| Tier | Effort | Value | Priority | Depends On |
|------|--------|-------|----------|------------|
| 1. Strengthen Validators | 2-3 days | High | **Do first** | Nothing |
| 2. Quest State Machine | 3-4 days | High | **Do second** | Nothing |
| 3. Dialogue Branch Coverage | 4-5 days | Medium | Third | Tier 1 (validator fixes) |
| 4. Chaos Bot | 5-7 days | High | Fourth | Tier 2 (state machine correctness) |
| 5. Balance Simulation | 7-10 days | Long-term | Later | Tier 4 (chaos bot infra) |

**Total estimated: ~25 days for all 5 tiers.**

Tiers 1-2 alone (~6 days) would dramatically improve content quality confidence. They catch the most common bugs: broken references, impossible quest states, missing prerequisites.

## Integration with CI

```
Pre-commit:     mix loka.validate.yaml (syntax only, fast)
Pre-push:       mix loka.test.validate --quick (static validators, ~10s)
CI (test.yml):  mix loka.test (unit + Tier 1 validators + Tier 2 state machine)
CI (nightly):   mix loka.test.chaos (Tier 4 chaos bot, ~5 min)
CI (weekly):    mix loka.test.balance (Tier 5 simulation, ~30 min)
```

## Migration Plan

1. **Deprecate QuestTester** — Replace all usages with ChannelBot-based tests
2. **Deprecate legacy Bot** — Only ChannelBot for E2E
3. **Deprecate `mix loka.test.quest`** — Replace with generated state machine tests
4. **`mix loka.test.storyline` removed** — Replaced by `mix test test/integration/storyline_channel_test.exs` (ChannelBot E2E)

## Prerequisite: Shared StateMachine Engine

Before Tier 2 can generate meaningful tests, quests need explicit state tracking. This is implemented as part of V2 Phase 7.3:

- **`Loka.Engine.StateMachine`** — shared, reusable state machine (no deps, no macros, pure data)
- Used by 7 systems: quests, combat, crafting, dialogue, NPC AI, player sessions, entity lifecycle
- See `docs/v2-migration/phase-7-polish.md` Task 7.3 for full spec

The state machine gives Tier 2 tests something concrete to assert against — instead of checking map positions, tests verify explicit state transitions.

## Open Questions

1. **Tier 4 parallelism:** ChannelBot is synchronous. Can we run multiple chaos bots in parallel with separate DB sandboxes?
2. **Tier 5 realism:** Should balance simulation use real timing (seconds) or tick-based (actions)?
3. **Content creator feedback loop:** Should validators produce machine-readable output for the builder terminal?
