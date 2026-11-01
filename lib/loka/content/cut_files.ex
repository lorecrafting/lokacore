defmodule Loka.Content.CutFiles do
  @moduledoc """
  Cutscene files: `scenes/<key>.cut` is one modal scene's steps as plain text: a narrate per
  paragraph, a last `---` as its await_ack, then end. `on` and `control` come from
  `scenes/<key>.json`, merged over it (SceneFiles.merge/1). Lowering only: no runtime reads one.
  """
  alias Loka.Content.Source

  @doc "A `.cut` file's text as its scene steps, with its bad lines (SceneFiles.parse/1's form)."
  @spec parse(String.t()) :: {map(), [{pos_integer(), String.t(), String.t()}]}
  def parse(text) do
    {paragraphs, bad} = paragraphs(text)
    narrates = Enum.map(paragraphs, fn {words, _} -> narrate(words) end)
    # A stand-in keeps the steps well ordered: the file's fault is reported once, by its line.
    narrates = if narrates == [], do: [narrate("~")], else: narrates

    {%{"steps" => narrates ++ [%{"type" => "await_ack"}, %{"type" => "end"}]},
     Enum.sort_by(bad, &elem(&1, 0))}
  end

  @doc "Where a `.cut` file's parts were written: `{steps, line}` (error locations)."
  @spec lines(String.t()) :: [{[String.t() | non_neg_integer()], pos_integer()}]
  def lines(text) do
    {paragraphs, _} = paragraphs(text)

    for {{_, n}, i} <- Enum.with_index(paragraphs),
        path <- [["steps", i], ["steps", i, "text"]] do
      {path, n}
    end
  end

  @doc "`SCHEMA_VIOLATION` for each merged `.cut` with no `on`: nothing would ever start it."
  @spec untriggered([{String.t(), term(), term()}]) :: [map()]
  def untriggered(files) do
    for {rel, {:scene, key, _}, value} <- files,
        String.ends_with?(rel, ".cut"),
        is_map(value) and not is_map_key(value, "on") do
      data = %{"why" => "cut_no_trigger", "key" => key, "line" => 1}
      Source.diag("SCHEMA_VIOLATION", Source.at(rel, []), data)
    end
  end

  defp narrate(words), do: %{"type" => "narrate", "text" => %{"prose" => words}}

  # `{[{words, first line}], bad}`: lines next to each other are one paragraph, and `---` ends one.
  defp paragraphs(text) do
    numbered =
      text
      |> String.split("\n")
      |> Enum.map(&String.trim/1)
      |> Enum.with_index(1)
      |> Enum.reject(&match?({"", _}, &1))

    {found, _, bad} = Enum.reduce(numbered, {[], nil, misplaced(numbered)}, &paragraph/2)
    {Enum.reverse(found), bad}
  end

  defp paragraph({"---", _}, acc), do: acc

  defp paragraph({line, n}, {found, last, bad}) do
    cond do
      not String.valid?(line) ->
        {found, last, [{n, String.replace_invalid(line), "not_utf8"} | bad]}

      last == n - 1 ->
        {joined(found, line), n, bad}

      true ->
        {[{line, n} | found], n, bad}
    end
  end

  defp joined([{words, first} | rest], line), do: [{words <> "\n" <> line, first} | rest]

  # A scene is paragraphs, then one acknowledgement: `---` once, last, under some words.
  defp misplaced([]), do: [{1, "", "cut_end"}]

  defp misplaced(numbered) do
    {last, n} = List.last(numbered)
    early = for {"---", m} <- numbered, m != n, do: {m, "---", "cut_end"}

    if last != "---" or length(numbered) == 1,
      do: [{n, String.replace_invalid(last), "cut_end"} | early],
      else: early
  end
end
