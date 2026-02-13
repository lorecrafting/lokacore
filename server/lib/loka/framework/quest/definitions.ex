defmodule Loka.Framework.Quest.Definitions do
  @moduledoc """
  Quest and objective definitions for the game framework.

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

  # Define Quest and Objective structs first, so they can be used below
  defmodule Quest do
    @moduledoc """
    Struct representing a quest definition.

    ## Quest Activation (giver field)

    The `giver` field determines how a quest is activated:

    - `"npc_key"` - Player must talk to this NPC to receive the quest
    - `"system"` - Quest is auto-granted when player spawns (see `Quest.Listeners.grant_system_quests_once/2`)
    - `nil` - Quest has no activation method (warning: will never be available to players)

    System quests are typically used for:
    - Starter/tutorial quests
    - Main storyline entry points
    - Quests that should always be available
    """
    defstruct [
      :id,
      :name,
      :description,
      :requires_quest,
      :type,
      :act,
      :giver,
      :turn_in_npc,
      :level_requirement,
      :journal_entries,
      :parent,
      :is_template,
      :variables,
      objectives: [],
      rewards: %{},
      status: :available
    ]

    @typedoc """
    Quest giver determines activation method:
    - NPC key string: Player must talk to this NPC
    - `"system"`: Auto-granted on spawn
    - `nil`: No activation (unreachable quest - likely an error)
    """
    @type giver :: String.t() | nil

    @type t :: %__MODULE__{
            id: String.t(),
            name: String.t(),
            description: String.t(),
            requires_quest: String.t() | nil,
            type: String.t() | nil,
            act: String.t() | nil,
            giver: giver(),
            turn_in_npc: String.t() | nil,
            level_requirement: integer(),
            journal_entries: map(),
            parent: String.t() | nil,
            is_template: boolean(),
            variables: map(),
            objectives: [Loka.Framework.Quest.Definitions.Objective.t()],
            rewards: map(),
            status: :available | :in_progress | :complete | :turned_in
          }
  end

  defmodule Objective do
    @moduledoc """
    Struct representing a quest objective.

    ## Timed Objectives

    Objectives can have an optional time limit in seconds. When `time_limit` is set,
    the objective must be completed within that time after the quest is accepted.

        objectives:
          - id: escape_dungeon
            type: go_to
            target_id: exit_room
            time_limit: 300  # 5 minutes to escape
            description: "Escape the dungeon before it collapses"

    The `time_limit` is in seconds. Set to `nil` for no time limit (default).
    """
    defstruct [
      :id,
      :type,
      :description,
      :target_id,
      :dialogue_topic,
      :time_limit,
      target_count: 1,
      completed: false,
      progress: 0
    ]

    @type t :: %__MODULE__{
            id: String.t(),
            type: :talk | :kill | :get_item | :go_to,
            description: String.t(),
            target_id: String.t(),
            dialogue_topic: String.t() | nil,
            time_limit: pos_integer() | nil,
            target_count: pos_integer(),
            completed: boolean(),
            progress: non_neg_integer()
          }
  end

  # Now the rest of the module logic
  alias Loka.Engine.Entities
  alias Loka.Engine.TypedObject
  alias Loka.Content
  alias Loka.Framework.Quest.ObjectiveRegistry

  @doc """
  Returns the list of valid objective types from registered handlers.
  """
  def objective_types do
    ObjectiveRegistry.list_types()
  end

  @doc """
  Validates an objective definition using the ObjectiveRegistry.

  Returns `:ok` if valid, or `{:error, reason}` if invalid.
  """
  def validate_objective(objective) do
    ObjectiveRegistry.validate_objective(objective)
  end

  @doc """
  Returns all quest definitions as Quest structs.

  Loads from Content.Quest (database-backed entities) and converts
  each TypedObject to a Quest struct.
  """
  def all_quest_definitions do
    Content.Quest.all()
    |> Enum.reject(&template?/1)
    |> Enum.map(&quest_from_typed_object/1)
  end

  defp template?(%TypedObject{data: data}) do
    data["is_template"] == true
  end

  defp template?(_), do: false

  @doc """
  Loads a quest definition from multiple sources.

  Resolution order:
  1. Content.Quest (TypedObject) - newest canonical source
  2. Entity lookup (database) - legacy DB

  ## Examples

      iex> get_quest_definition("find_sword")
      %Quest{id: "find_sword", name: "The Lost Sword", ...}

      iex> get_quest_definition("nonexistent")
      nil
  """
  def get_quest_definition(quest_id) do
    # 1. First check Content.Quest (TypedObject system)
    case Content.Quest.get(quest_id) do
      {:ok, typed_object} ->
        quest_from_typed_object(typed_object)

      {:error, :not_found} ->
        # 2. Fall back to entity lookup (legacy DB-based quests)
        get_quest_from_entity(quest_id)
    end
  end

  @doc """
  Converts a TypedObject quest to a Quest struct.
  """
  def quest_from_typed_object(%TypedObject{type: :quest, key: key, name: name} = typed_object) do
    data = typed_object.data || %{}

    %Quest{
      id: key,
      name: name || Map.get(data, "name") || Map.get(data, :name),
      description: Map.get(data, "description") || Map.get(data, :description),
      requires_quest: get_prerequisite(data),
      type: Map.get(data, "quest_type") || Map.get(data, :quest_type),
      act: Map.get(data, "act") || Map.get(data, :act),
      giver:
        Map.get(data, "giver") || Map.get(data, :giver) || Map.get(data, "giver_key") ||
          Map.get(data, :giver_key),
      turn_in_npc: Map.get(data, "turn_in_npc") || Map.get(data, :turn_in_npc),
      level_requirement: get_level_requirement(data),
      journal_entries: Map.get(data, "journal_entries") || Map.get(data, :journal_entries, %{}),
      objectives: parse_typed_object_objectives(data),
      rewards: Map.get(data, "rewards") || Map.get(data, :rewards, %{}),
      status: :available
    }
  end

  defp get_prerequisite(data) do
    prereqs = Map.get(data, "prerequisites") || Map.get(data, :prerequisites, [])
    if is_list(prereqs) && prereqs != [], do: List.first(prereqs), else: nil
  end

  defp get_level_requirement(data) do
    case Map.get(data, "level_range") || Map.get(data, :level_range) do
      %{"min" => min} -> min
      %{min: min} -> min
      _ -> nil
    end
  end

  defp parse_typed_object_objectives(data) do
    objectives = Map.get(data, "objectives") || Map.get(data, :objectives, [])

    Enum.map(objectives, fn obj ->
      type_val = Map.get(obj, "type") || Map.get(obj, :type)

      type_atom =
        cond do
          is_atom(type_val) -> type_val
          is_binary(type_val) -> String.to_existing_atom(type_val)
          true -> :talk
        end

      %Objective{
        id: Map.get(obj, "id") || Map.get(obj, :id),
        type: type_atom,
        description: Map.get(obj, "description") || Map.get(obj, :description),
        target_id:
          Map.get(obj, "target") || Map.get(obj, :target) ||
            Map.get(obj, "target_id") || Map.get(obj, :target_id),
        dialogue_topic: Map.get(obj, "dialogue_topic") || Map.get(obj, :dialogue_topic),
        target_count:
          Map.get(obj, "count") || Map.get(obj, :count) ||
            Map.get(obj, "target_count") || Map.get(obj, :target_count, 1),
        time_limit: Map.get(obj, "time_limit") || Map.get(obj, :time_limit)
      }
    end)
  rescue
    ArgumentError -> []
  end

  defp get_quest_from_entity(quest_id) do
    case Entities.get_entity_by_key(quest_id) do
      nil ->
        nil

      schema ->
        entity = Entities.to_entity(schema)
        components = entity.components

        %Quest{
          id: entity.key,
          name: entity.short_desc,
          description: entity.extra_desc,
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
        dialogue_topic: Map.get(obj, "dialogue_topic") || Map.get(obj, :dialogue_topic),
        target_count: Map.get(obj, "target_count") || Map.get(obj, :target_count, 1),
        time_limit: Map.get(obj, "time_limit") || Map.get(obj, :time_limit)
      }
    end)
  rescue
    ArgumentError -> []
  end

  def parse_objectives(_), do: []
end
