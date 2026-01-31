defmodule Loka.Mechanics.StatsTest do
  use Loka.DataCase, async: true

  alias Loka.Mechanics.Stats

  describe "all/0" do
    test "returns all six stat keys" do
      assert Stats.all() == [:str, :dex, :con, :int, :per, :spi]
    end
  end

  describe "default/0" do
    test "returns default stats with 10 in each" do
      stats = Stats.default()

      assert stats.str == 10
      assert stats.dex == 10
      assert stats.con == 10
      assert stats.int == 10
      assert stats.per == 10
      assert stats.spi == 10
    end

    test "default stats total 60" do
      assert Stats.total(Stats.default()) == 60
    end
  end

  describe "total/1" do
    test "calculates total stat points" do
      stats = %{str: 15, dex: 12, con: 10, int: 8, per: 8, spi: 7}
      assert Stats.total(stats) == 60
    end

    test "handles missing stats as 0" do
      stats = %{str: 10}
      assert Stats.total(stats) == 10
    end
  end

  describe "points_at_level/1" do
    test "level 1 has creation pool (60 points)" do
      assert Stats.points_at_level(1) == 60
    end

    test "level 2 has 65 points (60 + 5)" do
      assert Stats.points_at_level(2) == 65
    end

    test "level 10 has 105 points (60 + 9*5)" do
      assert Stats.points_at_level(10) == 105
    end

    test "level 50 has 305 points (60 + 49*5)" do
      assert Stats.points_at_level(50) == 305
    end
  end

  describe "unspent_points/2" do
    test "returns unspent points at level 1" do
      stats = %{str: 10, dex: 10, con: 10, int: 10, per: 10, spi: 10}
      assert Stats.unspent_points(stats, 1) == 0
    end

    test "returns unspent points after level up" do
      stats = %{str: 10, dex: 10, con: 10, int: 10, per: 10, spi: 10}
      # Level 2 gives 5 more points
      assert Stats.unspent_points(stats, 2) == 5
    end
  end

  describe "validate_creation/1" do
    test "accepts valid creation stats" do
      stats = %{str: 15, dex: 12, con: 10, int: 8, per: 8, spi: 7}
      assert {:ok, validated} = Stats.validate_creation(stats)
      assert validated.str == 15
    end

    test "accepts stats with exactly 60 points" do
      stats = %{str: 10, dex: 10, con: 10, int: 10, per: 10, spi: 10}
      assert {:ok, _} = Stats.validate_creation(stats)
    end

    test "accepts stats with min 5 in each" do
      stats = %{str: 30, dex: 5, con: 5, int: 5, per: 10, spi: 5}
      assert {:ok, _} = Stats.validate_creation(stats)
    end

    test "accepts stats with max 30 in one" do
      stats = %{str: 30, dex: 10, con: 5, int: 5, per: 5, spi: 5}
      assert {:ok, _} = Stats.validate_creation(stats)
    end

    test "rejects stats with wrong total" do
      stats = %{str: 15, dex: 15, con: 15, int: 15, per: 10, spi: 10}
      assert {:error, {:invalid_total, 80, 60}} = Stats.validate_creation(stats)
    end

    test "rejects stat below minimum (5)" do
      stats = %{str: 3, dex: 17, con: 10, int: 10, per: 10, spi: 10}
      assert {:error, {:stat_below_min, :str, 3, 5}} = Stats.validate_creation(stats)
    end

    test "rejects stat above maximum (30)" do
      stats = %{str: 35, dex: 5, con: 5, int: 5, per: 5, spi: 5}
      assert {:error, {:stat_above_max, :str, 35, 30}} = Stats.validate_creation(stats)
    end

    test "rejects missing stats" do
      stats = %{str: 10, dex: 10, con: 10}
      assert {:error, {:missing_stats, missing}} = Stats.validate_creation(stats)
      assert :int in missing
      assert :per in missing
      assert :spi in missing
    end

    test "normalizes string keys to atoms" do
      stats = %{"str" => 10, "dex" => 10, "con" => 10, "int" => 10, "per" => 10, "spi" => 10}
      assert {:ok, validated} = Stats.validate_creation(stats)
      assert Map.has_key?(validated, :str)
      refute Map.has_key?(validated, "str")
    end
  end

  describe "validate/1" do
    test "accepts any valid stat values" do
      stats = %{str: 100, dex: 100, con: 100, int: 100, per: 100, spi: 100}
      assert {:ok, _} = Stats.validate(stats)
    end

    test "rejects stats above max (100)" do
      stats = %{str: 150, dex: 10, con: 10, int: 10, per: 10, spi: 10}
      assert {:error, {:stat_above_max, :str, 150, 100}} = Stats.validate(stats)
    end

    test "rejects negative stats" do
      stats = %{str: -5, dex: 10, con: 10, int: 10, per: 10, spi: 10}
      assert {:error, {:stat_below_min, :str, -5, 0}} = Stats.validate(stats)
    end
  end

  describe "allocate/4" do
    test "allocates points to a stat" do
      stats = %{str: 10, dex: 10, con: 10, int: 10, per: 10, spi: 10}

      # Level 2 gives 5 extra points
      assert {:ok, new_stats, audit} = Stats.allocate(stats, :str, 3, level: 2)

      assert new_stats.str == 13
      assert audit.operation == :allocate_stat
      assert audit.stat == :str
      assert audit.before == 10
      assert audit.after == 13
    end

    test "returns error when insufficient points" do
      stats = %{str: 10, dex: 10, con: 10, int: 10, per: 10, spi: 10}

      # Level 1 has 0 unspent points
      assert {:error, {:insufficient_points, 0, 3}} = Stats.allocate(stats, :str, 3, level: 1)
    end

    test "returns error when would exceed max stat" do
      stats = %{str: 99, dex: 10, con: 10, int: 10, per: 10, spi: 10}

      # Would make STR 101, exceeds max 100
      assert {:error, {:exceeds_max, :str, 101, 100}} = Stats.allocate(stats, :str, 2, level: 50)
    end

    test "returns error for invalid stat key" do
      stats = %{str: 10, dex: 10, con: 10, int: 10, per: 10, spi: 10}
      assert {:error, {:invalid_stat, :invalid}} = Stats.allocate(stats, :invalid, 1, level: 2)
    end
  end

  describe "allocate_many/3" do
    test "allocates multiple stats at once" do
      stats = %{str: 10, dex: 10, con: 10, int: 10, per: 10, spi: 10}
      allocations = %{str: 2, dex: 2, con: 1}

      assert {:ok, new_stats, audit} = Stats.allocate_many(stats, allocations, level: 2)

      assert new_stats.str == 12
      assert new_stats.dex == 12
      assert new_stats.con == 11
      assert audit.operation == :allocate_stats
      assert audit.total_points_spent == 5
    end

    test "returns error when insufficient points for total" do
      stats = %{str: 10, dex: 10, con: 10, int: 10, per: 10, spi: 10}
      allocations = %{str: 5, dex: 5}

      # Level 2 only has 5 points, trying to spend 10
      assert {:error, {:insufficient_points, 5, 10}} =
               Stats.allocate_many(stats, allocations, level: 2)
    end

    test "returns error when any allocation would exceed max" do
      stats = %{str: 99, dex: 10, con: 10, int: 10, per: 10, spi: 10}
      allocations = %{str: 2, dex: 1}

      assert {:error, {:exceeds_max, :str, 101, 100}} =
               Stats.allocate_many(stats, allocations, level: 50)
    end
  end

  describe "get/3" do
    test "gets stat value" do
      stats = %{str: 15, dex: 10, con: 10, int: 10, per: 10, spi: 10}
      assert Stats.get(stats, :str) == 15
    end

    test "returns default for missing stat" do
      stats = %{str: 15}
      assert Stats.get(stats, :dex, 5) == 5
    end
  end

  describe "name/1 and abbrev/1" do
    test "returns correct names" do
      assert Stats.name(:str) == "Strength"
      assert Stats.name(:dex) == "Dexterity"
      assert Stats.name(:con) == "Constitution"
      assert Stats.name(:int) == "Intelligence"
      assert Stats.name(:per) == "Perception"
      assert Stats.name(:spi) == "Spirit"
    end

    test "returns correct abbreviations" do
      assert Stats.abbrev(:str) == "STR"
      assert Stats.abbrev(:dex) == "DEX"
      assert Stats.abbrev(:con) == "CON"
      assert Stats.abbrev(:int) == "INT"
      assert Stats.abbrev(:per) == "PER"
      assert Stats.abbrev(:spi) == "SPI"
    end
  end

  describe "constants" do
    test "creation_pool returns 60" do
      assert Stats.creation_pool() == 60
    end

    test "creation_min returns 5" do
      assert Stats.creation_min() == 5
    end

    test "creation_max returns 30" do
      assert Stats.creation_max() == 30
    end

    test "points_per_level returns 5" do
      assert Stats.points_per_level() == 5
    end

    test "max_stat returns 100" do
      assert Stats.max_stat() == 100
    end

    test "max_level returns 50" do
      assert Stats.max_level() == 50
    end
  end

  describe "design doc examples" do
    # Verify the formulas match core-mechanics-design.md

    test "level 50 warrior build has correct point total" do
      # From design doc: Pure Warrior (CON 80)
      # 60 base + 49*5 = 305 points available
      assert Stats.points_at_level(50) == 305
    end

    test "warrior build with 300 points is valid" do
      # STR 100, DEX 40, CON 80, INT 20, PER 40, SPI 20 = 300 points
      stats = %{str: 100, dex: 40, con: 80, int: 20, per: 40, spi: 20}
      assert Stats.total(stats) == 300
      assert {:ok, _} = Stats.validate(stats)
    end

    test "mage build with 300 points is valid" do
      # STR 20, DEX 30, CON 40, INT 80, PER 30, SPI 100 = 300 points
      stats = %{str: 20, dex: 30, con: 40, int: 80, per: 30, spi: 100}
      assert Stats.total(stats) == 300
      assert {:ok, _} = Stats.validate(stats)
    end
  end
end
