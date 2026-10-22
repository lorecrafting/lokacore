defmodule Loka.ContentShooSamplerTest do
  use ExUnit.Case, async: true

  @kat JSON.decode!(File.read!("protocol/fixtures/shoo_sampler_hash.json"))

  # Breaks: a sight, scavenge or population short ref left a string or reshaped in the artifact
  # (protocol/fixtures/shoo_sampler_hash.json, pinned compiler output).
  test "shoo_sampler compiles to its pinned artifact without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/shoo_sampler") == {:ok, expected, []}
  end
end
