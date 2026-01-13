defmodule Loka.Game.Actions.Dialogue do
  @moduledoc """
  Dialogue-related game actions.

  Handles NPC conversations with quest integration.

  ## Actions

  - `:talk` - Start conversation with NPC
  - `:dialogue_choice` - Select dialogue option
  """

  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Framework.Dialogue
  alias Loka.Framework.Quest
  alias Loka.Framework.Quest.StateHelper

  @doc """
  Start a conversation with an NPC.
  """
  @spec start_conversation(Context.t(), String.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def start_conversation(ctx, entity_id) do
    game_state = ctx.game_state
    alias Loka.Engine.Entities

    player_quests = build_player_quests(game_state)

    case Dialogue.start_conversation(entity_id,
           player_quests: player_quests,
           game_state: game_state
         ) do
      {:ok, node} ->
        # Track talk objective when conversation starts
        entity = Entities.get_entity(entity_id)
        target_key = if entity, do: entity.key, else: nil

        new_game_state =
          if target_key do
            require Logger

            dialogue_topic = node.id

            Logger.info(
              "[DIALOGUE] Tracking talk objective for target_key=#{target_key}, topic=#{dialogue_topic}"
            )

            quest_event = %{type: :talk, target_id: target_key, dialogue_topic: dialogue_topic}

            case Quest.update_progress(game_state, quest_event) do
              {:ok, updated_state, completed_objectives} ->
                Logger.info(
                  "[DIALOGUE] Quest progress updated successfully, completed=#{inspect(completed_objectives)}"
                )

                Logger.info(
                  "[DIALOGUE] updated_state.quests keys: #{inspect(Map.keys(updated_state.quests || %{}))}"
                )

                Logger.info(
                  "[DIALOGUE] updated_state.quests.active: #{inspect(Map.keys((updated_state.quests || %{})["active"] || %{}))}"
                )

                updated_state

              {:error, reason} ->
                Logger.warning("[DIALOGUE] Failed to update quest progress: #{inspect(reason)}")
                game_state
            end
          else
            game_state
          end

        # Process node action if present (e.g., auto-complete quest on node display)
        {final_game_state, action_events} = handle_dialogue_action(new_game_state, node[:action])

        # Use node speaker if defined, otherwise fall back to entity name
        speaker = node[:speaker] || (entity && entity.short_desc) || "NPC"

        result =
          Result.new(
            state: %{
              dialogue: %{entity_id: entity_id, node_id: node.id},
              game_state: final_game_state
            },
            events:
              action_events ++
                [
                  {:dialogue_start,
                   %{
                     entity_id: entity_id,
                     node_id: node.id,
                     text: node.text,
                     speaker: speaker,
                     choices:
                       Enum.map(node.choices || [], fn c -> %{text: c[:text], next: c[:next]} end)
                   }}
                ]
          )

        {:ok, result}

      {:error, :no_dialogue} ->
        {:error, "They have nothing to say."}

      {:error, _reason} ->
        {:error, "You can't talk to that."}
    end
  end

  @doc """
  Choose a dialogue option.
  """
  @spec choose_option(Context.t(), integer()) :: {:ok, Result.t()} | {:error, String.t()}
  def choose_option(ctx, choice_index) do
    case ctx.dialogue do
      nil ->
        {:error, "Not in a dialogue."}

      %{entity_id: entity_id, node_id: node_id} ->
        game_state = ctx.game_state
        player_quests = build_player_quests(game_state)

        case Dialogue.choose_option(entity_id, choice_index, node_id,
               player_quests: player_quests
             ) do
          {:ok, :end, %{action: action}} ->
            {new_game_state, action_events} = handle_dialogue_action(game_state, action)

            result =
              Result.new(
                state: %{dialogue: nil, game_state: new_game_state},
                events: action_events ++ [{:dialogue_end, %{entity_id: entity_id}}]
              )

            {:ok, result}

          {:ok, next_node, %{action: action}} ->
            # Process choice action first
            {new_game_state, action_events} = handle_dialogue_action(game_state, action)

            # Track talk objective for the new node we're visiting
            alias Loka.Engine.Entities
            entity = Entities.get_entity(entity_id)
            target_key = if entity, do: entity.key, else: nil
            dialogue_topic = next_node.id

            new_game_state =
              if target_key do
                require Logger

                Logger.info(
                  "[DIALOGUE] Tracking talk objective for target_key=#{target_key}, topic=#{dialogue_topic}"
                )

                quest_event = %{
                  type: :talk,
                  target_id: target_key,
                  dialogue_topic: dialogue_topic
                }

                case Quest.update_progress(new_game_state, quest_event) do
                  {:ok, updated_state, completed_objectives} ->
                    Logger.info(
                      "[DIALOGUE] Quest progress updated successfully, completed=#{inspect(completed_objectives)}"
                    )

                    updated_state

                  {:error, reason} ->
                    Logger.warning(
                      "[DIALOGUE] Failed to update quest progress: #{inspect(reason)}"
                    )

                    new_game_state
                end
              else
                new_game_state
              end

            # Then process node action if present
            {final_game_state, node_action_events} =
              handle_dialogue_action(new_game_state, next_node[:action])

            # Use node speaker if defined, otherwise fall back to entity name
            speaker = next_node[:speaker] || (entity && entity.short_desc) || "NPC"

            result =
              Result.new(
                state: %{
                  dialogue: %{entity_id: entity_id, node_id: next_node.id},
                  game_state: final_game_state
                },
                events:
                  action_events ++
                    node_action_events ++
                    [
                      {:dialogue_update,
                       %{
                         entity_id: entity_id,
                         node_id: next_node.id,
                         text: next_node.text,
                         speaker: speaker,
                         choices:
                           Enum.map(next_node.choices || [], fn c ->
                             %{text: c[:text], next: c[:next]}
                           end)
                       }}
                    ]
              )

            {:ok, result}

          {:error, _reason} ->
            result =
              Result.new(
                state: %{dialogue: nil},
                events: [{:dialogue_end, %{entity_id: entity_id}}]
              )

            {:ok, result}
        end
    end
  end

  # =============================================================================
  # Private Helpers - Dialogue Actions
  # =============================================================================

  defp handle_dialogue_action(game_state, nil), do: {game_state, []}

  defp handle_dialogue_action(game_state, {:accept_quest, quest_id}) do
    case Quest.accept_quest(game_state, quest_id) do
      {:ok, new_game_state} ->
        quest_def = Quest.get_quest_definition(quest_id)
        quest_name = if quest_def, do: quest_def.name, else: quest_id

        events = [
          {:event, "New quest — #{quest_name}"},
          {:quest_accepted, %{quest_id: quest_id, name: quest_name}}
        ]

        {new_game_state, events}

      {:error, :already_active} ->
        {game_state, [{:event, "You already have this quest."}]}

      {:error, :already_completed} ->
        {game_state, [{:event, "You've already completed this quest."}]}

      {:error, _reason} ->
        {game_state, []}
    end
  end

  defp handle_dialogue_action(game_state, {:complete_quest, quest_id}) do
    case Quest.turn_in_quest(game_state, quest_id) do
      {:ok, new_game_state, rewards} ->
        reward_text = format_quest_rewards(rewards)

        events = [
          {:event, "Quest complete! #{reward_text}"},
          {:quest_completed, %{quest_id: quest_id, rewards: rewards}}
        ]

        events =
          if new_game_state.stats do
            events ++ [{:stats_update, %{stats: new_game_state.stats}}]
          else
            events
          end

        {new_game_state, events}

      {:error, :quest_not_complete} ->
        {game_state, [{:event, "You haven't completed all objectives yet."}]}

      {:error, _reason} ->
        {game_state, []}
    end
  end

  defp handle_dialogue_action(game_state, {:give_item, item_id}) do
    alias Loka.Framework.Inventory

    case Inventory.add_item(game_state, item_id) do
      {:ok, new_game_state} ->
        events = [
          {:event, "You received an item."},
          {:inventory_update, %{action: "add", item_id: item_id}}
        ]

        {new_game_state, events}

      {:error, _} ->
        {game_state, []}
    end
  end

  defp handle_dialogue_action(game_state, {:set_flag, flag_name}) do
    alias Loka.Framework.Player.GameState, as: PlayerGameState

    flags = game_state.flags || %{}
    new_flags = Map.put(flags, flag_name, true)

    case PlayerGameState.update_state(game_state, %{flags: new_flags}) do
      {:ok, new_game_state} ->
        {new_game_state, []}

      {:error, _} ->
        {game_state, []}
    end
  end

  defp handle_dialogue_action(game_state, {:offer_quest, quest_id}) do
    quest_def = Quest.get_quest_definition(quest_id)
    quest_name = if quest_def, do: quest_def.name, else: quest_id

    events = [{:event, "Quest available: #{quest_name}"}]
    {game_state, events}
  end

  # List format handlers (from YAML)
  defp handle_dialogue_action(game_state, ["accept_quest", quest_id]) do
    handle_dialogue_action(game_state, {:accept_quest, quest_id})
  end

  defp handle_dialogue_action(game_state, ["complete_quest", quest_id]) do
    handle_dialogue_action(game_state, {:complete_quest, quest_id})
  end

  defp handle_dialogue_action(game_state, ["give_item", item_id]) do
    handle_dialogue_action(game_state, {:give_item, item_id})
  end

  defp handle_dialogue_action(game_state, ["set_flag", flag_name]) do
    handle_dialogue_action(game_state, {:set_flag, flag_name})
  end

  defp handle_dialogue_action(game_state, ["offer_quest", quest_id]) do
    handle_dialogue_action(game_state, {:offer_quest, quest_id})
  end

  defp handle_dialogue_action(game_state, _unknown_action), do: {game_state, []}

  defp format_quest_rewards(rewards) do
    parts = []

    parts =
      if rewards[:xp] && rewards[:xp] > 0 do
        parts ++ ["#{rewards[:xp]} XP"]
      else
        parts
      end

    parts =
      if rewards[:gold] && rewards[:gold] > 0 do
        parts ++ ["#{rewards[:gold]} gold"]
      else
        parts
      end

    if Enum.empty?(parts) do
      ""
    else
      "Gained #{Enum.join(parts, " and ")}."
    end
  end

  # Build player quest context for dialogue system
  defp build_player_quests(game_state) do
    quests = game_state.quests || %{}
    active_quests = StateHelper.get_active(quests)
    completed_quests = StateHelper.get_completed(quests)

    %{
      "active" => active_quests,
      "completed" => completed_quests
    }
  end
end
