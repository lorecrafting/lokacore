defmodule Loka.Content.LintStory do
  @moduledoc """
  Story-logic lint for `Loka.Content.Lint`: docs/design/story-tooling.md rows L1 and L2 that read
  the story graph — a quest nothing resolves, a story point outcome nothing consumes, a scene only
  its own chain starts, a `fact_changed` reaction cycle with no `when` to break it, a shadowed
  ambient set, and a talk whose every choice is gated. Each finding is one line naming its file.
  """

  alias Loka.Content.{LintFacts, LintSource}

  import LintSource, only: [walk: 1, units: 2, named: 2]

  @doc "The story-graph findings for decoded source files, keyed by their path in the cartridge."
  @spec run(%{String.t() => map()}) :: [String.t()]
  def run(files) do
    claims = claims(files)

    Enum.concat([
      quests(files),
      points(claims, consumed(files)),
      starts(files, live(files), MapSet.new(claims, &elem(&1, 0))),
      cycles(files),
      LintFacts.run(sites(files), in_facts(files), files),
      ambients(files),
      fallbacks(files)
    ])
  end

  defp sites(files) do
    for {rel, v} <- Enum.sort(files), rel != "facts.json", m <- walk(v), do: {rel, m}
  end

  defp in_facts(files), do: get_in(files, ["facts.json", "facts"]) || %{}

  # L1, story map S6: a quest no `quest.resolve` or `quest.fail` step names, with no deadline,
  # which would fail the quest by itself (protocol/step.schema.json, quest_failed).
  defp quests(files) do
    done =
      for {_, v} <- Enum.sort(files),
          m <- walk(v),
          m["op"] in ~w(quest.resolve quest.fail),
          k = named(m, "quest"),
          into: MapSet.new(),
          do: k

    for {k, rel, q} <- units(files, "quests"),
        k not in done,
        is_map_key(q, "objective"),
        !is_map_key(q, "deadline"),
        do: "#{rel}: nothing resolves or fails this quest; add a quest.resolve step or a deadline"
  end

  # A story point is authored nowhere: Dialogues.points/2 derives it from each choice's
  # "<point>/<outcome>" and each scene's `on_end`, so those are its only claims.
  defp claims(files) do
    ends =
      for {_, rel, s} <- units(files, "scenes"),
          e = s["on_end"],
          is_map(e),
          p = named(e, "story_point"),
          o = e["outcome"],
          is_binary(p) and is_binary(o),
          do: {{p, o}, rel}

    choices(files) ++ ends
  end

  defp choices(files) do
    for {_, rel, d} <- units(files, "dialogues"),
        {_, m} <- d["choices"] || %{},
        sp = m["story_point"],
        is_binary(sp),
        [p, o] = String.split(sp, "/"),
        do: {{p, o}, rel}
  end

  # A site that starts on, watches or opens a chapter at a story point outcome. Naming the point
  # with no outcome consumes all of them: chapter and reaction say outcome optional.
  defp consumed(files) do
    MapSet.new(starts_on(files) ++ watches(files) ++ chapters(files))
  end

  defp watches(files) do
    for {rel, v} <- Enum.sort(files),
        rel != "cartridge.json",
        m <- walk(v),
        m["event"] == "story_point_reached",
        p = named(m, "story_point"),
        is_binary(p),
        do: {p, m["outcome"]}
  end

  defp chapters(files) do
    for c <- get_in(files, ["cartridge.json", "chapters"]) || [],
        p = named(c, "story_point"),
        is_binary(p),
        do: {p, c["outcome"]}
  end

  defp starts_on(files) do
    for {_, _, s} <- units(files, "scenes"), po = started(s), po, do: po
  end

  defp points(claims, consumed) do
    for {{p, o}, rel} <- claims,
        {p, o} not in consumed,
        {p, nil} not in consumed,
        do: "#{rel}: story point #{p} outcome #{o}; nothing consumes it"
  end

  # An outcome fires when a choice claims it (a talk is the player's) or when a scene that starts
  # on a live outcome, or on no story point, ends on it; that closes over the scene chain.
  defp live(files) do
    scenes = units(files, "scenes")

    seen =
      for {_, _, d} <- units(files, "dialogues"),
          {_, m} <- d["choices"] || %{},
          sp = m["story_point"],
          is_binary(sp),
          [p, o] = String.split(sp, "/"),
          into: MapSet.new(),
          do: {p, o}

    seed = for {_, _, s} <- scenes, started(s) == nil, q = ended(s), q, into: seen, do: q

    step(seed, scenes)
  end

  defp step(seen, scenes) do
    more =
      for {_, _, s} <- scenes,
          po = started(s),
          q = ended(s),
          q && q not in seen,
          (po && po in seen) || po == nil,
          uniq: true,
          do: q

    if more == [], do: seen, else: step(Enum.into(more, seen), scenes)
  end

  defp started(%{"on" => on}) when is_map(on) do
    with p when is_binary(p) <- named(on, "story_point"), do: {p, on["outcome"]}
  end

  defp started(_), do: nil

  defp ended(%{"on_end" => e}) when is_map(e) do
    with p when is_binary(p) <- named(e, "story_point"), do: {p, e["outcome"]}
  end

  defp ended(_), do: nil

  # S6: a scene whose `on` names an outcome only scenes started by that same chain claim. An
  # outcome nothing claims at all is UNRESOLVED_REFERENCE in the compiler (scenes.ex, outcome/6).
  defp starts(files, reach, claimed) do
    for {_, rel, s} <- units(files, "scenes"),
        po = started(s),
        po in claimed and po not in reach,
        do:
          "#{rel}: on.story_point #{elem(po, 0)}/#{elem(po, 1)} is claimed only by scenes it starts"
  end

  # S6: a cycle of reactions on `fact_changed` that write each other's fact with no `when` on any
  # of them, so the cycle never rests.
  defp cycles(files) do
    nodes = cycle_nodes(files)
    cycle = for {k, _} <- nodes, k in reach(k, nodes), into: MapSet.new(), do: k

    for k <- Enum.sort(cycle), members = members(k, cycle, nodes), k == hd(members) do
      "#{nodes[k].rel}: fact_changed cycle, no when to break it: #{Enum.join(members, ", ")}"
    end
  end

  defp members(k, cycle, nodes) do
    Enum.filter(Enum.sort(cycle), &(&1 in reach(k, nodes) and k in reach(&1, nodes)))
  end

  defp cycle_nodes(files) do
    for {k, rel, r} <- units(files, "reactions"),
        on = r["on"],
        is_map(on) and on["event"] == "fact_changed",
        f = named(on, "fact"),
        is_binary(f),
        !is_map_key(r, "when"),
        into: %{},
        do: {k, %{rel: rel, reads: f, writes: writes(r)}}
  end

  # A reaction on `fact` runs after anything that writes it, so its successors are the reactions
  # that write the fact it watches.
  defp reach(start, nodes), do: grow(successors(start, nodes), successors(start, nodes), nodes)

  defp grow(seen, batch, _) when batch == [], do: seen

  defp grow(seen, batch, nodes) do
    more = for k <- batch, k2 <- successors(k, nodes), k2 not in seen, uniq: true, do: k2
    grow(seen ++ more, more, nodes)
  end

  defp successors(k, nodes) do
    for {k2, n} <- nodes, n.reads in nodes[k].writes, do: k2
  end

  defp writes(r) do
    for m <- walk(r["steps"] || []), f = named(m, "fact"), is_binary(f), do: f
  end

  # L1: an ambient set after one with no `when`, or whose terms are a subset of its own, never
  # shows: the first set whose `when` holds is the active one (entity.schema.json AmbientSet).
  # Unlike a variant, a lone set with no `when` is the normal case, so only the later one is
  # reported.
  defp ambients(files) do
    for {rel, v} <- Enum.sort(files),
        is_map(v),
        sets = v["ambient"],
        is_list(sets),
        f <- shadowed(rel, sets),
        do: f
  end

  defp shadowed(rel, sets) do
    indexed = Enum.with_index(sets)

    for {a, i} <- indexed,
        {b, j} <- indexed,
        i < j,
        Enum.all?(conds(a), &(&1 in conds(b))),
        do: "#{rel}: ambient[#{j}] is shadowed by ambient[#{i}]"
  end

  defp conds(%{"when" => %{"op" => "all", "items" => items}}), do: items
  defp conds(%{"when" => w}), do: [w]
  defp conds(_), do: []

  # L2b: a talk that opens with nothing to pick (BioWare's unconditioned last line).
  defp fallbacks(files) do
    for {_, rel, d} <- units(files, "dialogues"),
        cs = d["choices"],
        is_map(cs),
        map_size(cs) > 1,
        Enum.all?(cs, fn {_, c} -> is_map_key(c, "policy") or is_map_key(c, "availability") end),
        do: "#{rel}: every choice is gated; add one with no policy and no availability"
  end
end
