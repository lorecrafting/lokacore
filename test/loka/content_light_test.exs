defmodule Loka.ContentLightTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  @src "cartridges/ashmere_missing_child"
  defp source(path), do: JSON.decode!(File.read!(Path.join(@src, path)))

  defp compile(dir, replacements) do
    File.cp_r!(@src, dir)
    for {path, value} <- replacements, do: File.write!(Path.join(dir, path), JSON.encode!(value))
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
end
