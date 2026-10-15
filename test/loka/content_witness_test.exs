defmodule Loka.ContentWitnessTest do
  # Toolbox row FD5 (loka-kgd.142, loka-kgd.22) in the compiler: the witness filter and the npc.move
  # step name local, non-template NPCs and rooms and need kernel_api 1.95 (twin of
  # kernel/ts/test/witness.test.ts).
  use ExUnit.Case, async: true

  @floor {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}

  defp api, do: {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.94")}

  defp codes(dir, changes) do
    assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
    Enum.map(diags, &{&1["code"], &1["path"]})
  end

  # Breaks: the witness filter's reference, spawn-template check or 1.95 floor skipped, or the
  # filter admitted on a trigger with no subject body (fact_changed).
  test "the witness filter names a placed NPC, on a body event, from 1.95" do
    dir = Loka.ContentSource.copy("cartridges/rivals_sampler")
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [])
    template = {"npcs/baker.json", &Map.put(&1, "spawn_template", true)}

    assert {"SCHEMA_VIOLATION", "reactions/witnessed.on.witness"} in codes(dir, [template])
    assert @floor in codes(dir, [api()])

    on_fact =
      {"reactions/witnessed.json",
       &Map.put(&1, "on", %{"event" => "fact_changed", "fact" => "gloats", "witness" => "baker"})}

    assert codes(dir, [on_fact]) == [{"UNKNOWN_FIELD", "reactions/witnessed.on.witness"}]
  end

  # Breaks: the npc.move step's room or NPC reference, its spawn-template check or its 1.95 floor
  # skipped.
  test "an npc.move step names a local room and placed NPC, from 1.95" do
    dir = Loka.ContentSource.copy("cartridges/reactions_sampler")
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [])
    step = &{"reactions/crow_called.json", fn r -> put_in(r, ["apply", Access.at(0)], &1) end}
    attic = step.(%{"op" => "npc.move", "npc" => "crow", "room" => "attic"})
    template = {"npcs/crow.json", &Map.put(&1, "spawn_template", true)}

    assert {"UNRESOLVED_REFERENCE", "reactions/crow_called.apply[0].room"} in codes(dir, [attic])
    assert {"SCHEMA_VIOLATION", "reactions/crow_called.apply[0].npc"} in codes(dir, [template])
    assert @floor in codes(dir, [api()])
  end
end
