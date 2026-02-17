defmodule Loka.Components.CooldownsTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Cooldowns
  alias Loka.Engine.Entity

  defp entity_with_cooldowns(cooldowns \\ %{}) do
    Entity.new(type: :npc, key: "test_npc", components: %{"cooldowns" => cooldowns})
  end

  describe "ready?/2" do
    test "returns true for absent cooldown" do
      entity = entity_with_cooldowns()
      assert Cooldowns.ready?(entity, "heal")
    end

    test "returns false for active cooldown" do
      expiry = System.os_time(:second) + 60
      entity = entity_with_cooldowns(%{"heal" => expiry})
      refute Cooldowns.ready?(entity, "heal")
    end

    test "returns true for expired cooldown" do
      expiry = System.os_time(:second) - 10
      entity = entity_with_cooldowns(%{"heal" => expiry})
      assert Cooldowns.ready?(entity, "heal")
    end

    test "accepts atom keys" do
      expiry = System.os_time(:second) + 60
      entity = entity_with_cooldowns(%{"shrine" => expiry})
      refute Cooldowns.ready?(entity, :shrine)
    end

    test "different keys are independent" do
      expiry = System.os_time(:second) + 60
      entity = entity_with_cooldowns(%{"heal" => expiry})
      assert Cooldowns.ready?(entity, "attack")
      refute Cooldowns.ready?(entity, "heal")
    end
  end

  describe "remaining/2" do
    test "returns positive value for active cooldown" do
      expiry = System.os_time(:second) + 60
      entity = entity_with_cooldowns(%{"heal" => expiry})
      remaining = Cooldowns.remaining(entity, "heal")
      assert remaining > 0
      assert remaining <= 60
    end

    test "returns 0 for absent cooldown" do
      entity = entity_with_cooldowns()
      assert Cooldowns.remaining(entity, "nonexistent") == 0
    end

    test "returns 0 for expired cooldown" do
      expiry = System.os_time(:second) - 10
      entity = entity_with_cooldowns(%{"heal" => expiry})
      assert Cooldowns.remaining(entity, "heal") == 0
    end
  end

  describe "set/3" do
    test "adds a cooldown to the entity" do
      entity = entity_with_cooldowns()
      updated = Cooldowns.set(entity, "heal", 60)
      refute Cooldowns.ready?(updated, "heal")
      assert Cooldowns.remaining(updated, "heal") > 0
    end

    test "overwrites existing cooldown" do
      entity = entity_with_cooldowns()
      entity = Cooldowns.set(entity, "heal", 10)
      entity = Cooldowns.set(entity, "heal", 120)
      assert Cooldowns.remaining(entity, "heal") > 60
    end

    test "preserves other cooldowns" do
      entity = entity_with_cooldowns()
      entity = Cooldowns.set(entity, "heal", 60)
      entity = Cooldowns.set(entity, "attack", 30)
      refute Cooldowns.ready?(entity, "heal")
      refute Cooldowns.ready?(entity, "attack")
    end
  end

  describe "clear/2" do
    test "removes a specific cooldown" do
      entity = entity_with_cooldowns()
      entity = Cooldowns.set(entity, "heal", 60)
      entity = Cooldowns.set(entity, "attack", 60)

      entity = Cooldowns.clear(entity, "heal")
      assert Cooldowns.ready?(entity, "heal")
      refute Cooldowns.ready?(entity, "attack")
    end

    test "no-ops for absent cooldown" do
      entity = entity_with_cooldowns()
      entity = Cooldowns.clear(entity, "nonexistent")
      assert Cooldowns.get(entity) == %{}
    end
  end

  describe "clear_all/1" do
    test "removes all cooldowns" do
      entity = entity_with_cooldowns()
      entity = Cooldowns.set(entity, "heal", 60)
      entity = Cooldowns.set(entity, "attack", 60)

      entity = Cooldowns.clear_all(entity)
      assert Cooldowns.ready?(entity, "heal")
      assert Cooldowns.ready?(entity, "attack")
      assert Cooldowns.get(entity) == %{}
    end
  end

  describe "list_active/1" do
    test "returns active cooldowns with remaining time" do
      now = System.os_time(:second)

      entity =
        entity_with_cooldowns(%{
          "heal" => now + 60,
          "attack" => now + 30,
          "expired" => now - 10
        })

      active = Cooldowns.list_active(entity)
      assert length(active) == 2
      keys = Enum.map(active, & &1.key)
      assert "heal" in keys
      assert "attack" in keys
      refute "expired" in keys
    end

    test "returns empty list for no cooldowns" do
      entity = entity_with_cooldowns()
      assert Cooldowns.list_active(entity) == []
    end
  end

  describe "sweep_expired/1" do
    test "removes expired entries" do
      now = System.os_time(:second)

      entity =
        entity_with_cooldowns(%{
          "active" => now + 60,
          "expired1" => now - 10,
          "expired2" => now - 100
        })

      entity = Cooldowns.sweep_expired(entity)
      cooldowns = Cooldowns.get(entity)
      assert Map.has_key?(cooldowns, "active")
      refute Map.has_key?(cooldowns, "expired1")
      refute Map.has_key?(cooldowns, "expired2")
    end
  end

  describe "get/1 and put/2" do
    test "get returns empty map for entity without cooldowns" do
      entity = Entity.new(type: :npc, key: "test")
      assert Cooldowns.get(entity) == %{}
    end

    test "put sets the cooldowns component" do
      entity = Entity.new(type: :npc, key: "test")
      data = %{"heal" => 12345}
      entity = Cooldowns.put(entity, data)
      assert Cooldowns.get(entity) == data
    end
  end
end
