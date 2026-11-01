defmodule Mix.Tasks.Loka.New do
  @shortdoc "Writes compiling starters of source kinds into a cartridge"
  @moduledoc """
  `mix loka.new [--cwd <dir>] <kind> <name> [--from <room> <direction>] ... [cartridge dir]`: writes
  each pair's starter (every line a `~` placeholder) into the cartridge (default `.`; a `cartridge
  <dir>` pair makes one and targets it for the pairs after it), prints each file it wrote and ends
  with what to fill (`bin/loka todo`'s list) and the next command. `--from` follows a `rooms` pair;
  `--cwd` is the directory relative paths resolve against. One line names what is missing and exits
  1, and then nothing is written: the files the earlier pairs wrote are put back.
  """
  use Mix.Task
  use Boundary, top_level?: true, deps: [Loka.Content, Mix]

  @usage "usage: mix loka.new <kind> <name> [--from <room> <direction>] ... [cartridge dir]"

  @impl Mix.Task
  def run(["--cwd", cwd | args]), do: new(args, cwd)
  def run(args), do: new(args, File.cwd!())

  defp new(args, cwd) do
    {pairs, dir} = plan(args, [])
    # A cartridge pair names its own directory; a trailing one would be silently ignored.
    if pairs == [] or (dir && List.keymember?(pairs, "cartridge", 0)), do: Mix.raise(@usage)
    Enum.each(pairs, &known_kind/1)

    # Each pair may read what an earlier one wrote, so they run for real. A refusal or a raise puts
    # back only what this run wrote (Starters tells us before each write), never anything else.
    Process.put(:loka_new_log, [])

    {last, paths} =
      try do
        Enum.reduce(pairs, {Path.expand(dir || ".", cwd), []}, &starter(&1, &2, cwd))
      rescue
        e ->
          undo(Process.get(:loka_new_log))
          reraise e, __STACKTRACE__
      end

    report(paths, last)
  end

  defp report(paths, last) do
    paths |> Enum.uniq() |> Enum.each(&IO.puts/1)

    todo =
      with node when node != nil <- System.find_executable("node"),
           {out, 0} <- System.cmd(node, ["kernel/ts/play/todo.ts", last], stderr_to_stdout: true) do
        out
      else
        _ -> "(the list is not available: run bin/loka todo #{last})\n"
      end

    IO.puts(
      "Still to write:\n" <>
        todo <> "Fill the ~ lines (bin/loka todo #{last}), then run: bin/loka dev #{last} --watch"
    )
  end

  # Before any write: a surplus argument reads as a kind.
  defp known_kind({kind, _, _}) do
    if kind not in Loka.Content.kinds(),
      do:
        Mix.raise(
          "mix loka.new: unknown kind #{inspect(kind)}; one of: #{Enum.join(Loka.Content.kinds(), " ")}"
        )
  end

  defp starter({"cartridge", path, from}, {_, paths}, cwd),
    do: starter("cartridge", Path.expand(path, cwd), from, {Path.expand(path, cwd), paths})

  defp starter({kind, name, from}, state, _cwd), do: starter(kind, name, from, state)

  defp starter(kind, name, from, {target, paths}) do
    case Loka.Content.new(target, kind, name, from, &record/2) do
      {:ok, written} ->
        {target, paths ++ written}

      {:error, line} ->
        Mix.raise("mix loka.new: #{line}")
    end
  end

  # Before a write: the path, its old bytes (nil: new), and the directories the write will make.
  defp record(path, old) do
    made =
      path
      |> Path.dirname()
      |> Stream.iterate(&Path.dirname/1)
      |> Enum.take_while(&(!File.dir?(&1)))

    Process.put(:loka_new_log, [{path, old, made} | Process.get(:loka_new_log)])
  end

  @doc false
  # ponytail: a save to a file an earlier pair merged into, between pairs, is overwritten by the
  # undo; a run lasts seconds. Upgrade: compare the bytes now with what the starter wrote.
  # Newest first: new files go, old bytes come back, and a directory the run made goes only if empty.
  def undo(log) do
    for {path, old, made} <- log do
      if old, do: File.write!(path, old), else: File.rm(path)
      Enum.each(made, &File.rmdir/1)
    end
  end

  defp plan(["--from", room, way | rest], [{"rooms", name, nil} | done]),
    do: plan(rest, [{"rooms", name, {room, way}} | done])

  defp plan(["--" <> _ | _], _), do: Mix.raise(@usage)
  defp plan([kind, name | rest], done), do: plan(rest, [{kind, name, nil} | done])
  defp plan(rest, done), do: {Enum.reverse(done), List.first(rest)}
end
