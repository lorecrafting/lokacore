defmodule Loka.Framework.Combat do
  @moduledoc """
  Turn-based combat system for the game framework.

  Handles combat initiation, turn-based actions, damage calculation,
  and combat resolution. Combat state is stored in LiveView socket
  assigns rather than the database since it's temporary.

  ## Combat Types

  - **PvE** - Player vs Enemy (NPCs with combatant component)
  - **PvP** - Player vs Player (other online players)

  Both types share the same core mechanics (actions, damage, turns).
  The differences are in initialization and rewards.

  ## Combat Flow

  1. Player clicks "Attack" on a combatant NPC or another player
  2. Combat starts with player's turn
  3. Each turn, combatant can: Attack, Defend, Flee, or use Abilities
  4. Combat ends when either side reaches 0 HP or player flees

  ## Combat State Structure

      %{
        enemy_id: "uuid",
        enemy: %{name: "wolf", health: %{current: 30, max: 30}, ...},
        pvp: false,                # true for PvP combat
        player_turn: true,
        turn_count: 1,
        player_defending: false,
        enemy_defending: false,
        player_buffs: [],          # Active buffs on player
        enemy_buffs: [],           # Active buffs on enemy
        log: [%{text: "Combat begins!", type: :info}]
      }

  ## Usage

      alias Loka.Framework.Combat

      # Start PvE combat
      {:ok, combat_state} = Combat.start_combat(entity_id, game_state)

      # Start PvP combat
      {:ok, combat_state} = Combat.start_pvp_combat(player_id, player_name, game_state)

      # Player attacks (same for both types)
      {:ok, combat_state, result} = Combat.player_action(combat_state, :attack, game_state)

      # Check if combat ended
      case Combat.check_combat_end(combat_state, game_state) do
        {:victory, rewards} -> ...
        {:defeat} -> ...
        {:fled} -> ...
        :ongoing -> ...
      end
  """

  alias Loka.Engine.{Entities, Event, EventBus}
  alias Loka.Framework.Combat.DamageMessage
  alias Loka.Framework.Player.GameState
  alias Loka.Framework.Progression
  alias Loka.Mechanics.{Damage, Check}
  alias Loka.Utils.MapHelpers

  # =============================================================================
  # Combat Initialization
  # =============================================================================

  @doc """
  Starts combat with a combatant entity.

  Returns `{:ok, combat_state}` or `{:error, reason}`.
  """
  def start_combat(entity_id, %GameState{} = _game_state) do
    case Entities.get_entity(entity_id) do
      nil ->
        {:error, :entity_not_found}

      entity_schema ->
        entity = Entities.to_entity(entity_schema)
        combatant = get_combatant_component(entity)

        if combatant do
          combat_state = %{
            enemy_id: entity.id,
            enemy_key: entity.key,
            enemy: %{
              name: entity.short_desc,
              description: entity.extra_desc,
              health: Map.get(combatant, "health", %{"current" => 50, "max" => 50}),
              stats: Map.get(combatant, "stats", %{"attack" => 5, "defense" => 2}),
              level: Map.get(combatant, "level", 1),
              xp_reward: Map.get(combatant, "xp_value", 10),
              gold_reward: Map.get(combatant, "gold_value", 5)
            },
            pvp: false,
            # Auto-combat: no longer turn-based
            player_turn: true,
            turn_count: 1,
            player_defending: false,
            enemy_defending: false,
            player_buffs: [],
            enemy_buffs: [],
            fled: false,
            # Auto-combat fields
            pending_ability: nil,
            # LegendMUD-style action cooldown - blocks ALL actions until ready
            # When you use a skill, you can't use ANY other skill until cooldown expires
            action_cooldown: 0,
            log: []
          }

          {:ok, combat_state}
        else
          {:error, :not_combatant}
        end
    end
  end

  @doc """
  Starts PvP combat with another player.

  Takes the target player's id and name, and looks up their game state
  to get their stats for combat.

  Returns `{:ok, combat_state}` or `{:error, reason}`.
  """
  def start_pvp_combat(target_player_id, target_player_name, %GameState{} = _game_state) do
    case GameState.get_state(target_player_id) do
      nil ->
        {:error, :player_not_found}

      target_state ->
        # Get target player's stats
        target_stats = target_state.stats || %{}
        target_health = target_state.health || %{"current" => 100, "max" => 100}

        # Calculate combat stats from player stats
        target_str = Map.get(target_stats, "str") || Map.get(target_stats, :str) || 10
        target_sta = Map.get(target_stats, "sta") || Map.get(target_stats, :sta) || 10
        target_level = Map.get(target_stats, "level") || Map.get(target_stats, :level) || 1

        combat_state = %{
          enemy_id: target_player_id,
          enemy: %{
            name: target_player_name,
            description: "A fellow adventurer",
            health: %{
              "current" => MapHelpers.get_flexible(target_health, :current, 100),
              "max" => MapHelpers.get_flexible(target_health, :max, 100)
            },
            stats: %{
              "attack" => target_str,
              "defense" => div(target_sta, 2)
            },
            level: target_level,
            # PvP rewards are reduced
            xp_reward: target_level * 5,
            gold_reward: 0
          },
          pvp: true,
          player_turn: true,
          turn_count: 1,
          player_defending: false,
          enemy_defending: false,
          player_buffs: [],
          enemy_buffs: [],
          fled: false,
          # Auto-combat fields
          pending_ability: nil,
          log: []
        }

        {:ok, combat_state}
    end
  end

  # =============================================================================
  # Auto-Combat Tick System (LegendMUD style)
  # =============================================================================

  @doc """
  Executes one combat tick (auto-combat round).

  Both player and enemy attack in the same tick. Returns a combined log entry
  with attack descriptions and health status.

  Returns:
  - `{:ok, new_combat_state, player_damage}` - Combat continues
  - `{:victory, new_combat_state, rewards}` - Enemy defeated
  - `{:defeat, new_combat_state}` - Player defeated (needs player_damage to check)
  """
  def execute_combat_tick(combat_state, %GameState{} = game_state) do
    # Step 1: Player attacks (auto-attack)
    {:ok, combat_after_player, player_result} =
      execute_player_attack_silent(combat_state, game_state)

    updated_game_state = game_state

    # Check if enemy is dead after player attack
    enemy_hp =
      get_in(combat_after_player.enemy.health, ["current"]) ||
        get_in(combat_after_player.enemy.health, [:current]) || 0

    if enemy_hp <= 0 do
      # Victory! Generate separate log entries for each line
      player_msg = format_player_attack_message(player_result, combat_state.enemy.name)
      status_msg = DamageMessage.health_status(0, 1, combat_state.enemy.name)

      log_entries = [
        %{text: player_msg, type: :player_attack, turn: combat_after_player.turn_count},
        %{text: status_msg, type: :health_status, turn: combat_after_player.turn_count}
      ]

      final_combat = %{combat_after_player | log: combat_after_player.log ++ log_entries}

      rewards = %{
        xp: combat_state.enemy.xp_reward,
        gold: combat_state.enemy.gold_reward
      }

      {:victory, final_combat, rewards, updated_game_state}
    else
      # Step 2: Enemy attacks
      {:ok, combat_after_enemy, enemy_result} =
        execute_enemy_attack_silent(combat_after_player, game_state)

      # Get enemy health for status
      enemy_current =
        get_in(combat_after_enemy.enemy.health, ["current"]) ||
          get_in(combat_after_enemy.enemy.health, [:current]) || 0

      enemy_max =
        get_in(combat_after_enemy.enemy.health, ["max"]) ||
          get_in(combat_after_enemy.enemy.health, [:max]) || 1

      # Generate separate log entries for each line
      player_msg = format_player_attack_message(player_result, combat_state.enemy.name)
      enemy_msg = format_enemy_attack_message(enemy_result, combat_state.enemy.name)
      status_msg = DamageMessage.health_status(enemy_current, enemy_max, combat_state.enemy.name)

      log_entries =
        [
          if(player_msg != "",
            do: %{text: player_msg, type: :player_attack, turn: combat_after_enemy.turn_count}
          ),
          if(enemy_msg != "",
            do: %{text: enemy_msg, type: :enemy_attack, turn: combat_after_enemy.turn_count}
          ),
          %{text: status_msg, type: :health_status, turn: combat_after_enemy.turn_count},
          # Blank line separator between ticks
          %{text: "", type: :separator, turn: combat_after_enemy.turn_count}
        ]
        |> Enum.reject(&is_nil/1)

      final_combat = %{
        combat_after_enemy
        | log: combat_after_enemy.log ++ log_entries,
          turn_count: combat_after_enemy.turn_count + 1,
          # Reset player_turn after each tick so abilities can be used
          player_turn: true
      }

      enemy_damage = Map.get(enemy_result, :damage, 0)
      {:ok, final_combat, enemy_damage, updated_game_state}
    end
  end

  # Silent versions that don't add to log (we build combined log entry)
  defp execute_player_attack_silent(combat_state, game_state) do
    # Build context for Damage.calculate/2
    player_str =
      get_in(game_state.stats, ["str"]) ||
        get_in(game_state.stats, [:str]) || 10

    weapon_bonus = get_weapon_bonus(game_state)

    # Strength Training skill: +1 damage per level
    strength_training_bonus = get_skill_level(game_state, "strength_training")

    enemy_def =
      get_in(combat_state.enemy.stats, ["defense"]) ||
        get_in(combat_state.enemy.stats, [:defense]) || 0

    # Use Damage mechanic for calculation
    context = %{
      str: player_str,
      weapon_bonus: weapon_bonus + strength_training_bonus
    }

    {:ok, final_damage, _audit} = Damage.calculate(context, defense: enemy_def)

    # Apply damage to enemy health
    current_hp =
      get_in(combat_state.enemy.health, ["current"]) ||
        get_in(combat_state.enemy.health, [:current]) || 0

    new_hp = max(0, current_hp - final_damage)
    new_enemy_health = Map.put(combat_state.enemy.health, "current", new_hp)
    new_enemy = %{combat_state.enemy | health: new_enemy_health}

    new_state = %{combat_state | enemy: new_enemy}
    {:ok, new_state, %{action: :attack, damage: final_damage}}
  end

  defp execute_enemy_attack_silent(combat_state, game_state) do
    # Agility skill: +2% dodge chance per level (max 30%)
    agility_level = get_skill_level(game_state, "agility")
    dodge_chance = min(30, agility_level * 2)

    # Use Check mechanic for dodge roll
    dodge_success =
      if dodge_chance > 0 do
        {:ok, result, _audit} = Check.percent(dodge_chance)
        result.success
      else
        false
      end

    if dodge_success do
      {:ok, combat_state, %{action: :dodge, damage: 0}}
    else
      enemy_atk =
        get_in(combat_state.enemy.stats, ["attack"]) ||
          get_in(combat_state.enemy.stats, [:attack]) || 5

      player_def =
        get_in(game_state.stats, ["sta"]) ||
          get_in(game_state.stats, [:sta]) || 10

      # Toughness skill: -1 damage taken per level
      toughness_reduction = get_skill_level(game_state, "toughness")

      # Use Damage mechanic for enemy attack
      # Enemy uses attack stat as base, not str formula
      {:ok, final_damage, _audit} =
        Damage.calculate_from_base(enemy_atk,
          defense: trunc(player_def / 2) + toughness_reduction
        )

      # Emit damage event to update the player entity
      if game_state.player_id do
        event =
          Event.new(:damage, %{
            source: combat_state.enemy_id,
            target: game_state.player_id,
            payload: %{
              amount: final_damage,
              type: :physical,
              source_name: combat_state.enemy.name
            }
          })

        EventBus.emit(event)
      end

      {:ok, combat_state, %{action: :attack, damage: final_damage}}
    end
  end

  # Get skill level from game_state (0 if not trained)
  defp get_skill_level(game_state, skill_key) do
    skills = get_in(game_state.stats, ["skills"]) || %{}
    skill_data = Map.get(skills, skill_key, %{})

    # Handle both atom and string keys
    cond do
      is_map(skill_data) and Map.has_key?(skill_data, "level") ->
        Map.get(skill_data, "level", 0)

      is_map(skill_data) and Map.has_key?(skill_data, :level) ->
        Map.get(skill_data, :level, 0)

      is_integer(skill_data) ->
        skill_data

      true ->
        0
    end
  end

  defp format_player_attack_message(%{action: :attack, damage: damage}, enemy_name) do
    messages = DamageMessage.generate(damage, "You", enemy_name)
    messages.to_attacker
  end

  defp format_player_attack_message(_, _), do: ""

  defp format_enemy_attack_message(%{action: :attack, damage: damage}, enemy_name) do
    messages = DamageMessage.generate(damage, enemy_name, "you")
    messages.to_defender
  end

  defp format_enemy_attack_message(%{action: :dodge}, enemy_name) do
    "You nimbly dodge #{enemy_name}'s attack!"
  end

  defp format_enemy_attack_message(_, _), do: ""

  # =============================================================================
  # Combat Actions (shared by PvE and PvP)
  # =============================================================================

  @doc """
  Executes a player action during combat.

  Actions:
  - `:attack` - Deal damage to the enemy
  - `:defend` - Reduce incoming damage this turn
  - `:flee` - Attempt to escape (chance-based)

  Returns `{:ok, updated_combat_state, result}` or `{:error, reason}`.
  """
  def player_action(combat_state, action, %GameState{} = game_state) do
    # In LegendMUD-style auto-combat, player_turn is not used.
    # Actions are gated only by action_cooldown.
    case action do
      :attack -> execute_player_attack(combat_state, game_state)
      :defend -> execute_player_defend(combat_state, game_state)
      :flee -> execute_player_flee(combat_state, game_state)
      :power_strike -> execute_power_strike(combat_state, game_state)
      _ -> {:error, :invalid_action}
    end
  end

  # NOTE: enemy_turn/2 was removed - LegendMUD-style auto-combat handles
  # enemy attacks automatically in execute_combat_tick/2

  # =============================================================================
  # Combat Resolution
  # =============================================================================

  @doc """
  Checks if combat has ended.

  Returns:
  - `{:victory, rewards}` - Enemy defeated
  - `{:defeat}` - Player defeated
  - `{:fled}` - Player escaped
  - `:ongoing` - Combat continues
  """
  def check_combat_end(combat_state, %GameState{} = game_state) do
    enemy_hp =
      get_in(combat_state.enemy.health, ["current"]) ||
        get_in(combat_state.enemy.health, [:current]) || 0

    # Use unified accessor for player health
    player_health = GameState.get_health(game_state)
    player_hp = player_health[:current] || player_health["current"] || 0

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
  def apply_rewards(%GameState{} = game_state, rewards) do
    xp_amount = Map.get(rewards, :xp, 0)
    gold_amount = Map.get(rewards, :gold, 0)

    # First add gold
    current_gold =
      get_in(game_state.stats, ["gold"]) ||
        get_in(game_state.stats, [:gold]) || 0

    new_gold = current_gold + gold_amount

    new_stats = Map.put(game_state.stats || %{}, "gold", new_gold)

    # Handle both persisted and in-memory game states
    # In-memory states (like bot states) have nil inserted_at
    game_state =
      if is_nil(game_state.inserted_at) do
        # In-memory state - update directly without DB
        %{game_state | stats: new_stats}
      else
        # Persisted state - update via DB
        {:ok, updated} = GameState.update_state(game_state, %{stats: new_stats})
        updated
      end

    # Then award XP (which handles leveling)
    case Progression.award_xp(game_state, xp_amount) do
      {:ok, updated_state, nil} ->
        {:ok, updated_state}

      {:ok, updated_state, level_up_info} ->
        {:ok, updated_state, level_up_info}
    end
  end

  # =============================================================================
  # Private Functions - Damage Calculation and Combat Execution
  # =============================================================================

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

    # Use Damage mechanic for calculation
    context = %{str: player_str, weapon_bonus: weapon_bonus}

    {:ok, final_damage, _audit} =
      Damage.calculate(context,
        defense: enemy_def,
        defending: combat_state.enemy_defending
      )

    # Apply damage to enemy
    current_hp =
      get_in(combat_state.enemy.health, ["current"]) ||
        get_in(combat_state.enemy.health, [:current]) || 0

    new_hp = max(0, current_hp - final_damage)

    new_enemy_health =
      combat_state.enemy.health
      |> Map.put("current", new_hp)

    new_enemy = %{combat_state.enemy | health: new_enemy_health}

    # Generate descriptive damage message
    messages = DamageMessage.generate(final_damage, "You", combat_state.enemy.name)

    # Create log entry with tiered message
    log_entry = %{
      text: messages.to_attacker,
      type: :player_attack,
      damage: final_damage,
      turn: combat_state.turn_count
    }

    # Emit damage event to update the real entity (NPC)
    if combat_state.enemy_id do
      event =
        Event.new(:damage, %{
          source: game_state.player_id,
          target: combat_state.enemy_id,
          payload: %{
            amount: final_damage,
            # TODO: Support weapon damage types
            type: :physical,
            source_name: game_state.character_name
          }
        })

      EventBus.emit(event)
    end

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
    messages = DamageMessage.defense(:enter, "You")

    log_entry = %{
      text: messages.to_attacker,
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
    # Check global action cooldown first (LegendMUD-style: blocks all actions)
    if Map.get(combat_state, :action_cooldown, 0) > 0 do
      {:error, :on_cooldown}
    else
      # 60% base chance to flee, modified by enemy level (-3% per level)
      enemy_level = combat_state.enemy.level || 1
      flee_chance = max(20, 60 - enemy_level * 3)

      # Use Check mechanic for flee roll
      {:ok, result, _audit} = Check.percent(flee_chance)

      if result.success do
        messages = DamageMessage.flee(:success, "You", combat_state.enemy.name)

        log_entry = %{
          text: messages.to_attacker,
          type: :flee_success,
          turn: combat_state.turn_count
        }

        # No cooldown on success - combat ends immediately
        new_state = %{combat_state | fled: true, log: combat_state.log ++ [log_entry]}

        {:ok, new_state, %{action: :flee, success: true}}
      else
        messages = DamageMessage.flee(:fail, "You", combat_state.enemy.name)

        log_entry = %{
          text: messages.to_attacker,
          type: :flee_fail,
          turn: combat_state.turn_count
        }

        # LegendMUD-style: 2 round cooldown on failed flee, blocks ALL actions
        new_state = %{
          combat_state
          | player_turn: false,
            player_defending: false,
            action_cooldown: 2,
            log: combat_state.log ++ [log_entry]
        }

        {:ok, new_state, %{action: :flee, success: false}}
      end
    end
  end

  # NOTE: execute_enemy_attack and execute_enemy_defend were removed as part of
  # the LegendMUD-style auto-combat refactor. Enemy attacks are now handled
  # within execute_combat_tick/2 which combines player and enemy actions.

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

  # =============================================================================
  # Combat Turn Management
  # =============================================================================

  @doc """
  Ticks buff/debuff durations at end of turn.

  Call this after both player and enemy have taken their actions.
  """
  def tick_combat_effects(combat_state, _player_id) do
    # Decrement buff durations and remove expired ones
    new_player_buffs =
      (combat_state.player_buffs || [])
      |> Enum.map(&Map.update!(&1, :duration, fn d -> d - 1 end))
      |> Enum.filter(&(&1.duration > 0))

    new_enemy_buffs =
      (combat_state.enemy_buffs || [])
      |> Enum.map(&Map.update!(&1, :duration, fn d -> d - 1 end))
      |> Enum.filter(&(&1.duration > 0))

    # Decrement global action cooldown (LegendMUD-style: blocks all actions)
    new_action_cooldown = max(0, Map.get(combat_state, :action_cooldown, 0) - 1)

    %{
      combat_state
      | player_buffs: new_player_buffs,
        enemy_buffs: new_enemy_buffs,
        action_cooldown: new_action_cooldown
    }
  end

  # =============================================================================
  # Power Strike Ability
  # =============================================================================

  defp execute_power_strike(combat_state, game_state) do
    # Check global action cooldown first (LegendMUD-style: blocks all actions)
    if Map.get(combat_state, :action_cooldown, 0) > 0 do
      {:error, :on_cooldown}
    else
      # Power Strike: Use Damage mechanic with 150% multiplier
      player_str =
        get_in(game_state.stats, ["str"]) ||
          get_in(game_state.stats, [:str]) || 10

      weapon_bonus = get_weapon_bonus(game_state)
      strength_training_bonus = get_skill_level(game_state, "strength_training")

      enemy_def =
        get_in(combat_state.enemy.stats, ["defense"]) ||
          get_in(combat_state.enemy.stats, [:defense]) || 0

      # Calculate base damage, then apply 1.5x multiplier
      context = %{
        str: player_str,
        weapon_bonus: weapon_bonus + strength_training_bonus
      }

      {:ok, base_damage, _audit} = Damage.calculate(context, defense: enemy_def)
      # Power strike does 150% damage
      final_damage = trunc(base_damage * 1.5)

      current_hp =
        get_in(combat_state.enemy.health, ["current"]) ||
          get_in(combat_state.enemy.health, [:current]) || 0

      new_hp = max(0, current_hp - final_damage)
      new_enemy_health = Map.put(combat_state.enemy.health, "current", new_hp)
      new_enemy = %{combat_state.enemy | health: new_enemy_health}

      log_entry = %{
        text: "You unleash a powerful strike!",
        type: :power_strike,
        turn: combat_state.turn_count,
        damage: final_damage
      }

      # LegendMUD-style: 3 round cooldown on success, blocks ALL actions
      new_state = %{
        combat_state
        | enemy: new_enemy,
          player_turn: false,
          player_defending: false,
          action_cooldown: 3,
          log: combat_state.log ++ [log_entry]
      }

      {:ok, new_state, %{action: :power_strike, damage: final_damage}}
    end
  end
end
