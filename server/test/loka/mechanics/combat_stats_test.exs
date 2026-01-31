defmodule Loka.Mechanics.CombatStatsTest do
  use Loka.DataCase, async: true

  alias Loka.Mechanics.CombatStats

  # Test character builds
  @warrior_stats %{str: 100, dex: 40, con: 80, int: 20, per: 40, spi: 20}
  @mage_stats %{str: 20, dex: 30, con: 40, int: 80, per: 30, spi: 100}
  @rogue_stats %{str: 30, dex: 100, con: 30, int: 30, per: 80, spi: 30}
  @balanced_stats %{str: 50, dex: 50, con: 50, int: 50, per: 50, spi: 50}

  describe "slashing_bonus/1" do
    test "calculates from STR / 3" do
      # STR 100 / 3 = 33
      assert CombatStats.slashing_bonus(@warrior_stats) == 33
    end

    test "handles low STR" do
      stats = %{str: 9}
      # 9 / 3 = 3
      assert CombatStats.slashing_bonus(stats) == 3
    end
  end

  describe "piercing_bonus/1" do
    test "calculates from DEX / 3" do
      # DEX 100 / 3 = 33
      assert CombatStats.piercing_bonus(@rogue_stats) == 33
    end
  end

  describe "bludgeoning_bonus/1" do
    test "calculates from CON / 3" do
      # CON 80 / 3 = 26
      assert CombatStats.bludgeoning_bonus(@warrior_stats) == 26
    end
  end

  describe "spell_bonus/1" do
    test "calculates from INT / 3" do
      # INT 80 / 3 = 26
      assert CombatStats.spell_bonus(@mage_stats) == 26
    end
  end

  describe "healing_bonus/1" do
    test "calculates from SPI / 3" do
      # SPI 100 / 3 = 33
      assert CombatStats.healing_bonus(@mage_stats) == 33
    end
  end

  describe "damage_bonus/2" do
    test "returns correct bonus for each damage type" do
      assert CombatStats.damage_bonus(@warrior_stats, :slashing) == 33
      assert CombatStats.damage_bonus(@rogue_stats, :piercing) == 33
      assert CombatStats.damage_bonus(@warrior_stats, :bludgeoning) == 26
      assert CombatStats.damage_bonus(@mage_stats, :magic) == 26
    end

    test "returns 0 for unknown damage type" do
      assert CombatStats.damage_bonus(@warrior_stats, :unknown) == 0
    end
  end

  describe "hit_bonus/1" do
    test "calculates from DEX/4 + PER/6" do
      # DEX 40/4 + PER 40/6 = 10 + 6 = 16
      assert CombatStats.hit_bonus(@warrior_stats) == 16
    end

    test "rogue has higher hit bonus" do
      # DEX 100/4 + PER 80/6 = 25 + 13 = 38
      assert CombatStats.hit_bonus(@rogue_stats) == 38
    end
  end

  describe "crit_chance/1" do
    test "calculates from PER / 5" do
      # PER 80 / 5 = 16%
      assert CombatStats.crit_chance(@rogue_stats) == 16
    end

    test "caps at 20%" do
      high_per_stats = %{per: 150}
      # Would be 30%, but capped at 20%
      assert CombatStats.crit_chance(high_per_stats) == 20
    end

    test "returns 0 for very low PER" do
      stats = %{per: 4}
      assert CombatStats.crit_chance(stats) == 0
    end
  end

  describe "dodge_chance/1" do
    test "calculates from DEX / 5" do
      # DEX 100 / 5 = 20%
      assert CombatStats.dodge_chance(@rogue_stats) == 20
    end

    test "caps at 20%" do
      high_dex_stats = %{dex: 150}
      assert CombatStats.dodge_chance(high_dex_stats) == 20
    end

    test "warrior has lower dodge" do
      # DEX 40 / 5 = 8%
      assert CombatStats.dodge_chance(@warrior_stats) == 8
    end
  end

  describe "magic_resist/1" do
    test "calculates from SPI / 4" do
      # SPI 100 / 4 = 25%
      assert CombatStats.magic_resist(@mage_stats) == 25
    end

    test "caps at 25%" do
      high_spi_stats = %{spi: 150}
      assert CombatStats.magic_resist(high_spi_stats) == 25
    end
  end

  describe "poison_resist/1" do
    test "calculates from CON / 4" do
      # CON 80 / 4 = 20%
      assert CombatStats.poison_resist(@warrior_stats) == 20
    end

    test "caps at 25%" do
      high_con_stats = %{con: 150}
      assert CombatStats.poison_resist(high_con_stats) == 25
    end
  end

  describe "all/1" do
    test "returns all combat stats" do
      result = CombatStats.all(@balanced_stats)

      assert result.slashing_bonus == 16
      assert result.piercing_bonus == 16
      assert result.bludgeoning_bonus == 16
      assert result.spell_bonus == 16
      assert result.healing_bonus == 16
      assert result.hit_bonus == 20
      assert result.crit_chance == 10
      assert result.dodge_chance == 10
      assert result.magic_resist == 12
      assert result.poison_resist == 12
    end
  end

  describe "offensive/1" do
    test "returns only offensive stats" do
      result = CombatStats.offensive(@warrior_stats)

      assert Map.has_key?(result, :slashing_bonus)
      assert Map.has_key?(result, :hit_bonus)
      assert Map.has_key?(result, :crit_chance)
      refute Map.has_key?(result, :dodge_chance)
      refute Map.has_key?(result, :magic_resist)
    end
  end

  describe "defensive/1" do
    test "returns only defensive stats" do
      result = CombatStats.defensive(@warrior_stats)

      assert Map.has_key?(result, :dodge_chance)
      assert Map.has_key?(result, :magic_resist)
      assert Map.has_key?(result, :poison_resist)
      refute Map.has_key?(result, :slashing_bonus)
    end
  end

  describe "defense_target/1" do
    test "calculates as 10 + DEX/5" do
      # 10 + 40/5 = 10 + 8 = 18
      assert CombatStats.defense_target(@warrior_stats) == 18
    end

    test "high DEX gives higher defense target" do
      # 10 + 100/5 = 10 + 20 = 30
      assert CombatStats.defense_target(@rogue_stats) == 30
    end
  end

  describe "resistance_multiplier/2" do
    test "magic damage uses magic_resist" do
      # SPI 100 / 4 = 25% resist = 0.75 multiplier
      assert_in_delta CombatStats.resistance_multiplier(@mage_stats, :magic), 0.75, 0.01
    end

    test "fire/ice/lightning use magic_resist" do
      assert_in_delta CombatStats.resistance_multiplier(@mage_stats, :fire), 0.75, 0.01
      assert_in_delta CombatStats.resistance_multiplier(@mage_stats, :ice), 0.75, 0.01
      assert_in_delta CombatStats.resistance_multiplier(@mage_stats, :lightning), 0.75, 0.01
    end

    test "poison uses poison_resist" do
      # CON 80 / 4 = 20% resist = 0.80 multiplier
      assert_in_delta CombatStats.resistance_multiplier(@warrior_stats, :poison), 0.80, 0.01
    end

    test "physical damage types have no resistance" do
      assert CombatStats.resistance_multiplier(@warrior_stats, :slashing) == 1.0
      assert CombatStats.resistance_multiplier(@warrior_stats, :piercing) == 1.0
      assert CombatStats.resistance_multiplier(@warrior_stats, :bludgeoning) == 1.0
    end
  end

  describe "mana_cost_multiplier/1" do
    test "high INT reduces mana costs" do
      # 1 - (80 / 200) = 1 - 0.4 = 0.6 (40% reduction)
      assert_in_delta CombatStats.mana_cost_multiplier(@mage_stats), 0.6, 0.01
    end

    test "no INT means full cost" do
      stats = %{int: 0}
      assert CombatStats.mana_cost_multiplier(stats) == 1.0
    end

    test "INT 100 gives 50% reduction" do
      stats = %{int: 100}
      # 1 - (100 / 200) = 0.5
      assert CombatStats.mana_cost_multiplier(stats) == 0.5
    end
  end

  describe "spell_power_multiplier/1" do
    test "high INT increases spell damage" do
      # 1 + (80 / 100) = 1.8
      assert_in_delta CombatStats.spell_power_multiplier(@mage_stats), 1.8, 0.01
    end

    test "no INT means base damage" do
      stats = %{int: 0}
      assert CombatStats.spell_power_multiplier(stats) == 1.0
    end

    test "INT 100 doubles spell damage" do
      stats = %{int: 100}
      assert CombatStats.spell_power_multiplier(stats) == 2.0
    end
  end

  describe "heal_power_multiplier/1" do
    test "high SPI increases healing" do
      # 1 + (100 / 100) = 2.0
      assert_in_delta CombatStats.heal_power_multiplier(@mage_stats), 2.0, 0.01
    end

    test "no SPI means base healing" do
      stats = %{spi: 0}
      assert CombatStats.heal_power_multiplier(stats) == 1.0
    end
  end

  describe "cap constants" do
    test "crit_cap is 20" do
      assert CombatStats.crit_cap() == 20
    end

    test "dodge_cap is 20" do
      assert CombatStats.dodge_cap() == 20
    end

    test "magic_resist_cap is 25" do
      assert CombatStats.magic_resist_cap() == 25
    end

    test "poison_resist_cap is 25" do
      assert CombatStats.poison_resist_cap() == 25
    end
  end

  describe "string key handling" do
    test "handles string keys" do
      stats = %{"str" => 60, "dex" => 40}
      assert CombatStats.slashing_bonus(stats) == 20
      assert CombatStats.piercing_bonus(stats) == 13
    end
  end

  describe "design doc verification" do
    test "STR 60 gives +20 slashing" do
      stats = %{str: 60}
      assert CombatStats.slashing_bonus(stats) == 20
    end

    test "PER 40 gives 8% crit" do
      stats = %{per: 40}
      # 40 / 5 = 8
      assert CombatStats.crit_chance(stats) == 8
    end

    test "DEX 40 gives 8% dodge" do
      stats = %{dex: 40}
      assert CombatStats.dodge_chance(stats) == 8
    end
  end
end
