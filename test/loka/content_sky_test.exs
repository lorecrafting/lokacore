defmodule Loka.ContentSkyTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row 31): the compiler accepts a sky weather, season or tide phase its calendar
  # table does not author, a repeated weather phase, a season cycle not starting at 0, or the
  # row 31 tables below kernel_api 1.45 with no sky leaf.
  test "sky names an authored weather, season or tide; the tables need 1.45" do
    dir = Loka.ContentSource.copy("cartridges/sky_sampler")
    root = "rooms/yard.variants[0].when.root"
    sky = fn leaf -> &put_in(&1, ["variants", Access.at(0), "when", "root"], leaf) end
    calendar = fn path, v -> &put_in(&1, ["calendar" | path], v) end
    api = &put_in(&1, ["requires", "kernel_api", "at_least"], "1.44")

    cases = [
      {[{"rooms/yard.json", sky.(%{"op" => "sky", "weather" => "snow"})}],
       {"SCHEMA_VIOLATION", root <> ".weather"}},
      {[{"rooms/yard.json", sky.(%{"op" => "sky", "season" => "winter"})}],
       {"SCHEMA_VIOLATION", root <> ".season"}},
      {[{"rooms/yard.json", sky.(%{"op" => "sky", "tide" => "slack"})}],
       {"SCHEMA_VIOLATION", root <> ".tide"}},
      {[{"cartridge.json", calendar.(["weather", Access.at(1), "phase"], "clear")}],
       {"SCHEMA_VIOLATION", "cartridge.calendar.weather[1]"}},
      {[{"cartridge.json", calendar.(["season", "phases", Access.at(0), "at"], 1)}],
       {"SCHEMA_VIOLATION", "cartridge.calendar.season.phases"}},
      {[{"rooms/yard.json", &Map.delete(&1, "variants")}, {"cartridge.json", api}],
       {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}}
    ]

    for {changes, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
