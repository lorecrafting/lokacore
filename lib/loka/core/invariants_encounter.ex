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
       Map.get(state, "containers", %{}), Map.get(state, "population_slots", %{}), %{}}

    case Enum.reduce_while(Enum.with_index(ops), initial, fn {op, index}, rows ->
           replay(op, rows, state, horizon, Enum.take(ops, index))
         end) do
      false ->
        false

      {_, _, _, _, written} ->
        Enum.all?(written, fn {_, expected} -> expected in result["changes"] end)
    end
  end

  defp replay(
         %{"op" => "entity.transfer"} = op,
         {encounters, jobs, containers, slots, written},
         _,
         _,
         _
       ) do
    {:cont,
     {encounters, jobs, Map.put(containers, op["entity_id"], op["destination_id"]), slots,
      written}}
  end

  defp replay(
         %{"op" => "population.slot"} = op,
         {encounters, jobs, containers, slots, written},
         _,
         _,
         _
       ) do
    target = %{"kind" => "population_slot", "plan" => op["plan"], "slot" => op["slot"]}

    {:cont,
     {encounters, jobs, containers, Map.put(slots, Compose.key(target), op["value"]), written}}
  end

  defp replay(
         %{"op" => "encounter." <> _} = op,
         {encounters, jobs, containers, slots, written},
         state,
         horizon,
         preceding
       ) do
    ctx = %{
      state: state,
      containers: containers,
      slots: slots,
      preceding: preceding,
      horizon: horizon
    }

    case encounter(op, encounters, ctx) do
      nil ->
        {:halt, false}

      row ->
        {:cont,
         {Map.put(encounters, op["encounter_id"], row), jobs, containers, slots,
          record(written, op, row)}}
    end
  end

  defp replay(
         %{"op" => "job." <> _} = op,
         {encounters, jobs, containers, slots, written},
         _,
         horizon,
         _
       ) do
    case job(op, jobs[op["job_id"]], horizon) do
      nil ->
        {:halt, false}

      row ->
        {:cont,
         {encounters, Map.put(jobs, op["job_id"], row), containers, slots,
          record(written, op, row)}}
    end
  end

  defp replay(_, rows, _, _, _), do: {:cont, rows}

  defp record(written, op, row) do
    target = Compose.target(op)
    Map.put(written, Compose.key(target), %{"target" => target, "value" => row})
  end

  defp encounter(%{"op" => "encounter.open"} = op, encounters, %{
         state: state,
         containers: containers
       }) do
    if not Map.has_key?(encounters, op["encounter_id"]) and participants_free?(op, encounters) and
         participants?(op, containers, Map.get(state, "known_entities", %{})) and
         admission_shape?(op, state, containers),
       do:
         Map.take(op, ~w(character_id body_id npc_id room_id job_id active_ids next_opponent_id))
         |> Map.merge(%{"status" => "open", "round" => 1})
  end

  defp encounter(op, encounters, ctx) do
    row = encounters[op["encounter_id"]]

    cond do
      not current_encounter?(op, row) ->
        nil

      op["op"] == "encounter.close" ->
        close_row(row)

      row["round"] != op["round"] or op["job_id"] == op["next_job_id"] ->
        nil

      not is_safe_integer(op["round"] + 1) ->
        nil

      row["active_ids"] != nil and
          not advance_pack?(op, row, ctx) ->
        nil

      true ->
        advance_row(row, op)
    end
  end

  defp admission_shape?(op, state, containers) do
    origin = get_in(state, ["created", op["npc_id"], "origin"])

    spec =
      if is_map(origin) and origin["kind"] == "spawned",
        do: get_in(state, ["population_specs", Compose.key(origin["by"])])

    opted = is_map(get_in(spec || %{}, ["plan", "pack"]))
    roster = op["active_ids"]

    roster != nil == opted and
      ((roster == nil and op["next_opponent_id"] == nil) or
         (roster != nil and pack_members?(op, state, containers)))
  end

  defp close_row(row),
    do:
      Map.merge(
        row,
        if(row["active_ids"] == nil,
          do: %{"status" => "closed"},
          else: %{"status" => "closed", "active_ids" => [], "next_opponent_id" => nil}
        )
      )

  defp advance_row(row, op),
    do:
      Map.merge(row, %{"round" => op["round"] + 1, "job_id" => op["next_job_id"]})
      |> Map.merge(
        if(row["active_ids"] == nil,
          do: %{},
          else: Map.take(op, ~w(active_ids npc_id next_opponent_id))
        )
      )

  defp current_encounter?(op, row),
    do:
      row["status"] == "open" and row["job_id"] == op["job_id"] and
        (row["active_ids"] == nil or row == op["expected"])

  defp participants_free?(op, encounters) do
    ids = [op["body_id"] | op["active_ids"] || [op["npc_id"]]]

    Enum.all?(encounters, fn {_, row} ->
      row["status"] != "open" or
        Enum.all?(
          [row["body_id"] | row["active_ids"] || [row["npc_id"]]],
          &(&1 not in ids)
        )
    end)
  end

  defp advance_pack?(op, row, %{state: state} = ctx) do
    ids = op["active_ids"]
    ctx = Map.put(ctx, :due, get_in(state, ["jobs", op["job_id"], "due_time"]))

    is_list(ids) and ids != [] and ids == Enum.sort(Enum.uniq(ids)) and
      Enum.all?(ids, &(&1 in row["active_ids"])) and
      Enum.all?(row["active_ids"], fn id ->
        id in ids ==
          member_remains?(id, row["room_id"], op["writer_group"], ctx)
      end) and rotation_holds?(op, row, state)
  end

  defp rotation_holds?(op, row, state) do
    start = Enum.filter(row["active_ids"], &member_initially_present?(&1, row["room_id"], state))
    cursor = row["next_opponent_id"]

    selected =
      if cursor in start,
        do: cursor,
        else: Enum.find(start, &(&1 > cursor)) || List.first(start)

    ids = op["active_ids"]

    selected != nil and
      op["npc_id"] == if(row["npc_id"] in ids, do: row["npc_id"], else: hd(ids)) and
      op["next_opponent_id"] == (Enum.find(ids, &(&1 > selected)) || hd(ids))
  end

  defp member_initially_present?(id, room, state) do
    origin = get_in(state, ["created", id, "origin"])

    slot =
      if is_map(origin) and origin["kind"] == "spawned",
        do:
          get_in(state, [
            "population_slots",
            Compose.key(%{
              "kind" => "population_slot",
              "plan" => origin["by"],
              "slot" => origin["slot"]
            })
          ])

    get_in(state, ["containers", id]) == room and is_map(slot) and
      slot["member_id"] == id and slot["generation"] == origin["generation"] and
      slot["replacement_due"] == nil
  end

  defp member_remains?(id, room, group, %{state: state} = ctx) do
    origin = get_in(state, ["created", id, "origin"])

    if not is_map(origin) or origin["kind"] != "spawned" or
         not member_initially_present?(id, room, state),
       do: false,
       else: begin_member(id, room, group, origin, ctx)
  end

  defp begin_member(id, room, group, origin, %{state: state, slots: slots} = ctx) do
    slot_key =
      Compose.key(%{
        "kind" => "population_slot",
        "plan" => origin["by"],
        "slot" => origin["slot"]
      })

    before = get_in(state, ["population_slots", slot_key])
    slot = slots[slot_key]

    if current_member?(id, room, origin, slot, ctx),
      do: true,
      else:
        not (flight_proven?(id, group, slot_key, before, slot, ctx) or
               death_proven?(id, group, origin, slot_key, slot, ctx))
  end

  defp current_member?(id, room, origin, slot, %{containers: containers}),
    do:
      containers[id] == room and is_map(slot) and slot["member_id"] == id and
        slot["generation"] == origin["generation"] and slot["replacement_due"] == nil

  defp flight_proven?(id, group, slot_key, before, slot, %{preceding: preceding, due: due}) do
    slot_op = latest_slot(preceding, slot_key)

    departed?(id, group, preceding) and is_map(slot_op) and slot_op["writer_group"] == group and
      is_integer(due) and slot["last_flight_at"] == due and
      before["last_flight_at"] != due and slot["replacement_due"] == nil
  end

  defp departed?(id, group, preceding) do
    move =
      Enum.find(Enum.reverse(preceding), fn op ->
        op["op"] == "entity.transfer" and
          op["entity_id"] == id
      end)

    is_map(move) and move["writer_group"] == group and
      move["destination_id"] != move["source_id"]
  end

  defp death_proven?(id, group, origin, slot_key, slot, %{preceding: preceding}) do
    slot_op = latest_slot(preceding, slot_key)
    hp_ref = Map.merge(origin["by"], %{"kind" => "resource", "key" => "hp"})

    hp =
      Enum.find(Enum.reverse(preceding), fn op ->
        op["op"] == "resource.adjust" and
          op["entity_id"] == id and op["resource"] == hp_ref
      end)

    is_map(slot_op) and slot_op["writer_group"] == group and is_map(hp) and
      hp["writer_group"] == group and slot["replacement_due"] != nil and hp["to"] == 0
  end

  defp latest_slot(preceding, slot_key) do
    Enum.find(Enum.reverse(preceding), fn op ->
      op["op"] == "population.slot" and
        Compose.key(%{"kind" => "population_slot", "plan" => op["plan"], "slot" => op["slot"]}) ==
          slot_key
    end)
  end

  defp pack_members?(op, state, containers) do
    ids = op["active_ids"]
    origin = get_in(state, ["created", op["npc_id"], "origin"])

    spec =
      if is_map(origin) and origin["kind"] == "spawned",
        do: get_in(state, ["population_specs", Compose.key(origin["by"])])

    is_map(origin) and origin["kind"] == "spawned" and origin["role"] == "hound" and
      is_map(spec) and is_map(get_in(spec, ["plan", "pack"])) and
      roster_shape?(ids, op, spec["cap"]) and
      Enum.all?(ids, &pack_member?(&1, op["room_id"], origin["by"], state, containers))
  end

  defp roster_shape?(ids, op, cap) do
    is_list(ids) and ids != [] and length(ids) <= 64 and is_integer(cap) and
      length(ids) <= cap and ids == Enum.sort(Enum.uniq(ids)) and
      op["npc_id"] in ids and op["next_opponent_id"] == op["npc_id"]
  end

  defp pack_member?(id, room, plan, state, containers) do
    member = get_in(state, ["created", id, "origin"])

    get_in(state, ["known_entities", id, "kind"]) == "npc" and containers[id] == room and
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
        Compose.key(%{
          "kind" => "population_slot",
          "plan" => member["by"],
          "slot" => member["slot"]
        })
      ])

    is_map(slot) and slot["member_id"] == id and slot["generation"] == member["generation"] and
      slot["replacement_due"] == nil
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
