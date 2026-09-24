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
   }, ~w(credo --strict --verbose), "[Credo.Check.Refactor.Nesting]"}
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

# Size limits: one line over each limit fails, exactly at the limit (red_size_ok) passes.
# Markers: at the 1.5x ceiling passes; over it, without a reason, or not needed fails.
lines = &String.duplicate("  x\n", &1)

# `total` lines: file marker line 1, function marker line 3, `def f` of `fun` lines at line 4.
marked = fn file_marker, fn_marker, fun, total ->
  "#{file_marker}\ndefmodule Loka.RedSize do\n#{fn_marker}\n  def f(x) do\n#{lines.(fun - 2)}  end\n" <>
    "#{lines.(total - fun - 4)}end\n"
end

sized = %{
  "lib/loka/red_size_big.ex" => "defmodule Loka.RedSizeBig do\n#{lines.(299)}end\n",
  "lib/loka/red_size_fn.ex" =>
    "defmodule Loka.RedSizeFn do\n  defp f(x) do\n#{lines.(39)}  end\nend\n",
  "lib/loka/red_size_ok.ex" =>
    "defmodule Loka.RedSizeOk do\n  def f(x) do\n#{lines.(38)}  end\n#{lines.(258)}end\n",
  "test/red_size_test.exs" => lines.(501),
  "lib/loka/red_size_m_ceiling.ex" =>
    marked.("# size: allow 450, table", "  # size: allow 60, match", 60, 450),
  "lib/loka/red_size_m_over.ex" =>
    marked.("# size: allow 460, table", "  # size: allow 61, match", 61, 460),
  "lib/loka/red_size_m_reasonless.ex" =>
    marked.("# size: allow 350", "  # size: allow 45,", 45, 350),
  "lib/loka/red_size_m_unneeded.ex" =>
    marked.("# size: allow 350, stale", "  # size: allow 50, stale", 40, 300),
  "lib/loka/red_size_m_fn_only.ex" => marked.("", "  # size: allow 50, match", 50, 100)
}

expected = """
lib/loka/red_size_big.ex:1: file, 301 lines, limit 300
lib/loka/red_size_fn.ex:2: defp f, 41 lines, limit 40
lib/loka/red_size_m_ceiling.ex:1: info: size: allow 450, table
lib/loka/red_size_m_ceiling.ex:3: info: size: allow 60, match
lib/loka/red_size_m_fn_only.ex:3: info: size: allow 50, match
lib/loka/red_size_m_over.ex:1: size marker 460 over the 1.5x ceiling
lib/loka/red_size_m_over.ex:1: file, 460 lines, limit 300
lib/loka/red_size_m_over.ex:3: size marker 61 over the 1.5x ceiling
lib/loka/red_size_m_over.ex:4: def f, 61 lines, limit 40
lib/loka/red_size_m_reasonless.ex:1: size marker without a reason
lib/loka/red_size_m_reasonless.ex:1: file, 350 lines, limit 300
lib/loka/red_size_m_reasonless.ex:3: size marker without a reason
lib/loka/red_size_m_reasonless.ex:4: def f, 45 lines, limit 40
lib/loka/red_size_m_unneeded.ex:1: size marker not needed (350, stale), 300 lines
lib/loka/red_size_m_unneeded.ex:3: size marker not needed (50, stale), 40 lines
test/red_size_test.exs:1: file, 501 lines, limit 500
"""

{out, status} =
  try do
    Enum.each(sized, fn {rel, body} -> File.write!(Path.join(root, rel), body) end)
    System.cmd("elixir", ["bin/check_size.exs"], cd: root, stderr_to_stdout: true)
  after
    Enum.each(sized, fn {rel, _} -> File.rm(Path.join(root, rel)) end)
  end

failures =
  if status != 0 and out == expected do
    IO.puts("ok   size: limits and allow markers")
    failures
  else
    IO.puts("FAIL size: exit #{status}, expected\n#{expected}got\n#{out}")
    failures + 1
  end

System.cmd("mix", ~w(compile --force), cd: root)
System.halt(if failures == 0, do: 0, else: 1)
