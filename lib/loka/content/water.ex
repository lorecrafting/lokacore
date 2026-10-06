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
    |> Map.update!("routes", fn routes ->
      Enum.map(routes, fn r -> Map.new(r, fn {k, v} -> {k, ref(v, "room", m)} end) end)
    end)
  end

  def check(nil, _, _, _), do: []

  def check(m, defs, {_, settings}, v2) do
    w = get_in(settings, ["world", "water"])
    if w, do: validate(w, m, defs, settings, v2), else: []
  end

  defp validate(w, m, defs, settings, {_, text}) do
    path = "cartridge.world.water"

    caps =
      for c <- ~w(water skills resource schedule death containment movement position),
          m["requires"]["capabilities"][c] != 1,
          do: diag("UNDECLARED_CAPABILITY", path, %{"capability" => c})

    refs = Refs.reference("cartridge.json", ["world", "water"], {"skill", "skill"}, w, m, defs)

    values =
      if settings["world"]["death"] && settings["world"]["carry"], do: [], else: [bad(path)]

    prose =
      for k <- ~w(warning drowned),
          text != :unknown and not is_map_key(text, w[k]),
          do: diag("UNRESOLVED_REFERENCE", path <> "." <> k, %{"target" => w[k]})

    endpoints = Enum.flat_map(w["routes"], &Map.values/1)

    unique =
      if length(endpoints) == length(Enum.uniq(endpoints)), do: [], else: [bad(path <> ".routes")]

    elapsed =
      if get_in(m, ["time_policy", "profile"]) == "real_elapsed",
        do: [],
        else: [bad("cartridge.time_policy")]

    elapsed ++
      caps ++
      refs ++
      values ++
      prose ++
      unique ++ Enum.flat_map(Enum.with_index(w["routes"]), fn {r, i} -> route(r, i, m, defs) end)
  end

  defp route(r, i, m, defs) do
    steps = ["world", "water", "routes", i]

    refs =
      for k <- ~w(surface bottom),
          d <- Refs.reference("cartridge.json", steps, {k, "room"}, r, m, defs),
          do: d

    sides = [{"surface", "down", "bottom"}, {"bottom", "up", "surface"}]

    refs ++
      Enum.flat_map(sides, fn {k, direction, other} ->
        case Refs.resolve(r[k], "room", m, defs) do
          {_, _, room} when is_map(room) ->
            if get_in(room, ["exits", direction, "to"]) == r[other] and
                 get_in(room, ["exits", direction, "barrier"]) == nil and
                 (k != "bottom" or map_size(room["exits"]) == 1),
               do: [],
               else: [bad(at("cartridge.json", steps ++ [k]))]

          _ ->
            []
        end
      end)
  end

  defp bad(path), do: diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})
end
