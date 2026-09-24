# Size limits for Elixir, no deps. Source files at most 300 lines, test files 500, each
# function clause and `fn` in a source file 40 (first to last line). Tests: under the top
# `test/` or `kernel/ts/test/`, under `__tests__/`, or named *_test.exs / *.test.* / *.spec.*.
# Scans every git-listed .ex/.exs (or only the given paths), except *.gen.* files. A
# comment line starting `# size: allow N, reason` raises a limit to N (at most 1.5x, only
# when needed): in lines 1-5 for the file, on the line right above a function (after line
# 5) for that function; anywhere else it fails. TypeScript: bin/check_ts_size.mjs.
#
#   elixir bin/check_size.exs [path ...]
root = Path.expand("..", __DIR__)

test_file =
  ~r{^(test|kernel/ts/test)/|(^|/)__tests__/|(_test\.exs|\.(test|spec)\.([cm]?ts|tsx|mjs))$}

candidates =
  with [] <- System.argv() do
    {out, 0} = System.cmd("git", ~w(ls-files -z --cached --others --exclude-standard), cd: root)
    String.split(out, <<0>>, trim: true)
  end

files =
  for rel <- candidates,
      Path.extname(rel) in ~w(.ex .exs),
      not String.contains?(Path.basename(rel), ".gen."),
      File.regular?(Path.join(root, rel)),
      do: rel

last_line = fn ast ->
  ast
  |> Macro.prewalk(0, fn
    {_, meta, _} = node, acc when is_list(meta) ->
      keys = [
        meta[:line],
        meta[:end][:line],
        meta[:closing][:line],
        meta[:end_of_expression][:line]
      ]

      {node, Enum.max([acc | Enum.map(keys, &(&1 || 0))])}

    node, acc ->
      {node, acc}
  end)
  |> elem(1)
end

# [{what, first line, lines}] for every def/defp/defmacro/defmacrop clause and fn.
functions = fn rel, src ->
  src
  |> Code.string_to_quoted!(token_metadata: true, file: rel)
  |> Macro.prewalk([], fn
    {kind, meta, [head, _]} = node, acc when kind in [:def, :defp, :defmacro, :defmacrop] ->
      {name, _, _} = with {:when, _, [call | _]} <- head, do: call
      name = if is_atom(name), do: name, else: Macro.to_string(name)
      {node, [{"#{kind} #{name}", meta[:line], last_line.(node) - meta[:line] + 1} | acc]}

    {:fn, meta, clauses} = node, acc when is_list(clauses) ->
      {node, [{"fn", meta[:line], last_line.(node) - meta[:line] + 1} | acc]}

    node, acc ->
      {node, acc}
  end)
  |> elem(1)
  |> Enum.reverse()
end

# {what, first line, lines, default limit, marker line or nil} -> report lines
check = fn rel, text, {what, first, size, default, ln} ->
  parsed = ln && Regex.run(~r/^\s*# size: allow (\d+),\s*(\S.*)/, Enum.at(text, ln - 1))
  [_, n, reason] = if parsed, do: parsed, else: [nil, "0", nil]
  n = String.to_integer(n)

  {limit, notes} =
    cond do
      !ln -> {default, []}
      !parsed -> {default, ["#{rel}:#{ln}: size marker needs N and a reason"]}
      size <= default -> {default, ["#{rel}:#{ln}: size marker not needed, #{size} lines"]}
      n > div(default * 3, 2) -> {default, ["#{rel}:#{ln}: size marker #{n} over 1.5x"]}
      true -> {n, ["#{rel}:#{ln}: info: size: allow #{n}, #{reason}"]}
    end

  notes ++
    if size > limit, do: ["#{rel}:#{first}: #{what}, #{size} lines, limit #{limit}"], else: []
end

report =
  Enum.flat_map(files, fn rel ->
    src = File.read!(Path.join(root, rel))
    text = String.split(src, "\n")
    test? = rel =~ test_file
    marked = for {t, i} <- Enum.with_index(text, 1), t =~ ~r/^\s*# size: allow/, do: i
    file_ln = Enum.find(marked, &(&1 <= 5))
    fns = if test?, do: [], else: functions.(rel, src)

    fns =
      for {what, l, size} <- fns,
          do: {what, l, size, 40, (l - 1 > 5 and (l - 1) in marked) && l - 1}

    consumed = [file_ln | for({_, _, _, _, ln} <- fns, do: ln)]
    lines = length(text) - if String.ends_with?(src, "\n"), do: 1, else: 0
    file = {"file", 1, lines, if(test?, do: 500, else: 300), file_ln}

    Enum.flat_map([file | fns], &check.(rel, text, &1)) ++
      for i <- marked,
          i not in consumed,
          do: "#{rel}:#{i}: size marker not attached to a file header or function"
  end)

Enum.each(report, &IO.puts/1)
System.halt(if Enum.all?(report, &(&1 =~ ": info: ")), do: 0, else: 1)
