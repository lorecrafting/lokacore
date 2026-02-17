defmodule Loka.Framework.Dialogue do
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
  - `{"learn_skill", "skill_id", skill_cost}` - Teaches a skill
  """

  require Logger

  alias Loka.Engine.{Entity, Entities}
  alias Loka.Content

  # Whitelist of valid action types to prevent atom exhaustion attacks
  @valid_action_types ~w(
    offer_quest accept_quest complete_quest
    give_item take_item
    set_flag clear_flag
    learn_skill
    give_xp give_gold
    heal teleport
    start_combat
    open_shop
    trigger_event
  )a

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
    character = Keyword.get(opts, :character, nil)

    Logger.debug("[DIALOGUE] Starting conversation: npc_id=#{npc_id}")

    case Entities.get_entity(npc_id) do
      nil ->
        Logger.debug("[DIALOGUE] Start failed - NPC not found: npc_id=#{npc_id}")
        {:error, :npc_not_found}

      npc ->
        dialogue_tree = get_dialogue_tree(npc)

        if dialogue_tree do
          # Find the best start node based on conditions
          {node_id, node} = find_start_node(dialogue_tree, player_quests, character)

          case node do
            nil ->
              Logger.warning("[DIALOGUE] No start node found: npc_id=#{npc_id}")
              {:error, :no_start_node}

            node ->
              # Check if there's a completed variant for this node based on quest state
              node = maybe_use_completed_variant(node, dialogue_tree, player_quests)
              Logger.info("[DIALOGUE] Conversation started: npc_id=#{npc_id} node=#{node_id}")
              {:ok, format_node(node, node_id, player_quests)}
          end
        else
          Logger.debug("[DIALOGUE] No dialogue tree: npc_id=#{npc_id}")
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

    Logger.debug(
      "[DIALOGUE] Choice selected: npc_id=#{npc_id} node=#{current_node_id} choice=#{choice_index}"
    )

    with {:npc, npc} when not is_nil(npc) <- {:npc, Entities.get_entity(npc_id)},
         {:tree, tree} when not is_nil(tree) <- {:tree, get_dialogue_tree(npc)},
         {:node, node} when not is_nil(node) <- {:node, get_node(tree, current_node_id)},
         choices = node["choices"] || [],
         filtered = filter_choices_by_quest_state(choices, player_quests),
         {:choice, choice} when not is_nil(choice) <- {:choice, Enum.at(filtered, choice_index)} do
      resolve_choice(choice, tree, player_quests)
    else
      {:npc, nil} -> {:error, :npc_not_found}
      {:tree, nil} -> {:error, :no_dialogue}
      {:node, nil} -> {:error, :invalid_node}
      {:choice, nil} -> {:error, :invalid_choice}
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
    # 1. First check Content.Dialogue
    case get_dialogue_from_content(npc) do
      {:ok, tree} ->
        tree

      :not_found ->
        # 2. Fall back to embedded dialogue_tree in components
        get_dialogue_from_components(npc)
    end
  end

  # Get dialogue from Content.Dialogue system
  defp get_dialogue_from_content(npc) do
    entity_key = npc.key || npc.id

    case Content.Dialogue.for_entity(entity_key) do
      [] ->
        :not_found

      dialogues ->
        # Get the first dialogue for this entity (or one with trigger: on_talk)
        dialogue =
          Enum.find(dialogues, List.first(dialogues), fn d ->
            Content.Dialogue.trigger(d) == "on_talk"
          end)

        {:ok, typed_object_to_dialogue_tree(dialogue)}
    end
  end

  # Convert dialogue entity to the embedded format
  defp typed_object_to_dialogue_tree(%Entity{type: :dialogue} = dialogue) do
    nodes = Content.Dialogue.nodes(dialogue)
    entry_node = Content.Dialogue.entry_node(dialogue)

    # If the entry node is not "start", we need to create an alias
    if entry_node != "start" && !Map.has_key?(nodes, "start") do
      # Copy the entry node as "start" for compatibility
      entry = Map.get(nodes, entry_node) || Map.get(nodes, String.to_atom(entry_node))

      nodes
      |> convert_node_keys_to_strings()
      |> Map.put("start", entry)
    else
      convert_node_keys_to_strings(nodes)
    end
  end

  # Convert atom keys to strings for consistent access
  defp convert_node_keys_to_strings(nodes) when is_map(nodes) do
    nodes
    |> Enum.map(fn {key, node} ->
      {to_string(key), convert_node_to_strings(node)}
    end)
    |> Map.new()
  end

  defp convert_node_to_strings(node) when is_map(node) do
    node
    |> Enum.map(fn
      {:choices, choices} -> {"choices", Enum.map(choices, &convert_choice_to_strings/1)}
      {"choices", choices} -> {"choices", Enum.map(choices, &convert_choice_to_strings/1)}
      {key, value} -> {to_string(key), value}
    end)
    |> Map.new()
  end

  defp convert_choice_to_strings(choice) when is_map(choice) do
    Enum.map(choice, fn {key, value} -> {to_string(key), value} end)
    |> Map.new()
  end

  defp convert_choice_to_strings(choice), do: choice

  # Get dialogue from embedded components (legacy)
  defp get_dialogue_from_components(npc) do
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
      action: parse_action(node["action"]),
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
  #   - %{"quest_complete" => "quest_id"} - Quest is active AND all objectives are done (ready to turn in)
  #   - %{"has_item" => "item_key"} - Player has item in inventory
  defp evaluate_show_if(condition, player_quests, character \\ nil)
  defp evaluate_show_if(nil, _player_quests, _character), do: true

  defp evaluate_show_if(condition, player_quests, character) when is_map(condition) do
    completed = get_completed_quests(player_quests)
    active = get_active_quest_ids(player_quests)

    # Check ALL conditions in the map - they must ALL be true (AND logic)
    Enum.all?(condition, fn {key, value} ->
      case key do
        "quest_not_completed" ->
          value not in completed

        # Support both "quest_completed" and "completed_quest" (YAML uses both)
        key when key in ["quest_completed", "completed_quest"] ->
          value in completed

        "quest_active" ->
          value in active

        "quest_not_active" ->
          value not in active

        "quest_complete" ->
          # Quest is active AND all objectives are complete (ready to turn in)
          value in active && quest_objectives_complete?(player_quests, value)

        "has_item" ->
          # Check if player has item in inventory
          check_has_item(character, value)

        "phase" ->
          # Check if current time phase matches
          check_phase(value)

        # Unknown condition keys are ignored (treated as true)
        _ ->
          true
      end
    end)
  end

  defp evaluate_show_if(_, _, _), do: true

  # Check if player has an item (by item key) in their inventory
  defp check_has_item(nil, _item_key), do: false

  defp check_has_item(character, item_key) do
    alias Loka.Framework.Conditions.Evaluator
    Evaluator.evaluate({:has_item, item_key}, character)
  end

  # Check if current time phase matches the expected phase
  # Supports: "day", "night", "dawn", "dusk" (strings or atoms)
  defp check_phase(expected_phase) do
    # DayNight removed in V2 — always report :day
    current_phase = :day

    expected =
      cond do
        is_atom(expected_phase) -> expected_phase
        is_binary(expected_phase) -> String.to_atom(expected_phase)
        true -> :day
      end

    current_phase == expected
  end

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

  # Finds the best start node based on conditions.
  # Looks for nodes prefixed with "start" that have matching show_if or completed_quest conditions.
  # Returns the first matching conditional start node, or falls back to the default "start" node.
  #
  # Priority order (by specificity - more specific conditions checked first):
  # 1. Start nodes with show_if: quest_complete (quest active AND all objectives done - ready for turn-in)
  # 2. Start nodes with completed_quest (quest is in the completed list - already turned in)
  # 3. Start nodes with show_if: quest_active (quest is active, regardless of objective status)
  # 4. Other start nodes with show_if conditions
  # 5. The default "start" node (fallback)
  defp find_start_node(dialogue_tree, player_quests, character) do
    completed = get_completed_quests(player_quests)

    # Get all start nodes (nodes with keys starting with "start") that have conditions
    # We only consider nodes that have explicit conditions - nodes without conditions
    # that aren't "start" are likely completed_variant targets, not start nodes.
    conditional_start_nodes =
      dialogue_tree
      |> Enum.filter(fn {key, node} ->
        is_binary(key) && String.starts_with?(key, "start") && key != "start" &&
          (node["show_if"] != nil || node["completed_quest"] != nil)
      end)

    # Partition nodes by specificity:
    # 1. has_item - most specific (player has a specific item)
    # 2. quest_complete - quest active AND all objectives done (ready for turn-in)
    # 3. completed_quest - quest is in completed list (already turned in)
    # 4. quest_active - quest is active (less specific, could have incomplete objectives)
    # 5. other conditions
    {has_item_nodes, other_nodes} =
      Enum.split_with(conditional_start_nodes, fn {_key, node} ->
        show_if = node["show_if"]
        is_map(show_if) && Map.has_key?(show_if, "has_item")
      end)

    {quest_complete_nodes, remaining_nodes} =
      Enum.split_with(other_nodes, fn {_key, node} ->
        show_if = node["show_if"]
        is_map(show_if) && Map.has_key?(show_if, "quest_complete")
      end)

    {completed_quest_nodes, remaining_nodes2} =
      Enum.split_with(remaining_nodes, fn {_key, node} ->
        node["completed_quest"] != nil
      end)

    {quest_active_nodes, general_nodes} =
      Enum.split_with(remaining_nodes2, fn {_key, node} ->
        show_if = node["show_if"]
        is_map(show_if) && Map.has_key?(show_if, "quest_active")
      end)

    # Check in priority order: has_item first, then quest_complete, completed_quest, quest_active, then others
    prioritized_nodes =
      has_item_nodes ++
        quest_complete_nodes ++ completed_quest_nodes ++ quest_active_nodes ++ general_nodes

    # Find the first conditional start node whose condition is satisfied
    matching_node =
      Enum.find(prioritized_nodes, nil, fn {_key, node} ->
        show_if = node["show_if"]
        completed_quest = node["completed_quest"]

        cond do
          # If node has completed_quest, check if that quest is completed
          completed_quest != nil ->
            completed_quest in completed

          # If node has show_if, evaluate it
          show_if != nil ->
            evaluate_show_if(show_if, player_quests, character)

          # No condition - skip (shouldn't reach here due to filter)
          true ->
            false
        end
      end)

    case matching_node do
      nil ->
        # Fall back to "start" if no conditional match
        {"start", get_node(dialogue_tree, "start")}

      {key, node} ->
        {key, node}
    end
  end

  # Helper to extract completed quest IDs from player_quests map
  defp get_completed_quests(player_quests) do
    Map.get(player_quests, "completed") ||
      Map.get(player_quests, :completed, [])
  end

  # Helper to extract active quest IDs from player_quests map
  defp get_active_quest_ids(player_quests) do
    active_data =
      Map.get(player_quests, "active") ||
        Map.get(player_quests, :active, %{})

    # Defensive: handle both map format %{quest_id => data} and list format [quest_id]
    case active_data do
      active_map when is_map(active_map) ->
        Map.keys(active_map)

      active_list when is_list(active_list) ->
        # Legacy/incorrect format - convert to list of IDs
        active_list

      _ ->
        []
    end
  end

  # Helper to check if all objectives for a quest are complete
  defp quest_objectives_complete?(player_quests, quest_id) do
    active_map =
      Map.get(player_quests, "active") ||
        Map.get(player_quests, :active, %{})

    case Map.get(active_map, quest_id) do
      nil ->
        false

      quest_data ->
        objectives =
          Map.get(quest_data, "objectives") ||
            Map.get(quest_data, :objectives, %{})

        Enum.all?(objectives, fn {_id, obj} ->
          Map.get(obj, "completed") || Map.get(obj, :completed, false)
        end)
    end
  end

  defp resolve_choice(choice, dialogue_tree, player_quests) do
    next_node_id = choice["next"]
    action = parse_action(choice["action"])

    case next_node_id do
      nil ->
        {:ok, :end, %{action: action}}

      id ->
        case get_node(dialogue_tree, id) do
          nil ->
            {:ok, :end, %{action: action}}

          next_node ->
            next_node = maybe_use_completed_variant(next_node, dialogue_tree, player_quests)
            {:ok, format_node(next_node, id, player_quests), %{action: action}}
        end
    end
  end

  defp parse_action(nil), do: nil

  defp parse_action(action) when is_list(action) do
    case action do
      [type, arg1, arg2] -> safe_action_tuple(type, arg1, arg2)
      [type, arg] -> safe_action_tuple(type, arg, nil)
      [type] -> safe_action_tuple(type, nil, nil)
      _ -> nil
    end
  end

  defp parse_action(action) when is_map(action) do
    case action do
      %{"type" => type, "arg1" => arg1, "arg2" => arg2} -> safe_action_tuple(type, arg1, arg2)
      %{"type" => type, "arg" => arg} -> safe_action_tuple(type, arg, nil)
      %{"type" => type} -> safe_action_tuple(type, nil, nil)
      _ -> nil
    end
  end

  defp parse_action(_), do: nil

  # Safely convert action type string to atom using whitelist
  defp safe_action_tuple(type, arg1, arg2) when is_binary(type) do
    atom_type =
      try do
        String.to_existing_atom(type)
      rescue
        ArgumentError -> nil
      end

    if atom_type && atom_type in @valid_action_types do
      case {arg1, arg2} do
        {nil, nil} -> {atom_type, nil}
        {arg, nil} -> {atom_type, arg}
        {a1, a2} -> {atom_type, a1, a2}
      end
    else
      nil
    end
  end

  defp safe_action_tuple(type, arg1, arg2) when is_atom(type) do
    if type in @valid_action_types do
      case {arg1, arg2} do
        {nil, nil} -> {type, nil}
        {arg, nil} -> {type, arg}
        {a1, a2} -> {type, a1, a2}
      end
    else
      nil
    end
  end

  defp safe_action_tuple(_, _, _), do: nil
end
