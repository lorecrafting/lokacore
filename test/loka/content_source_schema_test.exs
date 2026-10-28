defmodule Loka.ContentSourceSchemaTest do
  use ExUnit.Case, async: true

  # The committed source JSON Schemas (docs/system/cartridge.md, Source schema) are the
  # generator's output; kernel/ts/test/source_schema.test.ts validates the corpus with them.
  @dir "schemas/source"

  test "schemas/source matches the generator byte for byte" do
    on_disk = Map.new(File.ls!(@dir), &{&1, File.read!(Path.join(@dir, &1))})

    assert on_disk == Loka.Content.source_schema(),
           "schemas/source is stale: run `mix loka.source_schema`"
  end
end
