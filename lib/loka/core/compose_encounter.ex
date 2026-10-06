defmodule Loka.Core.ComposeEncounter do
  @moduledoc "Portable encounter and bound-job lifecycle over composition's current rows."
  alias Loka.Core.Int

  @spec open(map(), term(), map(), term(), term(), map()) :: {:ok, map()} | {:error, String.t()}
  def open(op, row, state, body_room, npc_room, encounters) do
    known = Map.get(state, "known_entities", %{})
    participants = [op["body_id"], op["npc_id"]]

    taken =
      Enum.any?(encounters, fn {_, r} ->
        r["status"] == "open" and (r["body_id"] in participants or r["npc_id"] in participants)
      end)

    valid = row == nil and participants?(op, known, body_room, npc_room) and not taken

    if valid,
      do:
        {:ok,
         Map.take(op, ~w(character_id body_id npc_id room_id job_id))
         |> Map.merge(%{"status" => "open", "round" => 1})},
      else: {:error, "precondition_failed"}
  end

  defp participants?(op, known, body_room, npc_room) do
    get_in(known, [op["body_id"], "kind"]) == "body" and
      get_in(known, [op["body_id"], "owner_id"]) == op["character_id"] and
      get_in(known, [op["npc_id"], "kind"]) == "npc" and
      get_in(known, [op["room_id"], "kind"]) == "room" and
      op["body_id"] != op["npc_id"] and body_room == op["room_id"] and
      npc_room == op["room_id"]
  end

  @spec change(map(), term()) :: {:ok, map()} | {:error, String.t()}
  def change(op, row) do
    cond do
      row["status"] != "open" or row["job_id"] != op["job_id"] ->
        {:error, "precondition_failed"}

      op["op"] == "encounter.close" ->
        {:ok, Map.put(row, "status", "closed")}

      row["round"] != op["round"] or op["job_id"] == op["next_job_id"] ->
        {:error, "precondition_failed"}

      true ->
        advance(op, row)
    end
  end

  defp advance(op, row) do
    case Int.add(op["round"], 1) do
      {:ok, next} -> {:ok, Map.merge(row, %{"round" => next, "job_id" => op["next_job_id"]})}
      {:error, :integer_overflow} -> {:error, "precondition_failed"}
    end
  end

  @spec job(map(), term(), integer()) :: {:ok, map()} | {:error, String.t()}
  def job(%{"op" => "job.schedule"} = op, row, horizon) do
    cond do
      row != nil ->
        {:error, "precondition_failed"}

      op["due_time"] <= horizon ->
        {:error, "nonfuture_job"}

      not binding?(op) ->
        {:error, "precondition_failed"}

      true ->
        {:ok,
         Map.take(
           op,
           ~w(job due_time encounter_id quest_instance_id actor_id water_generation water_body_id)
         )
         |> Map.put("status", "pending")}
    end
  end

  def job(op, row, horizon) do
    cancel = op["op"] == "job.cancel"

    valid =
      if cancel,
        do:
          if(op["water_generation"],
            do:
              row["water_generation"] == op["water_generation"] and
                row["actor_id"] == op["actor_id"] and op["encounter_id"] == nil,
            else: op["encounter_id"] != nil and row["encounter_id"] == op["encounter_id"]
          ),
        else: row["due_time"] <= horizon

    if row["status"] == "pending" and valid,
      do: {:ok, Map.put(row, "status", if(cancel, do: "cancelled", else: "completed"))},
      else: {:error, "precondition_failed"}
  end

  defp binding?(op) do
    quest = op["quest_instance_id"] != nil
    water = op["water_generation"] != nil
    actor = op["actor_id"] != nil
    body = op["water_body_id"] != nil

    (quest or water) == actor and water == body and
      (not quest or (get_in(op, ["job", "kind"]) == "quest" and op["encounter_id"] == nil)) and
      (not water or
         (get_in(op, ["job", "kind"]) == "room" and not quest and op["encounter_id"] == nil))
  end
end
