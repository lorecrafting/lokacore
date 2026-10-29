defmodule Loka.ContentScopedFactsTest do
  use ExUnit.Case, async: true

  @smith %{
    "cartridge_id" => "scoped_facts_sampler",
    "cartridge_version" => "0.0.1",
    "kind" => "npc",
    "key" => "smith"
  }

  # Breaks (toolbox row W2): the compiler leaves the new npc fields' short references unexpanded
  # (the loader would reject the artifact).
  test "row W2 npc short refs expand" do
    dir = Loka.ContentSource.copy("cartridges/scoped_facts_sampler")
    leaf = %{"op" => "fact_compare", "fact" => "times_met", "equals" => 0, "npc" => "smith"}
    named = {"reactions/fed.json", &put_in(&1, ["apply", Access.at(0), "npc"], "smith")}

    leafed = {"dialogues/smith_talk.json", &put_in(&1, ["policy", "root"], leaf)}
    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [leafed, named])
    c = JSON.decode!(artifact)["cartridge"]

    assert c["dialogues"]["scoped_facts_sampler@0.0.1:dialogue/smith_talk"]["policy"]["root"][
             "npc"
           ] == @smith

    assert hd(c["reactions"]["scoped_facts_sampler@0.0.1:reaction/fed"]["apply"])["npc"] == @smith
  end

  # Breaks (toolbox row FD4): the compiler leaves a `with` short reference unexpanded.
  test "row FD4 with short refs expand" do
    dir = Loka.ContentSource.copy("cartridges/rivals_sampler")
    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [])
    c = JSON.decode!(artifact)["cartridge"]
    miller = %{@smith | "cartridge_id" => "rivals_sampler", "key" => "miller"}
    assert hd(c["reactions"]["rivals_sampler@0.0.1:reaction/gift"]["apply"])["with"] == miller
  end
end
