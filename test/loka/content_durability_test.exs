defmodule Loka.ContentDurabilityTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/durability_sampler")}

  # Breaks (toolbox row 21; twin of the loader rows in kernel/ts/test/durability.test.ts): a
  # durability or repair compiles under API 1.68, a durability fact that is not per_subject, is an
  # npc_pair (row FD4) or is unbounded, a repair of a fact no weapon uses, or a repair without its refusal text.
  test "durability keeps its API floor, a bounded entity fact and its repair texts", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    edge = ["facts", "edge"]
    fact = "items/sword.weapon.durability.fact"

    for {edit, expected} <- [
          {{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.68")},
           {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
          {{"facts.json", &(pop_in(&1, edge ++ ["per_subject"]) |> elem(1))},
           {"SCHEMA_VIOLATION", fact}},
          {{"facts.json", &(pop_in(&1, edge ++ ["value_type", "maximum"]) |> elem(1))},
           {"SCHEMA_VIOLATION", fact}},
          {{"facts.json", &put_in(&1, edge ++ ["scopes"], ["player"])},
           {"SCHEMA_VIOLATION", fact}},
          {{"facts.json", &put_in(&1, edge ++ ["npc_pair"], true)}, {"SCHEMA_VIOLATION", fact}},
          {{"services/mend.json", &put_in(&1, ["benefit", "fact"], "quality")},
           {"SCHEMA_VIOLATION", "services/mend.benefit.fact"}},
          {{"text.json", &Map.delete(&1, "service.nothing_to_repair")},
           {"UNRESOLVED_REFERENCE", "services/mend"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [edit])
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
