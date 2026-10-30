defmodule Loka.ContentWitnessTest do
  # Toolbox row FD5 (loka-kgd.142, loka-kgd.22) in the compiler: the witness filter and the npc.move
  # step name local, non-template NPCs and rooms (twin of
  # kernel/ts/test/witness.test.ts).
  use ExUnit.Case, async: true

  defp codes(dir, changes) do
    assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
    Enum.map(diags, &{&1["code"], &1["path"]})
  end

  # Breaks: the witness filter's reference, or spawn-template check skipped, or the
  # filter admitted on a trigger with no subject body (fact_changed).
  test "the witness filter names a placed NPC, on a body event" do
    dir = Loka.ContentSource.copy("cartridges/rivals_sampler")
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [])
    template = {"npcs/baker.json", &Map.put(&1, "spawn_template", true)}

    assert {"SCHEMA_VIOLATION", "reactions/witnessed.on.witness"} in codes(dir, [template])

    assert {"UNRESOLVED_REFERENCE", "reactions/witnessed.on.witness"} in codes(dir, [
             {"reactions/witnessed.json", &put_in(&1, ["on", "witness"], "nobody")}
           ])

    on_fact =
      {"reactions/witnessed.json",
       &Map.put(&1, "on", %{"event" => "fact_changed", "fact" => "gloats", "witness" => "baker"})}

    assert codes(dir, [on_fact]) == [{"UNKNOWN_FIELD", "reactions/witnessed.on.witness"}]
  end

  # Breaks: the npc.move step's room or NPC reference or its spawn-template check skipped.
  test "an npc.move step names a local room and placed NPC" do
    dir = Loka.ContentSource.copy("cartridges/reactions_sampler")
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [])
    step = &{"reactions/crow_called.json", fn r -> put_in(r, ["steps", Access.at(0)], &1) end}
    attic = step.(%{"op" => "npc.move", "npc" => "crow", "room" => "attic"})
    template = {"npcs/crow.json", &Map.put(&1, "spawn_template", true)}

    assert {"UNRESOLVED_REFERENCE", "reactions/crow_called.steps[0].room"} in codes(dir, [attic])
    assert {"SCHEMA_VIOLATION", "reactions/crow_called.steps[0].npc"} in codes(dir, [template])
  end
end
