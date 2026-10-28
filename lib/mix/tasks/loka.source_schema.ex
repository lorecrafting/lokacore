defmodule Mix.Tasks.Loka.SourceSchema do
  @shortdoc "Writes the source JSON Schema files to schemas/source/"
  @moduledoc """
  `mix loka.source_schema`: writes one JSON Schema per source file kind and the shared
  defs.schema.json to schemas/source/ (Loka.Content.SourceSchema), removing stale ones. A test
  fails when the committed files differ from what this writes.
  """
  use Mix.Task
  use Boundary, top_level?: true, deps: [Loka.Content, Mix]

  @dir "schemas/source"

  @impl Mix.Task
  def run([]) do
    files = Loka.Content.source_schema()
    File.mkdir_p!(@dir)
    for f <- File.ls!(@dir), not is_map_key(files, f), do: File.rm!(Path.join(@dir, f))
    for {f, text} <- files, do: File.write!(Path.join(@dir, f), text)
    Mix.shell().info("wrote #{map_size(files)} files to #{@dir}")
  end

  def run(_), do: Mix.raise("usage: mix loka.source_schema")
end
