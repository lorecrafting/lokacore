defmodule Loka.Testing.Content.DialogueQuestChainValidator do
  @moduledoc """
  Validates that dialogue trees properly handle quest chains.

  Catches issues like:
  - Quest completes but next quest in chain isn't offered
  - Quest giver doesn't have dialogue nodes for quest states
  - Missing turn-in dialogues
  - Broken quest progression paths

  ## Usage

      {:ok, results} = DialogueQuestChainValidator.validate_all()

      # Check specific NPC's quest chain
      {:ok, results} = DialogueQuestChainValidator.validate_npc("abbot_jampa")
  """

  require Logger

  alias Loka.Engine.Entities
  alias Loka.Content

  @doc """
  Validates all NPCs that give quests in storylines.

  Returns `{:ok, results}` with validation results.
  """
  def validate_all do
    case Content.Storyline.all_structs() do
      [] ->
        {:error, :no_storylines}

      storylines ->
        results =
          Enum.flat_map(storylines, fn storyline ->
            validate_storyline(storyline)
          end)

        errors = Enum.filter(results, &match?({:error, _}, &1))
        warnings = Enum.filter(results, &match?({:warning, _}, &1))

        {:ok,
         %{
           errors: errors,
           warnings: warnings,
           total_checks: length(results),
           passed: length(results) - length(errors) - length(warnings)
         }}
    end
  end

  @doc """
  Validates quest chains for a specific NPC.
  """
  def validate_npc(npc_key) when is_binary(npc_key) do
    with {:ok, npc} <- Entities.find_one(key: npc_key) do
      dialogue = get_dialogue_tree(npc)

      if dialogue do
        quests_given = find_quests_given_by_npc(npc_key)
        validate_npc_dialogue_chain(npc_key, dialogue, quests_given)
      else
        {:ok, []}
      end
    else
      _ -> {:error, :npc_not_found}
    end
  end

  defp get_dialogue_tree(npc) do
    # Try direct field first
    dialogue = Map.get(npc, :dialogue_tree) || Map.get(npc, "dialogue_tree")

    # Try components
    if is_nil(dialogue) do
      components = Map.get(npc, :components) || Map.get(npc, "components") || %{}
      Map.get(components, :dialogue_tree) || Map.get(components, "dialogue_tree")
    else
      dialogue
    end
  end

  # ============================================================================
  # Private - Storyline Validation
  # ============================================================================

  defp validate_storyline(storyline) do
    # Derive quest order from acts
    quest_order =
      (storyline.acts || [])
      |> Enum.flat_map(fn act -> act.quests || [] end)

    Enum.flat_map(quest_order, fn quest_id ->
      validate_quest_chain(quest_id, quest_order)
    end)
  end

  defp validate_quest_chain(quest_id, quest_order) do
    case Content.Quest.definition(quest_id) do
      nil ->
        [{:error, {:missing_quest_definition, quest_id}}]

      quest_def ->
        giver_key = quest_def.giver || quest_def.turn_in_npc

        if giver_key && giver_key not in ["system", :system] do
          validate_quest_giver_dialogue(quest_id, giver_key, quest_order)
        else
          []
        end
    end
  end

  defp validate_quest_giver_dialogue(quest_id, giver_key, quest_order) do
    case Entities.find_one(key: giver_key) do
      {:ok, npc} ->
        dialogue = get_dialogue_tree(npc)

        if dialogue do
          validate_quest_in_dialogue(quest_id, giver_key, dialogue, quest_order)
        else
          [{:error, {:no_dialogue_tree, giver_key, quest_id}}]
        end

      _ ->
        [{:error, {:npc_not_found, giver_key}}]
    end
  end

  defp validate_quest_in_dialogue(quest_id, giver_key, dialogue, quest_order) do
    results = []

    # Check 1: Quest must be offered somewhere in dialogue
    offers_quest? = dialogue_offers_quest?(dialogue, quest_id)

    results =
      if not offers_quest? do
        [{:error, {:quest_not_offered_in_dialogue, giver_key, quest_id}} | results]
      else
        results
      end

    # Check 2: If quest has a next quest in chain, completion should offer next quest
    next_quest = find_next_quest_in_chain(quest_id, quest_order)

    results =
      if next_quest do
        validate_quest_completion_chain(quest_id, next_quest, giver_key, dialogue, results)
      else
        results
      end

    # Check 3: Quest completion should have a turn-in dialogue path
    results =
      if quest_has_objectives?(quest_id) do
        has_turnin? = dialogue_has_turnin?(dialogue, quest_id)

        if not has_turnin? do
          [{:warning, {:no_turnin_dialogue, giver_key, quest_id}} | results]
        else
          results
        end
      else
        results
      end

    results
  end

  defp validate_quest_completion_chain(quest_id, next_quest, giver_key, dialogue, results) do
    # Check if there's a node that completes the quest
    completion_nodes = find_nodes_that_complete_quest(dialogue, quest_id)

    if Enum.empty?(completion_nodes) do
      # No explicit completion node - check if quest is completed via system/dialogue action
      results
    else
      # For each completion node, check if it offers the next quest
      Enum.reduce(completion_nodes, results, fn node_id, acc ->
        offers_next? = node_offers_quest?(dialogue, node_id, next_quest)

        if not offers_next? do
          [
            {:error,
             {:broken_quest_chain, giver_key, quest_id, next_quest,
              "Quest #{quest_id} completes at node #{node_id} but doesn't offer next quest #{next_quest}"}}
            | acc
          ]
        else
          acc
        end
      end)
    end
  end

  # ============================================================================
  # Private - Dialogue Analysis
  # ============================================================================

  defp dialogue_offers_quest?(dialogue, quest_id) do
    Enum.any?(dialogue, fn {_node_id, node} ->
      node_offers_quest?(dialogue, node, quest_id)
    end)
  end

  defp node_offers_quest?(dialogue, node_id, quest_id) when is_binary(node_id) do
    case Map.get(dialogue, node_id) || Map.get(dialogue, String.to_atom(node_id)) do
      nil -> false
      node -> node_offers_quest?(dialogue, node, quest_id)
    end
  end

  defp node_offers_quest?(_dialogue, node, quest_id) when is_map(node) do
    # Check node action
    action = node[:action] || node["action"]
    action_offers = action_offers_quest?(action, quest_id)

    # Check choice actions
    choices = node[:choices] || node["choices"] || []

    choice_offers =
      Enum.any?(choices, fn choice ->
        choice_action = choice[:action] || choice["action"]
        action_offers_quest?(choice_action, quest_id)
      end)

    action_offers || choice_offers
  end

  defp action_offers_quest?(action, quest_id) do
    case action do
      ["accept_quest", ^quest_id] -> true
      {:accept_quest, ^quest_id} -> true
      _ -> false
    end
  end

  defp find_nodes_that_complete_quest(dialogue, quest_id) do
    Enum.filter(dialogue, fn {_node_id, node} ->
      node_completes_quest?(node, quest_id)
    end)
    |> Enum.map(fn {node_id, _node} -> node_id end)
  end

  defp node_completes_quest?(node, quest_id) when is_map(node) do
    # Check node action
    action = node[:action] || node["action"]
    action_completes = action_completes_quest?(action, quest_id)

    # Check choice actions
    choices = node[:choices] || node["choices"] || []

    choice_completes =
      Enum.any?(choices, fn choice ->
        choice_action = choice[:action] || choice["action"]
        action_completes_quest?(choice_action, quest_id)
      end)

    action_completes || choice_completes
  end

  defp action_completes_quest?(action, quest_id) do
    case action do
      ["complete_quest", ^quest_id] -> true
      {:complete_quest, ^quest_id} -> true
      _ -> false
    end
  end

  defp dialogue_has_turnin?(dialogue, quest_id) do
    Enum.any?(dialogue, fn {_node_id, node} ->
      show_if = node[:show_if] || node["show_if"]

      cond do
        is_nil(show_if) -> false
        show_if[:quest_complete] == quest_id -> true
        show_if["quest_complete"] == quest_id -> true
        true -> false
      end
    end)
  end

  # ============================================================================
  # Private - Quest Chain Analysis
  # ============================================================================

  defp find_next_quest_in_chain(quest_id, quest_order) do
    case Enum.find_index(quest_order, &(&1 == quest_id)) do
      nil -> nil
      index -> Enum.at(quest_order, index + 1)
    end
  end

  defp find_quests_given_by_npc(npc_key) do
    Content.Quest.all_definitions()
    |> Enum.filter(fn quest ->
      quest.giver == npc_key || quest.turn_in_npc == npc_key
    end)
    |> Enum.map(& &1.id)
  end

  defp quest_has_objectives?(quest_id) do
    case Content.Quest.definition(quest_id) do
      nil -> false
      quest_def -> (quest_def.objectives || []) != []
    end
  end

  defp validate_npc_dialogue_chain(npc_key, dialogue, quests) do
    results =
      Enum.flat_map(quests, fn quest_id ->
        offers? = dialogue_offers_quest?(dialogue, quest_id)

        if not offers? do
          [{:error, {:quest_not_offered_in_dialogue, npc_key, quest_id}}]
        else
          []
        end
      end)

    {:ok, results}
  end
end
