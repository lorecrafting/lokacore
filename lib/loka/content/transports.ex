defmodule Loka.Content.Transports do
  @moduledoc "Checks paired authored ferry endpoints and exact conserved payment bindings."
  import Loka.Content.Source, only: [diag: 3, at: 2, ref: 3]
  alias Loka.Content.Refs

  def expand(t, m) do
    t =
      Enum.reduce(~w(room destination reverse recipient currency), t, fn field, result ->
        kind =
          case field do
            "reverse" -> "transport"
            "recipient" -> "npc"
            "currency" -> "resource"
            _ -> "room"
          end

        Map.update!(result, field, &ref(&1, kind, m))
      end)

    Map.update!(t, "recovery_rooms", &Enum.map(&1, fn r -> ref(r, "room", m) end))
  end

  def check(nil, _, _), do: []
  def check(_, _, nil), do: []

  def check(m, defs, {_, text}) do
    routes = for {_, {rel, [], t}} <- defs["transport"], do: {rel, t}

    api(m, routes) ++
      Enum.flat_map(routes, fn {rel, t} -> endpoint(rel, t, m, defs, text) end) ++
      details(m, defs, text)
  end

  defp api(m, routes) do
    minimum =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if routes != [] and minimum < [1, 26],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
      else: []
  end

  defp endpoint(rel, t, m, defs, text) do
    checks = bindings(t, m, defs) ++ rooms(t, m, defs)

    texts(
      rel,
      [{["label"], t["label"]}, {["narration"], t["narration"]}, {[], "transport.unaffordable"}],
      text
    ) ++
      for({valid, fields} <- checks, not valid, do: bad(at(rel, fields)))
  end

  defp bindings(t, m, defs) do
    [
      {m["requires"]["capabilities"]["transport"] == 1, []},
      {paired?(t, resolved(t["reverse"], "transport", m, defs), m), ["reverse"]},
      {payment?(t, m, defs), ["currency"]},
      {action?(resolved(ref(t["action"], "action", m), "action", m, defs)), ["action"]},
      {recovery?(t, m, defs), ["recovery_rooms"]}
    ]
  end

  defp rooms(t, m, defs) do
    room = resolved(t["room"], "room", m, defs)
    detail = get_in(room, ["details", t["detail"], "transport"])

    [
      {room != %{} and resolved(t["destination"], "room", m, defs) != %{}, ["room"]},
      {detail != nil and detail["route"] == ref(t["key"], "transport", m), ["detail"]},
      {not Enum.any?(room["exits"] || %{}, fn {_, e} -> e["to"] == t["destination"] end),
       ["destination"]}
    ]
  end

  defp payment?(t, m, defs),
    do:
      funded?(
        resolved(t["currency"], "resource", m, defs),
        resolved(t["recipient"], "npc", m, defs),
        t
      )

  defp paired?(t, back, m) do
    t["room"] != t["destination"] and back["room"] == t["destination"] and
      back["destination"] == t["room"] and
      back["reverse"] == ref(t["key"], "transport", m) and back["recipient"] == t["recipient"] and
      back["currency"] == t["currency"]
  end

  defp funded?(currency, npc, t),
    do:
      currency["gain"] == 0 and currency["regen"] == nil and
        npc["resource_starts"][t["currency"]["key"]] != nil

  defp action?(action),
    do:
      action["command"] == "use_transport" and
        action["target"] == %{"kind" => "entity", "scopes" => ["inspectable_details"]} and
        action["input"] == ["route", "quoted_fare"]

  defp recovery?(t, m, defs),
    do:
      Enum.uniq(t["recovery_rooms"]) == t["recovery_rooms"] and
        t["room"] not in t["recovery_rooms"] and
        Enum.all?(t["recovery_rooms"], &(resolved(&1, "room", m, defs) != %{}))

  defp details(m, defs, text) do
    for {room_key, {rel, [], room}} <- defs["room"],
        {key, d} <- room["details"] || %{},
        d["transport"],
        error <- detail(rel, room_key, key, d["transport"], {m, defs, text}),
        do: error
  end

  defp detail(rel, room, key, t, {m, defs, text}) do
    route = resolved(t["route"], "transport", m, defs)
    fields = ["details", key, "transport"]

    errors =
      if route["room"] == ref(room, "room", m) and route["detail"] == key,
        do: [],
        else: [bad(at(rel, fields))]

    errors ++ texts(rel, [{fields ++ ["title"], t["title"]}], text)
  end

  defp resolved(r, kind, m, defs) do
    case Refs.resolve(r, kind, m, defs) do
      {_, _, d} -> d
      _ -> %{}
    end
  end

  defp texts(_, _, :unknown), do: []

  defp texts(rel, fields, text),
    do: for({fields, key} <- fields, not is_map_key(text, key), do: bad(at(rel, fields)))

  defp bad(path), do: diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})
end
