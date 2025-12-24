defmodule Exmud.Framework.Abilities.AbilityTest do
  use Exmud.DataCase

  alias Exmud.Framework.Abilities.Ability
  alias Exmud.Framework.Abilities.AbilityCooldowns
  alias Exmud.Framework.Player.GameState

  import Exmud.AccountsFixtures

  setup do
    # Start the cooldown server for tests
    start_supervised!({AbilityCooldowns, name: AbilityCooldowns})
    AbilityCooldowns.clear_all()
    :ok
  end

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

  describe "from_map/1" do
    test "creates ability from valid map with required fields" do
      data = %{
        "key" => "fireball",
        "name" => "Fireball"
      }

      assert {:ok, ability} = Ability.from_map(data)
      assert ability.key == "fireball"
      assert ability.name == "Fireball"
      assert ability.type == :offensive
      assert ability.cooldown == 0
      assert ability.cost == %{}
    end

    test "parses all fields correctly" do
      data = %{
        "key" => "heal",
        "name" => "Healing Touch",
        "type" => "defensive",
        "cost" => %{"mana" => 10},
        "cooldown" => 5,
        "target" => "ally",
        "effects" => [%{"type" => "heal", "amount" => 50}],
        "requirements" => %{"level" => 5},
        "description" => "Heals an ally",
        "cast_message" => "You heal {target}!",
        "fail_message" => "The spell fizzles.",
        "tags" => ["magic", "healing"]
      }

      assert {:ok, ability} = Ability.from_map(data)
      assert ability.key == "heal"
      assert ability.name == "Healing Touch"
      assert ability.type == :defensive
      assert ability.cost == %{"mana" => 10}
      assert ability.cooldown == 5
      assert ability.target == :ally
      assert length(ability.effects) == 1
      assert ability.requirements == %{"level" => 5}
      assert ability.description == "Heals an ally"
      assert ability.cast_message == "You heal {target}!"
      assert ability.fail_message == "The spell fizzles."
      assert ability.tags == ["magic", "healing"]
    end

    test "parses type as atom when given as string" do
      data = %{"key" => "test", "name" => "Test", "type" => "utility"}
      assert {:ok, ability} = Ability.from_map(data)
      assert ability.type == :utility
    end

    test "parses type as atom when given as atom" do
      data = %{"key" => "test", "name" => "Test", "type" => :passive}
      assert {:ok, ability} = Ability.from_map(data)
      assert ability.type == :passive
    end

    test "defaults to offensive for invalid type" do
      data = %{"key" => "test", "name" => "Test", "type" => "invalid"}
      assert {:ok, ability} = Ability.from_map(data)
      assert ability.type == :offensive
    end

    test "parses target as atom when given as string" do
      data = %{"key" => "test", "name" => "Test", "target" => "self"}
      assert {:ok, ability} = Ability.from_map(data)
      assert ability.target == :self
    end

    test "defaults to enemy for invalid target" do
      data = %{"key" => "test", "name" => "Test", "target" => "invalid"}
      assert {:ok, ability} = Ability.from_map(data)
      assert ability.target == :enemy
    end

    test "parses effects with type conversion" do
      data = %{
        "key" => "fireball",
        "name" => "Fireball",
        "effects" => [
          %{"type" => "damage", "amount" => 25},
          %{"type" => "status", "status" => "burning"}
        ]
      }

      assert {:ok, ability} = Ability.from_map(data)
      assert length(ability.effects) == 2
      [damage, status] = ability.effects
      assert damage.type == :damage
      assert status.type == :status
    end

    test "returns error when key is missing" do
      data = %{"name" => "Test"}
      assert {:error, {:missing_field, "key"}} = Ability.from_map(data)
    end

    test "returns error when name is missing" do
      data = %{"key" => "test"}
      assert {:error, {:missing_field, "name"}} = Ability.from_map(data)
    end
  end

  describe "can_use?/4" do
    setup do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{level: 10, skills: ["fire_magic"], mana: 50}
        })

      ability = %Ability{
        key: "fireball",
        name: "Fireball",
        type: :offensive,
        cost: %{mana: 15},
        cooldown: 3,
        target: :enemy,
        requirements: %{level: 5, skills: ["fire_magic"]}
      }

      {:ok, player: player, state: state, ability: ability}
    end

    test "returns :ok when all checks pass", %{player: player, state: state, ability: ability} do
      target = %{name: "Goblin"}
      assert :ok = Ability.can_use?(player.id, ability, target, state)
    end

    test "returns error when level requirement not met", %{
      player: player,
      state: state,
      ability: ability
    } do
      low_level_state = %{state | stats: %{state.stats | level: 3}}
      target = %{name: "Goblin"}

      assert {:error, {:level_required, 5}} =
               Ability.can_use?(player.id, ability, target, low_level_state)
    end

    test "returns error when skill requirement not met", %{
      player: player,
      state: state,
      ability: ability
    } do
      no_skill_state = %{state | stats: %{state.stats | skills: []}}
      target = %{name: "Goblin"}

      assert {:error, :missing_skills} =
               Ability.can_use?(player.id, ability, target, no_skill_state)
    end

    test "returns error when resource insufficient", %{
      player: player,
      state: state,
      ability: ability
    } do
      low_mana_state = %{state | stats: %{state.stats | mana: 5}}
      target = %{name: "Goblin"}

      assert {:error, {:insufficient_resource, :mana, 15, 5}} =
               Ability.can_use?(player.id, ability, target, low_mana_state)
    end

    test "returns error when on cooldown", %{player: player, state: state, ability: ability} do
      AbilityCooldowns.start_cooldown(player.id, ability.key, 2)
      Process.sleep(10)
      target = %{name: "Goblin"}

      assert {:error, {:on_cooldown, 2}} = Ability.can_use?(player.id, ability, target, state)
    end

    test "returns error when target required but not provided", %{
      player: player,
      state: state,
      ability: ability
    } do
      assert {:error, :target_required} = Ability.can_use?(player.id, ability, nil, state)
    end

    test "allows self-targeting without target parameter", %{player: player, state: state} do
      self_ability = %Ability{
        key: "shield",
        name: "Shield",
        type: :defensive,
        target: :self,
        cost: %{},
        requirements: %{}
      }

      assert :ok = Ability.can_use?(player.id, self_ability, nil, state)
    end

    test "allows area abilities without target", %{player: player, state: state} do
      area_ability = %Ability{
        key: "earthquake",
        name: "Earthquake",
        type: :offensive,
        target: :area,
        cost: %{},
        requirements: %{}
      }

      assert :ok = Ability.can_use?(player.id, area_ability, nil, state)
    end

    test "allows abilities with no requirements", %{player: player, state: state} do
      simple_ability = %Ability{
        key: "punch",
        name: "Punch",
        type: :offensive,
        target: :enemy,
        cost: %{},
        requirements: %{}
      }

      target = %{name: "Goblin"}
      assert :ok = Ability.can_use?(player.id, simple_ability, target, state)
    end
  end

  describe "use/4" do
    setup do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{level: 10, skills: ["fire_magic"], mana: 50}
        })

      ability = %Ability{
        key: "fireball",
        name: "Fireball",
        type: :offensive,
        cost: %{mana: 15},
        cooldown: 3,
        target: :enemy,
        effects: [%{type: :damage, amount: 25, damage_type: :fire}],
        requirements: %{level: 5, skills: ["fire_magic"]},
        cast_message: "You hurl flames at {target}!"
      }

      {:ok, player: player, state: state, ability: ability}
    end

    test "successfully uses ability", %{player: player, state: state, ability: ability} do
      target = %{name: "Goblin"}

      assert {:ok, result} = Ability.use(player.id, ability, target, state)
      assert result.ability_key == "fireball"
      assert result.cost == %{mana: 15}
      assert result.message == "You hurl flames at Goblin!"
      assert is_list(result.effects)
    end

    test "starts cooldown after use", %{player: player, state: state, ability: ability} do
      target = %{name: "Goblin"}
      assert {:ok, _result} = Ability.use(player.id, ability, target, state)
      Process.sleep(10)

      assert AbilityCooldowns.get_cooldown(player.id, "fireball") == 3
    end

    test "formats message with target name", %{player: player, state: state, ability: ability} do
      target = %{name: "Dragon"}
      assert {:ok, result} = Ability.use(player.id, ability, target, state)
      assert result.message == "You hurl flames at Dragon!"
    end

    test "uses 'the air' when target is nil", %{player: player, state: state} do
      area_ability = %Ability{
        key: "shout",
        name: "Shout",
        type: :utility,
        target: :area,
        cost: %{},
        requirements: %{},
        cast_message: "You shout at {target}!"
      }

      assert {:ok, result} = Ability.use(player.id, area_ability, nil, state)
      assert result.message == "You shout at the air!"
    end

    test "applies effects from ability", %{player: player, state: state, ability: ability} do
      target = %{name: "Goblin"}
      assert {:ok, result} = Ability.use(player.id, ability, target, state)

      assert length(result.effects) == 1
      {:ok, effect} = hd(result.effects)
      assert effect.type == :damage
      assert effect.damage_type == :fire
      assert effect.target == target
    end

    test "returns error when validation fails", %{player: player, state: state, ability: ability} do
      low_mana_state = %{state | stats: %{state.stats | mana: 5}}
      target = %{name: "Goblin"}

      assert {:error, {:insufficient_resource, :mana, 15, 5}} =
               Ability.use(player.id, ability, target, low_mana_state)

      # Cooldown should not be started
      Process.sleep(10)
      assert AbilityCooldowns.get_cooldown(player.id, "fireball") == 0
    end
  end

  describe "valid_types/0" do
    test "returns list of valid ability types" do
      types = Ability.valid_types()
      assert :offensive in types
      assert :defensive in types
      assert :utility in types
      assert :passive in types
    end
  end

  describe "valid_targets/0" do
    test "returns list of valid target types" do
      targets = Ability.valid_targets()
      assert :self in targets
      assert :ally in targets
      assert :enemy in targets
      assert :area in targets
      assert :room in targets
    end
  end

  describe "passive?/1" do
    test "returns true for passive abilities" do
      ability = %Ability{type: :passive}
      assert Ability.passive?(ability) == true
    end

    test "returns false for non-passive abilities" do
      ability = %Ability{type: :offensive}
      assert Ability.passive?(ability) == false
    end
  end

  describe "has_cooldown?/1" do
    test "returns true when cooldown > 0" do
      ability = %Ability{cooldown: 5}
      assert Ability.has_cooldown?(ability) == true
    end

    test "returns false when cooldown is 0" do
      ability = %Ability{cooldown: 0}
      assert Ability.has_cooldown?(ability) == false
    end
  end

  describe "has_cost?/1" do
    test "returns true when cost is non-empty" do
      ability = %Ability{cost: %{mana: 10}}
      assert Ability.has_cost?(ability) == true
    end

    test "returns false when cost is empty" do
      ability = %Ability{cost: %{}}
      assert Ability.has_cost?(ability) == false
    end
  end
end
