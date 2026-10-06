defmodule Loka.Core.ComposePack do
  @moduledoc "Complete pack-member proof for portable encounter composition."
  alias Loka.Core.ComposeTarget

  def remains?(id, room, group, due, {state, _, _} = ctx) do
    origin = get_in(state, ["created", id, "origin"])

    if is_map(origin) and origin["kind"] == "spawned" and
         initially_present?(id, room, state),
       do: begin_pack_member(id, room, group, due, origin, ctx),
       else: false
  end

  def initially_present?(id, room, state) do
    origin = get_in(state, ["created", id, "origin"])

    if is_map(origin) and origin["kind"] == "spawned" do
      target = %{"kind" => "population_slot", "plan" => origin["by"], "slot" => origin["slot"]}
      slot = get_in(state, ["population_slots", ComposeTarget.key(target)])

      get_in(state, ["containers", id]) == room and is_map(slot) and
        slot["member_id"] == id and slot["generation"] == origin["generation"] and
        slot["replacement_due"] == nil
    else
      false
    end
  end

  defp begin_pack_member(id, room, group, due, origin, {_, _, overlay} = ctx) do
    target = %{"kind" => "population_slot", "plan" => origin["by"], "slot" => origin["slot"]}
    slot = read(target, ctx)

    if current_pack_member?(id, room, origin, slot, ctx),
      do: true,
      else:
        not (flight_proven?(id, group, due, target, ctx) or
               death_proven?(id, group, origin, target, slot, overlay))
  end

  defp current_pack_member?(id, room, origin, slot, ctx),
    do:
      read(containment(id), ctx) == room and is_map(slot) and
        slot["member_id"] == id and slot["generation"] == origin["generation"] and
        slot["replacement_due"] == nil

  defp flight_proven?(id, group, due, target, {state, _, overlay} = ctx) do
    before = get_in(state, ["population_slots", ComposeTarget.key(target)])
    slot = read(target, ctx)
    {slot_group, _, _} = overlay[ComposeTarget.key(target)] || {nil, nil, nil}

    flight_move?(id, group, ctx) and slot_group == group and
      is_integer(due) and slot["last_flight_at"] == due and
      before["last_flight_at"] != due and slot["replacement_due"] == nil
  end

  defp flight_move?(id, group, {state, _, overlay} = ctx) do
    {move_group, _, _} = overlay[ComposeTarget.key(containment(id))] || {nil, nil, nil}
    move_group == group and read(containment(id), ctx) != get_in(state, ["containers", id])
  end

  defp death_proven?(id, group, origin, target, slot, overlay) do
    {slot_group, _, _} = overlay[ComposeTarget.key(target)] || {nil, nil, nil}

    hp_target = %{
      "kind" => "resource",
      "entity_id" => id,
      "resource" => Map.merge(origin["by"], %{"kind" => "resource", "key" => "hp"})
    }

    {hp_group, _, hp} = overlay[ComposeTarget.key(hp_target)] || {nil, nil, nil}

    slot_group == group and hp_group == group and slot["replacement_due"] != nil and
      hp["value"] == 0
  end

  defp read(target, {state, _, overlay}) do
    case Map.fetch(overlay, ComposeTarget.key(target)) do
      {:ok, {_, _, value}} ->
        value

      :error ->
        case target do
          %{"kind" => "containment", "entity_id" => id} ->
            get_in(state, ["containers", id])

          %{"kind" => "population_slot"} ->
            get_in(state, ["population_slots", ComposeTarget.key(target)])
        end
    end
  end

  defp containment(id), do: %{"kind" => "containment", "entity_id" => id}
end
