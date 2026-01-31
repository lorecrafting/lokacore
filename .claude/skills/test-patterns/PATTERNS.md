# Test Patterns

## Test Structure

### Use describe blocks for grouping
```elixir
describe "start_conversation/2" do
  test "starts dialogue with NPC" do
    # Test code
  end

  test "returns error when NPC not found" do
    # Test code
  end
end
```

### Setup-Execute-Assert Pattern
```elixir
test "completes talk objective" do
  # Setup
  player = create_test_player()
  game_state = create_game_state_with_quest("intro_welcome")
  ctx = %Context{player_id: player.id, game_state: game_state}

  # Execute
  {:ok, result} = Dialogue.start_conversation(ctx, "novice_pema")

  # Assert
  assert result.state.game_state.quests["intro_welcome"].objectives["talk_pema"].completed
end
```

## Bot Testing

### ChannelBot Pattern
```elixir
test "bot completes quest objective" do
  player = create_test_player()

  {:ok, bot} = ChannelBot.start(player,
    strategy: QuestStrategy,
    strategy_opts: [storyline_id: "monastery_arc"]
  )

  {:ok, bot} = ChannelBot.run(bot, ticks: 50)

  info = ChannelBot.get_info(bot)
  assert length(info.strategy_state.results.objectives_achieved) >= 1

  :ok = ChannelBot.stop(bot)
end
```

### Strategy Testing
```elixir
test "strategy decides to talk to NPC" do
  context = %{
    room: %{id: "room1", entities: [%{key: "novice_pema", type: :npc}]},
    game_state: game_state_with_talk_objective(),
    dialogue_state: nil
  }

  strategy_state = QuestStrategy.init([storyline_id: "monastery_arc"])

  {action, _new_state} = QuestStrategy.decide(context, strategy_state)

  assert action == {:start_dialogue, "novice_pema"}
end
```

## Assertions

### Use specific assertions
```elixir
# Good
assert result == :ok
assert length(list) == 3
assert map.field == "expected"
assert_receive {:event, _}, 1000

# Avoid
assert result  # Too vague
assert list    # What are we asserting?
```

### Pattern match in assertions
```elixir
assert {:ok, %{quest_id: "intro_welcome"}} = accept_quest(state, "intro_welcome")
assert [%{type: :talk} | _rest] = quest.objectives
```

## Test Data

### Use factory functions
```elixir
def create_test_player do
  {:ok, player} = Accounts.register_player(%{
    name: "TestPlayer#{:rand.uniform(1000)}",
    email: "test#{:rand.uniform(1000)}@test.com",
    password: "test123456"
  })
  player
end

def create_game_state_with_quest(quest_id) do
  GameState.new()
  |> Quest.accept_quest(quest_id)
  |> elem(1)  # Extract state from {:ok, state}
end
```

## Async Safety

### Mark tests as async when safe
```elixir
# Safe - no shared state
use Loka.DataCase, async: true

# Unsafe - uses ChannelBot (must be serial)
use Loka.ChannelCase, async: false
```

## File Cleanup

### Tests that create files must use on_exit cleanup

Tests that create YAML files in `priv/world/` must use `setup_all` with `on_exit` to ensure cleanup runs even when tests fail:

```elixir
setup_all do
  on_exit(fn ->
    Loka.TestCleanup.cleanup_room_test_files()
    Loka.TestCleanup.cleanup_npc_test_files()
  end)
  :ok
end
```

**Never use inline cleanup** - it doesn't run if the test fails before reaching it:

```elixir
# ❌ WRONG - cleanup won't run if test fails
test "creates entity" do
  {:ok, entity} = create_entity(%{key: "test_123"})
  assert entity.key == "test_123"
  File.rm("priv/world/prototypes/npcs/test_123.yml")  # Never runs on failure!
end
```

See `.claude/skills/test-file-cleanup-pattern.md` for full details.
