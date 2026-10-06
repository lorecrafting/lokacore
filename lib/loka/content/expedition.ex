defmodule Loka.Content.Expedition do
  @moduledoc "Closed C6 route, detail, reward and hound declarations."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [reference: 6, resolve: 4]

  def quest(rel, %{"expedition" => e} = q, ctx) do
    path = ["expedition"]
    bad = fn field -> diag("OUTCOME_MISMATCH", at(rel, path ++ [field])) end
    route = e["route"]
    footprint = e["footprint"]
    room = fn ref -> resolve(ref, "room", ctx.m, ctx.defs) end

    refs =
      (Enum.flat_map(
         [
           {"start_room", "room"},
           {"shelter_room", "room"},
           {"survived_fact", "fact"},
           {"faction", "fact"},
           {"hound_population", "population"}
         ],
         fn pair -> reference(rel, path, pair, e, ctx.m, ctx.defs) end
       ) ++
         for(
           {r, i} <- Enum.with_index(footprint),
           do:
             reference(
               rel,
               path ++ ["footprint", i],
               {"room", "room"},
               %{"room" => r},
               ctx.m,
               ctx.defs
             )
         ))
      |> List.flatten()

    edge_refs =
      for {edge, i} <- Enum.with_index(route),
          field <- ~w(from to),
          d <- reference(rel, path ++ ["route", i], {field, "room"}, edge, ctx.m, ctx.defs),
          do: d

    edges =
      for {edge, i} <- Enum.with_index(route),
          (i == 0 and edge["from"] != e["start_room"]) or
            (i > 0 and Enum.at(route, i - 1)["to"] != edge["from"]) or
            not Enum.member?(footprint, edge["from"]) or
            not Enum.member?(footprint, edge["to"]) or
            wrong_edge?(room.(edge["from"]), edge),
          do: bad.("route")

    details =
      for {field, room_field} <- [
            {"start_detail", "start_room"},
            {"shelter_detail", "shelter_room"}
          ],
          match?({_, _, _}, room.(e[room_field])) and
            not Map.has_key?(elem(room.(e[room_field]), 2)["details"] || %{}, e[field]),
          do: bad.(field)

    semantic =
      [] ++
        if(
          q["objective"]["evidence"] != "expedition" or
            Enum.any?(~w(offer repeatable deadline exchange patrol), &Map.has_key?(q, &1)),
          do: [bad.("quest")],
          else: []
        ) ++
        if(
          length(route) < 3 or Enum.at(route, 2)["to"] != e["shelter_room"] or
            Enum.uniq(footprint) != footprint or e["start_room"] not in footprint,
          do: [bad.("route")],
          else: []
        ) ++
        fact_checks(e, ctx, bad)

    narration =
      if ctx.text == :unknown do
        []
      else
        for {name, key} <- e["narration"],
            not Map.has_key?(ctx.text, key),
            do:
              diag("UNRESOLVED_REFERENCE", at(rel, path ++ ["narration", name]), %{
                "target" => key
              })
      end

    caps =
      for capability <- ~w(expedition movement quest fact combat death population),
          ctx.m["requires"]["capabilities"][capability] != 1,
          do: diag("UNDECLARED_CAPABILITY", at(rel, path), %{"capability" => capability})

    refs ++ edge_refs ++ edges ++ details ++ semantic ++ narration ++ caps
  end

  def quest(rel, %{"objective" => %{"evidence" => "expedition"}}, _),
    do: [diag("OUTCOME_MISMATCH", at(rel, ["objective"]))]

  def quest(_, _, _), do: []

  defp wrong_edge?({_, _, room}, edge),
    do: get_in(room, ["exits", edge["direction"], "to"]) != edge["to"]

  defp wrong_edge?(_, _), do: false

  defp fact_checks(e, ctx, bad) do
    survived = resolve(e["survived_fact"], "fact", ctx.m, ctx.defs)
    faction = resolve(e["faction"], "fact", ctx.m, ctx.defs)
    population = resolve(e["hound_population"], "population", ctx.m, ctx.defs)

    [] ++
      if(
        match?({_, _, _}, survived) and
          (elem(survived, 2)["value_type"] != %{"type" => "bool", "default" => false} or
             elem(survived, 2)["scopes"] != ["player"]),
        do: [bad.("survived_fact")],
        else: []
      ) ++
      if(
        match?({_, _, _}, faction) and
          (get_in(elem(faction, 2), ["value_type", "type"]) != "int" or
             elem(faction, 2)["scopes"] != ["player"]),
        do: [bad.("faction")],
        else: []
      ) ++
      if(match?({_, _, _}, population) and not is_map(elem(population, 2)["pack"]),
        do: [bad.("hound_population")],
        else: []
      )
  end
end
