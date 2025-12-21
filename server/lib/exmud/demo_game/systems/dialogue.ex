defmodule Exmud.DemoGame.Systems.Dialogue do
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

  ## Examples

      iex> start_conversation(npc_id)
      {:ok, %{text: "Greetings!", choices: [...]}}
  """
  def start_conversation(npc_id) when is_binary(npc_id) do
    case Entities.get_entity(npc_id) do
      nil ->
        {:error, :npc_not_found}

      npc ->
        dialogue_tree = get_dialogue_tree(npc)

        if dialogue_tree do
          case get_node(dialogue_tree, "start") do
            nil -> {:error, :no_start_node}
            node -> {:ok, format_node(node)}
          end
        else
          {:error, :no_dialogue}
        end
    end
  end

  @doc """
  Chooses a dialogue option and returns the next node.

  Returns the next dialogue node, or nil if the conversation ended.

  ## Examples

      iex> choose_option(npc_id, 0)
      {:ok, %{text: "How can I help?", choices: [...]}}

      iex> choose_option(npc_id, 1)
      {:ok, :end, %{action: nil}}
  """
  def choose_option(npc_id, choice_index, current_node_id \\ "start")
      when is_binary(npc_id) and is_integer(choice_index) do
    case Entities.get_entity(npc_id) do
      nil ->
        {:error, :npc_not_found}

      npc ->
        dialogue_tree = get_dialogue_tree(npc)

        if dialogue_tree do
          current_node = get_node(dialogue_tree, current_node_id)

          if current_node do
            choices = current_node["choices"] || []
            choice = Enum.at(choices, choice_index)

            if choice do
              next_node_id = choice["next"]
              action = parse_action(choice["action"])

              if next_node_id do
                case get_node(dialogue_tree, next_node_id) do
                  nil ->
                    {:ok, :end, %{action: action}}

                  next_node ->
                    {:ok, format_node(next_node, next_node_id), %{action: action}}
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
  """
  def get_dialogue_node(npc_id, node_id) when is_binary(npc_id) and is_binary(node_id) do
    case Entities.get_entity(npc_id) do
      nil ->
        {:error, :npc_not_found}

      npc ->
        dialogue_tree = get_dialogue_tree(npc)

        if dialogue_tree do
          case get_node(dialogue_tree, node_id) do
            nil -> {:error, :node_not_found}
            node -> {:ok, format_node(node, node_id)}
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

  defp format_node(node, node_id \\ "start") do
    %{
      id: node_id,
      text: node["text"] || "",
      speaker: node["speaker"],
      choices:
        (node["choices"] || [])
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

  defp parse_action(nil), do: nil

  defp parse_action(action) when is_list(action) do
    case action do
      [type, arg] -> {String.to_atom(type), arg}
      [type] -> {String.to_atom(type), nil}
      _ -> nil
    end
  end

  defp parse_action(action) when is_map(action) do
    case action do
      %{"type" => type, "arg" => arg} -> {String.to_atom(type), arg}
      %{"type" => type} -> {String.to_atom(type), nil}
      _ -> nil
    end
  end

  defp parse_action(_), do: nil
end
