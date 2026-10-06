defmodule Loka.Core.InvariantsPack do
  @moduledoc "Independent complete pack admission and round-membership proof."
  alias Loka.Core.Compose

  def advance?(op, row, %{state: state} = ctx) do
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

  def members?(op, state, containers) do
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
end
