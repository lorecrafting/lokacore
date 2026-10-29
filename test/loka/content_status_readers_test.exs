defmodule Loka.ContentStatusReadersTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ward_sampler")}

  defp diags(dir, edits) do
    assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
    Enum.map(ds, &{&1["code"], &1["path"]})
  end

  # Breaks (status readers 4 and 5; twin of the loader row in kernel/ts/test/status_readers.test.ts):
  # a blocks or allows entry naming no command (or the authority-internal elapsed) compiles.
  test "reader fields name player commands", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    for {field, name} <- [{"blocks", "fly"}, {"allows", "elapsed"}] do
      named = &Map.put(&1, field, ["say", name])

      assert {"UNKNOWN_COMMAND", "statuses/hushed.#{field}[1]"} in diags(dir, [
               {"statuses/hushed.json", named}
             ])
    end
  end

  # Breaks (status readers 6 and 8; twin of the loader row in kernel/ts/test/status_readers.test.ts):
  # a perception or a concealment (each alone) without per_tick is refused, or an empty perception compiles. `soaked`: no entry reaction applies it (row 16).
  test "perception and concealment stand in for per_tick", %{dir: dir} do
    api = &{"cartridge.json", fn c -> put_in(c, ["requires", "kernel_api", "at_least"], &1) end}

    soaked =
      &{"statuses/soaked.json", fn s -> s |> Map.delete("resistances") |> Map.merge(&1) end}

    for fields <- [%{"perception" => %{"hearing" => "deaf"}}, %{"concealment" => "hidden"}] do
      assert {:ok, _, _} = Loka.ContentSource.compile(dir, [api.("1.61"), soaked.(fields)])
    end

    assert {"SCHEMA_VIOLATION", "statuses/soaked.perception"} in diags(dir, [
             api.("1.61"),
             soaked.(%{"perception" => %{}})
           ])
  end

  # Breaks (status reader 9; twin of the loader row in kernel/ts/test/status_room.test.ts): a step
  # naming a room compiles beside an npc, an item or co_present, or naming no room of
  # the cartridge.
  test "a room step stands alone and names a room", %{dir: dir} do
    api = &{"cartridge.json", fn c -> put_in(c, ["requires", "kernel_api", "at_least"], &1) end}
    step = &{"reactions/thunder.json", fn r -> put_in(r, ["apply"], [&1]) end}
    room = %{"op" => "status.apply", "status" => "stunned", "room" => "den"}
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [api.("1.65"), step.(room)])

    for {edit, code} <- [
          {%{"npc" => "troll"}, "SCHEMA_VIOLATION"},
          {%{"item" => "npc_corpse"}, "SCHEMA_VIOLATION"},
          {%{"co_present" => true}, "SCHEMA_VIOLATION"},
          {%{"room" => "nowhere"}, "UNRESOLVED_REFERENCE"}
        ] do
      assert {code, "reactions/thunder.apply[0].room"} in diags(dir, [
               api.("1.65"),
               step.(Map.merge(room, edit))
             ])
    end
  end
end
