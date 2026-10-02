defmodule Loka.ContentLanternTest do
  # The pre-release proof cartridge The Ferryman's Lantern (pre-release-proof.md, Concrete proof;
  # R6P P3). The known answer is protocol/fixtures/cartridge_lantern_hash.json, written by
  # test/loka/cartridge_lantern_hash.py (by hand, before the compiler ran); the walk of both
  # endings is kernel/ts/test/lantern_proof.test.ts.
  use ExUnit.Case, async: true

  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_lantern_hash.json"))

  # Breaks: a room, the gate, the schedule, the quest, the dialogue, the story point or the text
  # dropped or reshaped in the artifact, or a warning on content the PR claims compiles cleanly.
  test "lantern_proof compiles to its Python known answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/lantern_proof") == {:ok, expected, []}
  end
end
