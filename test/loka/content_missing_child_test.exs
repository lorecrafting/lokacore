defmodule Loka.ContentMissingChildTest do
  use ExUnit.Case, async: true
  @kat JSON.decode!(File.read!("protocol/fixtures/missing_child_v010_hash.json"))

  # Breaks: active chapter geometry, retired definitions, reward bindings or title drift.
  test "the chapter in progress compiles to its independent answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/ashmere_missing_child") == {:ok, expected, []}
  end
end
