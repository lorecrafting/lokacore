defmodule Loka.Content.SourceFiles do
  @moduledoc "The source files of a cartridge directory."

  @doc "Every source file under `dir`, relative to it."
  @spec paths(Path.t()) :: [Path.t()]
  def paths(dir) do
    # The directory name is literal, not glob syntax.
    String.replace(dir, ~r/[\[\]{}*?\\]/, "\\\\\\0")
    |> Path.join("**/*.{json,scene,cut}")
    |> Path.wildcard(match_dot: true)
    |> Enum.filter(&File.regular?/1)
    |> Enum.map(&Path.relative_to(&1, dir))
    # checkpoints/ holds the author preview's recorded paths, not content
    |> Enum.reject(&String.starts_with?(&1, "checkpoints/"))
  end
end
