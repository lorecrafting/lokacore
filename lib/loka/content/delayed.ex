defmodule Loka.Content.Delayed do
  @moduledoc """
  Toolbox row FD1: a reaction's `after`, the fact.stamp step and the time_since leaf need
  kernel_api 1.88; a delayed rule carries no step that reads its event (barrier.set, item.move,
  population.suppress, a co_present or tagged step); a stamped or timed fact is an int fact with no
  maximum and a minimum absent or at most 0. Twin of kernel/ts/src/content/cartridge_delayed.ts.
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3]
  import Loka.Content.Refs, only: [resolve: 4]

  @event_bound ~w(barrier.set item.move population.suppress)

  @doc "Diagnostics for the reactions of `defs` and the policy `trees` (`{rel, steps, root}`)."
  @spec check(map() | nil, map(), list()) :: [map()]
  def check(nil, _, _), do: []

  def check(m, defs, trees) do
    rules = for {_, {rel, [], r}} <- defs["reaction"], do: {rel, r}

    steps =
      for {rel, r} <- rules, {s, i} <- Enum.with_index(r["apply"]), do: {rel, r, s, i}

    stamps = for {rel, _, %{"op" => "fact.stamp"} = s, i} <- steps, do: {rel, ["apply", i], s}
    leaves = Enum.flat_map(trees, fn {rel, path, root} -> timed(rel, path, root) end)

    refused =
      for {rel, %{"after" => _}, s, i} <- steps,
          s["op"] in @event_bound or Map.has_key?(s, "co_present") or Map.has_key?(s, "tag"),
          do: diag("SCHEMA_VIOLATION", at(rel, ["apply", i, "op"]), %{"error" => "invalid_value"})

    used =
      stamps != [] or leaves != [] or Enum.any?(rules, fn {_, r} -> Map.has_key?(r, "after") end)

    Enum.flat_map(stamps ++ leaves, &clock(&1, m, defs)) ++ refused ++ floor(m, used)
  end

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

  # Each time_since leaf of a policy tree, with its path, walked like the TS loader's nodes/1.
  defp timed(rel, path, %{"op" => "time_since"} = n), do: [{rel, path, n}]
  defp timed(rel, path, %{"op" => "not", "item" => x}), do: timed(rel, path ++ ["item"], x)

  defp timed(rel, path, %{"items" => xs}) when is_list(xs),
    do:
      xs
      |> Enum.with_index()
      |> Enum.flat_map(fn {x, i} -> timed(rel, path ++ ["items", i], x) end)

  defp timed(_, _, _), do: []

  defp floor(m, used) do
    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if used and api < [1, 88],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end
end
