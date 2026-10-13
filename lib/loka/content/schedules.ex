defmodule Loka.Content.Schedules do
  @moduledoc """
  Toolbox row W10: a source `daily_schedule` hour may be `[case, ..., room]`, cases
  `{when?, room, goal?, walks?}` and a short room key last, or (toolbox row W26) one walking case
  `{room, walks: true}`. The checks: that order, each case room, kernel_api 1.47, and 1.81 for any
  `walks` (a case or a population plan); the artifact splits each such hour into the fallback room
  and `schedule_cases`. Goal texts and conditions are Loka.Content.Entities'. Twin of
  kernel/ts/src/content/cartridge_schedules.ts.
  """
  import Loka.Content.Source, only: [at: 2, diag: 3]
  import Loka.Content.Refs, only: [reference: 6]

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _), do: []

  def check(m, defs) do
    hours = hours(defs)
    lists? = Enum.any?(hours, &is_list(elem(&1, 2)))

    Enum.flat_map(hours, &hour(&1, {m, defs})) ++
      floor(lists?, [1, 47], m) ++ floor(walks?(hours, defs), [1, 81], m)
  end

  # Each source hour with cases: a list, or one walking case.
  defp hours(defs) do
    for {_, {rel, _, npc}} <- defs["npc"],
        {h, c} when is_list(c) or is_map_key(c, "room") <- Map.get(npc, "daily_schedule", %{}),
        do: {rel, h, c}
  end

  defp hour({_, _, c} = list, md) when is_list(c), do: order(list) ++ rooms(list, md)
  defp hour({rel, h, c}, md), do: room(rel, h, c, md)

  defp floor(false, _, _), do: []

  defp floor(true, least, m),
    do:
      if(api(m) < least,
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
        else: []
      )

  # Toolbox row W26: a walking case (in a list or alone) or a walking population plan.
  defp walks?(hours, defs) do
    cases = Enum.flat_map(hours, fn {_, _, c} -> List.wrap(c) end)

    Enum.any?(cases, &match?(%{"walks" => _}, &1)) or
      Enum.any?(defs["population"] || %{}, &match?({_, {_, _, %{"walks" => _}}}, &1))
  end

  defp order({rel, h, list}) do
    if ordered?(list),
      do: [],
      else: [
        diag("SCHEMA_VIOLATION", at(rel, ["daily_schedule", h]), %{"error" => "invalid_value"})
      ]
  end

  defp rooms({rel, h, list}, md),
    do: for({c, i} <- Enum.with_index(list), d <- room(rel, h, c, i, md), do: d)

  @doc "An expanded NPC with each case list split into its fallback room and `schedule_cases`."
  def split(%{"daily_schedule" => s} = npc) do
    cases =
      for {h, c} when is_list(c) or is_map_key(c, "room") <- s,
          into: %{},
          do: {h, if(is_list(c), do: Enum.drop(c, -1), else: [c])}

    rooms = Map.new(s, fn {h, r} -> {h, fallback(r)} end)
    npc = Map.put(npc, "daily_schedule", rooms)
    if cases == %{}, do: npc, else: Map.put(npc, "schedule_cases", cases)
  end

  def split(definition), do: definition

  defp fallback(list) when is_list(list), do: List.last(list)
  defp fallback(%{"room" => r}), do: r
  defp fallback(r), do: r

  defp ordered?(list) do
    {cases, [last]} = Enum.split(list, -1)
    Enum.all?(cases, &match?(%{"room" => _}, &1)) and not match?(%{"room" => _}, last)
  end

  # A case's room, at daily_schedule/<h>/<i>/room, or the fallback ref, at daily_schedule/<h>/<i>.
  defp room(rel, h, %{"room" => _} = c, i, {m, defs}),
    do: reference(rel, ["daily_schedule", h, i], "room", c, m, defs)

  defp room(rel, h, r, i, {m, defs}),
    do: reference(rel, ["daily_schedule", h], {i, "room"}, %{i => r}, m, defs)

  # A lone walking case's room, at daily_schedule/<h>/room.
  defp room(rel, h, c, {m, defs}), do: reference(rel, ["daily_schedule", h], "room", c, m, defs)

  defp api(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)
end
