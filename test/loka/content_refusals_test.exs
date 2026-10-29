defmodule Loka.ContentRefusalsTest do
  @moduledoc """
  Compiler refusals, each on a per-module copy of a toolbox sampler with the one edit that
  breaks it. Every case asserts the literal diagnostic code and the path of the edited field.
  """
  use ExUnit.Case, async: true
  alias Loka.ContentSource, as: Source

  setup_all do
    for name <-
          ~w(derived_sampler scene_sampler prices_sampler harvest_sampler shoo_sampler codex_sampler toolbox_showcase),
        into: %{},
        do: {String.to_atom(name), Source.copy("cartridges/#{name}")}
  end

  defp codes(dir, changes) do
    {:error, diagnostics} = Source.compile(dir, changes)
    for d <- diagnostics, do: {d["code"], d["path"]}
  end

  defp assert_ok(dir, changes), do: assert({:ok, _, []} = Source.compile(dir, changes))

  @axis %{
    "version" => 1,
    "value_type" => %{"type" => "int", "minimum" => -10, "maximum" => 10, "default" => 0},
    "scopes" => ["player"],
    "meaning" => "A faction axis."
  }

  @facts %{
    "axis" => @axis,
    "gift" => %{
      @axis
      | "value_type" => %{"type" => "int", "minimum" => 0, "maximum" => 2, "default" => 0}
    }
  }

  # Breaks: an ancestry names a missing attribute, or a starting faction fact the player
  # scope does not own.
  test "ancestry refuses an unresolved attribute and a non-player faction fact", %{
    derived_sampler: dir
  } do
    faction = [
      {"facts.json", %{"facts" => %{"axis" => @axis}}},
      {"cartridge.json",
       &put_in(&1, ["ancestries", "strong", "faction"], %{"fact" => "axis", "value" => -2})}
    ]

    assert_ok(dir, faction)

    assert {"UNRESOLVED_REFERENCE", "cartridge.ancestries.strong.attribute"} in codes(dir, [
             {"cartridge.json", &put_in(&1, ["ancestries", "strong", "attribute"], "missing")}
           ])

    for {field, value} <- [{"description", "ancestry.absent"}, {"skill", "str"}] do
      assert {"UNRESOLVED_REFERENCE", "cartridge.ancestries.strong.#{field}"} in codes(dir, [
               {"cartridge.json", &put_in(&1, ["ancestries", "strong", field], value)}
             ])
    end

    instance = [{"facts.json", %{"facts" => %{"axis" => %{@axis | "scopes" => ["instance"]}}}}]

    assert {"SCHEMA_VIOLATION", "cartridge.ancestries.strong.faction.fact"} in codes(
             dir,
             instance ++ tl(faction)
           )
  end

  # Breaks: an action-started scene can bind a different detail than its Begin recipe targets.
  test "action scene detail must match its Begin recipe", %{scene_sampler: dir} do
    scene = %{
      "on" => %{
        "action" => "coil_rope",
        "room" => "ferry_landing",
        "detail" => "mooring_post",
        "outcome" => "success"
      },
      "control" => "modal",
      "steps" => [
        %{"type" => "narrate", "text" => "scene.bell_rung.bell"},
        %{"type" => "await_ack"},
        %{"type" => "end"}
      ]
    }

    # Action-started scenes need kernel API 1.15.
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.15")}
    assert_ok(dir, [api, {"scenes/coil.json", scene}])

    notice = fn room ->
      put_in(room, ["details", "notice"], %{
        room["details"]["mooring_post"]
        | "aliases" => ["notice"]
      })
    end

    assert {"OUTCOME_MISMATCH", "scenes/coil.on"} in codes(dir, [
             api,
             {"scenes/coil.json", put_in(scene, ["on", "detail"], "notice")},
             {"rooms/ferry_landing.json", notice}
           ])

    # Breaks: an action scene that names neither room nor detail is admitted.
    unplaced = update_in(scene, ["on"], &Map.drop(&1, ~w(room detail)))

    assert {"SCHEMA_VIOLATION", "scenes/coil.on"} in codes(dir, [
             api,
             {"scenes/coil.json", unplaced}
           ])
  end

  # Breaks: a duplicate offer, an offer whose item does not lead its stock, or an unfunded shop compiles.
  test "shop refuses duplicate offers, an offer item that does not lead its stock, and absent funding",
       %{prices_sampler: dir} do
    shop = "npcs/fishmonger.json"
    dup = &put_in(&1, ["shop", "offers"], &1["shop"]["offers"] ++ [hd(&1["shop"]["offers"])])
    misled = &put_in(&1, ["shop", "offers", Access.at(0), "item"], "basket")

    assert {"DUPLICATE_DEFINITION", "npcs/fishmonger.shop"} in codes(dir, [{shop, dup}])

    assert {"SCHEMA_VIOLATION", "npcs/fishmonger.shop.offers[0].stock"} in codes(dir, [
             {shop, misled}
           ])

    assert {"RESOURCE_SPEC_INVALID", "npcs/fishmonger.shop"} in codes(dir, [
             {shop, &Map.delete(&1, "resource_starts")}
           ])
  end

  # Breaks: malformed funded exchange families or contribution tuning compile.
  test "exchange refuses an item on both sides, excess quantity and an oversized increment",
       %{
         harvest_sampler: dir
       } do
    exchange =
      [
        {"cartridge.json", &put_in(&1, ["requires", "capabilities", "quest"], 1)},
        {"facts.json", &update_in(&1, ["facts"], fn f -> Map.merge(f, @facts) end)},
        {"npcs/healer.json",
         %{
           "keywords" => ["healer"],
           "name" => "npc.healer.short",
           "room_line" => "npc.healer.room",
           "description" => "npc.healer.description",
           "room" => "mine"
         }},
        {"quests/herbs.json",
         %{
           "name" => "quest.herbs.title",
           "repeatable" => true,
           "objective" => %{
             "evidence" => "current_state",
             "policy" => %{"op" => "all", "items" => []}
           },
           "exchange" => %{
             "npc" => "healer",
             "outgoing" => ["ore_01", "ore_02"],
             "incoming" => ["bandage_01", "bandage_02"],
             "quantity" => 2,
             "contribution" => "gift",
             "faction" => "axis",
             "increment" => 1
           },
           "journal" =>
             Map.new(
               ~w(active objectives_met resolved failed abandoned),
               &{&1, "quest.herbs.journal"}
             )
         }}
      ] ++
        for i <- ["01", "02"],
            do:
              {"items/bandage_#{i}.json",
               %{
                 "keywords" => ["bandage"],
                 "name" => "item.ore.short",
                 "room_line" => "item.ore_01.room",
                 "description" => "item.ore.description",
                 "mass_grams" => 10,
                 "location" => %{"in" => "npc", "npc" => "healer"}
               }}

    text =
      {"text.json",
       &Map.merge(
         &1,
         Map.new(
           ~w(npc.healer.short npc.healer.room npc.healer.description quest.herbs.title quest.herbs.journal),
           fn k -> {k, if(k == "npc.healer.room", do: "A [healer] waits.", else: "x")} end
         )
       )}

    exchange = [text | exchange]

    assert_ok(dir, exchange)

    quest = fn change -> exchange ++ [{"quests/herbs.json", change}] end

    assert {"DUPLICATE_DEFINITION", "quests/herbs.exchange"} in codes(
             dir,
             quest.(&put_in(&1, ["exchange", "incoming", Access.at(1)], "ore_01"))
           )

    assert {"OUTCOME_MISMATCH", "quests/herbs.exchange"} in codes(
             dir,
             quest.(&put_in(&1, ["exchange", "quantity"], 3))
           )

    assert {"OUTCOME_MISMATCH", "quests/herbs.exchange"} in codes(
             dir,
             quest.(&put_in(&1, ["exchange", "increment"], 3))
           )

    # Breaks: an exchange loads with a repeated outgoing item, a reward not held by its NPC, a
    # massless stock item, no harvest detail stocking its outgoing items, or an unknown fact.
    assert {"DUPLICATE_DEFINITION", "quests/herbs.exchange"} in codes(
             dir,
             quest.(&put_in(&1, ["exchange", "outgoing", Access.at(1)], "ore_01"))
           )

    for {file, change} <- [
          {"items/bandage_01.json",
           &Map.put(&1, "location", %{"in" => "room", "room" => "mine"})},
          {"items/ore_01.json", &Map.put(&1, "mass_grams", 0)},
          {"rooms/mine.json", &update_in(&1, ["details"], fn d -> Map.delete(d, "seam") end)}
        ],
        do:
          assert(
            {"OUTCOME_MISMATCH", "quests/herbs.exchange"} in codes(
              dir,
              exchange ++ [{file, change}]
            )
          )

    assert {"UNRESOLVED_REFERENCE", "quests/herbs.exchange.contribution"} in codes(
             dir,
             quest.(&put_in(&1, ["exchange", "contribution"], "missing"))
           )
  end

  # Breaks: a hound-style area whose rooms are not joined both ways compiles and later strands
  # wandering members (showcase goblins: goblin_pit <-> drill_yard).
  test "population area requires the opposite return exit", %{toolbox_showcase: dir} do
    assert {"SCHEMA_VIOLATION", "populations/goblins.area"} in codes(dir, [
             {"rooms/drill_yard.json",
              &update_in(&1, ["exits"], fn e -> Map.delete(e, "south") end)}
           ])
  end

  # Breaks: the compiler admits a wander period slower than replacement, or a night window that
  # does not wrap midnight (including night every hour).
  test "population wander is no slower than replacement and the night window wraps", %{
    toolbox_showcase: dir
  } do
    for change <- [
          %{"wander_interval" => 17_280_000, "replacement_delay" => 8_640_000},
          %{"night_start" => 1, "night_end" => 5},
          %{"night_start" => 5, "night_end" => 5}
        ] do
      assert {"SCHEMA_VIOLATION", "populations/goblins.wander_interval"} in codes(dir, [
               {"populations/goblins.json", &Map.merge(&1, change)}
             ]),
             inspect(change)
    end
  end

  # Breaks: a zero flight threshold compiles, so no living member can ever flee.
  test "pack flight threshold must be positive", %{toolbox_showcase: dir} do
    assert {"SCHEMA_VIOLATION", "populations/goblins.pack.flight_below_percent"} in codes(dir, [
             {"populations/goblins.json", &put_in(&1, ["pack", "flight_below_percent"], 0)}
           ])
  end

  # Breaks: a deer plan compiles without its hide (only a scavenger plan may omit the item).
  test "a plan without scavenge still requires its item", %{shoo_sampler: dir} do
    assert {"SCHEMA_VIOLATION", "populations/oak_deer.npc"} in codes(dir, [
             {"populations/oak_deer.json", &Map.delete(&1, "item")}
           ])
  end

  # Breaks: a plan's corpse is no longer a checked reference, so a dead member drops a missing item.
  test "a plan with an unresolved corpse is refused", %{shoo_sampler: dir} do
    assert codes(dir, [{"populations/oak_deer.json", &Map.put(&1, "corpse", "ghost")}]) ==
             [{"UNRESOLVED_REFERENCE", "populations/oak_deer.corpse"}]
  end

  # Breaks: the compiler accepts a one-way scavenge corridor that strands a return leg.
  test "scavenge corridor requires its reciprocal edge", %{shoo_sampler: dir} do
    assert {"SCHEMA_VIOLATION", "populations/crow.scavenge"} in codes(dir, [
             {"rooms/lane.json", &Map.put(&1, "exits", %{})}
           ])
  end

  # Breaks: a scavenge allowlist admits a container or a protected/wearable item.
  test "scavenge refuses unsafe allowlisted item roles", %{shoo_sampler: dir} do
    for patch <- [
          %{"container" => true},
          %{"capacity" => 2},
          %{"give_allowed" => false},
          %{"slot" => "cloak"}
        ] do
      assert {"SCHEMA_VIOLATION", "populations/crow.scavenge"} in codes(dir, [
               {"items/old_coin.json", &Map.merge(&1, patch)}
             ]),
             inspect(patch)
    end
  end

  # Breaks: a topic names a fact or label that does not exist, and the Codex lists a dead entry.
  test "a topic's fact and label must resolve", %{codex_sampler: dir} do
    for key <- ["fact", "name"] do
      assert {"UNRESOLVED_REFERENCE", "topics/mill.#{key}"} in codes(dir, [
               {"topics/mill.json", &Map.put(&1, key, "missing")}
             ])
    end
  end

  # Breaks: a topic fact that is instance-scoped or not boolean compiles, so a topic is learned
  # per match or holds a number.
  test "a topic fact must be a boolean player fact", %{codex_sampler: dir} do
    fact = "topic_mill_known"

    for edit <- [
          fn f -> put_in(f, ["facts", fact, "scopes"], ["instance"]) end,
          fn f -> put_in(f, ["facts", fact, "value_type"], %{"type" => "int", "default" => 0}) end
        ] do
      assert {"FACT_TYPE_MISMATCH", "topics/mill.fact"} in codes(dir, [{"facts.json", edit}])
    end
  end

  # Breaks: two topics on one fact compile, so one learned topic lights two Codex entries.
  test "two topics may not share one fact", %{codex_sampler: dir} do
    assert {"DUPLICATE_DEFINITION", "topics/mill_copy.fact"} in codes(dir, [
             {"topics/mill_copy.json",
              File.read!(Path.join(dir, "topics/mill.json")) |> JSON.decode!()}
           ])
  end
end
