defmodule Loka.ContentStatusReadersTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ward_sampler")}

  defp diags(dir, edits) do
    assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
    Enum.map(ds, &{&1["code"], &1["path"]})
  end

  defp plain(s), do: s |> Map.drop(~w(blocks allows resistances)) |> Map.put("per_tick", -1)

  # Breaks (status readers 4 and 5; twin of the loader row in kernel/ts/test/status_readers.test.ts):
  # one reader field (each alone) compiles under API 1.53, a blocks or allows entry naming no
  # command (or the authority-internal elapsed) compiles, or a reader status without per_tick (the
  # sampler's four) is refused.
  test "reader fields need API 1.54 and name player commands", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    at153 = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.53")}

    for {key, field, value} <- [
          {"warded", "resistances", %{"fire" => 10}},
          {"hushed", "blocks", ["say"]},
          {"hushed", "allows", ["look"]}
        ] do
      plains =
        for k <- ~w(warded hushed soaked stunned), k != key, do: {"statuses/#{k}.json", &plain/1}

      one = {"statuses/#{key}.json", &(&1 |> plain() |> Map.put(field, value))}

      assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api"} in diags(
               dir,
               [at153, one | plains]
             ),
             field
    end

    for {field, name} <- [{"blocks", "fly"}, {"allows", "elapsed"}] do
      named = &Map.put(&1, field, ["say", name])

      assert {"UNKNOWN_COMMAND", "statuses/hushed.#{field}[1]"} in diags(dir, [
               {"statuses/hushed.json", named}
             ])
    end
  end

  # Breaks (status readers 6 and 8; twin of the loader row in kernel/ts/test/status_readers.test.ts):
  # a perception or a concealment (each alone) compiles under API 1.60, such a status without
  # per_tick is refused, or an empty perception compiles.
  test "perception and concealment need API 1.61 and stand in for per_tick", %{dir: dir} do
    api = &{"cartridge.json", fn c -> put_in(c, ["requires", "kernel_api", "at_least"], &1) end}

    warded =
      &{"statuses/warded.json", fn s -> s |> Map.delete("resistances") |> Map.merge(&1) end}

    for fields <- [%{"perception" => %{"hearing" => "deaf"}}, %{"concealment" => "hidden"}] do
      assert {:ok, _, _} = Loka.ContentSource.compile(dir, [api.("1.61"), warded.(fields)])

      assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api"} in diags(dir, [
               api.("1.60"),
               warded.(fields)
             ]),
             inspect(fields)
    end

    assert {"SCHEMA_VIOLATION", "statuses/warded.perception"} in diags(dir, [
             api.("1.61"),
             warded.(%{"perception" => %{}})
           ])
  end

  # Breaks (status reader 9; twin of the loader row in kernel/ts/test/status_room.test.ts): a step
  # naming a room compiles under API 1.64, beside an npc, or naming no room of the cartridge.
  test "a room step needs API 1.65, stands alone and names a room", %{dir: dir} do
    api = &{"cartridge.json", fn c -> put_in(c, ["requires", "kernel_api", "at_least"], &1) end}
    step = &{"reactions/thunder.json", fn r -> put_in(r, ["apply"], [&1]) end}
    room = %{"op" => "status.apply", "status" => "stunned", "room" => "den"}
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [api.("1.65"), step.(room)])

    assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"} in diags(dir, [
             api.("1.64"),
             step.(room)
           ])

    for {edit, code} <- [
          {%{"npc" => "troll"}, "SCHEMA_VIOLATION"},
          {%{"room" => "nowhere"}, "UNRESOLVED_REFERENCE"}
        ] do
      assert {code, "reactions/thunder.apply[0].room"} in diags(dir, [
               api.("1.65"),
               step.(Map.merge(room, edit))
             ])
    end
  end
end
