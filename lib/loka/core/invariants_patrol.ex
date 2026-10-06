defmodule Loka.Core.InvariantsPatrol do
  @moduledoc "Independent ordered patrol lifecycle replay and final-row proof."
  def holds?(state, ops, result) do
    case Enum.reduce_while(ops, %{}, &replay(&1, &2, state)) do
      false ->
        false

      written ->
        Enum.all?(written, fn {q, value} ->
          Enum.any?(
            result["changes"],
            &(&1["target"] == %{"kind" => "patrol", "quest_instance_id" => q} and
                &1["value"] == value)
          )
        end)
    end
  end

  defp replay(%{"op" => "patrol.transition"} = op, rows, state) do
    before =
      Map.get_lazy(rows, op["quest_instance_id"], fn ->
        get_in(state, ["patrols", op["quest_instance_id"]])
      end)

    after_row = op["value"]

    if before == op["expected"] and after_row["quest_instance_id"] == op["quest_instance_id"] and
         Enum.uniq(after_row["credit"]) == after_row["credit"] and valid?(before, after_row),
       do: {:cont, Map.put(rows, op["quest_instance_id"], after_row)},
       else: {:halt, false}
  end

  defp replay(_, rows, _), do: {:cont, rows}
  defp valid?(nil, after_row), do: after_row["status"] == "together" and after_row["credit"] == []

  defp valid?(before, after_row) do
    edge = {before["status"], after_row["status"]}
    fatal = edge in [{"together", "failed"}, {"awaiting", "failed"}, {"paused", "failed"}]
    restart = edge == {"failed", "together"}
    join = edge in [{"awaiting", "together"}, {"awaiting", "completed"}]
    depart = edge == {"together", "awaiting"}
    identity = ~w(kind actor_id body_id npc_id quest_instance_id continuation_id choice_id)

    Map.take(before, identity) == Map.take(after_row, identity) and
      (fatal or restart or join or depart or
         edge in [{"together", "paused"}, {"awaiting", "paused"}, {"paused", "together"}]) and
      if(restart,
        do: before["attempt_id"] != after_row["attempt_id"],
        else: before["attempt_id"] == after_row["attempt_id"]
      ) and
      if(depart,
        do: before["cursor"] != after_row["cursor"],
        else: before["cursor"] == after_row["cursor"]
      ) and
      cond do
        fatal or restart ->
          after_row["credit"] == []

        join ->
          before["credit"] == after_row["credit"] or
            (length(after_row["credit"]) == length(before["credit"]) + 1 and
               Enum.drop(after_row["credit"], -1) == before["credit"])

        true ->
          before["credit"] == after_row["credit"]
      end
  end
end
