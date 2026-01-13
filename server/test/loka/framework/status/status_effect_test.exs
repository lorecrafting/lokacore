defmodule Loka.Framework.Status.StatusEffectTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Status.StatusEffect

  describe "from_map/1" do
    test "creates status effect from valid map with all fields" do
      data = %{
        "key" => "poisoned",
        "name" => "Poisoned",
        "type" => "debuff",
        "duration" => 5,
        "stackable" => true,
        "max_stacks" => 3,
        "effects" => [
          %{
            "trigger" => "on_turn_start",
            "effect" => "damage",
            "amount" => 5,
            "damage_type" => "poison"
          }
        ],
        "cure_items" => ["antidote"],
        "cure_abilities" => ["cure_poison"],
        "display_icon" => "skull",
        "display_color" => "green",
        "description" => "You have been poisoned!",
        "hidden" => false,
        "exclusive_with" => ["blessed"],
        "tags" => ["poison", "damage_over_time"]
      }

      assert {:ok, status} = StatusEffect.from_map(data)

      assert status.key == "poisoned"
      assert status.name == "Poisoned"
      assert status.type == :debuff
      assert status.duration == 5
      assert status.stackable == true
      assert status.max_stacks == 3
      assert length(status.effects) == 1
      assert status.cure_items == ["antidote"]
      assert status.cure_abilities == ["cure_poison"]
      assert status.display_icon == "skull"
      assert status.display_color == "green"
      assert status.description == "You have been poisoned!"
      assert status.hidden == false
      assert status.exclusive_with == ["blessed"]
      assert status.tags == ["poison", "damage_over_time"]
    end

    test "creates status effect with minimal required fields" do
      data = %{
        "key" => "stunned",
        "name" => "Stunned"
      }

      assert {:ok, status} = StatusEffect.from_map(data)

      assert status.key == "stunned"
      assert status.name == "Stunned"
      assert status.type == :neutral
      assert status.duration == nil
      assert status.stackable == false
      assert status.max_stacks == 1
      assert status.effects == []
      assert status.cure_items == []
      assert status.cure_abilities == []
    end

    test "returns error when key is missing" do
      data = %{"name" => "Test Status"}

      assert {:error, {:missing_field, :key}} = StatusEffect.from_map(data)
    end

    test "returns error when name is missing" do
      data = %{"key" => "test"}

      assert {:error, {:missing_field, :name}} = StatusEffect.from_map(data)
    end

    test "parses type as atom" do
      data = %{"key" => "test", "name" => "Test", "type" => "buff"}

      assert {:ok, status} = StatusEffect.from_map(data)
      assert status.type == :buff
    end

    test "handles type as atom" do
      data = %{"key" => "test", "name" => "Test", "type" => :debuff}

      assert {:ok, status} = StatusEffect.from_map(data)
      assert status.type == :debuff
    end

    test "defaults to neutral for invalid type" do
      data = %{"key" => "test", "name" => "Test", "type" => "invalid"}

      assert {:ok, status} = StatusEffect.from_map(data)
      assert status.type == :neutral
    end

    test "parses effects with trigger and action" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "effects" => [
          %{
            "trigger" => "on_apply",
            "effect" => "heal",
            "amount" => 10
          },
          %{
            "trigger" => "passive",
            "effect" => "stat_modify",
            "stat" => "str",
            "modifier" => 5
          }
        ]
      }

      assert {:ok, status} = StatusEffect.from_map(data)
      assert length(status.effects) == 2

      first_effect = Enum.at(status.effects, 0)
      assert first_effect.trigger == :on_apply
      assert first_effect.action == :heal
      # parse_effects only removes "trigger" and "effect", other fields keep their original keys
      assert Map.get(first_effect, "amount") == 10

      second_effect = Enum.at(status.effects, 1)
      assert second_effect.trigger == :passive
      assert second_effect.action == :stat_modify
      assert Map.get(second_effect, "stat") == "str"
      assert Map.get(second_effect, "modifier") == 5
    end

    test "handles effects with atom keys" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "effects" => [
          %{
            trigger: :on_damage_taken,
            effect: :reflect_damage,
            percentage: 50
          }
        ]
      }

      assert {:ok, status} = StatusEffect.from_map(data)
      effect = List.first(status.effects)
      assert effect.trigger == :on_damage_taken
      assert effect.action == :reflect_damage
      assert effect[:percentage] == 50
    end

    test "accepts atom keys in main data map" do
      data = %{
        key: "test",
        name: "Test Status",
        type: :buff,
        duration: 10
      }

      assert {:ok, status} = StatusEffect.from_map(data)
      assert status.key == "test"
      assert status.name == "Test Status"
      assert status.type == :buff
      assert status.duration == 10
    end
  end

  describe "valid_types/0" do
    test "returns list of valid types" do
      types = StatusEffect.valid_types()
      assert :buff in types
      assert :debuff in types
      assert :neutral in types
      assert length(types) == 3
    end
  end

  describe "valid_triggers/0" do
    test "returns list of valid triggers" do
      triggers = StatusEffect.valid_triggers()
      assert :on_apply in triggers
      assert :on_remove in triggers
      assert :on_turn_start in triggers
      assert :on_turn_end in triggers
      assert :on_damage_taken in triggers
      assert :on_damage_dealt in triggers
      assert :on_ability_use in triggers
      assert :passive in triggers
      assert length(triggers) == 8
    end
  end

  describe "valid_actions/0" do
    test "returns list of valid actions" do
      actions = StatusEffect.valid_actions()
      assert :damage in actions
      assert :heal in actions
      assert :stat_modify in actions
      assert :resource_drain in actions
      assert :prevent_action in actions
      assert :reflect_damage in actions
      assert :immunity in actions
      assert :resource_regen in actions
    end
  end

  describe "permanent?/1" do
    test "returns true for status with nil duration" do
      status = %StatusEffect{key: "test", name: "Test", duration: nil}
      assert StatusEffect.permanent?(status) == true
    end

    test "returns false for status with duration" do
      status = %StatusEffect{key: "test", name: "Test", duration: 5}
      assert StatusEffect.permanent?(status) == false
    end

    test "returns false for status with zero duration" do
      status = %StatusEffect{key: "test", name: "Test", duration: 0}
      assert StatusEffect.permanent?(status) == false
    end
  end

  describe "buff?/1" do
    test "returns true for buff type" do
      status = %StatusEffect{key: "test", name: "Test", type: :buff}
      assert StatusEffect.buff?(status) == true
    end

    test "returns false for debuff type" do
      status = %StatusEffect{key: "test", name: "Test", type: :debuff}
      assert StatusEffect.buff?(status) == false
    end

    test "returns false for neutral type" do
      status = %StatusEffect{key: "test", name: "Test", type: :neutral}
      assert StatusEffect.buff?(status) == false
    end
  end

  describe "debuff?/1" do
    test "returns true for debuff type" do
      status = %StatusEffect{key: "test", name: "Test", type: :debuff}
      assert StatusEffect.debuff?(status) == true
    end

    test "returns false for buff type" do
      status = %StatusEffect{key: "test", name: "Test", type: :buff}
      assert StatusEffect.debuff?(status) == false
    end

    test "returns false for neutral type" do
      status = %StatusEffect{key: "test", name: "Test", type: :neutral}
      assert StatusEffect.debuff?(status) == false
    end
  end

  describe "get_effects_for_trigger/2" do
    test "returns effects matching the trigger" do
      status = %StatusEffect{
        key: "test",
        name: "Test",
        effects: [
          %{trigger: :on_turn_start, action: :damage, amount: 5},
          %{trigger: :on_turn_end, action: :heal, amount: 3},
          %{trigger: :on_turn_start, action: :resource_drain, resource: "mana", amount: 2}
        ]
      }

      effects = StatusEffect.get_effects_for_trigger(status, :on_turn_start)
      assert length(effects) == 2
      assert Enum.all?(effects, &(&1.trigger == :on_turn_start))
    end

    test "returns empty list when no effects match" do
      status = %StatusEffect{
        key: "test",
        name: "Test",
        effects: [
          %{trigger: :on_apply, action: :damage, amount: 5}
        ]
      }

      effects = StatusEffect.get_effects_for_trigger(status, :on_remove)
      assert effects == []
    end

    test "returns empty list for status with no effects" do
      status = %StatusEffect{key: "test", name: "Test", effects: []}

      effects = StatusEffect.get_effects_for_trigger(status, :on_turn_start)
      assert effects == []
    end
  end

  describe "curable_by_item?/2" do
    test "returns true when item is in cure_items list" do
      status = %StatusEffect{
        key: "test",
        name: "Test",
        cure_items: ["antidote", "panacea"]
      }

      assert StatusEffect.curable_by_item?(status, "antidote") == true
      assert StatusEffect.curable_by_item?(status, "panacea") == true
    end

    test "returns false when item is not in cure_items list" do
      status = %StatusEffect{
        key: "test",
        name: "Test",
        cure_items: ["antidote"]
      }

      assert StatusEffect.curable_by_item?(status, "potion") == false
    end

    test "returns false when cure_items is empty" do
      status = %StatusEffect{key: "test", name: "Test", cure_items: []}

      assert StatusEffect.curable_by_item?(status, "antidote") == false
    end
  end

  describe "curable_by_ability?/2" do
    test "returns true when ability is in cure_abilities list" do
      status = %StatusEffect{
        key: "test",
        name: "Test",
        cure_abilities: ["cure_poison", "cleanse"]
      }

      assert StatusEffect.curable_by_ability?(status, "cure_poison") == true
      assert StatusEffect.curable_by_ability?(status, "cleanse") == true
    end

    test "returns false when ability is not in cure_abilities list" do
      status = %StatusEffect{
        key: "test",
        name: "Test",
        cure_abilities: ["cure_poison"]
      }

      assert StatusEffect.curable_by_ability?(status, "heal") == false
    end

    test "returns false when cure_abilities is empty" do
      status = %StatusEffect{key: "test", name: "Test", cure_abilities: []}

      assert StatusEffect.curable_by_ability?(status, "cure_poison") == false
    end
  end

  describe "get_stat_modifiers/1" do
    test "returns passive stat modifiers" do
      status = %StatusEffect{
        key: "test",
        name: "Test",
        effects: [
          %{trigger: :passive, action: :stat_modify, stat: "str", modifier: 5},
          %{trigger: :passive, action: :stat_modify, stat: "dex", modifier: -3},
          %{trigger: :on_turn_start, action: :damage, amount: 5}
        ]
      }

      modifiers = StatusEffect.get_stat_modifiers(status)
      assert length(modifiers) == 2
      assert {"str", 5} in modifiers
      assert {"dex", -3} in modifiers
    end

    test "returns empty list when no passive stat modifiers" do
      status = %StatusEffect{
        key: "test",
        name: "Test",
        effects: [
          %{trigger: :on_turn_start, action: :damage, amount: 5}
        ]
      }

      modifiers = StatusEffect.get_stat_modifiers(status)
      assert modifiers == []
    end

    test "handles effects with atom keys" do
      status = %StatusEffect{
        key: "test",
        name: "Test",
        effects: [
          %{trigger: :passive, action: :stat_modify, stat: :int, modifier: 10}
        ]
      }

      modifiers = StatusEffect.get_stat_modifiers(status)
      assert length(modifiers) == 1
      assert {:int, 10} in modifiers
    end

    test "handles effects with mixed key types" do
      # Build the effect map with string keys for stat and modifier
      effect = %{trigger: :passive, action: :stat_modify}
      effect = Map.put(effect, "stat", "wis")
      effect = Map.put(effect, "modifier", 7)

      status = %StatusEffect{
        key: "test",
        name: "Test",
        effects: [effect]
      }

      modifiers = StatusEffect.get_stat_modifiers(status)
      assert length(modifiers) == 1
      assert {"wis", 7} in modifiers
    end

    test "defaults modifier to 0 when missing" do
      status = %StatusEffect{
        key: "test",
        name: "Test",
        effects: [
          %{trigger: :passive, action: :stat_modify, stat: "str"}
        ]
      }

      modifiers = StatusEffect.get_stat_modifiers(status)
      assert length(modifiers) == 1
      assert {"str", 0} in modifiers
    end

    test "filters out non-passive effects" do
      status = %StatusEffect{
        key: "test",
        name: "Test",
        effects: [
          %{trigger: :passive, action: :stat_modify, stat: "str", modifier: 5},
          %{trigger: :on_apply, action: :stat_modify, stat: "dex", modifier: 3}
        ]
      }

      modifiers = StatusEffect.get_stat_modifiers(status)
      assert length(modifiers) == 1
      assert {"str", 5} in modifiers
    end

    test "filters out non-stat-modify actions" do
      status = %StatusEffect{
        key: "test",
        name: "Test",
        effects: [
          %{trigger: :passive, action: :stat_modify, stat: "str", modifier: 5},
          %{trigger: :passive, action: :damage, amount: 10}
        ]
      }

      modifiers = StatusEffect.get_stat_modifiers(status)
      assert length(modifiers) == 1
      assert {"str", 5} in modifiers
    end
  end
end
