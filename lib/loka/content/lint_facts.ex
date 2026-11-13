defmodule Loka.Content.LintFacts do
  @moduledoc """
  The fact rows of docs/design/story-tooling.md L1 and L2: a `fact_compare` on a bool or enum
  whose value nothing writes can never hold (the compiler checks the type only, refs.ex:41), a
  threshold the cartridge's once-only writes cannot reach, and a fact with no `meaning`. Each
  finding is one line naming its file.
  """

  alias Loka.Content.{LintLabels, LintSource}

  import LintSource, only: [named: 2]

  # A reaction on one of these runs once per quest or level, so its writes do not accumulate.
  @once ~w(quest_resolved quest_failed quest_activated level_reached)
  @compares ~w(fact_compare fact_at_least)

  @doc "The fact findings: the compare rows over `sites`, and every fact's missing `meaning`."
  @spec run([{String.t(), map()}], %{String.t() => map()}, %{String.t() => map()}) :: [String.t()]
  def run(sites, facts, files) do
    ctx = %{values: values(sites), other: other(sites), adjust: adjust(sites, files)}

    compares(sites, facts, ctx) ++ meanings(facts)
  end

  # A fact's authored values: every map naming it as `fact` and carrying a `value`.
  defp values(sites) do
    for(
      {_, m} <- sites,
      f = m["fact"],
      is_binary(f),
      is_map_key(m, "value"),
      do: {f, m["value"]}
    )
    |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))
  end

  # A mechanic the cartridge opts into writes a fact without any `fact.assign`: a service benefit of
  # op `entitlement`, a spell's `learned`, a topic's `fact`, `world.theft.stolen`/`noticed`, and
  # `world.death_credit[].fact` (cartridge.schema.json, action.schema.json). Those are the only
  # fields that count, so a fact merely mentioned in prose keeps its compare rows.
  @writers ~w(learned stolen noticed)

  defp other(sites) do
    for {_, m} <- sites,
        f <- writer(m),
        into: MapSet.new(),
        do: f
  end

  defp writer(m) do
    keys = for k <- @writers, f = m[k], is_binary(f), do: f
    keys ++ entitlement(m)
  end

  # A service benefit, and the `fact` pairing a `value` beside it; a topic, spell or death credit
  # names a bare `fact` with no op and no value.
  defp entitlement(%{"op" => "entitlement"} = m), do: bare(m)
  defp entitlement(%{"fact" => _} = m) when not is_map_key(m, "op"), do: bare(m)
  defp entitlement(_), do: []

  defp bare(%{"fact" => f}) when is_binary(f), do: [f]
  defp bare(_), do: []

  # Every positive fact.adjust, with whether its site may run more than once.
  defp adjust(sites, files) do
    for {rel, m} <- sites,
        m["op"] == "fact.adjust",
        f = named(m, "fact"),
        a = m["amount"],
        is_binary(f) and is_integer(a) and a > 0,
        do: {f, a, repeats?(files[rel], rel, files)}
  end

  defp repeats?(nil, _, _), do: true

  defp repeats?(v, rel, files) do
    case LintLabels.parts(rel) do
      ["reactions", _] -> repeatable?(get_in(v, ["on"]), files)
      ["quests", _] -> v["repeatable"] == true
      ["scenes", _] -> false
      _ -> true
    end
  end

  # A reaction on a one-shot event runs once; on a quest event it runs once per instance, so a
  # repeatable quest makes it accumulate. Any other event may repeat.
  defp repeatable?(%{"event" => e} = on, files) when e in @once do
    case named(on, "quest") do
      nil -> false
      q -> get_in(files, ["quests/#{q}.json", "repeatable"]) == true
    end
  end

  defp repeatable?(_, _), do: true

  # L1: a fact_compare on a bool or enum whose value nothing writes can never hold. L2a: a bounded
  # int compared against a value the default and the writes that happen once cannot reach.
  defp compares(sites, facts, ctx) do
    for {rel, m} <- sites,
        m["op"] in @compares,
        f = named(m, "fact"),
        is_binary(f),
        line <- compare(rel, m, f, Map.put(ctx, :fact, facts[f])),
        do: line
  end

  defp compare(rel, m, f, %{fact: %{"value_type" => %{"type" => t} = vt}} = ctx)
       when t in ["bool", "enum"] do
    v = m["equals"]

    if v == vt["default"] or f in ctx.other or v in Map.get(ctx.values, f, []),
      do: [],
      else: ["#{rel}: fact_compare #{f} tests #{inspect(v)}; nothing writes that value"]
  end

  defp compare(rel, m, f, %{fact: %{"value_type" => %{"type" => "int"} = vt}} = ctx) do
    t = if m["op"] == "fact_at_least", do: m["at_least"], else: m["equals"]
    reach = (vt["default"] || 0) + once(ctx.adjust, f)

    cond do
      !is_integer(t) or f in ctx.other -> []
      Enum.any?(ctx.adjust, &match?({^f, _, true}, &1)) -> []
      t <= reach or t in Map.get(ctx.values, f, []) -> []
      true -> ["#{rel}: #{m["op"]} #{f} tests #{t}; its one-shot writes reach #{reach}"]
    end
  end

  defp compare(_, _, _, _), do: []

  defp once(adjust, f) do
    adjust |> Enum.filter(&match?({^f, _, false}, &1)) |> Enum.map(&elem(&1, 1)) |> Enum.sum()
  end

  # L2c: one quality, one meaning; the facts table shows it.
  defp meanings(facts) do
    for {k, f} <- Enum.sort(facts),
        is_map(f),
        !is_map_key(f, "meaning"),
        do: "facts.json: facts.#{k} has no meaning"
  end
end
