defmodule Loka.Testing.QuestStrategy do
  @moduledoc """
  Unified quest strategy for automated testing.

  This module is the **single source of truth** for quest-playing logic.
  It determines what action to take given the current game state, without
  actually executing the action.

  ## Design Philosophy

  The strategy is a pure function: given state, return next action.
  Execution is handled by the caller (Elixir bot or Playwright via API).

  ```
  ┌─────────────────────────────────────────────────────────────────┐
  │                    QuestStrategy (this module)                   │
  │  Pure decision logic - no side effects                          │
  │  - What quest should I work on?                                 │
  │  - What objective is next?                                      │
  │  - How do I get there? (pathfinding)                            │
  │  - What dialogue choice should I pick?                          │
  └────────────────────────────┬────────────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
  ┌─────────────────────┐             ┌─────────────────────┐
  │  Elixir Bot         │             │  Playwright E2E     │
  │  (direct execution) │             │  (via /api/test)    │
  │                     │             │                     │
  │  BotActions module  │             │  game.navigate()    │
  │  executes actions   │             │  game.talkToNpc()   │
  └─────────────────────┘             └─────────────────────┘
  ```

  ## Usage

  ```elixir
  # Get the next action to take
  context = %{
    storyline_id: "monastery_arc",
    current_room_id: "monastery_gate",
    game_state: game_state,
    nearby_entities: [...],
    dialogue_state: nil,
    room_graph: %{...}
  }

  case QuestStrategy.next_action(context) do
    {:navigate, direction} -> # Move in that direction
    {:talk, npc_key} -> # Start dialogue with NPC
    {:dialogue_choice, index} -> # Select dialogue option
    {:pick_up, item_key} -> # Get item from room
    {:attack, enemy_key} -> # Attack enemy
    {:complete, results} -> # Storyline finished
    {:stuck, reason} -> # Can't proceed
  end
  ```
  """

  require Logger

  @behaviour Loka.Testing.Bot.Strategy

  alias Loka.Framework.Storyline.Storyline
  alias Loka.Content
  alias Loka.Framework.Quest
  alias Loka.Engine.Entities
  alias Loka.Testing.Bot.BotHelpers

  # ============================================================================
  # Strategy Behavior Callbacks
  # ============================================================================

  @impl true
  def init(opts) do
    storyline_id = Keyword.get(opts, :storyline_id, "main_storyline")
    include_side_quests = Keyword.get(opts, :include_side_quests, false)
    # Optional list of specific side quests to include (if nil, includes all)
    side_quest_filter = Keyword.get(opts, :side_quest_filter, nil)

    context = %{
      storyline_id: storyline_id,
      include_side_quests: include_side_quests,
      side_quest_filter: side_quest_filter
    }

    {:ok, initial_strategy_state(context)}
  end

  @impl true
  def decide(context, strategy_state) do
    # Convert ChannelBot context to QuestStrategy context format
    quest_context = %{
      storyline_id: strategy_state[:storyline_id] || "main_storyline",
      current_room_id: get_room_id(context.room),
      current_room_key: get_room_key(context.room),
      game_state: context.game_state,
      nearby_entities: context.nearby_entities || [],
      dialogue_state: context[:dialogue_state],
      strategy_state: strategy_state,
      bot_state: context[:bot_state]
    }

    {action, new_state} = next_action(quest_context)

    # Convert QuestStrategy action format to Strategy behavior action format
    # Pass nearby_entities to convert NPC keys to entity IDs
    converted_action = convert_action(action, context.nearby_entities || [])
    {converted_action, new_state}
  end

  defp get_room_id(nil), do: nil
  defp get_room_id(%{id: id}), do: id
  defp get_room_id(%{"id" => id}), do: id
  defp get_room_id(_), do: nil

  defp get_room_key(nil), do: nil
  defp get_room_key(%{key: key}), do: key
  defp get_room_key(%{"key" => key}), do: key
  defp get_room_key(_), do: nil

  @impl true
  def handle_event(_event, state) do
    {:ok, state}
  end

  # Convert QuestStrategy action tuples to Strategy behavior format
  # Also converts NPC/item keys to entity IDs by looking up in nearby_entities
  defp convert_action({:navigate, direction}, _entities), do: {:move, direction}

  defp convert_action({:talk, npc_key}, entities) do
    # Look up entity ID from key
    entity_id = find_entity_id_by_key(entities, npc_key)
    {:start_dialogue, entity_id || npc_key}
  end

  defp convert_action({:dialogue_choice, index}, _entities), do: {:dialogue_choice, index}

  defp convert_action({:pick_up, item_key}, entities) do
    entity_id = find_entity_id_by_key(entities, item_key)
    {:interact, entity_id || item_key}
  end

  defp convert_action({:attack, enemy_key}, entities) do
    entity_id = find_entity_id_by_key(entities, enemy_key)
    {:attack, entity_id || enemy_key}
  end

  defp convert_action({:craft, recipe_key, tool_id}, _entities), do: {:craft, recipe_key, tool_id}
  defp convert_action(:idle, _entities), do: :idle
  defp convert_action({:wait, ms}, _entities), do: {:wait, ms}
  defp convert_action({:complete, _results} = action, _entities), do: action
  defp convert_action({:stuck, _reason} = action, _entities), do: action
  defp convert_action(action, _entities), do: action

  # Helper to find entity ID by key in nearby_entities list
  defp find_entity_id_by_key(entities, key) do
    entity =
      Enum.find(entities, fn e ->
        # Try matching by key field
        # Try matching by primary_keyword
        # Try matching by normalized name (e.g., "Abbot Jampa" -> "abbot_jampa")
        e[:key] == key || e["key"] == key ||
          (e[:primary_keyword] == key || e["primary_keyword"] == key) ||
          normalize_entity_name(e[:name] || e["name"]) == key
      end)

    entity && (entity[:id] || entity["id"])
  end

  # Normalize entity name to key format (e.g., "Abbot Jampa" -> "abbot_jampa")
  defp normalize_entity_name(name) when is_binary(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "_")
    |> String.trim("_")
  end

  defp normalize_entity_name(_), do: nil

  # ============================================================================
  # Types
  # ============================================================================

  @type action ::
          {:navigate, direction :: String.t()}
          | {:talk, npc_key :: String.t()}
          | {:dialogue_choice, index :: non_neg_integer()}
          | {:pick_up, item_key :: String.t()}
          | {:attack, enemy_key :: String.t()}
          | {:craft, recipe_key :: String.t(), tool_id :: String.t() | nil}
          | {:accept_quest, quest_id :: String.t()}
          | {:complete_quest, quest_id :: String.t()}
          | {:wait, milliseconds :: non_neg_integer()}
          | {:complete, results :: map()}
          | {:stuck, reason :: atom()}
          | :idle

  @type context :: %{
          required(:storyline_id) => String.t(),
          required(:current_room_id) => String.t() | nil,
          required(:game_state) => map(),
          optional(:nearby_entities) => list(map()),
          optional(:dialogue_state) => map() | nil,
          optional(:room_graph) => map(),
          optional(:entity_locations) => map(),
          optional(:strategy_state) => map()
        }

  # ============================================================================
  # Main Entry Point
  # ============================================================================

  @doc """
  Determines the next action to take given the current context.

  Returns `{action, updated_strategy_state}` where action is what to do
  and strategy_state tracks internal progress.
  """
  @spec next_action(context()) :: {action(), map()}
  def next_action(context) do
    strategy_state = context[:strategy_state] || initial_strategy_state(context)

    Logger.info("[STRATEGY] next_action: phase=#{inspect(strategy_state.phase)}")

    case strategy_state.phase do
      :init -> init_phase(context, strategy_state)
      :find_quest_giver -> find_quest_giver_phase(context, strategy_state)
      :navigate -> navigate_phase(context, strategy_state)
      :dialogue -> dialogue_phase(context, strategy_state)
      :interact -> interact_phase(context, strategy_state)
      :complete -> {{:complete, strategy_state.results}, strategy_state}
      :failed -> {{:stuck, strategy_state.failure_reason}, strategy_state}
    end
  end

  @doc """
  Creates the initial strategy state for a storyline.
  """
  @spec initial_strategy_state(context()) :: map()
  def initial_strategy_state(context) do
    %{
      phase: :init,
      current_quest_id: nil,
      current_objective: nil,
      target_room_id: nil,
      target_room_key: nil,
      target_entity_key: nil,
      dialogue_goal: nil,
      waiting_for_dialogue: false,
      locally_completed_objectives: [],
      path: [],
      failure_reason: nil,
      results: %{
        quests_completed: [],
        objectives_achieved: [],
        npcs_talked_to: [],
        items_collected: [],
        enemies_defeated: [],
        rooms_visited: []
      },
      storyline_id: context.storyline_id,
      include_side_quests: context[:include_side_quests] || false,
      side_quest_filter: context[:side_quest_filter]
    }
  end

  # ============================================================================
  # Phase Handlers
  # ============================================================================

  # Initialize: Determine the first quest to work on
  defp init_phase(context, state) do
    case Content.Storyline.get_struct(state.storyline_id) do
      {:error, :not_found} ->
        state = %{state | phase: :failed, failure_reason: :storyline_not_found}
        {{:stuck, :storyline_not_found}, state}

      {:ok, storyline} ->
        # Check BOTH game state completed list AND strategy's internal tracking
        game_completed = get_completed_quests(context.game_state)
        strategy_completed = state.results.quests_completed

        # Sync: if any quests completed server-side (system quests auto-complete),
        # record them in strategy_completed so they're tracked properly
        newly_completed = game_completed -- strategy_completed

        state =
          if newly_completed != [] do
            Logger.info(
              "[STRATEGY] Syncing server-completed quests to strategy: #{inspect(newly_completed)}"
            )

            Enum.reduce(newly_completed, state, fn quest_id, acc_state ->
              record_quest_complete(acc_state, quest_id)
            end)
          else
            state
          end

        strategy_completed = state.results.quests_completed
        all_completed = Enum.uniq(game_completed ++ strategy_completed)

        quest_order =
          if state.include_side_quests do
            all = Storyline.all_quests(storyline)

            # Filter side quests if a filter is specified
            case state.side_quest_filter do
              nil ->
                all

              filter when is_list(filter) ->
                main_quests = Storyline.quest_order(storyline)

                Enum.filter(all, fn quest_id ->
                  quest_id in main_quests or quest_id in filter
                end)
            end
          else
            Storyline.quest_order(storyline)
          end

        Logger.info(
          "[STRATEGY] init_phase: game_completed=#{inspect(game_completed)}, strategy_completed=#{inspect(strategy_completed)}"
        )

        case Enum.find(quest_order, &(&1 not in all_completed)) do
          nil ->
            # All quests completed!
            state = %{state | phase: :complete}
            {{:complete, state.results}, state}

          quest_id ->
            active_quest_ids = get_active_quest_ids(context.game_state)
            quest_active? = quest_id in active_quest_ids

            Logger.info(
              "[STRATEGY] init_phase: quest_id=#{quest_id}, active_ids=#{inspect(active_quest_ids)}, active?=#{quest_active?}"
            )

            if quest_active? do
              work_on_quest(context, state, quest_id)
            else
              # Need to find quest giver
              Logger.info("[STRATEGY] Quest not active, finding quest giver for #{quest_id}")

              case find_quest_giver(quest_id) do
                {:system_granted, ^quest_id} ->
                  # Auto-accept system quests
                  Logger.info("[STRATEGY] System quest - auto-accepting #{quest_id}")
                  state = %{state | current_quest_id: quest_id}
                  {{:accept_quest, quest_id}, state}

                {:ok, npc_key, room_id} ->
                  Logger.info(
                    "[STRATEGY] Found quest giver: #{npc_key} at room #{inspect(room_id)}, going to find_quest_giver phase"
                  )

                  state = %{
                    state
                    | current_quest_id: quest_id,
                      target_entity_key: npc_key,
                      target_room_id: room_id,
                      dialogue_goal: {:accept_quest, quest_id},
                      phase: :find_quest_giver
                  }

                  {:idle, state}

                {:error, :not_found} ->
                  Logger.info("[STRATEGY] Quest giver not found, trying to work on quest anyway")
                  # Can't find quest giver, try working on quest anyway
                  work_on_quest(context, state, quest_id)
              end
            end
        end
    end
  end

  # Find and navigate to quest giver
  defp find_quest_giver_phase(context, state) do
    Logger.info(
      "[STRATEGY] find_quest_giver_phase: target=#{state.target_entity_key}, current_room=#{inspect(context.current_room_id)}, target_room=#{inspect(state.target_room_id)}"
    )

    Logger.info(
      "[STRATEGY] nearby_entities in find_quest_giver: #{inspect(Enum.map(context.nearby_entities, &(&1[:key] || &1.key)))}"
    )

    # Check if target NPC is in current room
    target = find_entity_in_room(context, state.target_entity_key)

    Logger.info("[STRATEGY] target found in room: #{inspect(not is_nil(target))}")

    if target do
      Logger.info("[STRATEGY] Found target NPC, starting dialogue")
      state = %{state | phase: :dialogue, waiting_for_dialogue: true}
      {{:talk, state.target_entity_key}, state}
    else
      # Navigate to target room
      if state.target_room_id && context.current_room_id != state.target_room_id do
        Logger.info(
          "[STRATEGY] Not at target room, navigating from #{inspect(context.current_room_id)} to #{inspect(state.target_room_id)}"
        )

        navigate_to_room(context, state, state.target_room_id)
      else
        Logger.info(
          "[STRATEGY] Already at target room or no target room, exploring for #{state.target_entity_key}"
        )

        # Explore to find the NPC
        explore_for_entity(context, state, state.target_entity_key)
      end
    end
  end

  # Handle dialogue navigation
  defp dialogue_phase(context, state) do
    dialogue_state = context[:dialogue_state]

    Logger.info(
      "[STRATEGY] dialogue_phase: dialogue_state=#{inspect(dialogue_state)}, waiting=#{state.waiting_for_dialogue}"
    )

    if is_nil(dialogue_state) do
      # Check if we're waiting for dialogue to open after sending talk action
      if state.waiting_for_dialogue do
        # Check if goal/objective was achieved even though dialogue didn't fully open
        # (talk objectives complete immediately when dialogue starts)
        goal_achieved = dialogue_goal_achieved?(context, state)
        obj_complete = objective_complete?(context, state)

        # Also check if current quest is no longer active (was completed via dialogue action)
        quest_no_longer_active =
          state.current_quest_id &&
            state.current_quest_id not in get_active_quest_ids(context.game_state)

        if goal_achieved || obj_complete || quest_no_longer_active do
          # Goal achieved, proceed even though dialogue didn't open
          Logger.debug(
            "[STRATEGY] Goal achieved while waiting for dialogue (quest_no_longer_active=#{quest_no_longer_active})"
          )

          state = record_objective_complete(state)
          # If quest is no longer active, record it as complete
          state =
            if quest_no_longer_active do
              record_quest_complete(state, state.current_quest_id)
            else
              state
            end

          state = %{
            state
            | phase: :init,
              dialogue_goal: nil,
              waiting_for_dialogue: false,
              current_quest_id: nil
          }

          {:idle, state}
        else
          # Still waiting for dialogue to open
          Logger.debug("[STRATEGY] Waiting for dialogue to open...")
          {{:wait, 100}, state}
        end
      else
        # Dialogue actually ended - check if we should proceed
        # Check multiple conditions:
        # 1. dialogue_goal achieved (e.g., accept_quest or complete_quest worked)
        # 2. objective complete (e.g., talk objective marked done)
        # 3. current quest is completed (e.g., quest completed via dialogue action)
        # 4. current quest is no longer active (moved to completed list)
        # 5. a new quest is now active (e.g., we accepted a new quest during dialogue)
        goal_achieved = dialogue_goal_achieved?(context, state)
        obj_complete = objective_complete?(context, state)

        quest_completed =
          state.current_quest_id &&
            state.current_quest_id in get_completed_quests(context.game_state)

        # Check if quest is no longer in active list (was completed via dialogue)
        quest_no_longer_active =
          state.current_quest_id &&
            state.current_quest_id not in get_active_quest_ids(context.game_state)

        new_quest_active = has_new_quest_active?(context, state)

        Logger.info(
          "[STRATEGY] dialogue ended: goal=#{goal_achieved}, obj=#{obj_complete}, quest_done=#{quest_completed}, quest_no_longer_active=#{quest_no_longer_active}, new_active=#{new_quest_active}, active_ids=#{inspect(get_active_quest_ids(context.game_state))}"
        )

        if goal_achieved || obj_complete || quest_completed || quest_no_longer_active ||
             new_quest_active do
          state = record_objective_complete(state)
          # If quest is no longer active, record it as complete
          state =
            if quest_no_longer_active && state.current_quest_id do
              record_quest_complete(state, state.current_quest_id)
            else
              state
            end

          state = %{state | phase: :init, dialogue_goal: nil, current_quest_id: nil}
          {:idle, state}
        else
          # Check if we were trying to complete a quest and all objectives are done
          # (workaround for dialogue actions not executing properly)
          all_objectives_complete =
            case state.dialogue_goal do
              {:complete_quest, quest_id} ->
                case Quest.get_quest_definition(quest_id) do
                  nil ->
                    false

                  quest_def ->
                    next_obj =
                      find_next_objective(
                        context.game_state,
                        quest_id,
                        quest_def,
                        state.locally_completed_objectives
                      )

                    is_nil(next_obj)
                end

              _ ->
                false
            end

          if all_objectives_complete do
            Logger.info(
              "[STRATEGY] Quest objectives complete but quest didn't complete via dialogue - marking as done locally"
            )

            state = record_quest_complete(state, state.current_quest_id)
            state = %{state | phase: :init, dialogue_goal: nil, current_quest_id: nil}
            {:idle, state}
          else
            # Restart from finding quest giver
            state = %{state | phase: :find_quest_giver}
            {:idle, state}
          end
        end
      end
    else
      # Dialogue is open - clear waiting flag and navigate through it
      state = %{state | waiting_for_dialogue: false}

      # Check if quest was completed during dialogue (e.g., by dialogue action)
      if dialogue_goal_achieved?(context, state) do
        Logger.info("[STRATEGY] Quest completed during dialogue, exiting")
        state = record_objective_complete(state)
        state = %{state | phase: :init, dialogue_goal: nil}
        {:idle, state}
      else
        # Choices are directly in dialogue_state from GameChannel
        raw_choices = dialogue_state[:choices] || dialogue_state["choices"] || []

        # Filter out choices that would accept quests not in our filter
        choices = filter_choices_by_quest_filter(raw_choices, state.side_quest_filter)

        if Enum.empty?(choices) do
          # No choices available - dialogue may be showing text without choices yet
          # or waiting for Continue button. Wait for UI to update rather than resetting.
          # Keep phase as :dialogue so we check again next iteration.
          {{:wait, 200}, state}
        else
          # Find the best choice based on our goal
          case find_best_dialogue_choice(choices, state.dialogue_goal) do
            nil ->
              # No choice matches our goal
              # Check if there's an exit choice (next: null or ends dialogue)
              exit_idx = find_exit_dialogue_choice(choices)

              cond do
                # If quest is already completed, find exit
                quest_completed?(context, state) ->
                  if exit_idx do
                    {{:dialogue_choice, exit_idx}, state}
                  else
                    # Pick first choice to try to exit
                    {{:dialogue_choice, 0}, state}
                  end

                # Otherwise continue exploring dialogue
                true ->
                  {{:dialogue_choice, 0}, state}
              end

            index ->
              {{:dialogue_choice, index}, state}
          end
        end
      end
    end
  end

  # Check if current quest is completed
  defp quest_completed?(context, state) do
    quest_id = state.current_quest_id

    if quest_id do
      completed_quests = get_completed_quests(context.game_state)
      quest_id in completed_quests
    else
      false
    end
  end

  # Find a choice that exits dialogue (next: null)
  defp find_exit_dialogue_choice(choices) do
    Enum.find_index(choices, fn choice ->
      next = choice[:next] || choice["next"]
      is_nil(next)
    end)
  end

  # Check if the dialogue goal was achieved
  defp dialogue_goal_achieved?(context, state) do
    case state.dialogue_goal do
      {:complete_quest, quest_id} ->
        completed_quests = get_completed_quests(context.game_state)
        quest_id in completed_quests

      {:accept_quest, quest_id} ->
        active_quest_ids = get_active_quest_ids(context.game_state)
        quest_id in active_quest_ids

      {:reach_node, target_node_id} ->
        # Check if we're currently at the target dialogue node
        dialogue_state = BotHelpers.get_dialogue_state(context)
        current_node = dialogue_state[:node_id] || dialogue_state["node_id"]
        current_node == target_node_id

      nil ->
        # No specific goal, consider objective completion
        objective_complete?(context, state)

      _ ->
        false
    end
  end

  # Navigate: Move towards target room
  defp navigate_phase(context, state) do
    cond do
      context.current_room_id == state.target_room_id ->
        state = %{state | phase: :interact}
        {:idle, state}

      state.path != [] ->
        [next_direction | rest] = state.path
        state = %{state | path: rest}
        {{:navigate, next_direction}, state}

      true ->
        # No path, explore
        navigate_to_room(context, state, state.target_room_id)
    end
  end

  # Interact with target entity
  defp interact_phase(context, state) do
    objective_type = state.current_objective && state.current_objective.type

    Logger.info(
      "[STRATEGY] interact_phase: objective=#{inspect(objective_type)}, target=#{state.target_entity_key}, room=#{context.current_room_id}"
    )

    Logger.info(
      "[STRATEGY] nearby_entities: #{inspect(Enum.map(context.nearby_entities, &(&1[:key] || &1.key)))}"
    )

    # Handle go_to and craft objectives specially - no entity to interact with
    cond do
      objective_type == :go_to ->
        # For go_to, we're already at the destination (navigate_phase got us here)
        # Mark objective complete and return to init
        Logger.debug("[STRATEGY] go_to objective complete, at destination room")
        state = record_objective_complete(state)
        state = %{state | phase: :init}
        {:idle, state}

      objective_type == :craft ->
        # For craft, we don't need an entity - just execute the craft action
        recipe_key = state.target_entity_key
        Logger.info("[STRATEGY] Crafting recipe: #{recipe_key}")
        state = %{state | phase: :init}
        {{:craft, recipe_key, nil}, state}

      true ->
        target = find_entity_in_room(context, state.target_entity_key)

        Logger.info("[STRATEGY] target found: #{inspect(not is_nil(target))}")

        if target do
          case objective_type do
            :talk ->
              # Extract dialogue_topic from objective if present
              dialogue_goal =
                case state.current_objective do
                  %{dialogue_topic: topic} when is_binary(topic) ->
                    {:reach_node, topic}

                  _ ->
                    nil
                end

              Logger.info("[STRATEGY] Starting talk with dialogue_goal=#{inspect(dialogue_goal)}")

              state = record_npc_talk(state, state.target_entity_key)

              state = %{
                state
                | phase: :dialogue,
                  dialogue_goal: dialogue_goal,
                  waiting_for_dialogue: true
              }

              {{:talk, state.target_entity_key}, state}

            :get_item ->
              state = record_item_pickup(state, state.target_entity_key)
              state = %{state | phase: :init}
              {{:pick_up, state.target_entity_key}, state}

            :kill ->
              # Check if kill objective is already complete (from previous combat)
              if kill_objective_complete?(context, state) do
                Logger.debug("[STRATEGY] kill objective already complete, returning to init")
                state = record_objective_complete(state)
                state = %{state | phase: :init}
                {:idle, state}
              else
                state = record_enemy_defeat(state, state.target_entity_key)
                {{:attack, state.target_entity_key}, state}
              end

            _ ->
              state = %{state | phase: :init}
              {:idle, state}
          end
        else
          # Entity not found - for kill objectives, check if already complete
          # (enemy was despawned after combat victory)
          if objective_type == :kill && kill_objective_complete?(context, state) do
            Logger.debug(
              "[STRATEGY] kill objective complete (enemy despawned), returning to init"
            )

            state = record_objective_complete(state)
            state = %{state | phase: :init}
            {:idle, state}
          else
            # Entity not found, explore
            explore_for_entity(context, state, state.target_entity_key)
          end
        end
    end
  end

  # ============================================================================
  # Quest Logic
  # ============================================================================

  defp work_on_quest(context, state, quest_id) do
    Logger.info("[STRATEGY] work_on_quest: #{quest_id}")

    case Quest.get_quest_definition(quest_id) do
      nil ->
        Logger.info("[STRATEGY] quest definition not found: #{quest_id}")
        state = %{state | phase: :failed, failure_reason: {:quest_not_found, quest_id}}
        {{:stuck, :quest_not_found}, state}

      quest_def ->
        Logger.info("[STRATEGY] quest def found, finding next objective")

        next_obj =
          find_next_objective(
            context.game_state,
            quest_id,
            quest_def,
            state.locally_completed_objectives
          )

        Logger.info(
          "[STRATEGY] find_next_objective result: #{if next_obj, do: "#{next_obj.id} (#{next_obj.type})", else: "nil"}"
        )

        case next_obj do
          nil ->
            # All objectives complete - check if quest was already completed via dialogue
            completed_quests = get_completed_quests(context.game_state)

            Logger.info(
              "[STRATEGY] No more objectives for #{quest_id}, completed_list=#{inspect(completed_quests)}, in_completed?=#{quest_id in completed_quests}"
            )

            if quest_id in completed_quests do
              # Quest already turned in (via dialogue action), move to next quest
              state = record_quest_complete(state, quest_id)
              state = %{state | phase: :init, current_quest_id: nil}
              {:idle, state}
            else
              # Objectives done but quest not turned in yet
              # Check if this is a system-granted quest (auto-complete) or needs turn-in
              Logger.info(
                "[STRATEGY] Quest not in completed list, checking giver: #{inspect(quest_def.giver)}"
              )

              if quest_def.giver == "system" do
                # System quests auto-complete when objectives are done
                Logger.info(
                  "[STRATEGY] System quest #{quest_id} objectives complete - marking as done"
                )

                state = record_quest_complete(state, quest_id)
                state = %{state | phase: :init, current_quest_id: nil}
                {:idle, state}
              else
                # Quest completion happens via NPC dialogue (complete_quest action)
                # We need to talk to the quest giver again to complete it
                case find_quest_turnin_npc(quest_id, quest_def) do
                  {:ok, npc_key, room_id} ->
                    Logger.info(
                      "[STRATEGY] Need turn-in, talking to #{npc_key} at #{inspect(room_id)}"
                    )

                    state = %{
                      state
                      | target_entity_key: npc_key,
                        target_room_id: room_id,
                        dialogue_goal: {:complete_quest, quest_id},
                        phase: :find_quest_giver
                    }

                    {:idle, state}

                  {:error, _} ->
                    # No turn-in NPC found - wait and re-check
                    Logger.warning(
                      "[STRATEGY] Quest #{quest_id} needs turn-in but no NPC found, waiting..."
                    )

                    state = %{state | phase: :init, current_quest_id: nil}
                    {{:wait, 500}, state}
                end
              end
            end

          objective ->
            Logger.info(
              "[STRATEGY] Found objective: #{inspect(objective.type)} - #{objective.target_id}"
            )

            state = %{state | current_quest_id: quest_id, current_objective: objective}
            setup_objective_target(context, state, objective)
        end
    end
  end

  # Find the NPC to turn in a quest to
  defp find_quest_turnin_npc(_quest_id, quest_def) do
    # Turn-in is typically to the same NPC that gave the quest
    # Use Map.get for optional fields, direct field access for required fields
    turnin_key = Map.get(quest_def, :turn_in_npc) || quest_def.giver

    cond do
      turnin_key in ["system", :system, nil] ->
        {:error, :no_turnin_npc}

      true ->
        room_id = find_entity_room(turnin_key)
        {:ok, turnin_key, room_id}
    end
  end

  defp setup_objective_target(context, state, objective) do
    case objective.type do
      :talk ->
        target_key = objective.target_id
        target_room = find_entity_room(target_key)

        Logger.info(
          "[STRATEGY] talk objective: target=#{target_key}, room=#{inspect(target_room)}"
        )

        state = %{state | target_entity_key: target_key, target_room_id: target_room}

        if find_entity_in_room(context, target_key) do
          Logger.info("[STRATEGY] target found in current room, going to interact phase")
          state = %{state | phase: :interact}
          {:idle, state}
        else
          Logger.info("[STRATEGY] target not in room, navigating/exploring")
          navigate_or_explore(context, state, target_room, target_key)
        end

      :go_to ->
        target_room_key = objective.target_id
        target_room_id = find_room_by_key(target_room_key)
        matches = room_matches?(context.current_room_id, target_room_key)

        Logger.info(
          "[STRATEGY] go_to check: current=#{inspect(context.current_room_id)}, target_key=#{target_room_key}, target_id=#{inspect(target_room_id)}, matches=#{matches}"
        )

        if matches do
          Logger.info("[STRATEGY] go_to objective complete!")
          state = record_objective_complete(state)
          state = %{state | phase: :init}
          {:idle, state}
        else
          Logger.info("[STRATEGY] go_to: navigating to #{inspect(target_room_id)}")
          state = %{state | target_room_id: target_room_id, target_room_key: target_room_key}
          navigate_or_explore(context, state, target_room_id, nil)
        end

      :get_item ->
        target_key = objective.target_id
        target_room = find_entity_room(target_key)

        Logger.info(
          "[STRATEGY] get_item: target_key=#{target_key}, target_room=#{inspect(target_room)}"
        )

        state = %{state | target_entity_key: target_key, target_room_id: target_room}

        # Log what items are in the current room
        items =
          Enum.filter(context[:nearby_entities] || [], fn e ->
            get_entity_field(e, :type) == :item
          end)

        Logger.info(
          "[STRATEGY] get_item: items in room=#{inspect(Enum.map(items, &get_entity_field(&1, :key)))}"
        )

        if find_entity_in_room(context, target_key) do
          Logger.info("[STRATEGY] get_item: found item in current room, going to interact phase")
          state = %{state | phase: :interact}
          {:idle, state}
        else
          Logger.info(
            "[STRATEGY] get_item: item not in room, navigating to #{inspect(target_room)}"
          )

          navigate_or_explore(context, state, target_room, target_key)
        end

      :kill ->
        target_key = objective.target_id
        target_room = find_entity_room(target_key)
        state = %{state | target_entity_key: target_key, target_room_id: target_room}

        if find_entity_in_room(context, target_key) do
          state = %{state | phase: :interact}
          {:idle, state}
        else
          navigate_or_explore(context, state, target_room, target_key)
        end

      :craft ->
        recipe_key = objective.target_id
        Logger.info("[STRATEGY] craft objective: recipe=#{recipe_key}")

        # Find a room with the appropriate crafting station for this recipe
        target_room = find_room_with_station_for_recipe(recipe_key)
        state = %{state | target_entity_key: recipe_key, target_room_id: target_room}

        cond do
          # No station required - can craft anywhere
          is_nil(target_room) ->
            state = %{state | phase: :interact}
            {:idle, state}

          # Already at the crafting station room
          context.current_room_id == target_room ->
            state = %{state | phase: :interact}
            {:idle, state}

          # Need to navigate to the crafting station
          true ->
            navigate_or_explore(context, state, target_room, nil)
        end

      _ ->
        {{:wait, 500}, state}
    end
  end

  # ============================================================================
  # Navigation
  # ============================================================================

  defp navigate_or_explore(context, state, target_room_id, target_entity_key) do
    if target_room_id do
      navigate_to_room(context, state, target_room_id)
    else
      explore_for_entity(context, state, target_entity_key)
    end
  end

  defp navigate_to_room(context, state, target_room_id) do
    if context.current_room_id == target_room_id do
      state = %{state | phase: :interact}
      {:idle, state}
    else
      room_graph = context[:room_graph] || %{}

      case find_path(room_graph, context.current_room_id, target_room_id) do
        {:ok, [direction | rest]} ->
          state = %{state | path: rest, phase: :navigate}
          {{:navigate, direction}, state}

        _ ->
          # No path in cached graph - try building full graph from DB
          Logger.debug("[STRATEGY] No path in cached graph, building full graph...")
          full_graph = build_full_room_graph()

          case find_path(full_graph, context.current_room_id, target_room_id) do
            {:ok, [direction | rest]} ->
              Logger.debug("[STRATEGY] Found path via full graph: #{inspect([direction | rest])}")
              state = %{state | path: rest, phase: :navigate}
              {{:navigate, direction}, state}

            _ ->
              # Still no path, explore randomly
              Logger.debug("[STRATEGY] Still no path, exploring randomly")
              explore_random(context, state)
          end
      end
    end
  end

  # Build complete room graph by querying all exits from the database
  defp build_full_room_graph do
    # Get all exit entities
    exits = Entities.list_by_type(:exit)

    Enum.reduce(exits, %{}, fn exit, graph ->
      # EntitySchema uses location_id, not room_id
      room_id = exit.location_id
      direction = get_component_value(exit, "exit", "direction")
      dest_id = get_component_value(exit, "exit", "destination_id")

      if room_id && direction && dest_id do
        room_exits = Map.get(graph, room_id, %{})
        updated_exits = Map.put(room_exits, direction, dest_id)
        Map.put(graph, room_id, updated_exits)
      else
        graph
      end
    end)
  end

  defp get_component_value(entity, component_name, field) do
    components = entity.components || %{}

    component =
      Map.get(components, component_name) || Map.get(components, String.to_atom(component_name))

    if component do
      Map.get(component, field) || Map.get(component, String.to_atom(field))
    end
  end

  defp explore_for_entity(context, state, target_key) do
    if target_key && find_entity_in_room(context, target_key) do
      state = %{state | phase: :interact}
      {:idle, state}
    else
      explore_random(context, state)
    end
  end

  defp explore_random(context, state) do
    # Get exits from room data (exits are serialized as part of room, not as entities)
    room = context[:room] || %{}
    exits = room[:exits] || room["exits"] || []

    if Enum.empty?(exits) do
      Logger.debug("[STRATEGY] explore_random: no exits found, waiting")
      {{:wait, 500}, state}
    else
      # Pick a random exit
      exit = Enum.random(exits)
      direction = get_exit_direction(exit)

      Logger.debug("[STRATEGY] explore_random: picking direction #{direction}")
      state = %{state | phase: :navigate}
      {{:navigate, direction}, state}
    end
  end

  # Get direction from an exit - handles channel-serialized format
  defp get_exit_direction(exit) do
    # Channel format: %{direction: "north", destination_id: "abc123"}
    exit[:direction] || exit["direction"] || "north"
  end

  @doc """
  Simple BFS pathfinding.
  """
  @spec find_path(map(), String.t() | nil, String.t() | nil) ::
          {:ok, list(String.t())} | {:error, :no_path}
  def find_path(_room_graph, from_id, to_id) when from_id == to_id, do: {:ok, []}
  def find_path(_room_graph, nil, _to_id), do: {:error, :no_path}
  def find_path(_room_graph, _from_id, nil), do: {:error, :no_path}

  def find_path(room_graph, from_id, to_id) do
    queue = :queue.from_list([{from_id, []}])
    visited = MapSet.new([from_id])
    bfs_search(room_graph, to_id, queue, visited)
  end

  defp bfs_search(_graph, _target, {[], []}, _visited), do: {:error, :no_path}

  defp bfs_search(graph, target, queue, visited) do
    case :queue.out(queue) do
      {:empty, _} ->
        {:error, :no_path}

      {{:value, {current_id, path}}, rest_queue} ->
        neighbors = Map.get(graph, current_id, %{})

        case Enum.find(neighbors, fn {_dir, dest_id} -> dest_id == target end) do
          {direction, _} ->
            {:ok, Enum.reverse([direction | path])}

          nil ->
            {new_queue, new_visited} =
              Enum.reduce(neighbors, {rest_queue, visited}, fn {dir, dest_id}, {q, v} ->
                if MapSet.member?(v, dest_id) do
                  {q, v}
                else
                  {
                    :queue.in({dest_id, [dir | path]}, q),
                    MapSet.put(v, dest_id)
                  }
                end
              end)

            bfs_search(graph, target, new_queue, new_visited)
        end
    end
  end

  # ============================================================================
  # Dialogue Helpers
  # ============================================================================

  # Filter out dialogue choices that would accept quests not in the filter
  # This prevents the bot from accidentally accepting quests it shouldn't work on
  defp filter_choices_by_quest_filter(choices, nil), do: choices
  defp filter_choices_by_quest_filter(choices, []), do: choices

  defp filter_choices_by_quest_filter(choices, allowed_quests) when is_list(allowed_quests) do
    Enum.filter(choices, fn choice ->
      action = choice[:action] || choice["action"]

      case action do
        ["accept_quest", quest_id] ->
          # Only allow if quest is in the filter list
          quest_id in allowed_quests

        {:accept_quest, quest_id} ->
          quest_id in allowed_quests

        _ ->
          # Non-quest-accepting choices are always allowed
          true
      end
    end)
  end

  @doc """
  Finds the best dialogue choice to achieve a goal.

  First tries to find a choice with a direct action matching the goal.
  If not found, uses heuristics to pick choices likely to lead to the goal.
  """
  @spec find_best_dialogue_choice(list(map()), tuple() | nil) :: non_neg_integer() | nil
  def find_best_dialogue_choice(choices, {:accept_quest, quest_id} = goal) do
    # First try to find a choice with the exact action
    direct_match = find_choice_with_action(choices, goal)

    if direct_match do
      direct_match
    else
      # Try to find a choice whose 'next' node or text contains quest keywords
      quest_keywords = extract_quest_keywords(quest_id)
      quest_related = find_choice_by_quest_keywords(choices, quest_keywords)

      if quest_related do
        quest_related
      else
        # Fall back to heuristic: look for choices with "help", "accept", "yes", "I will", etc.
        find_choice_by_text_heuristic(choices, [
          ~r/how can i help/i,
          ~r/i('ll| will) help/i,
          ~r/accept/i,
          ~r/yes/i,
          ~r/i('ll| will) do it/i,
          ~r/tell me more/i,
          ~r/what (can|should) i do/i
        ])
      end
    end
  end

  def find_best_dialogue_choice(choices, {:complete_quest, _quest_id} = goal) do
    # First try to find a choice with the exact action
    direct_match = find_choice_with_action(choices, goal)

    if direct_match do
      direct_match
    else
      # Fall back to heuristic: look for choices about completing/turning in
      find_choice_by_text_heuristic(choices, [
        ~r/i('ve| have) (done|completed|finished)/i,
        ~r/here (is|are)/i,
        ~r/i found/i,
        ~r/mission complete/i,
        ~r/journal/i,
        ~r/i('ll| will) bring/i
      ])
    end
  end

  def find_best_dialogue_choice(choices, {:reach_node, target_node_id}) do
    # Look for a choice that leads directly to the target node
    require Logger

    Logger.info(
      "[STRATEGY] find_best_dialogue_choice: searching for path to node #{target_node_id}"
    )

    direct_match =
      Enum.find_index(choices, fn choice ->
        next_node = choice[:next] || choice["next"]

        if next_node == target_node_id do
          Logger.info(
            "[STRATEGY] Found direct path: choice \"#{choice[:text] || choice["text"]}\" -> #{next_node}"
          )

          true
        else
          false
        end
      end)

    if direct_match do
      direct_match
    else
      Logger.info("[STRATEGY] No direct path found, trying text heuristics for #{target_node_id}")

      # Fall back to text heuristics based on common dialogue topic patterns
      # For "tenzin_info" look for choices mentioning Tenzin
      # For "journal" look for choices mentioning journal, etc.
      keywords = extract_keywords_from_node_id(target_node_id)

      find_choice_by_keywords(choices, keywords)
    end
  end

  def find_best_dialogue_choice(_choices, nil), do: 0
  def find_best_dialogue_choice(_choices, _goal), do: nil

  # Find a choice that has the exact action we're looking for
  defp find_choice_with_action(choices, {:accept_quest, quest_id}) do
    Enum.find_index(choices, fn choice ->
      action = choice[:action] || choice["action"]

      case action do
        ["accept_quest", ^quest_id] -> true
        {:accept_quest, ^quest_id} -> true
        _ -> false
      end
    end)
  end

  defp find_choice_with_action(choices, {:complete_quest, quest_id}) do
    Enum.find_index(choices, fn choice ->
      action = choice[:action] || choice["action"]

      case action do
        ["complete_quest", ^quest_id] -> true
        {:complete_quest, ^quest_id} -> true
        _ -> false
      end
    end)
  end

  defp find_choice_with_action(_choices, _goal), do: nil

  # Find a choice whose text matches any of the given patterns
  defp find_choice_by_text_heuristic(choices, patterns) do
    Enum.find_index(choices, fn choice ->
      text = choice[:text] || choice["text"] || ""
      Enum.any?(patterns, fn pattern -> Regex.match?(pattern, text) end)
    end)
  end

  # Extract keywords from a node ID for text matching
  # "tenzin_info" -> ["tenzin", "info"]
  # "return_to_abbot" -> ["return", "abbot"]
  defp extract_keywords_from_node_id(node_id) when is_binary(node_id) do
    node_id
    |> String.split("_")
    |> Enum.reject(&(&1 in ["to", "the", "a", "an", "of"]))
  end

  defp extract_keywords_from_node_id(_), do: []

  # Find a choice whose text contains any of the keywords
  defp find_choice_by_keywords(choices, keywords) when is_list(keywords) do
    Enum.find_index(choices, fn choice ->
      text = String.downcase(choice[:text] || choice["text"] || "")

      Enum.any?(keywords, fn keyword ->
        String.contains?(text, String.downcase(keyword))
      end)
    end)
  end

  defp find_choice_by_keywords(_choices, _), do: nil

  # Extract keywords from a quest ID for matching dialogue choices
  # "side_alchemist_lesson" -> ["alchemist", "lesson"]
  # "main_sleeping_master" -> ["sleeping", "master"]
  defp extract_quest_keywords(quest_id) when is_binary(quest_id) do
    quest_id
    |> String.split("_")
    |> Enum.reject(&(&1 in ["side", "main", "intro", "to", "the", "a", "an", "of"]))
    |> Enum.filter(&(String.length(&1) > 2))
  end

  defp extract_quest_keywords(_), do: []

  # Find a choice whose 'next' node ID or text contains quest-related keywords
  defp find_choice_by_quest_keywords(choices, keywords)
       when is_list(keywords) and keywords != [] do
    Enum.find_index(choices, fn choice ->
      next_node = choice[:next] || choice["next"] || ""
      text = choice[:text] || choice["text"] || ""

      # Check if next node contains any keyword
      next_matches =
        Enum.any?(keywords, fn kw ->
          String.contains?(String.downcase(next_node), String.downcase(kw))
        end)

      # Check if text contains any keyword (but not a generic "accept" match)
      text_matches =
        Enum.any?(keywords, fn kw ->
          String.contains?(String.downcase(text), String.downcase(kw))
        end)

      next_matches or text_matches
    end)
  end

  defp find_choice_by_quest_keywords(_choices, _), do: nil

  # ============================================================================
  # Entity/Room Helpers (delegating to BotHelpers)
  # ============================================================================

  defp get_entity_field(entity, field), do: BotHelpers.get_entity_field(entity, field)

  defp find_entity_in_room(context, target_key),
    do: BotHelpers.find_entity_in_room(context, target_key)

  defp find_entity_room(nil), do: nil

  defp find_entity_room(entity_key) do
    case Entities.get_entity_by_key(entity_key) do
      nil -> nil
      entity -> entity.location_id
    end
  end

  defp find_room_by_key(room_key) do
    case Entities.get_entity_by_key(room_key) do
      nil -> nil
      room -> room.id
    end
  end

  defp room_matches?(nil, _), do: false

  defp room_matches?(room_id, target_key) do
    case Entities.get_entity!(room_id) do
      nil -> false
      room -> room.key == target_key
    end
  rescue
    _ -> false
  end

  # Find a room with a crafting station that can craft the given recipe
  defp find_room_with_station_for_recipe(recipe_key) do
    alias Loka.Content.Recipe, as: ContentRecipe

    # Get the recipe to find what station type it needs
    case ContentRecipe.get(recipe_key) do
      {:ok, recipe} ->
        station_type = ContentRecipe.station_type(recipe)

        # If no station required, any room works (return nil to stay in current room)
        if is_nil(station_type) do
          nil
        else
          # Find a room with the required station type
          find_room_with_station(station_type)
        end

      {:error, _} ->
        Logger.warning("[STRATEGY] Recipe not found: #{recipe_key}")
        nil
    end
  end

  # Find any room with a crafting station of the given type
  defp find_room_with_station(station_type) do
    # List all rooms and check for crafting_station component
    Entities.list_by_type(:room)
    |> Enum.find_value(fn room ->
      components = room.components || %{}
      station = components["crafting_station"] || components[:crafting_station]

      if station && (station["type"] == station_type || station[:type] == station_type) do
        room.id
      else
        nil
      end
    end)
  end

  defp find_quest_giver(quest_id) do
    case Quest.get_quest_definition(quest_id) do
      nil ->
        {:error, :not_found}

      quest_def ->
        # Use turn_in_npc as fallback if giver is not set
        giver_key = quest_def.giver || quest_def.turn_in_npc

        cond do
          giver_key == "system" or giver_key == :system ->
            {:system_granted, quest_id}

          giver_key ->
            room_id = find_entity_room(giver_key)
            {:ok, giver_key, room_id}

          true ->
            {:error, :not_found}
        end
    end
  end

  defp find_next_objective(game_state, quest_id, quest_def, locally_completed) do
    progress = get_quest_progress(game_state, quest_id)
    objectives_progress = (progress && (progress["objectives"] || progress[:objectives])) || %{}

    Logger.debug(
      "[STRATEGY] find_next_objective: quest_id=#{quest_id}, quest_def.objectives count=#{length(quest_def.objectives || [])}"
    )

    Logger.debug("[STRATEGY] progress=#{inspect(progress)}")
    Logger.debug("[STRATEGY] objectives_progress=#{inspect(objectives_progress)}")
    Logger.debug("[STRATEGY] locally_completed=#{inspect(locally_completed)}")

    result =
      Enum.find(quest_def.objectives, fn obj ->
        obj_progress = Map.get(objectives_progress, obj.id, %{})

        is_completed =
          Map.get(obj_progress, "completed") || Map.get(obj_progress, :completed, false)

        # Also check if locally completed (for go_to objectives that don't sync to server)
        is_locally_completed = {quest_id, obj.id} in locally_completed

        Logger.debug(
          "[STRATEGY] obj.id=#{obj.id}, obj_progress=#{inspect(obj_progress)}, completed=#{is_completed}, locally_completed=#{is_locally_completed}"
        )

        not is_completed and not is_locally_completed
      end)

    Logger.debug("[STRATEGY] next objective: #{if result, do: result.id, else: "nil"}")
    result
  end

  defp objective_complete?(context, state) do
    case state.current_objective do
      %{type: :talk, id: obj_id} ->
        quest_id = state.current_quest_id
        progress = get_quest_progress(context.game_state, quest_id)
        objectives = (progress && (progress["objectives"] || progress[:objectives])) || %{}
        obj_progress = Map.get(objectives, obj_id, %{})
        completed = Map.get(obj_progress, "completed") || Map.get(obj_progress, :completed, false)

        Logger.info(
          "[STRATEGY] objective_complete? quest=#{quest_id}, obj=#{obj_id}, completed=#{completed}, obj_progress=#{inspect(obj_progress)}"
        )

        completed

      _ ->
        false
    end
  end

  # Check if the current kill objective is already complete
  # Used to prevent re-attacking after combat victory
  defp kill_objective_complete?(context, state) do
    case state.current_objective do
      %{type: :kill, id: obj_id} ->
        quest_id = state.current_quest_id
        progress = get_quest_progress(context.game_state, quest_id)
        objectives = (progress && (progress["objectives"] || progress[:objectives])) || %{}
        # obj_id might be atom or string, check both
        obj_id_str = to_string(obj_id)
        obj_progress = Map.get(objectives, obj_id_str) || Map.get(objectives, obj_id, %{})

        Map.get(obj_progress, "completed") || Map.get(obj_progress, :completed, false)

      _ ->
        false
    end
  end

  # Check if there's a new quest active that we weren't working on
  # This handles the case where we accepted a new quest during dialogue
  defp has_new_quest_active?(context, state) do
    active_ids = get_active_quest_ids(context.game_state)
    current = state.current_quest_id

    # A new quest is active if any active quest is not the current one
    Enum.any?(active_ids, fn id -> id != current end)
  end

  # ============================================================================
  # Game State Helpers (delegating to BotHelpers)
  # ============================================================================

  defp get_completed_quests(game_state), do: BotHelpers.get_completed_quests(game_state)
  defp get_active_quest_ids(game_state), do: BotHelpers.get_active_quest_ids(game_state)

  defp get_quest_progress(game_state, quest_id),
    do: BotHelpers.get_quest_progress(game_state, quest_id)

  # ============================================================================
  # Recording Results
  # ============================================================================

  defp record_npc_talk(state, npc_key) do
    results = Map.update!(state.results, :npcs_talked_to, &[npc_key | &1])
    %{state | results: results}
  end

  defp record_item_pickup(state, item_key) do
    results = Map.update!(state.results, :items_collected, &[item_key | &1])
    %{state | results: results}
  end

  defp record_enemy_defeat(state, enemy_key) do
    results = Map.update!(state.results, :enemies_defeated, &[enemy_key | &1])
    %{state | results: results}
  end

  defp record_objective_complete(state) do
    if state.current_objective do
      results =
        Map.update!(
          state.results,
          :objectives_achieved,
          &[{state.current_quest_id, state.current_objective.id} | &1]
        )

      # Also track locally for objectives that don't sync to server (like go_to)
      locally_completed =
        [
          {state.current_quest_id, state.current_objective.id}
          | state.locally_completed_objectives
        ]
        |> Enum.uniq()

      %{
        state
        | results: results,
          current_objective: nil,
          locally_completed_objectives: locally_completed
      }
    else
      state
    end
  end

  defp record_quest_complete(state, quest_id) do
    results = Map.update!(state.results, :quests_completed, &[quest_id | &1])
    %{state | results: results}
  end

  # ============================================================================
  # Public API
  # ============================================================================

  @doc """
  Gets the quest order for a storyline.
  """
  @spec get_quest_order(String.t()) :: {:ok, list(String.t())} | {:error, :not_found}
  def get_quest_order(storyline_id) do
    case Content.Storyline.get_struct(storyline_id) do
      {:ok, storyline} -> {:ok, Storyline.quest_order(storyline)}
      error -> error
    end
  end

  @doc """
  Checks if a storyline run was successful.
  """
  @spec successful?(map()) :: boolean()
  def successful?(strategy_state) do
    strategy_state.phase == :complete and is_nil(strategy_state.failure_reason)
  end
end
