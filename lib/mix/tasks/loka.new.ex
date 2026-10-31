defmodule Mix.Tasks.Loka.New do
  @shortdoc "Writes a compiling starter of one source kind into a cartridge"
  @moduledoc """
  `mix loka.new <kind> <name> [cartridge dir]`: writes the kind's starter (every line a `~`
  placeholder) into the cartridge (default `.`) and prints each file it wrote; `mix loka.new
  cartridge <dir>` makes a new cartridge. One line names what is missing and exits 1.
  """
  use Mix.Task
  use Boundary, top_level?: true, deps: [Loka.Content, Mix]

  @impl Mix.Task
  def run([kind, name | rest]) when rest == [] or tl(rest) == [] do
    dir = List.first(rest, ".")

    case Loka.Content.new(dir, kind, name) do
      {:ok, paths} -> Enum.each(paths, &IO.puts/1)
      {:error, line} -> Mix.raise("mix loka.new: #{line}")
    end
  end

  def run(_), do: Mix.raise("usage: mix loka.new <kind> <name> [cartridge dir]")
end
