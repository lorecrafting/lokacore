defmodule Loka.Content.Topics do
  @moduledoc "Declared Boolean topic grants and self-luminous discovery references."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [reference: 6, resolve: 4]

  def check(nil, _, _), do: []
  def check(_, _, nil), do: []

  def check(m, defs, {_, text}) do
    ts = for {_, {rel, _, d}} <- defs["topic"], do: {rel, d}

    Enum.flat_map(ts, &topic(&1, ts, m, defs, text)) ++
      grants(m, defs) ++ books(m, defs) ++ perception(m, defs) ++ markers(defs, text)
  end

  defp topic({rel, d}, ts, m, defs, text) do
    fact(rel, [], d, m, defs) ++
      if(text != :unknown and not is_map_key(text, d["label"]),
        do: [diag("UNRESOLVED_REFERENCE", at(rel, ["label"]), %{"target" => d["label"]})],
        else: []
      ) ++
      if(Enum.count(ts, fn {_, other} -> other["fact"] == d["fact"] end) > 1,
        do: [diag("DUPLICATE_DEFINITION", at(rel, ["fact"]))],
        else: []
      )
  end

  defp fact(rel, steps, d, m, defs) do
    reference(rel, steps, "fact", d, m, defs) ++
      case resolve(d["fact"], "fact", m, defs) do
        {_, _, f} ->
          if f["value_type"] == %{"type" => "bool", "default" => false} and
               f["scopes"] == ["player"],
             do: [],
             else: [diag("FACT_TYPE_MISMATCH", at(rel, steps ++ ["fact"]))]

        _ ->
          []
      end
  end

  defp grants(m, defs) do
    for {_, {rel, _, d}} <- defs["dialogue"],
        {id, o} <- d["choices"],
        {%{"op" => "topic.grant"} = s, i} <- Enum.with_index(Map.get(o, "sequence", [])),
        error <- reference(rel, ["choices", id, "sequence", i], "topic", s, m, defs),
        do: error
  end

  defp books(m, defs) do
    for {_, {rel, _, item}} <- defs["item"],
        readable = item["readable"],
        readable != nil,
        error <-
          if(readable["topic"],
            do: reference(rel, ["readable"], "topic", readable, m, defs),
            else: []
          ),
        do: error
  end

  defp markers(defs, text) do
    for {_, {rel, _, room}} <- defs["room"],
        {key, detail} <- Map.get(room, "details", %{}),
        detail["perception"] != nil,
        title = detail["perception"]["title"],
        text != :unknown and not is_map_key(text, title),
        do:
          diag("UNRESOLVED_REFERENCE", at(rel, ["details", key, "perception", "title"]), %{
            "target" => title
          })
  end

  defp perception(m, defs) do
    for {_, {rel, _, n}} <- defs["npc"],
        n["perception"] != nil,
        error <- fact(rel, ["perception"], %{"fact" => n["perception"]["discovered"]}, m, defs),
        do: error
  end
end
