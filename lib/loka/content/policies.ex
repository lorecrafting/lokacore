defmodule Loka.Content.Policies do
  @moduledoc "Compiler policy traversal and typed leaf references."
  import Loka.Content.Source, only: [diag: 2, at: 2]
  import Loka.Content.Refs, only: [owned: 3, reference: 6]

  # Each leaf's reference field, named for its definition kind, or the list of a leaf's
  # alternative subject fields (mechanics.md policy leaf set); short refs expand to that kind.
  @leaf_refs %{
    "fact_compare" => "fact",
    "has_item" => "item",
    "quest_state" => "quest",
    "escort_state" => "quest",
    "barrier_state" => "barrier",
    "stat_compare" => "attribute",
    "resource_compare" => "resource",
    "has_tag" => ~w(item barrier room)
  }
  def leaf_refs, do: @leaf_refs

  def tree({rel, steps, root}, ctx),
    do: for({node, at} <- nodes(root, steps), d <- node(rel, at, node, ctx), do: d)

  defp nodes(%{"op" => op, "items" => items} = n, steps) when op in ~w(all any) do
    children =
      items
      |> Enum.with_index()
      |> Enum.flat_map(fn {c, i} -> nodes(c, steps ++ ["items", i]) end)

    [{n, steps} | children]
  end

  defp nodes(%{"op" => "not", "item" => item} = n, steps),
    do: [{n, steps} | nodes(item, steps ++ ["item"])]

  defp nodes(n, steps), do: [{n, steps}]

  defp node(rel, steps, %{"op" => op} = n, {m, defs, required}) do
    owned(at(rel, steps ++ ["op"]), op, required) ++
      empty_window(rel, steps, n) ++
      for field <- List.wrap(@leaf_refs[op]),
          is_map_key(n, field),
          d <- reference(rel, steps, field, n, m, defs),
          do: d
  end

  defp empty_window(rel, steps, %{"op" => "time_window", "from" => t, "to" => t}),
    do: [diag("EMPTY_TIME_WINDOW", at(rel, steps))]

  defp empty_window(_, _, _), do: []
end
