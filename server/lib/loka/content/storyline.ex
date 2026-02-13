defmodule Loka.Content.Storyline do
  @moduledoc """
  Storyline definition - OOC TypedObject.

  Storylines organize quests into acts with progression tracking.
  """

  alias Loka.Engine.{Entity, Entities, TypedObject}
  alias Loka.Framework.Storyline.Storyline
  alias Loka.Framework.Storyline.Storyline.Act

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :storyline) do
      {:ok, entity} -> Entity.to_typed_object(entity)
      error -> error
    end
  end

  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, storyline} -> storyline
      {:error, :not_found} -> raise "Storyline not found: #{key}"
    end
  end

  @doc """
  Gets a storyline as a Storyline struct.

  Returns `{:ok, storyline_struct}` or `{:error, :not_found}`.
  """
  @spec get_struct(String.t()) :: {:ok, Storyline.t()} | {:error, :not_found}
  def get_struct(key) when is_binary(key) do
    case get(key) do
      {:ok, typed_object} -> {:ok, to_storyline_struct(typed_object)}
      error -> error
    end
  end

  @spec all() :: [TypedObject.t()]
  def all do
    Entities.find_all(type: :storyline, is_prototype: true)
    |> to_typed_objects()
  end

  @doc """
  Returns all storylines as Storyline structs.

  This is used by callers that expect the old StorylineRegistry format.
  """
  @spec all_structs() :: [Storyline.t()]
  def all_structs do
    all() |> Enum.map(&to_storyline_struct/1)
  end

  @spec all_published() :: [TypedObject.t()]
  def all_published do
    Entities.find_all(type: :storyline, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @spec by_tag(String.t()) :: [TypedObject.t()]
  def by_tag(tag) when is_binary(tag) do
    Entities.find_all(type: :storyline, tags: [tag], is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  def acts(%TypedObject{type: :storyline} = storyline),
    do: TypedObject.get_data(storyline, "acts", [])

  def side_quests(%TypedObject{type: :storyline} = storyline),
    do: TypedObject.get_data(storyline, "side_quests", [])

  def main_quests(%TypedObject{type: :storyline} = storyline),
    do: TypedObject.get_data(storyline, "main_quests", [])

  @doc """
  Checks if a quest can be started based on storyline prerequisites.

  Returns `{:ok, :available}` or `{:error, {:missing_prerequisites, [quest_ids]}}`.
  """
  @spec check_prerequisites(String.t(), [String.t()]) ::
          {:ok, :available} | {:error, {:missing_prerequisites, [String.t()]}}
  def check_prerequisites(quest_id, completed_quests) do
    prerequisites = find_all_prerequisites(quest_id)

    missing =
      prerequisites
      |> Enum.reject(&(&1 in completed_quests))

    if Enum.empty?(missing) do
      {:ok, :available}
    else
      {:error, {:missing_prerequisites, missing}}
    end
  end

  # =============================================================================
  # Struct Conversion
  # =============================================================================

  @doc """
  Converts a TypedObject storyline to a Storyline struct.
  """
  @spec to_storyline_struct(TypedObject.t()) :: Storyline.t()
  def to_storyline_struct(%TypedObject{type: :storyline} = typed_object) do
    data = typed_object.data || %{}

    acts_data = Map.get(data, "acts") || Map.get(data, :acts) || []

    acts =
      Enum.map(acts_data, fn act_data ->
        %Act{
          id: act_data["id"] || act_data[:id],
          name: act_data["name"] || act_data[:name],
          description: act_data["description"] || act_data[:description],
          quests: act_data["quests"] || act_data[:quests] || [],
          requires: act_data["requires"] || act_data[:requires] || []
        }
      end)

    %Storyline{
      key: typed_object.key,
      name: typed_object.name || Map.get(data, "name") || Map.get(data, :name),
      description:
        typed_object.description || Map.get(data, "description") || Map.get(data, :description),
      starting_room: Map.get(data, "starting_room") || Map.get(data, :starting_room),
      acts: acts,
      side_quests: Map.get(data, "side_quests") || Map.get(data, :side_quests) || [],
      tags: typed_object.tags || Map.get(data, "tags") || Map.get(data, :tags) || []
    }
  end

  # =============================================================================
  # Private - Prerequisites
  # =============================================================================

  defp find_all_prerequisites(quest_id) do
    all_structs()
    |> Enum.find_value(fn storyline ->
      find_quest_prerequisites(storyline, quest_id)
    end) || []
  end

  defp find_quest_prerequisites(storyline, quest_id) do
    # Find the act containing this quest
    act_with_quest =
      Enum.find(storyline.acts, fn act ->
        quest_id in act.quests
      end)

    if act_with_quest do
      # Get all quests from required acts
      act_with_quest.requires
      |> Enum.flat_map(fn required_act_id ->
        case Enum.find(storyline.acts, &(&1.id == required_act_id)) do
          nil -> []
          act -> act.quests
        end
      end)
    else
      nil
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp to_typed_objects(entities) do
    entities
    |> Enum.flat_map(fn entity ->
      case Entity.to_typed_object(entity) do
        {:ok, typed_object} -> [typed_object]
        {:error, _} -> []
      end
    end)
  end
end
