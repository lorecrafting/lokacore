defmodule Exmud.Framework.Combat.SpawnerTest do
  use Exmud.DataCase

  alias Exmud.Framework.Combat.Spawner

  import Exmud.EngineFixtures

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

  setup do
    # The Spawner GenServer is started by the application supervision tree.
    # We don't manage its lifecycle in tests - just ensure it's running.
    case GenServer.whereis(Spawner) do
      nil ->
        {:ok, _pid} = Spawner.start_link()
        :ok

      _pid ->
        :ok
    end

    :ok
  end

  describe "despawn_mob/2" do
    test "despawns a valid mob entity" do
      mob = mob_fixture()

      assert {:ok, respawn_at} = Spawner.despawn_mob(mob.id)
      assert %DateTime{} = respawn_at

      # Verify mob is now marked as despawned in DB
      updated_mob = Exmud.Engine.Entities.get_entity(mob.id)
      assert updated_mob.components["despawned"] == true
    end

    test "returns error for non-existent entity" do
      fake_id = Ecto.UUID.generate()

      assert {:error, :entity_not_found} = Spawner.despawn_mob(fake_id)
    end

    test "accepts custom respawn delay" do
      mob = mob_fixture()

      assert {:ok, respawn_at} = Spawner.despawn_mob(mob.id, respawn_delay: 60_000)

      # Verify respawn_at is about 60 seconds in the future
      diff = DateTime.diff(respawn_at, DateTime.utc_now(), :second)
      assert diff >= 59 and diff <= 61
    end
  end

  describe "is_despawned?/1" do
    test "returns true for despawned mob" do
      mob = mob_fixture()
      {:ok, _} = Spawner.despawn_mob(mob.id)

      assert Spawner.is_despawned?(mob.id) == true
    end

    test "returns false for non-despawned mob" do
      mob = mob_fixture()

      assert Spawner.is_despawned?(mob.id) == false
    end

    test "returns false for unknown entity" do
      fake_id = Ecto.UUID.generate()

      assert Spawner.is_despawned?(fake_id) == false
    end
  end

  describe "respawn_mob/1" do
    test "respawns a despawned mob immediately" do
      mob = mob_fixture()
      {:ok, _} = Spawner.despawn_mob(mob.id)

      assert :ok = Spawner.respawn_mob(mob.id)

      # Verify mob is no longer despawned
      assert Spawner.is_despawned?(mob.id) == false

      # Verify despawned flag removed and health restored
      updated_mob = Exmud.Engine.Entities.get_entity(mob.id)
      refute Map.has_key?(updated_mob.components, "despawned")

      combatant = updated_mob.components["combatant"]
      assert combatant["health"]["current"] == 30
    end

    test "returns error for non-despawned mob" do
      mob = mob_fixture()

      assert {:error, :not_despawned} = Spawner.respawn_mob(mob.id)
    end

    test "restores original health on respawn" do
      # Create a mob with custom health
      mob =
        mob_fixture(%{
          combatant: %{
            "health" => %{"current" => 100, "max" => 100}
          }
        })

      {:ok, _} = Spawner.despawn_mob(mob.id)
      :ok = Spawner.respawn_mob(mob.id)

      updated_mob = Exmud.Engine.Entities.get_entity(mob.id)
      combatant = updated_mob.components["combatant"]
      assert combatant["health"]["current"] == 100
      assert combatant["health"]["max"] == 100
    end
  end

  describe "list_despawned/0" do
    test "returns list that includes newly despawned mobs" do
      initial_count = length(Spawner.list_despawned())

      mob1 = mob_fixture()
      mob2 = mob_fixture()

      {:ok, _} = Spawner.despawn_mob(mob1.id)
      {:ok, _} = Spawner.despawn_mob(mob2.id)

      despawned = Spawner.list_despawned()

      # Should have at least our 2 new mobs
      assert length(despawned) >= initial_count + 2
      entity_ids = Enum.map(despawned, & &1.entity_id)
      assert mob1.id in entity_ids
      assert mob2.id in entity_ids
    end

    test "includes respawn_at time for each mob" do
      mob = mob_fixture()
      {:ok, expected_respawn} = Spawner.despawn_mob(mob.id)

      despawned = Spawner.list_despawned()
      info = Enum.find(despawned, &(&1.entity_id == mob.id))

      assert info != nil
      assert info.respawn_at == expected_respawn
    end
  end

  describe "automatic respawn" do
    test "mob respawns after delay" do
      mob = mob_fixture()

      # Use very short delay for testing
      {:ok, _} = Spawner.despawn_mob(mob.id, respawn_delay: 50)

      assert Spawner.is_despawned?(mob.id) == true

      # Wait for respawn
      Process.sleep(100)

      assert Spawner.is_despawned?(mob.id) == false
    end
  end
end
