defmodule Loka.Content.Trails do
  @moduledoc """
  Toolbox row W13 (mechanics.md Tracks and trails; cartridge.md Trail declarations), twin of
  kernel/ts/src/content/cartridge_trails.ts: the engine's trail facts (trail_<plan>_exit and
  trail_<plan>_at for a plan with `trail`, trail_exit and trail_at when some plan `hunts`), an
  authored one RESERVED_FACT; world.trails' leads, a plan's `trail` and `hunts`, a track check's
  plan, fact_changed's owner and the 1.85 floor.
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3]
  import Loka.Content.Refs, only: [owners: 2, owned: 3]

  @exits ~w(none north south east west up down)

  defp exit_spec(name, meaning, scope),
    do: %{
      "key" => name,
      "version" => 1,
      "value_type" => %{"type" => "enum", "values" => @exits, "default" => "none"},
      "scopes" => [scope],
      "per_subject" => true,
      "meaning" =>
        "The exit #{meaning} last left the subject room by (row W13): only trails write it."
    }

  defp at_spec(name, meaning, scope),
    do: %{
      "key" => name,
      "version" => 1,
      "value_type" => %{"type" => "int", "default" => 0, "minimum" => 0},
      "scopes" => [scope],
      "per_subject" => true,
      "meaning" => "When #{meaning} last left the subject room (row W13): only trails write it."
    }

  defp plans(defs),
    do:
      for(
        {key, {rel, steps, p}} <- defs["population"] || %{},
        is_map(p),
        do: {key, rel, steps, p}
      )

  # The reserved {name, spec} pairs, in the loader's order.
  defp specs(defs) do
    planned =
      for {key, _, _, %{"trail" => true}} <- plans(defs),
          byte_size(key) <= 53,
          {name, spec} <- [
            {"trail_#{key}_exit", &exit_spec/3},
            {"trail_#{key}_at", &at_spec/3}
          ],
          do: {name, spec.(name, "plan #{key}", "instance")}

    characters =
      if Enum.any?(plans(defs), &match?({_, _, _, %{"hunts" => true}}, &1)),
        do: [
          {"trail_exit", exit_spec("trail_exit", "a character", "instance")},
          {"trail_at", at_spec("trail_at", "a character", "instance")}
        ],
        else: []

    planned ++ characters
  end

  @doc "The trail fact names the engine owns (Position.engine_names)."
  def names(defs), do: Enum.map(specs(defs), &elem(&1, 0))

  @doc "The facts with each trail fact added; an authored one is RESERVED_FACT."
  def facts(facts, m, defs) when is_map(facts) and m != nil do
    Enum.reduce(specs(defs), {facts, []}, fn {name, spec}, {acc, ds} ->
      authored = for {rel, steps, _} <- [acc[name]], do: diag("RESERVED_FACT", at(rel, steps))
      {Map.put(acc, name, {"cartridge.json", [], spec}), ds ++ authored}
    end)
  end

  def facts(facts, _, _), do: {facts, []}

  @doc "The trail declarations' diagnostics."
  def check(nil, _, _, _, _), do: []

  def check(m, defs, v2, {_, settings}, registry) do
    trails = get_in(settings, ["world", "trails"])

    leads(trails, defs, if(v2, do: elem(v2, 1), else: :unknown)) ++
      Enum.flat_map(plans(defs), &plan(&1, trails, m, registry)) ++
      for(
        {rel, c} <- tracks(defs),
        not trailing?(defs, c["plan"]),
        do: unresolved(at(rel, ["check", "plan"]), c["plan"])
      ) ++
      api_floor(m, trails, defs)
  end

  defp tracks(defs),
    do: for({_, {rel, _, %{"check" => %{"kind" => "track"} = c}}} <- defs["recipe"], do: {rel, c})

  defp api_floor(m, trails, defs) do
    used =
      trails != nil or tracks(defs) != [] or
        Enum.any?(plans(defs), &(field(&1, "trail") or field(&1, "hunts")))

    if used and api(m) < [1, 85],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  defp field({_, _, _, p}, f), do: p[f] == true

  defp trailing?(defs, key),
    do: Enum.any?(plans(defs), &match?({^key, _, _, %{"trail" => true}}, &1))

  defp leads(nil, _, _), do: []

  defp leads(%{"leads" => leads}, defs, text) do
    path = "cartridge.world.trails.leads"
    used = exits(defs)

    texts =
      if text == :unknown,
        do: [],
        else:
          for(
            {d, key} <- Enum.sort(leads),
            not is_map_key(text, key),
            do: unresolved(path <> "." <> d, key)
          )

    texts ++ for d <- @exits, d in used, not is_map_key(leads, d), do: unresolved(path, d)
  end

  defp exits(defs),
    do:
      for(
        {_, {_, _, r}} <- defs["room"],
        is_map(r),
        d <- Map.keys(r["exits"] || %{}),
        into: MapSet.new(),
        do: d
      )

  # A plan's trail/hunts: fact_changed owned, world.trails declared, a trailing key short enough.
  defp plan({_, rel, steps, _} = plan, trails, m, registry) do
    events = {m["requires"]["capabilities"], owners(registry, ["events"])}
    paths = for f <- ~w(trail hunts), field(plan, f), do: at(rel, steps ++ [f])

    Enum.flat_map(paths, &owned(&1, "fact_changed", events)) ++
      if(trails == nil, do: Enum.map(paths, &unresolved(&1, "trails")), else: []) ++ long(plan)
  end

  # The trail facts' names are keys of at most 64 bytes ("trail_" <> key <> "_exit").
  defp long({key, rel, steps, %{"trail" => true}}) when byte_size(key) > 53,
    do: [diag("SCHEMA_VIOLATION", at(rel, steps ++ ["key"]), %{"error" => "invalid_value"})]

  defp long(_), do: []

  defp unresolved(path, target), do: diag("UNRESOLVED_REFERENCE", path, %{"target" => target})

  defp api(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)
end
