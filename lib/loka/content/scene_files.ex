# size: allow 415, one line clause per verb, each small, and the nested-set links and overlap; the verbs read together
defmodule Loka.Content.SceneFiles do
  @moduledoc """
  Scene files: `scenes/<key>.scene` (or `dialogues/<key>.scene`) is one dialogue as plain text,
  lowered into the dialogue JSON every other pass reads (docs/system/cartridge.md, Source
  shortcuts; docs/guides/writing-the-game.md, Write a scene). Lines, each trimmed:

      npc: maud            the speaker (first; its role is `maud`)
      when: met_maud       the dialogue's policy: that bool fact is true
      with: bram           a second speaker (an npc role, so bram must be in the room)
      maud: words          the prompt, or under a choice its reply (more lines join with \\n)
      * words              the same, unspoken
      - Take the bowl      a choice, keyed by its words (`take_the_bowl`)
      needs: fact          the current choice shows only while that bool fact is true
      needs: not fact      ... only while it is false
      once                 the current choice goes away once taken (`once`, DialogueOnce lowers it)
      then: key            the current choice's `then`: that dialogue next, or `end`
      gives: bowl          the speaker hands the current choice's taker that item (`receive`,
                           with the item role it needs)
      sets: fact [value]   a fact.assign step on the current choice (value true if left out)
      quest: accept key    the current choice's `accept`
      quest: resolve key   the dialogue's `quest`, so every choice must carry it

  A `- ` deeper than the current choice opens a nested set (SceneLines): its own dialogue,
  `<parent>_<choice>`, linked both ways by `then`.

  `scenes/<key>.cut` is the same idea for a modal scene (CutFiles).

  Words become inline prose markers, so Prose names their text keys. What the format cannot say
  (a keyword, a riddle) stays in the same-key JSON, merged over the scene.
  Lowering only: no runtime reads a scene. Source builds the diagnostics from the bad lines; SceneLines locates the rest.
  """

  alias Loka.Content.SceneLines

  @key_max 64

  @doc """
  The dialogue `text` of file key `key` as its JSON forms (itself first, then one per nested set), with every bad `{line, text, why}` (`why` keys
  Loka.Content.Explain's scene sentences). Bad lines are left out of the form, so the same compile
  still checks the rest of the scene; their own diagnostics fail the build.
  """
  @spec parse(String.t(), String.t()) ::
          {[{String.t(), map()}], [{pos_integer(), String.t(), String.t()} | tuple()]}
  def parse(text, key) do
    {sections, links, walked} = SceneLines.split(text, key)

    {forms, bad} =
      sections
      |> Enum.map_reduce(walked, &section/2)
      |> unresolved(sections, links)
      |> linked(key, links)
      |> visible(sections, links)

    forms = if refused?(bad), do: Enum.map(forms, fn {k, d} -> {k, filled(d)} end), else: forms
    {forms, bad |> Enum.uniq() |> speakerless() |> by_line()}
  end

  # A dialogue with a `quest` takes no `then` (dialogue_links.ex), and nesting needs one.
  defp unresolved({forms, bad}, sections, links) do
    if Enum.any?(links, &(&1.choice != "")) do
      marks =
        for {_, ls} <- sections,
            {"quest: resolve " <> _ = t, n} <- ls,
            do: {n, t, "resolve_nested"}

      kept = Enum.reject(bad, &(elem(&1, 2) == "resolve_not_all"))
      {Enum.map(forms, fn {k, d} -> {k, Map.delete(d, "quest")} end), marks ++ kept}
    else
      {forms, bad}
    end
  end

  defp section({k, lines}, bad) do
    {d, _, own} = Enum.reduce(lines, {%{"choices" => %{}}, nil, []}, &readable/2)
    {d, own} = resolved(d, own)
    {{k, d}, own ++ bad}
  end

  # A nested set is a child dialogue: it opens on the parent choice's reply, the parent choice
  # goes to it, and its choices come back unless they say otherwise. A key that cannot exist
  # keeps its lines checked and is dropped, with the one line that says why.
  defp link(%{choice: ""}, acc), do: acc

  defp link(%{child: child} = l, {forms, bad}) when byte_size(child) > @key_max,
    do: {forms, [{l.n, l.text, "nested_key_long", child} | bad]}

  defp link(%{parent: parent, choice: c, child: child} = l, {forms, bad}) do
    choice = forms[parent]["choices"][c]

    if is_nil(choice) do
      {forms, bad}
    else
      bad =
        if is_map_key(choice, "narration"),
          do: bad,
          else: [{l.n, l.text, "nested_no_reply"} | bad]

      forms =
        forms
        |> put_in([parent, "choices", c, "then"], child)
        |> Map.update!(child, &opened(&1, "dialogue.#{parent}.choices.#{c}.narration", parent))

      {forms, bad}
    end
  end

  defp opened(d, prompt, parent) do
    choices = Map.new(d["choices"], fn {k, o} -> {k, Map.put_new(o, "then", parent)} end)
    %{d | "choices" => choices} |> Map.put("prompt", prompt)
  end

  defp linked({forms, bad}, key, links) do
    Enum.reduce(links, {Map.new(forms), bad}, &link/2) |> comes_back(key, links)
  end

  # A then target never reopens by itself (dialogue@1) and a nested set's choices name the file's
  # dialogue, so its own choices with no then say to come back, as a scene with no nesting does.
  defp comes_back({forms, bad}, key, links) do
    if Enum.any?(links, &(&1.choice != "")) do
      back = Map.new(forms[key]["choices"], fn {c, o} -> {c, Map.put_new(o, "then", key)} end)
      {put_in(forms, [key, "choices"], back), bad}
    else
      {forms, bad}
    end
  end

  # The forms a link reached, file order; a child under a dropped key is dropped with it.
  defp visible({forms, bad}, sections, links) do
    dropped =
      Enum.reduce(links, MapSet.new(), fn l, acc ->
        if l.choice == "" or byte_size(l.child) > @key_max or l.parent in acc,
          do: MapSet.put(acc, l.child),
          else: acc
      end)

    {for({k, _} <- sections, k not in dropped, do: {k, forms[k]}), bad}
  end

  @doc "A child dialogue's loaded path: beside its scene file, for its diagnostics and index only."
  @spec rel(String.t(), String.t()) :: String.t()
  def rel(scene, key), do: Path.join(Path.dirname(scene), key <> ".scene")

  defp by_line(bad), do: Enum.sort_by(bad, &elem(&1, 0))

  # A Latin-1 `npc:` is the one fault: what follows it is not also "before the speaker".
  defp speakerless(bad) do
    if Enum.any?(bad, &match?({_, "npc: " <> _, "not_utf8"}, &1)),
      do: Enum.reject(bad, &(elem(&1, 2) == "no_npc")),
      else: bad
  end

  # The dialogue's `quest` means every choice resolves it, so a partial or mixed form is refused.
  defp resolved(d, bad) do
    {marks, d} = Map.pop(d, :resolves, [])

    cond do
      marks == [] -> {d, bad}
      quest = every_choice(marks, d["choices"]) -> {Map.put(d, "quest", quest), bad}
      true -> {d, for({_, _, n, text} <- marks, do: {n, text, "resolve_not_all"}) ++ bad}
    end
  end

  # The one quest key when each choice carries it exactly once; otherwise nil.
  defp every_choice(marks, choices) do
    carriers = Enum.sort(for {cur, _, _, _} <- marks, do: cur)

    case Enum.uniq(for {_, quest, _, _} <- marks, do: quest) do
      [quest] -> if carriers == Enum.sort(Map.keys(choices)), do: quest
      _ -> nil
    end
  end

  # A bad line's own diagnostic fails the build, so stand-ins for what it left unset only keep the
  # schema check from stopping the pass before a later fault can report.
  # `unreachable` is a warning (Source): the file still lowers as written.
  defp refused?(bad), do: Enum.any?(bad, &(elem(&1, 2) != "unreachable"))

  defp filled(d) do
    choices =
      if d["choices"] == %{}, do: %{"refused" => %{"label" => prose("~")}}, else: d["choices"]

    d
    |> Map.put_new("prompt", prose("~"))
    |> Map.put(
      "choices",
      Map.new(choices, fn {k, c} -> {k, Map.put_new(c, "narration", prose("~"))} end)
    )
  end

  defp readable({text, n} = at, state) do
    if String.valid?(text),
      do: line(at, state),
      else: mark(state, {n, String.replace_invalid(text), "not_utf8"})
  end

  defp mark({d, cur, bad}, fault), do: {d, cur, [fault | bad]}

  defp why("needs" <> _ = text, %{"npc" => _}) when text != "needs", do: verb(text, "bad_needs")
  defp why("needs", %{"npc" => _}), do: "bad_needs"
  defp why("then" <> _ = text, %{"npc" => _}) when text != "then", do: verb(text, "bad_then")
  defp why("then", %{"npc" => _}), do: "bad_then"
  defp why("once" <> _ = text, %{"npc" => _}), do: verb(text, "bad_once")
  defp why("- " <> _, %{"npc" => _}), do: "repeated_choice"
  # Under a choice only the speaker's own name is refused; `refuse/4` takes the rest.
  defp why("gives: " <> _, %{"npc" => _}), do: "gives_speaker"
  defp why("npc: " <> _, %{"npc" => _}), do: "misplaced_header"
  defp why("when: " <> _, %{"npc" => _}), do: "misplaced_header"
  defp why("with: " <> _, %{"npc" => _}), do: "misplaced_header"
  defp why("sets: " <> _, %{"npc" => _}), do: "bad_sets"
  defp why("quest: " <> _, %{"npc" => _}), do: "bad_quest"
  defp why(_, d) when not is_map_key(d, "npc"), do: "no_npc"

  defp why(text, _) do
    if text =~ ~r/^[^\s:]+: /, do: "wrong_speaker", else: "not_a_line"
  end

  # `needs_x: words` is another speaker's line, not a bad `needs`.
  defp verb(text, why) do
    cond do
      text =~ ~r/^(needs|then|once)(:|\s)/ -> why
      text =~ ~r/^[^\s:]+: / -> "wrong_speaker"
      true -> "not_a_line"
    end
  end

  # State: the dialogue so far, the current choice key (nil before the first `- `), bad lines.
  defp line({"npc: " <> npc, _}, {d, nil, bad}) when not is_map_key(d, "npc"),
    do:
      {Map.merge(d, %{"npc" => npc, "roles" => %{npc => %{"role" => "npc", "npc" => npc}}}), nil,
       bad}

  defp line({"when: " <> fact, _}, {%{"npc" => _} = d, nil, bad}),
    do:
      {Map.put(d, "policy", %{"op" => "fact_compare", "fact" => fact, "equals" => true}), nil,
       bad}

  defp line({"with: " <> npc, _} = at, {%{"npc" => _} = d, nil, bad}) do
    if not key?(npc),
      do: refuse(at, d, nil, bad),
      else: {put_in(d, ["roles", npc], %{"role" => "npc", "npc" => npc}), nil, bad}
  end

  defp line({"- " <> label, _} = at, {%{"npc" => _} = d, _, bad}) do
    key = SceneLines.key(label)

    if key == "" or is_map_key(d["choices"], key),
      do: refuse(at, d, :refused, bad),
      else: {put_in(d, ["choices", key], %{"label" => prose(label)}), key, bad}
  end

  defp line({"needs: " <> what, _} = at, {%{"npc" => _}, cur, _} = st) when cur != nil,
    do: only_one(at, "policy", needed(what), st)

  defp line({"then: " <> target, _} = at, {%{"npc" => _}, cur, _} = st) when cur != nil,
    do: only_one(at, "then", if(key?(target), do: target), st)

  defp line({"once", _}, {%{"npc" => _} = d, :refused, bad}), do: {d, :refused, bad}

  defp line({"once", _}, {%{"npc" => _} = d, cur, bad}) when cur != nil,
    do: {put_in(d, ["choices", cur, "once"], true), cur, bad}

  # What follows a refused choice is still checked, and written nowhere.
  defp line({"gives: " <> item, _} = at, {%{"npc" => npc} = d, cur, bad}) when cur != nil do
    cond do
      speaker?(d, item) ->
        refuse(at, d, cur, bad)

      cur == :refused ->
        {d, cur, bad}

      true ->
        {d
         |> put_in(["choices", cur, "receive"], %{"item" => item, "from" => npc})
         |> put_in(["roles", item], %{"role" => "item", "item" => item}), cur, bad}
    end
  end

  defp line({"sets: " <> what, _} = at, {%{"npc" => _} = d, cur, bad}) when cur != nil do
    case assignment(String.split(what)) do
      {fact, value} -> {sets(d, cur, fact, value), cur, bad}
      nil -> refuse(at, d, cur, bad)
    end
  end

  defp line({"quest: " <> what, n} = at, {%{"npc" => _} = d, cur, bad}) when cur != nil do
    words = String.split(what)
    quest(if(key?(List.last(words, "")), do: words, else: []), {at, n}, d, cur, bad)
  end

  defp line({"* " <> words, _}, {%{"npc" => _} = d, cur, bad}),
    do: {said(d, cur, words), cur, bad}

  defp line({said, _} = at, {%{"npc" => _} = d, cur, bad}) do
    with [name, words] <- String.split(said, ": ", parts: 2),
         true <- speaker?(d, name) do
      {said(d, cur, words), cur, bad}
    else
      _ -> refuse(at, d, cur, bad)
    end
  end

  defp line(at, {d, cur, bad}), do: refuse(at, d, cur, bad)

  # A field a choice may hold once: nil is a form that cannot lower.
  defp only_one(at, _, nil, {d, cur, bad}), do: refuse(at, d, cur, bad)
  defp only_one(_, _, _, {_, :refused, _} = st), do: st

  defp only_one(at, field, value, {d, cur, bad}) do
    if is_map_key(d["choices"][cur], field),
      do: refuse(at, d, cur, bad),
      else: {put_in(d, ["choices", cur, field], value), cur, bad}
  end

  # `d` is the dialogue as of this line: a line above `npc:` is out of order, whatever follows.
  defp refuse({"gives: " <> _ = text, n}, %{"npc" => _} = d, nil, bad),
    do: {d, nil, [{n, text, "gives_outside_choice"} | bad]}

  defp refuse({"with: " <> _ = text, n}, %{"npc" => _} = d, nil, bad),
    do: {d, nil, [{n, text, "bad_with"} | bad]}

  defp refuse({"needs" <> _ = text, n}, %{"npc" => _} = d, nil, bad),
    do: {d, nil, [{n, text, outside(text, "needs_outside_choice")} | bad]}

  defp refuse({"then" <> _ = text, n}, %{"npc" => _} = d, nil, bad),
    do: {d, nil, [{n, text, outside(text, "then_outside_choice")} | bad]}

  defp refuse({"once" <> _ = text, n}, %{"npc" => _} = d, nil, bad),
    do: {d, nil, [{n, text, outside(text, "once_outside_choice")} | bad]}

  defp refuse({text, n}, %{"npc" => _} = d, nil, bad)
       when binary_part(text, 0, min(byte_size(text), 6)) in ["sets: ", "quest:"],
       do: {d, nil, [{n, text, "outside_choice"} | bad]}

  defp refuse({text, n}, d, cur, bad), do: {d, cur, [{n, text, why(text, d)} | bad]}

  defp outside(text, why),
    do: if(text =~ ~r/^(needs|then|once)(:|\s|$)/, do: why, else: "not_a_line")

  defp quest([verb, _], _, d, :refused, bad) when verb in ["accept", "resolve"],
    do: {d, :refused, bad}

  # A choice holds one accept, and a mixed form is the compiler's OUTCOME_MISMATCH.
  defp quest(["accept", quest], {at, _}, d, cur, bad) do
    if is_map_key(d["choices"][cur], "accept"),
      do: refuse(at, d, cur, bad),
      else: {put_in(d, ["choices", cur, "accept"], quest), cur, bad}
  end

  defp quest(["resolve", quest], {{text, _}, n}, d, cur, bad) do
    marks = [{cur, quest, n, text} | Map.get(d, :resolves, [])]
    {Map.put(d, :resolves, marks), cur, bad}
  end

  defp quest(_, {at, _}, d, cur, bad), do: refuse(at, d, cur, bad)

  # One bool fact, or its opposite; anything richer stays in the same-key JSON.
  defp needed(what) do
    case String.split(what) do
      ["not", fact] -> if key?(fact), do: %{"op" => "not", "item" => fact_true(fact)}
      [fact] -> if key?(fact), do: fact_true(fact)
      _ -> nil
    end
  end

  defp fact_true(fact), do: %{"op" => "fact_compare", "fact" => fact, "equals" => true}

  defp assignment([fact]), do: assignment(fact, true)
  defp assignment([fact, value]), do: assignment(fact, value(value))
  defp assignment(_), do: nil

  # `007` stays a word here; its schema decides.
  defp assignment(fact, value) do
    if key?(fact) and (not is_binary(value) or value =~ ~r/^[a-z0-9][a-z0-9_.]*$/),
      do: {fact, value}
  end

  defp key?(word), do: word =~ ~r/^[a-z][a-z0-9_.]*$/

  defp speaker?(d, name), do: get_in(d, ["roles", name, "role"]) == "npc"

  defp sets(d, :refused, _, _), do: d

  defp sets(d, cur, fact, value) do
    step = %{"op" => "fact.assign", "fact" => fact, "value" => value}
    update_in(d, ["choices", cur], fn c -> Map.update(c, "steps", [step], &(&1 ++ [step])) end)
  end

  defp value("true"), do: true
  defp value("false"), do: false

  defp value(word) do
    # `007` keeps its spelling: only a number written plainly is a number.
    with {number, ""} <- Integer.parse(word),
         true <- Integer.to_string(number) == word do
      number
    else
      _ -> word
    end
  end

  defp said(d, :refused, _), do: d
  defp said(d, nil, words), do: spoken(d, ["prompt"], words)
  defp said(d, cur, words), do: spoken(d, ["choices", cur, "narration"], words)

  defp spoken(d, path, words) do
    update_in(d, path, fn
      nil -> prose(words)
      %{"prose" => before} -> prose(before <> "\n" <> words)
    end)
  end

  defp prose(words), do: %{"prose" => words}
end
