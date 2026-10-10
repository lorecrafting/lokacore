defmodule Loka.Content.RecipeTips do
  @moduledoc "Toolbox row W23: a recipe's `tip` and its engine-owned seen_tip_<key> fact (split from Loka.Content.Recipes)."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [owners: 2, owned: 3]

  @doc "Toolbox row W23: the engine-owned fact a recipe's tip sets once it is shown."
  def tip_spec(key),
    do: %{
      "key" => "seen_tip_" <> key,
      "version" => 1,
      "value_type" => %{"type" => "bool", "default" => false},
      "scopes" => ["player"],
      "meaning" => "Recipe #{key}'s tip was shown (action_recipe@1): only that recipe writes it."
    }

  @doc "The facts with each tipped recipe's seen_tip_<key> added; an authored one is RESERVED_FACT."
  def tip_facts({facts, ds}, defs) when is_map(facts) do
    for {key, {_, _, %{"tip" => _}}} <- defs["recipe"],
        String.length(key) <= 55,
        reduce: {facts, ds},
        do: (acc -> reserve(acc, key))
  end

  def tip_facts(skipped, _), do: skipped

  defp reserve({facts, ds}, key) do
    name = "seen_tip_" <> key
    authored = for {rel, steps, _} <- [facts[name]], do: diag("RESERVED_FACT", at(rel, steps))
    {Map.put(facts, name, {"cartridge.json", [], tip_spec(key)}), ds ++ authored}
  end

  @doc """
  A recipe's tip diagnostics: it resolves, needs fact@1 (its fact_changed), kernel_api 1.46
  (`old` when below) and a key that leaves room for seen_tip_ in a 64-character Key.
  """
  def check(rel, %{"tip" => tip} = r, %{m: m, registry: registry, text: text}, old) do
    events = {m["requires"]["capabilities"], owners(registry, ["events"])}
    long = String.length(r["key"]) > 55

    owned(at(rel, ["tip"]), "fact_changed", events) ++
      for(
        {true, d} <- [
          {text != :unknown and not is_map_key(text, tip), :text},
          {long, :key},
          {old, :api}
        ],
        do: tip_diag(rel, tip, d)
      )
  end

  def check(_, _, _, _), do: []

  defp tip_diag(rel, tip, :text),
    do: diag("UNRESOLVED_REFERENCE", at(rel, ["tip"]), %{"target" => tip})

  defp tip_diag(rel, _, :key),
    do: diag("SCHEMA_VIOLATION", at(rel, ["key"]), %{"error" => "invalid_value"})

  defp tip_diag(_, _, :api),
    do: diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")
end
