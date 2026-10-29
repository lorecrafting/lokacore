defmodule Loka.Content.Population do
  @moduledoc "Checks the selected bounded population: its NPC, held item and corpse."
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

  @doc "Each plan gate's located policy root (row W12)."
  def conditions(defs),
    do:
      for(
        {_, {rel, steps, p}} <- defs["population"] || %{},
        is_map(p),
        k <- @gates,
        is_map(p[k]),
        do: {rel, steps ++ [k], p[k]}
      )

  # ponytail: one bounded plan expansion keeps short refs together. # credo:disable-for-next-line Credo.Check.Refactor.ABCSize
  def expand(%{"home" => home, "area" => area} = plan, m, expand) do
    plan
    |> Map.merge(
      for {k, kind} <- [{"npc", "npc"}, {"item", "item"}, {"corpse", "item"}],
          is_map_key(plan, k),
          into: %{},
          do: {k, ref(plan[k], kind, m)}
    )
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
      {k, v} when k in @gates -> {k, expand.(v, m)}
      kv -> kv
    end)
  end

  def check(nil, _, _, _), do: []
  def check(_, _, nil, _), do: []

  def check(manifest, defs, v2, {_, settings}) do
    plans = defs["population"] || %{}
    calendar = settings["calendar"]

    for {_key, {rel, steps, plan}} <- plans, is_map(plan) do
      errors = plan_errors(manifest, defs, calendar, if(v2, do: elem(v2, 1), else: %{}), plan)

      refs(rel, steps, plan, manifest, defs) ++
        for(error <- errors, do: diag("SCHEMA_VIOLATION", at(rel, steps ++ error)))
    end
    |> List.flatten()
  end

  defp refs(rel, steps, plan, manifest, defs) do
    for {k, kind} <- [{"npc", "npc"}, {"item", "item"}, {"corpse", "item"}],
        is_map_key(plan, k),
        d <- Refs.reference(rel, steps, {k, kind}, plan, manifest, defs),
        do: d
  end

  # ponytail: report this finite plan's linked source errors together; split on another plan shape. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  defp plan_errors(manifest, defs, calendar, text, p) do
    room_refs = Enum.map([p["home"] | p["area"]], &Refs.resolve(&1, "room", manifest, defs))
    [home | rooms] = Enum.map(room_refs, &value/1)
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

    # A room refused at its own path (e.g. its extends) is not reported again here.
    connected =
      :invalid in room_refs or
        (is_map(home) and Enum.uniq(p["area"]) == p["area"] and Enum.member?(p["area"], p["home"]) and
           Enum.all?(rooms, &is_map/1) and reciprocal?(rooms, p["area"]))

    members_ok = members_valid?(p, manifest, defs, p["scavenge"] != nil)

    []
    |> add(not targets, ["day_target"])
    |> add(not valid_time, ["wander_interval"])
    |> add(not connected, ["area"])
    |> add(not members_ok, ["npc"])
    |> add(not scavenge_valid?(p["scavenge"], p, manifest, defs, text), ["scavenge"])
    |> add(not pack_valid?(p["pack"], p["area"], rooms, text), ["pack", "narration"])
    |> add(not sight_valid?(p["sight"], p["area"], rooms, text, p), ["sight", "narration"])
    |> add(manifest["requires"]["capabilities"]["population"] != 1, ["npc"])
    |> add(p["floor"] != nil and (p["floor"] > p["day_target"] or p["chance"] != nil), ["floor"])
    |> add(is_map(p["birth_when"]) and not actorless?(p["birth_when"]), ["birth_when"])
    |> add(is_map(p["wander_when"]) and not actorless?(p["wander_when"]), ["wander_when"])
  end

  defp actorless?(%{"op" => "not", "item" => i}), do: actorless?(i)

  defp actorless?(%{"op" => op} = p) when op in @actorless,
    do: Enum.all?(p["items"] || [], &actorless?/1)

  defp actorless?(_), do: false

  defp pack_valid?(nil, _, _, _), do: true

  defp pack_valid?(pack, area, rooms, text) do
    directions = area_directions(rooms, area)

    narration = pack["narration"]

    Enum.all?(directions, &Map.has_key?(narration["enemy_fled"], &1)) and
      Enum.all?(narration_keys(narration), &Map.has_key?(text, &1))
  end

  defp sight_valid?(nil, _, _, _, _), do: true

  defp sight_valid?(sight, area, rooms, text, %{"member_role" => "prey"}) do
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

  defp scavenge_valid?(nil, _, _, _, _), do: true

  # ponytail: validate one authored corridor and nest together. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  defp scavenge_valid?(s, p, manifest, defs, text) do
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

    p["item"] == nil and
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

  # ponytail: the optional companion keeps the existing bounded population member shape. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  defp members_valid?(b, manifest, defs, allow_empty) do
    refs = [
      Refs.resolve(b["npc"], "npc", manifest, defs),
      Refs.resolve(b["corpse"], "item", manifest, defs),
      b["item"] && Refs.resolve(b["item"], "item", manifest, defs)
    ]

    [npc, corpse, item] = Enum.map(refs, &value/1)

    # An invalid NPC, corpse or item is already reported at its own path; a missing one is refused here.
    # An unresolved one is reported by check/4.
    Enum.any?(refs, &(&1 in [:invalid, :unresolved])) or
      ((b["item"] != nil or allow_empty) && npc && corpse &&
         npc["spawn_template"] == true && npc["room"] == b["home"] &&
         is_map(npc["hp"]) && is_map(npc["attack"]) &&
         (b["item"] == nil or
            ((is_map(item) and item["location"] == %{"in" => "template"} and
                item["container"] == nil and
                item["capacity"] == nil) && item["slot"] == nil && item["barrier"] == nil)) &&
         corpse["location"] == %{"in" => "template"} && corpse["container"] == true &&
         corpse["capacity"] == nil) == true
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
