defmodule Loka.ContentStatusTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/status_sampler")}

  # Breaks: a status with an unknown pool, a tick at or past its end, a zero amount or missing
  # text, or an applier or cure naming no status compiles.
  test "status, applier and cure declarations keep their boundaries", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    cases =
      [
        {"statuses/poison.json", &Map.put(&1, "resource", "missing")},
        {"statuses/poison.json", &Map.put(&1, "tick_every", 300)},
        {"statuses/poison.json", &Map.put(&1, "per_tick", 0)},
        {"statuses/poison.json", &put_in(&1, ["narration", "tick"], "missing.text")},
        {"reactions/dart.json", &put_in(&1, ["apply", Access.at(0), "status"], "missing")},
        {"items/antidote.json", &put_in(&1, ["edible", "cures"], ["missing"])},
        {"cartridge.json",
         &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "status") end)},
        {"cartridge.json",
         &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "death") end)},
        {"statuses/poison.json", &Map.put(&1, "per_tick", "-1")},
        {"statuses/poison.json", &Map.put(&1, "duration", 0)},
        {"statuses/poison.json", &Map.put(&1, "extra", 1)},
        {"statuses/poison.json", &put_in(&1, ["narration", "cured"], "narration.poison.tick")},
        {"reactions/dart.json", &put_in(&1, ["apply"], [%{"op" => "status.apply"}])},
        {"items/antidote.json", &put_in(&1, ["edible", "cures"], [])}
      ] ++
        for(
          field <- ~w(duration tick_every resource per_tick label narration),
          do: {"statuses/poison.json", &Map.delete(&1, field)}
        ) ++
        for(
          field <- ~w(applied tick expired),
          do:
            {"statuses/poison.json",
             &update_in(&1, ["narration"], fn n -> Map.delete(n, field) end)}
        )

    for {file, change} <- cases do
      assert {:error, _} = Loka.ContentSource.compile(dir, [{file, change}]), file
    end
  end

  # Breaks: a status declaration without status@1 compiles, or is refused under another code or path.
  test "status without the status capability is UNDECLARED_CAPABILITY at the manifest", %{
    dir: dir
  } do
    drop = &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "status") end)
    assert {:error, ds} = Loka.ContentSource.compile(dir, [{"cartridge.json", drop}])

    got = Enum.map(ds, &{&1["code"], &1["path"], &1["data"]["capability"]})
    assert {"UNDECLARED_CAPABILITY", "cartridge.requires.capabilities", "status"} in got
  end

  # Breaks (row 16; twin of the loader case in kernel/ts/test/sneak.test.ts): pierced_by compiles
  # without a concealment, or naming no skill or attribute; an entry reaction applying
  # a concealment compiles (the engage cure then faults conflicting_write on that move).
  test "pierced_by needs a concealment, a real skill and attribute, no entry concealment" do
    dir = Loka.ContentSource.copy("cartridges/sneak_sampler")
    hidden = &{"statuses/hidden.json", &1}

    diags = fn edits ->
      assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
      Enum.map(ds, &{&1["code"], &1["path"]})
    end

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert {"SCHEMA_VIOLATION", "statuses/hidden.pierced_by"} in diags.([
             hidden.(&(&1 |> Map.delete("concealment") |> Map.put("per_tick", -1)))
           ])

    assert {"UNRESOLVED_REFERENCE", "statuses/hidden.pierced_by.skill"} in diags.([
             hidden.(&put_in(&1, ["pierced_by", "skill"], "none"))
           ])

    assert {"UNRESOLVED_REFERENCE", "statuses/hidden.pierced_by.attribute"} in diags.([
             hidden.(&put_in(&1, ["pierced_by", "attribute"], "none"))
           ])

    entry = %{"event" => "entity_entered_room", "room" => "keep"}

    assert {"OUTCOME_MISMATCH", "reactions/hide.apply[0].op"} in diags.([
             {"reactions/hide.json", &Map.put(&1, "on", entry)}
           ])
  end
end
