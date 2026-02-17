defmodule Loka.WorldBuilder.QuestManager do
  @moduledoc """
  Quest management for World Builder UI.

  Provides CRUD operations for quest definitions. All operations persist
  to the entity database (V2 single source of truth).
  """

  require Logger

  alias Loka.Engine.{Entity, Entities}
  alias Loka.Content.Quest

  @doc """
  Create a new quest definition.

  ## Parameters
  - attrs: Map of quest attributes

  Returns {:ok, quest_map} or {:error, reason}
  """
  def create_quest(attrs) when is_map(attrs) do
    attrs =
      attrs
      |> ensure_atom_keys()
      |> Map.put(:type, :quest)
      |> apply_quest_defaults()
      |> build_quest_data()

    entity = Entity.new(attrs)

    case Quest.validate(entity) do
      :ok ->
        case Entities.save(entity) do
          {:ok, schema} ->
            saved = Entities.to_entity(schema)
            Logger.info("[QuestManager] Created quest: #{saved.key}")
            {:ok, enrich_for_ui(saved)}

          {:error, reason} ->
            Logger.error("[QuestManager] Failed to save quest: #{inspect(reason)}")
            {:error, "Failed to save quest: #{inspect(reason)}"}
        end

      {:error, errors} ->
        Logger.warning("[QuestManager] Quest validation failed: #{inspect(errors)}")
        {:error, Enum.join(errors, ", ")}
    end
  end

  @doc """
  Get a quest by key.

  Returns {:ok, quest_map} or {:error, :not_found}
  """
  def get_quest(key) when is_binary(key) do
    case Quest.get(key) do
      {:ok, quest} ->
        {:ok, enrich_for_ui(quest)}

      {:error, :not_found} ->
        {:error, :not_found}
    end
  end

  @doc """
  List all quest definitions.

  Returns list of quest maps enriched for UI.
  """
  def list_quests do
    Quest.all()
    |> Enum.map(&enrich_for_ui/1)
  end

  @doc """
  Update an existing quest.

  Returns {:ok, quest_map} or {:error, reason}
  """
  def update_quest(key, attrs) when is_binary(key) and is_map(attrs) do
    with {:ok, existing_quest} <- Quest.get(key) do
      # Merge updates into existing quest
      existing_data = existing_quest.components["data"] || %{}

      updated_data =
        existing_data
        |> deep_merge(build_data_updates(attrs))

      updated_components = Map.put(existing_quest.components, "data", updated_data)

      quest_data_fields = [
        :quest_type,
        :giver_key,
        :objectives,
        :rewards,
        :prerequisites,
        :level_range,
        :journal_entries
      ]

      user_attrs =
        attrs
        |> ensure_atom_keys()
        |> Map.drop(quest_data_fields)
        |> remap_builder_fields()

      updated_attrs =
        existing_quest
        |> Map.from_struct()
        |> Map.put(:components, updated_components)
        |> Map.merge(user_attrs)

      entity = Entity.new(updated_attrs)

      case Quest.validate(entity) do
        :ok ->
          case Entities.get_entity_by_key(key) do
            %{} = schema ->
              db_updates = %{
                components: updated_components
              }

              db_updates =
                if Map.has_key?(user_attrs, :short_desc),
                  do: Map.put(db_updates, :short_desc, user_attrs[:short_desc]),
                  else: db_updates

              db_updates =
                if Map.has_key?(user_attrs, :extra_desc),
                  do: Map.put(db_updates, :extra_desc, user_attrs[:extra_desc]),
                  else: db_updates

              case Entities.update_entity(schema, db_updates) do
                {:ok, _} ->
                  Logger.info("[QuestManager] Updated quest: #{key}")
                  {:ok, enrich_for_ui(entity)}

                {:error, reason} ->
                  {:error, "Failed to save quest: #{inspect(reason)}"}
              end

            nil ->
              {:error, "Quest not found in DB"}
          end

        {:error, errors} ->
          {:error, Enum.join(errors, ", ")}
      end
    end
  end

  @doc """
  Delete a quest by key.

  Returns :ok or {:error, reason}
  """
  def delete_quest(key) when is_binary(key) do
    case Entities.get_entity_by_key(key) do
      %{type: :quest} = schema ->
        case Entities.delete_entity(schema) do
          {:ok, _} ->
            Logger.info("[QuestManager] Deleted quest: #{key}")
            :ok

          {:error, reason} ->
            {:error, reason}
        end

      _ ->
        {:error, :not_found}
    end
  end

  @doc """
  Search quests by name, description, or tags.

  Returns list of matching quest maps.
  """
  def search_quests(query) when is_binary(query) do
    query_lower = String.downcase(query)

    list_quests()
    |> Enum.filter(fn quest ->
      name_match = String.contains?(String.downcase(quest.name || ""), query_lower)
      desc_match = String.contains?(String.downcase(quest.description || ""), query_lower)

      tag_match =
        Enum.any?(quest.tags || [], &String.contains?(String.downcase(&1), query_lower))

      name_match || desc_match || tag_match
    end)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp enrich_for_ui(%Entity{} = quest) do
    %{
      key: quest.key,
      name: quest.short_desc || quest.key,
      description: quest.extra_desc || "",
      tags: quest.tags || [],
      quest_type: Quest.quest_type(quest),
      giver_key: Quest.giver_key(quest),
      objectives: Quest.objectives(quest),
      rewards: Quest.rewards(quest),
      prerequisites: Quest.prerequisites(quest),
      level_range: Quest.level_range(quest),
      journal_entries: Quest.journal_entries(quest)
    }
  end

  defp apply_quest_defaults(attrs) do
    attrs
    |> Map.put_new(:name, "New Quest")
    |> Map.put_new(:description, "A quest")
    |> Map.put_new(:tags, [])
    |> then(fn a ->
      a
      |> Map.put_new(:short_desc, a[:name])
      |> Map.put_new(:extra_desc, a[:description])
      |> Map.drop([:name, :description])
    end)
  end

  defp build_quest_data(attrs) do
    quest_fields = [
      :quest_type,
      :giver_key,
      :objectives,
      :rewards,
      :prerequisites,
      :level_range,
      :journal_entries
    ]

    data =
      quest_fields
      |> Enum.reduce(%{}, fn field, acc ->
        if Map.has_key?(attrs, field) do
          Map.put(acc, Atom.to_string(field), Map.get(attrs, field))
        else
          acc
        end
      end)

    attrs
    |> Map.drop(quest_fields)
    |> Map.put(:components, %{"data" => data})
  end

  defp build_data_updates(attrs) do
    quest_fields = [
      :quest_type,
      :giver_key,
      :objectives,
      :rewards,
      :prerequisites,
      :level_range,
      :journal_entries
    ]

    attrs
    |> ensure_atom_keys()
    |> Enum.filter(fn {k, _v} -> k in quest_fields end)
    |> Map.new(fn {k, v} -> {Atom.to_string(k), v} end)
  end

  defp remap_builder_fields(attrs) when is_map(attrs) do
    attrs
    |> then(fn a ->
      if Map.has_key?(a, :name) do
        a |> Map.put(:short_desc, a[:name]) |> Map.delete(:name)
      else
        a
      end
    end)
    |> then(fn a ->
      if Map.has_key?(a, :description) do
        a |> Map.put(:extra_desc, a[:description]) |> Map.delete(:description)
      else
        a
      end
    end)
  end

  defp ensure_atom_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) ->
        try do
          {String.to_existing_atom(k), v}
        rescue
          ArgumentError -> {String.to_atom(k), v}
        end

      {k, v} when is_atom(k) ->
        {k, v}
    end)
  end

  defp deep_merge(left, right) when is_map(left) and is_map(right) do
    Map.merge(left, right, fn _k, left_val, right_val ->
      if is_map(left_val) and is_map(right_val) do
        deep_merge(left_val, right_val)
      else
        right_val
      end
    end)
  end

  defp deep_merge(_left, right), do: right
end
