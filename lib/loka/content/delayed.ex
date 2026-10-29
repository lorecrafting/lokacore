defmodule Loka.Content.Delayed do
  @moduledoc """
  Toolbox row FD1: a reaction's `after`, the fact.stamp step and the time_since leaf: a delayed rule carries no step that reads its event (barrier.set, item.move, npc.move,
  population.suppress, a co_present or tagged step, a quest step: RS-4's subject) and no `when`
  leaf with `subject: "subject"`;
  a stamped or timed fact is an int fact with no maximum and a minimum absent or at most 0.
  """
  import Loka.Content.Source, only: [at: 2, diag: 3]
  import Loka.Content.Refs, only: [resolve: 4]

  # The fired job keeps its actor, not the subject RS-4's quest steps read (NPC no-op, trigger holder).
  @event_bound ~w(barrier.set item.move npc.move population.suppress quest.activate quest.resolve quest.fail replenish.run)

  @doc "Diagnostics for the reactions of `defs` and the policy `trees` (`{rel, steps, root}`)."
  @spec check(map() | nil, map(), list() | nil) :: [map()]
  def check(m, _, trees) when is_nil(m) or is_nil(trees), do: []

  def check(m, defs, trees) do
    steps = steps(defs)
    timed = timed(steps, trees)

    Enum.flat_map(timed, &clock(&1, m, defs)) ++
      Enum.flat_map(steps, &refused/1) ++ subjective(defs)
  end

  # Each fact.stamp step and time_since leaf, with its path.
  defp timed(steps, trees) do
    stamps = for {rel, _, %{"op" => "fact.stamp"} = s, i} <- steps, do: {rel, ["apply", i], s}
    leaves = Enum.flat_map(trees, fn {rel, path, root} -> nodes(rel, path, root) end)
    stamps ++ for({_, _, %{"op" => "time_since"}} = n <- leaves, do: n)
  end

  # At fire the event's subject is gone and `subject` would read the actor's body instead.
  defp subjective(defs),
    do:
      for(
        {_, {rel, [], %{"after" => _, "when" => w}}} <- defs["reaction"],
        {_, path, %{"subject" => "subject"}} <- nodes(rel, ["when", "root"], w["root"]),
        do: diag("SCHEMA_VIOLATION", at(rel, path ++ ["subject"]), %{"error" => "invalid_value"})
      )

  defp steps(defs),
    do:
      for(
        {_, {rel, [], r}} <- defs["reaction"],
        {s, i} <- Enum.with_index(r["apply"]),
        do: {rel, r, s, i}
      )

  defp refused({rel, %{"after" => _}, s, i}) do
    if s["op"] in @event_bound or
         (s["op"] == "status.apply" and (Map.has_key?(s, "co_present") or Map.has_key?(s, "tag"))),
       do: [diag("SCHEMA_VIOLATION", at(rel, ["apply", i, "op"]), %{"error" => "invalid_value"})],
       else: []
  end

  defp refused(_), do: []

  defp clock({rel, path, n}, m, defs) do
    case resolve(n["fact"], "fact", m, defs) do
      {_, _, %{"value_type" => t}} ->
        if t["type"] == "int" and not is_map_key(t, "maximum") and Map.get(t, "minimum", 0) <= 0,
          do: [],
          else: [
            diag("SCHEMA_VIOLATION", at(rel, path ++ ["fact"]), %{"error" => "invalid_value"})
          ]

      _ ->
        []
    end
  end

  # Each node of a policy tree, with its path.
  defp nodes(rel, path, %{"op" => "not", "item" => x} = n),
    do: [{rel, path, n} | nodes(rel, path ++ ["item"], x)]

  defp nodes(rel, path, %{"items" => xs} = n) when is_list(xs),
    do: [
      {rel, path, n}
      | xs
        |> Enum.with_index()
        |> Enum.flat_map(fn {x, i} -> nodes(rel, path ++ ["items", i], x) end)
    ]

  defp nodes(rel, path, n), do: [{rel, path, n}]
end
