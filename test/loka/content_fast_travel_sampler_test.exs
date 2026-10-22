defmodule Loka.ContentFastTravelSamplerTest do
  use ExUnit.Case, async: true

  @kat JSON.decode!(File.read!("protocol/fixtures/fast_travel_sampler_hash.json"))

  # Breaks: a route, reverse, recipient, currency or boarding-detail short ref left a string or
  # reshaped in the artifact (protocol/fixtures/fast_travel_sampler_hash.json, pinned compiler output).
  test "fast_travel_sampler compiles to its pinned artifact without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/fast_travel_sampler") == {:ok, expected, []}
  end
end
