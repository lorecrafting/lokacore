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

  # Homestead hs-11. Breaks: an ancestry grants at birth a skill whose prerequisite was never met.
  test "an ancestry never grants a skill with a prerequisite" do
    prerequisite = %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}}

    assert {:error, diags} =
             Loka.ContentSource.compile(Loka.ContentSource.copy("cartridges/r9c_interactions"), [
               {"skills/swim.json", &Map.put(&1, "prerequisite", prerequisite)},
               {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.101")}
             ])

    assert Enum.map(diags, &{&1["code"], &1["path"]}) == [
             {"SCHEMA_VIOLATION", "cartridge.ancestries.fen_born.skill"}
           ]
  end
end
