defmodule Loka.Content.Position do
  @moduledoc """
  position@1's engine fact (cartridge.md Compiler; mechanics.md position@1): when the manifest
  requires position, the compiler adds the fact `position` (@engine) and fact@1, whose
  fact_changed its rule's fact.assign logs, and content may read the fact but never write it:
  an authored fact named position, or a fact.assign of it in a scripted action outcome, a reaction's
  apply, dialogue choice or scene ending, is RESERVED_FACT. The same write-site walk also
  reserves scene_<key>, story-point markers, skill_<key> and seen_tip_<key> facts.
  Its engine fact specs match kernel/ts/src/content/cartridge_position.ts.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]

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

  @doc "RESERVED_FACT for content writes to engine-owned facts (row 33: the theft stolen fact too)."
  @spec check(map() | nil, map(), map()) :: [map()]
  # ponytail: one reserved-fact scan; row 33 adds the stolen fact.
  def check(m, defs, settings, extra \\ [])

  # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  def check(m, defs, settings, extra) when m != nil do
    refs =
      reserved_refs(m, defs, extra) ++ List.wrap(get_in(settings, ["world", "theft", "stolen"]))

    dream_refs = Enum.map(dream_names(defs), &Loka.Content.Source.ref(&1, "fact", m))

    for {rel, steps, s} <- sites(defs, extra),
        s["op"] in ["fact.assign", "fact.adjust", "fact.stamp"],
        reserved_write?(s, refs, dream_refs),
        do: diag("RESERVED_FACT", at(rel, steps ++ ["fact"]), %{"field" => fact_name(s["fact"])})
  end

  def check(_, _, _, _), do: []

  defp reserved_write?(s, refs, dream_refs),
    do: s["fact"] in refs or (s["fact"] in dream_refs and s["dream_owned"] != true)

  defp reserved_refs(m, defs, extra) do
    for key <- reserved_names(m, defs) ++ extra, do: ref(m, "fact", key)
  end

  defp ref(m, kind, key),
    do: %{
      "cartridge_id" => m["id"],
      "cartridge_version" => m["version"],
      "kind" => kind,
      "key" => key
    }

  defp reserved_names(m, defs) do
    engine_names(m, defs) ++
      for {_, {_, _, s}} <- defs["service"],
          s["benefit"]["op"] in ~w(deposit withdraw),
          do: s["benefit"]["account"]["key"]
  end

  @doc "Fact keys another engine writer owns; no bank account may be one (toolbox row 25)."
  @spec foreign_names(map(), map()) :: [String.t()]
  def foreign_names(m, defs), do: engine_names(m, defs) ++ dream_names(defs)

  # ponytail: gather reserved names together; split on growth. # credo:disable-for-next-line Credo.Check.Refactor.ABCSize
  defp engine_names(m, defs) do
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
        s["benefit"]["op"] == "entitlement",
        do: s["benefit"]["fact"]["key"]
      ),
      Enum.map(Map.keys(defs["skill"]), &("skill_" <> &1)),
      for({key, {_, _, %{"growth" => _}}} <- defs["skill"], do: "uses_" <> key),
      for({key, {_, _, %{"tip" => _}}} <- defs["scripted_action"], do: "seen_tip_" <> key),
      Loka.Content.Trails.names(defs)
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

  # A step's fact is a bare key before expansion and a full ref after it.
  defp fact_name(%{"key" => key}), do: key
  defp fact_name(key), do: key

  # The rule's key: rel is a file path, a path list, or an area file with its key path.
  defp key_of(%{"key" => key}) when is_binary(key), do: key
  defp key_of({_path, [_, key]}), do: key
  defp key_of({_path, key}) when is_binary(key), do: Path.basename(key, ".json")
  defp key_of(rel) when is_binary(rel), do: Path.basename(rel, ".json")

  defp key_of(rel) when is_list(rel),
    do: rel |> List.last() |> to_string() |> Path.basename(".json")

  # The lowering appends its own steps (one per field) writing this rule's reserved facts. An
  # author's step is anything before them, including a write of another rule's lowered fact, which
  # Position must still refuse.
  defp own_lowering?(key, s, %{"steps" => steps}, reserved) do
    mine = Enum.filter(["#{key}_done", "#{key}_at"], &(&1 in reserved))
    tail = Enum.take(steps, -length(mine))
    mine != [] and s in tail and Enum.all?(tail, &(fact_name(&1["fact"]) in mine))
  end

  defp own_lowering?(_, _, _, _), do: false

  # Each authored step that may fact.assign: {rel, steps to it, step}.
  # A reaction carries the lowering's own `once`/`cooldown` steps; they write the facts the
  # lowering reserved, so they are dropped here and the author's own writes are what remains.
  # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  defp sites(defs, reserved) do
    for kind <- ~w(scripted_action reaction dialogue scene),
        {_, {rel, steps, v}} <- defs[kind],
        {at, list} <- lists(kind, v),
        {s, i} <- Enum.with_index(list),
        not (kind == "reaction" and
               own_lowering?(Map.get(v, "key") || key_of(rel), s, v, reserved)),
        do: {rel, steps ++ at ++ [i], s}
  end

  # Each author's write list: {steps, list}.
  defp lists("scripted_action", r),
    do: for({name, o} <- r["outcomes"], do: {["outcomes", name, "steps"], o["steps"]})

  defp lists("reaction", r), do: [{["steps"], r["steps"]}]

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
    do: for({id, o} <- d["choices"], do: {["choices", id, "steps"], o["steps"] || []})
end
