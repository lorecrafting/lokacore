defmodule Loka.Content.NpcFields do
  @moduledoc "Expands an NPC definition's schedule, immune list, (toolbox row G3) attributes and (row W6) text variants (row G11) disposition conditions and (row 35) arrest room and (row G7) lock conditions and (row FD7) ask answers to local DefinitionRefs; part of Loka.Content.Checks.expand."
  import Loka.Content.Source, only: [ref: 3]

  # `expand` is Loka.Content.Checks.expand/2, passed in so this module does not call back into it.
  def expand(npc, m, expand) do
    npc
    |> update("daily_schedule", fn s -> Map.new(s, fn {h, r} -> {h, room(r, m, expand)} end) end)
    |> update("immune", fn c -> Enum.map(c, &ref(&1, "status", m)) end)
    |> update("attributes", fn c ->
      Enum.map(c, fn a -> Map.update!(a, "attribute", &ref(&1, "attribute", m)) end)
    end)
    |> update("ask", &ask(&1, m, expand))
    |> Map.merge(variants(npc, m, expand))
    |> arrest(m)
  end

  # Toolbox row 35: the room an arrest moves the body to (after `variants`, which rewrites disposition).
  defp arrest(%{"disposition" => %{"arrest" => _}} = npc, m),
    do: update_in(npc, ["disposition", "arrest", "to"], &ref(&1, "room", m))

  defp arrest(npc, _), do: npc

  # Toolbox row FD7: each answer's topic, granted topic and condition.
  defp ask(a, m, expand),
    do: Map.update!(a, "answers", &Enum.map(&1, fn x -> answer(x, m, expand) end))

  defp answer(a, m, expand) do
    a
    |> Map.update!("topic", &ref(&1, "topic", m))
    |> update("grants", &ref(&1, "topic", m))
    |> update("when", &expand.(&1, m))
  end

  # Toolbox row W6: the conditions of its text variants; (row G11) disposition and (row G7) lock conditions.
  defp variants(npc, m, expand) do
    for {f, v} <-
          Map.take(
            npc,
            ~w(short_variants room_line_variants description_variants disposition locks)
          ),
        into: %{},
        do: {f, expand.(v, m)}
  end

  # A schedule hour's room, or (toolbox row W10) its cases' rooms and conditions and its fallback.
  defp room(list, m, expand) when is_list(list), do: Enum.map(list, &room(&1, m, expand))

  defp room(%{"room" => r} = c, m, expand) do
    c = %{c | "room" => ref(r, "room", m)}
    if is_map_key(c, "when"), do: Map.update!(c, "when", &expand.(&1, m)), else: c
  end

  defp room(r, m, _), do: ref(r, "room", m)

  defp update(npc, field, f) when is_map_key(npc, field), do: Map.update!(npc, field, f)
  defp update(npc, _, _), do: npc
end
