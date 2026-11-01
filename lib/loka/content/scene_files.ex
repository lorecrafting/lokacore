defmodule Loka.Content.SceneFiles do
  @moduledoc """
  Scene files: `scenes/<key>.scene` (or `dialogues/<key>.scene`) is one dialogue as plain text,
  lowered into the dialogue JSON every other pass reads (docs/system/cartridge.md, Source
  shortcuts; docs/guides/writing-the-game.md, Write a scene). Lines, each trimmed:

      npc: maud            the speaker (first; its role is `maud`)
      when: met_maud       the dialogue's policy: that bool fact is true
      maud: words          the prompt, or under a choice its reply (more lines join with \\n)
      - Take the bowl      a choice, keyed by its words (`take_the_bowl`)
      gives: bowl          the speaker hands the current choice's taker that item (`receive`,
                           with the item role it needs)

  Words become inline prose markers, so Prose names their text keys. What the format cannot say
  (a keyword, an accept, a riddle) stays in `dialogues/<key>.json`, merged over the scene.
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
      Enum.reduce(lines(text, :trimmed), {%{"choices" => %{}}, nil, []}, &line/2)

    {dialogue, for({text, n} <- Enum.reverse(bad), do: {n, text, why(text, dialogue)})}
  end

  @doc "Where each part of the lowered dialogue was written: `{steps, line}` (error locations)."
  @spec lines(String.t()) :: [{[String.t()], pos_integer()}]
  def lines(text) do
    {found, _} = Enum.flat_map_reduce(lines(text, :trimmed), nil, &located/2)

    # A repeated part keeps its first line.
    found |> Enum.reverse() |> Enum.uniq_by(&elem(&1, 0))
  end

  defp located({"npc: " <> _, n}, cur), do: {[{["npc"], n}, {["roles"], n}], cur}
  defp located({"when: " <> _, n}, cur), do: {[{["policy"], n}], cur}
  defp located({"- " <> label, n}, _), do: {[{["choices", key(label)], n}], key(label)}

  defp located({"gives: " <> _, n}, cur) when cur != nil,
    do: {[{["choices", cur, "receive"], n}], cur}

  defp located({_, n}, nil), do: {[{["prompt"], n}], nil}
  defp located({_, n}, cur), do: {[{["choices", cur, "narration"], n}], cur}

  defp lines(text, :trimmed) do
    text
    |> String.split("\n")
    |> Enum.map(&String.trim/1)
    |> Enum.with_index(1)
    |> Enum.reject(&match?({"", _}, &1))
  end

  defp why("- " <> _, %{"npc" => _}), do: "repeated_choice"
  defp why("gives: " <> _, %{"npc" => _}), do: "gives_outside_choice"
  defp why("npc: " <> _, %{"npc" => _}), do: "misplaced_header"
  defp why("when: " <> _, %{"npc" => _}), do: "misplaced_header"
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

  defp line({"- " <> label, _} = at, {%{"npc" => _} = d, _, bad}) do
    key = key(label)

    if key == "" or is_map_key(d["choices"], key),
      do: {d, nil, [at | bad]},
      else: {put_in(d, ["choices", key], %{"label" => prose(label)}), key, bad}
  end

  defp line({"gives: " <> item, _}, {%{"npc" => npc} = d, cur, bad}) when cur != nil,
    do:
      {d
       |> put_in(["choices", cur, "receive"], %{"item" => item, "from" => npc})
       |> put_in(["roles", item], %{"role" => "item", "item" => item}), cur, bad}

  defp line({said, _} = at, {%{"npc" => npc} = d, cur, bad}) do
    case String.split(said, ": ", parts: 2) do
      [^npc, words] when cur == nil -> {spoken(d, ["prompt"], words), nil, bad}
      [^npc, words] -> {spoken(d, ["choices", cur, "narration"], words), cur, bad}
      _ -> {d, cur, [at | bad]}
    end
  end

  defp line(at, {d, cur, bad}), do: {d, cur, [at | bad]}

  defp spoken(d, path, words) do
    update_in(d, path, fn
      nil -> prose(words)
      %{"prose" => before} -> prose(before <> "\n" <> words)
    end)
  end

  defp prose(words), do: %{"prose" => words}

  @doc "Each scene entry (rel `*.scene`) with its same-key JSON file merged over it, as one entry."
  @spec merge([entry()]) :: [entry()]
  def merge(files) do
    {scenes, rest} =
      Enum.split_with(files, fn {rel, _, _} -> String.ends_with?(rel, ".scene") end)

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
