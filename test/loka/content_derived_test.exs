defmodule Loka.ContentDerivedTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/derived_sampler")}

  # Breaks: a derived table naming no attribute, lacking attributes@1, an old API floor, or
  # modifying a stat whose combat or carry settings are absent compiles.
  test "derived tables keep their references, owner and settings", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    terms = &["world", "derived", &1, "terms", Access.at(0)]

    cases = [
      {&put_in(&1, terms.("damage") ++ ["attribute"], "luck"),
       {"UNRESOLVED_REFERENCE", "cartridge.world.derived.damage.terms[0].attribute"}},
      {&put_in(&1, ["requires", "kernel_api", "at_least"], "1.38"),
       {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
      {&update_in(&1, ["world"], fn w -> Map.delete(w, "carry") end),
       {"SCHEMA_VIOLATION", "cartridge.world.derived.carry_grams"}},
      {&update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "attributes") end),
       {"UNDECLARED_CAPABILITY", "cartridge.world.derived"}}
    ]

    for {change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{"cartridge.json", change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
