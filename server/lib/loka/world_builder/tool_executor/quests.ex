defmodule Loka.WorldBuilder.ToolExecutor.Quests do
  @moduledoc false

  alias Loka.WorldBuilder.QuestManager

  def execute_create_quest(input) do
    attrs = %{
      key: input["key"],
      name: input["name"],
      description: input["description"],
      quest_type: input["quest_type"] || "side",
      giver_key: input["giver_key"],
      objectives: input["objectives"] || [],
      rewards: input["rewards"] || %{},
      prerequisites: input["prerequisites"] || [],
      level_range: input["level_range"],
      tags: input["tags"] || []
    }

    case QuestManager.create_quest(attrs) do
      {:ok, quest} ->
        {:ok,
         %{
           success: true,
           message: "Created quest '#{quest.name}' (#{quest.key})",
           quest: %{
             key: quest.key,
             name: quest.name,
             quest_type: attrs.quest_type,
             giver_key: attrs.giver_key
           }
         }}

      {:error, reason} ->
        {:error, "Failed to create quest: #{inspect(reason)}"}
    end
  end

  def execute_update_quest(input) do
    quest_key = input["quest_key"]

    updates =
      input
      |> Map.take(["name", "description", "objectives", "rewards", "prerequisites"])
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Map.new()

    case QuestManager.update_quest(quest_key, updates) do
      {:ok, quest} ->
        {:ok,
         %{
           success: true,
           message: "Updated quest '#{quest.name}'",
           quest: %{
             key: quest.key,
             name: quest.name
           }
         }}

      {:error, reason} ->
        {:error, "Failed to update quest: #{inspect(reason)}"}
    end
  end

  def execute_list_quests(input) do
    quests = QuestManager.list_quests()

    filtered_quests =
      cond do
        quest_type = input["quest_type"] ->
          Enum.filter(quests, fn quest ->
            get_quest_type(quest) == quest_type
          end)

        giver_key = input["giver_key"] ->
          Enum.filter(quests, fn quest ->
            get_quest_giver(quest) == giver_key
          end)

        true ->
          quests
      end

    quest_list =
      Enum.map(filtered_quests, fn quest ->
        %{
          key: quest.key || quest[:key],
          name: quest.name || quest[:name],
          quest_type: get_quest_type(quest) || "side",
          giver_key: get_quest_giver(quest)
        }
      end)

    {:ok,
     %{
       success: true,
       message: "Found #{length(quest_list)} quests",
       quests: quest_list
     }}
  end

  def execute_delete_quest(input) do
    key = input["key"]

    case QuestManager.delete_quest(key) do
      :ok ->
        {:ok, %{success: true, message: "Deleted quest '#{key}'"}}

      {:error, :not_found} ->
        {:error, "Quest not found: #{key}"}

      {:error, reason} ->
        {:error, "Failed to delete quest: #{inspect(reason)}"}
    end
  end

  defp get_quest_type(quest) do
    quest[:quest_type] ||
      quest.quest_type ||
      get_in(quest, [:data, "quest_type"]) ||
      get_in(quest, [:data, :quest_type])
  end

  defp get_quest_giver(quest) do
    quest[:giver_key] ||
      quest.giver_key ||
      get_in(quest, [:data, "giver_key"]) ||
      get_in(quest, [:data, :giver_key])
  end
end
