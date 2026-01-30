defmodule Loka.Framework.Skills.BinarySkillRegistry do
  @moduledoc """
  Loads and stores binary skill definitions from YAML files.

  ## YAML Format

      key: kick
      name: "Kick"
      category: combat_melee
      cost: 1
      stat: str
      description: "A basic kick attack that can interrupt spellcasting."
      prerequisites:
        - basic_combat
      trainers:
        - combat_instructor
      lag: 2
      cooldown: 0
      mv_cost: 10
      mana_cost: 0
      effect: "damage + interrupt"
      tags:
        - melee
        - interrupt
  """

  use Loka.Framework.RegistryBase,
    table: :loka_binary_skills,
    path: "priv/world/skills",
    item_module: Loka.Framework.Skills.BinarySkill,
    item_name: "binary skill",
    state_key: :skills

  @doc """
  Lists all skills in a specific category.
  """
  def by_category(category, server \\ __MODULE__)

  def by_category(category, server) when is_atom(category) do
    GenServer.call(server, {:by_category, category})
  end

  def by_category(category, server) when is_binary(category) do
    by_category(String.to_atom(category), server)
  end

  @doc """
  Lists all skills with a specific tag.
  """
  def by_tag(tag, server \\ __MODULE__) when is_binary(tag) do
    GenServer.call(server, {:by_tag, tag})
  end

  @doc """
  Lists all skills taught by a specific trainer.
  """
  def by_trainer(trainer_key, server \\ __MODULE__) when is_binary(trainer_key) do
    GenServer.call(server, {:by_trainer, trainer_key})
  end

  @doc """
  Lists all skills with a specific governing stat.
  """
  def by_stat(stat, server \\ __MODULE__) when is_atom(stat) do
    GenServer.call(server, {:by_stat, stat})
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

  def handle_custom_call({:by_trainer, trainer_key}, _from, state) do
    skills = state.skills |> Map.values() |> Enum.filter(&(trainer_key in &1.trainers))
    {:reply, skills, state}
  end

  def handle_custom_call({:by_stat, stat}, _from, state) do
    skills = state.skills |> Map.values() |> Enum.filter(&(&1.stat == stat))
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
