# The System/Checks and System/Toolbox pages' data (docs/design/system-dashboard/spec.md §6 PR3),
# rendered by bin/contracts.exs (so its `--check` keeps them current): docs/checks.gen.json, one row
# per top-level bullet of docs/CHECKS.md, and docs/toolbox.gen.json, the Ranked toolbox table of
# docs/MECHANICS-TOOLBOX.md with each row's docs/system/mechanics.md section. No check result:
# none is committed. System/Beads reads .beads/issues.jsonl itself at build time: a committed copy
# would be stale after every tracker write.
defmodule SystemGraph.Pages do
  @states ["todo", "done", "in progress", "merged into", "split into", "deferred"]

  @spec targets(String.t()) :: %{String.t() => String.t()}
  def targets(root) do
    read = &File.read!(Path.join(root, &1))

    %{
      "docs/checks.gen.json" => json(checks(read.("docs/CHECKS.md"))),
      "docs/toolbox.gen.json" =>
        json(toolbox(read.("docs/MECHANICS-TOOLBOX.md"), read.("docs/system/mechanics.md")))
    }
  end

  defp json(term) do
    {:ok, text} = Loka.Core.Canonical.encode(term)
    text <> "\n"
  end

  # A bullet's name is its leading code span, else the words before its first colon.
  @spec checks(String.t()) :: [map()]
  def checks(md) do
    for [bullet] <- Regex.scan(~r/^- .*(?:\n  .*)*/m, md) do
      text = plain(bullet |> String.slice(2..-1//1) |> String.replace(~r/\n\s+/, " "))

      [_, name, rest] =
        Regex.run(~r/^`([^`]+)`[: ]?\s*(.*)$/s, text) || Regex.run(~r/^([^:]+):\s*(.*)$/s, text) ||
          raise "docs/CHECKS.md: bullet has no `name` or name: #{text}"

      %{"name" => name, "text" => rest}
    end
  end

  # The `| # | Rank | … | Status |` table under "## Ranked toolbox".
  @spec toolbox(String.t(), String.t()) :: [map()]
  def toolbox(md, mechanics) do
    [_, block] =
      Regex.run(
        ~r/^## Ranked toolbox\n.*?\n\| # \| Rank \|[^\n]*\n\|[-|]+\n((?:\|[^\n]*\n)+)/ms,
        md
      ) ||
        raise "docs/MECHANICS-TOOLBOX.md: no `| # | Rank |` table under ## Ranked toolbox"

    sections = sections(mechanics)
    for row <- String.split(block, "\n", trim: true), do: row(row, sections)
  end

  defp row(row, sections) do
    case cells(row) do
      [id, batch, title, _today, _size, depends, _reuse, _sampler, status] ->
        %{
          "id" => id,
          "batch" => batch,
          "title" => plain(title),
          "depends" => depends(depends),
          "status" => plain(status),
          "state" => Enum.find(@states, &String.starts_with?(status, &1)),
          "section" => linked(row) || sections[id]
        }

      _ ->
        raise "docs/MECHANICS-TOOLBOX.md: toolbox row has not 9 cells: #{row}"
    end
  end

  defp cells(row), do: row |> String.trim("|") |> String.split("|") |> Enum.map(&String.trim/1)

  defp depends("–"), do: []
  defp depends(ids), do: String.split(ids, ~r/,\s*/)

  # The rules a row's cells link to, else the heading that names the row.
  defp linked(row) do
    case Regex.run(~r/\]\((system\/mechanics\.md#[^)]+)\)/, row) do
      [_, link] -> "docs/" <> link
      nil -> nil
    end
  end

  # Row id => the mechanics.md heading that names it: `(toolbox row 3)`, `(toolbox rows 5 and G5)`.
  defp sections(md) do
    for [h, ids] <-
          Regex.scan(~r/^## (.*\(toolbox rows? ([^)]*)\))$/m, md, capture: :all_but_first),
        [id] <- Regex.scan(~r/\b[A-Z]?\d+[a-z]?\b/, ids),
        into: %{},
        do: {id, "docs/system/mechanics.md" <> SystemGraph.slug(h)}
  end

  # Markdown links as their text (the pages render code spans only).
  defp plain(s), do: Regex.replace(~r/\[([^\]]+)\]\([^)]*\)/, s, "\\1")
end
