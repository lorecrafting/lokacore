defmodule Loka.Content.Patrol do
  @moduledoc "Finite original-leader patrol tuning and bound dialogue agreement."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [reference: 6, resolve: 4]

  def quest(rel, %{"patrol" => p} = q, ctx) do
    bad = fn field -> diag("OUTCOME_MISMATCH", at(rel, ["patrol", field])) end

    invalid =
      for {field, true} <- [
            {"initial_cursor", p["initial_cursor"] >= length(p["route"])},
            {"checkpoints",
             Enum.uniq(p["checkpoints"]) != p["checkpoints"] or
               p["required"] > length(p["checkpoints"]) or
               Enum.any?(p["checkpoints"], &(&1 not in p["route"]))},
            {"quest",
             q["objective"]["evidence"] != "patrol" or
               Enum.any?(~w(offer repeatable deadline exchange), &is_map_key(q, &1))},
            {"npc", invalid_npc?(p, ctx)},
            {"trust_fact", invalid_trust?(p, ctx)}
          ],
          do: bad.(field)

    edges =
      for {room, i} <- Enum.with_index(p["route"]),
          not edge?(room, Enum.at(p["route"], rem(i + 1, length(p["route"]))), ctx),
          do: bad.("route")

    caps =
      for capability <- ~w(patrol movement quest dialogue fact death),
          ctx.m["requires"]["capabilities"][capability] != 1,
          do: diag("UNDECLARED_CAPABILITY", at(rel, ["patrol"]), %{"capability" => capability})

    text =
      if ctx.text != :unknown and not is_map_key(ctx.text, p["narration"]),
        do: [
          diag("UNRESOLVED_REFERENCE", at(rel, ["patrol", "narration"]), %{
            "target" => p["narration"]
          })
        ],
        else: []

    references(rel, p, ctx) ++ invalid ++ edges ++ caps ++ text ++ conflicts(rel, p, q, ctx)
  end

  def quest(rel, %{"objective" => %{"evidence" => "patrol"}}, _),
    do: [diag("OUTCOME_MISMATCH", at(rel, ["objective"]))]

  def quest(_, _, _), do: []

  defp references(rel, p, ctx) do
    refs =
      Enum.flat_map(~w(npc trust_fact), fn field ->
        reference(
          rel,
          ["patrol"],
          {field, if(field == "npc", do: "npc", else: "fact")},
          p,
          ctx.m,
          ctx.defs
        )
      end)

    rooms =
      for field <- ~w(route checkpoints),
          {r, i} <- Enum.with_index(p[field]),
          do:
            reference(
              rel,
              ["patrol", field, i],
              {"room", "room"},
              %{"room" => r},
              ctx.m,
              ctx.defs
            )

    refs ++ Enum.concat(rooms)
  end

  defp invalid_npc?(p, ctx) do
    case resolve(p["npc"], "npc", ctx.m, ctx.defs) do
      {_, _, n} ->
        Enum.any?(~w(hp attack daily_schedule), &is_map_key(n, &1)) or
          n["room"] != Enum.at(p["route"], p["initial_cursor"])

      _ ->
        false
    end
  end

  defp invalid_trust?(p, ctx) do
    case resolve(p["trust_fact"], "fact", ctx.m, ctx.defs) do
      {_, _, f} ->
        f["value_type"] != %{"type" => "bool", "default" => false} or f["scopes"] != ["player"]

      _ ->
        false
    end
  end

  defp edge?(room, next, ctx) do
    case resolve(room, "room", ctx.m, ctx.defs) do
      {_, _, r} -> room != next and Enum.any?(r["exits"], fn {_, e} -> e["to"] == next end)
      _ -> true
    end
  end

  defp conflicts(rel, p, q, ctx) do
    other =
      for {_, {_, _, other}} <- ctx.defs["quest"],
          other != q,
          other["patrol"] &&
            (other["patrol"]["npc"] == p["npc"] or
               other["patrol"]["trust_fact"] == p["trust_fact"]),
          do: diag("OUTCOME_MISMATCH", at(rel, ["patrol", "npc"]))

    escorts =
      for {_, {drel, _, d}} <- ctx.defs["dialogue"],
          {key, o} <- d["choices"],
          o["escort"] && get_in(d, ["roles", o["escort"]["npc"], "npc"]) == p["npc"],
          do: diag("OUTCOME_MISMATCH", at(drel, ["choices", key, "escort"]))

    accepts =
      for {_, {drel, _, d}} <- ctx.defs["dialogue"],
          {key, o} <- d["choices"],
          o["accept"] && o["accept"]["key"] == q["key"] &&
            get_in(o, ["patrol", "transition"]) != "start",
          do: diag("OUTCOME_MISMATCH", at(drel, ["choices", key, "accept"]))

    dialogue =
      for {_, {drel, _, d}} <- ctx.defs["dialogue"],
          d["quest"] && d["quest"]["key"] == q["key"],
          do: diag("OUTCOME_MISMATCH", at(drel, ["quest"]))

    reactions =
      for {_, {rrel, _, r}} <- ctx.defs["reaction"],
          {s, i} <- Enum.with_index(r["apply"]),
          s["quest"] && s["quest"]["key"] == q["key"],
          do: diag("OUTCOME_MISMATCH", at(rrel, ["apply", i]))

    other ++ escorts ++ accepts ++ dialogue ++ reactions
  end

  def choice(rel, steps, %{"patrol" => p} = o, d, ctx) do
    refs = reference(rel, steps ++ ["patrol"], "quest", p, ctx.m, ctx.defs)

    valid =
      case resolve(p["quest"], "quest", ctx.m, ctx.defs) do
        {_, _, q} ->
          (q["patrol"] && get_in(d, ["roles", p["npc"], "npc"]) == q["patrol"]["npc"]) and
            not is_map_key(d, "quest") and
            if(p["transition"] == "start",
              do: o["accept"] == p["quest"],
              else: not is_map_key(o, "accept")
            ) and
            not Enum.any?(
              ~w(escort sequence payment lesson_payment receive hand_over),
              &is_map_key(o, &1)
            )

        _ ->
          true
      end

    refs ++ if(valid, do: [], else: [diag("OUTCOME_MISMATCH", at(rel, steps ++ ["patrol"]))])
  end

  def choice(_, _, _, _, _), do: []
end
