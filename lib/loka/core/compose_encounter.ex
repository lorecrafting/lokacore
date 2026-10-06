defmodule Loka.Core.ComposeEncounter do
  @moduledoc "Portable encounter and bound-job lifecycle over composition's current rows."
  alias Loka.Core.Int
  alias Loka.Core.Canonical

  @spec open(map(), term(), map(), term(), term(), map()) :: {:ok, map()} | {:error, String.t()}
  def open(op, row, state, body_room, npc_room, encounters) do
    known = Map.get(state, "known_entities", %{})

    valid =
      row == nil and participants?(op, known, body_room, npc_room) and
        participants_free?(op, encounters) and admission_shape?(op, state)

    if valid,
      do:
        {:ok,
         Map.take(op, ~w(character_id body_id npc_id room_id job_id active_ids next_opponent_id))
         |> Map.merge(%{"status" => "open", "round" => 1})},
      else: {:error, "precondition_failed"}
  end

  defp admission_shape?(op, state) do
    origin = get_in(state, ["created", op["npc_id"], "origin"])

    spec =
      if is_map(origin) and origin["kind"] == "spawned",
        do: get_in(state, ["population_specs", key(origin["by"])])

    opted = is_map(get_in(spec || %{}, ["plan", "pack"]))
    roster = op["active_ids"]

    roster != nil == opted and
      ((roster == nil and op["next_opponent_id"] == nil) or
         (roster != nil and pack_members?(op, state)))
  end

  defp participants_free?(op, encounters) do
    ids = [op["body_id"] | op["active_ids"] || [op["npc_id"]]]

    Enum.all?(encounters, fn {_, row} ->
      row["status"] != "open" or
        Enum.all?([row["body_id"] | row["active_ids"] || [row["npc_id"]]], &(&1 not in ids))
    end)
  end

  defp pack_members?(op, state) do
    ids = op["active_ids"]
    origin = get_in(state, ["created", op["npc_id"], "origin"])

    spec =
      if is_map(origin) and origin["kind"] == "spawned",
        do: get_in(state, ["population_specs", key(origin["by"])])

    is_map(origin) and origin["kind"] == "spawned" and origin["role"] == "hound" and
      is_map(spec) and is_map(get_in(spec, ["plan", "pack"])) and
      roster_shape?(ids, op, spec["cap"]) and
      Enum.all?(ids, &pack_member?(&1, op["room_id"], origin["by"], state))
  end

  defp roster_shape?(ids, op, cap) do
    is_list(ids) and ids != [] and length(ids) <= 64 and is_integer(cap) and
      length(ids) <= cap and ids == Enum.sort(Enum.uniq(ids)) and
      op["npc_id"] in ids and op["next_opponent_id"] == op["npc_id"]
  end

  defp pack_member?(id, room, plan, state) do
    member = get_in(state, ["created", id, "origin"])

    get_in(state, ["known_entities", id, "kind"]) == "npc" and
      get_in(state, ["containers", id]) == room and
      member_provenance?(member, id, plan) and slot_membership?(member, id, state)
  end

  defp member_provenance?(member, id, plan),
    do:
      is_map(member) and member["kind"] == "spawned" and member["role"] == "hound" and
        member["member_id"] == id and member["by"] == plan

  defp slot_membership?(member, id, state) do
    slot =
      get_in(state, [
        "population_slots",
        key(%{
          "kind" => "population_slot",
          "plan" => member["by"],
          "slot" => member["slot"]
        })
      ])

    is_map(slot) and slot["member_id"] == id and slot["generation"] == member["generation"] and
      slot["replacement_due"] == nil
  end

  defp key(value) do
    {:ok, text} = Canonical.encode(value)
    text
  end

  defp participants?(op, known, body_room, npc_room) do
    get_in(known, [op["body_id"], "kind"]) == "body" and
      get_in(known, [op["body_id"], "owner_id"]) == op["character_id"] and
      get_in(known, [op["npc_id"], "kind"]) == "npc" and
      get_in(known, [op["room_id"], "kind"]) == "room" and
      op["body_id"] != op["npc_id"] and body_room == op["room_id"] and
      npc_room == op["room_id"]
  end

  @spec change(map(), term(), (String.t(), String.t() -> boolean()), (String.t(), String.t() ->
                                                                        boolean())) ::
          {:ok, map()} | {:error, String.t()}
  def change(op, row, present?, initially_present?) do
    cond do
      not current_encounter?(op, row) ->
        {:error, "precondition_failed"}

      op["op"] == "encounter.close" ->
        {:ok,
         Map.merge(
           row,
           if(row["active_ids"] == nil,
             do: %{"status" => "closed"},
             else: %{"status" => "closed", "active_ids" => [], "next_opponent_id" => nil}
           )
         )}

      row["round"] != op["round"] or op["job_id"] == op["next_job_id"] ->
        {:error, "precondition_failed"}

      true ->
        advance(op, row, present?, initially_present?)
    end
  end

  defp current_encounter?(op, row),
    do:
      row["status"] == "open" and row["job_id"] == op["job_id"] and
        (row["active_ids"] == nil or row == op["expected"])

  defp advance(op, row, present?, initially_present?) do
    valid = row["active_ids"] == nil or advance_pack?(op, row, present?, initially_present?)

    case {valid, Int.add(op["round"], 1)} do
      {true, {:ok, next}} ->
        {:ok,
         Map.merge(row, %{"round" => next, "job_id" => op["next_job_id"]})
         |> Map.merge(
           if(row["active_ids"] == nil,
             do: %{},
             else: Map.take(op, ~w(active_ids npc_id next_opponent_id))
           )
         )}

      _ ->
        {:error, "precondition_failed"}
    end
  end

  defp advance_pack?(op, row, present?, initially_present?) do
    ids = op["active_ids"]

    is_list(ids) and ids != [] and ids == Enum.sort(Enum.uniq(ids)) and
      Enum.all?(ids, &(&1 in row["active_ids"])) and op["npc_id"] in ids and
      op["next_opponent_id"] in ids and
      Enum.all?(row["active_ids"], fn id -> id in ids == present?.(id, row["room_id"]) end) and
      rotation?(op, row, ids, initially_present?)
  end

  defp rotation?(op, row, ids, initially_present?) do
    start = Enum.filter(row["active_ids"], &initially_present?.(&1, row["room_id"]))
    cursor = row["next_opponent_id"]

    selected =
      if cursor in start,
        do: cursor,
        else: Enum.find(start, &(&1 > cursor)) || List.first(start)

    selected != nil and
      op["npc_id"] == if(row["npc_id"] in ids, do: row["npc_id"], else: hd(ids)) and
      op["next_opponent_id"] == (Enum.find(ids, &(&1 > selected)) || hd(ids))
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
           ~w(job due_time encounter_id quest_instance_id actor_id water_generation water_body_id crow_member_id crow_generation crow_phase)
         )
         |> Map.put("status", "pending")}
    end
  end

  # ponytail: keep exact binding forms at one cancel boundary. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  def job(op, row, horizon) do
    cancel = op["op"] == "job.cancel"

    valid =
      cond do
        not cancel ->
          row["due_time"] <= horizon

        op["crow_member_id"] != nil ->
          row["crow_member_id"] == op["crow_member_id"] and
            row["crow_generation"] == op["crow_generation"] and
            op["encounter_id"] == nil and op["water_generation"] == nil

        op["water_generation"] != nil ->
          row["water_generation"] == op["water_generation"] and
            row["actor_id"] == op["actor_id"] and op["encounter_id"] == nil

        true ->
          op["encounter_id"] != nil and row["encounter_id"] == op["encounter_id"]
      end

    if row["status"] == "pending" and valid,
      do: {:ok, Map.put(row, "status", if(cancel, do: "cancelled", else: "completed"))},
      else: {:error, "precondition_failed"}
  end

  # ponytail: one finite job binding admission. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  defp binding?(op) do
    if op["crow_member_id"] != nil or op["crow_generation"] != nil or op["crow_phase"] != nil do
      op["crow_member_id"] != nil and op["crow_generation"] != nil and
        op["crow_phase"] in ~w(acquire leg return) and
        get_in(op, ["job", "kind"]) == "population_bundle" and
        Enum.all?(
          ~w(encounter_id quest_instance_id water_generation water_body_id actor_id),
          &(op[&1] == nil)
        )
    else
      case {op["quest_instance_id"] != nil, op["water_generation"] != nil, op["actor_id"] != nil,
            op["water_body_id"] != nil} do
        {false, false, false, false} ->
          true

        {true, false, true, false} ->
          get_in(op, ["job", "kind"]) == "quest" and op["encounter_id"] == nil

        {false, true, true, true} ->
          get_in(op, ["job", "kind"]) == "room" and op["encounter_id"] == nil

        _ ->
          false
      end
    end
  end
end
