# Documentation check, no deps: every relative Markdown link in a tracked .md file
# resolves, and every tracked .md file is reachable by links from an entry file (README.md, AGENTS.md, CLAUDE.md)
# (an agent can find it). Fenced code blocks are skipped; anchors are not checked.
# Code pointers in the live docs name a real file and line (see below).
# AGENTS.md stays within a word budget: every agent loads it every session.
#
#   elixir bin/check_docs.exs [file-to-budget [extra-doc-to-check]]
root = Path.expand("..", __DIR__)

{out, 0} =
  System.cmd(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "*.md"],
    cd: root
  )

docs = out |> String.split(<<0>>, trim: true) |> Enum.filter(&File.regular?(Path.join(root, &1)))

unfenced = &Regex.replace(~r/^ {0,3}(```|~~~).*?^ {0,3}\1[^\n]*$/ms, &1, "")

links =
  Map.new(docs, fn file ->
    targets =
      for [_, target] <-
            Regex.scan(
              ~r/\]\(<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/,
              unfenced.(File.read!(Path.join(root, file)))
            ),
          not String.match?(target, ~r/\A([a-z][a-z0-9+.-]*:|#)/),
          path = target |> String.split("#") |> hd() |> URI.decode(),
          do:
            {target,
             Path.join(Path.dirname(file), path) |> Path.expand("/r") |> Path.relative_to("/r")}

    {file, targets}
  end)

broken =
  for {file, targets} <- links,
      {target, resolved} <- targets,
      not File.exists?(Path.join(root, resolved)),
      do: "broken link #{file}: #{target}"

reach = fn
  _reach, seen, [] ->
    seen

  reach, seen, [f | rest] ->
    next = for {_, r} <- Map.get(links, f, []), Map.has_key?(links, r), r not in seen, do: r
    reach.(reach, MapSet.union(seen, MapSet.new(next)), next ++ rest)
end

roots = Enum.filter(["README.md", "AGENTS.md", "CLAUDE.md"], &Map.has_key?(links, &1))
seen = reach.(reach, MapSet.new(roots), roots)
orphans = for f <- docs, f not in seen, do: "unreachable #{f}"

agents_budget = 1400
# Optional argument: the file to budget (the red control passes a padded copy).
budget_file = List.first(System.argv(), Path.join(root, "AGENTS.md"))
agents_words = budget_file |> File.read!() |> String.split() |> length()

over =
  if agents_words > agents_budget,
    do: [
      "AGENTS.md is #{agents_words} words, budget #{agents_budget}: move detail to a linked doc"
    ],
    else: []

# Code pointers (`path:line`) in the live docs must name one tracked file and a line inside it.
# A bare name or partial path must match exactly one tracked file. History (archive, reviews, decisions) cites old commits,
# so it is not checked. ponytail: a line that moved inside the file still passes; reviewers catch that.
{tracked, 0} = System.cmd("git", ["ls-files"], cd: root)
tracked = String.split(tracked, "\n", trim: true)
by_base = Enum.group_by(tracked, &Path.basename/1)

live_re =
  ~r{\A(AGENTS\.md|docs/(system/[^/]+|ROADMAP|world-parameters|CHECKS|WORKFLOW|lessons/[^/]+)\.md)\z}

# Optional second argument: an extra doc to check (the red control passes a planted one).
live = Enum.filter(docs, &String.match?(&1, live_re)) ++ Enum.drop(System.argv(), 1)

pointers =
  for file <- live,
      [_, path, line] <-
        Regex.scan(~r/`([\w.\/-]+\.\w+):(\d+)/, File.read!(Path.expand(file, root))),
      matches =
        if(String.contains?(path, "/"),
          do: Enum.filter(tracked, &(&1 == path or String.ends_with?(&1, "/" <> path))),
          else: Map.get(by_base, path, [])
        ),
      problem =
        (case matches do
           [one] ->
             if String.to_integer(line) >
                  length(
                    String.split(
                      String.trim_trailing(File.read!(Path.join(root, one)), "\n"),
                      "\n"
                    )
                  ),
                do: "past the end of #{one}"

           [] ->
             "no such tracked file"

           _ ->
             "ambiguous name: give the path"
         end),
      problem != nil,
      do: "stale pointer #{file}: #{path}:#{line} (#{problem})"

problems = Enum.sort(broken) ++ Enum.sort(orphans) ++ over ++ pointers
Enum.each(problems, &IO.puts/1)
IO.puts("#{length(docs)} docs, #{length(broken)} broken link(s), #{length(orphans)} unreachable")
System.halt(if problems == [], do: 0, else: 1)
