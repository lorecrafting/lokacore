defmodule Loka.ContentSpellsTest do
  use ExUnit.Case, async: true

  @dir "cartridges/spells_sampler"
  @floor {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})

  # Breaks (toolbox row 29a): the compiler accepts a spell or a level_compare policy leaf below kernel_api
  # 1.51, or two spells sharing one word (the TS loader refuses them too; spells.test.ts).
  test "spells and the level_compare leaf need 1.51; spell words are unique" do
    dir = Loka.ContentSource.copy(@dir)
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [])

    below = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.50")}
    open = %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}}
    # Spells without a level leaf.
    spells = [below, {"recipes/ward.json", &Map.put(&1, "policy", open)}]
    assert {:error, diags} = Loka.ContentSource.compile(dir, spells)
    assert pairs(diags) == [@floor]

    # A level_compare leaf without spells.
    level = %{"policy_version" => 1, "root" => %{"op" => "level_compare", "at_least" => 1}}

    leaf =
      [below, {"recipes/gather_ash.json", &Map.put(&1, "policy", level)}] ++
        for k <- ~w(lux ward noctis), do: {"recipes/#{k}.json", nil}

    assert {:error, diags} = Loka.ContentSource.compile(dir, leaf)
    assert pairs(diags) == [@floor]

    same = [{"recipes/noctis.json", &put_in(&1, ["target", "word"], "lux")}]
    assert {:error, diags} = Loka.ContentSource.compile(dir, same)

    assert Enum.sort(pairs(diags)) == [
             {"DUPLICATE_DEFINITION", "recipes/lux.target.word"},
             {"DUPLICATE_DEFINITION", "recipes/noctis.target.word"}
           ]
  end
end
