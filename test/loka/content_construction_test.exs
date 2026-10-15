defmodule Loka.ContentConstructionTest do
  use ExUnit.Case, async: true

  @dir "cartridges/build_sampler"
  @kat JSON.decode!(File.read!("protocol/fixtures/build_sampler_hash.json"))
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})
  defp lane(f), do: {"rooms/lane.json", &update_in(&1, ["site"], f)}
  defp api(v), do: {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], v)}
  defp hut(path, v), do: {"blueprints/hut.json", &put_in(&1, path, v)}
  @floor {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}

  # Breaks: a blueprint, its variant or enter lock, a site (its short blueprint ref expanded) or
  # world.construction dropped or reshaped in the artifact (protocol/fixtures/build_sampler_hash.json).
  test "build_sampler compiles to its pinned artifact without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile(@dir) == {:ok, expected, []}
  end

  # Breaks (Built rooms S1): the compiler accepts a site direction the room has an exit in, a site
  # blueprint the cartridge does not define, a blueprint text key or enter-lock fact it does not
  # define, or construction content below kernel_api 1.99 (the TS
  # loader refuses them too; construction.test.ts).
  test "a site names no exit direction and only defined blueprints; construction needs 1.99" do
    dir = Loka.ContentSource.copy(@dir)
    exit = {"rooms/lane.json", &put_in(&1, ["exits"], %{"north" => %{"to" => "lane"}})}
    missing = lane(&put_in(&1, ["blueprints"], ["hut", "shed"]))

    for {edits, expected} <- [
          {[exit], [{"SITE_EXIT_CONFLICT", "rooms/lane.site.directions[0]"}]},
          {[missing], [{"UNRESOLVED_REFERENCE", "rooms/lane.site.blueprints[1]"}]},
          {[api("1.98")], [@floor]},
          {[hut(["title"], "blueprint.hut.nope")],
           [{"UNRESOLVED_REFERENCE", "blueprints/hut.title"}]},
          {[hut(["variants", Access.at(0), "description"], "blueprint.hut.nope")],
           [{"UNRESOLVED_REFERENCE", "blueprints/hut.variants[0].description"}]},
          {[hut(["locks", "enter", "root", "fact"], "nope")],
           [{"UNRESOLVED_REFERENCE", "blueprints/hut.locks.enter.root.fact"}]}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert pairs(diags) == expected
    end

    # Each trigger alone: world.construction, a blueprint or a site still needs 1.99.
    only_world = [
      api("1.98"),
      {"blueprints/hut.json", nil},
      {"rooms/lane.json", &Map.delete(&1, "site")}
    ]

    only_blueprint = [
      api("1.98"),
      {"cartridge.json", &Map.delete(&1, "world")},
      {"rooms/lane.json", &Map.delete(&1, "site")}
    ]

    only_site = [
      api("1.98"),
      {"blueprints/hut.json", nil},
      {"cartridge.json", &Map.delete(&1, "world")}
    ]

    for edits <- [only_world, only_blueprint, only_site] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert @floor in pairs(diags), inspect(diags)
    end

    unowned =
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "construction") end)}

    assert {:error, diags} = Loka.ContentSource.compile(dir, [unowned])
    assert {"UNDECLARED_CAPABILITY", "blueprints/hut"} in pairs(diags), inspect(diags)

    # A site and world.construction each need construction@1 too, with no blueprint defined.
    for {drop, path} <- [
          {{"cartridge.json", &Map.delete(&1, "world")}, "rooms/lane.site"},
          {{"rooms/lane.json", &Map.delete(&1, "site")}, "cartridge.world.construction"}
        ] do
      assert {:error, diags} =
               Loka.ContentSource.compile(dir, [unowned, {"blueprints/hut.json", nil}, drop])

      assert {"UNDECLARED_CAPABILITY", path} in pairs(diags), inspect(diags)
    end
  end
end
