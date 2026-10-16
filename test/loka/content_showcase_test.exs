defmodule Loka.ContentShowcaseTest do
  # The toolbox showcase (docs/SHOWCASE.md); its compiled answer is
  # protocol/fixtures/toolbox_showcase_hash.json, which kernel/ts/test/showcase_fixture.ts loads.
  use ExUnit.Case, async: true
  @kat JSON.decode!(File.read!("protocol/fixtures/toolbox_showcase_hash.json"))

  # The Homestead (crafts 1.101; build, raze, item_present, profession, hidden: 1.102) and the
  # Undercroft's banks, escrow, stock tables, shelves and locks, and the law district's theft,
  # hide, NPC locks, stolen offers, fine, jail talk and arrest dropped for the older-floor rows;
  # protocol/fixtures/loader_floors.json case 18 drops the same.
  @homestead_files ~w(blueprints/hut_plain blueprints/hut_timbered actions/raise_hut_plain
                    actions/raze_hut services/raise_hut_plain services/raze_hut recipes/chop
                    recipes/saw recipes/carve_spoon recipes/raise_timbered_hut reactions/cot_rest
                    actions/barter actions/buy_pen actions/buy_plot actions/claim
                    actions/commission actions/raise_croft_hut actions/raze_croft_hut
                    dialogues/cook_lesson items/cot_2 items/croft_plot items/dead_rat items/eel_01
                    items/egg_01 items/egg_02 items/egg_03 items/egg_04 items/egg_05 items/egg_06
                    items/feast_01 items/feather items/grain_01 items/holding_apple items/knife_01
                    items/nest items/pelt_01 items/pelt_02 items/pelt_03 items/plot
                    items/pond_water items/rod items/rod_2 items/sack items/salmon_01
                    items/seed_01 items/stew_hearty_01 items/stew_hearty_02 items/stew_hearty_03
                    items/stew_plain_01 items/stick_03 items/stick_04 items/trough items/trout_01
                    items/trout_02 items/turnip_01 items/turnip_02 items/turnip_03
                    items/watering_can npcs/cook npcs/farmer npcs/hen population_bundles/hens
                    populations/hens reactions/croft_bite reactions/croft_cot_rest reactions/eel
                    reactions/farmer_hates_rat reactions/farmer_likes_apple reactions/feed
                    reactions/lay reactions/ripen_croft reactions/ripen_plot reactions/salmon
                    reactions/sow reactions/spoil reactions/take_eel_01 reactions/take_salmon_01
                    reactions/take_trout_01 reactions/take_trout_02 reactions/trout
                    reactions/water_croft reactions/water_plot reactions/wither_croft
                    reactions/wither_plot recipes/cook_feast recipes/cook_stew
                    recipes/cook_stew_croft recipes/fish recipes/fish_croft recipes/water_croft
                    recipes/water_plot replenish/croft_fish replenish/crop_croft
                    replenish/crop_plot replenish/eel replenish/eggs replenish/grain_return
                    replenish/restock replenish/salmon replenish/seed_return replenish/spent_croft
                    replenish/spent_grain replenish/spent_plot replenish/trout services/buy_pen
                    services/buy_plot services/claim services/knife_for_pelts
                    services/raise_croft_hut services/raze_croft_hut services/stew statuses/fed
                    statuses/growing statuses/growing_croft statuses/hearty statuses/hen_fed
                    statuses/spoiling statuses/withered replenish/shelf replenish/yard_shelf
                    services/buy_strongroom services/deposit_a services/deposit_b
                    services/forge_cancel services/forge_claim services/forge_commission
                    services/withdraw_a services/withdraw_b statuses/hidden reactions/hide
                    reactions/yard_hide dialogues/clerk_fine dialogues/jailer_broke
                    dialogues/jailer_talk reactions/charge)

  @homestead_facts ~w(cooked gifted_apple gifted_rat ordered owns_pen owns_plot regard sown_at
                      traded_knife watered_at)

  # the sow statuses are dropped, so are the other containers' immune pairs
  @immune_holders ~w(crate hall_strongbox hoard_chest npc_corpse player_corpse strongbox
                     strongroom_chest yard_crate)

  # those immune pairs; the Undercroft's bank and forge services, shop stock tables and locks;
  # the guard's disposition (arrest needs 1.105, toolbox row 35; hostile alone is refused)
  @dropped_keys for(i <- @immune_holders, do: {"items/" <> i, "immune"}) ++
                  for(n <- ~w(clerk_a clerk_b smith), do: {"npcs/" <> n, "services"}) ++
                  for(n <- ~w(chandler yard_chandler), do: {"npcs/" <> n, "shop"}) ++
                  for(
                    f <-
                      ~w(items/hoard_chest items/strongroom_chest items/strongroom_key items/yard_crate rooms/strongroom),
                    do: {f, "locks"}
                  ) ++
                  [
                    {"npcs/fence", "locks"},
                    {"npcs/vault", "locks"},
                    {"npcs/fence", "shop"},
                    {"npcs/guard", "disposition"}
                  ]

  # Nell and Bess's disposition.refuse lines need 1.104 (Book hostile refusal).
  defp unrefuse(n), do: update_in(n, ["disposition"], &Map.delete(&1, "refuse"))

  defp homestead_edits,
    do:
      [
        {"cartridge.json",
         &update_in(&1, ["world"], fn w -> Map.drop(w, ~w(construction theft)) end)},
        {"rooms/holding_lane.json", &Map.delete(&1, "site")},
        {"npcs/carpenter.json", &Map.delete(&1, "services")},
        {"rooms/holding_croft.json", &Map.delete(&1, "site")},
        {"facts.json", &update_in(&1, ["facts"], fn f -> Map.drop(f, @homestead_facts) end)}
      ] ++
        for({f, k} <- @dropped_keys, do: {f <> ".json", fn m -> Map.delete(m, k) end})

  defp homestead,
    do:
      homestead_edits() ++
        for(
          f <- @homestead_files,
          do: {f <> ".json", nil}
        ) ++
        for(
          s <- ~w(carpentry carving cooking joinery whittling woodcutting),
          do: {"skills/#{s}.json", &Map.drop(&1, ~w(profession prerequisite hidden))}
        )

  # Breaks: a short source reference stays unexpanded, a touch link is missing (a warning), or the
  # source drifts from the bytes the district walkthroughs run on.
  test "the showcase source compiles to its pinned answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/toolbox_showcase") == {:ok, expected, []}
  end

  # Row W22 fire (Beads loka-kgd.96; twin of the loader rows in kernel/ts/test/showcase_fire.test.ts).
  # Breaks: a barrier.set step or a co_present tag compiles under API 1.55 (each alone); a
  # barrier.set to locked on a barrier without key_item compiles (named or by tag), or one with a
  # key_item is refused; a barrier.set naming no barrier compiles.
  describe "fire" do
    setup do: %{dir: Loka.ContentSource.copy("cartridges/toolbox_showcase")}

    defp diags(dir, edits) do
      assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
      Enum.map(ds, &{&1["code"], &1["path"]})
    end

    defp spread(edit), do: {"reactions/fire_spreads.json", &update_in(&1, ["apply"], edit)}

    defp door(to, by),
      do: spread(&List.replace_at(&1, 1, Map.merge(%{"op" => "barrier.set", "to" => to}, by)))

    test "barrier.set and co_present tag need API 1.56; to locked needs a key_item", %{dir: dir} do
      # The boars' attacker filters (1.58), gored's kind (1.102, loka-x6t.64) and speech.phrases
      # (1.98) dropped too.
      unfiltered =
        for r <- ~w(boar_gore tilt_boar_gore),
            do:
              {"reactions/#{r}.json",
               &update_in(&1, ["on"], fn on -> Map.delete(on, "attacker") end)}

      at155 = [
        {"cartridge.json",
         &(&1 |> put_in(["requires", "kernel_api", "at_least"], "1.55") |> Map.delete("speech"))},
        {"reactions/kindle.json", nil},
        {"reactions/gate_lifted.json", nil},
        {"reactions/gate_shut.json", nil},
        {"statuses/gored.json", &Map.delete(&1, "kind")},
        {"npcs/nell.json", &unrefuse/1},
        {"npcs/bess.json", &unrefuse/1}
        | unfiltered ++ homestead()
      ]

      # No tag left: the spread's tag dropped and the door named.
      untagged =
        spread(fn a ->
          a
          |> List.update_at(0, &Map.delete(&1, "tag"))
          |> List.replace_at(1, %{
            "op" => "barrier.set",
            "to" => "open",
            "barrier" => "store_door"
          })
        end)

      no_door = spread(&List.delete_at(&1, 1))
      api = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
      assert {:ok, _, _} = Loka.ContentSource.compile(dir, at155 ++ [untagged, no_door])
      assert api in diags(dir, at155 ++ [untagged])
      assert api in diags(dir, at155 ++ [no_door])

      lockout = {"BARRIER_UNREACHABLE_KEY", "reactions/fire_spreads.apply[1].to"}
      assert lockout in diags(dir, [door("locked", %{"tag" => "burnable"})])
      assert lockout in diags(dir, [door("locked", %{"barrier" => "store_door"})])
      keyed = {"barriers/store_door.json", &Map.put(&1, "key_item", "anvil")}

      assert {:ok, _, _} =
               Loka.ContentSource.compile(dir, [keyed, door("locked", %{"tag" => "burnable"})])

      # A keyless burnable barrier on no exit (a lid) is out of a tag's reach.
      File.write!(
        Path.join(dir, "barriers/stray.json"),
        JSON.encode!(%{
          "keywords" => ["stray"],
          "short" => "barrier.store_door.short",
          "initial" => "closed",
          "tags" => ["burnable"]
        })
      )

      assert {:ok, _, _} =
               Loka.ContentSource.compile(dir, [keyed, door("locked", %{"tag" => "burnable"})])

      # loka-kgd.103: only the trigger room's exits, when it names one.
      entering = fn room ->
        {"reactions/fire_spreads.json",
         &Map.put(&1, "on", %{"event" => "entity_entered_room", "room" => room})}
      end

      locked = door("locked", %{"tag" => "burnable"})
      assert {:ok, _, _} = Loka.ContentSource.compile(dir, [entering.("the_fold"), locked])
      assert lockout in diags(dir, [entering.("smithy"), locked])

      assert {"UNRESOLVED_REFERENCE", "reactions/fire_spreads.apply[1].barrier"} in diags(dir, [
               door("open", %{"barrier" => "gate"})
             ])
    end
  end

  # loka-kgd.79, twin of the loader rows in kernel/ts/test/showcase_combat.test.ts. Breaks: an
  # attacker filter compiles under API 1.57, names a spawn template or an NPC the cartridge lacks.
  describe "attacker filter" do
    setup do: %{dir: Loka.ContentSource.copy("cartridges/toolbox_showcase")}

    defp gore(dir, api, npc) do
      Loka.ContentSource.compile(dir, [
        {"cartridge.json",
         &(&1 |> put_in(["requires", "kernel_api", "at_least"], api) |> Map.delete("speech"))},
        {"reactions/boar_gore.json", &put_in(&1, ["on", "attacker"], npc)},
        {"statuses/gored.json", &Map.delete(&1, "kind")},
        {"npcs/nell.json", &unrefuse/1},
        {"npcs/bess.json", &unrefuse/1}
        | homestead()
      ])
    end

    defp codes({:error, ds}), do: Enum.map(ds, &{&1["code"], &1["path"]})

    test "needs API 1.58 and an authored NPC", %{dir: dir} do
      at = "reactions/boar_gore.on.attacker"
      assert {:ok, _, _} = gore(dir, "1.58", "boar")

      assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"} in codes(
               gore(dir, "1.57", "boar")
             )

      assert {"SCHEMA_VIOLATION", at} in codes(gore(dir, "1.58", "goblin"))
      assert {"UNRESOLVED_REFERENCE", at} in codes(gore(dir, "1.58", "wolf"))
    end
  end
end
