# Red controls: plant each violation the Elixir checks exist to catch, and require the
# check to fail with the expected message. Planted files are always removed. ast-grep
# rules carry their own red cases (`ast-grep test`).
#
#   elixir bin/red_controls.exs
root = Path.expand("..", __DIR__)

controls = [
  {"boundary: web reaches store (only platform may)",
   %{
     "lib/loka_web/red_control.ex" =>
       "defmodule LokaWeb.RedControl do\n  def x, do: Loka.Store.__info__(:module)\nend\n"
   }, ~w(compile --warnings-as-errors --force), "forbidden reference to Loka.Store"},
  {"boundary: core calls an undeclared external app",
   %{
     "lib/loka/core/red_control.ex" =>
       "defmodule Loka.Core.RedControl do\n  def x, do: Logger.flush()\nend\n"
   }, ~w(compile --warnings-as-errors --force), "forbidden reference to Logger"},
  {"xref: dependency cycle",
   %{
     "lib/loka/content/red_control_a.ex" =>
       "defmodule Loka.Content.RedA do\n  def a, do: Loka.Content.RedB.b()\nend\n",
     "lib/loka/content/red_control_b.ex" =>
       "defmodule Loka.Content.RedB do\n  def b, do: Loka.Content.RedA.a()\nend\n"
   }, ~w(xref graph --format cycles --fail-above 0), "Too many cycles"},
  {"xref: compile-connected edge",
   %{
     "lib/loka/content/red_control_x.ex" =>
       "defmodule Loka.Content.RedX do\n  def a, do: Loka.Content.RedZ.c()\nend\n",
     "lib/loka/content/red_control_y.ex" =>
       "defmodule Loka.Content.RedY do\n  @x Loka.Content.RedX.a()\n  def b, do: @x\nend\n",
     "lib/loka/content/red_control_z.ex" =>
       "defmodule Loka.Content.RedZ do\n  def c, do: :ok\nend\n"
   }, ~w(xref graph --label compile-connected --fail-above 0), "Too many references"},
  {"credo: cyclomatic complexity 10",
   %{
     "lib/loka/content/red_control_c.ex" =>
       "defmodule Loka.Content.RedC do\n  def c(x) do\n    case x do\n" <>
         Enum.map_join(1..8, &"      #{&1} -> :a\n") <> "      _ -> :b\n    end\n  end\nend\n"
   }, ~w(credo --strict --verbose), "[Credo.Check.Refactor.CyclomaticComplexity]"},
  {"credo: nesting 3",
   %{
     "lib/loka/content/red_control_n.ex" =>
       "defmodule Loka.Content.RedN do\n  def n(a, b, c) do\n    if a do\n      if b do\n        if c, do: :x\n      end\n    end\n  end\nend\n"
   }, ~w(credo --strict --verbose), "[Credo.Check.Refactor.Nesting]"},
  {"credo: ABC size 31",
   %{
     "lib/loka/content/red_control_abc.ex" =>
       "defmodule Loka.Content.RedAbc do\n  def a, do: [#{Enum.map_join(1..31, ", ", &"f#{&1}()")}]\nend\n"
   }, ~w(credo --strict --verbose), "[Credo.Check.Refactor.ABCSize]"},
  {"credo: arity 7",
   %{
     "lib/loka/content/red_control_ar.ex" =>
       "defmodule Loka.Content.RedAr do\n  def r(a, b, c, d, e, f, g), do: {a, b, c, d, e, f, g}\nend\n"
   }, ~w(credo --strict --verbose), "[Credo.Check.Refactor.FunctionArity]"}
]

failures =
  for {name, files, args, expected} <- controls, reduce: 0 do
    acc ->
      paths =
        Enum.map(files, fn {rel, body} ->
          path = Path.join(root, rel)
          File.mkdir_p!(Path.dirname(path))
          tap(path, &File.write!(&1, body))
        end)

      {out, status} =
        try do
          System.cmd("mix", args, cd: root, stderr_to_stdout: true)
        after
          Enum.each(paths, &File.rm!/1)
          Enum.each(paths, &File.rmdir(Path.dirname(&1)))
        end

      if status != 0 and String.contains?(out, expected) do
        IO.puts("ok   #{name}")
        acc
      else
        IO.puts("FAIL #{name}: exit #{status}, expected #{inspect(expected)}\n#{out}")
        acc + 1
      end
  end

# Docs budget: a padded copy of AGENTS.md (never the real file) must fail check_docs.
padded = Path.join(System.tmp_dir!(), "loka-red-agents-#{System.unique_integer([:positive])}.md")

File.write!(
  padded,
  File.read!(Path.join(root, "AGENTS.md")) <> String.duplicate("padding ", 3000)
)

{out, status} =
  try do
    System.cmd("elixir", ["bin/check_docs.exs", padded], cd: root, stderr_to_stdout: true)
  after
    File.rm(padded)
  end

failures =
  if status != 0 and String.contains?(out, "AGENTS.md is ") do
    IO.puts("ok   docs: AGENTS.md over its word budget")
    failures
  else
    IO.puts("FAIL docs: AGENTS.md over its word budget: exit #{status}\n#{out}")
    failures + 1
  end

