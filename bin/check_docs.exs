# Documentation check, no deps: every relative Markdown link in a tracked .md file
# resolves, and every tracked .md file is reachable by links from an entry file (README.md, AGENTS.md, CLAUDE.md)
# (an agent can find it). Fenced code blocks are skipped. A `file.md#anchor` link must match a heading in that file.
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

# GitHub anchors: explicit <a id>/<a name> targets, and heading slugs: link text only, lowercase, drop punctuation, spaces to hyphens, repeats get -1, -2.
slugs = fn abs ->
  text = unfenced.(File.read!(abs))
  aliases = for [_, a] <- Regex.scan(~r/<a\s[^>]*?\b(?:id|name)="([^"]+)"/, text), do: a

  aliases ++
    (for [_, h] <- Regex.scan(~r/^ {0,3}\#{1,6}[ \t]+(.*?)(?:[ \t]+\#+)?[ \t]*$/m, text),
         reduce: {%{}, []} do
       {seen, acc} ->
         base =
           h
           |> String.replace(~r/\[([^\]]*)\]\([^)]*\)/, "\\1")
           |> String.downcase()
           |> String.replace(~r/[^\p{L}\p{N}\p{M} _-]/u, "")
           |> String.replace(" ", "-")

         n = Map.get(seen, base, 0)
         {Map.put(seen, base, n + 1), [if(n == 0, do: base, else: "#{base}-#{n}") | acc]}
     end
     |> elem(1))
end

# Optional second argument: an extra doc to check (the red control passes a planted one).
extra = Enum.drop(System.argv(), 1)

anchors =
  for file <- docs ++ extra,
      abs_file = Path.expand(file, root),
      [_, target] <-
        Regex.scan(
          ~r/\]\(<?([^)\s>]*#[^)\s>]*)>?(?:\s+"[^"]*")?\)/,
          unfenced.(File.read!(abs_file))
        ),
      not String.match?(target, ~r/\A[a-z][a-z0-9+.-]*:/),
      [path, frag] = String.split(target, "#", parts: 2),
      abs =
        if(path == "", do: abs_file, else: Path.expand(URI.decode(path), Path.dirname(abs_file))),
      String.ends_with?(abs, ".md") and File.regular?(abs),
      URI.decode(frag) not in slugs.(abs),
      do: "broken anchor #{file}: #{target}"

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

live = Enum.filter(docs, &String.match?(&1, live_re)) ++ extra

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

# Review records are named <YYYY-MM-DD>-<slug>.md, so a listing sorts them by date, and
# docs/reviews/README.md is exactly what bin/review_index.sh generates from them.
records = for f <- docs, Path.dirname(f) == "docs/reviews", f != "docs/reviews/README.md", do: f

{stale, review_rc} = System.cmd("sh", ["bin/review_index.sh", "--check"], cd: root)

names =
  for f <- records,
      not String.match?(Path.basename(f), ~r/\A\d{4}-\d{2}-\d{2}-[a-z0-9.-]+\.md\z/),
      do: "review record #{f}: name it <YYYY-MM-DD>-<slug>.md"

names = if review_rc == 0, do: names, else: names ++ [String.trim(stale)]

# Each record in docs/decisions has exactly one index line (a list line whose
# first link is the bare file name): a union merge (.gitattributes) duplicates a twice-edited line.
index =
  for dir <- ["docs/decisions"],
      readme = Path.join(dir, "README.md"),
      counts =
        Regex.scan(
          ~r/^- (?:(?!\]\().)*\]\(([^)\/#\s]+\.md)(?:#[^)]*)?\)/m,
          File.read!(Path.join(root, readme)),
          capture: :all_but_first
        )
        |> List.flatten()
        |> Enum.frequencies(),
      records = for(f <- docs, Path.dirname(f) == dir, f != readme, do: {Path.basename(f), 0}),
      {name, n} <- Map.merge(Map.new(records), counts),
      n != 1,
      do: "#{readme}: #{name} has #{n} index lines, want 1"

# A bin/*.sh that runs git init sources bin/lib/clean_git_env.sh: a hook's GIT_DIR would
# otherwise send the throwaway repo's writes into the real one.
git_env =
  for f <- tracked,
      Path.dirname(f) == "bin" and Path.extname(f) == ".sh",
      File.regular?(Path.join(root, f)),
      text = File.read!(Path.join(root, f)),
      String.match?(text, ~r/\bgit init\b/),
      not String.match?(text, ~r{^\. "\$\(dirname "\$0"\)/lib/clean_git_env\.sh"$}m),
      do: "#{f} runs git init without sourcing bin/lib/clean_git_env.sh"

# Book UI names no look (a token, hex colour, px size or palette/role name): the catalogue holds it.
# A link anchor (`](#facade-rules)`, `x.md#facade-rules`) is not a hex colour.
# The red control passes a planted copy as the extra doc.
look_re =
  ~r/\b(type|space|size|radius|motion|opacity|color|font|sound)\.[a-z]|(?<!\]\(|\.md)#[0-9a-fA-F]{6}\b|\b\d+ ?px\b|`(light|dawn|dusk|dark|fg|bg|dim|line|card|action|danger|warning)`/

looks =
  for file <- ["docs/system/book-ui.md" | extra],
      abs = Path.expand(file, root),
      {text, n} <- abs |> File.read!() |> String.split("\n") |> Enum.with_index(1),
      [hit | _] <- [Regex.run(look_re, text)],
      do: "#{file}:#{n} names a look (#{hit}): move it to docs/BOOK-UI-COMPONENTS.md"

problems =
  Enum.sort(broken) ++
    Enum.sort(anchors) ++
    Enum.sort(orphans) ++ over ++ pointers ++ names ++ index ++ git_env ++ looks

Enum.each(problems, &IO.puts/1)

IO.puts(
  "#{length(docs)} docs, #{length(broken)} broken link(s), #{length(anchors)} broken anchor(s), #{length(orphans)} unreachable"
)

System.halt(if problems == [], do: 0, else: 1)
