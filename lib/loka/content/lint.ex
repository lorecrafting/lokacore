defmodule Loka.Content.Lint do
  @moduledoc """
  Author-time lints for a story cartridge's source (pass-1 analysis rows 1, 3, 5, 6 and 7, with fill sources, plus the label rules: no final period on a
  choice or action label, lowercase status labels;
  docs/CHECKS.md). Each finding is one line naming the file and key. The loader never runs
  these: a sampler may break them on purpose.
  """

  alias Loka.Content.Source

  @writes ~w(status.apply status.cure fact.assign fact.adjust fact.stamp)
  @always %{"op" => "all", "items" => []}

  @doc "The findings for the source directory `dir`."
  @spec run(Path.t()) :: [String.t()]
  def run(dir), do: dir |> decoded() |> findings()

  @doc "Only the label findings for the source directory `dir` (samplers are checked for these too)."
  @spec labels(Path.t()) :: [String.t()]
  def labels(dir), do: dir |> decoded() |> then(&labels(&1, Map.get(&1, "text.json", %{})))

  defp decoded(dir) do
    {files, _} = Source.load(dir)

    # A missing folder or the parent cartridges folder loads no manifest and would lint clean.
    if !Enum.any?(files, &match?({"cartridge.json", _, %{}}, &1)),
      do: raise(ArgumentError, "#{dir}: no cartridge.json loaded; give a cartridge source folder")

    Map.new(for {rel, _, value} <- files, is_map(value), do: {rel, value})
  end

  @doc "The findings for decoded source files, keyed by their path relative to the cartridge."
  @spec findings(%{String.t() => map()}) :: [String.t()]
  def findings(files) do
    text = Map.get(files, "text.json", %{})

    files
    |> Enum.sort()
    |> Enum.flat_map(fn {rel, v} -> file(Path.split(rel), rel, v) end)
    |> Kernel.++(talk(files, text))
    |> Kernel.++(labels(files, text))
    |> Kernel.++(items(files))
    |> Kernel.++(fills(files))
  end

  defp file(["recipes", _], rel, %{"policy" => %{"root" => root}} = r)
       when root != @always and not is_map_key(r, "reason"),
       do: ["#{rel}: policy refuses with no reason"]

  defp file(["reactions", _], rel, %{"apply" => steps} = r) do
    ops = Enum.map(steps, & &1["op"])

    if Enum.any?(ops, &(&1 in @writes)) and "narrate" not in ops and r["silent"] != true,
      do: ["#{rel}: writes state with no narrate step and no \"silent\": true"],
      else: []
  end

  defp file(["rooms", _], rel, room) do
    titles =
      for {key, %{"readable" => r}} <- Enum.sort(room["details"] || %{}),
          !is_map_key(r, "title"),
          do: "#{rel}: readable details.#{key} has no title"

    details =
      for {key, d} <- Enum.sort(room["details"] || %{}),
          f <- shadowed("#{rel} details.#{key}", d["variants"] || []),
          do: f

    titles ++ shadowed(rel, room["variants"] || []) ++ details
  end

  defp file(["resources.json"], rel, %{"resources" => rs}),
    do: for({key, %{"bands" => b}} <- Enum.sort(rs), top(b), do: "#{rel}: #{key} bands #{top(b)}")

  defp file(["cartridge.json"], rel, %{"world" => %{"bands" => b}}),
    do: if(top(b), do: ["#{rel}: world.bands #{top(b)}"], else: [])

  defp file(_, _, _), do: []

  # The kernel draws the first band whose cut the percentage reaches, so a lone normal cut at 100
  # shows any value below the maximum in the next band's colour (pass-1 UK).
  defp top([_ | _] = bands) do
    if match?(%{"tone" => "normal"}, Enum.find(bands, &(&1["at_percent"] < 100))),
      do: nil,
      else: "have no normal band below 100%"
  end

  defp top(_), do: nil

  # First match wins, so an earlier variant whose guard terms (an all-guard's items, else the
  # guard itself) are a subset of a later one's always wins over it. ponytail: terms compare by
  # equality, so equivalent but differently written guards pass; a guard evaluator is the upgrade.
  defp shadowed(rel, variants) do
    indexed = Enum.with_index(variants)

    for({v, i} <- indexed, !is_map_key(v, "when"), do: "#{rel}: variants[#{i}] has no when") ++
      for {a, i} <- indexed,
          {b, j} <- indexed,
          i < j,
          Enum.all?(conds(a), &(&1 in conds(b))),
          do: "#{rel}: variants[#{j}] is shadowed by variants[#{i}]"
  end

  defp conds(%{"when" => %{"root" => %{"op" => "all", "items" => items}}}), do: items
  defp conds(%{"when" => %{"root" => root}}), do: [root]
  # No guard always wins; the missing `when` itself is reported.
  defp conds(_), do: []

  # Row 7 (M8c): an item nothing places, stocks, drops or yields never enters play; one nothing
  # eats, consumes, buys back, takes in escrow or asks for never leaves it. Read by field: an id
  # named elsewhere (a guard, a key) is neither.
  defp items(files) do
    refs = Enum.flat_map(files, fn {rel, v} -> refs(Path.split(rel), v) end)

    for {"items/" <> name, _} <- Enum.sort(files),
        id = Path.rootname(name),
        {kind, text} <- [source: "nothing puts it in play", sink: "nothing takes it out of play"],
        {kind, id} not in refs,
        do: "items/#{name}: #{text}"
  end

  defp refs(["items", name], i) do
    id = Path.rootname(name)
    in_play = i["location"]["in"] != "template"
    for {kind, true} <- [source: in_play, sink: is_map_key(i, "edible")], do: {kind, id}
  end

  defp refs(["replenish", _], r), do: tag(:source, r["items"])

  defp refs(["recipes", _], %{"craft" => c}),
    do: tag(:source, c["yield"]["items"]) ++ tag(:sink, c["consume"]["items"])

  defp refs(["npcs", _], n) do
    offers = get_in(n, ["shop", "offers"]) || []
    drops = for d <- n["drops"] || [], do: d["item"]

    # Every offer sells (ShopOffer.sell is required), and the kernel buys back any stocked instance.
    stock = Enum.flat_map(offers, &[&1["item"] | &1["stock"]["items"] || []])
    tag(:source, drops ++ stock) ++ tag(:sink, stock)
  end

  defp refs(["population_bundles", _], b), do: tag(:source, [b["item"], b["corpse"]])

  defp refs(["cartridge.json"], %{"world" => %{"death" => d}}),
    do: tag(:source, [d["player_corpse"], d["npc_corpse"]])

  defp refs(["services", _], %{"benefit" => %{"escrow" => e}}),
    do: tag(:sink, e["items"]) ++ tag(:source, [e["output"]])

  defp refs(["dialogues", _], d),
    do: tag(:sink, for({_, %{"hand_over" => h}} <- d["choices"] || %{}, do: h["item"]))

  defp refs(_, _), do: []

  defp tag(kind, ids), do: for(id <- List.wrap(ids), do: {kind, id})

  # Row 7 fill sources (M8c): a liquid a use or drink service wants needs a vessel that starts
  # with it or a room detail that gives it; a fuel supply a lamp burns only ever drains, so it
  # must start above 0.
  defp fills(files) do
    have = MapSet.new(scan(files, &filled/2))

    for {want, users} <-
          Enum.sort(Enum.group_by(scan(files, &wants/2), &elem(&1, 0), &elem(&1, 1))),
        want not in have,
        do: fill_line(want, users |> Enum.uniq() |> Enum.sort() |> Enum.join(", "))
  end

  defp scan(files, fun), do: Enum.flat_map(files, fn {rel, v} -> fun.(Path.split(rel), v) end)

  defp fill_line({:liquid, id}, users),
    do: "liquids/#{id}.json: #{users} want it; no vessel starts with it and no detail gives it"

  defp fill_line({:fuel, id}, users),
    do: "items/#{id}.json: #{users} burn it; it starts empty and nothing fills it"

  defp filled(["items", _], %{"vessel" => %{"initial" => %{"kind" => k, "quantity" => q}}})
       when q > 0,
       do: [{:liquid, k}]

  defp filled(["items", name], %{"fuel" => %{"kind" => "supply", "initial" => n}}) when n > 0,
    do: [{:fuel, Path.rootname(name)}]

  defp filled(["rooms", _], r),
    do: for({_, %{"liquid_source" => k}} <- r["details"] || %{}, do: {:liquid, k})

  defp filled(_, _), do: []

  defp wants(["recipes", name], %{"target" => %{"tool" => %{"liquid" => l}}}),
    do: [{{:liquid, l}, Path.rootname(name)}]

  defp wants(["services", _], %{"benefit" => %{"kind" => "drink", "liquid" => l, "vessel" => v}}),
    do: [{{:liquid, l}, v}]

  defp wants(["items", name], %{"fuel" => %{"kind" => "source", "supply" => s}}),
    do: [{{:fuel, s}, Path.rootname(name)}]

  defp wants(_, _), do: []

  # A dialogue with no label of its own is offered as the kernel's default action.talk (UH);
  # a keyword dialogue (speech@1) is spoken, not offered.
  defp talk(files, text) do
    bare? =
      Enum.any?(files, fn {rel, d} ->
        String.starts_with?(rel, "dialogues/") and !is_map_key(d, "label") and
          !is_map_key(d, "keyword")
      end)

    if bare? and text["action.talk"] in [nil, ""],
      do: ["text.json: action.talk has no text, yet a dialogue has no label of its own"],
      else: []
  end

  # A choice or action label is a bare imperative: no single final "." unless it opens with a quote
  # mark (a spoken line). A status label is authored lowercase; condition.bleeding keeps its capital
  # (the kernel keys on it). book-ui.md: NPC dialogue and action details, Conditions details.
  defp labels(files, text) do
    for(
      {rel, d} <- Enum.sort(files),
      {kind, key} <- label_keys(Path.split(rel), d),
      s = text[key],
      is_binary(s),
      msg = label_problem(kind, key, s),
      do: "#{rel}: label #{key} #{msg}"
    ) ++ exits(files, text)
  end

  # The page's own Leave control ends a talk, so a do-nothing Leave or Close choice is refused
  # on a talk with more than one choice; a single-choice talk keeps it (book-ui.md NPC
  # dialogue; loka-x6t.21).
  defp exits(files, text) do
    for {"dialogues/" <> _ = rel, %{"choices" => %{} = cs}} <- Enum.sort(files),
        map_size(cs) > 1,
        {key, c} <- Enum.sort(cs),
        Map.keys(c) -- ["label", "narration"] == [],
        s = text[c["label"]],
        is_binary(s) and s =~ ~r/^(Leave|Close)\b/,
        do: "#{rel}: choice #{key} only leaves; the page's own Leave control ends the talk"
  end

  defp label_keys(["dialogues", _], d),
    do:
      Enum.map(
        [d["label"] | for({_, c} <- Enum.sort(d["choices"] || %{}), do: c["label"])],
        &{:choice, &1}
      )

  defp label_keys(["actions", _], d), do: [{:choice, d["label"]}]
  defp label_keys(["statuses", _], d), do: [{:status, d["label"]}]
  defp label_keys(_, _), do: []

  defp label_problem(:choice, _, s),
    do:
      if(s =~ ~r/[^.]\.$/ and not String.starts_with?(s, ["\"", "“", "‘"]),
        do: "ends in a period"
      )

  defp label_problem(:status, key, s),
    do: if(key != "condition.bleeding" and s != String.downcase(s), do: "is not lowercase")
end
