defmodule Loka.ContentGroupTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/group_sampler")}

  # Breaks (toolbox row G8; twin of the loader rows in kernel/ts/test/group.test.ts):
  # world.group compiles under API 1.69, names an unknown fact, a fact that is not a bool pair
  # fact at the player, or lacks the ally narration beside world.combat.
  test "the group keeps its API floor, a bool pair member fact and the ally narration", %{
    dir: dir
  } do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    member = "cartridge.world.group.member"
    fact = ["facts", "in_group"]

    for {edit, expected} <- [
          {{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.69")},
           {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
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

  # Breaks (toolbox row 22a; twin of the loader rows in kernel/ts/test/hireling.test.ts):
  # stay or fight compiles under API 1.72, stay names an unknown fact, or fight a fact that is
  # not a pair fact.
  test "the hireling orders keep API 1.73 and bool pair facts" do
    dir = Loka.ContentSource.copy("cartridges/hireling_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    api = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}

    for {edit, expected} <- [
          {[{"cartridge.json", &at_172(&1, "fight")}, no_fee()], api},
          {[{"cartridge.json", &at_172(&1, "stay")}, no_fee()], api},
          {{"cartridge.json", &put_in(&1, ["world", "group", "stay"], "nobody")},
           {"UNRESOLVED_REFERENCE", "cartridge.world.group.stay"}},
          {{"cartridge.json", &put_in(&1, ["world", "group", "fight"], "goblin_slain")},
           {"SCHEMA_VIOLATION", "cartridge.world.group.fight"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, List.wrap(edit))
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end

  # Breaks (toolbox row 22b; twin of the loader rows in kernel/ts/test/hireling.test.ts): the
  # wage compiles with an unknown, gaining or regenerating resource or under API 1.74, or a skill-less
  # hire fee compiles under API 1.74.
  test "the wage keeps API 1.75 and a conserved resource; a skill-less fee 1.75" do
    dir = Loka.ContentSource.copy("cartridges/hireling_sampler")
    api = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
    at = "cartridge.world.group.wage.resource"
    resource = ["world", "group", "wage", "resource"]
    coins = ["resources", "coins"]
    by_position = Map.new(~w(standing sitting resting sleeping), &{&1, 1})
    regen = %{"every" => 3600, "by_position" => by_position}
    at_174 = &put_in(&1, ["requires", "kernel_api", "at_least"], "1.74")
    no_wage = {"cartridge.json", &(at_174.(&1) |> pop_in(["world", "group", "wage"]) |> elem(1))}

    for {edit, expected} <- [
          {{"cartridge.json", &put_in(&1, resource, "gold")}, {"UNRESOLVED_REFERENCE", at}},
          {{"cartridge.json", &put_in(&1, resource, "hp")}, {"SCHEMA_VIOLATION", at}},
          {{"resources.json", &put_in(&1, coins ++ ["gain"], 1)}, {"SCHEMA_VIOLATION", at}},
          {{"resources.json", &put_in(&1, coins ++ ["regen"], regen)}, {"SCHEMA_VIOLATION", at}},
          {[{"cartridge.json", at_174}, no_fee()], api},
          {no_wage, api}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, List.wrap(edit))
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [no_wage, no_fee()])
  end

  # Row 22b's skill-less hire fee needs API 1.75; drop it to test a lower floor.
  defp no_fee,
    do:
      {"dialogues/hal_talk.json", &(pop_in(&1, ["choices", "hire", "lesson_payment"]) |> elem(1))}

  # API 1.72 with only one of the two orders declared; row 22b's wage needs 1.75, so drop it too.
  defp at_172(c, drop),
    do:
      put_in(c, ["requires", "kernel_api", "at_least"], "1.72")
      |> pop_in(["world", "group", drop])
      |> elem(1)
      |> pop_in(["world", "group", "wage"])
      |> elem(1)
end
