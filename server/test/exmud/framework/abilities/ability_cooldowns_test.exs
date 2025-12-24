defmodule Exmud.Framework.Abilities.AbilityCooldownsTest do
  use ExUnit.Case, async: false

  alias Exmud.Framework.Abilities.AbilityCooldowns

  setup do
    # Start the cooldown server for tests
    {:ok, pid} = start_supervised({AbilityCooldowns, name: AbilityCooldowns})
    # Clear all cooldowns before each test
    AbilityCooldowns.clear_all()
    {:ok, pid: pid}
  end

  describe "start_cooldown/3" do
    test "starts a cooldown for an ability" do
      entity_id = "player_1"
      ability_key = "fireball"

      AbilityCooldowns.start_cooldown(entity_id, ability_key, 5)
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown(entity_id, ability_key) == 5
    end

    test "overwrites existing cooldown" do
      entity_id = "player_1"
      ability_key = "fireball"

      AbilityCooldowns.start_cooldown(entity_id, ability_key, 5)
      Process.sleep(10)
      AbilityCooldowns.start_cooldown(entity_id, ability_key, 3)
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown(entity_id, ability_key) == 3
    end

    test "handles multiple abilities for same entity" do
      entity_id = "player_1"

      AbilityCooldowns.start_cooldown(entity_id, "fireball", 5)
      AbilityCooldowns.start_cooldown(entity_id, "heal", 3)
      AbilityCooldowns.start_cooldown(entity_id, "teleport", 10)
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown(entity_id, "fireball") == 5
      assert AbilityCooldowns.get_cooldown(entity_id, "heal") == 3
      assert AbilityCooldowns.get_cooldown(entity_id, "teleport") == 10
    end

    test "handles same ability for different entities" do
      AbilityCooldowns.start_cooldown("player_1", "fireball", 5)
      AbilityCooldowns.start_cooldown("player_2", "fireball", 3)
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown("player_1", "fireball") == 5
      assert AbilityCooldowns.get_cooldown("player_2", "fireball") == 3
    end

    test "returns :ok for zero or negative cooldown" do
      entity_id = "player_1"

      assert :ok = AbilityCooldowns.start_cooldown(entity_id, "ability", 0)
      assert :ok = AbilityCooldowns.start_cooldown(entity_id, "ability", -5)

      assert AbilityCooldowns.get_cooldown(entity_id, "ability") == 0
    end
  end

  describe "get_cooldown/2" do
    test "returns cooldown for active ability" do
      entity_id = "player_1"
      AbilityCooldowns.start_cooldown(entity_id, "fireball", 7)
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown(entity_id, "fireball") == 7
    end

    test "returns 0 for ability not on cooldown" do
      entity_id = "player_1"

      assert AbilityCooldowns.get_cooldown(entity_id, "fireball") == 0
    end

    test "returns 0 for non-existent entity" do
      assert AbilityCooldowns.get_cooldown("fake_entity", "fireball") == 0
    end
  end

  describe "get_all_cooldowns/1" do
    test "returns map of all cooldowns for entity" do
      entity_id = "player_1"

      AbilityCooldowns.start_cooldown(entity_id, "fireball", 5)
      AbilityCooldowns.start_cooldown(entity_id, "heal", 3)
      AbilityCooldowns.start_cooldown(entity_id, "teleport", 10)
      Process.sleep(10)

      cooldowns = AbilityCooldowns.get_all_cooldowns(entity_id)

      assert cooldowns == %{
               "fireball" => 5,
               "heal" => 3,
               "teleport" => 10
             }
    end

    test "returns empty map for entity with no cooldowns" do
      cooldowns = AbilityCooldowns.get_all_cooldowns("player_1")
      assert cooldowns == %{}
    end

    test "only returns cooldowns for specified entity" do
      AbilityCooldowns.start_cooldown("player_1", "fireball", 5)
      AbilityCooldowns.start_cooldown("player_2", "heal", 3)
      Process.sleep(10)

      cooldowns = AbilityCooldowns.get_all_cooldowns("player_1")

      assert cooldowns == %{"fireball" => 5}
      refute Map.has_key?(cooldowns, "heal")
    end
  end

  describe "tick/1" do
    test "decrements cooldown by 1" do
      entity_id = "player_1"
      AbilityCooldowns.start_cooldown(entity_id, "fireball", 5)
      Process.sleep(10)

      AbilityCooldowns.tick(entity_id)
      # Give the cast time to process
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown(entity_id, "fireball") == 4
    end

    test "removes cooldown when it reaches 0" do
      entity_id = "player_1"
      AbilityCooldowns.start_cooldown(entity_id, "fireball", 1)
      Process.sleep(10)

      AbilityCooldowns.tick(entity_id)
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown(entity_id, "fireball") == 0
    end

    test "ticks all cooldowns for entity" do
      entity_id = "player_1"
      AbilityCooldowns.start_cooldown(entity_id, "fireball", 5)
      AbilityCooldowns.start_cooldown(entity_id, "heal", 3)
      Process.sleep(10)

      AbilityCooldowns.tick(entity_id)
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown(entity_id, "fireball") == 4
      assert AbilityCooldowns.get_cooldown(entity_id, "heal") == 2
    end

    test "only ticks specified entity" do
      AbilityCooldowns.start_cooldown("player_1", "fireball", 5)
      AbilityCooldowns.start_cooldown("player_2", "heal", 3)
      Process.sleep(10)

      AbilityCooldowns.tick("player_1")
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown("player_1", "fireball") == 4
      assert AbilityCooldowns.get_cooldown("player_2", "heal") == 3
    end

    test "handles multiple ticks" do
      entity_id = "player_1"
      AbilityCooldowns.start_cooldown(entity_id, "fireball", 5)
      Process.sleep(10)

      AbilityCooldowns.tick(entity_id)
      Process.sleep(10)
      AbilityCooldowns.tick(entity_id)
      Process.sleep(10)
      AbilityCooldowns.tick(entity_id)
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown(entity_id, "fireball") == 2
    end
  end

  describe "tick_all/0" do
    test "ticks cooldowns for all entities" do
      AbilityCooldowns.start_cooldown("player_1", "fireball", 5)
      AbilityCooldowns.start_cooldown("player_2", "heal", 3)
      AbilityCooldowns.start_cooldown("player_3", "teleport", 10)
      Process.sleep(10)

      AbilityCooldowns.tick_all()
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown("player_1", "fireball") == 4
      assert AbilityCooldowns.get_cooldown("player_2", "heal") == 2
      assert AbilityCooldowns.get_cooldown("player_3", "teleport") == 9
    end

    test "removes cooldowns that reach 0" do
      AbilityCooldowns.start_cooldown("player_1", "fireball", 1)
      AbilityCooldowns.start_cooldown("player_2", "heal", 3)
      Process.sleep(10)

      AbilityCooldowns.tick_all()
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown("player_1", "fireball") == 0
      assert AbilityCooldowns.get_cooldown("player_2", "heal") == 2
    end
  end

  describe "reset_cooldown/2" do
    test "removes specific cooldown" do
      entity_id = "player_1"
      AbilityCooldowns.start_cooldown(entity_id, "fireball", 5)
      Process.sleep(10)

      AbilityCooldowns.reset_cooldown(entity_id, "fireball")
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown(entity_id, "fireball") == 0
    end

    test "only removes specified ability" do
      entity_id = "player_1"
      AbilityCooldowns.start_cooldown(entity_id, "fireball", 5)
      AbilityCooldowns.start_cooldown(entity_id, "heal", 3)
      Process.sleep(10)

      AbilityCooldowns.reset_cooldown(entity_id, "fireball")
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown(entity_id, "fireball") == 0
      assert AbilityCooldowns.get_cooldown(entity_id, "heal") == 3
    end

    test "handles non-existent cooldown gracefully" do
      entity_id = "player_1"

      assert :ok = AbilityCooldowns.reset_cooldown(entity_id, "nonexistent")
    end
  end

  describe "reset_all/1" do
    test "removes all cooldowns for entity" do
      entity_id = "player_1"
      AbilityCooldowns.start_cooldown(entity_id, "fireball", 5)
      AbilityCooldowns.start_cooldown(entity_id, "heal", 3)
      AbilityCooldowns.start_cooldown(entity_id, "teleport", 10)
      Process.sleep(10)

      AbilityCooldowns.reset_all(entity_id)
      Process.sleep(10)

      cooldowns = AbilityCooldowns.get_all_cooldowns(entity_id)
      assert cooldowns == %{}
    end

    test "only removes cooldowns for specified entity" do
      AbilityCooldowns.start_cooldown("player_1", "fireball", 5)
      AbilityCooldowns.start_cooldown("player_2", "heal", 3)
      Process.sleep(10)

      AbilityCooldowns.reset_all("player_1")
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown("player_1", "fireball") == 0
      assert AbilityCooldowns.get_cooldown("player_2", "heal") == 3
    end

    test "handles entity with no cooldowns gracefully" do
      assert :ok = AbilityCooldowns.reset_all("player_1")
    end
  end

  describe "clear_all/0" do
    test "removes all cooldowns from all entities" do
      AbilityCooldowns.start_cooldown("player_1", "fireball", 5)
      AbilityCooldowns.start_cooldown("player_2", "heal", 3)
      AbilityCooldowns.start_cooldown("player_3", "teleport", 10)
      Process.sleep(10)

      assert :ok = AbilityCooldowns.clear_all()

      assert AbilityCooldowns.get_cooldown("player_1", "fireball") == 0
      assert AbilityCooldowns.get_cooldown("player_2", "heal") == 0
      assert AbilityCooldowns.get_cooldown("player_3", "teleport") == 0
    end

    test "returns :ok when no cooldowns exist" do
      assert :ok = AbilityCooldowns.clear_all()
    end
  end
end
