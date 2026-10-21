defmodule Mix.Tasks.Loka.Lint do
  @shortdoc "Lints a story cartridge source directory"
  @moduledoc """
  `mix loka.lint <source dir>`: prints each author-time finding (Loka.Content.Lint) as one
  line on stderr and exits 1 when there is any.
  """
  use Mix.Task
  use Boundary, top_level?: true, deps: [Loka.Content, Mix]

  @impl Mix.Task
  def run([dir]) do
    if !File.dir?(dir), do: Mix.raise("mix loka.lint: #{dir} is not a directory")

    case Loka.Content.lint(dir) do
      [] ->
        :ok

      findings ->
        Enum.each(findings, &IO.puts(:stderr, &1))
        exit({:shutdown, 1})
    end
  end

  def run(_), do: Mix.raise("usage: mix loka.lint <source dir>")
end
