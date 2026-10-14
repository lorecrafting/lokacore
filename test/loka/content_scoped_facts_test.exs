defmodule Loka.ContentScopedFactsTest do
  use ExUnit.Case, async: true

  @floor {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
  @smith %{
    "cartridge_id" => "scoped_facts_sampler",
    "cartridge_version" => "0.0.1",
    "kind" => "npc",
    "key" => "smith"
  }

  # Breaks (toolbox row W2): the compiler accepts a per_subject fact, or a subject field on a
  # fact_compare or a reaction's fact.assign, below kernel_api 1.47; or leaves the new npc fields'
  # short references unexpanded (the loader would reject the artifact).
  test "row W2 facts and subject fields need 1.47; their npc short refs expand" do
    dir = Loka.ContentSource.copy("cartridges/scoped_facts_sampler")
    api = &{"cartridge.json", fn m -> put_in(m, ["requires", "kernel_api", "at_least"], &1) end}

    flat = fn f ->
      Map.update!(f, "facts", &Map.new(&1, fn {k, v} -> {k, Map.delete(v, "per_subject")} end))
    end

    pair_free = {"facts.json", flat}

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [api.("1.46"), pair_free])
    leaf = %{"op" => "fact_compare", "fact" => "times_met", "equals" => 0, "npc" => "smith"}
    named = {"reactions/fed.json", &put_in(&1, ["apply", Access.at(0), "npc"], "smith")}

    rows = [
      [],
      [pair_free, {"dialogues/smith_talk.json", &put_in(&1, ["policy", "root"], leaf)}],
      [pair_free, named]
    ]

    for changes <- rows do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [api.("1.46") | changes])
      assert @floor in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end

    leafed = {"dialogues/smith_talk.json", &put_in(&1, ["policy", "root"], leaf)}
    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [leafed, named])
    c = JSON.decode!(artifact)["cartridge"]

    assert c["dialogues"]["scoped_facts_sampler@0.0.1:dialogue/smith_talk"]["policy"]["root"][
             "npc"
           ] == @smith

    assert hd(c["reactions"]["scoped_facts_sampler@0.0.1:reaction/fed"]["apply"])["npc"] == @smith
  end

  # Breaks (toolbox row FD4): the compiler accepts an npc_pair fact, or a `with` field on a
  # fact_compare or a reaction step, below kernel_api 1.89; or leaves `with` unexpanded.
  test "row FD4 pair facts and with fields need 1.89; with short refs expand" do
    dir = Loka.ContentSource.copy("cartridges/rivals_sampler")
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.88")}

    unpaired =
      {"facts.json", &update_in(&1, ["facts", "gloats"], fn f -> Map.delete(f, "npc_pair") end)}

    root = ["room_line_variants", Access.at(0), "when", "root"]

    no_with = [
      {"npcs/smith.json", &update_in(&1, root, fn r -> Map.delete(r, "with") end)},
      {"reactions/gift.json",
       &update_in(&1, ["apply", Access.at(0)], fn s -> Map.delete(s, "with") end)}
    ]

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [api, unpaired | no_with])

    for changes <- [[], [unpaired], [unpaired, hd(no_with)]] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [api | changes])
      assert @floor in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end

    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [])
    c = JSON.decode!(artifact)["cartridge"]
    miller = %{@smith | "cartridge_id" => "rivals_sampler", "key" => "miller"}
    assert hd(c["reactions"]["rivals_sampler@0.0.1:reaction/gift"]["apply"])["with"] == miller
  end
end
