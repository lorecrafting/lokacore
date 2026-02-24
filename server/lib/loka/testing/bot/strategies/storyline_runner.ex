defmodule Loka.Testing.Bot.Strategies.StorylineRunner do
  @moduledoc """
  A bot strategy that plays through a complete storyline.

  This module is a thin wrapper around `QuestStrategy` that adapts its
  pure decision-making output to the bot's action execution system.

  The StorylineRunner validates that a storyline is completable by:
  - Following quest objectives in order
  - Navigating to required locations using BFS pathfinding
  - Talking to NPCs and navigating dialogue trees
  - Accepting quests through proper NPC dialogue
  - Picking up quest items
  - Defeating required enemies
  - Verifying quest completion and rewards

  ## Architecture

  ```
  ┌─────────────────────────────────────────────────────────┐
  │  QuestStrategy (pure decision logic)                     │
  │  Returns: {:navigate, dir}, {:talk, npc}, etc.          │
  └──────────────────────────┬──────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │  StorylineRunner (this module)                          │
  │  - Adapts QuestStrategy output to bot actions           │
  │  - Handles combat (not in QuestStrategy)                │
  │  - Manages room graph building as bot explores          │
  │  - Pretty logging for head mode                         │
  └─────────────────────────────────────────────────────────┘
  ```

  ## Options

  - `:storyline_id` - The storyline to run (required)
  - `:max_steps` - Maximum actions before stopping (default: 1000)
  - `:fail_on_stuck` - Fail if stuck for N ticks (default: 20)
  - `:log_actions` - Log each action taken (default: true)
  - `:head_mode` - Pretty terminal output (default: false)

  ## Usage

      {:ok, pid} = BotSupervisor.spawn_bot(
        strategy: Loka.Testing.Bot.Strategies.StorylineRunner,
        strategy_opts: [storyline_id: "grove_arc"]
      )

  ## Results

  The strategy tracks:
  - Quests completed
  - Objectives achieved
  - Locations visited
  - NPCs talked to
  - Items collected
  - Enemies defeated
  - Validation errors encountered
  """

  @behaviour Loka.Testing.Bot.Strategy

  require Logger

  alias Loka.Testing.Bot.BotHelpers
  alias Loka.Testing.QuestStrategy
  alias Loka.Content

  # Bot-specific phases (combat, wait are not in QuestStrategy)
  @phase_combat :combat
  @phase_wait :wait
  @phase_complete :complete
  @phase_failed :failed

  defstruct [
    :storyline_id,
    :strategy_state,
    phase: :init,
    step_count: 0,
    max_steps: 1000,
    stuck_count: 0,
    fail_on_stuck: 20,
    log_actions: true,
    head_mode: false,
    include_side_quests: false,
    side_quest_filter: nil,
    visited_rooms: MapSet.new(),
    room_graph: %{},
    entity_locations: %{},
    results: %{
      quests_completed: [],
      objectives_achieved: [],
      npcs_talked_to: [],
      items_collected: [],
      enemies_defeated: [],
      rooms_visited: [],
      errors: [],
      warnings: []
    }
  ]

  # =============================================================================
  # Strategy Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    storyline_id = Keyword.fetch!(opts, :storyline_id)

    case Content.Storyline.get_struct(storyline_id) do
      {:ok, storyline} ->
        state = %__MODULE__{
          storyline_id: storyline_id,
          max_steps: Keyword.get(opts, :max_steps, 1000),
          fail_on_stuck: Keyword.get(opts, :fail_on_stuck, 20),
          log_actions: Keyword.get(opts, :log_actions, true),
          head_mode: Keyword.get(opts, :head_mode, false),
          include_side_quests: Keyword.get(opts, :include_side_quests, false),
          side_quest_filter: Keyword.get(opts, :side_quest_filter, nil)
        }

        log(state, "Starting storyline: #{storyline.name}")
        {:ok, state}

      {:error, :not_found} ->
        state = %__MODULE__{
          storyline_id: storyline_id,
          phase: @phase_failed,
          results: %{
            quests_completed: [],
            objectives_achieved: [],
            npcs_talked_to: [],
            items_collected: [],
            enemies_defeated: [],
            rooms_visited: [],
            errors: [{:storyline_not_found, storyline_id}],
            warnings: []
          }
        }

        {:ok, state}
    end
  end

  @impl true
  def decide(_context, %{phase: @phase_failed} = state) do
    {:idle, state}
  end

  def decide(_context, %{phase: @phase_complete} = state) do
    {:idle, state}
  end

  def decide(context, state) do
    # Check max steps
    if state.step_count >= state.max_steps do
      state = add_error(state, {:max_steps_reached, state.step_count})
      {:idle, %{state | phase: @phase_failed}}
    else
      state = %{state | step_count: state.step_count + 1}

      # Track visited rooms and build room graph
      state = update_room_tracking(context, state)

      # Debug: Log phase and in_combat status
      Logger.debug(
        "[RUNNER] decide: phase=#{inspect(state.phase)}, in_combat=#{context.in_combat}, combat_state=#{not is_nil(context[:combat_state])}"
      )

      # Handle bot-specific phases first
      case state.phase do
        @phase_combat -> combat_phase(context, state)
        @phase_wait -> wait_phase(context, state)
        _ -> delegate_to_quest_strategy(context, state)
      end
    end
  end

  @impl true
  def handle_event(_event, state) do
    {:ok, state}
  end

  @impl true
  def terminate(_reason, state) do
    log(state, "=== Storyline Run Complete ===")
    log(state, "Quests completed: #{length(state.results.quests_completed)}")
    log(state, "Objectives achieved: #{length(state.results.objectives_achieved)}")
    log(state, "Rooms visited: #{MapSet.size(state.visited_rooms)}")
    log(state, "Errors: #{length(state.results.errors)}")

    if Enum.any?(state.results.errors) do
      log(state, "ERRORS:")
      Enum.each(state.results.errors, fn err -> log(state, "  - #{inspect(err)}") end)
    end

    :ok
  end

  # =============================================================================
  # QuestStrategy Integration
  # =============================================================================

  # Delegate decision-making to QuestStrategy and adapt the result
  defp delegate_to_quest_strategy(context, state) do
    # Build context for QuestStrategy
    strategy_context = %{
      storyline_id: state.storyline_id,
      current_room_id: context.room && context.room.id,
      room: context.room,
      game_state: context.game_state,
      nearby_entities: context.nearby_entities || [],
      dialogue_state: get_dialogue_state(context),
      room_graph: state.room_graph,
      entity_locations: state.entity_locations,
      strategy_state: state.strategy_state,
      include_side_quests: state.include_side_quests,
      side_quest_filter: state.side_quest_filter
    }

    # Get next action from QuestStrategy
    {action, new_strategy_state} = QuestStrategy.next_action(strategy_context)

    # Update our strategy state
    state = %{state | strategy_state: new_strategy_state}

    # Sync results from QuestStrategy
    state = sync_results(state, new_strategy_state)

    # Adapt QuestStrategy action to bot action
    adapt_action(action, state, context)
  end

  # Sync results from QuestStrategy into our state
  defp sync_results(state, nil), do: state

  defp sync_results(state, strategy_state) do
    strategy_results = strategy_state[:results] || %{}

    results = %{
      state.results
      | quests_completed: strategy_results[:quests_completed] || state.results.quests_completed,
        objectives_achieved:
          strategy_results[:objectives_achieved] || state.results.objectives_achieved,
        npcs_talked_to: strategy_results[:npcs_talked_to] || state.results.npcs_talked_to,
        items_collected: strategy_results[:items_collected] || state.results.items_collected,
        enemies_defeated: strategy_results[:enemies_defeated] || state.results.enemies_defeated,
        rooms_visited: strategy_results[:rooms_visited] || state.results.rooms_visited
    }

    %{state | results: results}
  end

  # Adapt QuestStrategy action to bot action format
  defp adapt_action({:navigate, direction}, state, _context) do
    log(state, "Moving: #{direction}")
    {{:move, direction}, %{state | stuck_count: 0}}
  end

  defp adapt_action({:talk, npc_key}, state, context) do
    # Find the entity by key to get its ID
    target = find_entity_in_room(context, npc_key)

    if target do
      log(state, "Talking to: #{entity_name(target)}")
      {{:start_dialogue, target.id}, state}
    else
      log(state, "NPC not found: #{npc_key}")
      state = %{state | stuck_count: state.stuck_count + 1}
      {:idle, state}
    end
  end

  defp adapt_action({:dialogue_choice, index}, state, _context) do
    log(state, "Selecting dialogue choice #{index}")
    {{:dialogue_choice, index}, state}
  end

  defp adapt_action({:pick_up, item_key}, state, context) do
    target = find_entity_in_room(context, item_key)

    if target do
      log(state, "Picking up: #{entity_name(target)}")
      {{:interact, target.id}, %{state | phase: @phase_wait}}
    else
      log(state, "Item not found: #{item_key}")
      state = %{state | stuck_count: state.stuck_count + 1}
      {:idle, state}
    end
  end

  defp adapt_action({:attack, enemy_key}, state, context) do
    target = find_entity_in_room(context, enemy_key)

    if target do
      log(state, "Attacking: #{entity_name(target)}")
      {{:attack, target.id}, %{state | phase: @phase_combat}}
    else
      log(state, "Enemy not found: #{enemy_key}")
      state = %{state | stuck_count: state.stuck_count + 1}
      {:idle, state}
    end
  end

  defp adapt_action({:craft, recipe_key, tool_id}, state, _context) do
    log(state, "Crafting: #{recipe_key}")
    {{:craft, recipe_key, tool_id}, state}
  end

  defp adapt_action({:accept_quest, quest_id}, state, _context) do
    log(state, "Accepting quest: #{quest_id}")
    {{:dialogue_action, {:accept_quest, quest_id}}, state}
  end

  defp adapt_action({:wait, ms}, state, _context) do
    {{:wait, ms}, state}
  end

  defp adapt_action({:complete, _results}, state, _context) do
    log(state, "All quests completed!")
    {:idle, %{state | phase: @phase_complete}}
  end

  defp adapt_action({:stuck, reason}, state, _context) do
    state = add_error(state, {:stuck, reason})
    {:idle, %{state | phase: @phase_failed}}
  end

  defp adapt_action(:idle, state, _context) do
    {:idle, state}
  end

  # =============================================================================
  # Bot-Specific Phase Handlers
  # =============================================================================

  # Combat phase - not in QuestStrategy
  # For storyline testing, the bot always fights to completion (no fleeing)
  # This ensures kill objectives can be completed
  defp combat_phase(context, state) do
    if context.in_combat do
      # Always attack - fleeing would cause infinite loops with kill objectives
      {{:combat_action, :attack}, state}
    else
      # Combat ended
      {:idle, %{state | phase: :init, stuck_count: 0}}
    end
  end

  # Wait phase - small delay then continue
  defp wait_phase(_context, state) do
    state = %{state | stuck_count: state.stuck_count + 1}

    if state.stuck_count >= 3 do
      {:idle, %{state | phase: :init, stuck_count: 0}}
    else
      {{:wait, 200}, state}
    end
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp get_dialogue_state(context) do
    bot_state = context[:bot_state] || %{}
    dialogue_state = Map.get(bot_state, :dialogue_state)

    if dialogue_state do
      Logger.debug(
        "[RUNNER] dialogue_state present: npc=#{inspect(dialogue_state[:npc_key])}, node=#{inspect(dialogue_state[:current_node_id])}"
      )
    end

    dialogue_state
  end

  defp update_room_tracking(context, state) do
    if context.room do
      room_id = context.room.id
      exits = get_exit_destinations(context.room)

      # Update room graph
      room_graph = Map.put(state.room_graph, room_id, exits)

      # Track entities in this room
      entity_locations =
        Enum.reduce(context.nearby_entities || [], state.entity_locations, fn entity, acc ->
          key = entity.key || entity.id
          Map.put(acc, key, room_id)
        end)

      # Update visited rooms
      visited_rooms = MapSet.put(state.visited_rooms, room_id)

      %{
        state
        | room_graph: room_graph,
          entity_locations: entity_locations,
          visited_rooms: visited_rooms
      }
    else
      state
    end
  end

  defp get_exit_destinations(nil), do: %{}

  defp get_exit_destinations(room) do
    exits = room[:exits] || room["exits"] || []

    Enum.reduce(exits, %{}, fn exit, acc ->
      direction = exit[:direction] || exit["direction"]
      dest_id = exit[:destination_id] || exit["destination_id"]
      if direction && dest_id, do: Map.put(acc, direction, dest_id), else: acc
    end)
  end

  defp find_entity_in_room(context, target_key),
    do: BotHelpers.find_entity_in_room(context, target_key)

  defp entity_name(entity), do: BotHelpers.entity_name(entity)

  defp add_error(state, error) do
    log(state, "ERROR: #{inspect(error)}")
    results = Map.update!(state.results, :errors, &[error | &1])
    %{state | results: results}
  end

  # =============================================================================
  # Logging
  # =============================================================================

  defp log(%{log_actions: true, head_mode: true}, message) do
    formatted =
      cond do
        String.starts_with?(message, "Starting storyline:") ->
          "🎬 #{message}"

        String.starts_with?(message, "Targeting quest:") ->
          "\n📋 #{message}"

        String.starts_with?(message, "Working on objective:") ->
          "   🎯 #{message}"

        String.starts_with?(message, "Quest ") and String.contains?(message, "complete") ->
          "   ✅ #{message}"

        String.starts_with?(message, "Accepting") or
            String.starts_with?(message, "Auto-accepting") ->
          "   📜 #{message}"

        String.starts_with?(message, "Talking to:") or
            String.starts_with?(message, "Interacting with") ->
          "   💬 #{message}"

        String.starts_with?(message, "All quests completed") ->
          "\n🎉 #{message}"

        String.starts_with?(message, "Moving:") or String.starts_with?(message, "Exploring:") ->
          "   👣 #{message}"

        String.starts_with?(message, "Selecting dialogue") ->
          "   💭 #{message}"

        String.starts_with?(message, "Completing quest:") ->
          "   ✅ #{message}"

        true ->
          "   • #{message}"
      end

    IO.puts(formatted)
  end

  defp log(%{log_actions: true}, message) do
    Logger.info("[StorylineRunner] #{message}")
  end

  defp log(_, _), do: :ok

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Gets the final results from a completed run.
  """
  def get_results(state), do: state.results

  @doc """
  Checks if the run was successful (no errors).
  """
  def successful?(state) do
    Enum.empty?(state.results.errors) and state.phase == @phase_complete
  end
end
