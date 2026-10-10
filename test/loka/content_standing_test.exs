defmodule Loka.ContentStandingTest do
  use ExUnit.Case, async: true

  @floor {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
  @maud %{
    "cartridge_id" => "standing_sampler",
    "cartridge_version" => "0.0.1",
    "kind" => "npc",
    "key" => "maud"
  }

  # Breaks (toolbox rows 15 and G11), twins of the loader's in kernel/ts/test/standing.test.ts: the
  # compiler accepts a disposition, a friendly discount or a reaction fact.adjust below 1.47, a
  # fact.adjust of a non-int fact, an engage line on an NPC without an attack, a disposition on
  # a spawn template, or a friendly discount without a friendly disposition or (schema) with a
  # skill too; or leaves a fact.adjust's npc short reference unexpanded (the loader would reject
  # the artifact).
  test "rows 15 and G11 need 1.47, an int fact, an engage only with an attack, a friendly NPC" do
    dir = Loka.ContentSource.copy("cartridges/standing_sampler")
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.46")}
    flag = %{"version" => 1, "value_type" => %{"type" => "bool", "default" => false}}
    flag = Map.merge(flag, %{"scopes" => ["instance"], "meaning" => "A flag."})
    gift = &{"reactions/gift_apple.json", fn r -> put_in(r, ["apply", Access.at(0), &1], &2) end}

    # Without W2's pair fact, whose own floor would report the same diagnostic.
    w2_free = [
      {"facts.json",
       &update_in(&1, ["facts", "trust"], fn f -> Map.delete(f, "per_subject") end)},
      {"dialogues/maud_greet.json",
       &put_in(&1, ["policy", "root"], %{"op" => "all", "items" => []})},
      {"npcs/guard.json",
       &update_in(&1, ["disposition", "hostile", "root"], fn r -> hd(r["items"]) end)}
    ]

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, w2_free)

    rows = [
      {[api | w2_free], @floor},
      {[{"facts.json", &put_in(&1, ["facts", "flag"], flag)}, gift.("fact", "flag")],
       {"FACT_TYPE_MISMATCH", "reactions/gift_apple.apply[0].fact"}},
      {[{"npcs/guard.json", &Map.delete(&1, "attack")}],
       {"SCHEMA_VIOLATION", "npcs/guard.disposition"}},
      {[{"npcs/guard.json", &Map.put(&1, "spawn_template", true)}],
       {"SCHEMA_VIOLATION", "npcs/guard.disposition"}},
      {[
         {"npcs/peg.json", &update_in(&1, ["disposition"], fn d -> Map.delete(d, "friendly") end)}
       ], {"RESOURCE_SPEC_INVALID", "npcs/peg.shop"}},
      {[{"npcs/peg.json", &put_in(&1, ["shop", "buy_discount", "skill"], "haggle")}],
       {"SCHEMA_VIOLATION", "npcs/peg.shop.buy_discount"}}
    ]

    for {changes, want} <- rows do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert want in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end

    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [gift.("npc", "maud")])
    c = JSON.decode!(artifact)["cartridge"]

    assert hd(c["reactions"]["standing_sampler@0.0.1:reaction/gift_apple"]["apply"])["npc"] ==
             @maud
  end

  # Breaks (PM ruling on loka-kgd.54): a hostile-capable NPC speaking a dialogue that receives (so
  # refused while hostile) compiles silently, the warning fails the build, or it fires for a speaker
  # without disposition.hostile.
  test "a hostile-capable quest speaker warns and still compiles" do
    dir = Loka.ContentSource.copy("cartridges/standing_sampler")
    warning = {"warning", "HOSTILE_QUEST_SPEAKER", "dialogues/peg_talk.npc"}
    codes = &Enum.map(&1, fn d -> {d["severity"], d["code"], d["path"]} end)

    receives = fn d ->
      d
      |> put_in(["roles", "bread"], %{"role" => "item", "item" => "bread"})
      |> put_in(["choices", "chat", "receive"], %{"item" => "bread", "from" => "peg"})
    end

    peg = &update_in(&1, ["disposition"], fn d -> Map.delete(d, &2) end)

    assert {:ok, _, warnings} =
             Loka.ContentSource.compile(dir, [{"dialogues/peg_talk.json", receives}])

    assert warning in codes.(warnings), inspect(warnings)

    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, [])
    refute warning in codes.(warnings)

    changes = [{"dialogues/peg_talk.json", receives}, {"npcs/peg.json", &peg.(&1, "hostile")}]
    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, changes)
    refute warning in codes.(warnings)
  end

  # Breaks (PM ruling on loka-kgd.54): an escort choice (Chapter 1's Wren, given a hostile
  # condition) is not a quest step the warning covers, though a hostile Wren refuses it too.
  test "a hostile-capable escort speaker warns" do
    dir = Loka.ContentSource.copy("cartridges/ashmere_missing_child")
    always = %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}}

    changes = [
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.47")},
      {"npcs/wren.json", &Map.put(&1, "disposition", %{"hostile" => always})}
    ]

    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, changes)
    paths = for %{"code" => "HOSTILE_QUEST_SPEAKER", "path" => p} <- warnings, do: p
    assert "dialogues/a_wren_escort.npc" in paths, inspect(warnings)
  end
end
