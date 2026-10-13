defmodule Loka.ContentAccessLocksTest do
  use ExUnit.Case, async: true

  @ada %{
    "cartridge_id" => "access_sampler",
    "cartridge_version" => "0.0.1",
    "kind" => "npc",
    "key" => "ada"
  }

  # Breaks (toolbox row G7): the compiler accepts a lock below kernel_api 1.78 (also an exit's
  # alone) or a put lock on an item that is no container; a lock root is no condition (its
  # references go unchecked) or its short references stay unexpanded (the loader would reject
  # the artifact).
  test "access locks need 1.78 and a container for put; their roots are checked conditions" do
    dir = Loka.ContentSource.copy("cartridges/access_sampler")
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.77")}
    lock = %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}}
    bad = %{"op" => "fact_compare", "fact" => "nope", "npc" => "ada", "equals" => "guest"}
    root = &put_in(&1, &2, bad)

    unlock = &{&1, fn d -> Map.delete(d, "locks") end}
    exit_only = [api, unlock.("rooms/hut.json"), unlock.("items/chest.json")]

    rows = [
      {[api], "KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"},
      {exit_only, "KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"},
      {[{"items/ring.json", &Map.put(&1, "locks", %{"put" => lock})}], "SCHEMA_VIOLATION",
       "items/ring.locks.put"},
      {[{"rooms/hut.json", &root.(&1, ["locks", "enter", "root"])}], "UNRESOLVED_REFERENCE",
       "rooms/hut.locks.enter.root.fact"},
      {[{"rooms/lane.json", &root.(&1, ["exits", "east", "locks", "traverse", "root"])}],
       "UNRESOLVED_REFERENCE", "rooms/lane.exits.east.locks.traverse.root.fact"},
      {[{"items/chest.json", &root.(&1, ["locks", "get", "root"])}], "UNRESOLVED_REFERENCE",
       "items/chest.locks.get.root.fact"}
    ]

    for {changes, code, path} <- rows do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end

    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [])
    c = JSON.decode!(artifact)["cartridge"]
    lane = c["rooms"]["access_sampler@0.0.1:room/lane"]
    assert lane["exits"]["east"]["locks"]["traverse"]["root"]["npc"] == @ada
    hut = c["rooms"]["access_sampler@0.0.1:room/hut"]
    assert hd(hut["locks"]["enter"]["root"]["items"])["npc"] == @ada
    assert c["items"]["access_sampler@0.0.1:item/chest"]["locks"]["put"]["root"]["npc"] == @ada
  end
end
