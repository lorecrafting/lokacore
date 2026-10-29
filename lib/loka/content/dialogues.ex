# size: allow 370, scene-triggered chapter point refs join dialogue trigger checks
defmodule Loka.Content.Dialogues do
  @moduledoc "Compiled dialogue roles, consequences, riddle and chapter trigger checks."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [commands: 0, owners: 2, owned: 3, reference: 6, resolve: 4]

  @doc "Each schema-valid dialogue's policy root, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs),
    do: for({rel, d} <- all(defs), do: {rel, ["policy"], d["policy"]})

  defp all(defs), do: for({_, {rel, [], d}} <- defs["dialogue"], do: {rel, d})

  @doc "Diagnostics for dialogues, story points and chapter settings of a v2 source (else none)."
  @spec check(map() | nil, map(), {term(), map() | :unknown} | nil, {term(), map()}, [map()]) :: [
          map()
        ]
  def check(m, _, v2, _, _) when m == nil or v2 == nil, do: []

  def check(m, defs, {_, text}, {_, settings}, registry) do
    caps = m["requires"]["capabilities"]

    keys =
      for kind <- ~w(action scripted_action quest), {_, {_, [], d}} <- defs[kind], do: d["key"]

    ctx = %{
      m: m,
      defs: defs,
      text: text,
      taken: commands() ++ keys,
      kinds: {caps, owners(registry, ["definitions"])},
      events: {caps, owners(registry, ["events"])},
      proven: Loka.Content.Hub.proven(defs)
    }

    Enum.flat_map(all(defs), &dialogue(&1, ctx)) ++ wide(defs, settings, ctx)
  end

  # The cartridge-wide checks: keywords (G9), story points, chapters.
  defp wide(defs, settings, ctx),
    do:
      Loka.Content.Keywords.check(defs, ctx.events) ++
        story_points(defs, ctx) ++ chapters(Map.get(settings, "chapters", []), ctx)

  # Chapters derive only from unambiguous quest-resolving dialogue choices (mechanics.md).
  defp chapters(chapters, ctx) do
    chapters
    |> Enum.with_index()
    |> Enum.flat_map(fn {chapter, i} ->
      steps = ["chapters", i]

      texts("cartridge.json", [{steps ++ ["name"], chapter["name"]}], ctx.text) ++
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

  # dialogue@1 owns story_point_reached; a choice's dialogue resolves a quest; a scene-reached
  # point's marker fact story_point_<key> fits a Key (key at most 52).
  defp story_points(defs, ctx) do
    for {_, {rel, steps, p}} <- defs["story_point"],
        d <- owned(at(rel, steps), "story_point_reached", ctx.events) ++ outcomes(p, ctx),
        do: d
  end

  defp outcomes(p, ctx) do
    for {_, t} <- p["outcomes"], {true, d} <- [site(t, p["key"], ctx)], do: d
  end

  defp site(%{"scene" => s}, key, ctx) do
    {rel, steps, _} = resolve(s, "scene", ctx.m, ctx.defs)

    {String.length(key) > 52,
     diag("SCHEMA_VIOLATION", at(rel, steps ++ ["on_end", "story_point"]))}
  end

  defp site(%{"dialogue" => r, "choice" => c}, _, ctx) do
    {rel, steps, d} = resolve(r, "dialogue", ctx.m, ctx.defs)

    {not is_map_key(d, "quest"),
     diag("OUTCOME_MISMATCH", at(rel, steps ++ ["choices", c, "story_point"]))}
  end

  @doc """
  Derives the story_point kind (StoryPointDefinition) from each choice's `story_point`
  ("<key>/<outcome>", which leaves the choice) and each scene's `on_end`; a second claim of one
  outcome, in path order, is DUPLICATE_DEFINITION at its site.
  """
  @spec points({map(), [map()]}, map() | nil) :: {map(), [map()]}
  def points({defs, ds}, m) do
    claims = Enum.sort(choice_claims(defs) ++ scene_claims(defs, m))
    {points, dups} = Enum.reduce(claims, {%{}, []}, &claim/2)
    dialogues = Map.new(defs["dialogue"], fn {k, d} -> {k, unclaimed(d)} end)
    {Map.put(%{defs | "dialogue" => dialogues}, "story_point", points), ds ++ dups}
  end

  defp choice_claims(defs) do
    for {k, {rel, steps, %{"choices" => cs}}} <- defs["dialogue"],
        {c, %{"story_point" => sp}} <- cs,
        [p, o] = String.split(sp, "/"),
        do:
          {{rel, steps ++ ["choices", c, "story_point"]}, p, o, %{"dialogue" => k, "choice" => c}}
  end

  defp scene_claims(defs, m) do
    for {k, {rel, steps, %{"on_end" => %{"story_point" => r, "outcome" => o}}}} <- defs["scene"],
        p = local(r, m),
        p != nil,
        do: {{rel, steps ++ ["on_end"]}, p, o, %{"scene" => k}}
  end

  defp claim({{rel, steps} = site, p, o, t}, {points, ds}) do
    {r, s, v} = Map.get(points, p, {rel, steps, %{"key" => p, "outcomes" => %{}}})

    if is_map_key(v["outcomes"], o),
      do: {points, ds ++ [diag("DUPLICATE_DEFINITION", at(site, []))]},
      else: {Map.put(points, p, {r, s, put_in(v, ["outcomes", o], t)}), ds}
  end

  defp local(k, _) when is_binary(k), do: k

  defp local(
         %{"cartridge_id" => id, "cartridge_version" => v, "kind" => "story_point", "key" => k},
         %{
           "id" => id,
           "version" => v
         }
       ),
       do: k

  defp local(_, _), do: nil

  defp unclaimed({rel, steps, %{"choices" => cs} = d}),
    do:
      {rel, steps,
       %{d | "choices" => Map.new(cs, fn {c, o} -> {c, Map.delete(o, "story_point")} end)}}

  defp unclaimed(d), do: d

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

    texts(rel, [{["prompt"], d["prompt"]}, {["name"], d["name"]}], text) ++ bound
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
      Loka.Content.CheckKinds.choice(rel, steps, o, d, ctx) ++
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
