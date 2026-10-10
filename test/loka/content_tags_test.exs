defmodule Loka.ContentTagsTest do
  use ExUnit.Case, async: true

  # Breaks: the compiler drops a definition's tags, leaves a has_tag short reference unexpanded,
  # or compiles a has_tag naming no item, barrier or room, or tags or has_tag without tags@1
  # (toolbox row G1).
  test "tags reach the artifact and has_tag keeps its reference and owner" do
    dir = Loka.ContentSource.copy("cartridges/tags_sampler")
    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [])
    c = JSON.decode!(artifact)["cartridge"]
    hall = c["rooms"]["tags_sampler@0.0.1:room/hall"]
    assert c["barriers"]["tags_sampler@0.0.1:barrier/wooden_door"]["tags"] == ~w(wooden burnable)
    assert c["items"]["tags_sampler@0.0.1:item/rod"]["tags"] == ~w(metal)
    assert hall["tags"] == ~w(wooden)

    assert hall["details"]["wooden_door"]["variants"] |> hd() |> get_in(["when", "root"]) == %{
             "op" => "has_tag",
             "tag" => "burnable",
             "barrier" => %{
               "cartridge_id" => "tags_sampler",
               "cartridge_version" => "0.0.1",
               "kind" => "barrier",
               "key" => "wooden_door"
             }
           }

    root = ["details", "iron_door", "variants", Access.at(0), "when", "root"]

    leaf = &put_in(&1, root, Map.merge(%{"op" => "has_tag", "tag" => "metal"}, &2))
    variant = "rooms/hall.details.iron_door.variants[0].when.root"
    drop = &update_in(&1, ["requires", "capabilities"], fn m -> Map.delete(m, "tags") end)

    cases = [
      {"rooms/hall.json", &leaf.(&1, %{"barrier" => "oak_door"}),
       {"UNRESOLVED_REFERENCE", variant <> ".barrier"}},
      {"rooms/hall.json", &leaf.(&1, %{"item" => "plank"}),
       {"UNRESOLVED_REFERENCE", variant <> ".item"}},
      {"rooms/hall.json", &leaf.(&1, %{"room" => "attic"}),
       {"UNRESOLVED_REFERENCE", variant <> ".room"}},
      {"cartridge.json", drop, {"UNDECLARED_CAPABILITY", variant <> ".op"}},
      {"cartridge.json", drop, {"UNDECLARED_CAPABILITY", "items/rod.tags"}},
      {"cartridge.json", drop, {"UNDECLARED_CAPABILITY", "barriers/iron_door.tags"}},
      {"cartridge.json", drop, {"UNDECLARED_CAPABILITY", "rooms/hall.tags"}}
    ]

    for {file, change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
