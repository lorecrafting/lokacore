# size: allow 370, scene-triggered chapter point refs join dialogue trigger checks
defmodule Loka.Content.Dialogues do
  @moduledoc "Compiled dialogue roles, consequences, riddle and chapter trigger checks."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [commands: 0, owners: 2, owned: 3, reference: 6, resolve: 4]

  @doc "Each schema-valid dialogue's policy root, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs),
    do: for({rel, d} <- all(defs), do: {rel, ["policy", "root"], d["policy"]["root"]})

  defp all(defs), do: for({_, {rel, [], d}} <- defs["dialogue"], do: {rel, d})

  @doc "Diagnostics for dialogues, story points and chapter settings of a v2 source (else none)."
  @spec check(map() | nil, map(), {term(), map() | :unknown} | nil, {term(), map()}, [map()]) :: [
          map()
        ]
  def check(m, _, v2, _, _) when m == nil or v2 == nil, do: []

  def check(m, defs, {_, text}, {_, settings}, registry) do
    caps = m["requires"]["capabilities"]
    keys = for kind <- ~w(action recipe quest), {_, {_, [], d}} <- defs[kind], do: d["key"]

    ctx = %{
      m: m,
      defs: defs,
      text: text,
      taken: commands() ++ keys,
      kinds: {caps, owners(registry, ["definitions"])},
      events: {caps, owners(registry, ["events"])},
      proven: Loka.Content.Hub.proven(defs)
    }

    Enum.flat_map(all(defs), &dialogue(&1, ctx)) ++
      story_points(defs, ctx) ++
      chapters(Map.get(settings, "chapters", []), ctx)
  end

  # Chapters derive only from unambiguous quest-resolving dialogue choices (mechanics.md).
  defp chapters(chapters, ctx) do
    chapters
    |> Enum.with_index()
    |> Enum.flat_map(fn {chapter, i} ->
      steps = ["chapters", i]

      texts("cartridge.json", [{steps ++ ["title"], chapter["title"]}], ctx.text) ++
        chapter(chapter, i, steps, ctx)
    end)
  end

  defp chapter(c, 0, steps, _) do
    for field <- ~w(story_point outcome),
        is_map_key(c, field),
        do: diag("UNKNOWN_FIELD", at("cartridge.json", steps ++ [field]))
  end

  defp chapter(c, _, steps, ctx) do
    if is_map_key(c, "story_point") do
      reference("cartridge.json", steps, "story_point", c, ctx.m, ctx.defs) ++
        case resolve(c["story_point"], "story_point", ctx.m, ctx.defs) do
          {_, _, p} -> chapter_outcomes(c, p["outcomes"], steps, ctx)
          _ -> []
        end
    else
      [
        diag("SCHEMA_VIOLATION", at("cartridge.json", steps ++ ["story_point"]), %{
          "error" => "missing_property"
        })
      ]
    end
  end

  defp chapter_outcomes(c, outcomes, steps, ctx) do
    if is_map_key(c, "outcome") and not is_map_key(outcomes, c["outcome"]) do
      [
        diag("UNRESOLVED_REFERENCE", at("cartridge.json", steps ++ ["outcome"]), %{
          "target" => c["outcome"]
        })
      ]
    else
      counted =
        if is_map_key(c, "outcome"), do: [outcomes[c["outcome"]]], else: Map.values(outcomes)

      if Enum.any?(counted, &ambiguous?(&1, ctx)),
        do: [diag("OUTCOME_MISMATCH", at("cartridge.json", steps ++ ["story_point"]))],
        else: []
    end
  end

  defp ambiguous?(t, ctx) do
    if is_map_key(t, "scene"), do: false, else: dialogue_ambiguous?(t, ctx)
  end

  defp dialogue_ambiguous?(t, ctx) do
    case resolve(t["dialogue"], "dialogue", ctx.m, ctx.defs) do
      {rel, _, %{"quest" => quest}} ->
        Enum.any?(all(ctx.defs), fn {other, d} ->
          other != rel and d["quest"] == quest and is_map_key(d["choices"], t["choice"])
        end)

      _ ->
        false
    end
  end

  defp story_points(defs, ctx) do
    points = for {_, {rel, [], p}} <- defs["story_point"], do: {rel, p}
    sites = Enum.frequencies(for {_, p} <- points, {_, t} <- p["outcomes"], do: t)
    Enum.flat_map(points, &story_point(&1, sites, ctx))
  end

  defp story_point({rel, p}, sites, ctx) do
    owned(at(rel, []), "story_point_reached", ctx.events) ++
      point_empty(rel, p) ++
      point_key(rel, p) ++
      Enum.flat_map(p["outcomes"], fn {o, t} ->
        trigger(rel, ["outcomes", o], t, sites[t], ctx, {p["key"], o})
      end)
  end

  defp point_empty(rel, p) do
    if p["outcomes"] == %{},
      do: [diag("SCHEMA_VIOLATION", at(rel, ["outcomes"]), %{"error" => "too_few_items"})],
      else: []
  end

  defp point_key(rel, p) do
    if String.length(p["key"]) > 52 and
         Enum.any?(p["outcomes"], fn {_, t} -> is_map_key(t, "scene") end),
       do: [diag("SCHEMA_VIOLATION", at(rel, ["key"]))],
       else: []
  end

  # One outcome's trigger: a dialogue of this cartridge with a quest, one of its choices, and a
  # site no other outcome names.
  defp trigger(rel, steps, %{"scene" => _} = t, n, ctx, {point, outcome}) do
    dup = if n > 1, do: [diag("DUPLICATE_DEFINITION", at(rel, steps))], else: []

    shape =
      if is_map_key(t, "choice") or is_map_key(t, "dialogue"),
        do: [diag("SCHEMA_VIOLATION", at(rel, steps))],
        else: []

    match = scene_match(rel, steps, t, ctx, point, outcome)

    dup ++ shape ++ reference(rel, steps, "scene", t, ctx.m, ctx.defs) ++ match
  end

  defp trigger(rel, steps, t, n, ctx, _) do
    dup = if n > 1, do: [diag("DUPLICATE_DEFINITION", at(rel, steps))], else: []

    shape =
      if not is_map_key(t, "choice"), do: [diag("SCHEMA_VIOLATION", at(rel, steps))], else: []

    dup ++
      shape ++
      reference(rel, steps, "dialogue", t, ctx.m, ctx.defs) ++ dialogue_match(rel, steps, t, ctx)
  end

  defp scene_match(rel, steps, t, ctx, point, outcome) do
    case resolve(t["scene"], "scene", ctx.m, ctx.defs) do
      {_, _, s} ->
        expected = %{
          "cartridge_id" => ctx.m["id"],
          "cartridge_version" => ctx.m["version"],
          "kind" => "story_point",
          "key" => point
        }

        if get_in(s, ["on_end", "story_point"]) == expected and
             get_in(s, ["on_end", "outcome"]) == outcome,
           do: [],
           else: [diag("OUTCOME_MISMATCH", at(rel, steps))]

      _ ->
        []
    end
  end

  defp dialogue_match(rel, steps, t, ctx) do
    case resolve(t["dialogue"], "dialogue", ctx.m, ctx.defs) do
      {_, _, d} ->
        for {true, diag} <- [
              {not is_map_key(d["choices"], t["choice"]),
               diag("UNRESOLVED_REFERENCE", at(rel, steps ++ ["choice"]), %{
                 "target" => t["choice"]
               })},
              {not is_map_key(d, "quest"), diag("OUTCOME_MISMATCH", at(rel, steps))}
            ],
            do: diag

      _ ->
        []
    end
  end

  defp dialogue({rel, d}, ctx) do
    owned(at(rel, []), "dialogue", ctx.kinds) ++
      own(rel, d, ctx) ++
      metadata(rel, d, ctx.text) ++
      riddle(rel, d, ctx) ++
      refs(rel, d, ctx) ++
      Enum.flat_map(d["choices"], &choice(rel, &1, d, ctx))
  end

  defp metadata(rel, d, text) do
    bound =
      if get_in(d, ["riddle", "wrong_limit"]) != nil and d["quest"] == nil,
        do: [diag("OUTCOME_MISMATCH", at(rel, ["riddle", "wrong_limit"]))],
        else: []

    texts(rel, [{["prompt"], d["prompt"]}, {["label"], d["label"]}], text) ++ bound
  end

  defp riddle(rel, %{"riddle" => r, "choices" => choices}, ctx) do
    letters = r["answer"] |> String.upcase() |> String.graphemes()

    texts(rel, [{["riddle", "wrong"], r["wrong"]}], ctx.text) ++
      for {true, diagnostic} <- [
            {not is_map_key(choices, r["choice_id"]),
             diag("UNRESOLVED_REFERENCE", at(rel, ["riddle", "choice_id"]), %{
               "target" => r["choice_id"]
             })},
            {letters -- r["bank"] != [], diag("OUTCOME_MISMATCH", at(rel, ["riddle", "bank"]))}
          ],
          do: diagnostic
  end

  defp riddle(_, _, _), do: []

  defp refs(rel, d, ctx) do
    for(f <- ~w(npc quest), is_map_key(d, f), do: reference(rel, [], f, d, ctx.m, ctx.defs))
    |> Enum.concat()
    |> Enum.concat(Enum.flat_map(d["roles"], &role(rel, &1, ctx)))
  end

  # The dialogue's own checks: its key, its speaker among its npc roles, at least one choice.
  defp own(rel, d, ctx) do
    n = d["npc"]
    target = "#{n["cartridge_id"]}@#{n["cartridge_version"]}:#{n["kind"]}/#{n["key"]}"
    empty = %{"error" => "too_few_items"}

    for {true, diag} <- [
          {d["key"] in ctx.taken, diag("DUPLICATE_DEFINITION", at(rel, []))},
          {%{"role" => "npc", "npc" => n} not in Map.values(d["roles"]),
           diag("UNRESOLVED_REFERENCE", at(rel, ["npc"]), %{"target" => target})},
          {d["choices"] == %{}, diag("SCHEMA_VIOLATION", at(rel, ["choices"]), empty)}
        ],
        do: diag
  end

  defp role(rel, {name, %{"role" => kind} = r}, ctx) do
    actor =
      if name == "actor",
        do: [diag("DUPLICATE_DEFINITION", at(rel, ["roles", "actor"]))],
        else: []

    actor ++ reference(rel, ["roles", name], kind, r, ctx.m, ctx.defs)
  end

  # ponytail: retain ordered choice diagnostics; split on growth. # credo:disable-for-next-line Credo.Check.Refactor.ABCSize
  defp choice(rel, {id, o}, d, ctx) do
    steps = ["choices", id]

    texts(
      rel,
      [{steps ++ ["label"], o["label"]}, {steps ++ ["narration"], o["narration"]}],
      ctx.text
    ) ++
      sequence(rel, steps, o, ctx) ++
      accept(rel, steps, o, d, ctx) ++
      Loka.Content.Patrol.choice(rel, steps, o, d, ctx) ++
      Loka.Content.Escort.choice(rel, steps, o, d, ctx) ++
      hand_over(rel, steps, o, d) ++
      receive_item(rel, steps, o, d, ctx) ++
      payment(rel, steps, o, d, ctx) ++
      Loka.Content.Skills.choice(rel, steps, o, d, ctx) ++
      Loka.Content.Hub.choice(rel, steps, o, d, ctx.proven)
  end

  defp sequence(rel, steps, o, ctx) do
    Enum.flat_map(Enum.with_index(Map.get(o, "sequence", [])), fn {s, i} ->
      if(s["op"] in ["skill.acquire", "topic.grant"],
        do: [],
        else:
          owned(at(rel, steps ++ ["sequence", i, "op"]), "fact_changed", ctx.events) ++
            reference(rel, steps ++ ["sequence", i], "fact", s, ctx.m, ctx.defs) ++
            adjusted(rel, steps ++ ["sequence", i], s, ctx)
      )
    end)
  end

  # A choice's accept: a quest of this cartridge, in a dialogue that resolves none (accepting
  # would resolve it), on a choice without a hand_over (activation and acquisition conflict).
  defp accept(rel, steps, %{"accept" => _} = o, d, ctx) do
    reference(rel, steps, {"accept", "quest"}, o, ctx.m, ctx.defs) ++
      for {true, field} <- [
            {is_map_key(d, "quest"), "accept"},
            {is_map_key(o, "hand_over"), "hand_over"}
          ],
          do: diag("OUTCOME_MISMATCH", at(rel, steps ++ [field]))
  end

  defp accept(_, _, _, _, _), do: []

  defp hand_over(rel, steps, %{"hand_over" => h}, %{"roles" => roles}),
    do: transfer_roles(rel, steps ++ ["hand_over"], h, roles, "to")

  defp hand_over(_, _, _, _), do: []

  defp receive_item(rel, steps, %{"receive" => h} = o, d, ctx) do
    steps = steps ++ ["receive"]

    owned(at(rel, steps), "item_acquired", ctx.events) ++
      transfer_roles(rel, steps, h, d["roles"], "from") ++
      if is_map_key(o, "hand_over"),
        do: [diag("OUTCOME_MISMATCH", at(rel, steps))],
        else: []
  end

  defp receive_item(_, _, _, _, _), do: []

  defp payment(rel, steps, %{"payment" => p}, d, ctx) do
    reference(rel, steps ++ ["payment"], {"resource", "resource"}, p, ctx.m, ctx.defs) ++
      if match?(%{"role" => "npc"}, d["roles"][p["from"]]),
        do: [],
        else: [
          diag("UNRESOLVED_REFERENCE", at(rel, steps ++ ["payment", "from"]), %{
            "target" => p["from"]
          })
        ]
  end

  defp payment(_, _, _, _, _), do: []

  defp transfer_roles(rel, steps, h, roles, recipient) do
    for {field, kind} <- [{"item", "item"}, {recipient, "npc"}],
        not match?(%{"role" => ^kind}, roles[h[field]]),
        do: diag("UNRESOLVED_REFERENCE", at(rel, steps ++ [field]), %{"target" => h[field]})
  end

  defp adjusted(rel, steps, %{"op" => "fact.adjust"} = s, ctx) do
    case resolve(s["fact"], "fact", ctx.m, ctx.defs) do
      {_, _, %{"value_type" => %{"type" => "int", "minimum" => _, "maximum" => _}}} -> []
      {_, _, _} -> [diag("FACT_TYPE_MISMATCH", at(rel, steps ++ ["fact"]))]
      _ -> []
    end
  end

  defp adjusted(_, _, _, _), do: []

  defp texts(_, _, :unknown), do: []

  defp texts(rel, pairs, text) do
    for {steps, key} <- pairs,
        key != nil,
        not is_map_key(text, key),
        do: diag("UNRESOLVED_REFERENCE", at(rel, steps), %{"target" => key})
  end
end
