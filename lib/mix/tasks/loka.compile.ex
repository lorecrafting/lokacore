defmodule Mix.Tasks.Loka.Compile do
  @shortdoc "Compiles a cartridge source directory into an artifact file"
  @moduledoc """
  `mix loka.compile <source dir> <artifact path> [--allow-placeholders]`: writes the
  CartridgeArtifact and prints each warning as one plain line on stderr
  (`severity: file:line what to do`), or prints each diagnostic so and exits 1 without writing. A text value of exactly `~` is a placeholder
  (docs/system/cartridge.md, Still to write): a release compile refuses each, a line at the source
  file and line that wrote it, unless `--allow-placeholders` is given (the author preview always
  gives it).
  """
  use Mix.Task
  use Boundary, top_level?: true, deps: [Loka.Content, Mix]

  @impl Mix.Task
  def run([dir, out | allow]) when allow in [[], ["--allow-placeholders"]] do
    if !File.dir?(dir), do: Mix.raise("mix loka.compile: #{dir} is not a directory")

    case Loka.Content.compile(dir) do
      {:ok, bytes, warnings} ->
        said(warnings, dir)
        written(out, bytes, dir, allow)

      {:error, diags} ->
        said(diags, dir)
        exit({:shutdown, 1})
    end
  end

  def run(_),
    do: Mix.raise("usage: mix loka.compile <source dir> <artifact path> [--allow-placeholders]")

  defp said(diags, dir),
    do: diags |> Loka.Content.explained(dir) |> Enum.each(&IO.puts(:stderr, &1))

  defp written(out, bytes, _, ["--allow-placeholders"]), do: File.write!(out, bytes)

  defp written(out, bytes, dir, []) do
    case Loka.Content.placeholders(bytes, dir) do
      [] ->
        File.write!(out, bytes)

      left ->
        said(left, dir)
        exit({:shutdown, 1})
    end
  end
end
