defmodule Loka.ContentR9cInteractionsTest do
  # The synthetic E2 cartridge; its answer is written by test/loka/cartridge_r9c_interactions_hash.py.
  use ExUnit.Case, async: true
  @kat JSON.decode!(File.read!("protocol/fixtures/r9c_interactions_hash.json"))

  # Breaks: a short source reference stays unexpanded, a removed definition or moved value
  # drifts, or the compiler's bytes differ from the ones the TypeScript loader admits.
  test "the synthetic source compiles to its independent answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/r9c_interactions") == {:ok, expected, []}
  end
end
