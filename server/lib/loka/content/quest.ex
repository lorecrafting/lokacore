defmodule Loka.Content.Quest do
  @moduledoc """
  Quest definition - content entity.

  Quests are content definitions that describe:
  - Quest structure and objectives
  - Prerequisites and requirements
  - Rewards and progression

  Player PROGRESS is separate (tracked in character entity components).
  The quest definition itself is immutable content.

  ## Usage

      # Get quest definition
      {:ok, quest} = Quest.get("dragon_hunt")

      # List all quests with a tag
      main_quests = Quest.list_by_tag("main")

      # Get quest objectives
      objectives = Quest.objectives(quest)
  """

  alias Loka.Engine.{Entity, Entities}

  @type objective :: %{
          id: String.t(),
          type: atom(),
          target: String.t() | nil,
          count: non_neg_integer() | nil,
          description: String.t() | nil
        }

  @type rewards :: %{
          xp: non_neg_integer(),
          gold: non_neg_integer(),
          items: [String.t()]
        }

  @doc """
  Gets a quest by key.
  """
  @spec get(String.t()) :: {:ok, Entity.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    Entities.find_one(key: key, type: :quest)
  end

  @doc """
  Gets a quest by key, raises if not found.
  """
  @spec get!(String.t()) :: Entity.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, quest} -> quest
      {:error, :not_found} -> raise "Quest not found: #{key}"
    end
  end

  @doc """
  Lists all quest definitions.
  """
  @spec all() :: [Entity.t()]
  def all do
    Entities.find_all(type: :quest, is_prototype: true)
  end

  @doc """
  Lists all published quest definitions (excludes drafts).
  """
  @spec all_published() :: [Entity.t()]
  def all_published do
    Entities.find_all(type: :quest, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  @doc """
  Lists quests with a specific tag.
  """
  @spec list_by_tag(String.t()) :: [Entity.t()]
  def list_by_tag(tag) when is_binary(tag) do
    Entities.find_all(type: :quest, tags: [tag], is_prototype: true)
  end

  @doc """
  Lists published quests with a specific tag.
  """
  @spec list_by_tag_published(String.t()) :: [Entity.t()]
  def list_by_tag_published(tag) when is_binary(tag) do
    Entities.find_all(type: :quest, tags: [tag], is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  @doc """
  Gets the quest type (main, side, daily, repeatable).
  """
  @spec quest_type(Entity.t()) :: atom()
  def quest_type(%Entity{type: :quest} = quest) do
    data = quest.components["data"] || %{}

    case Map.get(data, "quest_type") || Map.get(data, :quest_type) do
      nil -> :side
      type when is_binary(type) -> String.to_existing_atom(type)
      type when is_atom(type) -> type
    end
  rescue
    _ -> :side
  end

  @doc """
  Gets the quest giver entity key.
  """
  @spec giver_key(Entity.t()) :: String.t() | nil
  def giver_key(%Entity{type: :quest} = quest) do
    data = quest.components["data"] || %{}
    Map.get(data, "giver_key") || Map.get(data, :giver_key)
  end

  @doc """
  Gets quest objectives.
  """
  @spec objectives(Entity.t()) :: [map()]
  def objectives(%Entity{type: :quest} = quest) do
    data = quest.components["data"] || %{}
    Map.get(data, "objectives") || Map.get(data, :objectives, [])
  end

  @doc """
  Gets quest rewards.
  """
  @spec rewards(Entity.t()) :: map()
  def rewards(%Entity{type: :quest} = quest) do
    data = quest.components["data"] || %{}
    Map.get(data, "rewards") || Map.get(data, :rewards, %{})
  end

  @doc """
  Gets quest prerequisites.
  """
  @spec prerequisites(Entity.t()) :: [String.t()]
  def prerequisites(%Entity{type: :quest} = quest) do
    data = quest.components["data"] || %{}
    Map.get(data, "prerequisites") || Map.get(data, :prerequisites, [])
  end

  @doc """
  Gets level range for the quest.
  """
  @spec level_range(Entity.t()) :: {non_neg_integer(), non_neg_integer()} | nil
  def level_range(%Entity{type: :quest} = quest) do
    data = quest.components["data"] || %{}

    case Map.get(data, "level_range") || Map.get(data, :level_range) do
      %{"min" => min, "max" => max} -> {min, max}
      %{min: min, max: max} -> {min, max}
      _ -> nil
    end
  end

  @doc """
  Gets journal entries for the quest.
  """
  @spec journal_entries(Entity.t()) :: map()
  def journal_entries(%Entity{type: :quest} = quest) do
    data = quest.components["data"] || %{}
    Map.get(data, "journal_entries") || Map.get(data, :journal_entries, %{})
  end

  @doc """
  Checks if quest is repeatable.
  """
  @spec repeatable?(Entity.t()) :: boolean()
  def repeatable?(%Entity{} = quest) do
    quest_type(quest) in [:daily, :repeatable]
  end

  # =============================================================================
  # Definition Maps (atom-key maps for framework callers)
  # =============================================================================

  @doc """
  Gets a quest definition as an atom-key map (replaces old Definitions.get_quest_definition/1).

  Returns nil if not found. The returned map has atom keys with dot-access support:
  `.id`, `.name`, `.description`, `.giver`, `.objectives`, `.rewards`, `.requires_quest`, etc.
  """
  def definition(key) do
    case get(key) do
      {:ok, entity} -> entity_to_definition(entity)
      {:error, _} -> nil
    end
  end

  @doc """
  Lists all quest definitions as atom-key maps (replaces old Definitions.all_quest_definitions/0).
  """
  def all_definitions do
    all()
    |> Enum.reject(fn entity ->
      data = entity.components["data"] || %{}
      data["is_template"] == true
    end)
    |> Enum.map(&entity_to_definition/1)
  end

  @doc """
  Converts a quest entity to a definition map with atom keys.
  """
  def entity_to_definition(%Entity{} = entity) do
    data = entity.components["data"] || %{}
    raw_objectives = data["objectives"] || []
    giver = data["giver_key"] || data["giver"]

    %{
      id: entity.key,
      name: data["name"] || entity.short_desc,
      description: data["description"] || entity.extra_desc,
      giver: giver,
      giver_key: giver,
      turn_in_npc: data["turn_in_npc"],
      objectives: Enum.map(raw_objectives, &map_objective/1),
      rewards: atomize_map(data["rewards"] || %{}),
      requires_quest: data["requires_quest"],
      quest_type: data["quest_type"],
      type: data["quest_type"],
      act: data["act"],
      level_requirement: data["level_requirement"],
      journal_entries: data["journal_entries"] || %{},
      variables: data["variables"] || %{},
      status: :available
    }
  end

  defp map_objective(obj) when is_map(obj) do
    %{
      id: obj["id"],
      type: to_atom_safe(obj["type"] || "talk"),
      target_id: obj["target_id"] || obj["target"],
      target_count: obj["target_count"] || obj["count"] || 1,
      description: obj["description"],
      dialogue_topic: obj["dialogue_topic"],
      time_limit: obj["time_limit"],
      quest_spawn: obj["quest_spawn"],
      completed: false,
      progress: 0
    }
  end

  defp to_atom_safe(s) when is_binary(s), do: String.to_atom(s)
  defp to_atom_safe(a) when is_atom(a), do: a

  defp atomize_map(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) -> {String.to_atom(k), v}
      {k, v} -> {k, v}
    end)
  end

  defp atomize_map(other), do: other

  # =============================================================================
  # Validation
  # =============================================================================

  @doc """
  Validates a quest definition.
  """
  @spec validate(Entity.t()) :: :ok | {:error, [String.t()]}
  def validate(%Entity{type: :quest} = quest) do
    errors =
      []
      |> validate_has_objectives(quest)
      |> validate_objective_ids(quest)

    if Enum.empty?(errors), do: :ok, else: {:error, errors}
  end

  def validate(%Entity{type: type}) do
    {:error, ["Expected quest type, got: #{type}"]}
  end

  defp validate_has_objectives(errors, quest) do
    if Enum.empty?(objectives(quest)) do
      ["quest must have at least one objective" | errors]
    else
      errors
    end
  end

  defp validate_objective_ids(errors, quest) do
    objs = objectives(quest)
    ids = Enum.map(objs, fn obj -> Map.get(obj, "id") || Map.get(obj, :id) end)

    if Enum.any?(ids, &is_nil/1) do
      ["all objectives must have an id" | errors]
    else
      errors
    end
  end
end
