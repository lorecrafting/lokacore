defmodule Loka.Content.Storyline do
  @moduledoc """
  Storyline definition - OOC Entity.

  Storylines organize quests into acts with progression tracking.

  ## Storyline Map Format

  The `to_storyline_map/1` function converts an entity to:

      %{
        key: "main_storyline",
        name: "The Main Quest",
        description: "...",
        starting_room: "town_square",
        acts: [
          %{id: "act1", name: "Prologue", quests: [...], requires: []},
          %{id: "act2", name: "Rising", quests: [...], requires: ["act1"]}
        ],
        side_quests: ["side_quest_1"],
        tags: ["main"]
      }
  """

  alias Loka.Engine.{Entity, Entities}

  @type storyline_map :: %{
          key: String.t(),
          name: String.t() | nil,
          description: String.t() | nil,
          starting_room: String.t() | nil,
          acts: [act_map()],
          side_quests: [String.t()],
          tags: [String.t()]
        }

  @type act_map :: %{
          id: String.t() | nil,
          name: String.t() | nil,
          description: String.t() | nil,
          quests: [String.t()],
          requires: [String.t()]
        }

  @spec get(String.t()) :: {:ok, Entity.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    Entities.find_one(key: key, type: :storyline)
  end

  @spec get!(String.t()) :: Entity.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, storyline} -> storyline
      {:error, :not_found} -> raise "Storyline not found: #{key}"
    end
  end

  @doc """
  Gets a storyline as a map with structured fields.

  Returns `{:ok, storyline_map}` or `{:error, :not_found}`.
  """
  @spec get_struct(String.t()) :: {:ok, storyline_map()} | {:error, :not_found}
  def get_struct(key) when is_binary(key) do
    case get(key) do
      {:ok, entity} -> {:ok, to_storyline_map(entity)}
      error -> error
    end
  end

  @spec all() :: [Entity.t()]
  def all do
    Entities.find_all(type: :storyline, is_prototype: true)
  end

  @doc """
  Returns all storylines as structured maps.

  This is used by callers that expect the old StorylineRegistry format.
  """
  @spec all_structs() :: [storyline_map()]
  def all_structs do
    all() |> Enum.map(&to_storyline_map/1)
  end

  @spec all_published() :: [Entity.t()]
  def all_published do
    Entities.find_all(type: :storyline, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  @spec by_tag(String.t()) :: [Entity.t()]
  def by_tag(tag) when is_binary(tag) do
    Entities.find_all(type: :storyline, tags: [tag], is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  def acts(%Entity{type: :storyline} = entity),
    do: get_data(entity, "acts", [])

  def side_quests(%Entity{type: :storyline} = entity),
    do: get_data(entity, "side_quests", [])

  def main_quests(%Entity{type: :storyline} = entity),
    do: get_data(entity, "main_quests", [])

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

  @doc """
  Returns all quests in a storyline (main acts + side quests).
  Works with both entity and storyline map formats.
  """
  def all_quests(%Entity{type: :storyline} = entity) do
    entity |> to_storyline_map() |> all_quests()
  end

  def all_quests(%{acts: acts, side_quests: side_quests}) do
    main = Enum.flat_map(acts, & &1.quests)
    main ++ side_quests
  end

  @doc """
  Returns the ordered list of main quests (acts in order).
  Works with both entity and storyline map formats.
  """
  def quest_order(%Entity{type: :storyline} = entity) do
    entity |> to_storyline_map() |> quest_order()
  end

  def quest_order(%{acts: acts}) do
    Enum.flat_map(acts, & &1.quests)
  end

  @doc """
  Calculates progress through the storyline.
  Returns `{completed_count, total_count, percentage}`.
  """
  def progress(storyline, completed_quests) do
    all = quest_order(storyline)
    total = length(all)
    completed = Enum.count(all, &(&1 in completed_quests))
    percentage = if total > 0, do: round(completed / total * 100), else: 0
    {completed, total, percentage}
  end

  # =============================================================================
  # Map Conversion
  # =============================================================================

  @doc """
  Converts an entity storyline to a structured map.
  """
  @spec to_storyline_map(Entity.t()) :: storyline_map()
  def to_storyline_map(%Entity{type: :storyline} = entity) do
    data = entity.components["data"] || %{}

    acts_data = Map.get(data, "acts") || Map.get(data, :acts) || []

    acts =
      Enum.map(acts_data, fn act_data ->
        %{
          id: act_data["id"] || act_data[:id],
          name: act_data["name"] || act_data[:name],
          description: act_data["description"] || act_data[:description],
          quests: act_data["quests"] || act_data[:quests] || [],
          requires: act_data["requires"] || act_data[:requires] || []
        }
      end)

    %{
      key: entity.key,
      name: entity.short_desc || Map.get(data, "name") || Map.get(data, :name),
      description:
        entity.long_desc || Map.get(data, "description") || Map.get(data, :description),
      starting_room: Map.get(data, "starting_room") || Map.get(data, :starting_room),
      acts: acts,
      side_quests: Map.get(data, "side_quests") || Map.get(data, :side_quests) || [],
      tags: entity.tags || Map.get(data, "tags") || Map.get(data, :tags) || []
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

  defp get_data(%Entity{} = entity, field, default) do
    data = entity.components["data"] || %{}
    val = Map.get(data, field)
    if is_nil(val), do: default, else: val
  end
end
