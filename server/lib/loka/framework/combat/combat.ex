defmodule Loka.Framework.Combat do
  @moduledoc """
  Turn-based combat system for the game framework.

  Handles combat initiation, turn-based actions, damage calculation,
  and combat resolution. Combat state is stored in LiveView socket
  assigns rather than the database since it's temporary.

  Operates on character Entity structs.

  ## Combat Flow

  1. Player clicks "Attack" on a combatant NPC or another player
  2. Combat starts with player's turn
  3. Each turn, combatant can: Attack, Defend, Flee, or use Abilities
  4. Combat ends when either side reaches 0 HP or player flees

  ## Usage

      alias Loka.Framework.Combat

      # Start PvE combat
      {:ok, combat_state} = Combat.start_combat(entity_id, character)

      # Player attacks (same for both types)
      {:ok, combat_state, result} = Combat.player_action(combat_state, :attack, character)

      # Check if combat ended
      case Combat.check_combat_end(combat_state, character) do
        {:victory, rewards} -> ...
        {:defeat} -> ...
        {:fled} -> ...
        :ongoing -> ...
      end
  """

  alias Loka.Engine.{Entity, Entities, Event, EventBus}
  alias Loka.Framework.Combat.DamageMessage
  alias Loka.Framework.Progression
  alias Loka.Mechanics.{Damage, Check}

  # =============================================================================
  # Combat Initialization
  # =============================================================================

  @doc """
  Starts combat with a combatant entity.

  Returns `{:ok, combat_state}` or `{:error, reason}`.
  """
  def start_combat(entity_id, %Entity{} = _character) do
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
            player_turn: true,
            turn_count: 1,
            player_defending: false,
            enemy_defending: false,
            player_buffs: [],
            enemy_buffs: [],
            fled: false,
            pending_ability: nil,
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

  Takes the target player's id and name, and looks up their character entity
  to get their stats for combat.

  Returns `{:ok, combat_state}` or `{:error, reason}`.
  """
  def start_pvp_combat(target_player_id, target_player_name, %Entity{} = _character) do
    case Entities.find_one(account_id: target_player_id, type: :character) do
      {:error, :not_found} ->
        {:error, :player_not_found}

      {:ok, target} ->
        target_stats = Entity.get_component(target, "stats") || %{}
        target_resources = Entity.get_component(target, "resources") || %{}
        target_health = target_resources["health"] || %{"current" => 100, "max" => 100}

        target_str = Map.get(target_stats, "str") || Map.get(target_stats, :str) || 10
        target_sta = Map.get(target_stats, "sta") || Map.get(target_stats, :sta) || 10
        target_level = Map.get(target_stats, "level") || Map.get(target_stats, :level) || 1

        combat_state = %{
          enemy_id: target_player_id,
          enemy: %{
            name: target_player_name,
            description: "A fellow adventurer",
            health: %{
              "current" => target_health["current"] || 100,
              "max" => target_health["max"] || 100
            },
            stats: %{
              "attack" => target_str,
              "defense" => div(target_sta, 2)
            },
            level: target_level,
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

  Both player and enemy attack in the same tick.
  """
  def execute_combat_tick(combat_state, %Entity{} = character) do
    {:ok, combat_after_player, player_result} =
      execute_player_attack_silent(combat_state, character)

    updated_character = character

    enemy_hp =
      get_in(combat_after_player.enemy.health, ["current"]) ||
        get_in(combat_after_player.enemy.health, [:current]) || 0

    if enemy_hp <= 0 do
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

      {:victory, final_combat, rewards, updated_character}
    else
      {:ok, combat_after_enemy, enemy_result} =
        execute_enemy_attack_silent(combat_after_player, character)

      enemy_current =
        get_in(combat_after_enemy.enemy.health, ["current"]) ||
          get_in(combat_after_enemy.enemy.health, [:current]) || 0

      enemy_max =
        get_in(combat_after_enemy.enemy.health, ["max"]) ||
          get_in(combat_after_enemy.enemy.health, [:max]) || 1

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
          %{text: "", type: :separator, turn: combat_after_enemy.turn_count}
        ]
        |> Enum.reject(&is_nil/1)

      final_combat = %{
        combat_after_enemy
        | log: combat_after_enemy.log ++ log_entries,
          turn_count: combat_after_enemy.turn_count + 1,
          player_turn: true
      }

      enemy_damage = Map.get(enemy_result, :damage, 0)
      {:ok, final_combat, enemy_damage, updated_character}
    end
  end

  defp execute_player_attack_silent(combat_state, character) do
    stats = Entity.get_component(character, "stats") || %{}

    player_str =
      Map.get(stats, "str") || Map.get(stats, :str) || 10

    weapon_bonus = get_weapon_bonus(character)
    strength_training_bonus = get_skill_level(character, "strength_training")

    enemy_def =
      get_in(combat_state.enemy.stats, ["defense"]) ||
        get_in(combat_state.enemy.stats, [:defense]) || 0

    context = %{
      str: player_str,
      weapon_bonus: weapon_bonus + strength_training_bonus
    }

    {:ok, final_damage, _audit} = Damage.calculate(context, defense: enemy_def)

    current_hp =
      get_in(combat_state.enemy.health, ["current"]) ||
        get_in(combat_state.enemy.health, [:current]) || 0

    new_hp = max(0, current_hp - final_damage)
    new_enemy_health = Map.put(combat_state.enemy.health, "current", new_hp)
    new_enemy = %{combat_state.enemy | health: new_enemy_health}

    new_state = %{combat_state | enemy: new_enemy}
    {:ok, new_state, %{action: :attack, damage: final_damage}}
  end

  defp execute_enemy_attack_silent(combat_state, character) do
    agility_level = get_skill_level(character, "agility")
    dodge_chance = min(30, agility_level * 2)

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

      stats = Entity.get_component(character, "stats") || %{}

      player_def =
        Map.get(stats, "sta") || Map.get(stats, :sta) || 10

      toughness_reduction = get_skill_level(character, "toughness")

      {:ok, final_damage, _audit} =
        Damage.calculate_from_base(enemy_atk,
          defense: trunc(player_def / 2) + toughness_reduction
        )

      if character.account_id do
        event =
          Event.new(:damage, %{
            source: combat_state.enemy_id,
            target: character.account_id,
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

  defp get_skill_level(character, skill_key) do
    stats = Entity.get_component(character, "stats") || %{}
    skills = stats["skills"] || %{}
    skill_data = Map.get(skills, skill_key, %{})

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
  """
  def player_action(combat_state, action, %Entity{} = character) do
    case action do
      :attack -> execute_player_attack(combat_state, character)
      :defend -> execute_player_defend(combat_state, character)
      :flee -> execute_player_flee(combat_state, character)
      :power_strike -> execute_power_strike(combat_state, character)
      _ -> {:error, :invalid_action}
    end
  end

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
  def check_combat_end(combat_state, %Entity{} = character) do
    enemy_hp =
      get_in(combat_state.enemy.health, ["current"]) ||
        get_in(combat_state.enemy.health, [:current]) || 0

    resources = Entity.get_component(character, "resources") || %{}
    player_health = resources["health"] || %{"current" => 100, "max" => 100}
    player_hp = player_health["current"] || player_health[:current] || 0

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
  Applies victory rewards to the player's character entity.

  Returns {:ok, updated_entity} or {:ok, updated_entity, level_up_info} if leveled up.
  """
  def apply_rewards(%Entity{} = character, rewards) do
    xp_amount = Map.get(rewards, :xp, 0)
    gold_amount = Map.get(rewards, :gold, 0)

    # Add gold to stats
    stats = Entity.get_component(character, "stats") || %{}
    current_gold = Map.get(stats, "gold") || Map.get(stats, :gold) || 0
    new_gold = current_gold + gold_amount
    new_stats = Map.put(stats, "gold", new_gold)
    character = Entity.add_component(character, "stats", new_stats)

    # Award XP (which handles leveling)
    case Progression.award_xp(character, xp_amount) do
      {:ok, updated_entity, nil} ->
        {:ok, updated_entity}

      {:ok, updated_entity, level_up_info} ->
        {:ok, updated_entity, level_up_info}
    end
  end

  # =============================================================================
  # Private Functions
  # =============================================================================

  defp get_combatant_component(entity) do
    Map.get(entity.components || %{}, "combatant")
  end

  defp execute_player_attack(combat_state, character) do
    stats = Entity.get_component(character, "stats") || %{}

    player_str =
      Map.get(stats, "str") || Map.get(stats, :str) || 10

    weapon_bonus = get_weapon_bonus(character)

    enemy_def =
      get_in(combat_state.enemy.stats, ["defense"]) ||
        get_in(combat_state.enemy.stats, [:defense]) || 0

    context = %{str: player_str, weapon_bonus: weapon_bonus}

    {:ok, final_damage, _audit} =
      Damage.calculate(context,
        defense: enemy_def,
        defending: combat_state.enemy_defending
      )

    current_hp =
      get_in(combat_state.enemy.health, ["current"]) ||
        get_in(combat_state.enemy.health, [:current]) || 0

    new_hp = max(0, current_hp - final_damage)

    new_enemy_health =
      combat_state.enemy.health
      |> Map.put("current", new_hp)

    new_enemy = %{combat_state.enemy | health: new_enemy_health}

    messages = DamageMessage.generate(final_damage, "You", combat_state.enemy.name)

    log_entry = %{
      text: messages.to_attacker,
      type: :player_attack,
      damage: final_damage,
      turn: combat_state.turn_count
    }

    if combat_state.enemy_id do
      event =
        Event.new(:damage, %{
          source: character.account_id,
          target: combat_state.enemy_id,
          payload: %{
            amount: final_damage,
            type: :physical,
            source_name: character.short_desc
          }
        })

      EventBus.emit(event)
    end

    new_state = %{
      combat_state
      | enemy: new_enemy,
        player_turn: false,
        player_defending: false,
        log: combat_state.log ++ [log_entry]
    }

    {:ok, new_state, %{action: :attack, damage: final_damage}}
  end

  defp execute_player_defend(combat_state, _character) do
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

  defp execute_player_flee(combat_state, _character) do
    if Map.get(combat_state, :action_cooldown, 0) > 0 do
      {:error, :on_cooldown}
    else
      enemy_level = combat_state.enemy.level || 1
      flee_chance = max(20, 60 - enemy_level * 3)

      {:ok, result, _audit} = Check.percent(flee_chance)

      if result.success do
        messages = DamageMessage.flee(:success, "You", combat_state.enemy.name)

        log_entry = %{
          text: messages.to_attacker,
          type: :flee_success,
          turn: combat_state.turn_count
        }

        new_state = %{combat_state | fled: true, log: combat_state.log ++ [log_entry]}

        {:ok, new_state, %{action: :flee, success: true}}
      else
        messages = DamageMessage.flee(:fail, "You", combat_state.enemy.name)

        log_entry = %{
          text: messages.to_attacker,
          type: :flee_fail,
          turn: combat_state.turn_count
        }

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

  defp get_weapon_bonus(character) do
    equipment = Entity.get_component(character, "equipment") || %{}

    weapon_id =
      Map.get(equipment, "weapon") || Map.get(equipment, :weapon)

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
  """
  def tick_combat_effects(combat_state, _player_id) do
    new_player_buffs =
      (combat_state.player_buffs || [])
      |> Enum.map(&Map.update!(&1, :duration, fn d -> d - 1 end))
      |> Enum.filter(&(&1.duration > 0))

    new_enemy_buffs =
      (combat_state.enemy_buffs || [])
      |> Enum.map(&Map.update!(&1, :duration, fn d -> d - 1 end))
      |> Enum.filter(&(&1.duration > 0))

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

  defp execute_power_strike(combat_state, character) do
    if Map.get(combat_state, :action_cooldown, 0) > 0 do
      {:error, :on_cooldown}
    else
      stats = Entity.get_component(character, "stats") || %{}

      player_str =
        Map.get(stats, "str") || Map.get(stats, :str) || 10

      weapon_bonus = get_weapon_bonus(character)
      strength_training_bonus = get_skill_level(character, "strength_training")

      enemy_def =
        get_in(combat_state.enemy.stats, ["defense"]) ||
          get_in(combat_state.enemy.stats, [:defense]) || 0

      context = %{
        str: player_str,
        weapon_bonus: weapon_bonus + strength_training_bonus
      }

      {:ok, base_damage, _audit} = Damage.calculate(context, defense: enemy_def)
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
