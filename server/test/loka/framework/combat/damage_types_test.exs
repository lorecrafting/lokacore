defmodule Loka.Framework.Combat.DamageTypesTest do
  use ExUnit.Case, async: false

  alias Loka.Framework.Combat.DamageTypes

  # Start a fresh GenServer for each test with unique name
  setup do
    name = :"damage_types_test_#{System.unique_integer([:positive])}"
    {:ok, pid} = DamageTypes.start_link(name: name)
    on_exit(fn -> Process.exit(pid, :normal) end)
    {:ok, server: name}
  end

  describe "get_damage_type/2" do
    test "returns slashing damage type definition", %{server: server} do
      assert {:ok, dt} = DamageTypes.get_damage_type(:slashing, server)
      assert dt.key == :slashing
      assert dt.name == "Slashing"
      assert :cloth in dt.effective_against
      assert :leather in dt.effective_against
      assert :plate in dt.weak_against
    end

    test "returns piercing damage type definition", %{server: server} do
      assert {:ok, dt} = DamageTypes.get_damage_type(:piercing, server)
      assert dt.key == :piercing
      assert :leather in dt.effective_against
      assert :hide in dt.effective_against
      assert :plate in dt.weak_against
    end

    test "returns bludgeoning damage type definition", %{server: server} do
      assert {:ok, dt} = DamageTypes.get_damage_type(:bludgeoning, server)
      assert dt.key == :bludgeoning
      assert :plate in dt.effective_against
      assert :bone in dt.effective_against
      assert :cloth in dt.weak_against
    end

    test "returns cleaving damage type definition", %{server: server} do
      assert {:ok, dt} = DamageTypes.get_damage_type(:cleaving, server)
      assert dt.key == :cleaving
      assert :hide in dt.effective_against
    end

    test "returns error for unknown damage type", %{server: server} do
      assert {:error, :not_found} = DamageTypes.get_damage_type(:unknown, server)
    end

    test "handles string key input", %{server: server} do
      assert {:ok, dt} = DamageTypes.get_damage_type("slashing", server)
      assert dt.key == :slashing
    end
  end

  describe "get_armor_type/2" do
    test "returns cloth armor type", %{server: server} do
      assert {:ok, at} = DamageTypes.get_armor_type(:cloth, server)
      assert at.key == :cloth
      assert at.name == "Cloth"
    end

    test "returns plate armor type", %{server: server} do
      assert {:ok, at} = DamageTypes.get_armor_type(:plate, server)
      assert at.key == :plate
      assert at.name == "Plate"
    end

    test "returns error for unknown armor type", %{server: server} do
      assert {:error, :not_found} = DamageTypes.get_armor_type(:unknown, server)
    end
  end

  describe "all_damage_types/1" do
    test "returns all damage types", %{server: server} do
      damage_types = DamageTypes.all_damage_types(server)
      assert length(damage_types) == 4
      keys = Enum.map(damage_types, & &1.key)
      assert :slashing in keys
      assert :piercing in keys
      assert :bludgeoning in keys
      assert :cleaving in keys
    end
  end

  describe "all_armor_types/1" do
    test "returns all armor types", %{server: server} do
      armor_types = DamageTypes.all_armor_types(server)
      assert length(armor_types) == 9
      keys = Enum.map(armor_types, & &1.key)
      assert :none in keys
      assert :cloth in keys
      assert :leather in keys
      assert :hide in keys
      assert :chain in keys
      assert :plate in keys
      assert :bone in keys
      assert :stone in keys
      assert :scale in keys
    end
  end

  describe "calculate_modifier/3" do
    test "returns effective multiplier for slashing vs cloth", %{server: server} do
      assert DamageTypes.calculate_modifier(:slashing, :cloth, server) == 1.25
    end

    test "returns effective multiplier for slashing vs leather", %{server: server} do
      assert DamageTypes.calculate_modifier(:slashing, :leather, server) == 1.25
    end

    test "returns weak multiplier for slashing vs plate", %{server: server} do
      assert DamageTypes.calculate_modifier(:slashing, :plate, server) == 0.75
    end

    test "returns neutral multiplier for slashing vs chain", %{server: server} do
      assert DamageTypes.calculate_modifier(:slashing, :chain, server) == 1.0
    end

    test "returns effective multiplier for bludgeoning vs plate", %{server: server} do
      assert DamageTypes.calculate_modifier(:bludgeoning, :plate, server) == 1.25
    end

    test "returns neutral for nil damage type", %{server: server} do
      assert DamageTypes.calculate_modifier(nil, :cloth, server) == 1.0
    end

    test "returns neutral for nil armor type", %{server: server} do
      assert DamageTypes.calculate_modifier(:slashing, nil, server) == 1.0
    end

    test "returns neutral for :none armor type", %{server: server} do
      assert DamageTypes.calculate_modifier(:slashing, :none, server) == 1.0
    end

    test "returns neutral for unknown damage type", %{server: server} do
      assert DamageTypes.calculate_modifier(:unknown, :cloth, server) == 1.0
    end
  end

  describe "apply_modifier/4" do
    test "applies effective modifier to base damage", %{server: server} do
      assert DamageTypes.apply_modifier(20, :slashing, :cloth, server) == 25
    end

    test "applies weak modifier to base damage", %{server: server} do
      assert DamageTypes.apply_modifier(20, :slashing, :plate, server) == 15
    end

    test "applies neutral modifier to base damage", %{server: server} do
      assert DamageTypes.apply_modifier(20, :slashing, :chain, server) == 20
    end

    test "rounds to nearest integer", %{server: server} do
      # 17 * 1.25 = 21.25 -> 21
      assert DamageTypes.apply_modifier(17, :slashing, :cloth, server) == 21
    end
  end

  describe "get_relationship/3" do
    test "returns effective for slashing vs cloth", %{server: server} do
      assert DamageTypes.get_relationship(:slashing, :cloth, server) == :effective
    end

    test "returns weak for slashing vs plate", %{server: server} do
      assert DamageTypes.get_relationship(:slashing, :plate, server) == :weak
    end

    test "returns neutral for slashing vs chain", %{server: server} do
      assert DamageTypes.get_relationship(:slashing, :chain, server) == :neutral
    end

    test "returns neutral for nil damage type", %{server: server} do
      assert DamageTypes.get_relationship(nil, :cloth, server) == :neutral
    end

    test "returns neutral for nil armor type", %{server: server} do
      assert DamageTypes.get_relationship(:slashing, nil, server) == :neutral
    end

    test "returns neutral for :none armor type", %{server: server} do
      assert DamageTypes.get_relationship(:slashing, :none, server) == :neutral
    end
  end

  describe "multipliers/0" do
    test "returns multiplier values" do
      mult = DamageTypes.multipliers()
      assert mult.effective == 1.25
      assert mult.weak == 0.75
      assert mult.neutral == 1.0
    end
  end

  describe "damage type relationships" do
    test "piercing is effective against leather and hide", %{server: server} do
      assert DamageTypes.get_relationship(:piercing, :leather, server) == :effective
      assert DamageTypes.get_relationship(:piercing, :hide, server) == :effective
    end

    test "piercing is weak against plate and chain", %{server: server} do
      assert DamageTypes.get_relationship(:piercing, :plate, server) == :weak
      assert DamageTypes.get_relationship(:piercing, :chain, server) == :weak
    end

    test "bludgeoning is effective against plate and bone", %{server: server} do
      assert DamageTypes.get_relationship(:bludgeoning, :plate, server) == :effective
      assert DamageTypes.get_relationship(:bludgeoning, :bone, server) == :effective
    end

    test "bludgeoning is weak against cloth and leather", %{server: server} do
      assert DamageTypes.get_relationship(:bludgeoning, :cloth, server) == :weak
      assert DamageTypes.get_relationship(:bludgeoning, :leather, server) == :weak
    end
  end
end
