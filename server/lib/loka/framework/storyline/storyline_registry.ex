defmodule Loka.Framework.Storyline.StorylineRegistry do
  @moduledoc """
  Loads and stores storyline definitions from YAML files.

  Storylines define quest chains and narrative arcs, linking quests together
  with prerequisites and act structures.

  ## YAML Format

      key: monastery_arc
      name: "The Sleeping Master"
      description: |
        Rescue Master Tenzin from spiritual imprisonment.
      starting_room: monastery_gate
      acts:
        - id: act_1
          name: "Discovery"
          quests:
            - main_sleeping_master
        - id: act_2
          name: "The Three Trials"
          quests:
            - main_three_trials
          requires:
            - act_1
        - id: act_3
          name: "Liberation"
          quests:
            - main_liberation
          requires:
            - act_2
      side_quests:
        - side_restless_spirits
        - side_mountain_peak
      tags:
        - main
        - buddhist

  ## Usage

      alias Loka.Framework.Storyline.StorylineRegistry

      # Get a storyline
      {:ok, storyline} = StorylineRegistry.get("monastery_arc")

      # Get all storylines
      storylines = StorylineRegistry.all()

      # Find storylines by tag
      main_storylines = StorylineRegistry.by_tag("main")

      # Get storyline for a quest
      {:ok, storyline} = StorylineRegistry.storyline_for_quest("main_sleeping_master")
  """

  use Loka.Framework.RegistryBase,
    table: :loka_storylines,
    path: "priv/world/storylines",
    item_module: Loka.Framework.Storyline.Storyline,
    item_name: "storyline",
    state_key: :storylines,
    content_types: [{:storyline, nil}]

  @doc """
  Lists all storylines with a specific tag.
  """
  def by_tag(tag, server \\ __MODULE__) when is_binary(tag) do
    GenServer.call(server, {:by_tag, tag})
  end

  @doc """
  Finds the storyline that contains a specific quest.

  Returns `{:ok, storyline}` or `{:error, :not_found}`.
  """
  def storyline_for_quest(quest_id, server \\ __MODULE__) when is_binary(quest_id) do
    GenServer.call(server, {:storyline_for_quest, quest_id})
  end

  @doc """
  Gets the prerequisite quests for a given quest.

  Returns a list of quest IDs that must be completed first.
  """
  def prerequisites_for(quest_id, server \\ __MODULE__) when is_binary(quest_id) do
    GenServer.call(server, {:prerequisites_for, quest_id})
  end

  @doc """
  Checks if a quest can be started based on storyline prerequisites.

  Returns `{:ok, :available}` or `{:error, {:missing_prerequisites, [quest_ids]}}`.
  """
  def check_prerequisites(quest_id, completed_quests, server \\ __MODULE__) do
    GenServer.call(server, {:check_prerequisites, quest_id, completed_quests})
  end

  @doc false
  def handle_custom_call({:by_tag, tag}, _from, state) do
    alias Loka.Framework.Storyline.Storyline

    storylines =
      state.storylines
      |> Map.values()
      |> Enum.filter(&(tag in &1.tags))

    {:reply, storylines, state}
  end

  def handle_custom_call({:storyline_for_quest, quest_id}, _from, state) do
    alias Loka.Framework.Storyline.Storyline

    result =
      state.storylines
      |> Map.values()
      |> Enum.find(fn storyline ->
        quest_id in Storyline.all_quests(storyline)
      end)

    case result do
      nil -> {:reply, {:error, :not_found}, state}
      storyline -> {:reply, {:ok, storyline}, state}
    end
  end

  def handle_custom_call({:prerequisites_for, quest_id}, _from, state) do
    alias Loka.Framework.Storyline.Storyline

    # Find which storyline and act this quest is in
    result =
      state.storylines
      |> Map.values()
      |> Enum.find_value(fn storyline ->
        find_quest_prerequisites(storyline, quest_id)
      end)

    {:reply, result || [], state}
  end

  def handle_custom_call({:check_prerequisites, quest_id, completed_quests}, _from, state) do
    alias Loka.Framework.Storyline.Storyline

    prerequisites = find_all_prerequisites(state.storylines, quest_id)

    missing =
      prerequisites
      |> Enum.reject(&(&1 in completed_quests))

    result =
      if Enum.empty?(missing) do
        {:ok, :available}
      else
        {:error, {:missing_prerequisites, missing}}
      end

    {:reply, result, state}
  end

  # Test helper - allows injecting test storylines
  def handle_custom_call({:put_test_storylines, storylines}, _from, state) do
    storyline_map =
      Enum.reduce(storylines, %{}, fn storyline, acc ->
        Map.put(acc, storyline.key, storyline)
      end)

    :ets.delete_all_objects(state.table)

    Enum.each(storyline_map, fn {key, storyline} -> :ets.insert(state.table, {key, storyline}) end)

    {:reply, :ok, %{state | storylines: storyline_map}}
  end

  def handle_custom_call(msg, from, state) do
    super(msg, from, state)
  end

  # Private helpers

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

  defp find_all_prerequisites(storylines, quest_id) do
    storylines
    |> Map.values()
    |> Enum.find_value(fn storyline ->
      find_quest_prerequisites(storyline, quest_id)
    end) || []
  end
end
