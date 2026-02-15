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
  alias Loka.Content
  alias Loka.Framework.Quest.{Progress, StateHelper}
  alias Loka.Engine.Entity
  alias LokaWeb.Channels.GameChannel.Serializers

  @doc """
  Start a conversation with an NPC.
  """
  @spec start_conversation(Context.t(), String.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def start_conversation(ctx, entity_id) do
    character = ctx.character
    alias Loka.Engine.Entities

    player_quests = build_player_quests(character)

    case Dialogue.start_conversation(entity_id,
           player_quests: player_quests,
           character: character
         ) do
      {:ok, node} ->
        # Track talk objective when conversation starts
        entity = Entities.get_entity(entity_id)
        target_key = if entity, do: entity.key, else: nil

        new_character =
          if target_key do
            require Logger

            dialogue_topic = node.id

            Logger.info(
              "[DIALOGUE] Tracking talk objective for target_key=#{target_key}, topic=#{dialogue_topic}"
            )

            quest_event = %{type: :talk, target_id: target_key, dialogue_topic: dialogue_topic}

            {:ok, updated_character, completed_objectives} =
              Progress.update_progress(character, quest_event)

            Logger.info(
              "[DIALOGUE] Quest progress updated successfully, completed=#{inspect(completed_objectives)}"
            )

            quests = Entity.get_component(updated_character, "quest_progress") || %{}

            Logger.info("[DIALOGUE] updated quest_progress keys: #{inspect(Map.keys(quests))}")

            updated_character
          else
            character
          end

        # Process node action if present (e.g., auto-complete quest on node display)
        {final_character, action_events} = handle_dialogue_action(new_character, node[:action])

        # Use node speaker if defined, otherwise fall back to entity name
        speaker = node[:speaker] || (entity && entity.short_desc) || "NPC"

        result =
          Result.new(
            state: %{
              dialogue: %{entity_id: entity_id, node_id: node.id},
              character: final_character
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
        character = ctx.character
        player_quests = build_player_quests(character)

        case Dialogue.choose_option(entity_id, choice_index, node_id,
               player_quests: player_quests
             ) do
          {:ok, :end, %{action: action}} ->
            {new_character, action_events} = handle_dialogue_action(character, action)

            result =
              Result.new(
                state: %{dialogue: nil, character: new_character},
                events: action_events ++ [{:dialogue_end, %{entity_id: entity_id}}]
              )

            {:ok, result}

          {:ok, next_node, %{action: action}} ->
            # Process choice action first
            {new_character, action_events} = handle_dialogue_action(character, action)

            # Track talk objective for the new node we're visiting
            alias Loka.Engine.Entities
            entity = Entities.get_entity(entity_id)
            target_key = if entity, do: entity.key, else: nil
            dialogue_topic = next_node.id

            new_character =
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

                {:ok, updated_character, completed_objectives} =
                  Progress.update_progress(new_character, quest_event)

                Logger.info(
                  "[DIALOGUE] Quest progress updated successfully, completed=#{inspect(completed_objectives)}"
                )

                updated_character
              else
                new_character
              end

            # Then process node action if present
            {final_character, node_action_events} =
              handle_dialogue_action(new_character, next_node[:action])

            # Use node speaker if defined, otherwise fall back to entity name
            speaker = next_node[:speaker] || (entity && entity.short_desc) || "NPC"

            result =
              Result.new(
                state: %{
                  dialogue: %{entity_id: entity_id, node_id: next_node.id},
                  character: final_character
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

  defp handle_dialogue_action(character, nil), do: {character, []}

  defp handle_dialogue_action(character, {:accept_quest, quest_id}) do
    case Progress.accept_quest(character, quest_id) do
      {:ok, new_character} ->
        quest_def = Content.Quest.definition(quest_id)
        quest_name = if quest_def, do: quest_def.name, else: quest_id

        active_quests = Progress.get_active_quests(new_character)
        active_quest = Enum.find(active_quests, fn q -> q.id == quest_id end)

        serialized_quest =
          if active_quest, do: hd(Serializers.serialize_quests([active_quest])), else: nil

        events = [
          {:event, "New quest — #{quest_name}"},
          {:quest_accepted, %{quest_id: quest_id, name: quest_name, quest: serialized_quest}}
        ]

        {new_character, events}

      {:error, :already_active} ->
        {character, [{:event, "You already have this quest."}]}

      {:error, :already_completed} ->
        {character, [{:event, "You've already completed this quest."}]}

      {:error, _reason} ->
        {character, []}
    end
  end

  defp handle_dialogue_action(character, {:complete_quest, quest_id}) do
    case Progress.turn_in_quest(character, quest_id) do
      {:ok, new_character, rewards} ->
        reward_text = format_quest_rewards(rewards)

        # Get quest title for the completion event
        quest_title =
          case Content.Quest.definition(quest_id) do
            %{name: name} -> name
            _ -> quest_id
          end

        # Single elegant message with title and rewards
        completion_text =
          if reward_text != "" do
            "Quest complete — #{quest_title}! #{reward_text}"
          else
            "Quest complete — #{quest_title}"
          end

        events = [
          {:event, completion_text},
          {:quest_completed, %{quest_id: quest_id, title: quest_title, rewards: rewards}}
        ]

        stats = Entity.get_component(new_character, "stats")

        events =
          if stats do
            events ++ [{:stats_update, %{stats: stats}}]
          else
            events
          end

        {new_character, events}

      {:error, :quest_not_complete} ->
        {character, [{:event, "You haven't completed all objectives yet."}]}

      {:error, _reason} ->
        {character, []}
    end
  end

  defp handle_dialogue_action(character, {:give_item, item_key}) do
    alias Loka.Framework.Inventory
    alias Loka.Engine.Spawner

    # Spawn the item entity from the prototype key
    case Spawner.spawn(item_key, []) do
      {:ok, entity} ->
        # Add the spawned entity to inventory
        case Inventory.add_item(character, entity.id) do
          {:ok, new_character} ->
            item_name = entity.short_desc || item_key

            events = [
              {:event, "You received #{item_name}."},
              {:inventory_update, %{action: "add", item_id: entity.id}}
            ]

            {new_character, events}

          {:error, _} ->
            {character, []}
        end

      {:error, _} ->
        require Logger
        Logger.warning("[DIALOGUE] Failed to spawn item: #{item_key}")
        {character, []}
    end
  end

  defp handle_dialogue_action(character, {:set_flag, flag_name}) do
    player_component = Entity.get_component(character, "player") || %{}
    flags = Map.get(player_component, "flags", %{}) || %{}
    new_flags = Map.put(flags, flag_name, true)
    new_player = Map.put(player_component, "flags", new_flags)
    new_character = Entity.add_component(character, "player", new_player)
    {new_character, []}
  end

  defp handle_dialogue_action(character, {:offer_quest, quest_id}) do
    quest_def = Content.Quest.definition(quest_id)
    quest_name = if quest_def, do: quest_def.name, else: quest_id

    events = [{:event, "Quest available: #{quest_name}"}]
    {character, events}
  end

  # List format handlers (from YAML)
  defp handle_dialogue_action(character, ["accept_quest", quest_id]) do
    handle_dialogue_action(character, {:accept_quest, quest_id})
  end

  defp handle_dialogue_action(character, ["complete_quest", quest_id]) do
    handle_dialogue_action(character, {:complete_quest, quest_id})
  end

  defp handle_dialogue_action(character, ["give_item", item_id]) do
    handle_dialogue_action(character, {:give_item, item_id})
  end

  defp handle_dialogue_action(character, ["set_flag", flag_name]) do
    handle_dialogue_action(character, {:set_flag, flag_name})
  end

  defp handle_dialogue_action(character, ["offer_quest", quest_id]) do
    handle_dialogue_action(character, {:offer_quest, quest_id})
  end

  defp handle_dialogue_action(character, _unknown_action), do: {character, []}

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
  defp build_player_quests(character) do
    quests = Entity.get_component(character, "quest_progress") || %{}
    active_quests = StateHelper.get_active(quests)
    completed_quests = StateHelper.get_completed(quests)

    %{
      "active" => active_quests,
      "completed" => completed_quests
    }
  end
end
