defmodule Loka.Content.Food do
  @moduledoc "Checks opted food and recovery metadata."
  import Loka.Content.Source, only: [diag: 3, at: 2]

  def check(nil, _, _), do: []

  def check(m, defs, {_, text}) do
    foods = for {_, {rel, [], %{"edible" => _} = item}} <- defs["item"], do: {rel, item}

    Enum.flat_map(foods, fn {rel, i} -> declaration(rel, i, m, defs, text) end) ++
      for {_, {rel, [], l}} <- defs["liquid"] || %{},
          not restores?(l, m, defs),
          do: diag("SCHEMA_VIOLATION", at(rel, ["resource"]), %{"error" => "invalid_value"})
  end

  defp declaration(rel, i, m, defs, text) do
    e = i["edible"]
    caps = m["requires"]["capabilities"]

    errors =
      if valid?(i, caps) and restores?(e, m, defs) and effect?(e),
        do: [],
        else: [diag("SCHEMA_VIOLATION", at(rel, ["edible"]), %{"error" => "invalid_value"})]

    errors ++ texts(rel, e, text)
  end

  # loka-kgd.209: a consumable does something: a restore, a cure or a status.
  defp effect?(e), do: Enum.any?(~w(resource cures applies), &(e[&1] not in [nil, []]))

  # A restore is an amount of mv, which recovers standing; none at all is valid (loka-kgd.209).
  defp restores?(e, m, defs) do
    case Loka.Content.Refs.resolve(e["resource"], "resource", m, defs) do
      {_, _, r} ->
        is_integer(e["amount"]) and r["key"] == "mv" and is_map(r["regen"]) and
          r["regen"]["by_position"]["standing"] > 0

      _ ->
        not Map.has_key?(e, "resource") and not Map.has_key?(e, "amount")
    end
  end

  defp valid?(i, caps) do
    i["container"] != true and
      not Enum.any?(~w(capacity slot weapon block_chance fuel vessel), &is_map_key(i, &1)) and
      caps["containment"] == 1 and caps["resource"] == 1
  end

  defp texts(_, _, :unknown), do: []

  defp texts(rel, e, text),
    do:
      for(
        f <- ~w(label narration),
        not is_map_key(text, e[f]),
        do: diag("UNRESOLVED_REFERENCE", at(rel, ["edible", f]), %{"target" => e[f]})
      )
end
