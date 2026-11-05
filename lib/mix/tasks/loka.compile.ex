defmodule Mix.Tasks.Loka.Compile do
  @shortdoc "Compiles a cartridge source directory into an artifact file"
  @moduledoc """
  `mix loka.compile <source dir> <artifact path> [--allow-placeholders] [--json <path>]`: writes the
  CartridgeArtifact and prints each warning as one plain line on stderr
  (`severity: file:line what to do`), or prints each diagnostic so and exits 1 without writing. A text value of exactly `~` is a placeholder
  (docs/system/cartridge.md, Still to write): a release compile refuses each, a line at the source
  file and line that wrote it, unless `--allow-placeholders` is given (the author preview always
  gives it). `--json <path>` also writes every printed diagnostic, split, to that file as
  `[{severity, code, path, rel, line, column, words}]` (the author preview's cards place them).
  `--placeholders <path>` (after `--allow-placeholders --json <path>`) writes each placeholder's
  text key => `file:line` (Loka.Content.placeholder_lines/2), for the in-Book editor.

  `mix loka.compile --serve` (the author preview's resident compiler, docs/system/cartridge.md,
  Author preview): each stdin line is the arguments above, tab-separated; each compile writes the
  same files and answers one stdout line `loka.compile {"status":0|1,"stderr":<the lines it would
  print>}`. Before each it runs the project's compilers (Boundary's too) and halts (75) if the
  Elixir manifest changed since it started, by that compile or by any other mix, so no request is
  served by stale modules: the caller reruns it one-shot, on the new code. It halts on any other
  failure too, and at the end of stdin.
  """
  use Mix.Task
  use Boundary, top_level?: true, deps: [Loka.Content, Mix]

  @usage "usage: mix loka.compile <source dir> <artifact path> [--allow-placeholders] [--json <path>] [--placeholders <path>] | mix loka.compile --serve"
  # mix itself writes to stdout too ("Compiling 1 file"): a reply is the line with this prefix
  @reply "loka.compile "

  @impl Mix.Task
  def run(["--serve"]) do
    built = built()

    for line <- IO.stream(:stdio, :line) do
      if built() != built, do: System.halt(75)
      {status, lines} = compile(String.split(String.trim_trailing(line, "\n"), "\t"))
      stderr = Enum.map_join(lines, &(&1 <> "\n"))
      IO.puts(@reply <> JSON.encode!(%{status: status, stderr: stderr}))
    end
  end

  def run(args) do
    {status, lines} = compile(args)
    Enum.each(lines, &IO.puts(:stderr, &1))
    if status != 0, do: exit({:shutdown, status})
  end

  defp compile([dir, out | opts]) do
    {allow, json, held} = options(opts)
    if !File.dir?(dir), do: Mix.raise("mix loka.compile: #{dir} is not a directory")
    result = compiled(Loka.Content.compile(dir), dir, out, allow, json)

    if held && elem(result, 0) == 0,
      do: File.write!(held, JSON.encode!(Loka.Content.placeholder_lines(File.read!(out), dir)))

    result
  end

  defp compile(_), do: Mix.raise(@usage)

  # IEx's recompile/0: `rerun("compile")` alone runs no compiler twice
  defp built do
    chain = Enum.map(Mix.Project.config()[:compilers], &"compile.#{&1}")
    Enum.each(["compile", "compile.all", "compile.protocols" | chain], &Mix.Task.reenable/1)
    Mix.Task.run("compile")
    File.read!(Path.join(Mix.Project.manifest_path(), "compile.elixir"))
  end

  defp compiled({:ok, bytes, warnings}, dir, out, allow, json) do
    left = if allow, do: [], else: Loka.Content.placeholders(bytes, dir)
    # Warnings, then the placeholder refusals, each its own sorted block as before --json.
    split(json, warnings ++ left, dir)
    if left == [], do: File.write!(out, bytes)
    {if(left == [], do: 0, else: 1), said(warnings, dir) ++ said(left, dir)}
  end

  defp compiled({:error, diags}, dir, _, _, json) do
    split(json, diags, dir)
    {1, said(diags, dir)}
  end

  defp options([]), do: {false, nil, nil}
  defp options(["--allow-placeholders"]), do: {true, nil, nil}
  defp options(["--json", json]), do: {false, json, nil}
  defp options(["--allow-placeholders", "--json", json]), do: {true, json, nil}

  defp options(["--allow-placeholders", "--json", json, "--placeholders", held]),
    do: {true, json, held}

  defp options(_), do: Mix.raise(@usage)

  defp said(diags, dir), do: Loka.Content.explained(diags, dir)

  defp split(nil, _, _), do: :ok

  defp split(json, diags, dir),
    do: File.write!(json, JSON.encode!(Loka.Content.explained_entries(diags, dir)))
end
