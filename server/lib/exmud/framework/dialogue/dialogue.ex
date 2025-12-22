defmodule Exmud.Framework.Dialogue do
  @moduledoc """
  Dialogue system for NPC conversations.

  Manages dialogue trees stored in NPC entity components and handles
  conversation flow between players and NPCs.

  ## Dialogue Tree Structure

  Dialogue trees are stored in NPC components as:

      %{
        "dialogue_tree" => %{
          "start" => %{
            "text" => "Greetings, traveler!",
            "choices" => [
              %{"text" => "Hello", "next" => "hello_response"},
              %{"text" => "Goodbye", "next" => nil}
            ]
          },
          "hello_response" => %{
            "text" => "How can I help you today?",
            "choices" => [
              %{"text" => "Tell me about quests", "next" => "quest_info", "action" => {"offer_quest", "quest_find_leaf"}},
              %{"text" => "Nothing, thanks", "next" => nil}
            ]
          }
        }
      }

  ## Actions

  Choices can have optional actions that trigger game effects:
  - `{"offer_quest", "quest_id"}` - Offers a quest to the player
  - `{"accept_quest", "quest_id"}` - Accepts the offered quest
  - `{"give_item", "item_id"}` - Gives an item to the player
  - `{"set_flag", "flag_name"}` - Sets a player flag
  """

  alias Exmud.Engine.Entities

  @doc """
  Starts a conversation with an NPC.

  Returns the initial dialogue node.

  ## Options

  - `:player_quests` - Map containing player's quest state with `active` and `completed` keys.
    Used to filter out dialogue choices for completed quests and show alternative dialogue.

  ## Examples

      iex> start_conversation(npc_id)
      {:ok, %{text: "Greetings!", choices: [...]}}

      iex> start_conversation(npc_id, player_quests: %{"completed" => ["find_leaf"]})
      {:ok, %{text: "Thank you for your help!", choices: [...]}}
  """
  def start_conversation(npc_id, opts \\ []) when is_binary(npc_id) do
    player_quests = Keyword.get(opts, :player_quests, %{})

    case Entities.get_entity(npc_id) do
      nil ->
        {:error, :npc_not_found}

      npc ->
        dialogue_tree = get_dialogue_tree(npc)

        if dialogue_tree do
          case get_node(dialogue_tree, "start") do
            nil ->
              {:error, :no_start_node}

            node ->
              # Check if there's a completed variant for this node based on quest state
              node = maybe_use_completed_variant(node, dialogue_tree, player_quests)
              {:ok, format_node(node, "start", player_quests)}
          end
        else
          {:error, :no_dialogue}
        end
    end
  end

  @doc """
  Chooses a dialogue option and returns the next node.

  Returns the next dialogue node, or nil if the conversation ended.

  ## Options

  - `:player_quests` - Map containing player's quest state for filtering choices.

  ## Examples

      iex> choose_option(npc_id, 0)
      {:ok, %{text: "How can I help?", choices: [...]}}

      iex> choose_option(npc_id, 1)
      {:ok, :end, %{action: nil}}
  """
  def choose_option(npc_id, choice_index, current_node_id \\ "start", opts \\ [])

  def choose_option(npc_id, choice_index, current_node_id, opts)
      when is_binary(npc_id) and is_integer(choice_index) and is_binary(current_node_id) do
    player_quests = Keyword.get(opts, :player_quests, %{})

    case Entities.get_entity(npc_id) do
      nil ->
        {:error, :npc_not_found}

      npc ->
        dialogue_tree = get_dialogue_tree(npc)

        if dialogue_tree do
          current_node = get_node(dialogue_tree, current_node_id)

          if current_node do
            # Filter choices based on quest state before selecting
            choices = current_node["choices"] || []
            filtered_choices = filter_choices_by_quest_state(choices, player_quests)
            choice = Enum.at(filtered_choices, choice_index)

            if choice do
              next_node_id = choice["next"]
              action = parse_action(choice["action"])

              if next_node_id do
                case get_node(dialogue_tree, next_node_id) do
                  nil ->
                    {:ok, :end, %{action: action}}

                  next_node ->
                    # Check for completed variant on the next node
                    next_node =
                      maybe_use_completed_variant(next_node, dialogue_tree, player_quests)

                    {:ok, format_node(next_node, next_node_id, player_quests), %{action: action}}
                end
              else
                # nil next means end conversation
                {:ok, :end, %{action: action}}
              end
            else
              {:error, :invalid_choice}
            end
          else
            {:error, :invalid_node}
          end
        else
          {:error, :no_dialogue}
        end
    end
  end

  @doc """
  Gets a specific dialogue node by ID.

  ## Options

  - `:player_quests` - Map containing player's quest state for filtering choices.
  """
  def get_dialogue_node(npc_id, node_id, opts \\ [])
      when is_binary(npc_id) and is_binary(node_id) do
    player_quests = Keyword.get(opts, :player_quests, %{})

    case Entities.get_entity(npc_id) do
      nil ->
        {:error, :npc_not_found}

      npc ->
        dialogue_tree = get_dialogue_tree(npc)

        if dialogue_tree do
          case get_node(dialogue_tree, node_id) do
            nil ->
              {:error, :node_not_found}

            node ->
              node = maybe_use_completed_variant(node, dialogue_tree, player_quests)
              {:ok, format_node(node, node_id, player_quests)}
          end
        else
          {:error, :no_dialogue}
        end
    end
  end

  @doc """
  Checks if an NPC has a dialogue tree.
  """
  def has_dialogue?(npc_id) when is_binary(npc_id) do
    case Entities.get_entity(npc_id) do
      nil -> false
      npc -> get_dialogue_tree(npc) != nil
    end
  end

  # Private functions

  defp get_dialogue_tree(npc) do
    components = npc.components || %{}

    # Look for dialogue_tree in components
    case components["dialogue_tree"] do
      nil ->
        # Fall back to conversant component which may have dialogue_tree_id
        # For now, return nil - dialogue trees are embedded in components
        nil

      tree when is_map(tree) ->
        tree
    end
  end

  defp get_node(dialogue_tree, node_id) do
    Map.get(dialogue_tree, node_id)
  end

  defp format_node(node, node_id, player_quests) do
    # Filter choices based on player quest state
    filtered_choices = filter_choices_by_quest_state(node["choices"] || [], player_quests)

    %{
      id: node_id,
      text: node["text"] || "",
      speaker: node["speaker"],
      choices:
        filtered_choices
        |> Enum.with_index()
        |> Enum.map(fn {choice, idx} ->
          %{
            index: idx,
            text: choice["text"] || "",
            next: choice["next"],
            action: parse_action(choice["action"])
          }
        end)
    }
  end

  # Filters out dialogue choices based on quest state:
  # - Choices with accept_quest actions for already completed quests are hidden
  # - Choices with accept_quest actions for already active quests are hidden
  # - Choices with show_if conditions are evaluated
  defp filter_choices_by_quest_state(choices, player_quests) when is_list(choices) do
    completed = get_completed_quests(player_quests)
    active = get_active_quest_ids(player_quests)

    Enum.filter(choices, fn choice ->
      action = choice["action"]
      show_if = choice["show_if"]

      # Check if this choice should be hidden based on quest action
      action_visible = choice_visible_by_action?(action, completed, active)

      # Check if this choice has a show_if condition
      condition_met = evaluate_show_if(show_if, player_quests)

      action_visible and condition_met
    end)
  end

  defp filter_choices_by_quest_state(_, _), do: []

  # Returns true if the choice should be visible based on its action
  defp choice_visible_by_action?(nil, _completed, _active), do: true

  defp choice_visible_by_action?(action, completed, active) when is_list(action) do
    case action do
      ["accept_quest", quest_id] ->
        # Hide if quest is completed or already active
        quest_id not in completed and quest_id not in active

      ["accept_quest", quest_id, _] ->
        quest_id not in completed and quest_id not in active

      _ ->
        true
    end
  end

  defp choice_visible_by_action?(action, completed, active) when is_map(action) do
    case action do
      %{"type" => "accept_quest", "arg" => quest_id} ->
        quest_id not in completed and quest_id not in active

      _ ->
        true
    end
  end

  defp choice_visible_by_action?(_, _, _), do: true

  # Evaluates a show_if condition on a choice
  # Supported conditions:
  #   - %{"quest_not_completed" => "quest_id"}
  #   - %{"quest_completed" => "quest_id"}
  #   - %{"quest_active" => "quest_id"}
  #   - %{"quest_not_active" => "quest_id"}
  defp evaluate_show_if(nil, _player_quests), do: true

  defp evaluate_show_if(condition, player_quests) when is_map(condition) do
    completed = get_completed_quests(player_quests)
    active = get_active_quest_ids(player_quests)

    cond do
      quest_id = condition["quest_not_completed"] ->
        quest_id not in completed

      quest_id = condition["quest_completed"] ->
        quest_id in completed

      quest_id = condition["quest_active"] ->
        quest_id in active

      quest_id = condition["quest_not_active"] ->
        quest_id not in active

      true ->
        true
    end
  end

  defp evaluate_show_if(_, _), do: true

  # Checks if there's a completed variant for this node based on quest state
  # Dialogue nodes can specify:
  #   - "completed_variant" => "node_id" - switch to this node if ANY quest is completed
  #   - "completed_variants" => %{"quest_id" => "node_id"} - switch based on specific quest
  defp maybe_use_completed_variant(node, dialogue_tree, player_quests) do
    completed = get_completed_quests(player_quests)

    cond do
      # Check for quest-specific completed variants
      variants = node["completed_variants"] ->
        case Enum.find(variants, fn {quest_id, _node_id} -> quest_id in completed end) do
          {_quest_id, variant_node_id} ->
            get_node(dialogue_tree, variant_node_id) || node

          nil ->
            node
        end

      # Check for a general completed variant with a quest condition
      variant_id = node["completed_variant"] ->
        quest_id = node["completed_quest"]

        if quest_id && quest_id in completed do
          get_node(dialogue_tree, variant_id) || node
        else
          node
        end

      true ->
        node
    end
  end

  # Helper to extract completed quest IDs from player_quests map
  defp get_completed_quests(player_quests) do
    Map.get(player_quests, "completed") ||
      Map.get(player_quests, :completed, [])
  end

  # Helper to extract active quest IDs from player_quests map
  defp get_active_quest_ids(player_quests) do
    active_map =
      Map.get(player_quests, "active") ||
        Map.get(player_quests, :active, %{})

    Map.keys(active_map)
  end

  defp parse_action(nil), do: nil

  defp parse_action(action) when is_list(action) do
    case action do
      [type, arg1, arg2] -> {String.to_atom(type), arg1, arg2}
      [type, arg] -> {String.to_atom(type), arg}
      [type] -> {String.to_atom(type), nil}
      _ -> nil
    end
  end

  defp parse_action(action) when is_map(action) do
    case action do
      %{"type" => type, "arg1" => arg1, "arg2" => arg2} -> {String.to_atom(type), arg1, arg2}
      %{"type" => type, "arg" => arg} -> {String.to_atom(type), arg}
      %{"type" => type} -> {String.to_atom(type), nil}
      _ -> nil
    end
  end

  defp parse_action(_), do: nil
end
