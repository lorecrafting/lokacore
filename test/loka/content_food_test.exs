defmodule Loka.ContentFoodTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/toolbox_showcase")}

  # Breaks: source allows non-recovery food, holder/equipment conflicts or a missing food capability.
  test "held-food source rejects unsafe or unbound consequences", %{dir: dir} do
    file = "items/loaf.json"

    cases = [
      {file, &put_in(&1, ["edible", "amount"], 0), ["areas/hub/items/loaf.edible.amount"]},
      {file, &put_in(&1, ["edible", "amount"], 9_007_199_254_740_992),
       ["areas/hub/items/loaf.edible.amount"]},
      {file, &put_in(&1, ["edible", "resource"], "unknown"), ["areas/hub/items/loaf.edible"]},
      {file, &put_in(&1, ["edible", "resource"], "hp"), ["areas/hub/items/loaf.edible"]},
      # amount alone is refused by the schema pair (loka-kgd.209)
      {file, &update_in(&1, ["edible"], fn e -> Map.delete(e, "resource") end),
       ["areas/hub/items/loaf.edible.resource"]},
      {"liquids/water.json", &Map.merge(&1, %{"resource" => "unknown", "amount" => 1}),
       ["liquids/water.resource"]},
      {file, &Map.put(&1, "container", true), ["areas/hub/items/loaf.edible"]},
      {file, &Map.put(&1, "slot", "hand"), ["areas/hub/items/loaf.slot"]},
      {file, &put_in(&1, ["edible", "narration"], "missing.line"),
       ["areas/hub/items/loaf.edible.narration"]},
      {"resources.json", &put_in(&1, ["resources", "mv", "regen", "by_position", "standing"], 0),
       ["areas/hub/items/loaf.edible"]},
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "food") end),
       ["areas/hub/items/loaf.edible"]}
    ]

    for {file, change, paths} <- cases do
      changed = change.(JSON.decode!(File.read!(Loka.ContentSource.path(dir, file))))

      regen =
        if get_in(changed, ["edible", "resource"]) == "hp",
          do: [
            {"resources.json",
             &put_in(&1, ["resources", "hp", "regen"], &1["resources"]["mv"]["regen"])}
          ],
          else: []

      {:error, d} = Loka.ContentSource.compile(dir, [{file, changed} | regen])
      assert Enum.any?(d, &(&1["path"] in paths)), inspect({file, Enum.map(d, & &1["path"])})
    end
  end

  # Breaks: the restore check asks more than a positive standing regen of mv.
  test "a restore compiles when mv regenerates by one standing", %{dir: dir} do
    standing = &put_in(&1, ["resources", "mv", "regen", "by_position", "standing"], 1)
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [{"resources.json", standing}])
  end

  # loka-kgd.209, loka-kgd.50. Breaks: a drink's applies escaping the meal gate, so a liquid
  # status moves the derived hp maximum.
  test "a drink's applies never names an hp_max status", %{dir: dir} do
    read = &JSON.decode!(File.read!(Path.join(dir, &1)))
    water = {"liquids/water.json", Map.put(read.("liquids/water.json"), "applies", ["hearty"])}
    terms = %{"terms" => [%{"attribute" => "str", "per_point" => 1, "pivot" => 10}]}
    derived = put_in(read.("cartridge.json"), ["world", "derived", "hp_max"], terms)

    assert {:error, ds} = Loka.ContentSource.compile(dir, [water, {"cartridge.json", derived}])

    assert {"SCHEMA_VIOLATION", "liquids/water.applies[0]"} in for(
             d <- ds,
             do: {d["code"], d["path"]}
           )

    # The control: the same drink without the hp_max term compiles.
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [water])
  end
end

