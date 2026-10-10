defmodule Loka.ContentSkillGrowthTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/skills_sampler")}

  # Breaks: growth or an opposed check under API 1.43, growth that does not increase, an opposed
  # check against an unrated detail or naming an unknown skill or attribute, or an authored
  # uses_<key> fact compile (toolbox rows 5 and G5; twin of the loader rows in
  # kernel/ts/test/skill_growth.test.ts).
  test "growth and opposed checks keep their API floor, order, rating and references", %{
    dir: dir
  } do
    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [])

    assert %{"type" => "int", "default" => 0, "minimum" => 0, "maximum" => 5} =
             Jason.decode!(artifact)["cartridge"]["facts"]["skills_sampler@0.0.1:fact/uses_pick"][
               "value_type"
             ]

    uses = %{
      "version" => 1,
      "value_type" => %{"type" => "int", "default" => 0},
      "scopes" => ["player"],
      "meaning" => "authored"
    }

    cases = [
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.43"),
       {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
      {"skills/pick.json", &put_in(&1, ["growth"], [1, 3, 3]),
       {"SCHEMA_VIOLATION", "skills/pick.growth"}},
      {"rooms/vault_room.json",
       &update_in(&1, ["details", "gate"], fn g -> Map.delete(g, "rating") end),
       {"SCHEMA_VIOLATION", "recipes/pick_gate.check"}},
      {"recipes/pick_gate.json", &put_in(&1, ["check", "skill"], "climb"),
       {"UNRESOLVED_REFERENCE", "recipes/pick_gate.check.skill"}},
      {"recipes/force_vault.json", &put_in(&1, ["check", "attribute"], "dex"),
       {"UNRESOLVED_REFERENCE", "recipes/force_vault.check.attribute"}},
      {"facts.json", &put_in(&1, ["facts", "uses_pick"], uses),
       {"RESERVED_FACT", "facts.facts.uses_pick"}}
    ]

    for {file, change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect({path, diags})
    end
  end
end
