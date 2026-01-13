defmodule Loka.Framework.CompanionTest do
  # async: false to avoid SQLite "Database busy" errors
  use Loka.DataCase, async: false

  alias Loka.Framework.Companion
  alias Loka.Framework.Player.GameState

  import Loka.AccountsFixtures

  # Helper to create a game state for testing
  defp game_state_fixture(player_id, attrs \\ %{}) do
    {:ok, state} = GameState.create_state(player_id)

    if map_size(attrs) > 0 do
      {:ok, state} = GameState.update_state(state, attrs)
      state
    else
      state
    end
  end

  describe "get_companion/1" do
    test "returns nil when player has no companion" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Companion.get_companion(state) == nil
    end

    test "returns companion state when player has a companion" do
      player = player_fixture()
      {:ok, state} = GameState.create_state(player.id)

      companion_data = %{
        key: "wolf",
        name: "Shadow",
        loyalty: 75,
        hunger: 80,
        happiness: 90,
        mode: :following,
        inventory: [],
        summoned_at: System.system_time(:second)
      }

      stats = Map.put(state.stats, :companion, companion_data)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      companion = Companion.get_companion(state)
      assert companion != nil
      assert companion.key == "wolf"
      assert companion.name == "Shadow"
      assert companion.loyalty == 75
    end
  end

  describe "acquire/3" do
    test "acquires a new companion with default values" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:ok, updated_state} = Companion.acquire(state, "wolf")

      companion = Companion.get_companion(updated_state)
      assert companion != nil
      assert companion.key == "wolf"
      assert companion.name == "wolf"
      assert companion.loyalty == 50
      assert companion.hunger == 100
      assert companion.happiness == 100
      assert companion.mode == :following
      assert companion.inventory == []
      assert is_integer(companion.summoned_at)
    end

    test "acquires a companion with custom name" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:ok, updated_state} = Companion.acquire(state, "wolf", "Shadow")

      companion = Companion.get_companion(updated_state)
      assert companion.key == "wolf"
      assert companion.name == "Shadow"
    end

    test "returns error when player already has a companion" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      {:ok, state} = Companion.acquire(state, "wolf", "First")
      assert {:error, :already_have_companion} = Companion.acquire(state, "cat", "Second")

      # Original companion still present
      companion = Companion.get_companion(state)
      assert companion.name == "First"
    end
  end

  describe "dismiss/1" do
    test "dismisses current companion" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      {:ok, state} = Companion.acquire(state, "wolf", "Shadow")
      assert Companion.get_companion(state) != nil

      assert {:ok, updated_state} = Companion.dismiss(state)
      assert Companion.get_companion(updated_state) == nil
    end

    test "returns error when player has no companion" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :no_companion} = Companion.dismiss(state)
    end
  end

  describe "rename/2" do
    test "renames the companion" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      {:ok, state} = Companion.acquire(state, "wolf", "OldName")
      assert {:ok, updated_state} = Companion.rename(state, "NewName")

      companion = Companion.get_companion(updated_state)
      assert companion.name == "NewName"
      assert companion.key == "wolf"
    end

    test "returns error when player has no companion" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :no_companion} = Companion.rename(state, "NewName")
    end
  end

  describe "command/2 and command/3" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      {:ok, state} = Companion.acquire(state, "wolf", "Shadow")

      %{state: state}
    end

    test "sets companion to following mode", %{state: state} do
      {:ok, updated_state} = Companion.command(state, :follow)

      companion = Companion.get_companion(updated_state)
      assert companion.mode == :following
    end

    test "sets companion to staying mode", %{state: state} do
      {:ok, updated_state} = Companion.command(state, :stay)

      companion = Companion.get_companion(updated_state)
      assert companion.mode == :staying
    end

    test "sets companion to guarding mode", %{state: state} do
      {:ok, updated_state} = Companion.command(state, :guard)

      companion = Companion.get_companion(updated_state)
      assert companion.mode == :guarding
    end

    test "sets companion to attacking mode with target", %{state: state} do
      target_id = "enemy_123"
      {:ok, updated_state} = Companion.command(state, :attack, target_id)

      companion = Companion.get_companion(updated_state)
      assert companion.mode == :attacking
    end

    test "returns error when player has no companion" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :no_companion} = Companion.command(state, :follow)
      assert {:error, :no_companion} = Companion.command(state, :stay)
      assert {:error, :no_companion} = Companion.command(state, :guard)
      assert {:error, :no_companion} = Companion.command(state, :attack, "target")
    end

    test "can change modes multiple times", %{state: state} do
      {:ok, state} = Companion.command(state, :follow)
      assert Companion.get_companion(state).mode == :following

      {:ok, state} = Companion.command(state, :stay)
      assert Companion.get_companion(state).mode == :staying

      {:ok, state} = Companion.command(state, :guard)
      assert Companion.get_companion(state).mode == :guarding

      {:ok, state} = Companion.command(state, :attack, "enemy")
      assert Companion.get_companion(state).mode == :attacking
    end
  end

  describe "feed/2" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      {:ok, state} = Companion.acquire(state, "wolf", "Shadow")

      # Set companion to low hunger
      companion = Companion.get_companion(state)
      low_hunger_companion = %{companion | hunger: 50, happiness: 60}
      stats = Map.put(state.stats, :companion, low_hunger_companion)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      %{state: state}
    end

    test "increases hunger and happiness when fed", %{state: state} do
      initial_companion = Companion.get_companion(state)
      initial_hunger = initial_companion.hunger
      initial_happiness = initial_companion.happiness

      assert {:ok, updated_state, message} = Companion.feed(state, "meat")

      companion = Companion.get_companion(updated_state)
      assert companion.hunger == min(100, initial_hunger + 30)
      assert companion.happiness == min(100, initial_happiness + 10)
      assert message == "Your companion happily eats the food."
    end

    test "caps hunger at 100", %{state: state} do
      companion = Companion.get_companion(state)
      high_hunger_companion = %{companion | hunger: 85}
      stats = Map.put(state.stats, :companion, high_hunger_companion)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      {:ok, updated_state, _message} = Companion.feed(state, "meat")

      companion = Companion.get_companion(updated_state)
      assert companion.hunger == 100
    end

    test "caps happiness at 100", %{state: state} do
      companion = Companion.get_companion(state)
      high_happiness_companion = %{companion | happiness: 95}
      stats = Map.put(state.stats, :companion, high_happiness_companion)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      {:ok, updated_state, _message} = Companion.feed(state, "meat")

      companion = Companion.get_companion(updated_state)
      assert companion.happiness == 100
    end

    test "returns error when player has no companion" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :no_companion} = Companion.feed(state, "meat")
    end
  end

  describe "play/1" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      {:ok, state} = Companion.acquire(state, "wolf", "Shadow")

      # Set companion to moderate happiness and loyalty
      companion = Companion.get_companion(state)
      moderate_companion = %{companion | happiness: 60, loyalty: 70}
      stats = Map.put(state.stats, :companion, moderate_companion)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      %{state: state}
    end

    test "increases happiness and loyalty when playing", %{state: state} do
      initial_companion = Companion.get_companion(state)
      initial_happiness = initial_companion.happiness
      initial_loyalty = initial_companion.loyalty

      assert {:ok, updated_state, message} = Companion.play(state)

      companion = Companion.get_companion(updated_state)
      assert companion.happiness == min(100, initial_happiness + 20)
      assert companion.loyalty == min(100, initial_loyalty + 5)
      assert message == "Your companion enjoys playing with you!"
    end

    test "caps happiness at 100", %{state: state} do
      companion = Companion.get_companion(state)
      high_happiness_companion = %{companion | happiness: 90}
      stats = Map.put(state.stats, :companion, high_happiness_companion)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      {:ok, updated_state, _message} = Companion.play(state)

      companion = Companion.get_companion(updated_state)
      assert companion.happiness == 100
    end

    test "caps loyalty at 100", %{state: state} do
      companion = Companion.get_companion(state)
      high_loyalty_companion = %{companion | loyalty: 98}
      stats = Map.put(state.stats, :companion, high_loyalty_companion)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      {:ok, updated_state, _message} = Companion.play(state)

      companion = Companion.get_companion(updated_state)
      assert companion.loyalty == 100
    end

    test "returns error when player has no companion" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :no_companion} = Companion.play(state)
    end
  end

  describe "tick_needs/2" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      {:ok, state} = Companion.acquire(state, "wolf", "Shadow")

      %{state: state}
    end

    test "decreases hunger and happiness over time", %{state: state} do
      initial_companion = Companion.get_companion(state)
      initial_hunger = initial_companion.hunger
      initial_happiness = initial_companion.happiness

      {:ok, updated_state} = Companion.tick_needs(state, 5)

      companion = Companion.get_companion(updated_state)
      assert companion.hunger == initial_hunger - 5
      assert companion.happiness == initial_happiness - div(5, 2)
    end

    test "does not decrease loyalty when needs are met", %{state: state} do
      initial_companion = Companion.get_companion(state)
      initial_loyalty = initial_companion.loyalty

      {:ok, updated_state} = Companion.tick_needs(state, 5)

      companion = Companion.get_companion(updated_state)
      assert companion.loyalty == initial_loyalty
    end

    test "decreases loyalty when hunger is critically low", %{state: state} do
      companion = Companion.get_companion(state)
      low_hunger_companion = %{companion | hunger: 15, loyalty: 80}
      stats = Map.put(state.stats, :companion, low_hunger_companion)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      {:ok, updated_state} = Companion.tick_needs(state, 5)

      companion = Companion.get_companion(updated_state)
      assert companion.loyalty == 79
    end

    test "decreases loyalty when happiness is critically low", %{state: state} do
      companion = Companion.get_companion(state)
      low_happiness_companion = %{companion | happiness: 15, loyalty: 80}
      stats = Map.put(state.stats, :companion, low_happiness_companion)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      {:ok, updated_state} = Companion.tick_needs(state, 5)

      companion = Companion.get_companion(updated_state)
      assert companion.loyalty == 79
    end

    test "does not decrease hunger below 0", %{state: state} do
      companion = Companion.get_companion(state)
      low_hunger_companion = %{companion | hunger: 3}
      stats = Map.put(state.stats, :companion, low_hunger_companion)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      {:ok, updated_state} = Companion.tick_needs(state, 10)

      companion = Companion.get_companion(updated_state)
      assert companion.hunger == 0
    end

    test "does not decrease happiness below 0", %{state: state} do
      companion = Companion.get_companion(state)
      low_happiness_companion = %{companion | happiness: 1}
      stats = Map.put(state.stats, :companion, low_happiness_companion)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      {:ok, updated_state} = Companion.tick_needs(state, 10)

      companion = Companion.get_companion(updated_state)
      assert companion.happiness == 0
    end

    test "does not decrease loyalty below 0", %{state: state} do
      companion = Companion.get_companion(state)
      low_stats_companion = %{companion | hunger: 0, happiness: 0, loyalty: 0}
      stats = Map.put(state.stats, :companion, low_stats_companion)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      {:ok, updated_state} = Companion.tick_needs(state, 10)

      companion = Companion.get_companion(updated_state)
      assert companion.loyalty == 0
    end

    test "works with default decay amount of 1", %{state: state} do
      initial_companion = Companion.get_companion(state)

      {:ok, updated_state} = Companion.tick_needs(state)

      companion = Companion.get_companion(updated_state)
      assert companion.hunger == initial_companion.hunger - 1
      assert companion.happiness == initial_companion.happiness - 0
    end

    test "returns ok with unchanged state when player has no companion" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:ok, ^state} = Companion.tick_needs(state, 5)
    end
  end

  describe "give_item/3" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      {:ok, state} = Companion.acquire(state, "wolf", "Shadow")

      %{state: state}
    end

    test "adds item to companion inventory", %{state: state} do
      item_id = "sword_123"

      assert {:ok, updated_state} = Companion.give_item(state, item_id)

      companion = Companion.get_companion(updated_state)
      assert item_id in companion.inventory
      assert length(companion.inventory) == 1
    end

    test "can add multiple items", %{state: state} do
      {:ok, state} = Companion.give_item(state, "item_1")
      {:ok, state} = Companion.give_item(state, "item_2")
      {:ok, state} = Companion.give_item(state, "item_3")

      companion = Companion.get_companion(state)
      assert length(companion.inventory) == 3
      assert "item_1" in companion.inventory
      assert "item_2" in companion.inventory
      assert "item_3" in companion.inventory
    end

    test "respects default capacity of 10", %{state: state} do
      # Add 10 items
      state =
        Enum.reduce(1..10, state, fn i, acc ->
          {:ok, new_state} = Companion.give_item(acc, "item_#{i}")
          new_state
        end)

      # 11th item should fail
      assert {:error, :companion_inventory_full} = Companion.give_item(state, "item_11")

      companion = Companion.get_companion(state)
      assert length(companion.inventory) == 10
    end

    test "respects custom capacity", %{state: state} do
      {:ok, state} = Companion.give_item(state, "item_1", 2)
      {:ok, state} = Companion.give_item(state, "item_2", 2)

      # 3rd item should fail with capacity of 2
      assert {:error, :companion_inventory_full} = Companion.give_item(state, "item_3", 2)

      companion = Companion.get_companion(state)
      assert length(companion.inventory) == 2
    end

    test "returns error when player has no companion" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :no_companion} = Companion.give_item(state, "item_1")
    end
  end

  describe "take_item/2" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      {:ok, state} = Companion.acquire(state, "wolf", "Shadow")

      # Give companion some items
      {:ok, state} = Companion.give_item(state, "sword")
      {:ok, state} = Companion.give_item(state, "potion")

      %{state: state}
    end

    test "removes item from companion inventory", %{state: state} do
      assert {:ok, updated_state, item_id} = Companion.take_item(state, "sword")

      assert item_id == "sword"
      companion = Companion.get_companion(updated_state)
      refute "sword" in companion.inventory
      assert "potion" in companion.inventory
      assert length(companion.inventory) == 1
    end

    test "returns error when item not in inventory", %{state: state} do
      assert {:error, :item_not_found} = Companion.take_item(state, "nonexistent")

      # Inventory unchanged
      companion = Companion.get_companion(state)
      assert length(companion.inventory) == 2
    end

    test "can take all items", %{state: state} do
      {:ok, state, _} = Companion.take_item(state, "sword")
      {:ok, state, _} = Companion.take_item(state, "potion")

      companion = Companion.get_companion(state)
      assert companion.inventory == []
    end

    test "returns error when player has no companion" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :no_companion} = Companion.take_item(state, "item_1")
    end
  end

  describe "get_combat_assist/1" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      {:ok, state} = Companion.acquire(state, "wolf", "Shadow")

      %{state: state}
    end

    test "returns combat assist when companion is following", %{state: state} do
      {:ok, state} = Companion.command(state, :follow)

      assist = Companion.get_combat_assist(state)
      assert assist != nil
      assert assist.attack_power == 10
      assert assist.loyalty_modifier == 0.5
    end

    test "returns combat assist when companion is attacking", %{state: state} do
      {:ok, state} = Companion.command(state, :attack, "enemy")

      assist = Companion.get_combat_assist(state)
      assert assist != nil
      assert assist.attack_power == 10
    end

    test "returns nil when companion is staying", %{state: state} do
      {:ok, state} = Companion.command(state, :stay)

      assert Companion.get_combat_assist(state) == nil
    end

    test "returns nil when companion is guarding", %{state: state} do
      {:ok, state} = Companion.command(state, :guard)

      assert Companion.get_combat_assist(state) == nil
    end

    test "returns nil when loyalty is too low", %{state: state} do
      companion = Companion.get_companion(state)
      low_loyalty_companion = %{companion | loyalty: 15}
      stats = Map.put(state.stats, :companion, low_loyalty_companion)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      {:ok, state} = Companion.command(state, :follow)

      assert Companion.get_combat_assist(state) == nil
    end

    test "loyalty modifier scales with loyalty level", %{state: state} do
      # Test with 80% loyalty
      companion = Companion.get_companion(state)
      high_loyalty_companion = %{companion | loyalty: 80}
      stats = Map.put(state.stats, :companion, high_loyalty_companion)
      {:ok, state} = GameState.update_state(state, %{stats: stats})

      {:ok, state} = Companion.command(state, :follow)

      assist = Companion.get_combat_assist(state)
      assert assist.loyalty_modifier == 0.8
    end

    test "returns nil when player has no companion" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Companion.get_combat_assist(state) == nil
    end
  end

  describe "integration tests" do
    test "full companion lifecycle" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      # Acquire companion
      {:ok, state} = Companion.acquire(state, "wolf", "Shadow")
      assert Companion.get_companion(state) != nil

      # Rename companion
      {:ok, state} = Companion.rename(state, "Ghost")
      assert Companion.get_companion(state).name == "Ghost"

      # Give items
      {:ok, state} = Companion.give_item(state, "sword")
      {:ok, state} = Companion.give_item(state, "shield")

      # Command companion
      {:ok, state} = Companion.command(state, :guard)
      assert Companion.get_companion(state).mode == :guarding

      # Play with companion
      {:ok, state, _} = Companion.play(state)

      # Feed companion
      {:ok, state, _} = Companion.feed(state, "meat")

      # Take item back
      {:ok, state, item} = Companion.take_item(state, "sword")
      assert item == "sword"

      companion = Companion.get_companion(state)
      assert companion.name == "Ghost"
      assert companion.mode == :guarding
      assert length(companion.inventory) == 1

      # Dismiss companion
      {:ok, state} = Companion.dismiss(state)
      assert Companion.get_companion(state) == nil
    end

    test "companion needs management over time" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      {:ok, state} = Companion.acquire(state, "cat", "Whiskers")

      # Simulate time passing
      {:ok, state} = Companion.tick_needs(state, 30)
      companion = Companion.get_companion(state)
      assert companion.hunger == 70
      assert companion.happiness == 85

      # Feed and play to restore
      {:ok, state, _} = Companion.feed(state, "fish")
      {:ok, state, _} = Companion.play(state)

      companion = Companion.get_companion(state)
      assert companion.hunger == 100
      assert companion.happiness == 100
      assert companion.loyalty > 50
    end

    test "companion loyalty degradation when neglected" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      {:ok, state} = Companion.acquire(state, "dog", "Buddy")
      initial_loyalty = Companion.get_companion(state).loyalty

      # Severely neglect companion - happiness decays at half rate, so need larger amount
      # Hunger: 100 - 85 = 15, Happiness: 100 - div(85, 2) = 100 - 42 = 58
      # Need more decay to get happiness < 20
      {:ok, state} = Companion.tick_needs(state, 90)

      companion = Companion.get_companion(state)
      assert companion.hunger < 20
      assert companion.happiness < 56

      # Continue neglect - loyalty should decrease when needs are low
      {:ok, state} = Companion.tick_needs(state, 5)
      {:ok, state} = Companion.tick_needs(state, 5)
      {:ok, state} = Companion.tick_needs(state, 5)

      final_companion = Companion.get_companion(state)
      assert final_companion.loyalty < initial_loyalty
    end
  end
end
