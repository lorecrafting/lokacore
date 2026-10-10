defmodule Loka.Content.NpcFields do
  @moduledoc "Expands an NPC definition's schedule, immune list, (toolbox row G3) attributes and (row W6) text variants to local DefinitionRefs; part of Loka.Content.Checks.expand."
  import Loka.Content.Source, only: [ref: 3]

  def expand(npc, m) do
    npc
    |> update("daily_schedule", fn s -> Map.new(s, fn {h, r} -> {h, ref(r, "room", m)} end) end)
    |> update("immune", fn c -> Enum.map(c, &ref(&1, "status", m)) end)
    |> update("attributes", fn c ->
      Enum.map(c, fn a -> Map.update!(a, "attribute", &ref(&1, "attribute", m)) end)
    end)
    |> Map.merge(variants(npc, m))
  end

  # Toolbox row W6: the conditions of its text variants.
  defp variants(npc, m) do
    for {f, v} <- Map.take(npc, ~w(short_variants room_line_variants description_variants)),
        into: %{},
        do: {f, Loka.Content.Checks.expand(v, m)}
  end

  defp update(npc, field, f) when is_map_key(npc, field), do: Map.update!(npc, field, f)
  defp update(npc, _, _), do: npc
end
