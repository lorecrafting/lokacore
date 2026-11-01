defmodule Mix.Tasks.Loka.Compile do
  @shortdoc "Compiles a cartridge source directory into an artifact file"
  @moduledoc """
  `mix loka.compile <source dir> <artifact path> [--allow-placeholders]`: writes the
  CartridgeArtifact and prints each warning as one plain line on stderr
  (`severity: file:line what to do`), or prints each diagnostic so and exits 1 without writing. A text value of exactly `~` is a placeholder
  (docs/system/cartridge.md, Still to write): a release compile refuses each as
  `placeholder_text at text.<key>` unless `--allow-placeholders` is given (the author preview
  always gives it).
  """
  use Mix.Task
  use Boundary, top_level?: true, deps: [Loka.Content, Mix]

  @impl Mix.Task
  def run([dir, out | allow]) when allow in [[], ["--allow-placeholders"]] do
    if !File.dir?(dir), do: Mix.raise("mix loka.compile: #{dir} is not a directory")

    case Loka.Content.compile(dir) do
      {:ok, bytes, warnings} ->
        said(warnings, dir)
        written(out, bytes, allow)

      {:error, diags} ->
        said(diags, dir)
        exit({:shutdown, 1})
    end
  end

  def run(_),
    do: Mix.raise("usage: mix loka.compile <source dir> <artifact path> [--allow-placeholders]")

  defp said(diags, dir),
    do: diags |> Loka.Content.explained(dir) |> Enum.each(&IO.puts(:stderr, &1))

  defp written(out, bytes, ["--allow-placeholders"]), do: File.write!(out, bytes)

  defp written(out, bytes, []) do
    case placeholders(bytes) do
      [] ->
        File.write!(out, bytes)

      left ->
        Enum.each(left, &IO.puts(:stderr, "placeholder_text at text.#{&1}"))
        exit({:shutdown, 1})
    end
  end

  # Inline prose and scene files are already lowered to text keys in the artifact, so its catalog
  # holds every line in every form the tools accept (a scene joins its speaker's lines with \\n).
  defp placeholders(bytes) do
    for {key, text} <- Map.get(JSON.decode!(bytes)["cartridge"], "text", %{}),
        text |> String.split("\n") |> Enum.any?(&(String.trim(&1) == "~")),
        do: key
  end
end
