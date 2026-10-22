defmodule Loka.ContentDerivedSamplerTest do
  use ExUnit.Case, async: true

  @kat JSON.decode!(File.read!("protocol/fixtures/derived_sampler_hash.json"))

  # Breaks: an ancestry, attribute or derived-table term dropped or reshaped
  # in the artifact (protocol/fixtures/derived_sampler_hash.json, pinned compiler output).
  test "derived_sampler compiles to its pinned artifact without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/derived_sampler") == {:ok, expected, []}
  end
end
