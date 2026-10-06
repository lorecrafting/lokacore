defmodule Loka.Core.InvariantsPopulation do
  @moduledoc "Independent full-prior replay of separately targeted population rows."
  alias Loka.Core.Compose

  def holds?(state, ops, result) do
    case Enum.reduce_while(ops, {%{}, MapSet.new()}, &step(&1, &2, state)) do
      false ->
        false

      {rows, changed} ->
        Enum.all?(changed, fn at ->
          Enum.any?(result["changes"], fn c ->
            Compose.key(c["target"]) == at and c["value"] == rows[at]
          end)
        end)
    end
  end

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
        after_row["job_id"] != before["job_id"]

  defp legal?("population.slot", nil, %{
         "generation" => 0,
         "member_id" => nil,
         "replacement_due" => nil
       }),
       do: true

  defp legal?("population.slot", nil, %{
         "generation" => 1,
         "member_id" => id,
         "replacement_due" => nil
       }),
       do: id != nil

  defp legal?("population.slot", %{"generation" => 0}, %{
         "generation" => 1,
         "member_id" => id,
         "replacement_due" => nil
       }),
       do: id != nil

  defp legal?(
         "population.slot",
         %{"generation" => gen, "member_id" => id, "replacement_due" => nil},
         %{"generation" => gen2, "member_id" => id2, "replacement_due" => due}
       ),
       do: gen2 == gen and id2 == id and id != nil and due != nil

  defp legal?(
         "population.slot",
         %{"generation" => gen, "member_id" => id, "replacement_due" => due},
         %{"generation" => gen2, "member_id" => id2, "replacement_due" => nil}
       ),
       do: due != nil and gen2 == gen + 1 and id2 != nil and id2 != id

  defp legal?(_, _, _), do: false
end
