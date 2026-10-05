defmodule Loka.Core.InvariantsEncounter do
  @moduledoc "Independent encounter/job guard and final-row proof; never invokes composition."
  alias Loka.Core.Compose
  import Loka.Core.Canonical, only: [is_safe_integer: 1]

  @spec holds?(map(), [map()], map()) :: boolean()
  def holds?(state, ops, result) do
    horizon =
      Enum.reduce(ops, state["clock"], fn op, t ->
        if op["op"] == "time.advance", do: op["to"], else: t
      end)

    initial =
      {Map.get(state, "encounters", %{}), Map.get(state, "jobs", %{}),
       Map.get(state, "containers", %{}), %{}}

    case Enum.reduce_while(ops, initial, &replay(&1, &2, state, horizon)) do
      false ->
        false

      {_, _, _, written} ->
        Enum.all?(written, fn {_, expected} -> expected in result["changes"] end)
    end
  end

  defp replay(%{"op" => "entity.transfer"} = op, {encounters, jobs, containers, written}, _, _) do
    {:cont,
     {encounters, jobs, Map.put(containers, op["entity_id"], op["destination_id"]), written}}
  end

  defp replay(
         %{"op" => "encounter." <> _} = op,
         {encounters, jobs, containers, written},
         state,
         _
       ) do
    case encounter(op, encounters, containers, Map.get(state, "known_entities", %{})) do
      nil ->
        {:halt, false}

      row ->
        {:cont,
         {Map.put(encounters, op["encounter_id"], row), jobs, containers,
          record(written, op, row)}}
    end
  end

  defp replay(%{"op" => "job." <> _} = op, {encounters, jobs, containers, written}, _, horizon) do
    case job(op, jobs[op["job_id"]], horizon) do
      nil ->
        {:halt, false}

      row ->
        {:cont,
         {encounters, Map.put(jobs, op["job_id"], row), containers, record(written, op, row)}}
    end
  end

  defp replay(_, rows, _, _), do: {:cont, rows}

  defp record(written, op, row) do
    target = Compose.target(op)
    Map.put(written, Compose.key(target), %{"target" => target, "value" => row})
  end

  defp encounter(%{"op" => "encounter.open"} = op, encounters, containers, known) do
    if not Map.has_key?(encounters, op["encounter_id"]) and participants_free?(op, encounters) and
         participants?(op, containers, known),
       do:
         Map.take(op, ~w(character_id body_id npc_id room_id job_id))
         |> Map.merge(%{"status" => "open", "round" => 1})
  end

  defp encounter(op, encounters, _, _) do
    row = encounters[op["encounter_id"]]

    cond do
      row["status"] != "open" or row["job_id"] != op["job_id"] -> nil
      op["op"] == "encounter.close" -> Map.put(row, "status", "closed")
      row["round"] != op["round"] or op["job_id"] == op["next_job_id"] -> nil
      not is_safe_integer(op["round"] + 1) -> nil
      true -> Map.merge(row, %{"round" => op["round"] + 1, "job_id" => op["next_job_id"]})
    end
  end

  defp participants_free?(op, encounters) do
    Enum.all?(encounters, fn {_, row} ->
      row["status"] != "open" or
        (row["body_id"] not in [op["body_id"], op["npc_id"]] and
           row["npc_id"] not in [op["body_id"], op["npc_id"]])
    end)
  end

  defp participants?(op, containers, known) do
    get_in(known, [op["body_id"], "kind"]) == "body" and
      get_in(known, [op["body_id"], "owner_id"]) == op["character_id"] and
      get_in(known, [op["npc_id"], "kind"]) == "npc" and
      get_in(known, [op["room_id"], "kind"]) == "room" and
      op["body_id"] != op["npc_id"] and containers[op["body_id"]] == op["room_id"] and
      containers[op["npc_id"]] == op["room_id"]
  end

  defp job(%{"op" => "job.schedule"} = op, row, horizon) do
    if row == nil and op["due_time"] > horizon,
      do: Map.take(op, ~w(job due_time encounter_id)) |> Map.put("status", "pending")
  end

  defp job(op, row, horizon) do
    cond do
      row["status"] != "pending" ->
        nil

      op["op"] == "job.cancel" and row["encounter_id"] == op["encounter_id"] ->
        Map.put(row, "status", "cancelled")

      op["op"] == "job.complete" and row["due_time"] <= horizon ->
        Map.put(row, "status", "completed")

      true ->
        nil
    end
  end
end
