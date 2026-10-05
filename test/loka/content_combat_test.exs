defmodule Loka.ContentCombatTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  @attack %{"chance" => 80, "damage_min" => 1, "damage_max" => 3}
  @manifest %{
    "api_version" => "loka/v3",
    "id" => "fight",
    "version" => "1.0.0",
    "title" => "Fight",
    "requires" => %{
      "kernel_api" => %{"at_least" => "1.6", "below" => "2.0"},
      "content_schema" => 1,
      "rule_ir" => 1,
      "client_features" => [],
      "capabilities" => %{
        "movement" => 1,
        "containment" => 1,
        "combat" => 1,
        "schedule" => 1,
        "death" => 1,
        "position" => 1,
        "fact" => 1
      }
    },
    "supported_profiles" => ["offline_private"],
    "entry" => "cellar",
    "world" => %{
      "death" => %{
        "player_corpse" => "body_corpse",
        "npc_corpse" => "rat_corpse",
        "shrine" => "shrine",
        "restore" => %{"hp" => 20, "mv" => 82}
      },
      "combat" => %{
        "player_attack" => @attack,
        "interval" => 2,
        "sleep_multiplier" => 2,
        "flee_multiplier" => 3,
        "narration" =>
          Map.new(~w(player_hit player_miss npc_hit npc_miss player_died npc_died), &{&1, "t"})
      },
      "death_credit" => [%{"npc" => "rat", "room" => "cellar", "fact" => "rat_dead"}]
    }
  }
  @npc %{
    "keywords" => ["rat"],
    "short" => "t",
    "room_line" => "t",
    "description" => "t",
    "room" => "cellar",
    "hp" => %{"minimum" => 0, "maximum" => 6, "start" => 6, "gain" => 0},
    "attack" => @attack
  }
  @fact %{
    "version" => 1,
    "scopes" => ["player"],
    "value_type" => %{"type" => "bool", "default" => false},
    "meaning" => "Rat defeated"
  }

  defp source(dir, manifest \\ @manifest, npc \\ @npc, fact \\ @fact) do
    for {rel, value} <-
          [
            {"cartridge.json", manifest},
            {"npcs/rat.json", npc},
            {"rooms/cellar.json", %{"title" => "t", "description" => "t", "exits" => %{}}},
            {"rooms/shrine.json",
             %{"title" => "t", "description" => "t", "exits" => %{}, "sanctuary" => true}},
            {"facts.json", %{"facts" => %{"rat_dead" => fact}}},
            {"text.json", %{"t" => "Test"}}
          ] ++
            (for name <- ~w(body_corpse rat_corpse) do
               {"items/" <> name <> ".json",
                %{
                  "keywords" => ["corpse"],
                  "short" => "t",
                  "room_line" => "t",
                  "description" => "t",
                  "location" => %{"in" => "template"},
                  "mass_grams" => 0,
                  "container" => true
                }}
             end) do
      path = Path.join(dir, rel)
      File.mkdir_p!(Path.dirname(path))
      File.write!(path, JSON.encode!(value))
    end
  end

  # Breaks: a new reference field bypasses source expansion and emits an unusable artifact.
  test "death credit short references become local definition references", %{tmp_dir: dir} do
    source(dir)
    assert {:ok, bytes, _} = Loka.Content.compile(dir)
    artifact = JSON.decode!(bytes)["cartridge"]

    assert artifact["world"]["death_credit"] == [
             %{
               "npc" => %{
                 "cartridge_id" => "fight",
                 "cartridge_version" => "1.0.0",
                 "kind" => "npc",
                 "key" => "rat"
               },
               "room" => %{
                 "cartridge_id" => "fight",
                 "cartridge_version" => "1.0.0",
                 "kind" => "room",
                 "key" => "cellar"
               },
               "fact" => %{
                 "cartridge_id" => "fight",
                 "cartridge_version" => "1.0.0",
                 "kind" => "fact",
                 "key" => "rat_dead"
               }
             }
           ]
  end

  # Breaks: combat opts in without the executable API/owners, or admits a reversed damage roll/no HP.
  test "combat requirements and attack bounds are enforced", %{tmp_dir: dir} do
    cases =
      [
        {put_in(@manifest, ["requires", "kernel_api", "at_least"], "1.5"), @npc,
         "KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"},
        {put_in(@manifest, ["world", "combat", "player_attack", "damage_min"], 4), @npc,
         "SCHEMA_VIOLATION", "cartridge.world.combat.player_attack.damage_max"},
        {@manifest, put_in(@npc, ["attack", "damage_min"], 4), "SCHEMA_VIOLATION",
         "npcs/rat.attack.damage_max"},
        {@manifest, Map.delete(@npc, "hp"), "SCHEMA_VIOLATION", "npcs/rat.hp"},
        {update_in(@manifest, ["world"], &Map.delete(&1, "combat")), @npc, "SCHEMA_VIOLATION",
         "npcs/rat.attack"}
      ] ++
        for cap <- ~w(combat schedule death) do
          {update_in(@manifest, ["requires", "capabilities"], &Map.delete(&1, cap)), @npc,
           "UNDECLARED_CAPABILITY", "cartridge.world.combat"}
        end

    for {manifest, npc, code, path} <- cases do
      source(dir, manifest, npc)
      assert {:error, ds} = Loka.Content.compile(dir), path
      assert Enum.any?(ds, &(&1["code"] == code && &1["path"] == path)), inspect(ds)
    end
  end

  # Breaks: credit can name the wrong NPC/room/fact, duplicate ownership, or an already-true/global fact.
  test "death credit is unique and bound to an attackable local NPC and player Boolean", %{
    tmp_dir: dir
  } do
    credit = hd(@manifest["world"]["death_credit"])

    cases =
      [
        {update_in(@manifest, ["world"], &Map.delete(&1, "combat")), Map.delete(@npc, "attack"),
         @fact, "SCHEMA_VIOLATION", "cartridge.world.death_credit"},
        {@manifest, Map.delete(@npc, "attack"), @fact, "SCHEMA_VIOLATION",
         "cartridge.world.death_credit[0].npc"},
        {@manifest, @npc, put_in(@fact, ["value_type", "default"], true), "SCHEMA_VIOLATION",
         "cartridge.world.death_credit[0].fact"},
        {@manifest, @npc, Map.put(@fact, "scopes", ["instance"]), "SCHEMA_VIOLATION",
         "cartridge.world.death_credit[0].fact"},
        {@manifest, @npc, Map.put(@fact, "value_type", %{"type" => "int", "default" => 0}),
         "SCHEMA_VIOLATION", "cartridge.world.death_credit[0].fact"},
        {put_in(@manifest, ["world", "death_credit"], [Map.put(credit, "room", "shrine")]), @npc,
         @fact, "SCHEMA_VIOLATION", "cartridge.world.death_credit[0].room"},
        {put_in(@manifest, ["world", "death_credit"], [credit, credit]), @npc, @fact,
         "SCHEMA_VIOLATION", "cartridge.world.death_credit[0].npc"},
        {put_in(@manifest, ["world", "death_credit"], [credit, credit]), @npc, @fact,
         "SCHEMA_VIOLATION", "cartridge.world.death_credit[0].fact"}
      ] ++
        for field <- ~w(npc room fact) do
          {put_in(@manifest, ["world", "death_credit"], [Map.put(credit, field, "missing")]),
           @npc, @fact, "UNRESOLVED_REFERENCE", "cartridge.world.death_credit[0]." <> field}
        end

    for {manifest, npc, fact, code, path} <- cases do
      source(dir, manifest, npc, fact)
      assert {:error, ds} = Loka.Content.compile(dir), path
      assert Enum.any?(ds, &(&1["code"] == code && &1["path"] == path)), inspect(ds)
    end
  end

  # Breaks: a combat narration role references missing text and cannot narrate its due round.
  test "every combat narration role resolves to cartridge text", %{tmp_dir: dir} do
    for field <- ~w(player_hit player_miss npc_hit npc_miss player_died npc_died) do
      source(dir, put_in(@manifest, ["world", "combat", "narration", field], "missing"))
      assert {:error, ds} = Loka.Content.compile(dir)

      assert Enum.any?(
               ds,
               &(&1["code"] == "UNRESOLVED_REFERENCE" &&
                   &1["path"] == "cartridge.world.combat.narration." <> field)
             )
    end
  end

  # Breaks: combat loads but its first fatal round has no corpse/shrine settings.
  test "combat requires death settings", %{tmp_dir: dir} do
    source(dir, update_in(@manifest, ["world"], &Map.delete(&1, "death")))

    for name <- ~w(body_corpse rat_corpse),
        do: File.rm!(Path.join(dir, "items/" <> name <> ".json"))

    assert {:error, ds} = Loka.Content.compile(dir)

    assert Enum.any?(
             ds,
             &(&1["code"] == "SCHEMA_VIOLATION" && &1["path"] == "cartridge.world.death")
           )
  end
end
