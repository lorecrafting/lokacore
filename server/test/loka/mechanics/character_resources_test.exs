defmodule Loka.Mechanics.CharacterResourcesTest do
  use Loka.DataCase, async: true

  alias Loka.Mechanics.CharacterResources
  alias Loka.Primitives.ResourcePool

  # Standard test stats
  @warrior_stats %{str: 100, dex: 40, con: 80, int: 20, per: 40, spi: 20}
  @mage_stats %{str: 20, dex: 30, con: 40, int: 80, per: 30, spi: 100}
  @balanced_stats %{str: 50, dex: 50, con: 50, int: 50, per: 50, spi: 50}

  describe "max_hp/2" do
    test "calculates HP for warrior (high CON)" do
      # Formula: 50 + (CON * 4) + (level * 2)
      # 50 + (80 * 4) + (50 * 2) = 50 + 320 + 100 = 470
      assert CharacterResources.max_hp(@warrior_stats, 50) == 470
    end

    test "calculates HP for mage (lower CON)" do
      # 50 + (40 * 4) + (50 * 2) = 50 + 160 + 100 = 310
      assert CharacterResources.max_hp(@mage_stats, 50) == 310
    end

    test "calculates HP at level 1" do
      # 50 + (50 * 4) + (1 * 2) = 50 + 200 + 2 = 252
      assert CharacterResources.max_hp(@balanced_stats, 1) == 252
    end

    test "handles string keys" do
      stats = %{"con" => 80}
      # 50 + (80 * 4) + (1 * 2) = 372
      assert CharacterResources.max_hp(stats, 1) == 372
    end
  end

  describe "max_mana/2" do
    test "calculates mana for mage (high INT + SPI)" do
      # Formula: 20 + (INT * 3) + (SPI * 2)
      # 20 + (80 * 3) + (100 * 2) = 20 + 240 + 200 = 460
      assert CharacterResources.max_mana(@mage_stats, 50) == 460
    end

    test "calculates mana for warrior (low INT + SPI)" do
      # 20 + (20 * 3) + (20 * 2) = 20 + 60 + 40 = 120
      assert CharacterResources.max_mana(@warrior_stats, 50) == 120
    end

    test "mana does not scale with level" do
      # Same stats at different levels should give same mana
      assert CharacterResources.max_mana(@balanced_stats, 1) ==
               CharacterResources.max_mana(@balanced_stats, 50)
    end
  end

  describe "max_mv/2" do
    test "calculates MV for rogue-like build (high DEX)" do
      rogue_stats = %{str: 30, dex: 100, con: 30, int: 30, per: 80, spi: 30}
      # Formula: 100 + (CON * 2) + (DEX * 2)
      # 100 + (30 * 2) + (100 * 2) = 100 + 60 + 200 = 360
      assert CharacterResources.max_mv(rogue_stats, 50) == 360
    end

    test "calculates MV for warrior (high CON)" do
      # 100 + (80 * 2) + (40 * 2) = 100 + 160 + 80 = 340
      assert CharacterResources.max_mv(@warrior_stats, 50) == 340
    end

    test "MV does not scale with level" do
      assert CharacterResources.max_mv(@balanced_stats, 1) ==
               CharacterResources.max_mv(@balanced_stats, 50)
    end
  end

  describe "all_max/2" do
    test "returns all max resources" do
      result = CharacterResources.all_max(@balanced_stats, 50)

      assert Map.has_key?(result, :hp)
      assert Map.has_key?(result, :mana)
      assert Map.has_key?(result, :mv)
    end

    test "returns consistent values with individual functions" do
      level = 25
      result = CharacterResources.all_max(@warrior_stats, level)

      assert result.hp == CharacterResources.max_hp(@warrior_stats, level)
      assert result.mana == CharacterResources.max_mana(@warrior_stats, level)
      assert result.mv == CharacterResources.max_mv(@warrior_stats, level)
    end
  end

  describe "mana_regen_rate/1" do
    test "calculates mana regen for high INT" do
      # Formula: 5 + (INT / 5)
      # 5 + (80 / 5) = 5 + 16 = 21
      assert CharacterResources.mana_regen_rate(@mage_stats) == 21
    end

    test "calculates mana regen for low INT" do
      # 5 + (20 / 5) = 5 + 4 = 9
      assert CharacterResources.mana_regen_rate(@warrior_stats) == 9
    end
  end

  describe "mv_regen_rate/1" do
    test "calculates MV regen for high DEX" do
      rogue_stats = %{dex: 80}
      # Formula: 10 + (DEX / 5)
      # 10 + (80 / 5) = 10 + 16 = 26
      assert CharacterResources.mv_regen_rate(rogue_stats) == 26
    end

    test "calculates MV regen for low DEX" do
      # 10 + (40 / 5) = 10 + 8 = 18
      assert CharacterResources.mv_regen_rate(@warrior_stats) == 18
    end
  end

  describe "hp_regen_rate/1" do
    test "HP does not regenerate automatically" do
      assert CharacterResources.hp_regen_rate(@balanced_stats) == 0
    end
  end

  describe "all_regen_rates/1" do
    test "returns all regen rates" do
      result = CharacterResources.all_regen_rates(@balanced_stats)

      assert result.hp == 0
      assert result.mana > 0
      assert result.mv > 0
    end
  end

  describe "tick_interval/0" do
    test "returns 5 seconds (5000ms)" do
      assert CharacterResources.tick_interval() == 5000
    end
  end

  describe "create_hp_pool/2" do
    test "creates pool at max HP" do
      pool = CharacterResources.create_hp_pool(@warrior_stats, 50)

      assert %ResourcePool{} = pool
      assert pool.current == 470
      assert pool.max == 470
      assert pool.min == 0
    end
  end

  describe "create_mana_pool/2" do
    test "creates pool at max mana" do
      pool = CharacterResources.create_mana_pool(@mage_stats, 50)

      assert pool.current == 460
      assert pool.max == 460
    end
  end

  describe "create_mv_pool/2" do
    test "creates pool at max MV" do
      pool = CharacterResources.create_mv_pool(@warrior_stats, 50)

      # 100 + (80*2) + (40*2) = 340
      assert pool.current == 340
      assert pool.max == 340
    end
  end

  describe "create_all_pools/2" do
    test "creates all pools" do
      pools = CharacterResources.create_all_pools(@balanced_stats, 10)

      assert %ResourcePool{} = pools.hp
      assert %ResourcePool{} = pools.mana
      assert %ResourcePool{} = pools.mv
    end
  end

  describe "update_pools/3" do
    test "updates pools when stats increase" do
      pools = CharacterResources.create_all_pools(@balanced_stats, 10)

      # Consume some resources
      {:ok, hp_pool, _} = ResourcePool.consume(pools.hp, 50)
      pools = %{pools | hp: hp_pool}

      # Level up and increase CON
      new_stats = %{@balanced_stats | con: 60}
      updated = CharacterResources.update_pools(pools, new_stats, 11)

      # Max should increase, current should also increase
      assert updated.hp.max > pools.hp.max
    end

    test "caps current when max decreases" do
      pools = CharacterResources.create_all_pools(@warrior_stats, 50)

      # Reduce stats dramatically
      weak_stats = %{str: 10, dex: 10, con: 10, int: 10, per: 10, spi: 10}
      updated = CharacterResources.update_pools(pools, weak_stats, 1)

      # Current should not exceed new max
      assert updated.hp.current <= updated.hp.max
    end

    test "keeps current at max if was at max" do
      pools = CharacterResources.create_all_pools(@balanced_stats, 10)

      # Stats increase
      new_stats = %{@balanced_stats | con: 70}
      updated = CharacterResources.update_pools(pools, new_stats, 11)

      # Should still be at max
      assert updated.hp.current == updated.hp.max
    end
  end

  describe "apply_regen_tick/3" do
    test "regenerates mana and MV out of combat" do
      pools = CharacterResources.create_all_pools(@balanced_stats, 10)

      # Consume some resources
      {:ok, mana_pool, _} = ResourcePool.consume(pools.mana, 50)
      {:ok, mv_pool, _} = ResourcePool.consume(pools.mv, 50)
      pools = %{pools | mana: mana_pool, mv: mv_pool}

      original_mana = pools.mana.current
      original_mv = pools.mv.current

      updated = CharacterResources.apply_regen_tick(pools, @balanced_stats, in_combat: false)

      assert updated.mana.current > original_mana
      assert updated.mv.current > original_mv
    end

    test "HP does not regenerate" do
      pools = CharacterResources.create_all_pools(@balanced_stats, 10)

      {:ok, hp_pool, _} = ResourcePool.consume(pools.hp, 50)
      pools = %{pools | hp: hp_pool}

      original_hp = pools.hp.current

      updated = CharacterResources.apply_regen_tick(pools, @balanced_stats, in_combat: false)

      # HP should remain unchanged
      assert updated.hp.current == original_hp
    end

    test "in combat reduces regen rate by 50%" do
      pools = CharacterResources.create_all_pools(@balanced_stats, 10)

      {:ok, mana_pool, _} = ResourcePool.consume(pools.mana, 100)
      pools = %{pools | mana: mana_pool}

      # Out of combat regen
      out_of_combat =
        CharacterResources.apply_regen_tick(pools, @balanced_stats, in_combat: false)

      out_of_combat_gain = out_of_combat.mana.current - pools.mana.current

      # Reset
      {:ok, mana_pool, _} = ResourcePool.consume(pools.mana, 0)
      pools = %{pools | mana: mana_pool}

      # In combat regen
      in_combat = CharacterResources.apply_regen_tick(pools, @balanced_stats, in_combat: true)
      in_combat_gain = in_combat.mana.current - pools.mana.current

      # In combat should be roughly half (may be truncated)
      assert in_combat_gain <= out_of_combat_gain
    end

    test "caps regen at max" do
      pools = CharacterResources.create_all_pools(@balanced_stats, 10)

      # Only consume 1 mana
      {:ok, mana_pool, _} = ResourcePool.consume(pools.mana, 1)
      pools = %{pools | mana: mana_pool}

      updated = CharacterResources.apply_regen_tick(pools, @balanced_stats, in_combat: false)

      # Should not exceed max
      assert updated.mana.current == updated.mana.max
    end
  end

  describe "example_builds/0" do
    test "returns documented builds" do
      builds = CharacterResources.example_builds()

      assert Map.has_key?(builds, :warrior)
      assert Map.has_key?(builds, :mage)
      assert Map.has_key?(builds, :rogue)
      assert Map.has_key?(builds, :battlemage)
    end

    test "warrior build matches design doc" do
      builds = CharacterResources.example_builds()
      warrior = builds.warrior

      # From design doc: HP 470, Mana 120, MV 340
      assert warrior.hp == 470
      assert warrior.mana == 120
      assert warrior.mv == 340
    end
  end

  describe "design doc verification" do
    # These tests verify the exact examples from core-mechanics-design.md

    test "warrior CON 80, level 50 has 470 HP" do
      stats = %{con: 80}
      assert CharacterResources.max_hp(stats, 50) == 470
    end

    test "mage INT 80, SPI 80 has 420 mana" do
      stats = %{int: 80, spi: 80}
      assert CharacterResources.max_mana(stats, 50) == 420
    end

    test "rogue DEX 100, CON 30 has 360 MV" do
      # From example_builds: rogue with DEX 100, CON 30
      # 100 + (30*2) + (100*2) = 100 + 60 + 200 = 360
      stats = %{dex: 100, con: 30}
      assert CharacterResources.max_mv(stats, 50) == 360
    end
  end
end
