defmodule Loka.Content.Delayed do
  @moduledoc """
  Toolbox row FD1: a reaction's `after`, the fact.stamp step and the time_since leaf need
  kernel_api 1.90; a delayed rule carries no step that reads its event (barrier.set, item.move,
  population.suppress, a co_present or tagged step) and no `when` leaf with `subject: "subject"`;
  a stamped or timed fact is an int fact with no maximum and a minimum absent or at most 0. Twin of kernel/ts/src/content/cartridge_delayed.ts.
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3]
  import Loka.Content.Refs, only: [resolve: 4]

  @event_bound ~w(barrier.set item.move population.suppress)

  @doc "Diagnostics for the reactions of `defs` and the policy `trees` (`{rel, steps, root}`)."
  @spec check(map() | nil, map(), list() | nil) :: [map()]
  def check(m, _, trees) when is_nil(m) or is_nil(trees), do: []

  def check(m, defs, trees) do
    steps = steps(defs)
    stamps = for {rel, _, %{"op" => "fact.stamp"} = s, i} <- steps, do: {rel, ["apply", i], s}
    leaves = Enum.flat_map(trees, fn {rel, path, root} -> nodes(rel, path, root) end)
    timed = stamps ++ for({_, _, %{"op" => "time_since"}} = n <- leaves, do: n)

    Enum.flat_map(timed, &clock(&1, m, defs)) ++
      Enum.flat_map(steps, &refused/1) ++ subjective(defs) ++ floor(m, timed, defs)
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

  # Each node of a policy tree, with its path, walked like the TS loader's walk.
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

  # Per rule, so a rule with `after` and no steps needs 1.90 too.
  defp floor(m, timed, defs) do
    used = timed != [] or for({_, {_, [], %{"after" => _}}} <- defs["reaction"], do: 1) != []

    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if used and api < [1, 90],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end
end
