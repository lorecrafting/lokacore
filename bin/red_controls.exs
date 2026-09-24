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
   }, ~w(mix compile --warnings-as-errors --force), "forbidden reference to Loka.Store"},
  {"boundary: core calls an undeclared external app",
   %{
     "lib/loka/core/red_control.ex" =>
       "defmodule Loka.Core.RedControl do\n  def x, do: Logger.flush()\nend\n"
   }, ~w(mix compile --warnings-as-errors --force), "forbidden reference to Logger"},
  {"xref: dependency cycle",
   %{
     "lib/loka/content/red_control_a.ex" =>
       "defmodule Loka.Content.RedA do\n  def a, do: Loka.Content.RedB.b()\nend\n",
     "lib/loka/content/red_control_b.ex" =>
       "defmodule Loka.Content.RedB do\n  def b, do: Loka.Content.RedA.a()\nend\n"
   }, ~w(mix xref graph --format cycles --fail-above 0), "Too many cycles"},
  {"xref: compile-connected edge",
   %{
     "lib/loka/content/red_control_x.ex" =>
       "defmodule Loka.Content.RedX do\n  def a, do: Loka.Content.RedZ.c()\nend\n",
     "lib/loka/content/red_control_y.ex" =>
       "defmodule Loka.Content.RedY do\n  @x Loka.Content.RedX.a()\n  def b, do: @x\nend\n",
     "lib/loka/content/red_control_z.ex" =>
       "defmodule Loka.Content.RedZ do\n  def c, do: :ok\nend\n"
   }, ~w(mix xref graph --label compile-connected --fail-above 0), "Too many references"},
  {"contracts: schema changed without regenerating the TypeScript",
   %{"protocol/red_control.schema.json" => ~s({"$defs": {"RedControl": {"type": "null"}}})},
   ~w(elixir bin/contracts.exs --check), "contracts.gen.ts is out of date"},
  {"contracts: unsupported keyword fails compilation",
   %{
     "protocol/red_control.schema.json" =>
       ~s({"$defs": {"RedControl": {"type": "string", "format": "uuid"}}})
   }, ~w(mix compile --warnings-as-errors --force), "unsupported keyword format"},
  {"contracts: unsupported keyword fails generation",
   %{
     "protocol/red_control.schema.json" =>
       ~s({"$defs": {"RedControl": {"type": "string", "format": "uuid"}}})
   }, ~w(elixir bin/contracts.exs --check), "unsupported keyword format"}
]

failures =
  for {name, files, [cmd | args], expected} <- controls, reduce: 0 do
    acc ->
      paths =
        Enum.map(files, fn {rel, body} ->
          path = Path.join(root, rel)
          File.mkdir_p!(Path.dirname(path))
          tap(path, &File.write!(&1, body))
        end)

      {out, status} =
        try do
          System.cmd(cmd, args, cd: root, stderr_to_stdout: true)
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

System.cmd("mix", ~w(compile --force), cd: root)
System.halt(if failures == 0, do: 0, else: 1)
