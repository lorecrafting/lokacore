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

    # Each pair may read what an earlier one wrote, so they run for real; a refusal puts it all back.
    {last, paths, _} =
      Enum.reduce(pairs, {Path.expand(dir || ".", cwd), [], %{}}, &starter(&1, &2, cwd))

    report(paths, last)
  end

  defp report(paths, last) do
    Enum.each(paths, &IO.puts/1)
    {todo, _} = System.cmd("node", ["kernel/ts/play/todo.ts", last])

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

  defp starter({"cartridge", path, from}, {_, paths, snaps}, cwd),
    do: starter("cartridge", Path.expand(path, cwd), from, {Path.expand(path, cwd), paths, snaps})

  defp starter({kind, name, from}, state, _cwd), do: starter(kind, name, from, state)

  defp starter(kind, name, from, {target, paths, snaps}) do
    snaps = Map.put_new_lazy(snaps, target, fn -> snapshot(target) end)

    case Loka.Content.new(target, kind, name, from) do
      {:ok, written} ->
        {target, paths ++ written, snaps}

      {:error, line} ->
        Enum.each(snaps, &restore/1)
        Mix.raise("mix loka.new: #{line}")
    end
  end

  # Every entry under a cartridge dir (a file's bytes, or :dir); :absent when it is yet to be made.
  defp snapshot(dir) do
    if File.dir?(dir),
      do:
        Map.new(
          Path.wildcard(dir <> "/**", match_dot: true),
          &{&1, File.dir?(&1) || File.read!(&1)}
        ),
      else: :absent
  end

  defp restore({dir, :absent}), do: File.rm_rf!(dir)

  defp restore({dir, before}) do
    for path <- Path.wildcard(dir <> "/**", match_dot: true) |> Enum.sort(:desc),
        !is_map_key(before, path),
        do: File.rm_rf!(path)

    for {path, bytes} <- before,
        is_binary(bytes),
        File.read(path) != {:ok, bytes},
        do: File.write!(path, bytes)
  end

  defp plan(["--from", room, way | rest], [{"rooms", name, nil} | done]),
    do: plan(rest, [{"rooms", name, {room, way}} | done])

  defp plan(["--" <> _ | _], _), do: Mix.raise(@usage)
  defp plan([kind, name | rest], done), do: plan(rest, [{kind, name, nil} | done])
  defp plan(rest, done), do: {Enum.reverse(done), List.first(rest)}
end
