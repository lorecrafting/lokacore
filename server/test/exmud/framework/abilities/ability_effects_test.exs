defmodule Exmud.Framework.Abilities.AbilityEffectsTest do
  use Exmud.DataCase

  alias Exmud.Framework.Abilities.AbilityEffects
  alias Exmud.Framework.Player.GameState

  import Exmud.AccountsFixtures

  # Helper to create a game state for testing
  defp game_state_fixture(player_id, attrs \\ %{}) do
    {:ok, state} = GameState.create_state(player_id)

    if map_size(attrs) > 0 do
      {:ok, state} = GameState.update_state(state, attrs)
      state
    else
      state
    end
  end

  describe "effect_types/0" do
    test "returns list of valid effect types" do
      types = AbilityEffects.effect_types()
      assert :damage in types
      assert :heal in types
      assert :status in types
      assert :buff in types
      assert :debuff in types
      assert :teleport in types
      assert :summon in types
      assert :transform in types
      assert :dispel in types
      assert :resource in types
    end
  end

  describe "apply_effect/4 - damage" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id, %{stats: %{strength: 20}})
      target = %{name: "Goblin"}
      {:ok, player: player, state: state, target: target}
    end

    test "applies basic damage", %{player: player, state: state, target: target} do
      effect = %{type: :damage, amount: 25, damage_type: :physical}

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.type == :damage
      assert result.damage_type == :physical
      assert result.target == target
      assert result.caster == player.id
      # Damage has variance, so check it's reasonable (within +/- 10%)
      assert result.amount >= 23 and result.amount <= 28
    end

    test "applies scaled damage based on caster stats", %{
      player: player,
      state: state,
      target: target
    } do
      effect = %{
        type: :damage,
        amount: 10,
        damage_type: :fire,
        scaling: :strength,
        scaling_factor: 0.5
      }

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      # Base 10 + (20 strength * 0.5) = 20, then variance
      assert result.amount >= 18 and result.amount <= 23
    end

    test "damage has random variance", %{player: player, state: state, target: target} do
      effect = %{type: :damage, amount: 100, damage_type: :physical}

      results =
        for _ <- 1..10 do
          {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
          result.amount
        end

      # Not all results should be identical due to variance
      assert Enum.uniq(results) |> length() > 1
      # All results should be within +/- 10% of 100
      assert Enum.all?(results, &(&1 >= 90 and &1 <= 111))
    end

    test "minimum damage is 1", %{player: player, state: state, target: target} do
      effect = %{type: :damage, amount: 1, damage_type: :physical}

      {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.amount >= 1
    end
  end

  describe "apply_effect/4 - heal" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id, %{stats: %{wisdom: 30}})
      target = %{name: "Ally"}
      {:ok, player: player, state: state, target: target}
    end

    test "applies basic healing", %{player: player, state: state, target: target} do
      effect = %{type: :heal, amount: 50}

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.type == :heal
      assert result.amount == 50
      assert result.target == target
      assert result.caster == player.id
    end

    test "applies scaled healing based on caster stats", %{
      player: player,
      state: state,
      target: target
    } do
      effect = %{
        type: :heal,
        amount: 20,
        scaling: :wisdom,
        scaling_factor: 0.4
      }

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      # Base 20 + (30 wisdom * 0.4) = 32
      assert result.amount == 32
    end
  end

  describe "apply_effect/4 - status" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      target = %{name: "Enemy"}
      {:ok, player: player, state: state, target: target}
    end

    test "applies status effect with duration", %{player: player, state: state, target: target} do
      effect = %{type: :status, status: :burning, duration: 3, potency: 5}

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.type == :status
      assert result.status == :burning
      assert result.duration == 3
      assert result.potency == 5
      assert result.target == target
      assert result.caster == player.id
    end

    test "defaults to duration 1 and potency 1", %{
      player: player,
      state: state,
      target: target
    } do
      effect = %{type: :status, status: :stunned}

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.duration == 1
      assert result.potency == 1
    end
  end

  describe "apply_effect/4 - buff" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      target = %{name: "Ally"}
      {:ok, player: player, state: state, target: target}
    end

    test "applies stat buff with duration", %{player: player, state: state, target: target} do
      effect = %{type: :buff, stat: :strength, modifier: 10, duration: 5}

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.type == :buff
      assert result.stat == :strength
      assert result.modifier == 10
      assert result.duration == 5
      assert result.target == target
    end

    test "defaults to modifier 0 and duration 1", %{
      player: player,
      state: state,
      target: target
    } do
      effect = %{type: :buff, stat: :agility}

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.modifier == 0
      assert result.duration == 1
    end
  end

  describe "apply_effect/4 - debuff" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      target = %{name: "Enemy"}
      {:ok, player: player, state: state, target: target}
    end

    test "applies stat debuff with negative modifier", %{
      player: player,
      state: state,
      target: target
    } do
      effect = %{type: :debuff, stat: :defense, modifier: 5, duration: 3}

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.type == :debuff
      assert result.stat == :defense
      assert result.modifier == -5
      assert result.duration == 3
    end

    test "converts positive modifier to negative", %{
      player: player,
      state: state,
      target: target
    } do
      effect = %{type: :debuff, stat: :speed, modifier: 10, duration: 2}

      {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.modifier == -10
    end
  end

  describe "apply_effect/4 - teleport" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      target = %{name: "Player"}
      {:ok, player: player, state: state, target: target}
    end

    test "applies teleport to room", %{player: player, state: state, target: target} do
      effect = %{type: :teleport, room_key: "town_square", message: "You vanish in a flash!"}

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.type == :teleport
      assert result.room_key == "town_square"
      assert result.message == "You vanish in a flash!"
      assert result.target == target
    end

    test "returns error when room_key is missing", %{player: player, state: state, target: target} do
      effect = %{type: :teleport}

      assert {:error, :missing_room_key} =
               AbilityEffects.apply_effect(effect, player.id, target, state)
    end

    test "uses default message when not provided", %{
      player: player,
      state: state,
      target: target
    } do
      effect = %{type: :teleport, room_key: "forest"}

      {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.message == "You are transported elsewhere."
    end
  end

  describe "apply_effect/4 - summon" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      {:ok, player: player, state: state}
    end

    test "summons entity from prototype", %{player: player, state: state} do
      effect = %{
        type: :summon,
        prototype_key: "wolf_spirit",
        count: 2,
        duration: 10,
        allegiance: :friendly
      }

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, nil, state)
      assert result.type == :summon
      assert result.prototype_key == "wolf_spirit"
      assert result.count == 2
      assert result.duration == 10
      assert result.allegiance == :friendly
    end

    test "defaults to count 1, no duration, friendly allegiance", %{
      player: player,
      state: state
    } do
      effect = %{type: :summon, prototype_key: "imp"}

      {:ok, result} = AbilityEffects.apply_effect(effect, player.id, nil, state)
      assert result.count == 1
      assert result.duration == nil
      assert result.allegiance == :friendly
    end

    test "returns error when prototype_key is missing", %{player: player, state: state} do
      effect = %{type: :summon}

      assert {:error, :missing_prototype_key} =
               AbilityEffects.apply_effect(effect, player.id, nil, state)
    end
  end

  describe "apply_effect/4 - transform" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      target = %{name: "Player"}
      {:ok, player: player, state: state, target: target}
    end

    test "transforms target into form", %{player: player, state: state, target: target} do
      effect = %{
        type: :transform,
        form_key: "werewolf",
        duration: 5,
        stat_changes: %{strength: 10, agility: 5}
      }

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.type == :transform
      assert result.form_key == "werewolf"
      assert result.duration == 5
      assert result.stat_changes == %{strength: 10, agility: 5}
      assert result.target == target
    end

    test "defaults to duration 1 and empty stat changes", %{
      player: player,
      state: state,
      target: target
    } do
      effect = %{type: :transform, form_key: "cat"}

      {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.duration == 1
      assert result.stat_changes == %{}
    end

    test "returns error when form_key is missing", %{player: player, state: state, target: target} do
      effect = %{type: :transform, duration: 3}

      assert {:error, :missing_form_key} =
               AbilityEffects.apply_effect(effect, player.id, target, state)
    end
  end

  describe "apply_effect/4 - dispel" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      target = %{name: "Ally"}
      {:ok, player: player, state: state, target: target}
    end

    test "dispels specific effect type", %{player: player, state: state, target: target} do
      effect = %{type: :dispel, effect_type: :debuff, count: 2}

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.type == :dispel
      assert result.effect_type == :debuff
      assert result.count == 2
      assert result.target == target
    end

    test "defaults to dispel all effects", %{player: player, state: state, target: target} do
      effect = %{type: :dispel}

      {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.effect_type == :all
      assert result.count == :all
    end
  end

  describe "apply_effect/4 - resource" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      target = %{name: "Player"}
      {:ok, player: player, state: state, target: target}
    end

    test "modifies resource on target", %{player: player, state: state, target: target} do
      effect = %{type: :resource, resource: :mana, amount: 30}

      assert {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.type == :resource
      assert result.resource == :mana
      assert result.amount == 30
      assert result.target == target
    end

    test "supports negative amounts for resource drain", %{
      player: player,
      state: state,
      target: target
    } do
      effect = %{type: :resource, resource: :stamina, amount: -20}

      {:ok, result} = AbilityEffects.apply_effect(effect, player.id, target, state)
      assert result.amount == -20
    end
  end

  describe "apply_effect/4 - unknown effect type" do
    setup do
      player = player_fixture()
      state = game_state_fixture(player.id)
      target = %{name: "Target"}
      {:ok, player: player, state: state, target: target}
    end

    test "returns error for unknown effect type", %{player: player, state: state, target: target} do
      effect = %{type: :invalid_effect}

      assert {:error, {:unknown_effect_type, :invalid_effect}} =
               AbilityEffects.apply_effect(effect, player.id, target, state)
    end

    test "returns error when type is missing", %{player: player, state: state, target: target} do
      effect = %{amount: 50}

      assert {:error, {:unknown_effect_type, :unknown}} =
               AbilityEffects.apply_effect(effect, player.id, target, state)
    end
  end
end
