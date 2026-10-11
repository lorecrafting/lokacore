defmodule Loka.ContentSpellEffectsTest do
  use ExUnit.Case, async: true

  @dir "cartridges/spell_effects_sampler"
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})

  # Breaks (toolbox row 29b): the compiler accepts an effect step on a recipe that is not a spell,
  # an effect below kernel_api 1.55, a damage step naming no NPC of the cartridge, or light.ignite
  # without light@1 (the TS loader refuses them too; spell_effects.test.ts).
  test "effect steps sit on spells, need 1.55, resolve and declare their owner" do
    dir = Loka.ContentSource.copy(@dir)
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [])

    detail = %{"kind" => "detail", "room" => "hall", "detail" => "stand"}
    misplaced = [{"recipes/ward.json", &Map.put(&1, "target", detail)}]
    assert {:error, diags} = Loka.ContentSource.compile(dir, misplaced)
    assert pairs(diags) == [{"SCHEMA_VIOLATION", "recipes/ward.outcomes.success.sequence[0].op"}]

    below = [{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.54")}]
    assert {:error, diags} = Loka.ContentSource.compile(dir, below)

    assert pairs(diags) == [
             {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
           ]

    ghoul = [
      {"recipes/flamma.json",
       &put_in(&1, ["outcomes", "success", "sequence", Access.at(0), "npc"], "ghoul")}
    ]

    assert {:error, diags} = Loka.ContentSource.compile(dir, ghoul)

    assert pairs(diags) == [
             {"UNRESOLVED_REFERENCE", "recipes/flamma.outcomes.success.sequence[0].npc"}
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
             {"UNDECLARED_CAPABILITY", "recipes/lux.outcomes.success.sequence[0].op"}
           ]
  end
end
