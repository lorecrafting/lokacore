# Size-limit red controls run separately to keep the main planted-check script within its source limit.
root = Path.expand("..", __DIR__)

verdict = fn name, ok?, detail ->
  IO.puts(if(ok?, do: "ok   #{name}", else: "FAIL #{name}: #{detail}"))
  if(ok?, do: 0, else: 1)
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
  "L/deps/big.ex" => mod.(lines.(299)),
  "T/big_helper.ex" => mod.("  def f(x) do\n#{lines.(39)}  end\n#{lines.(458)}"),
  "L/m_early_fn.ex" =>
    mod.("#{lines.(3)}  # size: allow 50, early\n  def f(x) do\n#{lines.(39)}  end\n"),
  "L/m_ceiling.ex" => marked.("# size: allow 450, table", "  # size: allow 60, match", 60, 450),
  "L/m_over.ex" => marked.("# size: allow 460, table", "  # size: allow 61, match", 61, 460),
  "L/m_reasonless.ex" => marked.("# size: allow 350", "  # size: allow 45,", 45, 350),
  "L/m_unneeded.ex" => marked.("# size: allow 350, stale", "  # size: allow 50, stale", 40, 300),
  "L/m_line5.ex" => mod.("#{lines.(3)}# size: allow 400, late\n#{lines.(344)}"),
  "L/m_line6.ex" => mod.("#{lines.(4)}# size: allow 400, late\n#{lines.(343)}"),
  "L/m_stale.ex" => mod.("#{lines.(5)}  # size: allow 60, old\n  @doc false\n  def f, do: :ok\n")
}

expected = """
L/big.ex:1: file, 301 lines, limit 300
L/deps/big.ex:1: file, 301 lines, limit 300
L/m_early_fn.ex:5: size marker not needed, 47 lines
L/m_early_fn.ex:6: def f, 41 lines, limit 40
L/do_literals.ex:2: def h, 53 lines, limit 40
L/do_literals.ex:55: def l, 52 lines, limit 40
L/fn.ex:2: defp f, 41 lines, limit 40
L/fn_anon.ex:2: fn, 41 lines, limit 40
L/m_ceiling.ex:1: info: size: allow 450, table
L/m_ceiling.ex:6: info: size: allow 60, match
L/m_line5.ex:5: info: size: allow 400, late
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
T/big_helper.ex:1: file, 501 lines, limit 500
"""

uniq = "red_size_#{System.unique_integer([:positive])}"
dirs = %{"L/" => "lib/#{uniq}/", "T/" => "test/#{uniq}/"}
real = &String.replace(&1, Map.keys(dirs), fn d -> dirs[d] end)
sorted = &(&1 |> String.split("\n", trim: true) |> Enum.sort())

{out, status, scan_out, scan_status} =
  try do
    Enum.each(dirs, fn {_, dir} -> File.mkdir!(Path.join(root, dir)) end)

    for {rel, body} <- sized, path = Path.join(root, real.(rel)) do
      File.mkdir_p!(Path.dirname(path))
      File.write!(path, body)
    end

    args = ["bin/check_size.exs" | Enum.map(Map.keys(sized), real)]
    {out, status} = System.cmd("elixir", args, cd: root, stderr_to_stdout: true)
    # The no-argument scan (what CI runs) must find a planted file too.
    {scan_out, scan_status} = System.cmd("elixir", ["bin/check_size.exs"], cd: root)
    {out, status, scan_out, scan_status}
  after
    Enum.each(dirs, fn {_, dir} -> File.rm_rf!(Path.join(root, dir)) end)
  end

failures =
  verdict.(
    "size: limits and allow markers",
    status != 0 and sorted.(out) == sorted.(real.(expected)) and scan_status != 0 and
      String.contains?(scan_out, real.("L/big.ex:1: file, 301 lines, limit 300")),
    "exit #{status}, expected\n#{real.(expected)}got\n#{out}" <>
      "no-argument scan: exit #{scan_status}\n#{scan_out}"
  )

System.halt(failures)
