defmodule Loka.ContentLiquidsTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  defp source(dir) do
    File.cp_r!("cartridges/ashmere_items", dir)

    update(dir, "cartridge.json", fn m ->
      m
      |> put_in(["requires", "kernel_api", "at_least"], "1.19")
      |> put_in(["requires", "capabilities", "liquid"], 1)
    end)

    File.mkdir_p!(Path.join(dir, "liquids"))

    write(dir, "liquids/water.json", %{
      "label" => "water.label",
      "unit_label" => "water.units",
      "grams_per_unit" => 250,
      "drink_amount" => 1
    })

    update(
      dir,
      "text.json",
      &Map.merge(&1, %{"water.label" => "Water", "water.units" => "units"})
    )

    update(
      dir,
      "items/lantern.json",
      &Map.merge(&1, %{
        "mass_grams" => 500,
        "vessel" => %{
          "capacity" => 4,
          "unit_label" => "water.units",
          "initial" => %{"kind" => "water", "quantity" => 2}
        }
      })
    )

    update(
      dir,
      "rooms/ferry_landing.json",
      &put_in(&1, ["details", "mooring_post", "liquid_source"], "water")
    )
  end

  defp write(dir, file, value), do: File.write!(Path.join(dir, file), JSON.encode!(value))

  defp update(dir, file, change),
    do: write(dir, file, change.(JSON.decode!(File.read!(Path.join(dir, file)))))

  # Breaks: a new liquid reference stays short, or optional liquid maps leak into old artifacts.
  test "source references expand and liquid metadata retains authored units", %{tmp_dir: dir} do
    source(dir)
    assert {:ok, bytes, []} = Loka.Content.compile(dir)
    c = JSON.decode!(bytes)["cartridge"]

    ref = %{
      "cartridge_id" => "ashmere_items",
      "cartridge_version" => "0.0.1",
      "kind" => "liquid",
      "key" => "water"
    }

    assert c["items"]["ashmere_items@0.0.1:item/lantern"]["vessel"]["initial"] == %{
             "kind" => ref,
             "quantity" => 2
           }

    assert c["rooms"]["ashmere_items@0.0.1:room/ferry_landing"]["details"]["mooring_post"][
             "liquid_source"
           ] == ref

    assert c["liquids"]["ashmere_items@0.0.1:liquid/water"]["grams_per_unit"] == 250
    update(dir, "items/lantern.json", &put_in(&1, ["vessel", "initial", "kind"], ref))

    update(
      dir,
      "rooms/ferry_landing.json",
      &put_in(&1, ["details", "mooring_post", "liquid_source"], ref)
    )

    assert {:ok, ^bytes, []} = Loka.Content.compile(dir)

    update(
      dir,
      "items/lantern.json",
      &Map.merge(&1, %{
        "mass_grams" => 2_147_482_647,
        "vessel" => %{
          "capacity" => 4,
          "unit_label" => "water.units",
          "initial" => %{"kind" => nil, "quantity" => 0}
        }
      })
    )

    assert {:ok, _, []} = Loka.Content.compile(dir)
    assert {:ok, old, []} = Loka.Content.compile("cartridges/ashmere_items")
    refute Map.has_key?(JSON.decode!(old)["cartridge"], "liquids")
  end

  # Breaks: invalid rows, missing references/gates or unsafe maximum fill mass compile.
  test "compiler rejects malformed or unsupported liquid declarations", %{tmp_dir: dir} do
    for {name, file, change, code} <- [
          {"null positive", "items/lantern.json", &put_in(&1, ["vessel", "initial", "kind"], nil),
           "SCHEMA_VIOLATION"},
          {"kind zero", "items/lantern.json", &put_in(&1, ["vessel", "initial", "quantity"], 0),
           "SCHEMA_VIOLATION"},
          {"overcapacity", "items/lantern.json",
           &put_in(&1, ["vessel", "initial", "quantity"], 5), "SCHEMA_VIOLATION"},
          {"unknown kind", "items/lantern.json",
           &put_in(&1, ["vessel", "initial", "kind"], "missing"), "UNRESOLVED_REFERENCE"},
          {"template vessel", "items/lantern.json",
           &Map.put(
             &1,
             "location",
             JSON.decode!(File.read!("protocol/fixtures/liquid_template.json"))["location"]
           ), "SCHEMA_VIOLATION"},
          {"missing mass", "items/lantern.json", &Map.delete(&1, "mass_grams"),
           "SCHEMA_VIOLATION"},
          {"maximum fill", "items/lantern.json", &Map.put(&1, "mass_grams", 2_147_482_648),
           "SCHEMA_VIOLATION"},
          {"missing unit", "items/lantern.json",
           &put_in(&1, ["vessel", "unit_label"], "missing.units"), "UNRESOLVED_REFERENCE"},
          {"missing label", "liquids/water.json", &Map.put(&1, "label", "missing.label"),
           "UNRESOLVED_REFERENCE"},
          {"zero density", "liquids/water.json", &Map.put(&1, "grams_per_unit", 0),
           "SCHEMA_VIOLATION"},
          {"zero drink", "liquids/water.json", &Map.put(&1, "drink_amount", 0),
           "SCHEMA_VIOLATION"},
          {"unknown source", "rooms/ferry_landing.json",
           &put_in(&1, ["details", "mooring_post", "liquid_source"], "missing"),
           "UNRESOLVED_REFERENCE"},
          {"item source", "items/lantern.json", &Map.put(&1, "liquid_source", "water"),
           "UNKNOWN_FIELD"},
          {"old API", "cartridge.json",
           &put_in(&1, ["requires", "kernel_api", "at_least"], "1.18"),
           "KERNEL_API_RANGE_INVALID"},
          {"missing capability", "cartridge.json",
           &update_in(&1, ["requires", "capabilities"], fn caps -> Map.delete(caps, "liquid") end),
           "UNDECLARED_CAPABILITY"}
        ] do
      case_dir = Path.join(dir, name)
      source(case_dir)
      update(case_dir, file, change)
      assert {:error, diagnostics} = Loka.Content.compile(case_dir), name
      assert Enum.any?(diagnostics, &(&1["code"] == code)), name
    end
  end
end
