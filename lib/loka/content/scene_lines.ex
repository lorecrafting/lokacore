defmodule Loka.Content.SceneLines do
  @moduledoc """
  A scene file's layout: which dialogue each line belongs to (indent says, SceneFiles reads the
  words) and where each lowered part was written. Lines are read trimmed.

  A `- ` deeper than the current choice opens a nested set, the dialogue `<parent>_<choice>`;
  one at the same indent is a sibling, a shallower one closes what is deeper. Under a top-level
  choice a line may sit at any indent; under a nested one it must sit deeper than its `- `.
  """

  @type line :: {String.t(), pos_integer()}
  @type link :: %{
          parent: String.t(),
          choice: String.t(),
          child: String.t(),
          n: pos_integer(),
          text: String.t()
        }

  @doc "The file as `{dialogue key, lines}` (file order, itself first), the nested sets' links, and the lines indent refuses."
  @spec split(String.t(), String.t()) ::
          {[{String.t(), [line()]}], [link()], [{pos_integer(), String.t(), String.t()}]}
  def split(text, key) do
    s = walk(text, key)
    # A repeated choice is refused by the fold; its children stay one set here.
    links = s.links |> Enum.reverse() |> Enum.uniq_by(& &1.child)
    {sections(key, Enum.reverse(s.lines), links), links, taken(s.links) ++ s.bad}
  end

  # Two different choices whose words make one child key would share its lines.
  defp taken(links) do
    links = Enum.reverse(links)
    firsts = Enum.uniq_by(links, & &1.child)

    for %{n: n, text: text, child: child} = l <- links,
        first = Enum.find(firsts, &(&1.child == child)),
        {l.parent, l.choice} != {first.parent, first.choice},
        do: {n, text, "nested_key_taken", child}
  end

  defp walk(text, key) do
    numbered =
      text
      |> String.split("\n")
      |> Enum.with_index(1)
      |> Enum.reject(fn {raw, _} -> String.trim(raw) == "" end)

    sets = for {raw, _} <- numbered, ["sets:", fact | _] <- [String.split(raw)], do: fact
    start = %{root: key, stack: [], lines: [], links: [], bad: [], facts: %{}, sets: sets}
    Enum.reduce(numbered, start, &step/2)
  end

  defp sections(key, lines, links) do
    own = fn k -> for {^k, text, n} <- lines, do: {text, n} end
    header = Enum.filter(own.(key), fn {text, _} -> header?(text) end)
    children = for l <- links, do: {l.child, header ++ own.(l.child)}
    [{key, own.(key)} | children]
  end

  defp header?(text), do: String.starts_with?(text, ["npc: ", "with: "])

  @doc "Where each part of each lowered dialogue was written: `{key, [{steps, line}]}` (error locations)."
  @spec lines(String.t(), String.t()) :: [{String.t(), [{[String.t()], pos_integer()}]}]
  def lines(text, key) do
    {sections, links, _} = split(text, key)
    opened = Map.new(links, &{&1.child, &1.n})

    for {k, section} <- sections, do: {k, parts(section, opened[k])}
  end

  defp parts(section, opened) do
    {found, _} = Enum.flat_map_reduce(section, {nil, 0}, &located/2)
    at = if opened, do: [{[], opened}, {["prompt"], opened}], else: []
    # A repeated part keeps its first line.
    Enum.uniq_by(at ++ found, &elem(&1, 0))
  end

  @doc "A choice's key, from its words."
  @spec key(String.t()) :: String.t()
  def key(label),
    do: label |> String.downcase() |> String.replace(~r/[^a-z0-9]+/, "_") |> String.trim("_")

  defp step({raw, n}, s) do
    text = String.trim(raw)
    margin = binary_part(raw, 0, byte_size(raw) - byte_size(String.trim_leading(raw)))
    choice? = String.starts_with?(text, "- ")
    # A tab has no one width, so a tabbed indent could not say what it is under.
    s =
      if String.contains?(margin, "\t") and (choice? or s.stack != []),
        do: bad(s, n, text, "bad_indent"),
        else: s

    cond do
      choice? -> choice(text, byte_size(margin), n, s)
      s.stack == [] -> head(text, n, s)
      true -> body(text, byte_size(margin), n, s)
    end
  end

  defp bad(s, n, text, why), do: %{s | bad: [{n, String.replace_invalid(text), why} | s.bad]}

  defp emit(s, k, text, n), do: %{s | lines: [{k, text, n} | s.lines]}

  defp head("when: not " <> fact = text, n, s),
    do: emit(%{s | facts: %{fact => false}}, s.root, text, n)

  defp head("when: " <> fact = text, n, s),
    do: emit(%{s | facts: %{fact => true}}, s.root, text, n)

  defp head(text, n, s), do: emit(s, s.root, text, n)

  defp frame(text, indent, k, facts),
    do: %{
      indent: indent,
      key: k,
      choice: key(String.trim_leading(text, "- ")),
      then: nil,
      nested: false,
      facts: facts
    }

  defp choice(text, indent, n, %{stack: []} = s) do
    %{s | stack: [frame(text, indent, s.root, s.facts)]} |> emit(s.root, text, n)
  end

  defp choice(text, indent, n, %{stack: [top | below]} = s) when indent > top.indent do
    child = top.key <> "_" <> top.choice
    s = s |> then_refused(top) |> linked(top, child, n, text)
    stack = [frame(text, indent, child, top.facts), %{top | nested: true} | below]
    emit(%{s | stack: stack}, child, text, n)
  end

  # A shallower `- ` that matches no open choice is refused and read as beside the one it left,
  # at the indent it was written, so the lines under it are not refused as well.
  defp choice(text, indent, n, %{stack: stack} = s) do
    {old, below, s} = closed(stack, text, indent, n, s)

    facts = if below == [], do: s.facts, else: hd(below).facts
    %{s | stack: [frame(text, indent, old.key, facts) | below]} |> emit(old.key, text, n)
  end

  defp closed(stack, text, indent, n, s) do
    {deeper, rest} = Enum.split_while(stack, &(&1.indent > indent))

    case rest do
      [%{indent: ^indent} = same | below] -> {same, below, s}
      _ -> {List.last(deeper), rest, bad(s, n, text, "bad_indent")}
    end
  end

  defp then_refused(s, %{then: {n, text}}), do: bad(s, n, text, "then_and_nested")
  defp then_refused(s, _), do: s

  defp linked(s, %{nested: true}, _, _, _), do: s

  defp linked(s, top, child, n, text) do
    link = %{parent: top.key, choice: top.choice, child: child, n: n, text: text}
    %{s | links: [link | s.links]}
  end

  defp body(text, indent, n, %{stack: [top | below]} = s)
       when below != [] and indent <= top.indent do
    written_after? =
      String.starts_with?(text, "then:") and Enum.any?(below, &(&1.indent < indent))

    bad(s, n, text, if(written_after?, do: "then_and_nested", else: "bad_indent"))
  end

  defp body(text, _, n, %{stack: [top | below]} = s) do
    {top, s} = noted(text, n, top, s)
    emit(%{s | stack: [top | below]}, top.key, text, n)
  end

  defp noted("then:" <> _ = text, n, top, s), do: {%{top | then: {n, text}}, s}

  defp noted("needs: " <> what = text, n, top, s) do
    case String.split(what) do
      ["not", fact] -> needed(fact, false, text, n, top, s)
      [fact] -> needed(fact, true, text, n, top, s)
      _ -> {top, s}
    end
  end

  defp noted(_, _, top, s), do: {top, s}

  # A fact this file sets could have changed by the time the talk comes back here, so only one
  # it never sets is held to what was needed above.
  defp needed(fact, value, text, n, top, s) do
    never? = Map.get(top.facts, fact) == not value and fact not in s.sets
    s = if never?, do: bad(s, n, text, "unreachable"), else: s
    {%{top | facts: Map.put(top.facts, fact, value)}, s}
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

  defp located({"needs: " <> _, n}, {cur, _} = at) when cur != nil,
    do: {[{["choices", cur, "policy"], n}], at}

  defp located({"then: " <> _, n}, {cur, _} = at) when cur != nil,
    do: {[{["choices", cur, "then"], n}], at}

  defp located({"once", n}, {cur, _} = at) when cur != nil,
    do: {[{["choices", cur, "once"], n}], at}

  defp located({"asked", n}, {cur, _} = at) when cur != nil,
    do: {[{["choices", cur, "asked"], n}], at}

  defp located({_, n}, {nil, _} = at), do: {[{["prompt"], n}], at}
  defp located({_, n}, {cur, _} = at), do: {[{["choices", cur, "narration"], n}], at}
end
