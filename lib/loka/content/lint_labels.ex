defmodule Loka.Content.LintLabels do
  @moduledoc "Author-time label and dialogue-exit lint for `Loka.Content.Lint`."

  @doc "A rel's path segments for the lint rules; a scenes/ .scene is a dialogue (Source.placed)."
  @spec parts(String.t()) :: [String.t()]
  def parts(rel), do: Path.split(Regex.replace(~r{^scenes/(?=[^/]+\.scene$)}, rel, "dialogues/"))

  # A choice or action label is a bare imperative: no single final "." unless it opens with a quote
  # mark (a spoken line). A status label is authored lowercase; condition.bleeding keeps its capital
  # (the kernel keys on it). book-ui.md: NPC dialogue and action details, Conditions details.
  @doc "The label findings for decoded source files and their text table."
  @spec run(%{String.t() => map()}, map()) :: [String.t()]
  def run(files, text) do
    for(
      {rel, d} <- Enum.sort(files),
      {kind, key} <- label_keys(parts(rel), d),
      s = text[key],
      is_binary(s),
      msg = label_problem(kind, key, s),
      do: "#{rel}: label #{key} #{msg}"
    ) ++ exits(files, text) ++ colon_labels(text)
  end

  # A sentence that opens with a one-to-three-word label and a colon ("High tide: ...", "Nell: ...")
  # reads as a form, not prose (book-ui.md Line placement, loka-pxa0); a longer lead-in or a
  # mid-sentence colon is prose. Link markup, `[words]` or `[words](key)`, reads as its words; a
  # quotation is the speaker's own words, so only its closing stop counts.
  @colon_label ~r/(?:^|[.!?]["”’]?\s)(?:[\w'’-]+,?\s){0,2}[\w'’-]+:\s/u
  defp colon_labels(text) do
    for {key, s} <- Enum.sort(text),
        is_binary(s),
        s
        |> String.replace(~r/\[([^\[\]]+)\](?:\([^()]*\))?/, "\\1")
        |> String.replace(~r/["“][^"“”]*?([.!?]?)["”]/u, "\"x\\1\"")
        |> String.match?(@colon_label),
        do: "text.json: #{key} opens a sentence with a colon label"
  end

  # The page's own Leave control ends a talk, so a do-nothing Leave or Close choice is refused
  # on a talk with more than one choice; a single-choice talk keeps it (book-ui.md NPC
  # dialogue; loka-x6t.21).
  defp exits(files, text) do
    for {rel, %{"choices" => %{} = cs}} <- Enum.sort(files),
        match?(["dialogues", _], parts(rel)),
        map_size(cs) > 1,
        {key, c} <- Enum.sort(cs),
        Map.keys(c) -- ["label", "narration", "asked"] == [],
        s = text[c["label"]],
        is_binary(s) and s =~ ~r/^(Leave|Close)\b/,
        do: "#{rel}: choice #{key} only leaves; the page's own Leave control ends the talk"
  end

  defp label_keys(["dialogues", _], d),
    do:
      Enum.map(
        [d["name"] | for({_, c} <- Enum.sort(d["choices"] || %{}), do: c["label"])],
        &{:choice, &1}
      )

  defp label_keys(["actions", _], d), do: [{:choice, d["name"]}]
  defp label_keys(["statuses", _], d), do: [{:status, d["name"]}]
  defp label_keys(_, _), do: []

  defp label_problem(:choice, _, s),
    do:
      if(s =~ ~r/[^.]\.$/ and not String.starts_with?(s, ["\"", "“", "‘"]),
        do: "ends in a period"
      )

  defp label_problem(:status, key, s),
    do: if(key != "condition.bleeding" and s != String.downcase(s), do: "is not lowercase")
end
