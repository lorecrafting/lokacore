defmodule Loka.ContentLightTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/toolbox_showcase")}
  @src "cartridges/toolbox_showcase"
  defp source(path), do: JSON.decode!(File.read!(Path.join(@src, path)))

  # Break: compiled fuel drops or retunes authored metadata, the short supply stays short, or a
  # dark description loses its text. Deleted: the chapter's torch tuning and Well Lane stair pins.
  test "authored lantern fuel and crypt darkness compile as authored", %{dir: dir} do
    assert {:ok, bytes, []} = Loka.ContentSource.compile(dir, [])
    c = JSON.decode!(bytes)["cartridge"]
    %{"id" => id, "version" => version} = source("cartridge.json")
    fuel = source("items/lantern.json")["fuel"]

    assert c["items"]["#{id}@#{version}:item/lantern"]["fuel"] ==
             Map.put(fuel, "supply", %{
               "cartridge_id" => id,
               "cartridge_version" => version,
               "kind" => "item",
               "key" => fuel["supply"]
             })

    dark = source("rooms/crypt.json")["dark_description"]
    assert c["rooms"]["#{id}@#{version}:room/crypt"]["dark_description"] == dark
    assert c["text"][dark] == source("text.json")[dark]
  end

  # Break: an overfilled or incompatible fuel definition compiles into an impossible fresh save.
  test "impossible fuel metadata and unresolved dark text refuse", %{dir: dir} do
    for {_case, replacements} <- [
          {"overfilled",
           %{
             "items/lantern.json" =>
               put_in(source("items/lantern.json"), ["fuel", "initial"], 36001)
           }},
          {"wrong_supply",
           %{
             "items/lantern.json" =>
               put_in(source("items/lantern.json"), ["fuel", "supply"], "waterskin")
           }},
          {"different_unit",
           %{
             "items/lamp_oil.json" =>
               put_in(source("items/lamp_oil.json"), ["fuel", "unit"], "oil")
           }},
          {"dark_text",
           %{
             "rooms/crypt.json" =>
               put_in(source("rooms/crypt.json"), ["dark_description"], "missing.dark")
           }}
        ] do
      assert {:error, diagnostics} = Loka.ContentSource.compile(dir, replacements)
      assert Enum.any?(diagnostics, &(&1["code"] in ~w(SCHEMA_VIOLATION UNRESOLVED_REFERENCE)))
    end
  end

  # Break: actual fuel or darkness compiles under API1.18 despite the API1.19 wire fields.
  test "actual light fields enforce the API1.19 floor" do
    manifest = %{
      "requires" => %{"kernel_api" => %{"at_least" => "1.18"}, "capabilities" => %{"skills" => 1}}
    }

    for {name, fields} <- [
          {"fuel", %{"fuel" => source("items/lantern.json")["fuel"]}},
          {"darkness", %{"dark_description" => "room.crypt.dark"}},
          {"unused", %{}}
        ] do
      # Controlled source declarations keep this check independent of the showcase consumers.
      result = Loka.Content.Requires.features(manifest, [{name, [], fields}])

      if name == "unused" do
        assert result == []
      else
        assert [
                 %{
                   "code" => "KERNEL_API_RANGE_INVALID",
                   "path" => "cartridge.requires.kernel_api.at_least"
                 }
               ] = result
      end
    end
  end
end
