defmodule Loka.Framework.Combat.RespawnManagerTest do
  use Loka.DataCase

  alias Loka.Framework.Combat.RespawnManager

  import Loka.EngineFixtures

  # Helper to create a mob entity with combatant component
  defp mob_fixture(attrs \\ %{}) do
    room = room_fixture()

    components = %{
      "combatant" =>
        Map.merge(
          %{
            "health" => %{"current" => 30, "max" => 30},
            "stats" => %{"attack" => 5, "defense" => 2},
            "level" => 1
          },
          Map.get(attrs, :combatant, %{})
        )
    }

    npc_fixture(
      Map.merge(
        %{
          name: "Test Mob",
          description: "A test mob",
          components: components,
          location_id: room.id
        },
        attrs
      )
    )
  end

  describe "despawn_mob/2" do
    test "despawns a valid mob entity" do
      mob = mob_fixture()

      assert {:ok, respawn_at} = RespawnManager.despawn_mob(mob.id)
      assert %DateTime{} = respawn_at

      # Verify mob is now marked as despawned in DB
      updated_mob = Loka.Engine.Entities.get_entity(mob.id)
      assert updated_mob.components["despawned"] == true
    end

    test "stores respawn_data with original health" do
      mob = mob_fixture()

      {:ok, _} = RespawnManager.despawn_mob(mob.id)

      updated_mob = Loka.Engine.Entities.get_entity(mob.id)

      assert updated_mob.components["respawn_data"]["original_health"] == %{
               "current" => 30,
               "max" => 30
             }
    end

    test "returns error for non-existent entity" do
      fake_id = Ecto.UUID.generate()

      assert {:error, :entity_not_found} = RespawnManager.despawn_mob(fake_id)
    end

    test "accepts custom respawn delay" do
      mob = mob_fixture()

      assert {:ok, respawn_at} = RespawnManager.despawn_mob(mob.id, respawn_delay: 60_000)

      # Verify respawn_at is about 60 seconds in the future
      diff = DateTime.diff(respawn_at, DateTime.utc_now(), :second)
      assert diff >= 59 and diff <= 61
    end
  end

  describe "is_despawned?/1" do
    test "returns true for despawned mob" do
      mob = mob_fixture()
      {:ok, _} = RespawnManager.despawn_mob(mob.id)

      assert RespawnManager.is_despawned?(mob.id) == true
    end

    test "returns false for non-despawned mob" do
      mob = mob_fixture()

      assert RespawnManager.is_despawned?(mob.id) == false
    end

    test "returns false for unknown entity" do
      fake_id = Ecto.UUID.generate()

      assert RespawnManager.is_despawned?(fake_id) == false
    end
  end

  describe "respawn_mob/1" do
    test "respawns a despawned mob immediately" do
      mob = mob_fixture()
      {:ok, _} = RespawnManager.despawn_mob(mob.id)

      assert :ok = RespawnManager.respawn_mob(mob.id)

      # Verify mob is no longer despawned
      assert RespawnManager.is_despawned?(mob.id) == false

      # Verify despawned flag removed and health restored
      updated_mob = Loka.Engine.Entities.get_entity(mob.id)
      refute Map.has_key?(updated_mob.components, "despawned")
      refute Map.has_key?(updated_mob.components, "respawn_data")

      combatant = updated_mob.components["combatant"]
      assert combatant["health"]["current"] == 30
    end

    test "returns error for non-despawned mob" do
      mob = mob_fixture()

      assert {:error, :not_despawned} = RespawnManager.respawn_mob(mob.id)
    end

    test "restores original health on respawn" do
      # Create a mob with custom health
      mob =
        mob_fixture(%{
          combatant: %{
            "health" => %{"current" => 100, "max" => 100}
          }
        })

      {:ok, _} = RespawnManager.despawn_mob(mob.id)
      :ok = RespawnManager.respawn_mob(mob.id)

      updated_mob = Loka.Engine.Entities.get_entity(mob.id)
      combatant = updated_mob.components["combatant"]
      assert combatant["health"]["current"] == 100
      assert combatant["health"]["max"] == 100
    end
  end
end
