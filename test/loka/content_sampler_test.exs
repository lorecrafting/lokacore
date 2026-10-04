defmodule Loka.ContentSamplerTest do
  # C1 sampler: approved semantics, compiler-owned defaults and canonical bytes from
  # the stdlib Python oracle, never from the compiler or the other kernel.
  use ExUnit.Case, async: true
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_sampler_hash.json"))

  # Breaks: missing/reshaped rooms, keys, capabilities, quest/point/scene pairing or approved text.
  test "the approved sampler compiles to its independent answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/ashmere_sampler") == {:ok, expected, []}
  end
end
