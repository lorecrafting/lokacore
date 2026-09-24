# Documentation check, no deps: every relative Markdown link in a tracked .md file
# resolves, and every tracked .md file is reachable by links from an entry file (README.md, AGENTS.md, CLAUDE.md)
# (an agent can find it). Fenced code blocks are skipped; anchors are not checked.
#
#   elixir bin/check_docs.exs
root = Path.expand("..", __DIR__)
{out, 0} = System.cmd("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "*.md"], cd: root)
docs = out |> String.split(<<0>>, trim: true) |> Enum.filter(&File.regular?(Path.join(root, &1)))

unfenced = &Regex.replace(~r/^ {0,3}(```|~~~).*?^ {0,3}\1[^\n]*$/ms, &1, "")

links =
  Map.new(docs, fn file ->
    targets =
      for [_, target] <- Regex.scan(~r/\]\(<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/, unfenced.(File.read!(Path.join(root, file)))),
          not String.match?(target, ~r/\A([a-z][a-z0-9+.-]*:|#)/),
          path = target |> String.split("#") |> hd() |> URI.decode(),
          do: {target, Path.join(Path.dirname(file), path) |> Path.expand("/r") |> Path.relative_to("/r")}

    {file, targets}
  end)

broken =
  for {file, targets} <- links, {target, resolved} <- targets,
      not File.exists?(Path.join(root, resolved)), do: "broken link #{file}: #{target}"

reach = fn _reach, seen, [] -> seen
  reach, seen, [f | rest] ->
    next = for {_, r} <- Map.get(links, f, []), Map.has_key?(links, r), r not in seen, do: r
    reach.(reach, MapSet.union(seen, MapSet.new(next)), next ++ rest)
end

roots = Enum.filter(["README.md", "AGENTS.md", "CLAUDE.md"], &Map.has_key?(links, &1))
seen = reach.(reach, MapSet.new(roots), roots)
orphans = for f <- docs, f not in seen, do: "unreachable #{f}"

problems = Enum.sort(broken) ++ Enum.sort(orphans)
Enum.each(problems, &IO.puts/1)
IO.puts("#{length(docs)} docs, #{length(broken)} broken link(s), #{length(orphans)} unreachable")
System.halt(if problems == [], do: 0, else: 1)
