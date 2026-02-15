defmodule Loka.Content.Quest do
  @moduledoc """
  Quest definition - OOC TypedObject.

  Quests are content definitions that describe:
  - Quest structure and objectives
  - Prerequisites and requirements
  - Rewards and progression

  Player PROGRESS is separate (tracked in player state/GameState).
  The quest definition itself is immutable content.

  ## Usage

      # Get quest definition
      {:ok, quest} = Quest.get("dragon_hunt")

      # List all quests with a tag
      main_quests = Quest.list_by_tag("main")

      # Get quest objectives
      objectives = Quest.objectives(quest)

  ## YAML Structure

      key: dragon_hunt
      type: quest
      parent: base_main_quest
      name: "The Dragon Awakens"
      tags: [main, act2]
      locks:
        accept: "level >= 10"
      data:
        quest_type: main
        giver_key: village_elder
        objectives:
          - id: find_lair
            type: reach_room
            target: dragon_lair
        rewards:
          xp: 5000
  """

  alias Loka.Engine.{Entity, Entities, TypedObject}
  alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader

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
  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :quest) do
      {:ok, entity} ->
        Entity.to_typed_object(entity)

      {:error, :not_found} ->
        # Quests are YAML-only (not in DB), so fall back to TypedObject registry
        case TypedObjectLoader.get(key) do
          {:ok, %TypedObject{type: :quest} = quest} -> {:ok, quest}
          _ -> {:error, :not_found}
        end
    end
  end

  @doc """
  Gets a quest by key, raises if not found.
  """
  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, quest} -> quest
      {:error, :not_found} -> raise "Quest not found: #{key}"
    end
  end

  @doc """
  Lists all quest definitions.
  """
  @spec all() :: [TypedObject.t()]
  def all do
    db_quests =
      Entities.find_all(type: :quest, is_prototype: true)
      |> to_typed_objects()

    if Enum.empty?(db_quests) do
      # Quests are YAML-only (not in DB), fall back to TypedObject registry
      TypedObjectLoader.list_by_type(:quest)
    else
      db_quests
    end
  end

  @doc """
  Lists all published quest definitions (excludes drafts).
  """
  @spec all_published() :: [TypedObject.t()]
  def all_published do
    Entities.find_all(type: :quest, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @doc """
  Lists quests with a specific tag.
  """
  @spec list_by_tag(String.t()) :: [TypedObject.t()]
  def list_by_tag(tag) when is_binary(tag) do
    Entities.find_all(type: :quest, tags: [tag], is_prototype: true)
    |> to_typed_objects()
  end

  @doc """
  Lists published quests with a specific tag.
  """
  @spec list_by_tag_published(String.t()) :: [TypedObject.t()]
  def list_by_tag_published(tag) when is_binary(tag) do
    Entities.find_all(type: :quest, tags: [tag], is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @doc """
  Gets the quest type (main, side, daily, repeatable).
  """
  @spec quest_type(TypedObject.t()) :: atom()
  def quest_type(%TypedObject{type: :quest, data: data}) do
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
  @spec giver_key(TypedObject.t()) :: String.t() | nil
  def giver_key(%TypedObject{type: :quest, data: data}) do
    Map.get(data, "giver_key") || Map.get(data, :giver_key)
  end

  @doc """
  Gets quest objectives.
  """
  @spec objectives(TypedObject.t()) :: [map()]
  def objectives(%TypedObject{type: :quest, data: data}) do
    Map.get(data, "objectives") || Map.get(data, :objectives, [])
  end

  @doc """
  Gets quest rewards.
  """
  @spec rewards(TypedObject.t()) :: map()
  def rewards(%TypedObject{type: :quest, data: data}) do
    Map.get(data, "rewards") || Map.get(data, :rewards, %{})
  end

  @doc """
  Gets quest prerequisites.
  """
  @spec prerequisites(TypedObject.t()) :: [String.t()]
  def prerequisites(%TypedObject{type: :quest, data: data}) do
    Map.get(data, "prerequisites") || Map.get(data, :prerequisites, [])
  end

  @doc """
  Gets level range for the quest.
  """
  @spec level_range(TypedObject.t()) :: {non_neg_integer(), non_neg_integer()} | nil
  def level_range(%TypedObject{type: :quest, data: data}) do
    case Map.get(data, "level_range") || Map.get(data, :level_range) do
      %{"min" => min, "max" => max} -> {min, max}
      %{min: min, max: max} -> {min, max}
      _ -> nil
    end
  end

  @doc """
  Gets journal entries for the quest.
  """
  @spec journal_entries(TypedObject.t()) :: map()
  def journal_entries(%TypedObject{type: :quest, data: data}) do
    Map.get(data, "journal_entries") || Map.get(data, :journal_entries, %{})
  end

  @doc """
  Checks if quest is repeatable.
  """
  @spec repeatable?(TypedObject.t()) :: boolean()
  def repeatable?(%TypedObject{} = quest) do
    quest_type(quest) in [:daily, :repeatable]
  end

  @doc """
  Validates a quest definition.
  """
  @spec validate(TypedObject.t()) :: :ok | {:error, [String.t()]}
  def validate(%TypedObject{type: :quest} = quest) do
    errors =
      []
      |> validate_has_objectives(quest)
      |> validate_objective_ids(quest)

    if Enum.empty?(errors), do: :ok, else: {:error, errors}
  end

  def validate(%TypedObject{type: type}) do
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

  defp to_typed_objects(entities) do
    Enum.flat_map(entities, fn entity ->
      case Entity.to_typed_object(entity) do
        {:ok, typed_object} -> [typed_object]
        _ -> []
      end
    end)
  end
end