defmodule Loka.ContentMealTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/kitchen_sampler")}

  # Row hs-5. Breaks: an empty `applies` (minItems), a ref left unresolved, or a meal status
  # moving the derived hp maximum (loka-kgd.50), its term named short or qualified.
  test "a meal's applies resolves and never names an hp_max status", %{dir: dir} do
    stew = "items/stew_plain_01.json"
    read = &JSON.decode!(File.read!(Path.join(dir, &1)))

    hp_max = %{
      "hp_max" => %{"terms" => [%{"attribute" => "str", "per_point" => 1, "pivot" => 10}]}
    }

    at = "items/stew_plain_01.edible.applies"
    edit = &[{stew, put_in(read.(stew), ["edible", "applies"], &1)}]
    derive = &[{"cartridge.json", put_in(read.("cartridge.json"), ["world", "derived"], &1)}]
    derived = derive.(hp_max)
    # The same attribute as a qualified ref: the gate compares expanded refs, not source strings.
    qualified =
      put_in(hp_max, ["hp_max", "terms", Access.at(0), "attribute"], %{
        "cartridge_id" => "kitchen_sampler",
        "cartridge_version" => "0.0.1",
        "kind" => "attribute",
        "key" => "str"
      })

    cases = [
      {edit.([]), {"SCHEMA_VIOLATION", at}},
      {edit.(["nothing"]), {"UNRESOLVED_REFERENCE", at <> "[0]"}},
      {derived, {"SCHEMA_VIOLATION", at <> "[0]"}},
      {derive.(qualified), {"SCHEMA_VIOLATION", at <> "[0]"}}
    ]

    for {changes, expected} <- cases do
      assert {:error, ds} = Loka.ContentSource.compile(dir, changes)
      assert expected in for(d <- ds, do: {d["code"], d["path"]})
    end
  end

  # loka-kgd.209. Breaks: an {status, duration} entry left unresolved, a duration on a permanent
  # status, a status naming both `resource` and `ticks`, a 0 tick, a pool ticked twice, over 16 ticks, or none.
  test "an applies entry's own duration and a status's ticks are checked", %{dir: dir} do
    read = &JSON.decode!(File.read!(Path.join(dir, &1)))
    stew = "items/stew_plain_01.json"
    fed = "statuses/fed.json"
    applies = &{stew, put_in(read.(stew), ["edible", "applies"], [&1])}
    status = &{fed, &1.(read.(fed))}
    ticks = &Map.put(&1, "ticks", [%{"resource" => "mv", "per_tick" => &2}])
    mv = %{"resource" => "mv", "per_tick" => 2}
    at = "items/stew_plain_01.edible.applies[0]"

    cases = [
      {[applies.(%{"status" => "nothing", "duration" => 60})], {"UNRESOLVED_REFERENCE", at}},
      {[applies.(%{"status" => "fed", "duration" => 60}), status.(&permanent/1)],
       {"SCHEMA_VIOLATION", at}},
      {[status.(&ticks.(&1, 2))], {"SCHEMA_VIOLATION", "statuses/fed.resource"}},
      {[status.(&ticks.(Map.delete(&1, "resource"), 0))],
       {"SCHEMA_VIOLATION", "statuses/fed.ticks[0].per_tick"}},
      {[status.(&Map.delete(&1, "resource"))], {"SCHEMA_VIOLATION", "statuses/fed.resource"}},
      {[status.(&Map.put(Map.delete(&1, "resource"), "ticks", [mv, %{mv | "per_tick" => -1}]))],
       {"SCHEMA_VIOLATION", "statuses/fed.ticks[1].resource"}},
      {[status.(&Map.put(Map.delete(&1, "resource"), "ticks", List.duplicate(mv, 17)))],
       {"SCHEMA_VIOLATION", "statuses/fed.ticks"}}
    ]

    for {changes, expected} <- cases do
      assert {:error, ds} = Loka.ContentSource.compile(dir, changes)
      assert expected in for(d <- ds, do: {d["code"], d["path"]}), inspect(ds)
    end

    # The control: the same entry on the timed status compiles.
    assert {:ok, _, []} =
             Loka.ContentSource.compile(dir, [applies.(%{"status" => "fed", "duration" => 60})])
  end

  defp permanent(s), do: Map.put(s, "duration", "permanent")
end
