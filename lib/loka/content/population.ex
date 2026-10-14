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

  # Row W12: a plan gate has no actor, so its tree reads world state alone.
  @gates ~w(birth_when wander_when)
  @actorless ~w(all any not population_count time_window sky barrier_state)

  @doc "Each plan gate's located policy root (row W12; twin of the TS loader's nodes/1)."
  def conditions(defs),
    do:
      for(
        {_, {rel, steps, p}} <- defs["population"] || %{},
        is_map(p),
        k <- @gates,
        is_map(p[k]),
        do: {rel, steps ++ [k, "root"], p[k]["root"]}
      )

  # ponytail: one bounded plan expansion keeps short refs together. # credo:disable-for-next-line Credo.Check.Refactor.ABCSize
  def expand(%{"bundle" => b, "home" => home, "area" => area} = plan, m) do
    plan
    |> Map.put("bundle", ref(b, "population_bundle", m))
    |> Map.put("home", ref(home, "room", m))
    |> Map.put("area", Enum.map(area, &ref(&1, "room", m)))
    |> then(fn p ->
      case p["scavenge"] do
        nil ->
          p

        s ->
          Map.put(p, "scavenge", %{
            s
            | "items" => Enum.map(s["items"], &ref(&1, "item", m)),
              "drop_rooms" => Enum.map(s["drop_rooms"], &ref(&1, "room", m)),
              "nest" => ref(s["nest"], "item", m),
              "corridor" => Enum.map(s["corridor"], &ref(&1, "room", m))
          })
      end
    end)
    |> Map.new(fn
      {k, v} when k in @gates -> {k, Loka.Content.Checks.expand(v, m)}
      kv -> kv
    end)
  end

  def expand(%{"npc" => n, "corpse" => c} = bundle, m) do
    bundle
    |> Map.put("npc", ref(n, "npc", m))
    |> Map.put("corpse", ref(c, "item", m))
    |> then(fn b -> if b["item"], do: Map.put(b, "item", ref(b["item"], "item", m)), else: b end)
  end

  def check(nil, _, _, _), do: []
  def check(_, _, nil, _), do: []

  def check(manifest, defs, v2, {_, settings}) do
    plans = defs["population"] || %{}
    calendar = settings["calendar"]

    floor(manifest, defs, plans) ++
      for {_key, {rel, steps, plan}} <- plans,
          is_map(plan),
          error <- plan_errors(manifest, defs, calendar, if(v2, do: elem(v2, 1), else: %{}), plan),
          do: diag("SCHEMA_VIOLATION", at(rel, steps ++ error))
  end

  # Toolbox row 9: an encounter plan (`chance`) needs kernel_api 1.74; row 37a: a day_target 0
  # (a plan only population.spawn fills) needs 1.84; row W12: a floor, a plan gate or a
  # population_count leaf anywhere needs 1.86.
  defp floor(m, defs, plans) do
    list = for {_, {_, _, p}} <- plans, is_map(p), do: p

    floor =
      cond do
        w12?(list, defs) ->
          [1, 86]

        Enum.any?(list, &(&1["day_target"] == 0)) ->
          [1, 84]

        Enum.any?(list, &Map.has_key?(&1, "chance")) ->
          [1, 74]

        true ->
          [0]
      end

    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if api < floor,
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  # ponytail: report this finite plan's linked source errors together; split on another plan shape. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  defp plan_errors(manifest, defs, calendar, text, p) do
    bundle = value(Refs.resolve(p["bundle"], "population_bundle", manifest, defs))
    rooms = Enum.map(p["area"], &value(Refs.resolve(&1, "room", manifest, defs)))
    home = value(Refs.resolve(p["home"], "room", manifest, defs))
    n = p["cap"]
    targets = p["day_target"] <= p["night_target"] and p["night_target"] <= n
    hours = calendar && calendar["hours_per_day"]
    period = calendar && calendar["units_per_hour"]

    valid_time =
      is_integer(hours) and is_integer(period) and
        p["night_start"] < hours and p["night_end"] < p["night_start"] and
        p["wander_interval"] <= p["replacement_delay"] and
        rem(p["wander_interval"], period) == 0 and
        p["replacement_delay"] <= div(9_007_199_254_740_991, 2)

    connected =
      home && Enum.uniq(p["area"]) == p["area"] && Enum.member?(p["area"], p["home"]) &&
        Enum.all?(rooms, &is_map/1) && reciprocal?(rooms, p["area"])

    bundle_ok =
      is_map(bundle) and bundle_valid?(bundle, manifest, defs, p["home"], p["scavenge"] != nil)

    []
    |> add(not targets, ["day_target"])
    |> add(not valid_time, ["wander_interval"])
    |> add(not connected, ["area"])
    |> add(not bundle_ok, ["bundle"])
    |> add(not scavenge_valid?(p["scavenge"], p, bundle, manifest, defs, text), ["scavenge"])
    |> add(not pack_valid?(p["pack"], p["area"], rooms, text), ["pack", "narration"])
    |> add(not sight_valid?(p["sight"], p["area"], rooms, text, bundle), ["sight", "narration"])
    |> add(manifest["requires"]["capabilities"]["population"] != 1, ["bundle"])
    |> add(p["floor"] != nil and (p["floor"] > p["day_target"] or p["chance"] != nil), ["floor"])
    |> add(is_map(p["birth_when"]) and not actorless?(p["birth_when"]["root"]), ["birth_when"])
    |> add(is_map(p["wander_when"]) and not actorless?(p["wander_when"]["root"]), ["wander_when"])
  end

  defp actorless?(%{"op" => "not", "item" => i}), do: actorless?(i)

  defp actorless?(%{"op" => op} = p) when op in @actorless,
    do: Enum.all?(p["items"] || [], &actorless?/1)

  defp actorless?(_), do: false

  defp w12?(plans, defs),
    do:
      Enum.any?(plans, &Enum.any?(["floor" | @gates], fn k -> Map.has_key?(&1, k) end)) or
        counts?(defs)

  defp counts?(%{"op" => "population_count"}), do: true
  defp counts?(v) when is_map(v), do: Enum.any?(Map.values(v), &counts?/1)
  defp counts?(v) when is_list(v), do: Enum.any?(v, &counts?/1)
  defp counts?(v) when is_tuple(v), do: counts?(Tuple.to_list(v))
  defp counts?(_), do: false

  defp pack_valid?(nil, _, _, _), do: true

  defp pack_valid?(pack, area, rooms, text) do
    directions = area_directions(rooms, area)

    narration = pack["narration"]

    Enum.all?(directions, &Map.has_key?(narration["enemy_fled"], &1)) and
      Enum.all?(narration_keys(narration), &Map.has_key?(text, &1))
  end

  defp sight_valid?(nil, _, _, _, _), do: true

  defp sight_valid?(sight, area, rooms, text, %{"member_role" => "deer", "loot_role" => "hide"}) do
    directions = area_directions(rooms, area)

    is_integer(sight["delay"]) and sight["delay"] > 0 and
      Enum.all?(directions, &Map.has_key?(sight["narration"], &1)) and
      Enum.all?(Map.values(sight["narration"]), &Map.has_key?(text, &1))
  end

  defp sight_valid?(_, _, _, _, _), do: false

  defp area_directions(rooms, area) do
    for room <- rooms,
        is_map(room),
        {direction, edge} <- room["exits"] || %{},
        edge["to"] in area,
        do: direction
  end

  defp narration_keys(narration),
    do: Map.values(Map.delete(narration, "enemy_fled")) ++ Map.values(narration["enemy_fled"])

  defp add(errors, true, path), do: [path | errors]
  defp add(errors, false, _), do: errors

  defp value({_, _, v}) when is_map(v), do: v
  defp value(_), do: nil

  defp scavenge_valid?(nil, _, _, _, _, _), do: true

  # ponytail: validate one authored corridor and nest together. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  defp scavenge_valid?(s, p, bundle, manifest, defs, text) do
    corridor = s["corridor"]
    rooms = Enum.map(corridor, &value(Refs.resolve(&1, "room", manifest, defs)))
    nest = value(Refs.resolve(s["nest"], "item", manifest, defs))
    items = Enum.map(s["items"], &value(Refs.resolve(&1, "item", manifest, defs)))

    pairs =
      Enum.zip([
        Enum.drop(corridor, -1),
        Enum.drop(corridor, 1),
        Enum.drop(rooms, -1),
        Enum.drop(rooms, 1)
      ])

    is_map(bundle) and bundle["item"] == nil and
      Enum.all?(Map.values(s["narration"]), &Map.has_key?(text, &1)) and
      Enum.uniq(corridor) == corridor and
      Enum.member?(corridor, p["home"]) and
      Enum.all?(s["drop_rooms"], &Enum.member?(corridor, &1)) and
      Enum.all?(items, &scavenge_item?/1) and
      is_map(nest) and nest["container"] == true and is_integer(nest["capacity"]) and
      nest["location"] == %{"in" => "room", "room" => List.last(corridor)} and
      Enum.all?(rooms, &is_map/1) and
      Enum.all?(pairs, fn {from, to, a, b} ->
        Enum.any?(a["exits"] || %{}, fn {direction, edge} ->
          edge["to"] == to and edge["barrier"] == nil and
            get_in(b, ["exits", @opposite[direction], "to"]) == from and
            get_in(b, ["exits", @opposite[direction], "barrier"]) == nil
        end)
      end)
  end

  # ponytail: the optional companion keeps the existing bounded population bundle shape. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  defp bundle_valid?(b, manifest, defs, home, allow_empty) do
    npc = value(Refs.resolve(b["npc"], "npc", manifest, defs))
    item = if b["item"], do: value(Refs.resolve(b["item"], "item", manifest, defs))
    corpse = value(Refs.resolve(b["corpse"], "item", manifest, defs))

    roles_ok =
      (b["member_role"] == nil and b["loot_role"] == nil) or
        (b["member_role"] == "deer" and b["loot_role"] == "hide")

    roles_ok && (b["item"] != nil or allow_empty) && npc && corpse &&
      npc["spawn_template"] == true && npc["room"] == home &&
      is_map(npc["hp"]) && is_map(npc["attack"]) &&
      (b["item"] == nil or
         ((is_map(item) and item["location"] == %{"in" => "template"} and item["container"] == nil and
             item["capacity"] == nil) && item["slot"] == nil && item["barrier"] == nil)) &&
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

  defp scavenge_item?(item) do
    is_map(item) and item["location"]["in"] == "room" and item["container"] != true and
      item["capacity"] == nil and item["slot"] == nil and item["barrier"] == nil and
      item["give_allowed"] != false
  end
end
