defmodule Loka.Core.ComposePatrol do
  @moduledoc "Portable patrol lifecycle; route and causal credit remain story semantics."
  @identity ~w(kind actor_id body_id npc_id quest_instance_id continuation_id choice_id)

  def transition(op, row) do
    value = op["value"]

    if row == op["expected"] and value["quest_instance_id"] == op["quest_instance_id"] and
         Enum.uniq(value["credit"]) == value["credit"] and legal?(row, value),
       do: {:ok, value},
       else: {:error, "precondition_failed"}
  end

  defp legal?(nil, value), do: value["status"] == "together" and value["credit"] == []

  # ponytail: keep the finite transition table visible; split on growth. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  defp legal?(before, value) do
    fixed = before["attempt_id"] == value["attempt_id"]
    credit = before["credit"] == value["credit"]
    cursor = before["cursor"] == value["cursor"]

    Map.take(before, @identity) == Map.take(value, @identity) and
      case {before["status"], value["status"]} do
        {"together", "awaiting"} ->
          fixed and credit and not cursor

        {s, "paused"} when s in ~w(together awaiting) ->
          fixed and credit and cursor

        {"paused", "together"} ->
          fixed and credit and cursor

        {s, "failed"} when s in ~w(together awaiting paused) ->
          fixed and cursor and value["credit"] == []

        {"failed", "together"} ->
          not fixed and cursor and value["credit"] == []

        {"awaiting", s} when s in ~w(together completed) ->
          fixed and cursor and
            (credit or
               (length(value["credit"]) == length(before["credit"]) + 1 and
                  Enum.drop(value["credit"], -1) == before["credit"]))

        _ ->
          false
      end
  end
end
