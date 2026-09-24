# Size limits for Elixir, no deps: source files (lib/, bin/) at most 300 lines, test files
# (test/) at most 500, each def/defp/defmacro clause in a source file at most 40 lines
# (first to last line). Files named *.gen.* are exempt. TypeScript: bin/check_ts_size.mjs.
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

violations =
  Enum.flat_map(files, fn rel ->
    path = Path.join(root, rel)
    test? = String.starts_with?(rel, "test/")
    limit = if test?, do: 500, else: 300
    lines = path |> File.stream!() |> Enum.count()
    file = if lines > limit, do: ["#{rel}:1: file, #{lines} lines, limit #{limit}"], else: []

    functions =
      if test? do
        []
      else
        path
        |> File.read!()
        |> Code.string_to_quoted!(token_metadata: true, file: rel)
        |> Macro.prewalk([], fn
          {kind, meta, [head, _body]} = node, acc
          when kind in [:def, :defp, :defmacro, :defmacrop] ->
            n = last_line.(node) - meta[:line] + 1
            {name, _, _} = with {:when, _, [call | _]} <- head, do: call

            {node,
             if(n > 40,
               do: ["#{rel}:#{meta[:line]}: #{kind} #{name}, #{n} lines, limit 40" | acc],
               else: acc
             )}

          node, acc ->
            {node, acc}
        end)
        |> elem(1)
        |> Enum.reverse()
      end

    file ++ functions
  end)

Enum.each(violations, &IO.puts/1)
System.halt(if violations == [], do: 0, else: 1)
