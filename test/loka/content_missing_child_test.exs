defmodule Loka.ContentMissingChildTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/missing_child_v021_hash.json"))

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
end
