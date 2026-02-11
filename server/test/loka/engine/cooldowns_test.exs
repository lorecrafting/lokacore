defmodule Loka.Engine.CooldownsTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.Cooldowns

  # Use a unique entity_id per test to avoid cross-test contamination
  defp entity_id, do: "test_entity_#{System.unique_integer([:positive])}"

  describe "set/3 and ready?/2" do
    test "newly set cooldown is not ready" do
      id = entity_id()
      Cooldowns.set(id, "heal", 60)
      refute Cooldowns.ready?(id, "heal")
    end

    test "unset cooldown is ready" do
      id = entity_id()
      assert Cooldowns.ready?(id, "nonexistent")
    end

    test "different keys are independent" do
      id = entity_id()
      Cooldowns.set(id, "heal", 60)
      assert Cooldowns.ready?(id, "attack")
      refute Cooldowns.ready?(id, "heal")
    end

    test "accepts atom keys" do
      id = entity_id()
      Cooldowns.set(id, :shrine, 60)
      refute Cooldowns.ready?(id, :shrine)
      refute Cooldowns.ready?(id, "shrine")
    end
  end

  describe "remaining/2" do
    test "returns positive value for active cooldown" do
      id = entity_id()
      Cooldowns.set(id, "heal", 60)
      remaining = Cooldowns.remaining(id, "heal")
      assert remaining > 0
      assert remaining <= 60
    end

    test "returns 0 for unset cooldown" do
      id = entity_id()
      assert Cooldowns.remaining(id, "nonexistent") == 0
    end
  end

  describe "clear/2" do
    test "clears a specific cooldown" do
      id = entity_id()
      Cooldowns.set(id, "heal", 60)
      refute Cooldowns.ready?(id, "heal")

      Cooldowns.clear(id, "heal")
      assert Cooldowns.ready?(id, "heal")
    end

    test "does not affect other cooldowns" do
      id = entity_id()
      Cooldowns.set(id, "heal", 60)
      Cooldowns.set(id, "attack", 60)

      Cooldowns.clear(id, "heal")
      assert Cooldowns.ready?(id, "heal")
      refute Cooldowns.ready?(id, "attack")
    end
  end

  describe "clear_all/1" do
    test "clears all cooldowns for an entity" do
      id = entity_id()
      Cooldowns.set(id, "heal", 60)
      Cooldowns.set(id, "attack", 60)
      Cooldowns.set(id, "shrine", 60)

      Cooldowns.clear_all(id)
      assert Cooldowns.ready?(id, "heal")
      assert Cooldowns.ready?(id, "attack")
      assert Cooldowns.ready?(id, "shrine")
    end

    test "does not affect other entities" do
      id1 = entity_id()
      id2 = entity_id()
      Cooldowns.set(id1, "heal", 60)
      Cooldowns.set(id2, "heal", 60)

      Cooldowns.clear_all(id1)
      assert Cooldowns.ready?(id1, "heal")
      refute Cooldowns.ready?(id2, "heal")
    end
  end

  describe "list/1" do
    test "returns active cooldowns" do
      id = entity_id()
      Cooldowns.set(id, "heal", 60)
      Cooldowns.set(id, "attack", 30)

      cooldowns = Cooldowns.list(id)
      assert length(cooldowns) == 2
      keys = Enum.map(cooldowns, & &1.key)
      assert "heal" in keys
      assert "attack" in keys
    end

    test "returns empty list for no cooldowns" do
      id = entity_id()
      assert Cooldowns.list(id) == []
    end
  end

  describe "expiry" do
    test "very short cooldown becomes ready quickly" do
      id = entity_id()
      Cooldowns.set(id, "fast", 1)

      # Wait for expiry
      Process.sleep(1100)
      assert Cooldowns.ready?(id, "fast")
      assert Cooldowns.remaining(id, "fast") == 0
    end
  end
end
