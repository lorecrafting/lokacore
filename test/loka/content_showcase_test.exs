defmodule Loka.ContentShowcaseTest do
  # The toolbox showcase (docs/SHOWCASE.md); its compiled answer is
  # protocol/fixtures/toolbox_showcase_hash.json, which kernel/ts/test/showcase_fixture.ts loads.
  use ExUnit.Case, async: true
  @kat JSON.decode!(File.read!("protocol/fixtures/toolbox_showcase_hash.json"))

  # Breaks: a short source reference stays unexpanded, a touch link is missing (a warning), or the
  # source drifts from the bytes the district walkthroughs run on.
  test "the showcase source compiles to its pinned answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/toolbox_showcase") == {:ok, expected, []}
  end
end
