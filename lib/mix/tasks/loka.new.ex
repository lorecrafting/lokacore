defmodule Mix.Tasks.Loka.New do
  @shortdoc "Writes compiling starters of source kinds into a cartridge"
  @moduledoc """
  `mix loka.new [--cwd <dir>] <kind> <name> [--from <room> <direction>] ... [cartridge dir]`: writes
  each pair's starter (every line a `~` placeholder) into the cartridge (default `.`; a `cartridge
  <dir>` pair makes one and targets it for the pairs after it), prints each file it wrote and ends
  with what to fill and the next command. `--from` follows a `rooms` pair; `--cwd` is the directory
  relative paths resolve against. One line names what is missing and exits 1; the pairs before it
  stay written.
  """
  use Mix.Task
  use Boundary, top_level?: true, deps: [Loka.Content, Mix]

  @usage "usage: mix loka.new <kind> <name> [--from <room> <direction>] ... [cartridge dir]"

  @impl Mix.Task
  def run(["--cwd", cwd | args]), do: new(args, cwd)
  def run(args), do: new(args, File.cwd!())

  defp new(args, cwd) do
    {pairs, dir} = plan(args, [])
    if pairs == [], do: Mix.raise(@usage)
    last = Enum.reduce(pairs, Path.expand(dir, cwd), &starter(&1, &2, cwd))
    IO.puts("Fill the ~ lines (bin/loka todo #{last}), then run: bin/loka dev #{last} --watch")
  end

  defp starter({"cartridge", path, nil}, _dir, cwd) do
    path = Path.expand(path, cwd)
    said(Loka.Content.new(path, "cartridge", path, nil))
    path
  end

  defp starter({kind, name, from}, dir, _cwd) do
    said(Loka.Content.new(dir, kind, name, from))
    dir
  end

  defp said({:ok, paths}), do: Enum.each(paths, &IO.puts/1)
  defp said({:error, line}), do: Mix.raise("mix loka.new: #{line}")

  defp plan(["--from", room, way | rest], [{"rooms", name, nil} | done]),
    do: plan(rest, [{"rooms", name, {room, way}} | done])

  defp plan(["--" <> _ | _], _), do: Mix.raise(@usage)
  defp plan([kind, name | rest], done), do: plan(rest, [{kind, name, nil} | done])
  defp plan(rest, done), do: {Enum.reverse(done), List.first(rest, ".")}
end
