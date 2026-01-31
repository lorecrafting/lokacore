defmodule Loka.Framework.Combat.CombatRound do
  @moduledoc """
  Round-based combat system with lag, cooldowns, and skill queue.

  Implements LegendMUD-style auto-attack combat where both combatants
  attack automatically each round, with skills adding tactical options.

  ## Combat Loop (per round, ~3 seconds)

  1. AUTO-ATTACKS fire (simultaneous)
  2. QUEUED SKILLS execute (if not lagged)
  3. EFFECTS tick (DoT, buffs)
  4. LAG and COOLDOWNS decrement

  ## Lag System

  After using a skill, you have **lag** (recovery time):
  - Auto-attacks still happen
  - Cannot use other skills
  - Cannot flee

  ## Skill Queue

  Players can queue **one skill** while lagged. It executes when lag clears.

  ## State Structure

      %CombatRoundState{
        combatants: %{
          player_id => %{hp: 100, mana: 50, mv: 100, lag: 0, queued_skill: nil, ...},
          enemy_id => %{hp: 80, mana: 0, mv: 50, lag: 0, ...}
        },
        round: 1,
        log: [],
        effects: []
      }
  """

  alias Loka.Mechanics.{DamageTypes, CharacterResources}
  alias Loka.Config.Balance

  # Defaults (used when Balance config not loaded)
  @default_round_duration_ms 3_000
  @default_flee_cost 30
  @default_flee_chance 60
  @default_flee_fail_lag 2

  @type combatant_id :: String.t()
  @type combatant :: %{
          id: combatant_id(),
          name: String.t(),
          stats: map(),
          hp: non_neg_integer(),
          max_hp: non_neg_integer(),
          mana: non_neg_integer(),
          max_mana: non_neg_integer(),
          mv: non_neg_integer(),
          max_mv: non_neg_integer(),
          lag: non_neg_integer(),
          queued_skill: map() | nil,
          cooldowns: %{String.t() => non_neg_integer()},
          effects: [map()],
          weapon: map() | nil,
          armor_class: non_neg_integer()
        }

  @type t :: %__MODULE__{
          combatants: %{combatant_id() => combatant()},
          round: pos_integer(),
          log: [map()],
          effects: [map()],
          ended: boolean(),
          winner: combatant_id() | nil
        }

  defstruct combatants: %{},
            round: 1,
            log: [],
            effects: [],
            ended: false,
            winner: nil

  # =============================================================================
  # Combat Initialization
  # =============================================================================

  @doc """
  Creates a new combat round state from two combatants.
  """
  @spec new(combatant(), combatant()) :: t()
  def new(combatant_a, combatant_b) do
    %__MODULE__{
      combatants: %{
        combatant_a.id => combatant_a,
        combatant_b.id => combatant_b
      },
      round: 1,
      log: [],
      effects: [],
      ended: false,
      winner: nil
    }
  end

  @doc """
  Creates a combatant from game state.
  """
  @spec combatant_from_game_state(map(), String.t()) :: combatant()
  def combatant_from_game_state(game_state, id) do
    stats = game_state.stats || %{}
    level = Map.get(stats, :level) || Map.get(stats, "level", 1)

    # Extract the 6 stats (handle both atom and string keys)
    player_stats = %{
      str: get_stat(stats, :str, 10),
      dex: get_stat(stats, :dex, 10),
      con: get_stat(stats, :con, 10),
      int: get_stat(stats, :int, 10),
      per: get_stat(stats, :per, 10),
      spi: get_stat(stats, :spi, 10)
    }

    # Calculate resources
    max_hp = CharacterResources.max_hp(player_stats, level)
    max_mana = CharacterResources.max_mana(player_stats, level)
    max_mv = CharacterResources.max_mv(player_stats, level)

    # Get current resources (or use max)
    current_hp = get_stat(stats, :hp, max_hp)
    current_mana = get_stat(stats, :mana, max_mana)
    current_mv = get_stat(stats, :mv, max_mv)

    # Get equipment
    equipment = game_state.equipment || %{}
    weapon = get_weapon_info(equipment)
    ac = get_armor_class(equipment)

    %{
      id: id,
      name: game_state.character_name || "Unknown",
      stats: player_stats,
      level: level,
      hp: current_hp,
      max_hp: max_hp,
      mana: current_mana,
      max_mana: max_mana,
      mv: current_mv,
      max_mv: max_mv,
      lag: 0,
      queued_skill: nil,
      cooldowns: %{},
      effects: [],
      weapon: weapon,
      armor_class: ac
    }
  end

  @doc """
  Creates a combatant from an NPC/enemy definition.
  """
  @spec combatant_from_npc(map(), String.t()) :: combatant()
  def combatant_from_npc(npc, id) do
    combatant_data = Map.get(npc, :combatant) || Map.get(npc, "combatant", %{})
    stats = Map.get(combatant_data, :stats) || Map.get(combatant_data, "stats", %{})
    health = Map.get(combatant_data, :health) || Map.get(combatant_data, "health", %{})

    %{
      id: id,
      name: npc.short_desc || npc.name || "Enemy",
      stats: %{
        str: get_stat(stats, :str, 10),
        dex: get_stat(stats, :dex, 10),
        con: get_stat(stats, :con, 10),
        int: get_stat(stats, :int, 10),
        per: get_stat(stats, :per, 10),
        spi: get_stat(stats, :spi, 10)
      },
      level: get_stat(combatant_data, :level, 1),
      hp: get_stat(health, :current, 50),
      max_hp: get_stat(health, :max, 50),
      mana: get_stat(combatant_data, :mana, 0),
      max_mana: get_stat(combatant_data, :max_mana, 0),
      mv: get_stat(combatant_data, :mv, 100),
      max_mv: get_stat(combatant_data, :max_mv, 100),
      lag: 0,
      queued_skill: nil,
      cooldowns: %{},
      effects: [],
      weapon: get_npc_weapon(combatant_data),
      armor_class: get_stat(combatant_data, :ac, 0)
    }
  end

  # =============================================================================
  # Combat Round Execution
  # =============================================================================

  @doc """
  Executes one combat round.

  Returns the updated state with log entries for what happened.
  """
  @spec execute_round(t()) :: t()
  def execute_round(%__MODULE__{ended: true} = state), do: state

  def execute_round(%__MODULE__{} = state) do
    state
    |> execute_auto_attacks()
    |> execute_queued_skills()
    |> tick_effects()
    |> decrement_lag_and_cooldowns()
    |> check_combat_end()
    |> increment_round()
  end

  defp execute_auto_attacks(%__MODULE__{combatants: combatants} = state) do
    # Each combatant auto-attacks the other
    combatant_ids = Map.keys(combatants)

    Enum.reduce(combatant_ids, state, fn attacker_id, acc_state ->
      defender_id = Enum.find(combatant_ids, fn id -> id != attacker_id end)

      if defender_id do
        execute_auto_attack(acc_state, attacker_id, defender_id)
      else
        acc_state
      end
    end)
  end

  defp execute_auto_attack(%__MODULE__{combatants: combatants} = state, attacker_id, defender_id) do
    attacker = Map.get(combatants, attacker_id)
    defender = Map.get(combatants, defender_id)

    if attacker.hp <= 0 or defender.hp <= 0 do
      state
    else
      # Resolve hit
      case DamageTypes.resolve_hit(attacker.stats, defender.stats) do
        {:miss, audit} ->
          add_log(state, %{
            type: :miss,
            attacker: attacker.name,
            defender: defender.name,
            round: state.round,
            audit: audit
          })

        {:dodged, audit} ->
          add_log(state, %{
            type: :dodge,
            attacker: attacker.name,
            defender: defender.name,
            round: state.round,
            audit: audit
          })

        {:hit, _audit} ->
          # Calculate damage
          damage_type = get_weapon_damage_type(attacker.weapon)
          base_damage = get_weapon_base_damage(attacker.weapon)

          {:ok, damage, damage_audit} =
            DamageTypes.calculate_physical(
              attacker.stats,
              damage_type,
              base_damage: base_damage,
              target_ac: defender.armor_class
            )

          # Apply damage
          new_defender_hp = max(0, defender.hp - damage)
          new_defender = %{defender | hp: new_defender_hp}
          new_combatants = Map.put(state.combatants, defender_id, new_defender)

          state
          |> Map.put(:combatants, new_combatants)
          |> add_log(%{
            type: :attack,
            attacker: attacker.name,
            defender: defender.name,
            damage: damage,
            damage_type: damage_type,
            round: state.round,
            audit: damage_audit
          })
      end
    end
  end

  defp execute_queued_skills(%__MODULE__{combatants: combatants} = state) do
    Enum.reduce(Map.keys(combatants), state, fn combatant_id, acc_state ->
      combatant = Map.get(acc_state.combatants, combatant_id)

      if combatant.lag == 0 and combatant.queued_skill != nil do
        # Execute the queued skill
        acc_state
        |> execute_skill(combatant_id, combatant.queued_skill)
        |> clear_queued_skill(combatant_id)
      else
        acc_state
      end
    end)
  end

  defp execute_skill(state, _combatant_id, nil), do: state

  defp execute_skill(state, combatant_id, skill) do
    # Skill execution would be implemented here
    # For now, just log it
    combatant = Map.get(state.combatants, combatant_id)

    add_log(state, %{
      type: :skill,
      combatant: combatant.name,
      skill: skill.name,
      round: state.round
    })
  end

  defp clear_queued_skill(state, combatant_id) do
    update_combatant(state, combatant_id, fn c -> %{c | queued_skill: nil} end)
  end

  defp tick_effects(%__MODULE__{combatants: combatants} = state) do
    # Process DoT effects, buffs expiring, etc.
    Enum.reduce(Map.keys(combatants), state, fn combatant_id, acc_state ->
      combatant = Map.get(acc_state.combatants, combatant_id)

      # Process each effect
      {new_effects, damage, log_entries} =
        Enum.reduce(combatant.effects, {[], 0, []}, fn effect, {effects, dmg, logs} ->
          case effect.type do
            :burning ->
              dot_damage = effect.damage
              new_duration = effect.duration - 1

              if new_duration > 0 do
                {[%{effect | duration: new_duration} | effects], dmg + dot_damage,
                 [%{type: :dot, effect: :burning, damage: dot_damage} | logs]}
              else
                {effects, dmg + dot_damage,
                 [%{type: :dot, effect: :burning, damage: dot_damage, expired: true} | logs]}
              end

            :poisoned ->
              dot_damage = effect.damage
              new_duration = effect.duration - 1

              if new_duration > 0 do
                {[%{effect | duration: new_duration} | effects], dmg + dot_damage,
                 [%{type: :dot, effect: :poisoned, damage: dot_damage} | logs]}
              else
                {effects, dmg + dot_damage,
                 [%{type: :dot, effect: :poisoned, damage: dot_damage, expired: true} | logs]}
              end

            _ ->
              new_duration = (effect.duration || 1) - 1

              if new_duration > 0 do
                {[%{effect | duration: new_duration} | effects], dmg, logs}
              else
                {effects, dmg, [%{type: :effect_expired, effect: effect.type} | logs]}
              end
          end
        end)

      # Apply accumulated damage
      new_hp = max(0, combatant.hp - damage)
      new_combatant = %{combatant | hp: new_hp, effects: new_effects}

      acc_state
      |> Map.put(:combatants, Map.put(acc_state.combatants, combatant_id, new_combatant))
      |> add_logs(Enum.map(log_entries, &Map.put(&1, :combatant, combatant.name)))
    end)
  end

  defp decrement_lag_and_cooldowns(%__MODULE__{combatants: combatants} = state) do
    new_combatants =
      Enum.map(combatants, fn {id, combatant} ->
        new_lag = max(0, combatant.lag - 1)

        new_cooldowns =
          Enum.map(combatant.cooldowns, fn {skill, cd} ->
            {skill, max(0, cd - 1)}
          end)
          |> Enum.filter(fn {_skill, cd} -> cd > 0 end)
          |> Enum.into(%{})

        {id, %{combatant | lag: new_lag, cooldowns: new_cooldowns}}
      end)
      |> Enum.into(%{})

    %{state | combatants: new_combatants}
  end

  defp check_combat_end(%__MODULE__{combatants: combatants} = state) do
    dead = Enum.filter(combatants, fn {_id, c} -> c.hp <= 0 end)

    case dead do
      [] ->
        state

      [{loser_id, _loser}] ->
        winner_id = Enum.find(Map.keys(combatants), fn id -> id != loser_id end)
        %{state | ended: true, winner: winner_id}

      _ ->
        # Both dead - draw
        %{state | ended: true, winner: nil}
    end
  end

  defp increment_round(%__MODULE__{ended: true} = state), do: state
  defp increment_round(%__MODULE__{round: round} = state), do: %{state | round: round + 1}

  # =============================================================================
  # Player Actions
  # =============================================================================

  @doc """
  Queues a skill to be used when lag clears.

  If the player is not lagged, the skill executes immediately.
  """
  @spec queue_skill(t(), combatant_id(), map()) :: {:ok, t()} | {:error, term()}
  def queue_skill(%__MODULE__{} = state, combatant_id, skill) do
    combatant = Map.get(state.combatants, combatant_id)

    cond do
      combatant == nil ->
        {:error, :combatant_not_found}

      combatant.queued_skill != nil ->
        {:error, :skill_already_queued}

      Map.get(combatant.cooldowns, skill.key, 0) > 0 ->
        {:error, :skill_on_cooldown}

      combatant.mana < (skill.mana_cost || 0) ->
        {:error, :insufficient_mana}

      combatant.mv < (skill.mv_cost || 0) ->
        {:error, :insufficient_mv}

      true ->
        new_state =
          update_combatant(state, combatant_id, fn c ->
            %{c | queued_skill: skill}
          end)

        {:ok, new_state}
    end
  end

  @doc """
  Attempts to flee combat.

  Costs 30 MV and has a chance to fail. Failed flee causes 2 rounds of lag.
  """
  @spec attempt_flee(t(), combatant_id()) :: {:ok, t(), :success | :failed} | {:error, term()}
  def attempt_flee(%__MODULE__{} = state, combatant_id) do
    combatant = Map.get(state.combatants, combatant_id)
    flee_mv_cost = flee_cost()

    cond do
      combatant == nil ->
        {:error, :combatant_not_found}

      combatant.lag > 0 ->
        {:error, :lagged}

      combatant.mv < flee_mv_cost ->
        {:error, :insufficient_mv}

      true ->
        base_flee_chance = flee_base_chance()
        roll = :rand.uniform(100)

        if roll <= base_flee_chance do
          # Success - combat ends for this combatant
          new_state =
            state
            |> update_combatant(combatant_id, fn c ->
              %{c | mv: c.mv - flee_mv_cost}
            end)
            |> add_log(%{
              type: :flee_success,
              combatant: combatant.name,
              round: state.round
            })
            |> Map.put(:ended, true)

          {:ok, new_state, :success}
        else
          # Failed - apply lag
          fail_lag = flee_fail_lag()

          new_state =
            state
            |> update_combatant(combatant_id, fn c ->
              %{c | mv: c.mv - flee_mv_cost, lag: fail_lag}
            end)
            |> add_log(%{
              type: :flee_failed,
              combatant: combatant.name,
              round: state.round
            })

          {:ok, new_state, :failed}
        end
    end
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp get_stat(stats, key, default) do
    Map.get(stats, key) || Map.get(stats, to_string(key), default)
  end

  defp get_weapon_info(equipment) do
    weapon_id = Map.get(equipment, :weapon) || Map.get(equipment, "weapon")

    if weapon_id do
      # Would look up weapon from entity system
      # For now return default
      %{base_damage: 10, damage_type: :slashing}
    else
      # Fists
      %{base_damage: 3, damage_type: :bludgeoning}
    end
  end

  defp get_armor_class(_equipment) do
    # Would sum AC from all armor pieces
    # For now return base
    10
  end

  defp get_npc_weapon(combatant_data) do
    damage = get_stat(combatant_data, :attack, 5)
    damage_type_str = get_stat(combatant_data, :damage_type, "bludgeoning")
    damage_type = String.to_atom(damage_type_str)

    %{base_damage: damage, damage_type: damage_type}
  end

  defp get_weapon_damage_type(nil), do: :bludgeoning
  defp get_weapon_damage_type(%{damage_type: type}), do: type

  defp get_weapon_base_damage(nil), do: 3
  defp get_weapon_base_damage(%{base_damage: damage}), do: damage

  defp update_combatant(%__MODULE__{combatants: combatants} = state, combatant_id, update_fn) do
    case Map.get(combatants, combatant_id) do
      nil ->
        state

      combatant ->
        new_combatant = update_fn.(combatant)
        %{state | combatants: Map.put(combatants, combatant_id, new_combatant)}
    end
  end

  defp add_log(%__MODULE__{log: log} = state, entry) do
    %{state | log: log ++ [entry]}
  end

  defp add_logs(%__MODULE__{log: log} = state, entries) do
    %{state | log: log ++ entries}
  end

  # =============================================================================
  # Constants (from Balance config)
  # =============================================================================

  @doc "Returns the round duration in milliseconds (default: 3000)."
  @spec round_duration() :: pos_integer()
  def round_duration do
    Balance.get(:combat_round, :duration_ms, default: @default_round_duration_ms)
  end

  @doc "Returns MV cost to flee combat (default: 30)."
  @spec flee_cost() :: non_neg_integer()
  def flee_cost do
    Balance.get(:combat_round, :flee_cost, default: @default_flee_cost)
  end

  @doc "Returns base flee success chance (default: 60%)."
  @spec flee_base_chance() :: non_neg_integer()
  def flee_base_chance do
    Balance.get(:combat_round, :flee_base_chance, default: @default_flee_chance)
  end

  @doc "Returns lag rounds on failed flee (default: 2)."
  @spec flee_fail_lag() :: non_neg_integer()
  def flee_fail_lag do
    Balance.get(:combat_round, :flee_fail_lag, default: @default_flee_fail_lag)
  end
end
