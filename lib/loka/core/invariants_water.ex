defmodule Loka.Core.InvariantsWater do
  @moduledoc "Independent water occupancy replay and final-row proof."
  def holds?(s, ops, result) do
    start = {s["water"] || %{}, s["containers"] || %{}, MapSet.new()}

    case Enum.reduce_while(ops, start, &replay(&1, &2, s)) do
      false ->
        false

      {rows, _, written} ->
        Enum.all?(written, fn a ->
          Enum.any?(
            result["changes"],
            &(&1["target"] == %{"kind" => "water", "actor_id" => a} and &1["value"] == rows[a])
          )
        end)
    end
  end

  defp replay(%{"op" => "entity.transfer"} = op, {rows, containers, written}, _),
    do: {:cont, {rows, Map.put(containers, op["entity_id"], op["destination_id"]), written}}

  defp replay(%{"op" => "water.transition"} = op, {rows, containers, written}, s) do
    prior = rows[op["actor_id"]]
    next = op["value"]
    known = s["known_entities"] || %{}

    if identity?(op, prior, next, known) and lifecycle?(prior, next, s, known, containers),
      do:
        {:cont,
         {Map.put(rows, op["actor_id"], next), containers, MapSet.put(written, op["actor_id"])}},
      else: {:halt, false}
  end

  defp replay(_, acc, _), do: {:cont, acc}

  defp identity?(op, prior, next, known) do
    body = next["body_id"]

    prior == op["expected"] and next["generation"] == ((prior || %{})["generation"] || 0) + 1 and
      get_in(known, [body, "owner_id"]) == op["actor_id"] and
      get_in(known, [body, "kind"]) == "body" and
      (prior == nil or prior["body_id"] == body)
  end

  defp lifecycle?(prior, next, s, known, containers) do
    if next["room_id"] == nil,
      do: surface?(prior, next),
      else: bottom?(prior, next, s, known, containers)
  end

  defp surface?(prior, next) do
    prior != nil and prior["room_id"] != nil and
      Enum.all?(~w(entered_at deadline job_id), &(next[&1] == nil))
  end

  defp bottom?(prior, next, s, known, containers) do
    (prior == nil or prior["room_id"] == nil) and
      get_in(known, [next["room_id"], "kind"]) == "room" and
      containers[next["body_id"]] == next["room_id"] and next["entered_at"] == s["clock"] and
      next["deadline"] > next["entered_at"] and next["job_id"] != nil
  end
end
