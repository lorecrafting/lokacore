defmodule Loka.ContentGroupTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/group_sampler")}

  # Breaks (toolbox row G8):
  # world.group names an unknown fact, a fact that is not a bool pair
  # fact at the player, or lacks the ally narration beside world.combat.
  test "the group keeps a bool pair member fact and the ally narration", %{
    dir: dir
  } do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    member = "cartridge.world.group.member"
    fact = ["facts", "in_group"]

    for {edit, expected} <- [
          {{"cartridge.json", &put_in(&1, ["world", "group", "member"], "nobody")},
           {"UNRESOLVED_REFERENCE", member}},
          {{"facts.json", &(pop_in(&1, fact ++ ["per_subject"]) |> elem(1))},
           {"SCHEMA_VIOLATION", member}},
          {{"facts.json",
            &put_in(&1, fact ++ ["value_type"], %{
              "type" => "int",
              "minimum" => 0,
              "maximum" => 1,
              "default" => 0
            })}, {"SCHEMA_VIOLATION", member}},
          {{"facts.json", &put_in(&1, fact ++ ["scopes"], ["instance"])},
           {"SCHEMA_VIOLATION", member}},
          {{"cartridge.json",
            &(pop_in(&1, ["world", "combat", "narration", "ally_hit"]) |> elem(1))},
           {"SCHEMA_VIOLATION", "cartridge.world.combat.narration.ally_hit"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [edit])
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end

  # Breaks (toolbox row 22a):
  # stay names an unknown fact, or fight a fact that is
  # not a pair fact.
  test "the hireling orders keep bool pair facts" do
    dir = Loka.ContentSource.copy("cartridges/hireling_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    for {edit, expected} <- [
          {{"cartridge.json", &put_in(&1, ["world", "group", "stay"], "nobody")},
           {"UNRESOLVED_REFERENCE", "cartridge.world.group.stay"}},
          {{"cartridge.json", &put_in(&1, ["world", "group", "fight"], "goblin_slain")},
           {"SCHEMA_VIOLATION", "cartridge.world.group.fight"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, List.wrap(edit))
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end

  # Breaks (toolbox row 22b): the
  # wage compiles with an unknown, gaining or regenerating resource.
  test "the wage keeps a conserved resource" do
    dir = Loka.ContentSource.copy("cartridges/hireling_sampler")
    at = "cartridge.world.group.wage.resource"
    resource = ["world", "group", "wage", "resource"]
    coins = ["resources", "coins"]
    by_position = Map.new(~w(standing sitting resting sleeping), &{&1, 1})
    regen = %{"every" => 3600, "by_position" => by_position}

    for {edit, expected} <- [
          {{"cartridge.json", &put_in(&1, resource, "gold")}, {"UNRESOLVED_REFERENCE", at}},
          {{"cartridge.json", &put_in(&1, resource, "hp")}, {"SCHEMA_VIOLATION", at}},
          {{"resources.json", &put_in(&1, coins ++ ["gain"], 1)}, {"SCHEMA_VIOLATION", at}},
          {{"resources.json", &put_in(&1, coins ++ ["regen"], regen)}, {"SCHEMA_VIOLATION", at}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, List.wrap(edit))
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
