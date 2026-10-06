defmodule Loka.Core.ComposeExpedition do
  @moduledoc "Portable bounded expedition lifecycle; movement and death own causal evidence."
  @identity ~w(kind actor_id body_id quest_instance_id)

  def transition(op, before) do
    after_row = op["value"]

    legal =
      cond do
        before == nil ->
          after_row["status"] == "active" and after_row["cursor"] == 0 and
            after_row["sheltered"] == false

        Map.take(before, @identity) != Map.take(after_row, @identity) ->
          false

        true ->
          same_attempt = before["attempt_id"] == after_row["attempt_id"]
          same_shelter = before["sheltered"] == after_row["sheltered"]

          case {before["status"], after_row["status"]} do
            {"failed", "active"} ->
              not same_attempt and after_row["cursor"] == 0 and
                after_row["sheltered"] == false

            {"active", "failed"} ->
              same_attempt and after_row["cursor"] == 0 and
                after_row["sheltered"] == false

            {"active", status} when status in ~w(active completed) ->
              same_attempt and
                ((same_shelter and after_row["cursor"] == before["cursor"] + 1) or
                   (status == "active" and before["cursor"] == after_row["cursor"] and
                      before["sheltered"] == false and after_row["sheltered"] == true))

            _ ->
              false
          end
      end

    if before == op["expected"] and after_row["quest_instance_id"] == op["quest_instance_id"] and
         legal,
       do: {:ok, after_row},
       else: {:error, "precondition_failed"}
  end
end
