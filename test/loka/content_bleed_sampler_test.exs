defmodule Loka.ContentBleedSamplerTest do
  use ExUnit.Case, async: true

  @kat JSON.decode!(File.read!("protocol/fixtures/bleed_sampler_hash.json"))

  # Breaks: a bleed, hound hit or bandage short ref left a string or reshaped in the artifact
  # (protocol/fixtures/bleed_sampler_hash.json, pinned compiler output).
  test "bleed_sampler compiles to its pinned artifact without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/bleed_sampler") == {:ok, expected, []}
  end
end
