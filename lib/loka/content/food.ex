defmodule Loka.Content.Food do
  @moduledoc "Checks opted food and recovery metadata."
  import Loka.Content.Source, only: [diag: 3, at: 2]

  def check(nil, _, _), do: []
  def check(_, _, nil), do: []

  def check(m, defs, {_, text}) do
    foods = for {_, {rel, [], %{"edible" => _} = item}} <- defs["item"], do: {rel, item}

    Enum.flat_map(foods, fn {rel, i} -> declaration(rel, i, m, defs, text) end)
  end

  defp declaration(rel, i, m, defs, text) do
    e = i["edible"]

    resource =
      case Loka.Content.Refs.resolve(e["resource"], "resource", m, defs) do
        {_, _, r} -> r
        _ -> %{}
      end

    errors =
      if valid?(i, resource, m["requires"]["capabilities"]),
        do: [],
        else: [diag("SCHEMA_VIOLATION", at(rel, ["edible"]), %{"error" => "invalid_value"})]

    errors ++ texts(rel, e, text)
  end

  defp valid?(i, resource, caps) do
    resource["key"] == "mv" and is_map(resource["regen"]) and
      resource["regen"]["by_position"]["standing"] > 0 and i["container"] != true and
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
