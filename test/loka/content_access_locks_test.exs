defmodule Loka.ContentAccessLocksTest do
  use ExUnit.Case, async: true

  @ada %{
    "cartridge_id" => "access_sampler",
    "cartridge_version" => "0.0.1",
    "kind" => "npc",
    "key" => "ada"
  }

  # Breaks (toolbox row G7): the compiler accepts a put lock on an item that is no container; a lock root is no condition (its
  # references go unchecked) or its short references stay unexpanded (the loader would reject
  # the artifact).
  test "access locks need a container for put; their roots are checked conditions" do
    dir = Loka.ContentSource.copy("cartridges/access_sampler")
    lock = %{"op" => "all", "items" => []}
    bad = %{"op" => "fact_compare", "fact" => "nope", "npc" => "ada", "equals" => "guest"}
    root = &put_in(&1, &2, bad)

    rows = [
      {[{"items/ring.json", &Map.put(&1, "locks", %{"put" => lock})}], "SCHEMA_VIOLATION",
       "items/ring.locks.put"},
      {[{"rooms/hut.json", &root.(&1, ["locks", "enter"])}], "UNRESOLVED_REFERENCE",
       "rooms/hut.locks.enter.fact"},
      {[{"rooms/lane.json", &root.(&1, ["exits", "east", "locks", "traverse"])}],
       "UNRESOLVED_REFERENCE", "rooms/lane.exits.east.locks.traverse.fact"},
      {[{"items/chest.json", &root.(&1, ["locks", "get"])}], "UNRESOLVED_REFERENCE",
       "items/chest.locks.get.fact"}
    ]

    for {changes, code, path} <- rows do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end

    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [])
    c = JSON.decode!(artifact)["cartridge"]
    lane = c["rooms"]["access_sampler@0.0.1:room/lane"]
    assert lane["exits"]["east"]["locks"]["traverse"]["npc"] == @ada
    hut = c["rooms"]["access_sampler@0.0.1:room/hut"]
    assert hd(hut["locks"]["enter"]["items"])["npc"] == @ada
    assert c["items"]["access_sampler@0.0.1:item/chest"]["locks"]["put"]["npc"] == @ada
  end
end
