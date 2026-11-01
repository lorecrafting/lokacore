# size: allow 340, one line clause per verb; each is small, and the verbs read together
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
      gives: bowl          the speaker hands the current choice's taker that item (`receive`,
                           with the item role it needs)
      sets: fact [value]   a fact.assign step on the current choice (value true if left out)
      quest: accept key    the current choice's `accept`
      quest: resolve key   the dialogue's `quest`, so every choice must carry it

  `scenes/<key>.cut` is the same idea for a modal scene (CutFiles).

  Words become inline prose markers, so Prose names their text keys. What the format cannot say
  (a keyword, a riddle) stays in the same-key JSON, merged over the scene.
  Lowering only: no runtime reads a scene. Source builds the diagnostics from the bad lines; lines/1 locates the rest.
  """

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}

  @doc """
  The dialogue `text` as its JSON form, with every bad `{line, text, why}` (`why` keys
  Loka.Content.Explain's scene sentences). Bad lines are left out of the form, so the same compile
  still checks the rest of the scene; their own diagnostics fail the build.
  """
  @spec parse(String.t()) :: {map(), [{pos_integer(), String.t(), String.t()}]}
  def parse(text) do
    {dialogue, _, bad} =
      Enum.reduce(lines(text, :trimmed), {%{"choices" => %{}}, nil, []}, &readable/2)

    {dialogue, bad} = resolved(dialogue, bad)
    {if(bad == [], do: dialogue, else: filled(dialogue)), bad |> speakerless() |> by_line()}
  end

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
      do: known(at, state),
      else: mark(state, {n, String.replace_invalid(text), "not_utf8"})
  end

  defp known({text, n} = at, {d, _, bad} = state) do
    cond do
      # What a nested choice holds has no choice to go on.
      text =~ ~r/^\s/ -> {d, :refused, [{n, String.trim(text), "not_yet"} | bad]}
      text =~ ~r/^(needs|once|then)(:|$)/ -> mark(state, {n, text, "not_yet"})
      true -> line(at, state)
    end
  end

  defp mark({d, cur, bad}, fault), do: {d, cur, [fault | bad]}

  @doc "Where each part of the lowered dialogue was written: `{steps, line}` (error locations)."
  @spec lines(String.t()) :: [{[String.t()], pos_integer()}]
  def lines(text) do
    {found, _} = Enum.flat_map_reduce(lines(text, :trimmed), {nil, 0}, &located/2)

    # A repeated part keeps its first line.
    Enum.uniq_by(found, &elem(&1, 0))
  end

  # State: the current choice and how many `sets:` it has so far (each is its own step).
  defp located({"npc: " <> _, n}, at), do: {[{["npc"], n}, {["roles"], n}], at}
  defp located({"when: " <> _, n}, at), do: {[{["policy"], n}], at}
  defp located({"with: " <> npc, n}, at), do: {[{["roles", npc], n}], at}
  defp located({"- " <> label, n}, _), do: {[{["choices", key(label)], n}], {key(label), 0}}

  defp located({"gives: " <> item, n}, {cur, _} = at) when cur != nil,
    do: {[{["choices", cur, "receive"], n}, {["roles", item], n}], at}

  defp located({"sets: " <> what, n}, {cur, i}) when cur != nil do
    # A refused `sets:` lowers to no step, so it takes no index.
    if length(String.split(what)) in 1..2,
      do: {[{["choices", cur, "steps", i], n}], {cur, i + 1}},
      else: {[{["prompt"], n}], {cur, i}}
  end

  defp located({"quest: accept " <> _, n}, {cur, _} = at) when cur != nil,
    do: {[{["choices", cur, "accept"], n}], at}

  defp located({"quest: resolve " <> _, n}, {cur, _} = at) when cur != nil,
    do: {[{["quest"], n}], at}

  defp located({_, n}, {nil, _} = at), do: {[{["prompt"], n}], at}
  defp located({_, n}, {cur, _} = at), do: {[{["choices", cur, "narration"], n}], at}

  # A `- ` indented past the first choice keeps its indent: it is nested, not a next choice.
  defp lines(text, :trimmed) do
    raw = String.split(text, "\n")
    base = raw |> Enum.find_value(&choice_indent/1)

    raw
    |> Enum.map(fn line ->
      indent = choice_indent(line)
      if indent && indent > base, do: line, else: String.trim(line)
    end)
    |> Enum.with_index(1)
    |> Enum.reject(&match?({"", _}, &1))
  end

  defp choice_indent(line) do
    trimmed = String.trim_leading(line)
    if String.starts_with?(trimmed, "- "), do: byte_size(line) - byte_size(trimmed)
  end

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

  defp key(label),
    do: label |> String.downcase() |> String.replace(~r/[^a-z0-9]+/, "_") |> String.trim("_")

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
    key = key(label)

    if key == "" or is_map_key(d["choices"], key),
      do: refuse(at, d, :refused, bad),
      else: {put_in(d, ["choices", key], %{"label" => prose(label)}), key, bad}
  end

  # What follows a refused choice is still checked, and written nowhere.
  defp line({"gives: " <> item, _} = at, {%{"npc" => npc} = d, cur, bad}) when cur != nil do
    cond do
      speaker?(d, item) ->
        refuse(at, d, cur, bad)

      cur == :refused ->
        {put_in(d, ["roles", item], %{"role" => "item", "item" => item}), cur, bad}

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

  # `d` is the dialogue as of this line: a line above `npc:` is out of order, whatever follows.
  defp refuse({"gives: " <> _ = text, n}, %{"npc" => _} = d, nil, bad),
    do: {d, nil, [{n, text, "gives_outside_choice"} | bad]}

  defp refuse({"with: " <> _ = text, n}, %{"npc" => _} = d, nil, bad),
    do: {d, nil, [{n, text, "bad_with"} | bad]}

  defp refuse({text, n}, %{"npc" => _} = d, nil, bad)
       when binary_part(text, 0, min(byte_size(text), 6)) in ["sets: ", "quest:"],
       do: {d, nil, [{n, text, "outside_choice"} | bad]}

  defp refuse({text, n}, d, cur, bad), do: {d, cur, [{n, text, why(text, d)} | bad]}

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

  @doc "Each scene entry (rel `*.scene` or `*.cut`) with its same-key JSON file merged over it, as one entry."
  @spec merge([entry()]) :: [entry()]
  def merge(files) do
    {scenes, rest} =
      Enum.split_with(files, fn {rel, _, _} -> String.ends_with?(rel, [".scene", ".cut"]) end)

    Enum.reduce(scenes, rest, fn {rel, id, value}, acc ->
      case List.keytake(acc, id, 1) do
        {{_, _, json}, acc} -> acc ++ [{rel, id, deep(value, json)}]
        nil -> acc ++ [{rel, id, value}]
      end
    end)
  end

  # An `:invalid` JSON side (its own diagnostic already fails the build) is not merged.
  defp deep(%{} = scene, %{} = json), do: Map.merge(scene, json, fn _, a, b -> deep(a, b) end)
  defp deep(_, json), do: json
end
