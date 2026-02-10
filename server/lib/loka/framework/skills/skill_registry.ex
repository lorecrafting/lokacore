defmodule Loka.Framework.Skills.SkillRegistry do
  @moduledoc """
  Loads and stores skill definitions from YAML files.

  ## YAML Format

      key: swordsmanship
      name: "Swordsmanship"
      category: combat
      max_level: 100
      description: "Proficiency with bladed weapons."
      prerequisites:
        - skill: basic_combat
          level: 10
      unlocks:
        - parry
        - riposte
      trainers:
        - weapons_master
      practice_actions:
        - attack_with_sword
      xp_per_use: 1
      xp_per_level: 100
  """

  use Loka.Framework.RegistryBase,
    table: :loka_skills,
    path: "priv/world/skills",
    item_module: Loka.Framework.Skills.Skill,
    item_name: "skill",
    state_key: :skills,
    content_types: [{:skill, nil}]

  @doc """
  Lists all skills in a specific category.
  """
  def by_category(category, server \\ __MODULE__) when is_binary(category) do
    GenServer.call(server, {:by_category, category})
  end

  @doc """
  Lists all skills with a specific tag.
  """
  def by_tag(tag, server \\ __MODULE__) when is_binary(tag) do
    GenServer.call(server, {:by_tag, tag})
  end

  @doc false
  def handle_custom_call({:by_category, category}, _from, state) do
    skills = state.skills |> Map.values() |> Enum.filter(&(&1.category == category))
    {:reply, skills, state}
  end

  def handle_custom_call({:by_tag, tag}, _from, state) do
    skills = state.skills |> Map.values() |> Enum.filter(&(tag in &1.tags))
    {:reply, skills, state}
  end

  # Test helper - allows injecting test skills
  def handle_custom_call({:put_test_skills, skills}, _from, state) do
    skill_map =
      Enum.reduce(skills, %{}, fn skill, acc ->
        Map.put(acc, skill.key, skill)
      end)

    :ets.delete_all_objects(state.table)
    Enum.each(skill_map, fn {key, skill} -> :ets.insert(state.table, {key, skill}) end)

    {:reply, :ok, %{state | skills: skill_map}}
  end
end
