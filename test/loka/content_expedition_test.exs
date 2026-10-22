defmodule Loka.ContentExpeditionTest do
  use ExUnit.Case, async: true

  @dir "cartridges/expedition_sampler"
  @kat JSON.decode!(File.read!("protocol/fixtures/expedition_sampler_hash.json"))

  # Breaks: an expedition short ref left a string or an authored edge reshaped in the artifact
  # (protocol/fixtures/expedition_sampler_hash.json, pinned compiler output).
  test "expedition_sampler compiles to its pinned artifact without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile(@dir) == {:ok, expected, []}
  end

  # Breaks: a declared route accepts a direction that cannot perform its claimed physical transfer.
  test "a nonexistent physical edge is refused at the expedition declaration" do
    dir = Loka.ContentSource.copy(@dir)
    north = &put_in(&1, ["expedition", "route", Access.at(0), "direction"], "north")
    assert {:error, diags} = Loka.ContentSource.compile(dir, [{"quests/night_walk.json", north}])

    assert {"OUTCOME_MISMATCH", "quests/night_walk.expedition.route"} in Enum.map(
             diags,
             &{&1["code"], &1["path"]}
           )
  end
end
