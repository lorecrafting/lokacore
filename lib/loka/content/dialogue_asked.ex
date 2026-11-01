defmodule Loka.Content.DialogueAsked do
  @moduledoc """
  A dialogue choice's source-only `asked`: lowered to the bool fact `<dialogue>_<choice>_asked`, a
  `fact.assign` of it on the choice's steps and `asked_when`, which the view reads. It never blocks the
  choice in play. `asked_when` is not a source field, so nothing authored is overwritten.
  """
  import Loka.Content.Source, only: [diag: 3, at: 2]

  @key_max 64

  @schema %{
    "description" =>
      "The Book dims this choice once taken; it stays usable. Lowered to the fact <dialogue>_<choice>_asked, a step that sets it and asked_when.",
    "type" => "boolean",
    "enum" => [true]
  }

  @doc "A source choice's properties (Source.contracts/0): `asked` in, the compiled `asked_when` out."
  @spec source_fields(map()) :: map()
  def source_fields(props), do: props |> Map.delete("asked_when") |> Map.put("asked", @schema)

  @doc "Reserves each `asked` fact (an @engine_facts module); a fact already of that name is refused."
  @spec facts(term(), map() | nil, map()) :: {term(), [map()]}
  def facts(facts, m, defs) when is_map(facts) and m != nil do
    Enum.reduce(asked(defs), {facts, []}, &reserve/2)
  end

  def facts(facts, _, _), do: {facts, []}

  @doc "Each dialogue with its `asked` choices lowered and the source field gone."
  @spec lower(map()) :: map()
  def lower(defs) do
    dialogues = Map.new(defs["dialogue"], fn {k, d} -> {k, lowered(k, d)} end)
    %{defs | "dialogue" => dialogues}
  end

  defp reserve({k, c, rel, steps, riddle}, {acc, ds}) do
    name = name(k, c)
    site = at(rel, steps ++ ["choices", c, "asked"])
    taken = if is_map_key(acc, name), do: [refused(site, "asked_key_taken", name)], else: []
    long = if byte_size(name) > @key_max, do: [refused(site, "asked_key_long", name)], else: []
    # The Book draws a riddle's answer as letter tiles, with no label to dim.
    tiles = if riddle == c, do: [refused(site, "asked_on_riddle", name)], else: []
    {Map.put(acc, name, {"cartridge.json", [], spec(name, k, c)}), ds ++ taken ++ long ++ tiles}
  end

  defp refused(site, why, name),
    do: diag("SCHEMA_VIOLATION", site, %{"why" => why, "key" => name})

  defp asked(defs) do
    for {k, {rel, steps, %{"choices" => cs} = d}} <- defs["dialogue"],
        {c, %{"asked" => true}} <- cs,
        do: {k, c, rel, steps, get_in(d, ["riddle", "choice_id"])}
  end

  defp lowered(k, {rel, steps, %{"choices" => cs} = d}),
    do: {rel, steps, %{d | "choices" => Map.new(cs, fn {c, o} -> {c, choice(k, c, o)} end)}}

  defp lowered(_, d), do: d

  defp choice(k, c, %{"asked" => true} = o) do
    fact = name(k, c)
    set = %{"op" => "fact.assign", "fact" => fact, "value" => true}

    o
    |> Map.delete("asked")
    |> Map.update("steps", [set], &(&1 ++ [set]))
    |> Map.put("asked_when", %{"op" => "fact_compare", "fact" => fact, "equals" => true})
  end

  defp choice(_, _, o), do: o

  defp name(k, c), do: "#{k}_#{c}_asked"

  defp spec(name, k, c) do
    %{
      "key" => name,
      "version" => 1,
      "value_type" => %{"type" => "bool", "default" => false},
      "scopes" => ["player"],
      "meaning" => "Whether the player has taken choice #{c} of dialogue #{k} (asked)."
    }
  end
end
