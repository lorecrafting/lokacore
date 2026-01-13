defmodule Loka.WorldBuilder.Analysis.DependencyGraph do
  @moduledoc """
  Builds and analyzes dependency graphs for world content.

  Detects circular dependencies and orphaned content.
  """

  def build_quest_graph(quests) do
    edges =
      quests
      |> Enum.flat_map(fn quest ->
        prereqs = quest.prerequisites || []
        Enum.map(prereqs, fn prereq -> {prereq, quest.key} end)
      end)

    nodes = Enum.map(quests, & &1.key)
    %{nodes: nodes, edges: edges}
  end

  def detect_cycles(graph) do
    graph.nodes
    |> Enum.filter(&has_cycle?(&1, graph, MapSet.new(), MapSet.new()))
  end

  defp has_cycle?(node, graph, visiting, visited) do
    cond do
      MapSet.member?(visiting, node) ->
        true

      MapSet.member?(visited, node) ->
        false

      true ->
        visiting = MapSet.put(visiting, node)

        children =
          Enum.filter(graph.edges, fn {from, _} -> from == node end)
          |> Enum.map(fn {_, to} -> to end)

        Enum.any?(children, &has_cycle?(&1, graph, visiting, visited))
    end
  end
end
