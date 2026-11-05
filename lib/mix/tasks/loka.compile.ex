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
  """
  use Mix.Task
  use Boundary, top_level?: true, deps: [Loka.Content, Mix]

  @usage "usage: mix loka.compile <source dir> <artifact path> [--allow-placeholders] [--json <path>]"

  @impl Mix.Task
  def run([dir, out | opts]) do
    {allow, json} = options(opts)
    if !File.dir?(dir), do: Mix.raise("mix loka.compile: #{dir} is not a directory")
    compiled(Loka.Content.compile(dir), dir, out, allow, json)
  end

  def run(_), do: Mix.raise(@usage)

  defp compiled({:ok, bytes, warnings}, dir, out, allow, json) do
    left = if allow, do: [], else: Loka.Content.placeholders(bytes, dir)
    # Warnings, then the placeholder refusals, each its own sorted block as before --json.
    said(warnings, dir)
    said(left, dir)
    split(json, warnings ++ left, dir)
    if left != [], do: exit({:shutdown, 1})
    File.write!(out, bytes)
  end

  defp compiled({:error, diags}, dir, _, _, json) do
    said(diags, dir)
    split(json, diags, dir)
    exit({:shutdown, 1})
  end

  defp options([]), do: {false, nil}
  defp options(["--allow-placeholders"]), do: {true, nil}
  defp options(["--json", json]), do: {false, json}
  defp options(["--allow-placeholders", "--json", json]), do: {true, json}
  defp options(_), do: Mix.raise(@usage)

  defp said(diags, dir),
    do: diags |> Loka.Content.explained(dir) |> Enum.each(&IO.puts(:stderr, &1))

  defp split(nil, _, _), do: :ok

  defp split(json, diags, dir),
    do: File.write!(json, JSON.encode!(Loka.Content.explained_entries(diags, dir)))
end
