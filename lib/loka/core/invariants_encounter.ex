defmodule Loka.Core.InvariantsEncounter do
  @moduledoc "Independent encounter/job guard and final-row proof; never invokes composition."
  alias Loka.Core.{Compose, InvariantsPack}
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
          not InvariantsPack.advance?(op, row, ctx) ->
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
         (roster != nil and InvariantsPack.members?(op, state, containers)))
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

  defp participants?(op, containers, known) do
    get_in(known, [op["body_id"], "kind"]) == "body" and
      get_in(known, [op["body_id"], "owner_id"]) == op["character_id"] and
      get_in(known, [op["npc_id"], "kind"]) == "npc" and
      get_in(known, [op["room_id"], "kind"]) == "room" and
      op["body_id"] != op["npc_id"] and containers[op["body_id"]] == op["room_id"] and
      containers[op["npc_id"]] == op["room_id"]
  end

  defp job(%{"op" => "job.schedule"} = op, row, horizon) do
    if row == nil and op["due_time"] > horizon and binding?(op),
      do:
        Map.take(
          op,
          ~w(job due_time encounter_id quest_instance_id actor_id water_generation water_body_id crow_member_id crow_generation crow_phase)
        )
        |> Map.put("status", "pending")
  end

  defp job(op, row, horizon) do
    cond do
      row["status"] != "pending" ->
        nil

      op["op"] == "job.cancel" and cancel_binding?(op, row) ->
        Map.put(row, "status", "cancelled")

      op["op"] == "job.complete" and row["due_time"] <= horizon ->
        Map.put(row, "status", "completed")

      true ->
        nil
    end
  end

  defp cancel_binding?(op, row) do
    cond do
      op["crow_member_id"] != nil ->
        row["crow_member_id"] == op["crow_member_id"] and
          row["crow_generation"] == op["crow_generation"] and op["encounter_id"] == nil

      op["water_generation"] != nil ->
        row["water_generation"] == op["water_generation"] and
          row["actor_id"] == op["actor_id"] and op["encounter_id"] == nil

      true ->
        op["encounter_id"] != nil and row["encounter_id"] == op["encounter_id"]
    end
  end

  # Independent permitted binding tuples; no call to the job composer.
  defp binding?(op) do
    present =
      Enum.filter(
        ~w(encounter_id quest_instance_id actor_id water_generation water_body_id crow_member_id crow_generation crow_phase),
        &Map.has_key?(op, &1)
      )

    case present do
      [] ->
        true

      ["encounter_id"] ->
        true

      ["quest_instance_id", "actor_id"] ->
        get_in(op, ["job", "kind"]) == "quest"

      ["actor_id", "water_generation", "water_body_id"] ->
        get_in(op, ["job", "kind"]) == "room"

      ["crow_member_id", "crow_generation", "crow_phase"] ->
        get_in(op, ["job", "kind"]) == "population_bundle" and
          op["crow_phase"] in ~w(acquire leg return)

      _ ->
        false
    end
  end
end
