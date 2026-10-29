defmodule Loka.Content.LintPages do
  @moduledoc "Author-time page lint for `Loka.Content.Lint`: fixture pages need a prose link and a title."

  # A detail with a page is reached from its room's prose, `[words](<detail key>)` (book-ui.md
  # fixture rule; loka-x6t.120): a scripted action aimed at it, or one of the page kinds. A scripted action target
  # also needs a title, the page's heading.
  @page_kinds ~w(readable harvest perception bed transport notice_board)

  @doc "The page findings for decoded source files and their text table."
  @spec run(%{String.t() => map()}, map()) :: [String.t()]
  def run(files, text) do
    aimed = aimed(files)

    for {"rooms/" <> name = rel, room} <- Enum.sort(files),
        prose = prose(room, text),
        {key, d} <- Enum.sort(room["details"] || %{}),
        scripted_actions = Enum.sort(aimed[{Path.rootname(name), key}] || []),
        line <- page_lines(rel, key, d, scripted_actions, String.contains?(prose, "](#{key})")),
        do: line
  end

  # {room, detail} => the scripted action keys aimed at that detail.
  defp aimed(files) do
    for(
      {"actions/" <> name, %{"target" => %{"kind" => "detail"} = t}} <- files,
      do: {{t["room"], t["detail"]}, Path.rootname(name)}
    )
    |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))
  end

  defp prose(room, text),
    do: Enum.map_join([room | room["variants"] || []], " ", &(text[&1["description"]] || ""))

  defp page_lines(rel, key, d, scripted_actions, linked?) do
    page? = scripted_actions != [] or Enum.any?(@page_kinds, &is_map_key(d, &1))

    if(page? and !linked?, do: ["#{rel}: details.#{key} has a page and no prose link"], else: []) ++
      if scripted_actions != [] and !is_map_key(d, "title"),
        do: [
          "#{rel}: details.#{key} is a scripted action target (#{Enum.join(scripted_actions, ", ")}) and has no title"
        ],
        else: []
  end
end
