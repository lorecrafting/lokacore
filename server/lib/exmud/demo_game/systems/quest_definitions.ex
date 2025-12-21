defmodule Exmud.DemoGame.Systems.QuestDefinitions do
  @moduledoc """
  Quest and objective definitions for the demo game.

  Contains the data structures and loading logic for quest content.
  Quest definitions are stored as entities with type :quest in the database.

  ## Quest Structure

      %Quest{
        id: "find_sword",
        name: "The Lost Sword",
        description: "Find the legendary sword...",
        objectives: [%Objective{...}],
        rewards: %{xp: 100, gold: 50},
        status: :available
      }

  ## Objective Types

  - `:talk` - Talk to a specific NPC
  - `:kill` - Defeat a certain number of enemies
  - `:get_item` - Obtain a specific item
  - `:go_to` - Visit a specific location
  """

  alias Exmud.Engine.Entities

  @objective_types [:talk, :kill, :get_item, :go_to]

  defmodule Quest do
    @moduledoc """
    Struct representing a quest definition.
    """
    defstruct [
      :id,
      :name,
      :description,
      objectives: [],
      rewards: %{},
      status: :available
    ]

    @type t :: %__MODULE__{
            id: String.t(),
            name: String.t(),
            description: String.t(),
            objectives: [Exmud.DemoGame.Systems.QuestDefinitions.Objective.t()],
            rewards: map(),
            status: :available | :in_progress | :complete | :turned_in
          }
  end

  defmodule Objective do
    @moduledoc """
    Struct representing a quest objective.
    """
    defstruct [
      :id,
      :type,
      :description,
      :target_id,
      target_count: 1,
      completed: false,
      progress: 0
    ]

    @type t :: %__MODULE__{
            id: String.t(),
            type: :talk | :kill | :get_item | :go_to,
            description: String.t(),
            target_id: String.t(),
            target_count: pos_integer(),
            completed: boolean(),
            progress: non_neg_integer()
          }
  end

  @doc """
  Returns the list of valid objective types.
  """
  def objective_types, do: @objective_types

  @doc """
  Loads a quest definition from the database.

  Quest definitions are stored as entities with type :quest.

  ## Examples

      iex> get_quest_definition("find_sword")
      %Quest{id: "find_sword", name: "The Lost Sword", ...}

      iex> get_quest_definition("nonexistent")
      nil
  """
  def get_quest_definition(quest_id) do
    case Entities.get_entity_by_key(quest_id) do
      nil ->
        nil

      schema ->
        entity = Entities.to_entity(schema)
        components = entity.components

        %Quest{
          id: entity.key,
          name: entity.name,
          description: entity.description,
          # Components from DB use string keys
          objectives: parse_objectives(Map.get(components, "objectives", [])),
          rewards: Map.get(components, "rewards", %{}),
          status: :available
        }
    end
  end

  @doc """
  Parses objective data from the database into Objective structs.
  """
  def parse_objectives(objectives) when is_list(objectives) do
    Enum.map(objectives, fn obj ->
      # Handle string keys from DB
      type_val = Map.get(obj, "type") || Map.get(obj, :type)
      type_atom = if is_binary(type_val), do: String.to_existing_atom(type_val), else: type_val

      %Objective{
        id: Map.get(obj, "id") || Map.get(obj, :id),
        type: type_atom,
        description: Map.get(obj, "description") || Map.get(obj, :description),
        target_id: Map.get(obj, "target_id") || Map.get(obj, :target_id),
        target_count: Map.get(obj, "target_count") || Map.get(obj, :target_count, 1)
      }
    end)
  rescue
    ArgumentError -> []
  end

  def parse_objectives(_), do: []
end
