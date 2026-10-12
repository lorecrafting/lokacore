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
end
