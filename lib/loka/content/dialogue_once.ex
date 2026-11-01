defmodule Loka.Content.DialogueOnce do
  @moduledoc """
  A dialogue choice's source-only `once`: lowered to the bool fact `<dialogue>_<choice>_done`, a
  `fact.assign` of it on the choice's steps and a policy that needs it unset. Never in the
  artifact, so a lowered choice is what Hub's self-gated check reads.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]

  @key_max 64

  @doc "Reserves each `once` fact (an @engine_facts module): a fact already of that name is RESERVED_FACT at the `once`."
  @spec facts(term(), map() | nil, map()) :: {term(), [map()]}
  def facts(facts, m, defs) when is_map(facts) and m != nil do
    Enum.reduce(onces(defs), {facts, []}, &reserve/2)
  end

  def facts(facts, _, _), do: {facts, []}

  @doc "Each dialogue with its `once` choices lowered and the source field gone."
  @spec lower(map()) :: map()
  def lower(defs) do
    dialogues = Map.new(defs["dialogue"], fn {k, d} -> {k, lowered(k, d)} end)
    %{defs | "dialogue" => dialogues}
  end

  defp reserve({k, c, rel, steps}, {acc, ds}) do
    name = name(k, c)
    site = at(rel, steps ++ ["choices", c, "once"])
    taken = if is_map_key(acc, name), do: [diag("RESERVED_FACT", site)], else: []

    long =
      if byte_size(name) > @key_max,
        do: [diag("SCHEMA_VIOLATION", site, %{"why" => "once_key_long", "key" => name})],
        else: []

    {Map.put(acc, name, {"cartridge.json", [], spec(name, k, c)}), ds ++ taken ++ long}
  end

  defp onces(defs) do
    for {k, {rel, steps, %{"choices" => cs}}} <- defs["dialogue"],
        {c, %{"once" => true}} <- cs,
        do: {k, c, rel, steps}
  end

  defp lowered(k, {rel, steps, %{"choices" => cs} = d}),
    do: {rel, steps, %{d | "choices" => Map.new(cs, fn {c, o} -> {c, choice(k, c, o)} end)}}

  defp lowered(_, d), do: d

  defp choice(k, c, %{"once" => true} = o) do
    fact = name(k, c)
    set = %{"op" => "fact.assign", "fact" => fact, "value" => true}
    gate = %{"op" => "not", "item" => %{"op" => "fact_compare", "fact" => fact, "equals" => true}}

    o
    |> Map.delete("once")
    |> Map.update("steps", [set], &(&1 ++ [set]))
    |> Map.update("policy", gate, &%{"op" => "all", "items" => [&1, gate]})
  end

  defp choice(_, _, o), do: o

  defp name(k, c), do: "#{k}_#{c}_done"

  defp spec(name, k, c) do
    %{
      "key" => name,
      "version" => 1,
      "value_type" => %{"type" => "bool", "default" => false},
      "scopes" => ["player"],
      "meaning" => "Whether the player has taken choice #{c} of dialogue #{k} (once)."
    }
  end
end
