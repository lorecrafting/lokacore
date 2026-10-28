defmodule Loka.ContentSpellEffectsTest do
  use ExUnit.Case, async: true

  @dir "cartridges/spell_effects_sampler"
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})

  # Breaks (toolbox row 29b): the compiler accepts an effect step on a recipe that is not a spell,
  # a damage step naming no NPC of the cartridge, or light.ignite
  # without light@1 (the TS loader refuses them too; spell_effects.test.ts).
  test "effect steps sit on spells, resolve and declare their owner" do
    dir = Loka.ContentSource.copy(@dir)
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [])

    detail = %{"kind" => "detail", "room" => "hall", "detail" => "stand"}
    misplaced = [{"actions/ward.json", &Map.put(&1, "target", detail)}]
    assert {:error, diags} = Loka.ContentSource.compile(dir, misplaced)
    assert pairs(diags) == [{"SCHEMA_VIOLATION", "actions/ward.outcomes.success.sequence[0].op"}]

    ghoul = [
      {"actions/flamma.json",
       &put_in(&1, ["outcomes", "success", "sequence", Access.at(0), "npc"], "ghoul")}
    ]

    assert {:error, diags} = Loka.ContentSource.compile(dir, ghoul)

    assert pairs(diags) == [
             {"UNRESOLVED_REFERENCE", "actions/flamma.outcomes.success.sequence[0].npc"}
           ]

    unlit =
      [
        {"cartridge.json",
         &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "light") end)}
      ] ++
        [{"rooms/crypt.json", &Map.delete(&1, "dark_description")}] ++
        for(i <- ~w(orb glowdust), do: {"items/#{i}.json", &Map.delete(&1, "fuel")})

    assert {:error, diags} = Loka.ContentSource.compile(dir, unlit)

    assert pairs(diags) == [
             {"UNDECLARED_CAPABILITY", "actions/lux.outcomes.success.sequence[0].op"}
           ]
  end

  # Breaks (loka-x6t.109): the compiler accepts a damage step without npc on an unaimed spell, an
  # aimed scope outside room_occupants and inventory, or aimed on a use target (the TS loader
  # refuses them too; aimed_spells.test.ts).
  test "aimed rows refused" do
    dir = Loka.ContentSource.copy(@dir)
    floor = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.119")}

    bare =
      &update_in(&1, ["outcomes", "success", "sequence", Access.at(0)], fn s ->
        Map.delete(s, "npc")
      end)

    details = &put_in(&1, ["target", "aimed"], %{"scopes" => ["inspectable_details"]})

    use = %{
      "kind" => "use",
      "tool" => %{"tag" => "silver"},
      "aimed" => %{"scopes" => ["inventory"]}
    }

    for {edits, want} <- [
          {[{"actions/flamma.json", bare}],
           {"SCHEMA_VIOLATION", "actions/flamma.outcomes.success.sequence[0].npc"}},
          {[floor, {"actions/flamma.json", details}],
           {"SCHEMA_VIOLATION", "actions/flamma.target.aimed.scopes[0]"}},
          {[floor, {"actions/ward.json", &Map.put(&1, "target", use)}],
           {"UNKNOWN_FIELD", "actions/ward.target.aimed"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert pairs(diags) == [want]
    end
  end

  # Breaks (loka-x6t.109): the schema still requires npc on damage or item on light.ignite, so an
  # aimed spell cannot leave its target to the cast.
  test "an aimed spell's damage and light.ignite need no npc or item" do
    dir = Loka.ContentSource.copy(@dir)
    floor = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.119")}

    aimed = fn field, scopes ->
      fn r ->
        r
        |> put_in(["target", "aimed"], %{"scopes" => scopes})
        |> update_in(["outcomes", "success", "sequence", Access.at(0)], &Map.delete(&1, field))
      end
    end

    edits = [
      floor,
      {"actions/flamma.json", aimed.("npc", ["room_occupants"])},
      {"actions/lux.json", aimed.("item", ["inventory"])}
    ]

    assert {:ok, _, []} = Loka.ContentSource.compile(dir, edits)
  end
end
