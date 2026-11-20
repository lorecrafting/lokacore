# The editor gate (gui-editor-design §7, §11), evaluated by bin/toolbox_page.exs with its root,
# json, read, defs and treatment enum bound; it returns {problems, registry}. Every top-level
# field of each source kind (a kind with none, the text catalog, is its own path) and every
# treatment has a create, edit and delete surface, a component under tools/author-panel/src/edit/
# or `generic`. areas/ bundles the other kinds, so their paths cover it. Generic surfaces are
# exactly the baseline, which only shrinks against main's copy, so a new path ships hand-built.
# The Book builder's parity (in-game-builder-mode §6.7): each row also has `book` create, edit
# and delete, and each kernel/ts/play/parity.json row (a panel feature outside the schema) names
# its panel file and a `book`; a book value is a file under mobile/app/author/build/, `todo` or
# (rows only) `generic`. The todos are exactly the shared todo baseline, which only shrinks
# against main's copy (absent there: this gate's first change). Arguments 4 to 9 after --check:
#   registry.json baseline.txt main_baseline.txt parity.json todo.txt main_todo.txt
schema_paths =
  for f <- File.ls!(Path.join(root, "schemas/source")),
      f not in ["defs.schema.json", "areas.schema.json"],
      kind = String.replace_suffix(f, ".schema.json", ""),
      def = json.("schemas/source/" <> f)["$ref"] |> String.split("/") |> List.last(),
      fields = for({field, _} <- SchemaPath.props(defs[def], defs, []), uniq: true, do: field),
      p <- if(fields == [], do: [kind], else: Enum.map(fields, &"#{kind}.#{&1}")),
      do: p

schema_paths = Enum.sort(schema_paths ++ for(t <- enum, do: "treatment:#{t}"))
arg = &Enum.at(System.argv(), &1, &2)
editor_path = arg.(4, "kernel/ts/play/registry.json")
editor = json.(editor_path)
baseline_path = arg.(5, "test/loka/editor_generic_baseline.txt")
lines = &MapSet.new(String.split(&1, "\n", trim: true))
baseline = lines.(read.(baseline_path))
parity_path = arg.(7, "kernel/ts/play/parity.json")
parity = json.(parity_path)
todo_path = arg.(8, "test/loka/builder_todo_baseline.txt")
todo_base = lines.(read.(todo_path))
git = &System.cmd("git", &1, cd: root, stderr_to_stdout: true)

# main's copy of a baseline: shrink-only gates --check; generating (merge_resolve, no
# origin/main) skips it, as does a copy main lacks when absent_ok
reference = fn path, n, absent_ok ->
  case {System.argv(), Enum.at(System.argv(), n)} do
    {["--check" | _], nil} ->
      if elem(git.(~w(rev-parse --verify -q origin/main)), 1) != 0,
        do: raise("no origin/main to hold #{path} to: git fetch origin main")

      case git.(["show", "origin/main:" <> path]) do
        {text, 0} ->
          lines.(text)

        {out, _} ->
          if absent_ok and git.(~w(ls-tree --name-only origin/main -- #{path})) == {"", 0},
            do: nil,
            else: raise("cannot read origin/main:#{path} to hold it to: #{out}")
      end

    {_, nil} ->
      nil

    {_, p} ->
      lines.(read.(p))
  end
end

# the lines of set and base that differ, and those base adds to main's copy
held = fn set, base, ref, path, word ->
  for(l <- MapSet.difference(set, base), do: "#{path}: #{l}: #{word} but not in the baseline") ++
    for(
      l <- MapSet.difference(base, set),
      do: "#{path}: #{l}: no longer #{word}, delete the line"
    ) ++
    for(
      l <- MapSet.difference(base, ref || base),
      do: "#{path}: #{l}: not in main's baseline; #{word} only shrinks; rebase if main shrank"
    )
end

verbs = ~w(create edit delete)

generic =
  for p <- schema_paths,
      v <- verbs,
      editor[p][v] == "generic",
      into: MapSet.new(),
      do: "#{p}.#{v}"

todo =
  MapSet.new(
    for(p <- schema_paths, v <- verbs, editor[p]["book"][v] == "todo", do: "#{p}.book.#{v}") ++
      for(r <- parity, r["book"] == "todo", do: "parity:#{r["id"]}")
  )

# a safe relative path to a regular file under dir, never a path out of it
file? = &(match?({:ok, _}, Path.safe_relative(&2)) and File.regular?(Path.join([root, &1, &2])))

# a surface is "generic" or a component file in the edit folder
surface? = fn
  "generic" -> true
  s when is_binary(s) -> String.ends_with?(s, ".tsx") and file?.("tools/author-panel/src/edit", s)
  _ -> false
end

book = fn
  nil, _ ->
    "missing (todo, generic or a file under mobile/app/author/build/)"

  "todo", _ ->
    nil

  "generic", generic_ok when generic_ok ->
    nil

  s, _ when is_binary(s) ->
    if(!file?.("mobile/app/author/build", s),
      do: "#{s}: no such file under mobile/app/author/build/"
    )

  s, _ ->
    "#{inspect(s)} is not a file, todo or generic"
end

problems =
  for(
    p <- schema_paths,
    v <- verbs,
    # a binding here filters out nil, so the surface is read inside the condition
    not surface?.(editor[p][v]),
    do: "#{editor_path}: #{p}: no #{v} surface (a new path ships its hand-built editor)"
  ) ++
    for(
      p <- Map.keys(editor),
      p not in schema_paths,
      do: "#{editor_path}: #{p}: no such source-schema path"
    ) ++
    held.(generic, baseline, reference.(baseline_path, 6, false), baseline_path, "generic") ++
    for(
      p <- schema_paths,
      v <- verbs,
      m = book.(editor[p]["book"][v], true),
      do: "#{editor_path}: #{p}: book #{v} #{m}"
    ) ++
    for(
      r <- parity,
      m <- [
        if(!(is_binary(r["panel"]) and file?.("", r["panel"])),
          do: "no panel file #{inspect(r["panel"])}"
        ),
        if(m = book.(r["book"], false), do: "book #{m}")
      ],
      m,
      do: "#{parity_path}: #{inspect(r["id"])}: #{m}"
    ) ++
    for(
      {id, n} <- Enum.frequencies(for r <- parity, do: r["id"]),
      n > 1 or not is_binary(id),
      do: "#{parity_path}: #{inspect(id)}: ids are unique strings"
    ) ++
    held.(todo, todo_base, reference.(todo_path, 9, true), todo_path, "todo")

{problems, editor}
