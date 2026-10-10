defmodule Loka.Content.Position do
  @moduledoc """
  position@1's engine fact (cartridge.md Compiler; mechanics.md position@1): when the manifest
  requires position, the compiler adds the fact `position` (@engine) and fact@1, whose
  fact_changed its rule's fact.assign logs, and content may read the fact but never write it:
  an authored fact named position, or a fact.assign of it in a recipe outcome, a reaction's
  apply, dialogue choice or scene ending, is RESERVED_FACT. The same write-site walk also
  reserves scene_<key>, story-point markers and skill_<key> facts.
  Twin of kernel/ts/src/content/cartridge_position.ts.
  """
  import Loka.Content.Source, only: [diag: 2, at: 2]

  @engine %{
    "key" => "position",
    "version" => 1,
    "value_type" => %{
      "type" => "enum",
      "values" => ["standing", "sitting", "resting", "sleeping"],
      "default" => "standing"
    },
    "scopes" => ["player"],
    "meaning" => "The character's position (position@1): only its rule writes it."
  }

  @doc "`facts` with the engine fact under position@1, and RESERVED_FACT for an authored one."
  @spec facts(map() | :unknown, map() | nil) :: {map() | :unknown, [map()]}
  def facts(facts, m) when is_map(facts) and m != nil do
    if required?(m) do
      authored =
        for {rel, steps, _} <- [facts["position"]], do: diag("RESERVED_FACT", at(rel, steps))

      {Map.put(facts, "position", {"cartridge.json", [], @engine}), authored}
    else
      {facts, []}
    end
  end

  def facts(facts, _), do: {facts, []}

  @doc "RESERVED_FACT for content writes to engine-owned facts."
  @spec check(map() | nil, map()) :: [map()]
  def check(m, defs) when m != nil do
    refs = reserved_refs(m, defs)
    dream_refs = Enum.map(dream_names(defs), &Loka.Content.Source.ref(&1, "fact", m))

    for {rel, steps, s} <- sites(defs),
        s["op"] in ["fact.assign", "fact.adjust"],
        reserved_write?(s, refs, dream_refs),
        do: diag("RESERVED_FACT", at(rel, steps ++ ["fact"]))
  end

  def check(_, _), do: []

  defp reserved_write?(s, refs, dream_refs),
    do: s["fact"] in refs or (s["fact"] in dream_refs and s["dream_owned"] != true)

  defp reserved_refs(m, defs) do
    for key <- reserved_names(m, defs),
        do: %{
          "cartridge_id" => m["id"],
          "cartridge_version" => m["version"],
          "kind" => "fact",
          "key" => key
        }
  end

  # ponytail: gather reserved names together; split on growth. # credo:disable-for-next-line Credo.Check.Refactor.ABCSize
  defp reserved_names(m, defs) do
    keys = if required?(m), do: ["position"], else: []

    scenes =
      if is_map_key(m["requires"]["capabilities"], "scene"),
        do: Enum.map(Map.keys(defs["scene"]), &("scene_" <> &1)),
        else: []

    markers =
      for {key, {_, _, %{"outcomes" => outcomes}}} <- defs["story_point"],
          Enum.any?(outcomes, fn {_, t} -> is_map_key(t, "scene") end),
          do: "story_point_" <> key

    patrols =
      for {_, {_, _, q}} <- defs["quest"], q["patrol"], do: q["patrol"]["trust_fact"]["key"]

    Enum.concat([
      keys,
      scenes,
      markers,
      patrols,
      for(
        {_, {_, _, s}} <- defs["service"],
        s["benefit"]["kind"] == "entitlement",
        do: s["benefit"]["fact"]["key"]
      ),
      Enum.map(Map.keys(defs["skill"]), &("skill_" <> &1)),
      for({key, {_, _, %{"growth" => _}}} <- defs["skill"], do: "uses_" <> key)
    ])
  end

  defp dream_names(defs) do
    for {_, {_, _, s}} <- defs["scene"],
        s["control"] == "presentation_only",
        r <- [s["on"]["rest"]["credit"] | Enum.map(s["on_end"]["assign"], & &1["fact"])],
        do: r["key"]
  end

  @doc "The manifest with fact@1 required under position@1, else unchanged."
  @spec requires(map()) :: map()
  def requires(m) do
    if required?(m),
      do: update_in(m, ["requires", "capabilities"], &Map.put(&1, "fact", 1)),
      else: m
  end

  defp required?(m), do: Map.has_key?(m["requires"]["capabilities"], "position")

  # Each authored step that may fact.assign: {rel, steps to it, step}.
  defp sites(defs) do
    for kind <- ~w(recipe reaction dialogue scene),
        {_, {rel, steps, v}} <- defs[kind],
        {at, list} <- lists(kind, v),
        {s, i} <- Enum.with_index(list),
        do: {rel, steps ++ at ++ [i], s}
  end

  # Each author's write list: {steps, list}.
  defp lists("recipe", r),
    do: for({name, o} <- r["outcomes"], do: {["outcomes", name, "sequence"], o["sequence"]})

  defp lists("reaction", r), do: [{["apply"], r["apply"]}]

  defp lists("scene", s),
    do: [
      {["on_end", "assign"],
       Enum.map(
         get_in(s, ["on_end", "assign"]) || [],
         &Map.merge(&1, %{
           "op" => "fact.assign",
           "dream_owned" => s["control"] == "presentation_only"
         })
       )}
    ]

  defp lists("dialogue", d),
    do: for({id, o} <- d["choices"], do: {["choices", id, "sequence"], o["sequence"] || []})
end