# Size limits, checked on the planted files only (fresh directories, removed afterwards):
# one line over each limit fails, exactly at it passes; markers at 1.5x pass, and over it,
# without a reason, not needed or not attached fail. L/ is under lib/, T/ under test/.
lines = &String.duplicate("  x\n", &1)
mod = &"defmodule Loka.RedSize do\n#{&1}end\n"

# `total` lines: file marker line 1, function marker line 6, `def f` of `fun` lines at line 7.
marked = fn file_marker, fn_marker, fun, total ->
  "#{file_marker}\n" <>
    mod.(
      "#{lines.(3)}#{fn_marker}\n  def f(x) do\n#{lines.(fun - 2)}  end\n#{lines.(total - fun - 7)}"
    )
end

sized = %{
  "L/big.ex" => mod.(lines.(299)),
  "L/fn.ex" => mod.("  defp f(x) do\n#{lines.(39)}  end\n"),
  "L/ok.ex" => mod.("  def f(x) do\n#{lines.(38)}  end\n#{lines.(258)}"),
  "L/fn_anon.ex" => mod.("  @f fn x ->\n#{lines.(39)}  end\n"),
  "L/do_literals.ex" =>
    mod.(
      ~s(  def h, do: """\n#{lines.(51)}  """\n  def l, do: [\n#{String.duplicate("    x,\n", 50)}  ]\n)
    ),
  "L/unquote.ex" =>
    mod.("  defmacro m(n) do\n    quote do\n      def unquote(n)(), do: :ok\n    end\n  end\n"),
  "L/test/helper.ex" => mod.(lines.(299)),
  "L/__tests__/ok.exs" => lines.(500),
  "L/colocated_test.exs" => lines.(500),
  "L/skip.gen.ex" => lines.(400),
  "L/proto.gen.v1/big.ex" => mod.(lines.(299)),
  "T/big_test.exs" => lines.(501),
  "L/m_ceiling.ex" => marked.("# size: allow 450, table", "  # size: allow 60, match", 60, 450),
  "L/m_over.ex" => marked.("# size: allow 460, table", "  # size: allow 61, match", 61, 460),
  "L/m_reasonless.ex" => marked.("# size: allow 350", "  # size: allow 45,", 45, 350),
  "L/m_unneeded.ex" => marked.("# size: allow 350, stale", "  # size: allow 50, stale", 40, 300),
  "L/m_line6.ex" => mod.("#{lines.(4)}# size: allow 400, late\n#{lines.(343)}"),
  "L/m_stale.ex" => mod.("#{lines.(5)}  # size: allow 60, old\n  @doc false\n  def f, do: :ok\n")
}

expected = """
L/big.ex:1: file, 301 lines, limit 300
L/do_literals.ex:2: def h, 53 lines, limit 40
L/do_literals.ex:55: def l, 52 lines, limit 40
L/fn.ex:2: defp f, 41 lines, limit 40
L/fn_anon.ex:2: fn, 41 lines, limit 40
L/m_ceiling.ex:1: info: size: allow 450, table
L/m_ceiling.ex:6: info: size: allow 60, match
L/m_line6.ex:1: file, 350 lines, limit 300
L/m_line6.ex:6: size marker not attached to a file header or function
L/m_over.ex:1: file, 460 lines, limit 300
L/m_over.ex:1: size marker 460 over 1.5x
L/m_over.ex:6: size marker 61 over 1.5x
L/m_over.ex:7: def f, 61 lines, limit 40
L/m_reasonless.ex:1: file, 350 lines, limit 300
L/m_reasonless.ex:1: size marker needs N and a reason
L/m_reasonless.ex:6: size marker needs N and a reason
L/m_reasonless.ex:7: def f, 45 lines, limit 40
L/m_stale.ex:7: size marker not attached to a file header or function
L/m_unneeded.ex:1: size marker not needed, 300 lines
L/m_unneeded.ex:6: size marker not needed, 40 lines
L/proto.gen.v1/big.ex:1: file, 301 lines, limit 300
L/test/helper.ex:1: file, 301 lines, limit 300
T/big_test.exs:1: file, 501 lines, limit 500
"""

uniq = "red_size_#{System.unique_integer([:positive])}"
dirs = %{"L/" => "lib/#{uniq}/", "T/" => "test/#{uniq}/"}
real = &String.replace(&1, Map.keys(dirs), fn d -> dirs[d] end)
sorted = &(&1 |> String.split("\n", trim: true) |> Enum.sort())

{out, status} =
  try do
    Enum.each(dirs, fn {_, dir} -> File.mkdir!(Path.join(root, dir)) end)

    for {rel, body} <- sized, path = Path.join(root, real.(rel)) do
      File.mkdir_p!(Path.dirname(path))
      File.write!(path, body)
    end

    args = ["bin/check_size.exs" | Enum.map(Map.keys(sized), real)]
    System.cmd("elixir", args, cd: root, stderr_to_stdout: true)
  after
    Enum.each(dirs, fn {_, dir} -> File.rm_rf!(Path.join(root, dir)) end)
  end

failures =
  if status != 0 and sorted.(out) == sorted.(real.(expected)) do
    IO.puts("ok   size: limits and allow markers")
    failures
  else
    IO.puts("FAIL size: exit #{status}, expected\n#{real.(expected)}got\n#{out}")
    failures + 1
  end

System.cmd("mix", ~w(compile --force), cd: root)
System.halt(if failures == 0, do: 0, else: 1)
