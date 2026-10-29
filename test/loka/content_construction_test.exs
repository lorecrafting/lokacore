defmodule Loka.ContentConstructionTest do
  use ExUnit.Case, async: true

  @dir "cartridges/build_sampler"
  @kat JSON.decode!(File.read!("protocol/fixtures/build_sampler_hash.json"))
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})
  defp lane(f), do: {"rooms/lane.json", &update_in(&1, ["site"], f)}
  defp hut(path, v), do: {"blueprints/hut.json", &put_in(&1, path, v)}

  # Breaks: a blueprint, its variant or enter lock, a site (its short blueprint ref expanded) or
  # world.construction dropped or reshaped in the artifact (protocol/fixtures/build_sampler_hash.json).
  test "build_sampler compiles to its pinned artifact without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile(@dir) == {:ok, expected, []}
  end

  # Breaks (Built rooms S1): the compiler accepts a site direction the room has an exit in, a site
  # blueprint the cartridge does not define, a blueprint text key, enter-lock fact or (S4)
  # weathering or ruin status it does not define.
  test "a site names no exit direction and only defined blueprints" do
    dir = Loka.ContentSource.copy(@dir)
    exit = {"rooms/lane.json", &put_in(&1, ["exits"], %{"north" => %{"to" => "lane"}})}
    missing = lane(&put_in(&1, ["blueprints"], ["hut", "shed"]))

    for {edits, expected} <- [
          {[exit], [{"SITE_EXIT_CONFLICT", "rooms/lane.site.directions[0]"}]},
          {[missing], [{"UNRESOLVED_REFERENCE", "rooms/lane.site.blueprints[1]"}]},
          {[hut(["title"], "blueprint.hut.nope")],
           [{"UNRESOLVED_REFERENCE", "blueprints/hut.title"}]},
          {[hut(["variants", Access.at(0), "description"], "blueprint.hut.nope")],
           [{"UNRESOLVED_REFERENCE", "blueprints/hut.variants[0].description"}]},
          {[hut(["locks", "enter", "root", "fact"], "nope")],
           [{"UNRESOLVED_REFERENCE", "blueprints/hut.locks.enter.root.fact"}]},
          {[hut(["weathering"], "nope")],
           [{"UNRESOLVED_REFERENCE", "blueprints/hut.weathering"}]},
          {[hut(["ruin"], "nope")], [{"UNRESOLVED_REFERENCE", "blueprints/hut.ruin"}]}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert pairs(diags) == expected
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

  # Breaks (Built rooms S2): the compiler admits a build service whose direction is not in the
  # site's directions, whose blueprint the site does not list, or whose site does not resolve.
  # Breaks (Built rooms S3): the compiler admits a claim on a build commission or a build fact that
  # is not a false-default player bool (construction.test.ts pins the TS side).
  # Breaks (Built rooms S4): the compiler admits a mend whose direction is not its site's, whose
  # site lists no blueprint with a ruin, or whose site does not resolve (construction.test.ts too);
  # (S5) a raze whose direction is not its site's, whose site does not resolve, or without a
  # refusal text.
  test "a build benefit names a direction and blueprint of its resolved site" do
    dir = Loka.ContentSource.copy(@dir)
    build = &{"services/raise_hut.json", fn s -> put_in(s, ["benefit", &1], &2) end}
    mend = &{"services/mend_hut.json", fn s -> put_in(s, ["benefit", &1], &2) end}
    raze = &{"services/raze_hut.json", fn s -> put_in(s, ["benefit", &1], &2) end}
    # a claim needs its own refusal text; supplied so only the commission check refuses
    claim_text =
      {"text.json", &Map.merge(&1, %{"service.not_ready" => "-", "service.no_output" => "-"})}

    free_build = [
      {"services/raise_hut.json", &Map.put(&1, "price", 0)},
      {"cartridge.json", &put_in(&1, ~w(requires kernel_api at_least), "1.102")}
    ]

    shed = {"blueprints/shed.json", JSON.decode!(File.read!("#{@dir}/blueprints/hut.json"))}

    for {edits, expected} <- [
          {[build.("direction", "east")],
           [{"SCHEMA_VIOLATION", "services/raise_hut.benefit.direction"}]},
          {[shed, build.("blueprint", "shed")],
           [{"SCHEMA_VIOLATION", "services/raise_hut.benefit.blueprint"}]},
          {[build.("site", "nowhere")],
           [{"UNRESOLVED_REFERENCE", "services/raise_hut.benefit.site"}]},
          {[{"services/cancel_hut.json", &put_in(&1, ["benefit", "kind"], "claim")}, claim_text],
           [{"SCHEMA_VIOLATION", "services/cancel_hut.benefit.service"}]},
          # row kgd.70: price 0 is for an entitlement barter only, never a build
          {free_build, [{"SCHEMA_VIOLATION", "services/raise_hut.price"}]},
          {[{"facts.json", &put_in(&1, ~w(facts hut_ordered value_type default), true)}],
           [{"SCHEMA_VIOLATION", "services/raise_hut.benefit.fact"}]},
          {[mend.("direction", "east")],
           [{"SCHEMA_VIOLATION", "services/mend_hut.benefit.direction"}]},
          {[{"blueprints/hut.json", &Map.delete(&1, "ruin")}],
           [{"SCHEMA_VIOLATION", "services/mend_hut.benefit.site"}]},
          {[mend.("site", "nowhere")],
           [{"UNRESOLVED_REFERENCE", "services/mend_hut.benefit.site"}]},
          {[{"text.json", &Map.delete(&1, "service.nothing_to_mend")}],
           [{"UNRESOLVED_REFERENCE", "services/mend_hut"}]},
          {[raze.("direction", "east")],
           [{"SCHEMA_VIOLATION", "services/raze_hut.benefit.direction"}]},
          {[raze.("site", "nowhere")],
           [{"UNRESOLVED_REFERENCE", "services/raze_hut.benefit.site"}]},
          {[{"text.json", &Map.delete(&1, "service.nothing_to_raze")}],
           [{"UNRESOLVED_REFERENCE", "services/raze_hut"}]},
          {[{"text.json", &Map.delete(&1, "service.occupied")}],
           [{"UNRESOLVED_REFERENCE", "services/raze_hut"}]}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert pairs(diags) == expected
    end
  end

  # Breaks (Built rooms S2 review): the site check compares the service blueprint with the site's
  # list before both are expanded to full refs, so a bare key on one side and a full ref on the
  # other is refused (services.ex benefit/5 relies on Construction.expand and Services.expand).
  test "a build benefit matches its site blueprint across short and full reference forms" do
    full = %{"cartridge_id" => "build_sampler", "cartridge_version" => "0.0.1"}
    full = Map.merge(full, %{"kind" => "blueprint", "key" => "hut"})
    service = {"services/raise_hut.json", &put_in(&1, ["benefit", "blueprint"], full)}
    site = {"rooms/lane.json", &put_in(&1, ["site", "blueprints"], [full])}

    for edit <- [service, site] do
      dir = Loka.ContentSource.copy(@dir)
      assert {:ok, _, []} = Loka.ContentSource.compile(dir, [edit])
    end
  end
end
