defmodule Loka.ContentAreaFoldersTest do
  use ExUnit.Case, async: true

  alias Loka.Content.{Explain, Lint, Source, SourceLines}

  # Area folders (docs/system/cartridge.md, Area folders) on reactions_sampler: roost and crow
  # move to the area rookery; yard and crow_lands, when named, to coop.
  @sampler "cartridges/reactions_sampler"

  setup_all do
    %{dir: Loka.ContentSource.copy(@sampler)}
  end

  defp read(dir, rel), do: JSON.decode!(File.read!(Path.join([dir, rel])))

  # `{rel => area}` as compile changes: the file written under areas/<area>/ and removed from the root.
  defp moved(dir, files) do
    Enum.flat_map(files, fn {rel, area} ->
      [{Path.join(["areas", area, rel]), read(dir, rel)}, {rel, nil}]
    end)
  end

  defp compile(dir, changes), do: Loka.ContentSource.compile(dir, changes)

  defp refused(dir, changes) do
    assert {:error, diags} = compile(dir, changes)
    Enum.map(diags, &{&1["code"], &1["path"], &1["data"]})
  end

  # The one explain line of a refusal (Explain's row for its `why`, not the generic fallback).
  defp explained(dir, changes) do
    assert {:error, [diag]} = compile(dir, changes)
    hd(Explain.lines([diag], dir))
  end

  defp crossing(target, area), do: %{"why" => "area_crossing", "target" => target, "area" => area}

  # Break: an area folder file is not read as its root twin (its room is unresolved), or the area
  # leaks into the artifact (a field, a key prefix, or a zone copy).
  test "a room moved into an area folder compiles to the same bytes", %{dir: dir} do
    {:ok, flat, _} = compile(dir, [])
    assert {:ok, ^flat, _} = compile(dir, moved(dir, %{"rooms/roost.json" => "rookery"}))
  end

  # Break: a reference from one area to another's definition compiles, or a room is not exempt
  # (yard in coop exits to roost in rookery). Red control: crow_lands at the root compiles.
  test "a reference into another area is refused; the root and rooms may cross", %{dir: dir} do
    rookery = %{"rooms/roost.json" => "rookery", "npcs/crow.json" => "rookery"}
    assert {:ok, _, _} = compile(dir, moved(dir, Map.put(rookery, "rooms/yard.json", "coop")))

    coop = %{"rooms/yard.json" => "coop", "reactions/crow_lands.json" => "coop"}

    assert refused(dir, moved(dir, Map.merge(rookery, coop))) == [
             {"SCHEMA_VIOLATION", "areas/coop/reactions/crow_lands.on.npc",
              crossing("npcs/crow", "rookery")}
           ]

    # The same border when rookery is a bundle (areas/rookery.json) rather than a folder.
    bundle = %{
      "rooms" => %{"roost" => read(dir, "rooms/roost.json")},
      "npcs" => %{"crow" => read(dir, "npcs/crow.json")}
    }

    flat = [{"areas/rookery.json", bundle}, {"rooms/roost.json", nil}, {"npcs/crow.json", nil}]

    assert refused(dir, flat ++ moved(dir, coop)) == [
             {"SCHEMA_VIOLATION", "areas/coop/reactions/crow_lands.on.npc",
              crossing("npcs/crow", "rookery")}
           ]
  end

  # Break: `extends` names a parent in another area and inherits it, or a room may not extend a
  # room across the border. Red control: the child at the root compiles.
  test "an extends into another area is refused; a room may cross", %{dir: dir} do
    areas = moved(dir, %{"rooms/roost.json" => "rookery", "items/pebble.json" => "rookery"})
    areas = areas ++ moved(dir, %{"rooms/yard.json" => "coop"})
    flint = %{"extends" => "pebble"}
    assert {:ok, _, _} = compile(dir, [{"items/flint.json", flint} | areas])

    assert {:ok, _, _} =
             compile(dir, [{"areas/coop/rooms/den.json", %{"extends" => "roost"}} | areas])

    assert refused(dir, [{"areas/coop/items/flint.json", flint} | areas]) == [
             {"SCHEMA_VIOLATION", "areas/coop/items/flint.extends",
              crossing("items/pebble", "rookery")}
           ]
  end

  # Break: a holder copies a behaviour from another area. Red control: the holder at the root
  # compiles.
  test "a behaviour from another area is refused", %{dir: dir} do
    rule = %{
      "on" => %{"event" => "item_dropped", "item" => %{"param" => "holder"}},
      "steps" => [%{"op" => "fact.assign", "fact" => "crow_drawn", "value" => true}],
      "silent" => true
    }

    nibbles = {"areas/rookery/behaviours/nibbles.json", %{"reactions" => %{"nibble" => rule}}}

    areas = [
      nibbles | moved(dir, %{"rooms/roost.json" => "rookery", "rooms/yard.json" => "coop"})
    ]

    bone = Map.put(read(dir, "items/bone.json"), "behaviours", ["nibbles"])
    assert {:ok, _, _} = compile(dir, [{"items/bone.json", bone} | areas])

    assert refused(dir, [{"areas/coop/items/bone.json", bone}, {"items/bone.json", nil} | areas]) ==
             [
               {"SCHEMA_VIOLATION", "areas/coop/items/bone.behaviours[0]",
                crossing("behaviours/nibbles", "rookery")}
             ]
  end

  # Break: an area with no room compiles (its files are owned by no place); an unknown folder in
  # an area is read or dropped silently; a folder name that is no key compiles. Red control: the
  # same moves with roost beside them compile (the same-bytes test).
  test "an area with no room, an unknown folder and a bad folder name are refused", %{dir: dir} do
    assert refused(dir, moved(dir, %{"items/pebble.json" => "rookery"})) == [
             {"SCHEMA_VIOLATION", "areas/rookery", %{"area" => "rookery", "why" => "area_empty"}}
           ]

    roost = moved(dir, %{"rooms/roost.json" => "rookery"})

    assert refused(dir, [{"areas/rookery/widgets/w.json", %{}} | roost]) == [
             {"UNKNOWN_FIELD", "areas/rookery/widgets/w", %{}}
           ]

    assert refused(dir, moved(dir, %{"rooms/roost.json" => "Perch"})) == [
             {"SCHEMA_VIOLATION", ~s("areas/Perch"), %{"why" => "area_name"}}
           ]

    # Break: a refusal falls back to the generic schema line instead of its explain row.
    assert explained(dir, moved(dir, %{"rooms/roost.json" => "Perch"})) =~ "cannot be a key"
    assert explained(dir, moved(dir, %{"items/pebble.json" => "rookery"})) =~ "has no room"
    coop = moved(dir, %{"rooms/yard.json" => "coop", "reactions/crow_lands.json" => "coop"})
    rookery = moved(dir, %{"rooms/roost.json" => "rookery", "npcs/crow.json" => "rookery"})
    assert explained(dir, coop ++ rookery) =~ "only that area and the root may name it"
  end

  # Break: an area is not a zone of its rooms, so `"zone": "rookery"` is unresolved or copies to
  # rooms outside it. The twin is the copy written by hand.
  test "an area is a zone of its rooms", %{dir: dir} do
    lands = read(dir, "reactions/crow_lands.json")
    roost = moved(dir, %{"rooms/roost.json" => "rookery"})
    by_hand = put_in(lands, ["on", "room"], "roost")

    {:ok, twin, _} =
      compile(dir, [
        {"reactions/crow_lands_roost.json", by_hand},
        {"reactions/crow_lands.json", nil} | roost
      ])

    zoned = lands |> Map.put("zone", "rookery") |> update_in(["on"], &Map.delete(&1, "room"))
    assert {:ok, ^twin, _} = compile(dir, [{"reactions/crow_lands.json", zoned} | roost])
  end

  # Break: an area or bundle name equal to a reaction zone silently adds copies to a cartridge
  # built before area folders (docs/rnd/cartridge-area-layout-design-2026-11-04.md, risks). The
  # source text is read because loading expands `zone` away; only a reaction has a `"zone"` string.
  test "no cartridge has a reaction zone equal to one of its area names" do
    for cart <- Path.wildcard("cartridges/*"), File.dir?(cart) do
      areas = for p <- Path.wildcard("#{cart}/areas/*"), do: Path.rootname(Path.basename(p))

      zones =
        for f <- Path.wildcard("#{cart}/**/*.json"),
            [_, z] <- Regex.scan(~r/"zone"\s*:\s*"([^"]+)"/, File.read!(f)),
            do: z

      assert zones -- (zones -- areas) == [], cart
    end
  end

  # Break: an area folder file is linted under its own path, so its kind's checks miss it.
  test "an area folder file lints as its root twin" do
    tmp = Loka.ContentSource.copy(@sampler)
    flat = Lint.run(tmp)

    for rel <- ["items/bone.json", "rooms/roost.json"],
        to = Path.join([tmp, "areas/rookery", rel]) do
      File.mkdir_p!(Path.dirname(to))
      File.rename!(Path.join(tmp, rel), to)
    end

    assert Enum.any?(flat, &(&1 =~ "items/bone.json"))
    assert Lint.run(tmp) == flat
  end

  # Break: a scene in an area folder takes its JSON half's lines from the root dialogues folder.
  @tag :tmp_dir
  test "an area scene's JSON half points at the area file", %{tmp_dir: tmp} do
    File.mkdir_p!(Path.join(tmp, "areas/a/scenes"))
    File.mkdir_p!(Path.join(tmp, "areas/a/dialogues"))
    File.write!(Path.join(tmp, "areas/a/scenes/s.scene"), "npc: bram\nbram: ~\n- A\n  bram: ~\n")
    File.write!(Path.join(tmp, "areas/a/dialogues/s.json"), ~s({\n"label": "x"\n}))
    index = SourceLines.index(tmp)
    rel = "areas/a/scenes/s.scene"
    assert index[Source.at(rel, ["label"])] == {"areas/a/dialogues/s.json", 2}
  end
end
