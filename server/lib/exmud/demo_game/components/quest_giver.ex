defmodule Exmud.DemoGame.Components.QuestGiver do
  @moduledoc """
  Component for NPCs that can give quests to players.

  ## Fields

  - `quest_ids` - List of quest IDs this NPC can offer
  - `dialogue_id` - ID of the dialogue tree to use when interacting with this quest giver

  ## Example

      %QuestGiver{
        quest_ids: ["find_lost_sword", "deliver_message", "slay_dragon"],
        dialogue_id: "blacksmith_quests"
      }
  """

  @type t :: %__MODULE__{
          quest_ids: [String.t()],
          dialogue_id: String.t() | nil
        }

  defstruct quest_ids: [],
            dialogue_id: nil

  @doc """
  Creates a new QuestGiver with the given attributes.
  """
  def new(attrs \\ %{}) do
    struct(__MODULE__, attrs)
  end

  @doc """
  Returns true if this NPC offers the specified quest.
  """
  def offers_quest?(%__MODULE__{quest_ids: quest_ids}, quest_id) do
    quest_id in quest_ids
  end

  @doc """
  Returns the list of available quests for a player.

  Filters out quests the player has already completed or is currently on.
  """
  def available_quests(%__MODULE__{quest_ids: quest_ids}, player_quests) do
    # Handle both atom and string keys from DB
    completed = Map.get(player_quests, "completed") || Map.get(player_quests, :completed, [])
    active_map = Map.get(player_quests, "active") || Map.get(player_quests, :active, %{})
    active = Map.keys(active_map)

    Enum.reject(quest_ids, fn quest_id ->
      quest_id in completed or quest_id in active
    end)
  end

  @doc """
  Creates a QuestGiver from a map with string keys (as loaded from JSON/DB).
  """
  def from_map(nil), do: nil

  def from_map(data) when is_map(data) do
    %__MODULE__{
      quest_ids: data["quest_ids"] || data[:quest_ids] || [],
      dialogue_id: data["dialogue_id"] || data[:dialogue_id]
    }
  end
end
