defmodule Exmud.DemoGame.Systems.Combat do
  @moduledoc """
  Turn-based combat system for the demo game.

  Handles combat initiation, turn-based actions, damage calculation,
  and combat resolution. Combat state is stored in LiveView socket
  assigns rather than the database since it's temporary.

  ## Combat Flow

  1. Player clicks "Attack" on a combatant NPC
  2. Combat starts with player's turn
  3. Each turn, combatant can: Attack, Defend, or Flee
  4. Combat ends when either side reaches 0 HP or player flees

  ## Combat State Structure

      %{
        enemy_id: "uuid",
        enemy: %{name: "wolf", health: %{current: 30, max: 30}, ...},
        player_turn: true,
        turn_count: 1,
        player_defending: false,
        enemy_defending: false,
        log: [%{text: "Combat begins!", type: :info}]
      }

  ## Usage

      alias Exmud.DemoGame.Systems.Combat

      # Start combat
      {:ok, combat_state} = Combat.start_combat(entity_id, game_state)

      # Player attacks
      {:ok, combat_state, events} = Combat.player_action(combat_state, :attack, game_state)

      # Check if combat ended
      case Combat.check_combat_end(combat_state, game_state) do
        {:victory, rewards} -> ...
        {:defeat} -> ...
        {:fled} -> ...
        :ongoing -> ...
      end
  """

  alias Exmud.Engine.Entities
  alias Exmud.DemoGame.PlayerGameState
  alias Exmud.DemoGame.Systems.Progression

  @doc """
  Starts combat with a combatant entity.

  Returns `{:ok, combat_state}` or `{:error, reason}`.
  """
  def start_combat(entity_id, %PlayerGameState{} = _game_state) do
    case Entities.get_entity(entity_id) do
      nil ->
        {:error, :entity_not_found}

      entity_schema ->
        entity = Entities.to_entity(entity_schema)
        combatant = get_combatant_component(entity)

        if combatant do
          combat_state = %{
            enemy_id: entity.id,
            enemy: %{
              name: entity.name,
              description: entity.description,
              health: Map.get(combatant, "health", %{"current" => 50, "max" => 50}),
              stats: Map.get(combatant, "stats", %{"attack" => 5, "defense" => 2}),
              level: Map.get(combatant, "level", 1),
              xp_reward: Map.get(combatant, "xp_reward", 10),
              gold_reward: Map.get(combatant, "gold_reward", 5)
            },
            player_turn: true,
            turn_count: 1,
            player_defending: false,
            enemy_defending: false,
            log: [%{text: "Combat with #{entity.name} begins!", type: :info, turn: 0}]
          }

          {:ok, combat_state}
        else
          {:error, :not_combatant}
        end
    end
  end

  @doc """
  Executes a player action during combat.

  Actions:
  - `:attack` - Deal damage to the enemy
  - `:defend` - Reduce incoming damage this turn
  - `:flee` - Attempt to escape (chance-based)

  Returns `{:ok, updated_combat_state, result}` or `{:error, reason}`.
  """
  def player_action(combat_state, action, %PlayerGameState{} = game_state) do
    if not combat_state.player_turn do
      {:error, :not_player_turn}
    else
      case action do
        :attack -> execute_player_attack(combat_state, game_state)
        :defend -> execute_player_defend(combat_state, game_state)
        :flee -> execute_player_flee(combat_state, game_state)
        _ -> {:error, :invalid_action}
      end
    end
  end

  @doc """
  Executes the enemy's turn.

  The enemy will attack or defend based on simple AI logic.
  """
  def enemy_turn(combat_state, %PlayerGameState{} = game_state) do
    if combat_state.player_turn do
      {:error, :not_enemy_turn}
    else
      # Simple AI: mostly attack, sometimes defend
      action = if :rand.uniform(100) <= 20, do: :defend, else: :attack

      case action do
        :attack -> execute_enemy_attack(combat_state, game_state)
        :defend -> execute_enemy_defend(combat_state)
      end
    end
  end

  @doc """
  Checks if combat has ended.

  Returns:
  - `{:victory, rewards}` - Enemy defeated
  - `{:defeat}` - Player defeated
  - `{:fled}` - Player escaped
  - `:ongoing` - Combat continues
  """
  def check_combat_end(combat_state, %PlayerGameState{} = game_state) do
    enemy_hp =
      get_in(combat_state.enemy.health, ["current"]) ||
        get_in(combat_state.enemy.health, [:current]) || 0

    player_hp =
      get_in(game_state.health, ["current"]) ||
        get_in(game_state.health, [:current]) || 0

    cond do
      Map.get(combat_state, :fled, false) ->
        {:fled}

      enemy_hp <= 0 ->
        rewards = %{
          xp: combat_state.enemy.xp_reward,
          gold: combat_state.enemy.gold_reward
        }

        {:victory, rewards}

      player_hp <= 0 ->
        {:defeat}

      true ->
        :ongoing
    end
  end

  @doc """
  Applies victory rewards to the player's game state.

  Returns {:ok, updated_state} or {:ok, updated_state, level_up_info} if leveled up.
  """
  def apply_rewards(%PlayerGameState{} = game_state, rewards) do
    xp_amount = Map.get(rewards, :xp, 0)
    gold_amount = Map.get(rewards, :gold, 0)

    # First add gold
    current_gold =
      get_in(game_state.stats, ["gold"]) ||
        get_in(game_state.stats, [:gold]) || 0

    new_gold = current_gold + gold_amount

    new_stats = Map.put(game_state.stats || %{}, "gold", new_gold)
    {:ok, game_state} = PlayerGameState.update_state(game_state, %{stats: new_stats})

    # Then award XP (which handles leveling)
    case Progression.award_xp(game_state, xp_amount) do
      {:ok, updated_state, nil} ->
        {:ok, updated_state}

      {:ok, updated_state, level_up_info} ->
        {:ok, updated_state, level_up_info}
    end
  end

  # Private Functions

  defp get_combatant_component(entity) do
    Map.get(entity.components || %{}, "combatant")
  end

  defp execute_player_attack(combat_state, game_state) do
    # Get player stats
    player_str =
      get_in(game_state.stats, ["str"]) ||
        get_in(game_state.stats, [:str]) || 10

    # Get weapon bonus from equipment
    weapon_bonus = get_weapon_bonus(game_state)

    # Enemy defense
    enemy_def =
      get_in(combat_state.enemy.stats, ["defense"]) ||
        get_in(combat_state.enemy.stats, [:defense]) || 0

    # Apply defense bonus if enemy is defending
    defense_multiplier = if combat_state.enemy_defending, do: 1.5, else: 1.0
    effective_defense = trunc(enemy_def * defense_multiplier)

    # Calculate damage
    base_damage = player_str + weapon_bonus
    damage = max(1, base_damage - effective_defense)

    # Add variance (+/- 20%)
    # -20 to +20
    variance = :rand.uniform(41) - 21
    final_damage = max(1, trunc(damage * (1 + variance / 100)))

    # Apply damage to enemy
    current_hp =
      get_in(combat_state.enemy.health, ["current"]) ||
        get_in(combat_state.enemy.health, [:current]) || 0

    new_hp = max(0, current_hp - final_damage)

    new_enemy_health =
      combat_state.enemy.health
      |> Map.put("current", new_hp)

    new_enemy = %{combat_state.enemy | health: new_enemy_health}

    # Create log entry
    log_entry = %{
      text: "You attack the #{combat_state.enemy.name} for #{final_damage} damage!",
      type: :player_attack,
      damage: final_damage,
      turn: combat_state.turn_count
    }

    # Update combat state
    new_state = %{
      combat_state
      | enemy: new_enemy,
        player_turn: false,
        player_defending: false,
        log: combat_state.log ++ [log_entry]
    }

    {:ok, new_state, %{action: :attack, damage: final_damage}}
  end

  defp execute_player_defend(combat_state, _game_state) do
    log_entry = %{
      text: "You take a defensive stance.",
      type: :player_defend,
      turn: combat_state.turn_count
    }

    new_state = %{
      combat_state
      | player_turn: false,
        player_defending: true,
        log: combat_state.log ++ [log_entry]
    }

    {:ok, new_state, %{action: :defend}}
  end

  defp execute_player_flee(combat_state, _game_state) do
    # 40% base chance to flee, modified by enemy level
    enemy_level = combat_state.enemy.level || 1
    flee_chance = max(10, 40 - enemy_level * 5)

    if :rand.uniform(100) <= flee_chance do
      log_entry = %{
        text: "You successfully flee from combat!",
        type: :flee_success,
        turn: combat_state.turn_count
      }

      new_state = %{combat_state | fled: true, log: combat_state.log ++ [log_entry]}

      {:ok, new_state, %{action: :flee, success: true}}
    else
      log_entry = %{
        text: "You try to flee but the #{combat_state.enemy.name} blocks your escape!",
        type: :flee_fail,
        turn: combat_state.turn_count
      }

      new_state = %{
        combat_state
        | player_turn: false,
          player_defending: false,
          log: combat_state.log ++ [log_entry]
      }

      {:ok, new_state, %{action: :flee, success: false}}
    end
  end

  defp execute_enemy_attack(combat_state, game_state) do
    # Get enemy stats
    enemy_atk =
      get_in(combat_state.enemy.stats, ["attack"]) ||
        get_in(combat_state.enemy.stats, [:attack]) || 5

    # Player defense
    player_def =
      get_in(game_state.stats, ["sta"]) ||
        get_in(game_state.stats, [:sta]) || 10

    # Apply defense bonus if player is defending
    defense_multiplier = if combat_state.player_defending, do: 2.0, else: 1.0
    effective_defense = trunc(player_def * defense_multiplier / 2)

    # Calculate damage
    damage = max(1, enemy_atk - effective_defense)

    # Add variance
    variance = :rand.uniform(41) - 21
    final_damage = max(1, trunc(damage * (1 + variance / 100)))

    # Create log entry
    defense_text =
      if combat_state.player_defending, do: " Your defense reduces the blow!", else: ""

    log_entry = %{
      text:
        "The #{combat_state.enemy.name} attacks you for #{final_damage} damage!#{defense_text}",
      type: :enemy_attack,
      damage: final_damage,
      turn: combat_state.turn_count
    }

    # Update combat state (damage applied to player separately)
    new_state = %{
      combat_state
      | player_turn: true,
        turn_count: combat_state.turn_count + 1,
        enemy_defending: false,
        log: combat_state.log ++ [log_entry]
    }

    {:ok, new_state, %{action: :attack, damage: final_damage}}
  end

  defp execute_enemy_defend(combat_state) do
    log_entry = %{
      text: "The #{combat_state.enemy.name} takes a defensive stance.",
      type: :enemy_defend,
      turn: combat_state.turn_count
    }

    new_state = %{
      combat_state
      | player_turn: true,
        turn_count: combat_state.turn_count + 1,
        enemy_defending: true,
        log: combat_state.log ++ [log_entry]
    }

    {:ok, new_state, %{action: :defend}}
  end

  defp get_weapon_bonus(game_state) do
    # Check if player has a weapon equipped
    weapon_id =
      get_in(game_state.equipment, ["weapon"]) ||
        get_in(game_state.equipment, [:weapon])

    if weapon_id do
      case Entities.get_entity(weapon_id) do
        nil ->
          0

        entity_schema ->
          entity = Entities.to_entity(entity_schema)
          equipable = Map.get(entity.components || %{}, "equipable", %{})
          bonuses = Map.get(equipable, "bonuses", %{})
          Map.get(bonuses, "attack", 0)
      end
    else
      0
    end
  end
end
