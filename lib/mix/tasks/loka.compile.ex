defmodule Mix.Tasks.Loka.Compile do
  @shortdoc "Compiles a cartridge source directory into an artifact file"
  @moduledoc """
  `mix loka.compile <source dir> <artifact path> [--allow-placeholders]`: writes the
  CartridgeArtifact and prints each warning as one JSON line on stderr, or prints each
  diagnostic so and exits 1 without writing. A text value of exactly `~` is a placeholder
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
        said(warnings)
        written(out, bytes, allow)

      {:error, diags} ->
        said(diags)
        exit({:shutdown, 1})
    end
  end

  def run(_),
    do: Mix.raise("usage: mix loka.compile <source dir> <artifact path> [--allow-placeholders]")

  defp said(lines), do: Enum.each(lines, &IO.puts(:stderr, JSON.encode!(&1)))

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

  # Inline prose is already lowered to text keys in the artifact, so its catalog holds every line.
  defp placeholders(bytes),
    do: for({key, "~"} <- Map.get(JSON.decode!(bytes)["cartridge"], "text", %{}), do: key)
end
