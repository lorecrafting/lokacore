defmodule Loka.ContentMissingChildTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/missing_child_v032_hash.json"))

  # Breaks: active chapter geometry, retired definitions, reward/message custody, return guards or title drift.
  test "the chapter in progress compiles to its independent answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/ashmere_missing_child") == {:ok, expected, []}
  end

  # Breaks: an action-started scene can bind a different Green detail than its Begin recipe.
  test "Green scene source detail must match its Begin recipe", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "scenes/epilogue_lost_prior.json")
    source = path |> File.read!() |> JSON.decode!()
    File.write!(path, JSON.encode!(put_in(source, ["on", "detail"], "notice")))
    room_path = Path.join(dir, "rooms/village_green.json")
    room = room_path |> File.read!() |> JSON.decode!()

    notice = put_in(room["details"]["market_cross"], ["aliases"], ["notice"])
    File.write!(room_path, JSON.encode!(put_in(room, ["details", "notice"], notice)))

    assert {:error, diagnostics} = Loka.Content.compile(dir)

    assert Enum.any?(
             diagnostics,
             &(&1["code"] == "OUTCOME_MISMATCH" and
                 &1["path"] == "scenes/epilogue_lost_prior.on")
           )
  end

  # Breaks: short shop refs are not expanded, or duplicate/non-Peg stock and unfunded shops compile.
  test "shop source rejects duplicate, foreign stock and absent funding", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "npcs/peg.json")
    npc = path |> File.read!() |> JSON.decode!()

    for changed <- [
          put_in(npc, ["shop", "offers"], npc["shop"]["offers"] ++ [hd(npc["shop"]["offers"])]),
          put_in(npc, ["shop", "offers", Access.at(0), "item"], "rusted_key"),
          Map.delete(npc, "resource_starts")
        ] do
      File.write!(path, JSON.encode!(changed))
      assert {:error, _} = Loka.Content.compile(dir)
    end
  end

  # Breaks: malformed funded families or contribution tuning compile despite the finite-exchange contract.
  test "exchange source rejects duplicate stock, insufficient quantity and an oversized increment",
       %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "quests/infirmary_herbs.json")
    q = path |> File.read!() |> JSON.decode!()

    for changed <- [
          put_in(q, ["exchange", "outgoing", Access.at(1)], hd(q["exchange"]["outgoing"])),
          put_in(q, ["exchange", "quantity"], 13),
          put_in(q, ["exchange", "increment"], 4)
        ] do
      File.write!(path, JSON.encode!(changed))
      assert {:error, _} = Loka.Content.compile(dir)
    end
  end

  # Breaks: a hound area with a non-returning ordinary exit compiles but later strands wandering members.
  test "hound area requires the opposite return exit", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "rooms/adder_nest.json")
    room = JSON.decode!(File.read!(path))

    altered =
      room
      |> put_in(["exits", "north"], room["exits"]["west"])
      |> update_in(["exits"], &Map.delete(&1, "west"))

    File.write!(path, JSON.encode!(altered))
    assert {:error, diagnostics} = Loka.Content.compile(dir)

    assert Enum.any?(
             diagnostics,
             &(&1["code"] == "SCHEMA_VIOLATION" and
                 String.ends_with?(&1["path"], "populations/fen_hounds.area"))
           )
  end

  # Breaks: the compiler admits a period that cannot revisit a newly eligible fatal slot in time.
  test "hound wander must be no slower than replacement", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "populations/fen_hounds.json")
    plan = path |> File.read!() |> JSON.decode!()
    changed = %{plan | "wander_interval" => 7200, "replacement_delay" => 3600}
    File.write!(path, JSON.encode!(changed))
    assert {:error, diagnostics} = Loka.Content.compile(dir)

    assert Enum.any?(
             diagnostics,
             &(&1["code"] == "SCHEMA_VIOLATION" and
                 &1["path"] == "populations/fen_hounds.wander_interval")
           )
  end
end
