defmodule Loka.Content.Policies do
  @moduledoc "Compiler policy traversal and typed leaf references."
  import Loka.Content.Source, only: [diag: 2, at: 2]
  import Loka.Content.Refs, only: [owned: 3, reference: 6, resolve: 4]

  def tree({rel, steps, root}, ctx),
    do: for({node, at} <- nodes(root, steps), d <- node(rel, at, node, ctx), do: d)

  def nodes(%{"op" => op, "items" => items} = n, steps) when op in ~w(all any) do
    children =
      items
      |> Enum.with_index()
      |> Enum.flat_map(fn {c, i} -> nodes(c, steps ++ ["items", i]) end)

    [{n, steps} | children]
  end

  def nodes(%{"op" => "not", "item" => item} = n, steps),
    do: [{n, steps} | nodes(item, steps ++ ["item"])]

  # An absent policy (always holds) has no nodes.
  def nodes(nil, _), do: []
  def nodes(n, steps), do: [{n, steps}]

  defp node(rel, steps, %{"op" => op} = n, {m, defs, required}) do
    owned(at(rel, steps ++ ["op"]), op, required) ++
      empty_window(rel, steps, n) ++
      subjectless(rel, steps, n, m, defs) ++ leaf_refs(rel, steps, n, m, defs)
  end

  defp leaf_refs(rel, steps, %{"op" => op} = n, m, defs) do
    for {field, kind} <- Map.get(Loka.Content.LeafRefs.all(), op, %{}),
        is_map_key(n, field),
        d <- reference(rel, steps, {field, kind}, n, m, defs),
        do: d
  end

  defp empty_window(rel, steps, %{"op" => "time_window", "from" => t, "to" => t}),
    do: [diag("EMPTY_TIME_WINDOW", at(rel, steps))]

  defp empty_window(_, _, _), do: []

  # A per_subject fact read with no subject: the loader's FACT_SCOPE_UNSUPPORTED
  # (cartridge_scoped_facts.ts:80), here with the source's file line.
  defp subjectless(rel, steps, %{"op" => op, "fact" => f} = n, m, defs)
       when op in ~w(fact_compare fact_at_least time_since) do
    # time_since takes no `subject`: its schema refuses one before this runs
    case not Enum.any?(~w(subject npc item), &is_map_key(n, &1)) and resolve(f, "fact", m, defs) do
      {_, _, %{"per_subject" => true}} -> [diag("FACT_SCOPE_UNSUPPORTED", at(rel, steps))]
      _ -> []
    end
  end

  defp subjectless(_, _, _, _, _), do: []
end
