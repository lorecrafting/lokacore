defmodule Loka.Content.Calendar do
  @moduledoc "Calendar cross-field checks before a cartridge artifact is emitted."
  import Loka.Content.Source, only: [at: 2, diag: 3]

  @cycles ~w(lunar season tide)

  def check(calendar, defs, m) do
    hour = Map.get(calendar, "units_per_hour", 3600)
    hours = Map.get(calendar, "hours_per_day", 24)
    subdivision = Map.get(calendar, "subdivisions_per_hour")

    day = hour * hours
    invalid = fn path -> diag("SCHEMA_VIOLATION", path, %{"error" => "not_in_enum"}) end
    nodes = policy_nodes(defs)

    base(calendar, day, hour, subdivision, invalid) ++
      cuts(calendar["solar"], day, ["calendar", "solar"], invalid, false) ++
      Enum.flat_map(@cycles, &cycle(&1, calendar[&1], invalid)) ++
      weathers(calendar["weather"], invalid) ++
      schedules(defs["npc"], hours, invalid) ++
      windows(nodes, hours, invalid) ++
      sky(calendar, nodes, {m, defs}, invalid)
  end

  # Toolbox rows 10 and 31: each sky leaf names a phase its calendar table authors; it, the row 31
  # tables and a barrier's opens_when need kernel_api 1.45.
  defp sky(calendar, nodes, {m, defs}, invalid) do
    leaves = for {%{"op" => "sky"} = node, rel, path} <- nodes, do: {node, rel, path}

    gated =
      leaves != [] or Enum.any?(~w(weather season tide), &Map.has_key?(calendar, &1)) or
        Enum.any?(defs["barrier"] || %{}, &opens_when?/1)

    phases(calendar, leaves, invalid) ++ floor(m, gated)
  end

  defp phases(calendar, leaves, invalid) do
    for {node, rel, path} <- leaves,
        field <- ["weather" | @cycles],
        Map.has_key?(node, field),
        node[field] not in for(cut <- table(calendar, field), do: cut["phase"]),
        do: invalid.(at(rel, path ++ [field]))
  end

  defp table(calendar, "weather"), do: calendar["weather"] || []
  defp table(calendar, field), do: get_in(calendar, [field, "phases"]) || []

  defp opens_when?({_, {_, _, barrier}}), do: is_map_key(barrier, "opens_when")

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  defp floor(nil, _), do: []
  defp floor(_, false), do: []

  defp floor(m, true) do
    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if api < [1, 45],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
      else: []
  end

  defp base(calendar, day, hour, subdivision, invalid) do
    fields =
      Enum.map(
        ~w(units_per_hour hours_per_day subdivisions_per_hour),
        &Map.has_key?(calendar, &1)
      )

    if (Enum.any?(fields) and not Enum.all?(fields)) or
         day > 9_007_199_254_740_991 or
         (subdivision != nil and rem(hour, subdivision) != 0) or
         Map.get(calendar, "start", 0) + day > 9_007_199_254_740_991,
       do: [invalid.(at("cartridge.json", ["calendar"]))],
       else: []
  end

  defp cycle(_, nil, _), do: []

  defp cycle(name, %{"origin" => origin, "period" => period, "phases" => phases}, invalid) do
    span =
      if origin + period > 9_007_199_254_740_991,
        do: [invalid.(at("cartridge.json", ["calendar", name]))],
        else: []

    span ++ cuts(phases, period, ["calendar", name, "phases"], invalid, true)
  end

  # Row 31: weather phases are unique in the table.
  defp weathers(nil, _), do: []

  defp weathers(table, invalid) do
    for {w, i} <- Enum.with_index(table),
        Enum.any?(Enum.take(table, i), &(&1["phase"] == w["phase"])),
        do: invalid.(at("cartridge.json", ["calendar", "weather", i]))
  end

  defp cuts(nil, _, _, _, _), do: []

  defp cuts(cuts, span, path, invalid, first_zero) do
    {errors, _, _} =
      Enum.reduce(Enum.with_index(cuts), {[], -1, MapSet.new()}, fn {cut, i},
                                                                    {errors, prior, seen} ->
        errors = cut_error(cut, span, {prior, seen}, {invalid, path, i}, errors)
        {errors, cut["at"], MapSet.put(seen, cut["phase"])}
      end)

    if not first_zero or hd(cuts)["at"] == 0,
      do: errors,
      else: [invalid.(at("cartridge.json", path)) | errors]
  end

  defp cut_error(cut, span, {prior, seen}, {invalid, path, i}, errors) do
    if cut["at"] >= span or cut["at"] <= prior or MapSet.member?(seen, cut["phase"]),
      do: [invalid.(at("cartridge.json", path ++ [i])) | errors],
      else: errors
  end

  defp schedules(npcs, hours, invalid) do
    for {_, {rel, _, npc}} <- npcs,
        {key, _} <- Map.get(npc, "daily_schedule", %{}),
        String.to_integer(key) >= hours,
        do: invalid.(at(rel, ["daily_schedule", key]))
  end

  defp windows(nodes, hours, invalid) do
    for {node, rel, path} <- nodes,
        node["op"] == "time_window",
        node["from"] >= hours or node["to"] >= hours,
        do: invalid.(at(rel, path))
  end

  defp policy_nodes(defs) do
    for {_, group} <- defs,
        is_map(group),
        {_, {rel, _, definition}} <- group,
        {node, path} <- walk(definition, []),
        do: {node, rel, path}
  end

  defp walk(value, path) when is_map(value) do
    [{value, path} | for({key, child} <- value, pair <- walk(child, path ++ [key]), do: pair)]
  end

  defp walk(value, path) when is_list(value) do
    for {child, index} <- Enum.with_index(value), pair <- walk(child, path ++ [index]), do: pair
  end

  defp walk(_, _), do: []
end
