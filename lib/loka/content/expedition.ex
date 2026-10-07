defmodule Loka.Content.Expedition do
  @moduledoc "Closed C6 route, detail, reward and hound declarations."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2, ref: 3]
  import Loka.Content.Refs, only: [reference: 6, resolve: 4]

  def expand(e, m) do
    fields = [
      {"start_room", "room"},
      {"shelter_room", "room"},
      {"survived_fact", "fact"},
      {"faction", "fact"},
      {"hound_population", "population"}
    ]

    Enum.reduce(fields, e, fn {field, kind}, acc -> Map.update!(acc, field, &ref(&1, kind, m)) end)
    |> Map.update!("footprint", &Enum.map(&1, fn room -> ref(room, "room", m) end))
    |> Map.update!("route", fn edges -> Enum.map(edges, &expand_edge(&1, m)) end)
  end

  defp expand_edge(edge, m),
    do: edge |> Map.update!("from", &ref(&1, "room", m)) |> Map.update!("to", &ref(&1, "room", m))

  def quest(rel, %{"expedition" => e} = q, ctx) do
    refs(rel, e, ctx) ++
      route_checks(rel, e, ctx) ++
      detail_checks(rel, e, ctx) ++
      semantic_checks(rel, e, q, ctx) ++
      narration_checks(rel, e, ctx) ++
      for capability <- ~w(expedition movement quest fact combat death population),
          ctx.m["requires"]["capabilities"][capability] != 1,
          do:
            diag("UNDECLARED_CAPABILITY", at(rel, ["expedition"]), %{"capability" => capability})
  end

  def quest(rel, %{"objective" => %{"evidence" => "expedition"}}, _),
    do: [diag("OUTCOME_MISMATCH", at(rel, ["objective"]))]

  def quest(_, _, _), do: []

  defp refs(rel, e, ctx) do
    fields = [
      {"start_room", "room"},
      {"shelter_room", "room"},
      {"survived_fact", "fact"},
      {"faction", "fact"},
      {"hound_population", "population"}
    ]

    named = Enum.flat_map(fields, &reference(rel, ["expedition"], &1, e, ctx.m, ctx.defs))

    named ++ footprint_refs(rel, e, ctx) ++ edge_refs(rel, e, ctx)
  end

  defp footprint_refs(rel, e, ctx) do
    for {r, i} <- Enum.with_index(e["footprint"]),
        d <-
          reference(
            rel,
            ["expedition", "footprint", i],
            {"room", "room"},
            %{"room" => r},
            ctx.m,
            ctx.defs
          ),
        do: d
  end

  defp edge_refs(rel, e, ctx) do
    for {edge, i} <- Enum.with_index(e["route"]),
        field <- ~w(from to),
        d <- reference(rel, ["expedition", "route", i], {field, "room"}, edge, ctx.m, ctx.defs),
        do: d
  end

  defp route_checks(rel, e, ctx) do
    for {edge, i} <- Enum.with_index(e["route"]),
        not joins?(e, edge, i) or not in_footprint?(e, edge) or
          wrong_edge?(resolve(edge["from"], "room", ctx.m, ctx.defs), edge),
        do: diag("OUTCOME_MISMATCH", at(rel, ["expedition", "route"]))
  end

  defp joins?(e, edge, 0), do: edge["from"] == e["start_room"]
  defp joins?(e, edge, i), do: Enum.at(e["route"], i - 1)["to"] == edge["from"]
  defp in_footprint?(e, edge), do: edge["from"] in e["footprint"] and edge["to"] in e["footprint"]

  defp detail_checks(rel, e, ctx) do
    for {field, room_field} <- [
          {"start_detail", "start_room"},
          {"shelter_detail", "shelter_room"}
        ],
        room = resolve(e[room_field], "room", ctx.m, ctx.defs),
        match?({_, _, _}, room) and not Map.has_key?(elem(room, 2)["details"] || %{}, e[field]),
        do: diag("OUTCOME_MISMATCH", at(rel, ["expedition", field]))
  end

  defp semantic_checks(rel, e, q, ctx) do
    bad = fn field -> diag("OUTCOME_MISMATCH", at(rel, ["expedition", field])) end

    [] ++
      if(
        q["objective"]["evidence"] != "expedition" or
          Enum.any?(~w(offer repeatable deadline exchange patrol), &Map.has_key?(q, &1)),
        do: [bad.("quest")],
        else: []
      ) ++
      if(
        not route_shape?(e),
        do: [bad.("route")],
        else: []
      ) ++ fact_checks(e, ctx, bad)
  end

  defp route_shape?(e),
    do:
      length(e["route"]) >= 3 and Enum.at(e["route"], 2)["to"] == e["shelter_room"] and
        Enum.uniq(e["footprint"]) == e["footprint"] and e["start_room"] in e["footprint"]

  defp narration_checks(_, _, %{text: :unknown}), do: []

  defp narration_checks(rel, e, ctx) do
    for {name, key} <- e["narration"],
        not Map.has_key?(ctx.text, key),
        do:
          diag("UNRESOLVED_REFERENCE", at(rel, ["expedition", "narration", name]), %{
            "target" => key
          })
  end

  defp wrong_edge?({_, _, room}, edge),
    do: get_in(room, ["exits", edge["direction"], "to"]) != edge["to"]

  defp wrong_edge?(_, _), do: false

  defp fact_checks(e, ctx, bad) do
    for {field, kind} <- [
          {"survived_fact", "fact"},
          {"faction", "fact"},
          {"hound_population", "population"}
        ],
        resolved = resolve(e[field], kind, ctx.m, ctx.defs),
        match?({_, _, _}, resolved) and not valid_fact?(field, elem(resolved, 2)),
        do: bad.(field)
  end

  defp valid_fact?("survived_fact", row),
    do:
      row["value_type"] == %{"type" => "bool", "default" => false} and row["scopes"] == ["player"]

  defp valid_fact?("faction", row),
    do: get_in(row, ["value_type", "type"]) == "int" and row["scopes"] == ["player"]

  defp valid_fact?("hound_population", row), do: is_map(row["pack"])
end
