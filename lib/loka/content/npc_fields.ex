defmodule Loka.Content.NpcFields do
  @moduledoc "Expands an NPC definition's schedule, immune list, (toolbox row G3) attributes and (row W6) text variants to local DefinitionRefs; part of Loka.Content.Checks.expand."
  import Loka.Content.Source, only: [ref: 3]

  # `expand` is Loka.Content.Checks.expand/2, passed in so this module does not call back into it.
  def expand(npc, m, expand) do
    npc
    |> update("daily_schedule", fn s -> Map.new(s, fn {h, r} -> {h, room(r, m, expand)} end) end)
    |> update("immune", fn c -> Enum.map(c, &ref(&1, "status", m)) end)
    |> update("attributes", fn c ->
      Enum.map(c, fn a -> Map.update!(a, "attribute", &ref(&1, "attribute", m)) end)
    end)
    |> Map.merge(variants(npc, m, expand))
  end

  # Toolbox row W6: the conditions of its text variants.
  defp variants(npc, m, expand) do
    for {f, v} <- Map.take(npc, ~w(short_variants room_line_variants description_variants)),
        into: %{},
        do: {f, expand.(v, m)}
  end

  # A schedule hour's room, or (toolbox row W10) its cases' rooms and conditions and its fallback.
  defp room(list, m, expand) when is_list(list), do: Enum.map(list, &room(&1, m, expand))

  defp room(%{"room" => r, "when" => w} = c, m, expand),
    do: %{c | "room" => ref(r, "room", m), "when" => expand.(w, m)}

  defp room(r, m, _), do: ref(r, "room", m)

  defp update(npc, field, f) when is_map_key(npc, field), do: Map.update!(npc, field, f)
  defp update(npc, _, _), do: npc
end
