defmodule Loka.WorldBuilder.QuestManager do
  @moduledoc """
  Quest management for World Builder UI.

  Provides CRUD operations for quest definitions, supporting the visual
  quest builder with node-based flow diagrams.

  ## Quest Structure

  Quests are stored as TypedObjects with type :quest and contain:
  - Quest metadata (name, description, tags)
  - Quest type (main, side, daily, repeatable)
  - Giver NPC key
  - Objectives (id, type, target, count)
  - Rewards (xp, gold, items)
  - Prerequisites (quest keys)
  - Level range (min, max)

  ## Usage

      # Create a new quest
      QuestManager.create_quest(%{
        key: "dragon_hunt",
        name: "The Dragon Awakens",
        quest_type: "main",
        giver_key: "village_elder",
        objectives: [
          %{id: "find_lair", type: "reach_room", target: "dragon_lair"}
        ],
        rewards: %{xp: 5000}
      })

      # List all quests
      quests = QuestManager.list_quests()

      # Get quest by key
      {:ok, quest} = QuestManager.get_quest("dragon_hunt")

      # Update quest
      QuestManager.update_quest("dragon_hunt", %{
        objectives: [%{id: "kill_dragon", type: "kill", target: "dragon", count: 1}]
      })

      # Delete quest
      QuestManager.delete_quest("dragon_hunt")
  """

  require Logger

  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Loader
  alias Loka.Content.Quest

  @quests_dir Path.join([:code.priv_dir(:loka), "world", "quests"])

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

    case TypedObject.new(attrs) do
      {:ok, typed_object} ->
        # Validate quest structure
        case Quest.validate(typed_object) do
          :ok ->
            # Save to YAML
            case save_quest_yaml(typed_object) do
              :ok ->
                Logger.info("[QuestManager] Created quest: #{typed_object.key}")
                {:ok, enrich_for_ui(typed_object)}

              {:error, reason} ->
                Logger.error("[QuestManager] Failed to save quest YAML: #{inspect(reason)}")
                {:error, "Failed to save quest: #{inspect(reason)}"}
            end

          {:error, errors} ->
            Logger.warning("[QuestManager] Quest validation failed: #{inspect(errors)}")
            {:error, Enum.join(errors, ", ")}
        end

      {:error, errors} ->
        Logger.warning("[QuestManager] TypedObject creation failed: #{inspect(errors)}")
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
      updated_data =
        existing_quest.data
        |> deep_merge(build_data_updates(attrs))

      updated_attrs =
        existing_quest
        |> Map.from_struct()
        |> Map.put(:data, updated_data)
        |> Map.merge(ensure_atom_keys(attrs))

      case TypedObject.new(updated_attrs) do
        {:ok, typed_object} ->
          case Quest.validate(typed_object) do
            :ok ->
              case save_quest_yaml(typed_object) do
                :ok ->
                  Logger.info("[QuestManager] Updated quest: #{key}")
                  {:ok, enrich_for_ui(typed_object)}

                {:error, reason} ->
                  {:error, "Failed to save quest: #{inspect(reason)}"}
              end

            {:error, errors} ->
              {:error, Enum.join(errors, ", ")}
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
    with :ok <- validate_safe_key(key) do
      file_path = Path.join(@quests_dir, "#{key}.yml")

      if File.exists?(file_path) do
        case File.rm(file_path) do
          :ok ->
            Logger.info("[QuestManager] Deleted quest: #{key}")
            # Reload quests to update registry
            Loader.reload()
            :ok

          {:error, reason} ->
            Logger.error("[QuestManager] Failed to delete quest file: #{inspect(reason)}")
            {:error, reason}
        end
      else
        {:error, :not_found}
      end
    else
      {:error, reason} -> {:error, reason}
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

  defp enrich_for_ui(quest) when is_struct(quest, TypedObject) do
    %{
      key: quest.key,
      name: quest.name || quest.key,
      description: quest.description || "",
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
  end

  defp build_quest_data(attrs) do
    # Extract quest-specific fields into data map
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
          Map.put(acc, field, Map.get(attrs, field))
        else
          acc
        end
      end)

    attrs
    |> Map.drop(quest_fields)
    |> Map.put(:data, data)
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
    |> Map.new()
  end

  defp save_quest_yaml(quest) do
    with :ok <- validate_safe_key(quest.key) do
      ensure_quests_dir()

      file_path = Path.join(@quests_dir, "#{quest.key}.yml")

      yaml_content = build_yaml_content(quest)

      case File.write(file_path, yaml_content) do
        :ok ->
          # Reload quests to update registry
          Loader.reload()
          :ok

        {:error, reason} ->
          {:error, reason}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp build_yaml_content(quest) do
    tags_yaml = format_yaml_list(quest.tags || [])

    # Build data section
    data_yaml = build_data_yaml(quest.data || %{})

    """
    key: #{quest.key}
    type: quest
    name: "#{escape_yaml_string(quest.name || "")}"
    description: "#{escape_yaml_string(quest.description || "")}"
    tags: #{tags_yaml}
    data:
    #{data_yaml}
    """
  end

  defp build_data_yaml(data) when is_map(data) do
    data
    |> Enum.map(fn {k, v} ->
      key = if is_atom(k), do: Atom.to_string(k), else: k
      "  #{key}: #{format_yaml_value(v)}"
    end)
    |> Enum.join("\n")
  end

  defp format_yaml_value(value) when is_binary(value), do: "\"#{escape_yaml_string(value)}\""
  defp format_yaml_value(value) when is_integer(value), do: Integer.to_string(value)
  defp format_yaml_value(value) when is_float(value), do: Float.to_string(value)
  defp format_yaml_value(value) when is_boolean(value), do: Atom.to_string(value)
  defp format_yaml_value(value) when is_nil(value), do: "null"
  defp format_yaml_value(value) when is_list(value), do: format_yaml_list(value)

  defp format_yaml_value(value) when is_map(value) do
    # For nested maps, use flow style
    inner =
      value
      |> Enum.map(fn {k, v} ->
        key = if is_atom(k), do: Atom.to_string(k), else: k
        "#{key}: #{format_yaml_value(v)}"
      end)
      |> Enum.join(", ")

    "{#{inner}}"
  end

  defp format_yaml_value(value), do: inspect(value)

  defp format_yaml_list([]), do: "[]"

  defp format_yaml_list(items) when is_list(items) do
    inner =
      items
      |> Enum.map(&format_yaml_value/1)
      |> Enum.join(", ")

    "[#{inner}]"
  end

  defp escape_yaml_string(str) when is_binary(str) do
    str
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
    |> String.replace("\n", "\\n")
  end

  defp escape_yaml_string(_), do: ""

  defp ensure_quests_dir do
    unless File.exists?(@quests_dir) do
      File.mkdir_p!(@quests_dir)
    end

    @quests_dir
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

  # Validates that a key is safe for file operations - prevents path traversal attacks
  defp validate_safe_key(key) when is_binary(key) do
    cond do
      String.contains?(key, "..") ->
        {:error, "Key cannot contain parent directory references"}

      String.contains?(key, "/") or String.contains?(key, "\\") ->
        {:error, "Key cannot contain path separators"}

      not String.match?(key, ~r/^[a-z0-9_-]+$/) ->
        {:error, "Key must contain only lowercase letters, numbers, hyphens, and underscores"}

      String.length(key) > 64 ->
        {:error, "Key must be 64 characters or less"}

      true ->
        :ok
    end
  end

  defp validate_safe_key(_), do: {:error, "Key must be a string"}
end
