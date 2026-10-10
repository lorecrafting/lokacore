defmodule Loka.Content.Schedules do
  @moduledoc """
  Toolbox row W10: a source `daily_schedule` hour may be `[case, ..., room]`, cases
  `{when, room, goal?}` and a short room key last. The checks: that order, each case room, and
  kernel_api 1.47; the artifact splits each such hour into the fallback room and
  `schedule_cases`. Goal texts and conditions are Loka.Content.Entities'. Twin of
  kernel/ts/src/content/cartridge_schedules.ts.
  """
  import Loka.Content.Source, only: [at: 2, diag: 3]
  import Loka.Content.Refs, only: [reference: 6]

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _), do: []

  def check(m, defs) do
    lists =
      for {_, {rel, _, npc}} <- defs["npc"],
          {h, list} when is_list(list) <- Map.get(npc, "daily_schedule", %{}),
          do: {rel, h, list}

    Enum.flat_map(lists, &(order(&1) ++ rooms(&1, {m, defs}))) ++ floor(lists, m)
  end

  defp floor([], _), do: []

  defp floor(_, m),
    do:
      if(api(m) < [1, 47],
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
        else: []
      )

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
    cases = for {h, list} when is_list(list) <- s, into: %{}, do: {h, Enum.drop(list, -1)}
    rooms = Map.new(s, fn {h, r} -> {h, if(is_list(r), do: List.last(r), else: r)} end)
    npc = Map.put(npc, "daily_schedule", rooms)
    if cases == %{}, do: npc, else: Map.put(npc, "schedule_cases", cases)
  end

  def split(definition), do: definition

  defp ordered?(list) do
    {cases, [last]} = Enum.split(list, -1)
    Enum.all?(cases, &is_map_key(&1, "room")) and not is_map_key(last, "room")
  end

  # A case's room, at daily_schedule/<h>/<i>/room, or the fallback ref, at daily_schedule/<h>/<i>.
  defp room(rel, h, %{"room" => _} = c, i, {m, defs}),
    do: reference(rel, ["daily_schedule", h, i], "room", c, m, defs)

  defp room(rel, h, r, i, {m, defs}),
    do: reference(rel, ["daily_schedule", h], {i, "room"}, %{i => r}, m, defs)

  defp api(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)
end
