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
  @assigns ~w(fact.assign fact.adjust fact.stamp)

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

  # A fact named anywhere other than as a compare's or a plain assignment's subject may be written
  # by a mechanic the cartridge opts into (world.theft, a skill's `learned`, a topic's `fact`, an
  # ancestry's `faction`), so the compare rows stay silent for it. ponytail: conservative, so it
  # under-reports rather than misfiring on the showcase.
  defp other(sites) do
    for {_, m} <- sites,
        f <- for({_, v} <- m, is_binary(v), do: v),
        m["fact"] != f or (m["op"] not in @compares and m["op"] not in @assigns),
        into: MapSet.new(),
        do: f
  end

  # Every positive fact.adjust, with whether its site may run more than once.
  defp adjust(sites, files) do
    for {rel, m} <- sites,
        m["op"] == "fact.adjust",
        f = named(m, "fact"),
        a = m["amount"],
        is_binary(f) and is_integer(a) and a > 0,
        do: {f, a, repeats?(files[rel], rel)}
  end

  defp repeats?(nil, _), do: true

  defp repeats?(v, rel) do
    case LintLabels.parts(rel) do
      ["reactions", _] -> get_in(v, ["on", "event"]) not in @once
      ["quests", _] -> v["repeatable"] == true
      ["scenes", _] -> false
      _ -> true
    end
  end

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
