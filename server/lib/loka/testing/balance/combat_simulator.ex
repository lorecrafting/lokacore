defmodule Loka.Testing.Balance.CombatSimulator do
  @moduledoc """
  Monte Carlo combat simulation for balance analysis.

  Runs N iterations of combat simulations to calculate statistical outcomes:
  - Win/loss rates
  - Average turns to victory/defeat
  - Damage dealt/taken distributions
  - Level-based progression curves

  ## Usage

      # Single matchup
      results = CombatSimulator.simulate(player_stats, enemy_stats, iterations: 1000)
      IO.puts("Win rate: \#{results.win_rate * 100}%")

      # Level range analysis
      curve = CombatSimulator.simulate_level_range(1, 10, enemy_stats)
      Enum.each(curve, fn {level, results} ->
        IO.puts("Level \#{level}: \#{results.win_rate * 100}% win rate")
      end)

  ## Result Structure

      %{
        iterations: 1000,
        wins: 873,
        losses: 127,
        flees: 0,
        win_rate: 0.873,
        avg_turns: 3.2,
        avg_damage_dealt: 45.6,
        avg_damage_taken: 18.2,
        damage_dealt_histogram: %{...},
        damage_taken_histogram: %{...}
      }
  """

  @type combatant_stats :: %{
          health: non_neg_integer(),
          attack: non_neg_integer(),
          defense: non_neg_integer(),
          level: non_neg_integer()
        }

  @type simulation_result :: %{
          iterations: non_neg_integer(),
          wins: non_neg_integer(),
          losses: non_neg_integer(),
          flees: non_neg_integer(),
          win_rate: float(),
          loss_rate: float(),
          avg_turns: float(),
          avg_damage_dealt: float(),
          avg_damage_taken: float(),
          damage_dealt_histogram: map(),
          damage_taken_histogram: map()
        }

  @default_iterations 1000
  @max_turns 100

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Simulates combat between a player and enemy N times.

  ## Options

  - `:iterations` - Number of simulations (default: 1000)
  - `:player_strategy` - Player AI: `:aggressive`, `:defensive`, `:balanced` (default: `:balanced`)
  - `:parallel` - Whether to run in parallel (default: true)

  Returns a result map with statistics.
  """
  @spec simulate(combatant_stats(), combatant_stats(), keyword()) :: simulation_result()
  def simulate(player_stats, enemy_stats, opts \\ []) do
    iterations = Keyword.get(opts, :iterations, @default_iterations)
    strategy = Keyword.get(opts, :player_strategy, :balanced)
    parallel = Keyword.get(opts, :parallel, true)

    # Normalize stats to ensure consistent keys
    player = normalize_stats(player_stats)
    enemy = normalize_stats(enemy_stats)

    # Run simulations
    results =
      if parallel do
        run_parallel_simulations(player, enemy, strategy, iterations)
      else
        run_sequential_simulations(player, enemy, strategy, iterations)
      end

    # Aggregate results
    aggregate_results(results, iterations)
  end

  @doc """
  Simulates combat across a range of player levels against a fixed enemy.

  Useful for generating progression curves showing how win rate changes with level.

  Returns a list of `{level, results}` tuples.
  """
  @spec simulate_level_range(
          non_neg_integer(),
          non_neg_integer(),
          combatant_stats(),
          keyword()
        ) :: [{non_neg_integer(), simulation_result()}]
  def simulate_level_range(min_level, max_level, enemy_stats, opts \\ []) do
    iterations = Keyword.get(opts, :iterations, @default_iterations)
    base_player = Keyword.get(opts, :base_player_stats, default_player_stats())

    min_level..max_level
    |> Enum.map(fn level ->
      player_stats = scale_player_for_level(base_player, level)
      results = simulate(player_stats, enemy_stats, iterations: iterations)
      {level, results}
    end)
  end

  @doc """
  Simulates matchups across all combinations of player levels and enemy types.

  Returns a matrix of results for analysis.
  """
  @spec simulate_matchup_matrix(
          Range.t(),
          [combatant_stats()],
          keyword()
        ) :: [{non_neg_integer(), String.t(), simulation_result()}]
  def simulate_matchup_matrix(level_range, enemies, opts \\ []) do
    iterations = Keyword.get(opts, :iterations, 500)
    base_player = Keyword.get(opts, :base_player_stats, default_player_stats())

    for level <- level_range,
        {enemy_name, enemy_stats} <- enemies do
      player_stats = scale_player_for_level(base_player, level)
      results = simulate(player_stats, enemy_stats, iterations: iterations)
      {level, enemy_name, results}
    end
  end

  # =============================================================================
  # Private - Simulation Engine
  # =============================================================================

  defp run_parallel_simulations(player, enemy, strategy, iterations) do
    1..iterations
    |> Task.async_stream(
      fn _ -> run_single_combat(player, enemy, strategy) end,
      max_concurrency: System.schedulers_online() * 2,
      ordered: false
    )
    |> Enum.map(fn {:ok, result} -> result end)
  end

  defp run_sequential_simulations(player, enemy, strategy, iterations) do
    Enum.map(1..iterations, fn _ ->
      run_single_combat(player, enemy, strategy)
    end)
  end

  defp run_single_combat(player, enemy, strategy) do
    # Initialize combat state
    state = %{
      player_hp: player.health,
      player_max_hp: player.health,
      enemy_hp: enemy.health,
      enemy_max_hp: enemy.health,
      player_defending: false,
      enemy_defending: false,
      turn: 1,
      damage_dealt: 0,
      damage_taken: 0,
      outcome: nil
    }

    # Run combat loop
    final_state = combat_loop(state, player, enemy, strategy)

    %{
      outcome: final_state.outcome,
      turns: final_state.turn,
      damage_dealt: final_state.damage_dealt,
      damage_taken: final_state.damage_taken
    }
  end

  defp combat_loop(state, player, enemy, strategy) do
    cond do
      state.player_hp <= 0 ->
        %{state | outcome: :loss}

      state.enemy_hp <= 0 ->
        %{state | outcome: :win}

      state.turn > @max_turns ->
        # Timeout - count as loss
        %{state | outcome: :loss}

      true ->
        # Player turn
        state = player_turn(state, player, enemy, strategy)

        # Check if enemy died
        if state.enemy_hp <= 0 do
          %{state | outcome: :win}
        else
          # Check if player fled
          if state.outcome == :fled do
            state
          else
            # Enemy turn
            state = enemy_turn(state, player, enemy)

            # Continue loop
            combat_loop(%{state | turn: state.turn + 1}, player, enemy, strategy)
          end
        end
    end
  end

  defp player_turn(state, player, enemy, strategy) do
    action = choose_player_action(state, strategy)

    case action do
      :attack ->
        damage = calculate_damage(player.attack, enemy.defense, state.enemy_defending)

        %{
          state
          | enemy_hp: state.enemy_hp - damage,
            damage_dealt: state.damage_dealt + damage,
            player_defending: false
        }

      :defend ->
        %{state | player_defending: true}

      :flee ->
        flee_chance = max(10, 40 - enemy.level * 5)

        if :rand.uniform(100) <= flee_chance do
          %{state | outcome: :fled}
        else
          %{state | player_defending: false}
        end
    end
  end

  defp enemy_turn(state, player, enemy) do
    # Simple AI: 20% chance to defend
    action = if :rand.uniform(100) <= 20, do: :defend, else: :attack

    case action do
      :attack ->
        damage = calculate_damage(enemy.attack, player.defense, state.player_defending)

        %{
          state
          | player_hp: state.player_hp - damage,
            damage_taken: state.damage_taken + damage,
            enemy_defending: false
        }

      :defend ->
        %{state | enemy_defending: true}
    end
  end

  defp choose_player_action(state, strategy) do
    hp_percent = state.player_hp / state.player_max_hp * 100

    case strategy do
      :aggressive ->
        :attack

      :defensive ->
        if hp_percent < 50, do: :defend, else: :attack

      :balanced ->
        cond do
          hp_percent < 25 -> if :rand.uniform(100) <= 30, do: :flee, else: :defend
          hp_percent < 50 -> if :rand.uniform(100) <= 20, do: :defend, else: :attack
          true -> :attack
        end
    end
  end

  defp calculate_damage(attack, defense, defending?) do
    defense_multiplier = if defending?, do: 1.5, else: 1.0
    effective_defense = trunc(defense * defense_multiplier)

    base_damage = max(1, attack - effective_defense)

    # Add variance (+/- 20%)
    variance = :rand.uniform(41) - 21
    max(1, trunc(base_damage * (1 + variance / 100)))
  end

  # =============================================================================
  # Private - Results Aggregation
  # =============================================================================

  defp aggregate_results(results, iterations) do
    wins = Enum.count(results, &(&1.outcome == :win))
    losses = Enum.count(results, &(&1.outcome == :loss))
    flees = Enum.count(results, &(&1.outcome == :fled))

    total_turns = Enum.reduce(results, 0, &(&1.turns + &2))
    total_damage_dealt = Enum.reduce(results, 0, &(&1.damage_dealt + &2))
    total_damage_taken = Enum.reduce(results, 0, &(&1.damage_taken + &2))

    # Build histograms
    damage_dealt_histogram = build_histogram(results, :damage_dealt)
    damage_taken_histogram = build_histogram(results, :damage_taken)

    %{
      iterations: iterations,
      wins: wins,
      losses: losses,
      flees: flees,
      win_rate: wins / iterations,
      loss_rate: losses / iterations,
      avg_turns: total_turns / iterations,
      avg_damage_dealt: total_damage_dealt / iterations,
      avg_damage_taken: total_damage_taken / iterations,
      damage_dealt_histogram: damage_dealt_histogram,
      damage_taken_histogram: damage_taken_histogram
    }
  end

  defp build_histogram(results, field) do
    results
    |> Enum.map(&Map.get(&1, field, 0))
    |> Enum.reduce(%{}, fn value, acc ->
      # Bucket into ranges of 10
      bucket = div(value, 10) * 10
      Map.update(acc, bucket, 1, &(&1 + 1))
    end)
  end

  # =============================================================================
  # Private - Stats Helpers
  # =============================================================================

  defp normalize_stats(stats) do
    %{
      health: Map.get(stats, :health) || Map.get(stats, "health") || 100,
      attack: Map.get(stats, :attack) || Map.get(stats, "attack") || 10,
      defense: Map.get(stats, :defense) || Map.get(stats, "defense") || 5,
      level: Map.get(stats, :level) || Map.get(stats, "level") || 1
    }
  end

  defp default_player_stats do
    %{
      health: 100,
      attack: 10,
      defense: 5,
      level: 1
    }
  end

  defp scale_player_for_level(base_stats, level) do
    # Each level adds:
    # +10 health
    # +2 attack
    # +1 defense
    %{
      health: base_stats.health + (level - 1) * 10,
      attack: base_stats.attack + (level - 1) * 2,
      defense: base_stats.defense + (level - 1) * 1,
      level: level
    }
  end
end
