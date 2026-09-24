# Size limits for Elixir, no deps: source files (lib/, bin/) at most 300 lines, test files
# (test/) at most 500, each def/defp/defmacro clause in a source file at most 40 lines
# (first to last line). Files named *.gen.* are exempt. A comment line reading
# `size: allow N, reason` in a file's first 5 lines (or right above a function) raises that
# limit to N, at most 1.5x; the marker must be needed. TypeScript: bin/check_ts_size.mjs.
#
#   elixir bin/check_size.exs
root = Path.expand("..", __DIR__)

{out, 0} =
  System.cmd(
    "git",
    ~w(ls-files -z --cached --others --exclude-standard -- lib bin test),
    cd: root
  )

files =
  for rel <- String.split(out, <<0>>, trim: true),
      Path.extname(rel) in ~w(.ex .exs),
      not String.contains?(rel, ".gen."),
      File.regular?(Path.join(root, rel)),
      do: rel

last_line = fn ast ->
  ast
  |> Macro.prewalk(0, fn
    {_, meta, _} = node, acc when is_list(meta) ->
      {node,
       Enum.max([acc, meta[:line] || 0, meta[:end][:line] || 0, meta[:closing][:line] || 0])}

    node, acc ->
      {node, acc}
  end)
  |> elem(1)
end

# {what, first line, size, default limit, marker line or nil} -> report lines
check = fn rel, text, {what, first, size, default, ln} ->
  marker = ln && Regex.run(~r/^\s*# size: allow (\d+)(?:,\s*(\S.*))?/, Enum.at(text, ln - 1))
  over = &if(size > &1, do: ["#{rel}:#{first}: #{what}, #{size} lines, limit #{&1}"], else: [])

  case marker do
    [_, n, reason] when size <= default ->
      ["#{rel}:#{ln}: size marker not needed (#{n}, #{reason}), #{size} lines" | over.(default)]

    [_, n, reason] ->
      if String.to_integer(n) > div(default * 3, 2),
        do: ["#{rel}:#{ln}: size marker #{n} over the 1.5x ceiling" | over.(default)],
        else: ["#{rel}:#{ln}: info: size: allow #{n}, #{reason}" | over.(String.to_integer(n))]

    [_, _] ->
      ["#{rel}:#{ln}: size marker without a reason" | over.(default)]

    _ ->
      over.(default)
  end
end

report =
  Enum.flat_map(files, fn rel ->
    src = File.read!(Path.join(root, rel))
    text = String.split(src, "\n")
    test? = String.starts_with?(rel, "test/")

    functions =
      if test? do
        []
      else
        src
        |> Code.string_to_quoted!(token_metadata: true, file: rel)
        |> Macro.prewalk([], fn
          {kind, meta, [head, _body]} = node, acc
          when kind in [:def, :defp, :defmacro, :defmacrop] ->
            {name, _, _} = with {:when, _, [call | _]} <- head, do: call
            l = meta[:line]
            {node, [{"#{kind} #{name}", l, last_line.(node) - l + 1, 40, l > 1 && l - 1} | acc]}

          node, acc ->
            {node, acc}
        end)
        |> elem(1)
        |> Enum.reverse()
      end

    before_fn = for {_, l, _, _, _} <- functions, do: l - 1

    file_marker =
      Enum.find(
        1..min(5, length(text)),
        &(&1 not in before_fn and Enum.at(text, &1 - 1) =~ ~r/^\s*# size: allow /)
      )

    lines = length(text) - if String.ends_with?(src, "\n"), do: 1, else: 0
    file = {"file", 1, lines, if(test?, do: 500, else: 300), file_marker}
    Enum.flat_map([file | functions], &check.(rel, text, &1))
  end)

Enum.each(report, &IO.puts/1)
System.halt(if Enum.all?(report, &(&1 =~ ": info: ")), do: 0, else: 1)
