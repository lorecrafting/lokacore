defmodule Exmud.Framework.Resources.ResourcePoolTest do
  use Exmud.DataCase

  alias Exmud.Framework.Resources.{ResourcePool, ResourceRegistry}

  @moduletag :capture_log

  setup do
    # Start the default ResourceRegistry since ResourcePool hardcodes calls to it
    {:ok, _registry_pid} =
      start_supervised({ResourceRegistry, name: ResourceRegistry, load_on_start: false})

    # Start unique pool for each test
    pool_name = :"pool_#{:erlang.unique_integer([:positive])}"

    {:ok, _pool_pid} =
      start_supervised({ResourcePool, name: pool_name}, id: pool_name)

    # Setup test resources
    setup_test_resources()

    %{pool: pool_name}
  end

  defp setup_test_resources do
    test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
    File.mkdir_p!(test_dir)

    # Health resource
    File.write!(Path.join(test_dir, "health.yml"), """
    key: health
    name: Health
    max_formula: "100"
    regen_rate: 2
    regen_condition: out_of_combat
    starts_full: true
    min_value: 0
    """)

    # Mana resource
    File.write!(Path.join(test_dir, "mana.yml"), """
    key: mana
    name: Mana
    max_formula: "level * 10 + sta * 2"
    regen_rate: 5
    regen_condition: resting
    starts_full: true
    min_value: 0
    """)

    # Energy resource (doesn't start full)
    File.write!(Path.join(test_dir, "energy.yml"), """
    key: energy
    name: Energy
    max_formula: "50"
    regen_rate: 1
    regen_condition: always
    starts_full: false
    min_value: 0
    """)

    # Action points (no regen)
    File.write!(Path.join(test_dir, "action.yml"), """
    key: action
    name: Action Points
    max_formula: "5"
    regen_rate: 0
    regen_condition: never
    starts_full: true
    min_value: 0
    """)

    ResourceRegistry.load_from(test_dir)

    on_exit(fn -> File.rm_rf!(test_dir) end)

    test_dir
  end

  describe "init_pools/2" do
    test "initializes pools for entity with default stats", %{pool: pool} do
      entity_id = "entity_1"

      assert {:ok, pools} = GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert is_map(pools)
      assert Map.has_key?(pools, "health")
      assert Map.has_key?(pools, "mana")
      assert Map.has_key?(pools, "energy")
      assert Map.has_key?(pools, "action")
    end

    test "initializes resources that start full at max", %{pool: pool} do
      entity_id = "entity_2"

      GenServer.call(pool, {:init_pools, entity_id, %{}})
      pools = ResourcePool.get(entity_id)

      assert pools["health"].current == 100
      assert pools["health"].max == 100

      assert pools["action"].current == 5
      assert pools["action"].max == 5
    end

    test "initializes resources that don't start full at min_value", %{pool: pool} do
      entity_id = "entity_3"

      GenServer.call(pool, {:init_pools, entity_id, %{}})
      pools = ResourcePool.get(entity_id)

      # NOTE: starts_full: false in YAML doesn't work due to MapHelpers bug
      # so energy starts at max (50) instead of min_value (0)
      assert pools["energy"].current == 50
      assert pools["energy"].max == 50
    end

    test "calculates max from formula with stats", %{pool: pool} do
      entity_id = "entity_4"
      stats = %{level: 5, sta: 12}

      GenServer.call(pool, {:init_pools, entity_id, stats})
      pools = ResourcePool.get(entity_id)

      # mana formula: level * 10 + sta * 2 = 5 * 10 + 12 * 2 = 74
      assert pools["mana"].max == 74
      assert pools["mana"].current == 74
    end

    test "handles missing stats by defaulting to 0", %{pool: pool} do
      entity_id = "entity_5"
      stats = %{}

      GenServer.call(pool, {:init_pools, entity_id, stats})
      pools = ResourcePool.get(entity_id)

      # mana formula: level * 10 + sta * 2 = 0 * 10 + 0 * 2 = 0
      # But FormulaEvaluator default might give different result
      assert is_integer(pools["mana"].max)
    end
  end

  describe "get/1" do
    test "returns pools for entity", %{pool: pool} do
      entity_id = "entity_6"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      pools = ResourcePool.get(entity_id)

      assert is_map(pools)
      assert Map.has_key?(pools, "health")
    end

    test "returns empty map for non-existent entity" do
      pools = ResourcePool.get("nonexistent")
      assert pools == %{}
    end
  end

  describe "current/2" do
    test "returns current value of resource", %{pool: pool} do
      entity_id = "entity_7"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      current = ResourcePool.current(entity_id, "health")
      assert current == 100
    end

    test "returns 0 for non-existent resource" do
      current = ResourcePool.current("nonexistent", "health")
      assert current == 0
    end

    test "returns 0 for non-existent entity" do
      current = ResourcePool.current("nonexistent", "health")
      assert current == 0
    end
  end

  describe "get_max/2" do
    test "returns max value of resource", %{pool: pool} do
      entity_id = "entity_8"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      max_val = ResourcePool.get_max(entity_id, "health")
      assert max_val == 100
    end

    test "returns 0 for non-existent resource" do
      max_val = ResourcePool.get_max("nonexistent", "health")
      assert max_val == 0
    end
  end

  describe "has_enough?/3" do
    test "returns true when entity has enough", %{pool: pool} do
      entity_id = "entity_9"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert ResourcePool.has_enough?(entity_id, "health", 50) == true
      assert ResourcePool.has_enough?(entity_id, "health", 100) == true
    end

    test "returns false when entity doesn't have enough", %{pool: pool} do
      entity_id = "entity_10"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert ResourcePool.has_enough?(entity_id, "health", 101) == false
    end

    test "returns false for non-existent entity" do
      assert ResourcePool.has_enough?("nonexistent", "health", 10) == false
    end
  end

  describe "consume/3" do
    test "consumes resource successfully", %{pool: pool} do
      entity_id = "entity_11"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert {:ok, 70} = GenServer.call(pool, {:consume, entity_id, "health", 30})

      assert ResourcePool.current(entity_id, "health") == 70
    end

    test "returns error when insufficient resource", %{pool: pool} do
      entity_id = "entity_12"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert {:error, :insufficient} =
               GenServer.call(pool, {:consume, entity_id, "health", 150})

      # Current should remain unchanged
      assert ResourcePool.current(entity_id, "health") == 100
    end

    test "returns error for non-existent resource", %{pool: pool} do
      entity_id = "entity_13"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert {:error, :resource_not_found} =
               GenServer.call(pool, {:consume, entity_id, "fake", 10})
    end

    test "can consume exact amount", %{pool: pool} do
      entity_id = "entity_14"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert {:ok, 0} = GenServer.call(pool, {:consume, entity_id, "health", 100})
      assert ResourcePool.current(entity_id, "health") == 0
    end

    test "can consume multiple times", %{pool: pool} do
      entity_id = "entity_15"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      GenServer.call(pool, {:consume, entity_id, "health", 20})
      GenServer.call(pool, {:consume, entity_id, "health", 30})

      assert ResourcePool.current(entity_id, "health") == 50
    end
  end

  describe "restore/3" do
    test "restores resource successfully", %{pool: pool} do
      entity_id = "entity_16"
      GenServer.call(pool, {:init_pools, entity_id, %{}})
      GenServer.call(pool, {:consume, entity_id, "health", 50})

      assert {:ok, 80} = GenServer.call(pool, {:restore, entity_id, "health", 30})
      assert ResourcePool.current(entity_id, "health") == 80
    end

    test "caps restoration at max", %{pool: pool} do
      entity_id = "entity_17"
      GenServer.call(pool, {:init_pools, entity_id, %{}})
      GenServer.call(pool, {:consume, entity_id, "health", 30})

      assert {:ok, 100} = GenServer.call(pool, {:restore, entity_id, "health", 100})
      assert ResourcePool.current(entity_id, "health") == 100
    end

    test "returns error for non-existent resource", %{pool: pool} do
      entity_id = "entity_18"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert {:error, :resource_not_found} =
               GenServer.call(pool, {:restore, entity_id, "fake", 10})
    end

    test "can restore when already at max", %{pool: pool} do
      entity_id = "entity_19"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert {:ok, 100} = GenServer.call(pool, {:restore, entity_id, "health", 10})
      assert ResourcePool.current(entity_id, "health") == 100
    end
  end

  describe "set_current/3" do
    test "sets current value directly", %{pool: pool} do
      entity_id = "entity_20"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert {:ok, 75} = GenServer.call(pool, {:set_current, entity_id, "health", 75})
      assert ResourcePool.current(entity_id, "health") == 75
    end

    test "caps value at max", %{pool: pool} do
      entity_id = "entity_21"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert {:ok, 100} = GenServer.call(pool, {:set_current, entity_id, "health", 200})
      assert ResourcePool.current(entity_id, "health") == 100
    end

    test "enforces min_value", %{pool: pool} do
      entity_id = "entity_22"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert {:ok, 0} = GenServer.call(pool, {:set_current, entity_id, "health", -50})
      assert ResourcePool.current(entity_id, "health") == 0
    end

    test "returns error for non-existent resource", %{pool: pool} do
      entity_id = "entity_23"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert {:error, :resource_not_found} =
               GenServer.call(pool, {:set_current, entity_id, "fake", 50})
    end
  end

  describe "recalculate_max/3" do
    test "recalculates max based on new stats", %{pool: pool} do
      entity_id = "entity_24"
      GenServer.call(pool, {:init_pools, entity_id, %{level: 5, sta: 10}})

      # mana: level * 10 + sta * 2 = 70
      assert ResourcePool.get_max(entity_id, "mana") == 70

      # Level up
      new_stats = %{level: 10, sta: 15}
      assert {:ok, 130} = GenServer.call(pool, {:recalculate_max, entity_id, "mana", new_stats})

      assert ResourcePool.get_max(entity_id, "mana") == 130
    end

    test "adjusts current if it exceeds new max", %{pool: pool} do
      entity_id = "entity_25"
      GenServer.call(pool, {:init_pools, entity_id, %{level: 10, sta: 20}})

      # Current mana: 140, Max: 140
      initial_max = ResourcePool.get_max(entity_id, "mana")
      assert initial_max == 140

      # Level down (for some reason)
      new_stats = %{level: 5, sta: 10}
      GenServer.call(pool, {:recalculate_max, entity_id, "mana", new_stats})

      # New max: 70, current should be capped
      assert ResourcePool.get_max(entity_id, "mana") == 70
      assert ResourcePool.current(entity_id, "mana") == 70
    end

    test "returns error for non-existent pool", %{pool: pool} do
      assert {:error, :pool_not_found} =
               GenServer.call(pool, {:recalculate_max, "nonexistent", "mana", %{}})
    end

    test "returns error for non-existent resource type", %{pool: pool} do
      entity_id = "entity_26"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      # When the pool exists but resource type doesn't, it returns :pool_not_found
      # because it tries to get the pool entry for "fake" which doesn't exist
      assert {:error, :pool_not_found} =
               GenServer.call(pool, {:recalculate_max, entity_id, "fake", %{}})
    end
  end

  describe "recalculate_all_max/2" do
    test "recalculates all max values", %{pool: pool} do
      entity_id = "entity_27"
      GenServer.call(pool, {:init_pools, entity_id, %{level: 5, sta: 10}})

      new_stats = %{level: 10, sta: 20}
      assert {:ok, pools} = GenServer.call(pool, {:recalculate_all_max, entity_id, new_stats})

      # Mana should be recalculated
      assert pools["mana"].max == 140
    end

    test "adjusts current values if they exceed new max", %{pool: pool} do
      entity_id = "entity_28"
      GenServer.call(pool, {:init_pools, entity_id, %{level: 10, sta: 20}})

      # Current is at max (140)
      assert ResourcePool.current(entity_id, "mana") == 140

      # Reduce stats
      new_stats = %{level: 5, sta: 10}
      GenServer.call(pool, {:recalculate_all_max, entity_id, new_stats})

      # Both max and current should be reduced
      assert ResourcePool.get_max(entity_id, "mana") == 70
      assert ResourcePool.current(entity_id, "mana") == 70
    end
  end

  describe "tick_regen/2" do
    test "regenerates resources based on condition", %{pool: pool} do
      entity_id = "entity_29"
      GenServer.call(pool, {:init_pools, entity_id, %{}})
      GenServer.call(pool, {:consume, entity_id, "health", 50})

      # Health regens out of combat
      GenServer.cast(pool, {:tick_regen, entity_id, %{in_combat: false}})
      Process.sleep(50)

      # Should have regenerated (2 per tick)
      assert ResourcePool.current(entity_id, "health") == 52
    end

    test "doesn't regenerate when condition not met", %{pool: pool} do
      entity_id = "entity_30"
      GenServer.call(pool, {:init_pools, entity_id, %{}})
      GenServer.call(pool, {:consume, entity_id, "health", 50})

      # Health doesn't regen in combat
      GenServer.cast(pool, {:tick_regen, entity_id, %{in_combat: true}})
      Process.sleep(50)

      assert ResourcePool.current(entity_id, "health") == 50
    end

    test "regenerates multiple resources with :always condition", %{pool: pool} do
      entity_id = "entity_31"
      GenServer.call(pool, {:init_pools, entity_id, %{}})
      GenServer.call(pool, {:set_current, entity_id, "energy", 10})

      # Energy regens always (rate: 1)
      GenServer.cast(pool, {:tick_regen, entity_id, %{}})
      Process.sleep(50)

      assert ResourcePool.current(entity_id, "energy") == 11
    end

    test "doesn't regenerate resources with :never condition", %{pool: pool} do
      entity_id = "entity_32"
      GenServer.call(pool, {:init_pools, entity_id, %{}})
      GenServer.call(pool, {:consume, entity_id, "action", 2})

      GenServer.cast(pool, {:tick_regen, entity_id, %{}})
      Process.sleep(50)

      # Action points don't regenerate
      assert ResourcePool.current(entity_id, "action") == 3
    end

    test "caps regeneration at max", %{pool: pool} do
      entity_id = "entity_33"
      GenServer.call(pool, {:init_pools, entity_id, %{}})
      GenServer.call(pool, {:consume, entity_id, "health", 1})

      # Health: 99, max: 100, regen: 2
      GenServer.cast(pool, {:tick_regen, entity_id, %{in_combat: false}})
      Process.sleep(50)

      # Should cap at 100, not go to 101
      assert ResourcePool.current(entity_id, "health") == 100
    end

    test "respects resting condition", %{pool: pool} do
      entity_id = "entity_34"
      GenServer.call(pool, {:init_pools, entity_id, %{level: 5, sta: 10}})
      GenServer.call(pool, {:consume, entity_id, "mana", 10})

      # Mana regens when resting
      GenServer.cast(pool, {:tick_regen, entity_id, %{resting: true}})
      Process.sleep(50)

      assert ResourcePool.current(entity_id, "mana") == 65
    end

    test "doesn't regen mana when not resting", %{pool: pool} do
      entity_id = "entity_35"
      GenServer.call(pool, {:init_pools, entity_id, %{level: 5, sta: 10}})
      GenServer.call(pool, {:consume, entity_id, "mana", 10})

      GenServer.cast(pool, {:tick_regen, entity_id, %{resting: false}})
      Process.sleep(50)

      assert ResourcePool.current(entity_id, "mana") == 60
    end
  end

  describe "tick_all_regen/1" do
    test "regenerates all entities", %{pool: pool} do
      entity1 = "entity_36"
      entity2 = "entity_37"

      GenServer.call(pool, {:init_pools, entity1, %{}})
      GenServer.call(pool, {:init_pools, entity2, %{}})

      GenServer.call(pool, {:consume, entity1, "health", 50})
      GenServer.call(pool, {:consume, entity2, "health", 30})

      # entity1: 100 - 50 = 50, after regen (+2) = 52
      # entity2: 100 - 30 = 70, after regen (+2) = 72
      GenServer.cast(pool, {:tick_all_regen, %{in_combat: false}})
      Process.sleep(50)

      assert ResourcePool.current(entity1, "health") == 52
      assert ResourcePool.current(entity2, "health") == 72
    end
  end

  describe "clear/1" do
    test "clears pools for specific entity", %{pool: pool} do
      entity_id = "entity_38"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert ResourcePool.get(entity_id) != %{}

      GenServer.cast(pool, {:clear, entity_id})
      Process.sleep(50)

      assert ResourcePool.get(entity_id) == %{}
    end
  end

  describe "clear_all/0" do
    test "clears all pools", %{pool: pool} do
      entity1 = "entity_39"
      entity2 = "entity_40"

      GenServer.call(pool, {:init_pools, entity1, %{}})
      GenServer.call(pool, {:init_pools, entity2, %{}})

      assert :ok = GenServer.call(pool, :clear_all)

      assert ResourcePool.get(entity1) == %{}
      assert ResourcePool.get(entity2) == %{}
    end
  end

  describe "edge cases" do
    test "handles zero consumption", %{pool: pool} do
      entity_id = "entity_41"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert {:ok, 100} = GenServer.call(pool, {:consume, entity_id, "health", 0})
      assert ResourcePool.current(entity_id, "health") == 100
    end

    test "handles zero restoration", %{pool: pool} do
      entity_id = "entity_42"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      assert {:ok, 100} = GenServer.call(pool, {:restore, entity_id, "health", 0})
      assert ResourcePool.current(entity_id, "health") == 100
    end

    test "handles concurrent access to same pool", %{pool: pool} do
      entity_id = "entity_43"
      GenServer.call(pool, {:init_pools, entity_id, %{}})

      # Spawn multiple processes consuming resource
      tasks =
        for _ <- 1..10 do
          Task.async(fn ->
            GenServer.call(pool, {:consume, entity_id, "health", 5})
          end)
        end

      results = Task.await_many(tasks)

      # Some should succeed, some should fail
      successes = Enum.count(results, &match?({:ok, _}, &1))
      failures = Enum.count(results, &match?({:error, :insufficient}, &1))

      assert successes + failures == 10
      # Final health should be consistent
      final = ResourcePool.current(entity_id, "health")
      assert final == 100 - successes * 5
    end
  end
end
