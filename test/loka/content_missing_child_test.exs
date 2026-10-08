defmodule Loka.ContentMissingChildTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ashmere_missing_child")}
  @kat JSON.decode!(File.read!("protocol/fixtures/missing_child_v042_hash.json"))

  # Breaks: active chapter geometry, retired definitions, reward/message custody, return guards or title drift.
  test "the chapter in progress compiles to its independent answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/ashmere_missing_child") == {:ok, expected, []}
  end

  # Breaks: a source ancestry points at a missing attribute or an unowned starting faction fact.
  test "ancestry source rejects unresolved values and non-player faction", %{dir: dir} do
    for change <- [
          &put_in(&1, ["ancestries", "fen_born", "attribute"], "missing"),
          &put_in(&1, ["ancestries", "fen_born", "faction", "fact"], "mill_key_known")
        ] do
      assert {:error, diagnostics} = Loka.ContentSource.compile(dir, [{"cartridge.json", change}])

      assert Enum.any?(
               diagnostics,
               &(&1["path"] == "cartridge.ancestries.fen_born.attribute" or
                   &1["path"] == "cartridge.ancestries.fen_born.faction.fact")
             )
    end
  end

  # Breaks: an action-started scene can bind a different Green detail than its Begin recipe.
  test "Green scene source detail must match its Begin recipe", %{dir: dir} do
    notice = fn room ->
      put_in(
        room,
        ["details", "notice"],
        put_in(room["details"]["market_cross"], ["aliases"], ["notice"])
      )
    end

    assert {:error, diagnostics} =
             Loka.ContentSource.compile(dir, [
               {"scenes/epilogue_lost_prior.json", &put_in(&1, ["on", "detail"], "notice")},
               {"rooms/village_green.json", notice}
             ])

    assert Enum.any?(
             diagnostics,
             &(&1["code"] == "OUTCOME_MISMATCH" and
                 &1["path"] == "scenes/epilogue_lost_prior.on")
           )
  end

  # Breaks: short shop refs are not expanded, or duplicate/non-Peg stock and unfunded shops compile.
  test "shop source rejects duplicate, foreign stock and absent funding", %{dir: dir} do
    for change <- [
          &put_in(&1, ["shop", "offers"], &1["shop"]["offers"] ++ [hd(&1["shop"]["offers"])]),
          &put_in(&1, ["shop", "offers", Access.at(0), "item"], "rusted_key"),
          &Map.delete(&1, "resource_starts")
        ] do
      assert {:error, _} = Loka.ContentSource.compile(dir, [{"npcs/peg.json", change}])
    end
  end

  # Breaks: malformed funded families or contribution tuning compile despite the finite-exchange contract.
  test "exchange source rejects duplicate stock, insufficient quantity and an oversized increment",
       %{dir: dir} do
    for change <- [
          &put_in(&1, ["exchange", "outgoing", Access.at(1)], hd(&1["exchange"]["outgoing"])),
          &put_in(&1, ["exchange", "quantity"], 13),
          &put_in(&1, ["exchange", "increment"], 4)
        ] do
      assert {:error, _} =
               Loka.ContentSource.compile(dir, [{"quests/infirmary_herbs.json", change}])
    end
  end

  # Breaks: a hound area with a non-returning ordinary exit compiles but later strands wandering members.
  test "hound area requires the opposite return exit", %{dir: dir} do
    altered = fn room ->
      room
      |> put_in(["exits", "north"], room["exits"]["west"])
      |> update_in(["exits"], &Map.delete(&1, "west"))
    end

    assert {:error, diagnostics} =
             Loka.ContentSource.compile(dir, [{"rooms/adder_nest.json", altered}])

    assert Enum.any?(
             diagnostics,
             &(&1["code"] == "SCHEMA_VIOLATION" and
                 String.ends_with?(&1["path"], "populations/fen_hounds.area"))
           )
  end

  # Breaks: relaxing crow companion items also accepts a deer bundle without its hide.
  test "deer bundle still requires its hide", %{dir: dir} do
    assert {:error, diagnostics} =
             Loka.ContentSource.compile(dir, [
               {"population_bundles/willow_deer.json", &Map.delete(&1, "item")}
             ])

    assert Enum.any?(
             diagnostics,
             &String.ends_with?(&1["path"], "populations/willow_deer.bundle")
           )
  end

  # Breaks: source compiler accepts a one-way crow corridor that strands a return leg.
  test "crow transport corridor requires its reciprocal edge", %{dir: dir} do
    one_way = &update_in(&1, ["exits"], fn exits -> Map.delete(exits, "south") end)

    assert {:error, diagnostics} =
             Loka.ContentSource.compile(dir, [{"rooms/well_lane.json", one_way}])

    assert Enum.any?(diagnostics, fn d ->
             d["code"] == "SCHEMA_VIOLATION" and
               d["path"] == "populations/crow_green_1.scavenge"
           end)
  end

  # Breaks: the compiler admits a period that cannot revisit a newly eligible fatal slot in time.
  test "hound wander must be no slower than replacement", %{dir: dir} do
    slow = &%{&1 | "wander_interval" => 7200, "replacement_delay" => 3600}

    assert {:error, diagnostics} =
             Loka.ContentSource.compile(dir, [{"populations/fen_hounds.json", slow}])

    assert Enum.any?(
             diagnostics,
             &(&1["code"] == "SCHEMA_VIOLATION" and
                 &1["path"] == "populations/fen_hounds.wander_interval")
           )
  end

  # Break: a zero flight threshold compiles, so no living hound can ever flee.
  test "hound flight threshold must be positive", %{dir: dir} do
    zero = &put_in(&1, ["pack", "flight_below_percent"], 0)

    assert {:error, diagnostics} =
             Loka.ContentSource.compile(dir, [{"populations/fen_hounds.json", zero}])

    assert Enum.any?(
             diagnostics,
             &(&1["code"] == "SCHEMA_VIOLATION" and
                 &1["path"] == "populations/fen_hounds.pack.flight_below_percent")
           )
  end

  # Breaks: an authored allowlist admits a container or protected/wearable item before expansion.
  test "crow source refuses unsafe allowlisted item roles", %{dir: dir} do
    for patch <- [
          %{"container" => true, "capacity" => 2},
          %{"give_allowed" => false},
          %{"slot" => "cloak"}
        ] do
      assert {:error, diagnostics} =
               Loka.ContentSource.compile(dir, [{"items/old_coin.json", &Map.merge(&1, patch)}])

      assert Enum.any?(diagnostics, &String.ends_with?(&1["path"], ".scavenge"))
    end
  end
end
