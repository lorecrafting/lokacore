defmodule Loka.ContentMissingChildTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/missing_child_v039_hash.json"))

  # Breaks: active chapter geometry, retired definitions, reward/message custody, return guards or title drift.
  test "the chapter in progress compiles to its independent answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/ashmere_missing_child") == {:ok, expected, []}
  end

  # Breaks: a source ancestry points at a missing attribute or an unowned starting faction fact.
  test "ancestry source rejects unresolved values and non-player faction", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "cartridge.json")
    source = path |> File.read!() |> JSON.decode!()

    for changed <- [
          put_in(source, ["ancestries", "fen_born", "attribute"], "missing"),
          put_in(source, ["ancestries", "fen_born", "faction", "fact"], "mill_key_known")
        ] do
      File.write!(path, JSON.encode!(changed))
      assert {:error, diagnostics} = Loka.Content.compile(dir)

      assert Enum.any?(
               diagnostics,
               &(&1["path"] == "cartridge.ancestries.fen_born.attribute" or
                   &1["path"] == "cartridge.ancestries.fen_born.faction.fact")
             )
    end
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

  # Breaks: relaxing crow companion items also accepts a deer bundle without its hide.
  test "deer bundle still requires its hide", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "population_bundles/willow_deer.json")
    bundle = path |> File.read!() |> JSON.decode!() |> Map.delete("item")
    File.write!(path, JSON.encode!(bundle))

    assert {:error, diagnostics} = Loka.Content.compile(dir)

    assert Enum.any?(
             diagnostics,
             &String.ends_with?(&1["path"], "populations/willow_deer.bundle")
           )
  end

  # Breaks: source compiler accepts a one-way crow corridor that strands a return leg.
  test "crow transport corridor requires its reciprocal edge", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "rooms/well_lane.json")
    room = path |> File.read!() |> JSON.decode!()
    File.write!(path, JSON.encode!(update_in(room, ["exits"], &Map.delete(&1, "south"))))

    assert {:error, diagnostics} = Loka.Content.compile(dir)

    assert Enum.any?(diagnostics, fn d ->
             d["code"] == "SCHEMA_VIOLATION" and
               d["path"] == "populations/crow_green_1.scavenge"
           end)
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

  # Break: a zero flight threshold compiles, so no living hound can ever flee.
  test "hound flight threshold must be positive", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "populations/fen_hounds.json")
    plan = path |> File.read!() |> JSON.decode!()
    File.write!(path, JSON.encode!(put_in(plan, ["pack", "flight_below_percent"], 0)))

    assert {:error, diagnostics} = Loka.Content.compile(dir)

    assert Enum.any?(
             diagnostics,
             &(&1["code"] == "SCHEMA_VIOLATION" and
                 &1["path"] == "populations/fen_hounds.pack.flight_below_percent")
           )
  end

  # Breaks: an authored allowlist admits a container or protected/wearable item before expansion.
  test "crow source refuses unsafe allowlisted item roles", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "items/old_coin.json")
    original = path |> File.read!() |> JSON.decode!()

    for patch <- [
          %{"container" => true, "capacity" => 2},
          %{"give_allowed" => false},
          %{"slot" => "cloak"}
        ] do
      File.write!(path, JSON.encode!(Map.merge(original, patch)))
      assert {:error, diagnostics} = Loka.Content.compile(dir)
      assert Enum.any?(diagnostics, &String.ends_with?(&1["path"], ".scavenge"))
    end
  end
end
