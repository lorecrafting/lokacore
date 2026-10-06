defmodule Loka.Content.Population do
  @moduledoc "Checks the selected bounded population and its exact two-member bundle."
  import Loka.Content.Source, only: [at: 2, diag: 2, ref: 3]
  alias Loka.Content.Refs

  @opposite %{
    "north" => "south",
    "south" => "north",
    "east" => "west",
    "west" => "east",
    "up" => "down",
    "down" => "up"
  }

  def expand(%{"bundle" => b, "home" => home, "area" => area} = plan, m) do
    plan
    |> Map.put("bundle", ref(b, "population_bundle", m))
    |> Map.put("home", ref(home, "room", m))
    |> Map.put("area", Enum.map(area, &ref(&1, "room", m)))
  end

  def expand(%{"npc" => n, "item" => i, "corpse" => c} = bundle, m) do
    bundle
    |> Map.put("npc", ref(n, "npc", m))
    |> Map.put("item", ref(i, "item", m))
    |> Map.put("corpse", ref(c, "item", m))
  end

  def check(nil, _, _, _), do: []
  def check(_, _, nil, _), do: []

  def check(manifest, defs, _, {_, settings}) do
    plans = defs["population"] || %{}
    calendar = settings["calendar"]

    for {_key, {rel, steps, plan}} <- plans,
        is_map(plan),
        error <- plan_errors(manifest, defs, calendar, plan),
        do: diag("SCHEMA_VIOLATION", at(rel, steps ++ error))
  end

  # ponytail: report this finite plan's linked source errors together; split on another plan shape. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  defp plan_errors(manifest, defs, calendar, p) do
    bundle = value(Refs.resolve(p["bundle"], "population_bundle", manifest, defs))
    rooms = Enum.map(p["area"], &value(Refs.resolve(&1, "room", manifest, defs)))
    home = value(Refs.resolve(p["home"], "room", manifest, defs))
    n = p["cap"]
    targets = p["day_target"] <= p["night_target"] and p["night_target"] <= n
    hours = calendar && calendar["hours_per_day"]
    period = calendar && calendar["units_per_hour"]

    valid_time =
      is_integer(hours) and is_integer(period) and
        p["night_start"] < hours and p["night_end"] < hours and
        p["wander_interval"] <= p["replacement_delay"] and
        rem(p["wander_interval"], period) == 0 and
        p["replacement_delay"] <= div(9_007_199_254_740_991, 2)

    connected =
      home && Enum.uniq(p["area"]) == p["area"] && Enum.member?(p["area"], p["home"]) &&
        Enum.all?(rooms, &is_map/1) && reciprocal?(rooms, p["area"])

    bundle_ok = is_map(bundle) and bundle_valid?(bundle, manifest, defs, p["home"])

    []
    |> add(not targets, ["day_target"])
    |> add(not valid_time, ["wander_interval"])
    |> add(not connected, ["area"])
    |> add(not bundle_ok, ["bundle"])
    |> add(manifest["requires"]["capabilities"]["population"] != 1, ["bundle"])
  end

  defp add(errors, true, path), do: [path | errors]
  defp add(errors, false, _), do: errors

  defp value({_, _, v}) when is_map(v), do: v
  defp value(_), do: nil

  # ponytail: exact hound-and-pelt bundle has one linked validation; split on another bundle shape. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  defp bundle_valid?(b, manifest, defs, home) do
    npc = value(Refs.resolve(b["npc"], "npc", manifest, defs))
    item = value(Refs.resolve(b["item"], "item", manifest, defs))
    corpse = value(Refs.resolve(b["corpse"], "item", manifest, defs))

    npc && item && corpse &&
      npc["spawn_template"] == true && npc["room"] == home &&
      is_map(npc["hp"]) && is_map(npc["attack"]) &&
      item["location"] == %{"in" => "template"} && item["container"] == nil &&
      item["capacity"] == nil && item["slot"] == nil && item["barrier"] == nil &&
      corpse["location"] == %{"in" => "template"} && corpse["container"] == true &&
      corpse["capacity"] == nil
  end

  # ponytail: inspect the two declared adjacent rooms together; split on a wider area. # credo:disable-for-next-line Credo.Check.Refactor.ABCSize
  defp reciprocal?([a, b], [ar, br]) do
    exits = fn room -> room["exits"] || %{} end

    Enum.any?(exits.(a), fn {direction, edge} ->
      edge["to"] == br &&
        Enum.any?(exits.(b), fn {back, reverse} ->
          back == @opposite[direction] && reverse["to"] == ar &&
            edge["barrier"] == nil && reverse["barrier"] == nil
        end)
    end)
  end

  defp reciprocal?(_, _), do: false
end
