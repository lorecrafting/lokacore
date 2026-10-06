defmodule Loka.Content.Water do
  @moduledoc "Narrow paired underwater routes and content-owned tuning."
  import Loka.Content.Source, only: [diag: 3, at: 2, ref: 3]
  alias Loka.Content.Refs

  def settings(%{"world" => %{"water" => w}} = settings, m),
    do: put_in(settings, ["world", "water"], expand(w, m))

  def settings(settings, _), do: settings

  def expand(w, m) do
    w
    |> Map.update!("skill", &ref(&1, "skill", m))
    |> Map.update!("routes", &Enum.map(&1, fn r -> expand_route(r, m) end))
  end

  defp expand_route(route, m), do: Map.new(route, fn {k, v} -> {k, ref(v, "room", m)} end)

  def check(nil, _, _, _), do: []

  def check(m, defs, {_, settings}, v2) do
    w = get_in(settings, ["world", "water"])
    if w, do: validate(w, m, defs, settings, v2), else: []
  end

  defp validate(w, m, defs, settings, {_, text}) do
    shape_checks(w, m, settings) ++ references(w, m, defs, text)
  end

  defp shape_checks(w, m, settings) do
    path = "cartridge.world.water"

    capabilities =
      for c <- ~w(water skills resource schedule death containment movement position),
          m["requires"]["capabilities"][c] != 1,
          do: diag("UNDECLARED_CAPABILITY", path, %{"capability" => c})

    values =
      if settings["world"]["death"] && settings["world"]["carry"], do: [], else: [bad(path)]

    elapsed =
      if get_in(m, ["time_policy", "profile"]) == "real_elapsed",
        do: [],
        else: [bad("cartridge.time_policy")]

    elapsed ++ capabilities ++ values ++ unique_routes(w["routes"])
  end

  defp unique_routes(routes) do
    endpoints = Enum.flat_map(routes, &Map.values/1)

    if length(endpoints) == length(Enum.uniq(endpoints)),
      do: [],
      else: [bad("cartridge.world.water.routes")]
  end

  defp references(w, m, defs, text) do
    prose =
      for k <- ~w(warning drowned),
          text != :unknown and not is_map_key(text, w[k]),
          do: diag("UNRESOLVED_REFERENCE", "cartridge.world.water." <> k, %{"target" => w[k]})

    Refs.reference("cartridge.json", ["world", "water"], {"skill", "skill"}, w, m, defs) ++
      prose ++ Enum.flat_map(Enum.with_index(w["routes"]), fn {r, i} -> route(r, i, m, defs) end)
  end

  defp route(r, i, m, defs) do
    steps = ["world", "water", "routes", i]

    refs =
      for k <- ~w(surface bottom),
          d <- Refs.reference("cartridge.json", steps, {k, "room"}, r, m, defs),
          do: d

    refs ++
      Enum.flat_map([{"surface", "down", "bottom"}, {"bottom", "up", "surface"}], fn side ->
        side_diagnostic(side, r, m, defs, steps)
      end)
  end

  defp side_diagnostic({k, direction, other}, r, m, defs, steps) do
    case Refs.resolve(r[k], "room", m, defs) do
      {_, _, room} when is_map(room) ->
        if route_side?(room, direction, r[other], k),
          do: [],
          else: [bad(at("cartridge.json", steps ++ [k]))]

      _ ->
        []
    end
  end

  defp route_side?(room, direction, other, side) do
    get_in(room, ["exits", direction, "to"]) == other and
      get_in(room, ["exits", direction, "barrier"]) == nil and
      (side != "bottom" or map_size(room["exits"]) == 1)
  end

  defp bad(path), do: diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})
end
