defmodule Loka.Core.ComposeExpedition do
  @moduledoc "Portable bounded expedition lifecycle; movement and death own causal evidence."
  @identity ~w(kind actor_id body_id quest_instance_id)

  def transition(op, before) do
    after_row = op["value"]

    if before == op["expected"] and after_row["quest_instance_id"] == op["quest_instance_id"] and
         legal?(before, after_row),
       do: {:ok, after_row},
       else: {:error, "precondition_failed"}
  end

  defp legal?(nil, after_row), do: reset?(after_row) and after_row["status"] == "active"

  defp legal?(before, after_row),
    do: Map.take(before, @identity) == Map.take(after_row, @identity) and step?(before, after_row)

  defp step?(%{"status" => "failed"} = before, %{"status" => "active"} = after_row),
    do: before["attempt_id"] != after_row["attempt_id"] and reset?(after_row)

  defp step?(%{"status" => "active"} = before, %{"status" => "failed"} = after_row),
    do: before["attempt_id"] == after_row["attempt_id"] and reset?(after_row)

  defp step?(%{"status" => "active"} = before, %{"status" => status} = after_row)
       when status in ~w(active completed),
       do:
         before["attempt_id"] == after_row["attempt_id"] and
           (advanced?(before, after_row) or sheltered?(before, after_row))

  defp step?(_, _), do: false

  defp reset?(row), do: row["cursor"] == 0 and row["sheltered"] == false

  defp advanced?(before, after_row),
    do:
      before["sheltered"] == after_row["sheltered"] and
        after_row["cursor"] == before["cursor"] + 1

  defp sheltered?(before, after_row),
    do:
      after_row["status"] == "active" and before["cursor"] == after_row["cursor"] and
        before["sheltered"] == false and after_row["sheltered"] == true
end
