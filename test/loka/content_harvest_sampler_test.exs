defmodule Loka.ContentHarvestSamplerTest do
  use ExUnit.Case, async: true

  @kat JSON.decode!(File.read!("protocol/fixtures/harvest_sampler_hash.json"))

  # Breaks: a harvest seam, careful method or skill short ref left a string or reshaped in the artifact
  # (protocol/fixtures/harvest_sampler_hash.json, pinned compiler output).
  test "harvest_sampler compiles to its pinned artifact without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/harvest_sampler") == {:ok, expected, []}
  end
end
