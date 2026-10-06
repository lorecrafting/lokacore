defmodule Loka.ContentLightTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  @src "cartridges/ashmere_missing_child"
  defp source(path), do: JSON.decode!(File.read!(Path.join(@src, path)))

  defp compile(dir, replacements) do
    File.cp_r!(@src, dir)

    for {path, value} <- replacements do
      if value == nil,
        do: File.rm!(Path.join(dir, path)),
        else: File.write!(Path.join(dir, path), JSON.encode!(value))
    end

    Loka.Content.compile(dir)
  end

  # Break: the real chapter drops bounded torch/oil metadata, short supply expansion or the public stair.
  test "authored torch and well consumer compile with independent light tuning" do
    assert {:ok, bytes, []} = Loka.Content.compile(@src)
    c = JSON.decode!(bytes)["cartridge"]
    prefix = "#{c["manifest"]["id"]}@#{c["manifest"]["version"]}"
    torch = c["items"][prefix <> ":item/torch"]["fuel"]

    assert Map.take(torch, ~w(kind capacity initial rate unit)) == %{
             "kind" => "source",
             "capacity" => 7200,
             "initial" => 7200,
             "rate" => 1,
             "unit" => "oil"
           }

    assert torch["supply"] == %{
             "cartridge_id" => "ashmere_missing_child",
             "cartridge_version" => c["manifest"]["version"],
             "kind" => "item",
             "key" => "lamp_oil"
           }

    assert c["items"][prefix <> ":item/lamp_oil"]["fuel"] == %{
             "kind" => "supply",
             "capacity" => 7200,
             "initial" => 7200,
             "unit" => "oil"
           }

    assert c["rooms"][prefix <> ":room/well_lane"]["exits"]["down"]["to"]["key"] == "well_shaft"
    assert c["rooms"][prefix <> ":room/well_shaft"]["exits"]["up"]["to"]["key"] == "well_lane"

    assert c["text"][c["rooms"][prefix <> ":room/well_shaft"]["dark_description"]] ==
             "Darkness fills the shaft. The stair up leads back to Well Lane."
  end

  # Break: an overfilled or incompatible fuel definition compiles into an impossible fresh save.
  test "impossible fuel metadata and unresolved dark text refuse", %{tmp_dir: dir} do
    for {name, replacements} <- [
          {"overfilled",
           %{"items/torch.json" => put_in(source("items/torch.json"), ["fuel", "initial"], 7201)}},
          {"wrong_supply",
           %{
             "items/torch.json" =>
               put_in(source("items/torch.json"), ["fuel", "supply"], "waterskin")
           }},
          {"different_unit",
           %{
             "items/lamp_oil.json" =>
               put_in(source("items/lamp_oil.json"), ["fuel", "unit"], "water")
           }},
          {"dark_text",
           %{
             "rooms/well_shaft.json" =>
               put_in(source("rooms/well_shaft.json"), ["dark_description"], "missing.dark")
           }}
        ] do
      assert {:error, diagnostics} = compile(Path.join(dir, name), replacements)
      assert Enum.any?(diagnostics, &(&1["code"] in ~w(SCHEMA_VIOLATION UNRESOLVED_REFERENCE)))
    end
  end

  # Break: actual fuel or darkness compiles under API1.18 despite the API1.19 wire fields.
  test "actual light fields enforce the API1.19 floor", %{tmp_dir: dir} do
    manifest = put_in(source("cartridge.json"), ["requires", "kernel_api", "at_least"], "1.18")

    for fields <- ~w(fuel darkness unused) do
      replacements =
        for {path, field, keep} <- [
              {"items/torch.json", "fuel", "fuel"},
              {"items/lamp_oil.json", "fuel", "fuel"},
              {"rooms/well_shaft.json", "dark_description", "darkness"}
            ],
            fields != keep,
            into: %{},
            do: {path, Map.delete(source(path), field)}

      # Isolate the light boundary from the later API1.20 liquid consumer.
      water = %{
        "liquids/water.json" => nil,
        "items/waterskin.json" => Map.delete(source("items/waterskin.json"), "vessel"),
        "items/spare_waterskin.json" =>
          Map.delete(source("items/spare_waterskin.json"), "vessel"),
        "rooms/well_lane.json" =>
          update_in(
            source("rooms/well_lane.json"),
            ["details", "well"],
            &Map.delete(&1, "liquid_source")
          )
      }

      inputs = replacements |> Map.merge(water) |> Map.put("cartridge.json", manifest)
      result = compile(Path.join(dir, fields), inputs)

      if fields == "unused" do
        assert {:ok, _, []} = result
      else
        assert {:error, diagnostics} = result

        assert Enum.map(diagnostics, &Map.take(&1, ~w(code path))) == [
                 %{
                   "code" => "KERNEL_API_RANGE_INVALID",
                   "path" => "cartridge.requires.kernel_api.at_least"
                 }
               ]
      end
    end
  end
end
