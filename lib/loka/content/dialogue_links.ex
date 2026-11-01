defmodule Loka.Content.DialogueLinks do
  @moduledoc "A dialogue choice's policy and narration variants as roots, and its then and then_failed checks."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [resolve: 4]

  @doc "A dialogue's own, choice and narration variant conditions, as `{rel, steps, root}`."
  @spec conditions({String.t(), map()}) :: [{String.t(), list(), map()}]
  def conditions({rel, d}) do
    choices =
      for {c, o} <- d["choices"],
          {path, root} <- [{["policy"], o["policy"]} | variants(o)],
          root,
          do: {rel, ["choices", c | path], root}

    [{rel, ["policy"], d["policy"]} | choices]
  end

  defp variants(o) do
    for {v, i} <- Enum.with_index(Map.get(o, "narration_variants", [])),
        do: {["narration_variants", i, "when"], v["when"]}
  end

  @doc "A choice's narration variant and narrate step words, as `{steps, key}`."
  @spec variant_texts(list(), map()) :: [{list(), String.t()}]
  def variant_texts(steps, o) do
    words(steps, o, "narration_variants", "description", fn _ -> true end) ++
      words(steps, o, "steps", "text", &(&1["op"] == "narrate"))
  end

  defp words(steps, o, field, name, keep) do
    for {v, i} <- Enum.with_index(Map.get(o, field, [])),
        keep.(v),
        key = v[name],
        do: {steps ++ [field, i, name], key}
  end

  # A choice's then and then_failed: a dialogue, or `end`. A patrol leg or a quest's or riddle's
  # end closes the conversation, a keyword dialogue is reached by its word, and then_failed needs
  # a check that can fail. A target whose speaker stands elsewhere is allowed (a warning): the
  # proposal's farewell closes the talk as soon as it opens (dialogue@1).
  @spec choice(String.t(), list(), map(), map(), map()) :: [map()]
  def choice(rel, steps, o, d, ctx) do
    orphan =
      if is_map_key(o, "then_failed") and not is_map_key(o, "check"),
        do: [diag("OUTCOME_MISMATCH", at(rel, steps ++ ["then_failed"]))],
        else: []

    orphan ++
      for(
        field <- ~w(then then_failed),
        is_map_key(o, field),
        e <- link(rel, steps ++ [field], o[field], o, d, ctx),
        do: e
      )
  end

  # Talk enters a loop with no way in at its most-linking member (selection.ts), so every chain
  # has an entry and plays; a member whose speaker has no entry of their own is only reached through it: a warning.
  @doc "The members of a then loop whose speaker Talk only reaches through the loop, as warnings."
  @spec loops([{String.t(), map()}]) :: [map()]
  def loops(all) do
    {sorted, next} = graph(all)
    # a keyword dialogue is spoken, so it is no way for Talk to reach its speaker
    speakers = for({_, d} <- entries(sorted, next), !d["keyword"], do: d["npc"]) |> MapSet.new()

    sorted
    |> Enum.filter(&unreachable?(elem(&1, 1), speakers, next))
    |> Enum.map(
      &(diag("LOOP_SPEAKER", at(elem(&1, 0), ["npc"]))
        |> Map.put("severity", "warning"))
    )
  end

  # fall_through.ts GATES: what a choice can refuse or charge when taken.
  @gates ~w(accept availability check escort exchange hand_over lesson_payment patrol payment receive)
  # fall_through.ts FREE_STEPS: the steps that take nothing from the player.
  @free_steps ~w(narrate topic.grant fact.assign)

  @doc "The `entry` marker's refusals, and a warning wherever Talk's entry is a guess or a dialogue is shut out."
  @spec entry_checks([{String.t(), map()}]) :: [map()]
  def entry_checks(all) do
    {sorted, next} = graph(all)
    open = entries(sorted, next)

    live_keys = for {_, d} <- live(sorted), do: d["key"]

    refused(sorted) ++
      guessed(open, next, live_keys) ++ fall_through(open, sorted) ++ unused(sorted, open, next)
  end

  defp unused(sorted, open, next) do
    played = walk(for({_, d} <- open, do: d["key"]), next, MapSet.new())

    for {rel, d} <- sorted -- live(sorted), d["key"] not in played do
      warning("ENTRY_UNUSED", rel, ["npc"], d)
    end
  end

  defp graph(all) do
    sorted = Enum.sort_by(all, &elem(&1, 1)["key"])
    {sorted, Map.new(sorted, fn {_, d} -> {d["key"], links(d)} end)}
  end

  defp refused(sorted) do
    marked = Enum.filter(sorted, &elem(&1, 1)["entry"])

    for {rel, d} <- marked,
        d["keyword"] || Enum.count(marked, &(elem(&1, 1)["npc"] == d["npc"])) > 1 do
      diag("ENTRY_INVALID", at(rel, ["entry"]))
    end
  end

  # A guess: a loop member tying another for most links, or a dialogue with no condition before another of
  # its speaker's in key order, which that other never gets past. A name makes its own Talk control.
  # As selection.ts `width`: every link counts for the ranking, one into a shut-out dialogue too, but
  # only a dialogue that can open ties.
  defp guessed(open, next, live_keys) do
    talked = Enum.reject(open, fn {_, d} -> d["entry"] || d["keyword"] end)
    looped = Enum.filter(talked, fn {_, d} -> loop_tie?(d["key"], next, live_keys) end)

    for {rel, d} <- Enum.uniq(looped ++ tied(talked)) do
      warning("ENTRY_GUESSED", rel, ["npc"], d)
    end
  end

  # fall_through.ts `onward`: a default Talk whose entries all fail opens the first dialogue of their speaker
  # that a free choice leads to, in key order, the entries pooled. More than one is a guess; the warning
  # names that pick, on the speaker's first shut entry.
  defp fall_through(open, sorted) do
    by_key = Map.new(sorted, fn {_, d} -> {d["key"], d} end)
    seen = for {_, d} <- open, do: d["key"]

    for [{rel, _} | _] = group <- shut_groups(open),
        first <- guess(Enum.map(group, &elem(&1, 1)), by_key, seen) do
      warning("ENTRY_GUESSED", rel, ["npc"], %{"key" => first})
    end
  end

  # The entries of each speaker that Talk can fall through from, in key order.
  defp shut_groups(open) do
    shut = for {_, d} = e <- open, d["policy"], !d["name"], !d["keyword"], do: e
    shut |> Enum.group_by(fn {_, d} -> d["npc"] end) |> Map.values()
  end

  # Down a line of shut dialogues to the first with more than one way on: `[its pick]`, or `[]`.
  # `seen` (entries and shut dialogues passed) are tried already, as `tried.includes` in `spokenBy`.
  defp guess(shut, by_key, seen) do
    case free_links(shut, by_key, seen) do
      [first, _ | _] ->
        [first]

      [only] ->
        if by_key[only]["policy"], do: guess([by_key[only]], by_key, [only | seen]), else: []

      [] ->
        []
    end
  end

  defp free_links(shut, by_key, seen) do
    for(
      d <- shut,
      {_, c} <- Enum.sort(d["choices"]),
      free?(c),
      c["then"] not in seen,
      by_key[c["then"]]["npc"] == d["npc"],
      do: c["then"]
    )
    |> Enum.uniq()
  end

  defp free?(c) do
    not Enum.any?(@gates, &c[&1]) and Enum.all?(c["steps"] || [], &(&1["op"] in @free_steps))
  end

  defp loop_tie?(k, next, live_keys) do
    k_width = elem(rank(k, next), 0)

    Enum.any?(walk(Map.get(next, k, []), next, MapSet.new()), fn o ->
      o != k and o in live_keys and k in walk(next[o], next, MapSet.new()) and
        elem(rank(o, next), 0) == k_width
    end)
  end

  defp tied(talked) do
    talked
    |> Enum.group_by(fn {_, d} -> d["npc"] end)
    |> Enum.flat_map(fn {_, group} ->
      group
      |> Enum.reverse()
      |> Enum.drop_while(fn {_, d} -> d["name"] end)
      |> Enum.drop(1)
      |> Enum.reverse()
      |> Enum.reject(fn {_, d} -> d["policy"] end)
      |> Enum.take(1)
    end)
  end

  defp warning(code, rel, path, d) do
    diag(code, at(rel, path), %{"target" => d["key"]}) |> Map.put("severity", "warning")
  end

  defp unreachable?(d, speakers, next) do
    d["npc"] not in speakers and d["key"] in walk(next[d["key"]], next, MapSet.new())
  end

  # selection.ts entries: the dialogues nothing links to or marked `entry`, then the head of each
  # loop with no way in: the member leading to the most other dialogues, first by key on a tie.
  # A shut-out dialogue never opens, so it is no way into what it links to.
  defp entries(sorted, next) do
    live = for {_, d} <- live(sorted), do: d
    roots = roots(live, next)
    reached = walk(roots, next, MapSet.new())
    rest = for d <- live, d["key"] not in reached, do: d["key"]
    wanted = MapSet.new(roots ++ heads(rest, next))
    for {_, d} = e <- sorted, d["key"] in wanted, do: e
  end

  defp roots(live, next) do
    named = next |> Map.values() |> List.flatten() |> MapSet.new()
    for d <- live, d["entry"] || d["key"] not in named, do: d["key"]
  end

  # A speaker's marked dialogue shuts out their others, keyword ones aside.
  defp live(sorted) do
    claimed = for {_, d} <- sorted, d["entry"], into: MapSet.new(), do: d["npc"]
    Enum.filter(sorted, fn {_, d} -> d["entry"] || d["keyword"] || d["npc"] not in claimed end)
  end

  defp heads(rest, next) do
    from = Map.new(rest, &{&1, walk([&1], next, MapSet.new())})

    Enum.filter(rest, fn k ->
      Enum.all?(rest, fn o ->
        o == k or k not in from[o] or (o in from[k] and rank(k, next) < rank(o, next))
      end)
    end)
  end

  defp rank(k, next) do
    {-(next[k] |> Enum.filter(&(&1 != k and is_map_key(next, &1))) |> Enum.uniq() |> length()), k}
  end

  defp links(d) do
    for {_, c} <- d["choices"], f <- ~w(then then_failed), k = c[f], do: k
  end

  defp walk(keys, next, seen) do
    Enum.reduce(keys, seen, fn k, acc ->
      if k in acc, do: acc, else: walk(Map.get(next, k, []), next, MapSet.put(acc, k))
    end)
  end

  defp unlinkable?(t, o, d) do
    Enum.any?([t["keyword"], t["quest"], t["riddle"], o["patrol"], d["quest"], d["riddle"]])
  end

  defp link(rel, path, target, o, d, ctx) do
    found = Enum.find(for({_, {_, [], t}} <- ctx.defs["dialogue"], do: t), &(&1["key"] == target))

    case {target, found} do
      {"end", nil} ->
        []

      {"end", _} ->
        [diag("OUTCOME_MISMATCH", at(rel, path))]

      {_, nil} ->
        [diag("UNRESOLVED_REFERENCE", at(rel, path), %{"target" => target})]

      {_, t} ->
        if unlinkable?(t, o, d),
          do: [diag("OUTCOME_MISMATCH", at(rel, path))],
          else: elsewhere(rel, path, t, d, ctx)
    end
  end

  defp elsewhere(rel, path, t, d, ctx) do
    with {_, _, from} <- resolve(d["npc"], "npc", ctx.m, ctx.defs),
         {_, _, to} <- resolve(t["npc"], "npc", ctx.m, ctx.defs),
         true <- from["room"] != to["room"] do
      [diag("SPEAKER_ELSEWHERE", at(rel, path)) |> Map.put("severity", "warning")]
    else
      _ -> []
    end
  end
end
