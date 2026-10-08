defmodule Loka.Core.InvariantsPopulation do
  @moduledoc "Independent full-prior replay of separately targeted population rows."
  alias Loka.Core.Compose

  def holds?(state, ops, result) do
    case Enum.reduce_while(ops, {%{}, MapSet.new()}, &step(&1, &2, state)) do
      false ->
        false

      {rows, changed} ->
        Enum.all?(changed, &written?(result, &1, rows[&1])) and crows_hold?(state, ops, result)
    end
  end

  defp crows_hold?(state, ops, result) do
    case Enum.reduce_while(ops, %{}, &crow_step(&1, &2, state)) do
      false -> false
      rows -> Enum.all?(rows, fn {at, row} -> written?(result, at, row) end)
    end
  end

  defp crow_step(%{"op" => "crow.transition"} = op, rows, state) do
    at = Compose.key(Compose.target(op))
    before = Map.get(rows, at, get_in(state, ["crows", at]))
    after_row = op["value"]

    if before == op["expected"] and crow_legal?(before, after_row),
      do: {:cont, Map.put(rows, at, after_row)},
      else: {:halt, false}
  end

  defp crow_step(_, rows, _), do: {:cont, rows}

  defp crow_legal?(before, after_row) do
    phase = after_row["phase"]

    legal = %{
      "idle" => ~w(acquire),
      "acquire" => ~w(leg return idle paused_return),
      "leg" => ~w(leg return idle paused_return),
      "return" => ~w(return idle paused_return),
      "paused_return" => ~w(return idle)
    }

    if(before == nil, do: phase == "acquire", else: phase in Map.get(legal, before["phase"], [])) and
      (before == nil or before["phase"] == "idle" or
         (before["member_id"] == after_row["member_id"] and
            before["generation"] == after_row["generation"])) and
      crow_shape?(phase, after_row)
  end

  defp crow_shape?("idle", row),
    do: Enum.all?(~w(item_id nest_id job_id drop_event_id encounter_id), &(row[&1] == nil))

  defp crow_shape?("paused_return", row),
    do: row["item_id"] == nil and row["job_id"] == nil and row["encounter_id"] != nil

  defp crow_shape?(phase, row) when phase in ~w(acquire leg return),
    do:
      row["job_id"] != nil and row["nest_id"] != nil and row["drop_event_id"] != nil and
        row["encounter_id"] == nil

  defp crow_shape?(_, _), do: false

  defp written?(result, at, row),
    do: Enum.any?(result["changes"], &(Compose.key(&1["target"]) == at and &1["value"] == row))

  defp step(%{"op" => kind} = op, {rows, changed}, state)
       when kind in ~w(population.control population.slot) do
    target = Compose.target(op)
    at = Compose.key(target)

    before =
      if Map.has_key?(rows, at),
        do: rows[at],
        else: initial(state, kind, op, at)

    after_row = op["value"]

    if before == op["expected"] and legal?(kind, before, after_row),
      do: {:cont, {Map.put(rows, at, after_row), MapSet.put(changed, at)}},
      else: {:halt, false}
  end

  defp step(_, acc, _), do: {:cont, acc}

  defp initial(state, "population.control", op, _),
    do: get_in(state, ["population_plans", Compose.key(op["plan"])])

  defp initial(state, "population.slot", _, at),
    do: get_in(state, ["population_slots", at])

  defp legal?("population.control", nil, _), do: true

  defp legal?("population.control", before, after_row),
    do:
      after_row["next_wander_due"] >= before["next_wander_due"] and
        ((after_row["job_id"] != before["job_id"] and
            after_row["suppression"] == before["suppression"]) or
           (after_row["next_wander_due"] == before["next_wander_due"] and
              suppression_change?(before["suppression"], after_row["suppression"])))

  defp legal?(
         "population.slot",
         nil,
         %{
           "generation" => 0,
           "member_id" => nil,
           "replacement_due" => nil
         } = next
       ),
       do: next["last_flight_at"] == nil

  defp legal?(
         "population.slot",
         nil,
         %{
           "generation" => 1,
           "member_id" => id,
           "replacement_due" => nil
         } = next
       ),
       do: id != nil and next["last_flight_at"] == nil

  defp legal?(
         "population.slot",
         %{"generation" => 0},
         %{
           "generation" => 1,
           "member_id" => id,
           "replacement_due" => nil
         } = next
       ),
       do: id != nil and next["last_flight_at"] == nil

  defp legal?(
         "population.slot",
         %{"generation" => gen, "member_id" => id, "replacement_due" => nil} = before,
         %{"generation" => gen2, "member_id" => id2, "replacement_due" => due} = after_row
       )
       when not is_nil(due),
       do:
         gen2 == gen and id2 == id and id != nil and
           after_row["last_flight_at"] == before["last_flight_at"]

  defp legal?(
         "population.slot",
         %{"generation" => gen, "member_id" => id, "replacement_due" => nil} = before,
         %{"generation" => gen, "member_id" => id, "replacement_due" => nil} = after_row
       ),
       do:
         id != nil and is_integer(after_row["last_flight_at"]) and
           after_row["last_flight_at"] != before["last_flight_at"]

  defp legal?(
         "population.slot",
         %{"generation" => gen, "member_id" => id, "replacement_due" => due},
         %{"generation" => gen2, "member_id" => id2, "replacement_due" => nil} = after_row
       ),
       do:
         due != nil and gen2 == gen + 1 and id2 != nil and id2 != id and
           after_row["last_flight_at"] == nil

  defp legal?(_, _, _), do: false
  defp suppression_change?(_, nil), do: false

  defp suppression_change?(nil, after_row),
    do:
      after_row["generation"] == 1 and after_row["ends_at"] != nil and
        after_row["job_id"] != nil

  defp suppression_change?(%{"ends_at" => nil} = before, after_row),
    do:
      after_row["generation"] == before["generation"] + 1 and
        after_row["ends_at"] != nil and after_row["job_id"] != nil

  defp suppression_change?(before, after_row),
    do:
      after_row["generation"] == before["generation"] and
        after_row["cause_event_id"] == before["cause_event_id"] and
        after_row["ends_at"] == nil and after_row["job_id"] == nil
end
