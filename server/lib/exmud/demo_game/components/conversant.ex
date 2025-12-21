defmodule Exmud.DemoGame.Components.Conversant do
  @moduledoc """
  Component for NPCs that can engage in conversations with players.

  Manages dialogue state including the current position in a dialogue tree
  and remembered information about past conversations.

  ## Fields

  - `dialogue_tree_id` - ID of the dialogue tree definition this NPC uses
  - `current_node` - Current node in the dialogue tree (nil if not in conversation)
  - `memory` - Map of remembered facts from conversations (e.g., player choices)

  ## Example

      %Conversant{
        dialogue_tree_id: "innkeeper_main",
        current_node: "greeting",
        memory: %{told_about_dragon: true, player_name: "Adventurer"}
      }
  """

  @type t :: %__MODULE__{
          dialogue_tree_id: String.t() | nil,
          current_node: String.t() | nil,
          memory: map()
        }

  defstruct dialogue_tree_id: nil,
            current_node: nil,
            memory: %{}

  @doc """
  Creates a new Conversant with the given attributes.
  """
  def new(attrs \\ %{}) do
    struct(__MODULE__, attrs)
  end

  @doc """
  Starts a conversation, setting the current node to the given node ID.
  """
  def start_conversation(%__MODULE__{} = conversant, start_node \\ "start") do
    %{conversant | current_node: start_node}
  end

  @doc """
  Ends the current conversation, clearing the current node.
  """
  def end_conversation(%__MODULE__{} = conversant) do
    %{conversant | current_node: nil}
  end

  @doc """
  Returns true if currently in a conversation.
  """
  def in_conversation?(%__MODULE__{current_node: nil}), do: false
  def in_conversation?(%__MODULE__{}), do: true

  @doc """
  Advances the conversation to a new node.
  """
  def advance_to(%__MODULE__{} = conversant, node_id) do
    %{conversant | current_node: node_id}
  end

  @doc """
  Remembers a fact in the NPC's memory.
  """
  def remember(%__MODULE__{memory: memory} = conversant, key, value) do
    %{conversant | memory: Map.put(memory, key, value)}
  end

  @doc """
  Retrieves a remembered fact, or the default if not found.
  """
  def recall(%__MODULE__{memory: memory}, key, default \\ nil) do
    Map.get(memory, key, default)
  end

  @doc """
  Forgets a specific fact.
  """
  def forget(%__MODULE__{memory: memory} = conversant, key) do
    %{conversant | memory: Map.delete(memory, key)}
  end
end
