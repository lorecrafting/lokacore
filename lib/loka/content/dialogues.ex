defmodule Loka.Content.Dialogues do
  @moduledoc """
  Dialogues in a v2 source (dialogue.schema.json DialogueDefinition; 06 §8, §17, §33), twin of
  `kernel/ts/src/cartridge_dialogues.ts`: each dialogue's owner (dialogue@1) and each
  fact.assign's (fact@1, by its fact_changed) is required; its key is no registered command's,
  action's, recipe's or quest's (DUPLICATE_DEFINITION: its talk is an ActionSet identity); its
  prompt, labels and narrations have catalog entries (unless the catalog was rejected,
  `:unknown`); its speaker, roles and quest name an NPC, item or quest of this cartridge; its
  speaker is one of its npc roles (else UNRESOLVED_REFERENCE at npc); no role is named actor
  (DUPLICATE_DEFINITION); it has a choice (SCHEMA_VIOLATION too_few_items: the subset has no
  minProperties); each accept names a quest of this cartridge, in a dialogue without a quest, on a
  choice without a hand_over (else OUTCOME_MISMATCH: accepting would resolve, or activation and
  acquisition conflict); each hand_over gives an item role to an npc role (else
  UNRESOLVED_REFERENCE); a speaker may have several dialogues;
  each fact.assign names a fact with a value of its type. Its policy tree is checked with every
  other (`conditions/1`, `Loka.Content.Checks`). Each story point (cartridge.schema.json
  StoryPointDefinition; 23 §3) requires dialogue@1 (by its story_point_reached) and has an
  outcome (SCHEMA_VIOLATION too_few_items); each outcome's trigger names a dialogue of this
  cartridge and one of its choices (UNRESOLVED_REFERENCE), a site no other outcome names
  (DUPLICATE_DEFINITION), in a dialogue that resolves a quest, so its choice is made once
  (OUTCOME_MISMATCH). Chapter titles and story-point/outcome references resolve; only the opening
  marker is unconditional, and counted quest/choice triggers are unambiguous (mechanics.md Chapters).
  """
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
      taken: MapSet.new(commands() ++ keys),
      kinds: {caps, owners(registry, ["definitions"])},
      events: {caps, owners(registry, ["events"])}
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
    empty = %{"error" => "too_few_items"}

    none =
      for true <- [p["outcomes"] == %{}],
          do: diag("SCHEMA_VIOLATION", at(rel, ["outcomes"]), empty)

    owned(at(rel, []), "story_point_reached", ctx.events) ++
      none ++
      Enum.flat_map(p["outcomes"], fn {o, t} ->
        trigger(rel, ["outcomes", o], t, sites[t], ctx)
      end)
  end

  # One outcome's trigger: a dialogue of this cartridge with a quest, one of its choices, and a
  # site no other outcome names.
  defp trigger(rel, steps, t, n, ctx) do
    dup = if n > 1, do: [diag("DUPLICATE_DEFINITION", at(rel, steps))], else: []

    dup ++
      reference(rel, steps, "dialogue", t, ctx.m, ctx.defs) ++
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
      texts(rel, [{["prompt"], d["prompt"]}], ctx.text) ++
      refs(rel, d, ctx) ++
      Enum.flat_map(d["choices"], &choice(rel, &1, d, ctx))
  end

  # Its speaker, quest and roles name definitions of this cartridge.
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

  defp choice(rel, {id, o}, d, ctx) do
    steps = ["choices", id]

    texts(
      rel,
      [{steps ++ ["label"], o["label"]}, {steps ++ ["narration"], o["narration"]}],
      ctx.text
    ) ++
      sequence(rel, steps, o, ctx) ++ accept(rel, steps, o, d, ctx) ++ hand_over(rel, steps, o, d)
  end

  defp sequence(rel, steps, o, ctx) do
    Enum.flat_map(Enum.with_index(Map.get(o, "sequence", [])), fn {s, i} ->
      owned(at(rel, steps ++ ["sequence", i, "op"]), "fact_changed", ctx.events) ++
        reference(rel, steps ++ ["sequence", i], "fact", s, ctx.m, ctx.defs)
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

  defp hand_over(rel, steps, %{"hand_over" => h}, %{"roles" => roles}) do
    for {field, kind} <- [{"item", "item"}, {"to", "npc"}],
        not match?(%{"role" => ^kind}, roles[h[field]]),
        do:
          diag("UNRESOLVED_REFERENCE", at(rel, steps ++ ["hand_over", field]), %{
            "target" => h[field]
          })
  end

  defp hand_over(_, _, _, _), do: []

  defp texts(_, _, :unknown), do: []

  defp texts(rel, pairs, text) do
    for {steps, key} <- pairs,
        not is_map_key(text, key),
        do: diag("UNRESOLVED_REFERENCE", at(rel, steps), %{"target" => key})
  end
end
