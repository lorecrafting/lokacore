defmodule Mix.Tasks.Loka.Compile do
  @shortdoc "Compiles a cartridge source directory into an artifact file"
  @moduledoc """
  `mix loka.compile <source dir> <artifact path>`: writes the CartridgeArtifact, or prints
  each diagnostic as one JSON line on stderr and exits 1 without writing.
  """
  use Mix.Task
  use Boundary, top_level?: true, deps: [Loka.Content, Mix]

  @impl Mix.Task
  def run([dir, out]) do
    case Loka.Content.compile(dir) do
      {:ok, bytes} ->
        File.write!(out, bytes)

      {:error, diags} ->
        for d <- diags, do: IO.puts(:stderr, JSON.encode!(d))
        exit({:shutdown, 1})
    end
  end

  def run(_), do: Mix.raise("usage: mix loka.compile <source dir> <artifact path>")
end
